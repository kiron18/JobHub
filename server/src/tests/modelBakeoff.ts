/**
 * Model bake-off: can a cheaper model do this work without losing quality?
 *
 * Opus 4.8 is 90% of the OpenRouter bill. This script answers two separate
 * questions with the same run, using real client resumes from evals/fixtures:
 *
 *   Q1 (first pass)  Can the main generation run on Sonnet or Haiku?
 *                    That is the $69.76/month bucket, the biggest one.
 *   Q2 (the repair)  When the grounding/style gate fails, can the retry that
 *                    fixes it run on a cheaper model? That is $48.27/month.
 *
 * Q2 matters more than it looks: the retry re-sends the whole prompt, so a
 * retry costs about as much as the generation it is fixing.
 *
 * Everything is scored by the SAME deterministic gates production uses
 * (checkGrounding + checkStyle), so the pass/fail number is not a matter of
 * opinion. Opinion is what the human pass is for: the script writes every
 * output to disk side by side and flags the cases where the models disagree,
 * because those are the only ones worth reading.
 *
 * Run:  npx tsx src/tests/modelBakeoff.ts
 *       npx tsx src/tests/modelBakeoff.ts --resumes 6 --jds 2
 * Needs OPENROUTER_API_KEY in server/.env
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { callClaude } from '../services/llm';
import { checkGrounding } from '../lib/groundingGate';
import { checkStyle, formatStyleViolationsForRetry, normalizeEmDashes } from '../lib/styleLint';
import { RESUME_V2_PROMPT } from '../services/prompts/generationV2';
import { groundSkillsSection } from '../lib/groundSkills';
import { normalizeForMatch, isGroundedInSource } from '../lib/fidelityGuard';

dotenv.config();

// OpenRouter slugs. Prices are $ per 1M tokens (input, output) so the script
// can report what each arm actually cost rather than guessing.
const MODELS = [
  { slug: 'anthropic/claude-opus-4-8', label: 'opus-4.8', in: 5, out: 25 },
  { slug: 'anthropic/claude-sonnet-4-5', label: 'sonnet-4.5', in: 3, out: 15 },
  { slug: 'anthropic/claude-haiku-4-5', label: 'haiku-4.5', in: 1, out: 5 },
];

const REPO = path.resolve(__dirname, '../../..');
const FIXTURES = path.join(REPO, 'evals/fixtures/resumes');
const JDS = path.join(REPO, 'evals/datasets/job-descriptions');
const OUT = path.join(REPO, 'evals/bakeoff-results');

interface Score {
  grounding: number;
  style: number;
  total: number;
  shapeOk: boolean;
  violations: string[];
}

interface Arm {
  model: string;
  text: string;
  score: Score;
  costUsd: number;
  ms: number;
  /** Named tools the filter removed from the Skills section. */
  skillsRemoved: string[];
  /** True when the filter declined rather than gut the section. */
  skillsAbstained: boolean;
  /** Named tools claimed in the prose, which the filter cannot reach. */
  proseTools: string[];
  repair?: { text: string; score: Score; costUsd: number };
}

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : fallback;
}

/** Same shape check production uses before it will accept a resume. */
function passesShapeCheck(text: string): boolean {
  return [
    '# ',
    '## Professional Summary',
    '## Work Experience',
    '### ',
    '## Education',
    '## Skills',
  ].every((marker) => text.includes(marker));
}

function stripFences(raw: string): string {
  let t = raw.trim();
  if (t.startsWith('```')) {
    const lines = t.split('\n');
    if (lines[0].startsWith('```')) lines.shift();
    if (lines[lines.length - 1]?.startsWith('```')) lines.pop();
    t = lines.join('\n').trim();
  }
  // Production normalises em dashes deterministically before the gate sees the
  // text, so the harness must too or it measures a retry production no longer
  // pays for.
  return normalizeEmDashes(t);
}

