/**
 * Does the model actually honour the supplied-section contract?
 *
 * Everything else about the splice is deterministic and unit-tested. The one
 * unproven assumption is behavioural: told to write "## Education" followed by
 * a placeholder, does Claude do that, or does it write the section anyway and
 * ignore the instruction? This runs the real prompt against real resumes and
 * reports what came back, alongside the same case generated the old way so the
 * token saving is measured rather than estimated.
 *
 * Run:  npx tsx src/tests/spliceSmoke.ts [--cases 3]
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { callClaude } from '../services/llm';
import { RESUME_V2_PROMPT, SuppliedSection } from '../services/prompts/generationV2';
import { buildProfileSections, spliceProfileSections, SUPPLIED_MARKER } from '../lib/profileSections';
import { groundSkillsSection } from '../lib/groundSkills';
import { checkGrounding } from '../lib/groundingGate';
import { checkStyle, formatStyleViolationsForRetry, normalizeEmDashes } from '../lib/styleLint';

dotenv.config();

const MODEL = process.env.SMOKE_MODEL || 'anthropic/claude-opus-4-8';
const IN_COST = 5, OUT_COST = 25;
const REPO = path.resolve(__dirname, '../../..');
const FIXTURES = path.join(REPO, 'evals/fixtures/resumes');
const JDS = path.join(REPO, 'evals/datasets/job-descriptions');

/** Stand-ins for the profile relations, so this needs no database. */
const PROFILES: Record<string, any> = {
  'RITVIK_SHARMA_-_ (7)': {
    education: [
      { degree: 'Master of Data Science', field: null, institution: 'Monash University', location: 'Clayton Campus', year: 'Mar 2025', startDate: null, endDate: null },
      { degree: 'Bachelor of Computer Engineering', field: null, institution: 'Thapar Institute of Engineering and Technology', location: 'Patiala', year: null, startDate: 'Jun 2018', endDate: 'Jul 2022' },
    ],
    certifications: [],
  },
  Kunal_Krishneel_Chand_AU_v2: {
    education: [
      { degree: 'Master of Information Systems', field: null, institution: 'University of the South Pacific', location: null, year: '2021', startDate: null, endDate: null },
      { degree: 'Bachelor of Science', field: 'Computing Science & Information Systems', institution: 'University of the South Pacific', location: null, year: '2012', startDate: null, endDate: null },
    ],
    certifications: [
      { name: 'MCSA: Microsoft SQL Server 2012/2014', issuingBody: '', year: null },
      { name: 'Dbvisit StandbyMP Technical Associate', issuingBody: 'Oracle', year: null },
      { name: 'PMP Training (40 hours completed)', issuingBody: '', year: null },
      { name: 'AWS Cloud Practitioner', issuingBody: '', year: 'In Progress' },
    ],
  },
  G_GeetaliCV: {
    education: [
      { degree: 'Master of Commerce (Extension)', field: null, institution: 'University of Sydney', location: null, year: '2023-2025', startDate: null, endDate: null },
    ],
    certifications: [],
  },
};

const stripFences = (raw: string) => {
  let t = raw.trim();
  if (t.startsWith('```')) {
    const lines = t.split('\n');
    if (lines[0].startsWith('```')) lines.shift();
    if (lines[lines.length - 1]?.startsWith('```')) lines.pop();
    t = lines.join('\n').trim();
  }
  return normalizeEmDashes(t);
};

