/**
 * Fit report eval — does the thing that ships actually separate?
 *
 * This runs the PRODUCTION evaluator (src/services/fitReport.ts). It used to
 * carry its own copy of the prompt, which is how you end up measuring one
 * prompt and shipping another. There is one prompt now and this is the harness
 * over it.
 *
 * The set is built to be even: six real resumes, each paired with one job it
 * should win and one it should not. Twelve pairs, six and six. If the designed
 * matches do not score above the designed mismatches, the pipeline is broken.
 *
 * The numbers to hold:
 *   - designed matches ~79 avg, designed mismatches ~8 avg
 *   - zero overlap (no designed match at or below the top designed mismatch)
 *   - apply 6/6 on matches, 0/6 on mismatches
 *   - all three bands in use. `stretch` matters most commercially: it is the
 *     "you can win this once the resume is written for it" case, which is the
 *     only place the paid upsell is honest.
 *
 * No Australian-experience or international-graduate logic is under test here.
 * That belongs in a separate layer that reads a finished report.
 *
 * Run:  npx tsx src/tests/fitReportEval.ts
 *       npx tsx src/tests/fitReportEval.ts --model anthropic/claude-haiku-4-5
 * Needs OPENROUTER_API_KEY in server/.env
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { runFitReport, type FitReport } from '../services/fitReport';

dotenv.config();

const REPO = path.resolve(__dirname, '../../..');
const RESUMES = path.join(REPO, 'evals/fixtures/resumes');
const JDS = path.join(REPO, 'evals/datasets/job-descriptions');
const OUT = path.join(REPO, 'evals/fit-report-results');

/** Each resume paired with one job it should win and one it should not. */
const PAIRS: { resume: string; jd: string; expect: 'match' | 'mismatch' }[] = [
  { resume: 'RITVIK_SHARMA_-_ (7).txt', jd: 'data-engineer-jd.txt', expect: 'match' },
  { resume: 'RITVIK_SHARMA_-_ (7).txt', jd: 'sustainability-analyst-jd.txt', expect: 'mismatch' },

  { resume: 'Kunal_Krishneel_Chand_AU_v2.txt', jd: 'dotnet-developer-jd.txt', expect: 'match' },
  { resume: 'Kunal_Krishneel_Chand_AU_v2.txt', jd: 'environmental-consultant-jd.txt', expect: 'mismatch' },

  { resume: 'Sandhya_Vijayan_Resume.txt', jd: 'sustainability-analyst-jd.txt', expect: 'match' },
  { resume: 'Sandhya_Vijayan_Resume.txt', jd: 'data-engineer-jd.txt', expect: 'mismatch' },

  { resume: 'TanviH.Resume.txt', jd: 'graduate-analyst-jd.txt', expect: 'match' },
  { resume: 'TanviH.Resume.txt', jd: 'civil-site-engineer-jd.txt', expect: 'mismatch' },

  { resume: 'ALEENA SAJU CV.txt', jd: 'environmental-consultant-jd.txt', expect: 'match' },
  { resume: 'ALEENA SAJU CV.txt', jd: 'dotnet-developer-jd.txt', expect: 'mismatch' },

  { resume: 'Vijay Resume_CE.txt', jd: 'civil-site-engineer-jd.txt', expect: 'match' },
  { resume: 'Vijay Resume_CE.txt', jd: 'graduate-analyst-jd.txt', expect: 'mismatch' },
];

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY is not set in server/.env');
    process.exit(1);
  }

  // The service reads FIT_MODEL, so --model works by setting it for this run.
  const model = arg('model', '');
  if (model) process.env.FIT_MODEL = model;

  fs.mkdirSync(OUT, { recursive: true });

  const rows: (FitReport & {
    resume: string; jd: string; expect: string;
    reqCount: number; ms: number;
  })[] = [];

  for (const p of PAIRS) {
    const resume = fs.readFileSync(path.join(RESUMES, p.resume), 'utf8');
    const jd = fs.readFileSync(path.join(JDS, p.jd), 'utf8');
    const slug = `${p.resume.replace('.txt', '')}__${p.jd.replace('.txt', '')}`;

    let out;
    try {
      out = await runFitReport(resume, jd);
    } catch (e) {
      console.error(`FAILED ${slug}: ${(e as Error).message}`);
      continue;
    }

    fs.writeFileSync(path.join(OUT, `${slug}.json`), JSON.stringify(out.report, null, 2));

    rows.push({
      ...out.report,
      resume: p.resume.replace('.txt', '').slice(0, 20),
      jd: p.jd.replace('-jd.txt', ''),
      expect: p.expect,
      reqCount: out.requirements.length,
      ms: out.ms,
    });

    console.log(
      `${(p.expect === 'match' ? 'MATCH   ' : 'MISMATCH')} ${slug.slice(0, 46).padEnd(46)} ` +
      `fit=${String(out.report.fit).padStart(3)} ${out.report.band.padEnd(9)} ${out.report.outcome.padEnd(6)} ` +
      `reqs=${String(out.requirements.length).padStart(2)} ${(out.ms / 1000).toFixed(1)}s`,
    );
  }

  const m = rows.filter((r) => r.expect === 'match');
  const x = rows.filter((r) => r.expect === 'mismatch');
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : 0);

  console.log('\n═══ DOES IT SEPARATE? ═══');
  console.log(`designed matches    avg fit ${avg(m.map((r) => r.fit))}  (${m.map((r) => r.fit).join(', ')})`);
  console.log(`designed mismatches avg fit ${avg(x.map((r) => r.fit))}  (${x.map((r) => r.fit).join(', ')})`);
  console.log(`overlap: ${m.filter((r) => r.fit <= Math.max(...x.map((v) => v.fit))).length} matches scored at or below the top mismatch`);
  console.log(`apply on designed match: ${m.filter((r) => r.outcome === 'apply').length}/${m.length}`);
  console.log(`apply on designed mismatch: ${x.filter((r) => r.outcome === 'apply').length}/${x.length}`);
  console.log(`bands: ${[...new Set(rows.map((r) => r.band))].join(', ')}`);

  console.log('\n═══ WHAT THE AD SAID IT WAS ═══');
  console.log(`job title read from the ad: ${rows.filter((r) => r.jobTitle).length}/${rows.length}`);
  console.log(`employer read from the ad:  ${rows.filter((r) => r.company).length}/${rows.length}`);
  console.log(`avg latency ${(avg(rows.map((r) => r.ms)) / 1000).toFixed(1)}s`);

  console.log('\n═══ VERDICTS ═══');
  for (const r of [...rows].sort((a, b) => b.fit - a.fit)) {
    console.log(`\n[${String(r.fit).padStart(3)}] ${r.band.toUpperCase().padEnd(8)} ${r.expect === 'match' ? 'want-match' : 'want-miss '} ${r.resume} x ${r.jd}`);
    console.log(`      ${r.verdict}`);
  }

  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(rows, null, 2));
  console.log(`\nReports in ${OUT}`);
}

main();