/**
 * Named tools claimed inside the prose, where the skills filter cannot reach.
 *
 * The filter cleans the Skills section, which is where every hard fabrication in
 * the first bake-off lived. It says nothing about a bullet that claims the
 * candidate "built the pipeline in Airflow". That is the residual risk in any
 * model swap, so it gets measured rather than assumed away.
 *
 * A token counts as a named tool only if it is shaped like one: an internal
 * capital (PostgreSQL), an all-caps acronym (ETL), or a digit or symbol
 * (.NET, S3). Ordinary sentence-initial capitals are ignored.
 */
function toolLike(token: string): boolean {
  if (token.length < 2) return false;
  if (/[0-9./#+]/.test(token)) return true;
  if (/^[A-Z]{2,}$/.test(token)) return true;
  return /^[A-Za-z].*[a-z].*[A-Z]/.test(token);
}

function unsupportedToolsInProse(output: string, resume: string, jd: string): string[] {
  const normalizedResume = normalizeForMatch(resume);
  const squashedResume = normalizedResume.replace(/\s/g, '');
  const normalizedJd = normalizeForMatch(jd);
  const found = new Map<string, boolean>();

  // Only the parts the model actually wrote as prose.
  let inSkills = false;
  for (const line of output.split('\n')) {
    if (line.startsWith('## ')) inSkills = /^## skills/i.test(line);
    if (inSkills) continue;
    if (!line.startsWith('- ') && !/^[A-Za-z]/.test(line.trim())) continue;

    for (const raw of line.split(/[\s,;()[\]"]+/)) {
      const token = raw.replace(/[*_`]/g, '').replace(/[.,:;]+$/, '');
      if (!toolLike(token)) continue;
      if (isGroundedInSource(token, normalizedResume)) continue;
      const squashed = normalizeForMatch(token).replace(/\s/g, '');
      if (squashed.length > 2 && squashedResume.includes(squashed)) continue;
      // Flag it, noting whether it came out of the job ad.
      found.set(token, isGroundedInSource(token, normalizedJd));
    }
  }
  return [...found.entries()].map(([t, fromJd]) => (fromJd ? `${t} (from the JD)` : t));
}

function score(text: string, resume: string, jd: string): Score {
  const g = checkGrounding(text, resume, jd);
  const s = checkStyle(text, false);
  return {
    grounding: g.violations.length,
    style: s.violations.length,
    total: g.violations.length + s.violations.length,
    shapeOk: passesShapeCheck(text),
    violations: [...g.violations, ...formatStyleViolationsForRetry(s.violations)],
  };
}

function cost(m: (typeof MODELS)[number], promptTok: number, outTok: number): number {
  return (promptTok / 1e6) * m.in + (outTok / 1e6) * m.out;
}

/**
 * What production would actually ship: the model's markdown with the skills
 * filter applied. Scoring the raw output would measure a document no candidate
 * ever receives.
 */
function applyFilter(raw: string, resume: string) {
  const r = groundSkillsSection(raw, resume);
  return { text: r.content, dropped: r.dropped, abstained: r.abstained };
}

async function runArm(
  m: (typeof MODELS)[number],
  prompt: string,
  resume: string,
  jd: string,
): Promise<Arm> {
  const t0 = Date.now();
  const { content, usage } = await callClaude(prompt, false, undefined, m.slug);
  const ms = Date.now() - t0;
  const rawText = stripFences(content);
  const filtered = applyFilter(rawText, resume);
  const text = filtered.text;
  const sc = score(text, resume, jd);
  const c = cost(m, usage.promptTokens, usage.completionTokens);

  const arm: Arm = {
    model: m.label,
    text,
    score: sc,
    costUsd: c,
    ms,
    skillsRemoved: filtered.dropped,
    skillsAbstained: filtered.abstained,
    proseTools: unsupportedToolsInProse(text, resume, jd),
  };

  // Q2: only meaningful when the first pass actually failed the gate. This is
  // the same repair prompt production builds.
  if (sc.total > 0) {
    const repairPrompt =
      prompt +
      '\n\n== YOUR PREVIOUS ATTEMPT VIOLATED THESE RULES, FIX THEM ==\n' +
      sc.violations.map((v) => `- ${v}`).join('\n');
    const r = await callClaude(repairPrompt, false, undefined, m.slug);
    const rFiltered = applyFilter(stripFences(r.content), resume);
    arm.repair = {
      text: rFiltered.text,
      score: score(rFiltered.text, resume, jd),
      costUsd: cost(m, r.usage.promptTokens, r.usage.completionTokens),
    };
    // The shipped document is the repair, so its numbers are the ones that count.
    arm.skillsRemoved = rFiltered.dropped;
    arm.skillsAbstained = rFiltered.abstained;
    arm.proseTools = unsupportedToolsInProse(rFiltered.text, resume, jd);
  }
  return arm;
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY is not set. Add it to server/.env and re-run.');
    process.exit(1);
  }

  const nResumes = arg('resumes', 12);
  const nJds = arg('jds', 3);

  const resumeFiles = fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.txt')).slice(0, nResumes);
  const jdFiles = fs
    .readdirSync(JDS)
    .filter((f) => f.endsWith('.txt') && !f.includes('injection'))
    .slice(0, nJds);

  fs.mkdirSync(OUT, { recursive: true });

  const cases = resumeFiles.flatMap((r) => jdFiles.map((j) => ({ r, j })));
  console.log(
    `${cases.length} cases (${resumeFiles.length} resumes x ${jdFiles.length} JDs) x ${MODELS.length} models\n`,
  );

  const rows: any[] = [];

  for (const [idx, c] of cases.entries()) {
    const resume = fs.readFileSync(path.join(FIXTURES, c.r), 'utf8');
    const jd = fs.readFileSync(path.join(JDS, c.j), 'utf8');
    const prompt = RESUME_V2_PROMPT(resume, jd);
    const caseName = `${path.basename(c.r, '.txt')}__${path.basename(c.j, '.txt')}`;

    process.stdout.write(`[${idx + 1}/${cases.length}] ${caseName}\n`);

    const arms: Arm[] = [];
    for (const m of MODELS) {
      try {
        const arm = await runArm(m, prompt, resume, jd);
        arms.push(arm);
        const r = arm.repair;
        console.log(
          `    ${m.label.padEnd(12)} gate ${arm.score.total === 0 ? 'PASS' : `FAIL(${arm.score.total})`}` +
            (r ? ` -> repair ${r.score.total === 0 ? 'PASS' : `FAIL(${r.score.total})`}` : '') +
            `  $${(arm.costUsd + (r?.costUsd ?? 0)).toFixed(4)}  ${(arm.ms / 1000).toFixed(1)}s`,
        );
      } catch (e: any) {
        console.error(`    ${m.label.padEnd(12)} ERROR ${e.message}`);
      }
    }

    // Write every output so the human pass has something to read.
    const dir = path.join(OUT, caseName);
    fs.mkdirSync(dir, { recursive: true });
    for (const a of arms) {
      fs.writeFileSync(path.join(dir, `${a.model}.md`), a.text);
      if (a.repair) fs.writeFileSync(path.join(dir, `${a.model}.repaired.md`), a.repair.text);
    }

    rows.push({
      case: caseName,
      arms: arms.map((a) => ({
        model: a.model,
        firstPass: a.score.total,
        shapeOk: a.score.shapeOk,
        afterRepair: a.repair ? a.repair.score.total : a.score.total,
        cost: a.costUsd + (a.repair?.costUsd ?? 0),
        ms: a.ms,
        violations: a.score.violations,
        skillsRemoved: a.skillsRemoved,
        skillsAbstained: a.skillsAbstained,
        proseTools: a.proseTools,
      })),
    });
  }

  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(rows, null, 2));

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(72));
  console.log('SUMMARY');
  console.log('='.repeat(72));
  console.log(
    `${'model'.padEnd(13)}${'1st-pass'.padEnd(11)}${'post-repair'.padEnd(13)}${'shape'.padEnd(8)}${'cost'.padEnd(10)}avg time`,
  );

  for (const m of MODELS) {
    const a = rows.flatMap((r: any) => r.arms.filter((x: any) => x.model === m.label));
    if (!a.length) continue;
    const pass = a.filter((x: any) => x.firstPass === 0).length;
    const post = a.filter((x: any) => x.afterRepair === 0).length;
    const shape = a.filter((x: any) => x.shapeOk).length;
    const tot = a.reduce((s: number, x: any) => s + x.cost, 0);
    const ms = a.reduce((s: number, x: any) => s + x.ms, 0) / a.length;
    console.log(
      `${m.label.padEnd(13)}${`${pass}/${a.length}`.padEnd(11)}${`${post}/${a.length}`.padEnd(13)}` +
        `${`${shape}/${a.length}`.padEnd(8)}$${tot.toFixed(2).padEnd(9)}${(ms / 1000).toFixed(1)}s`,
    );
  }

  // The only cases worth a human reading: where the models disagree.
  const disagree = rows.filter((r: any) => {
    const p = r.arms.map((x: any) => x.afterRepair === 0);
    return p.some(Boolean) && !p.every(Boolean);
  });

  console.log(`\nMODELS DISAGREED ON ${disagree.length}/${rows.length} CASES — read these first:`);
  for (const d of disagree) {
    const detail = d.arms
      .map((x: any) => `${x.model}:${x.afterRepair === 0 ? 'pass' : 'fail'}`)
      .join('  ');
    console.log(`  ${d.case}\n     ${detail}`);
  }

  // ── Fabrication, which the gate cannot see ────────────────────────────────
  // This is the number that decides a model swap. The gate above says nothing
  // about a tool the candidate has never used, and that is the failure that
  // costs them the interview rather than the formatting.
  console.log('\n' + '='.repeat(72));
  console.log('FABRICATED TOOLS (what the gate never checked)');
  console.log('='.repeat(72));
  console.log(
    `${'model'.padEnd(13)}${'skills caught'.padEnd(16)}${'abstained'.padEnd(12)}${'left in prose'.padEnd(15)}docs`,
  );
  for (const m of MODELS) {
    const a = rows.flatMap((r: any) => r.arms.filter((x: any) => x.model === m.label));
    if (!a.length) continue;
    const caught = a.reduce((s: number, x: any) => s + (x.skillsRemoved?.length ?? 0), 0);
    const abst = a.filter((x: any) => x.skillsAbstained).length;
    const prose = a.reduce((s: number, x: any) => s + (x.proseTools?.length ?? 0), 0);
    console.log(
      `${m.label.padEnd(13)}${String(caught).padEnd(16)}${String(abst).padEnd(12)}${String(prose).padEnd(15)}${a.length}`,
    );
  }

  for (const m of MODELS) {
    const a = rows.flatMap((r: any) =>
      r.arms.filter((x: any) => x.model === m.label).map((x: any) => ({ ...x, case: r.case })),
    );
    const caught = a.flatMap((x: any) => (x.skillsRemoved ?? []).map((s: string) => `${x.case.slice(0, 26)} :: ${s}`));
    const prose = a.flatMap((x: any) => (x.proseTools ?? []).map((s: string) => `${x.case.slice(0, 26)} :: ${s}`));
    if (caught.length) {
      console.log(`
--- ${m.label}: removed from Skills (${caught.length}) ---`);
      caught.forEach((x: string) => console.log('   ' + x));
    }
    if (prose.length) {
      console.log(`
--- ${m.label}: STILL IN THE PROSE (${prose.length}) ---`);
      prose.forEach((x: string) => console.log('   ' + x));
    }
  }

  // Which rules actually fire. This is the input to the prompt fix (lever 1) —
  // it is the logging that does not exist in production yet.
  const freq = new Map<string, number>();
  for (const r of rows)
    for (const a of r.arms)
      for (const v of a.violations) {
        const key = v.replace(/"[^"]*"/g, '"…"').slice(0, 70);
        freq.set(key, (freq.get(key) ?? 0) + 1);
      }
  console.log('\nTOP VIOLATIONS DRIVING RETRIES:');
  [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .forEach(([v, n]) => console.log(`  ${String(n).padStart(4)}x  ${v}`));

  console.log(`\nOutputs written to evals/bakeoff-results/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