const shapeOk = (t: string, suppliedEdu: boolean) =>
  ['# ', '## Professional Summary', '## Work Experience', '### ', '## Skills'].every((m) => t.includes(m)) &&
  (suppliedEdu || t.includes('## Education'));

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY is not set.');
    process.exit(1);
  }
  const jdFile = fs.readdirSync(JDS).filter((f) => f.endsWith('.txt') && !f.includes('injection'))[0];
  const jd = fs.readFileSync(path.join(JDS, jdFile), 'utf8');

  let oldOut = 0, newOut = 0, oldCost = 0, newCost = 0;

  for (const [name, relations] of Object.entries(PROFILES)) {
    const resume = fs.readFileSync(path.join(FIXTURES, `${name}.txt`), 'utf8');
    const sections = buildProfileSections({ ...relations, resumeRawText: resume });
    const supplied = sections.map((s) => s.heading.replace('## ', '') as SuppliedSection);

    console.log(`\n${'='.repeat(70)}\n${name}\n  supplying: ${supplied.join(', ') || '(nothing)'}`);

    // Arm A: today's behaviour.
    const a = await callClaude(RESUME_V2_PROMPT(resume, jd), false, undefined, MODEL);
    const aText = stripFences(a.content);
    oldOut += a.usage.completionTokens;
    oldCost += (a.usage.promptTokens / 1e6) * IN_COST + (a.usage.completionTokens / 1e6) * OUT_COST;

    // Arm B: the splice.
    const b = await callClaude(RESUME_V2_PROMPT(resume, jd, supplied), false, undefined, MODEL);
    const bRaw = stripFences(b.content);
    newOut += b.usage.completionTokens;
    newCost += (b.usage.promptTokens / 1e6) * IN_COST + (b.usage.completionTokens / 1e6) * OUT_COST;

    const markers = (bRaw.match(/\[\[SUPPLIED\]\]/g) || []).length;
    const splice = spliceProfileSections(bRaw, sections);
    const skills = groundSkillsSection(splice.content, resume);
    const bText = normalizeEmDashes(skills.content);

    const suppliedEdu = sections.some((s) => s.key === 'education');
    const gA = checkGrounding(aText, resume, jd), sA = checkStyle(aText, false);
    const gB = checkGrounding(bText, resume, jd), sB = checkStyle(bText, false);

    console.log(`  contract   : model emitted ${markers}/${supplied.length} placeholder(s)`);
    console.log(`  splice     : applied=[${splice.applied}] appended=[${splice.appended}] orphans=${splice.orphanedMarkers}`);
    console.log(`  skills     : removed ${skills.dropped.length}${skills.dropped.length ? ' -> ' + skills.dropped.join(', ') : ''}${skills.abstained ? ' (abstained)' : ''}`);
    console.log(`  marker leak: ${bText.includes(SUPPLIED_MARKER) ? 'YES - BUG' : 'none'}`);
    console.log(`  shape      : old=${shapeOk(aText, false) ? 'ok' : 'FAIL'}  new=${shapeOk(bText, suppliedEdu) ? 'ok' : 'FAIL'}`);
    console.log(`  gate       : old=${gA.violations.length + sA.violations.length}  new=${gB.violations.length + sB.violations.length}`);
    const vB = [...gB.violations, ...formatStyleViolationsForRetry(sB.violations)];
    if (vB.length) vB.forEach((v) => console.log(`               new: ${v}`));
    console.log(`  output tok : old=${a.usage.completionTokens}  new=${b.usage.completionTokens}  (${(100 * (1 - b.usage.completionTokens / a.usage.completionTokens)).toFixed(1)}% less)`);

    const dir = path.join(REPO, 'evals/splice-smoke', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'old.md'), aText);
    fs.writeFileSync(path.join(dir, 'new.raw.md'), bRaw);
    fs.writeFileSync(path.join(dir, 'new.assembled.md'), bText);
  }

  console.log(`\n${'='.repeat(70)}\nTOTAL output tokens: ${oldOut} -> ${newOut}  (${(100 * (1 - newOut / oldOut)).toFixed(1)}% less)`);
  console.log(`TOTAL cost: $${oldCost.toFixed(4)} -> $${newCost.toFixed(4)}  (${(100 * (1 - newCost / oldCost)).toFixed(1)}% less)`);
  console.log('\nOutputs in evals/splice-smoke/ - read old.md against new.assembled.md.');
}

main().catch((e) => { console.error(e); process.exit(1); });
