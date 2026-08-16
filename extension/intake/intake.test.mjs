// Tests for the story intake planner.
// Run: node intake.test.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parseResume, scoreSeed, extractSeeds, analyseGaps,
  buildScript, anchorRole, planIntake, formatScript, NEVER_ON_RESUME,
} from './intake.js';

const here = dirname(fileURLToPath(import.meta.url));
const RESUME = readFileSync(join(here, 'resume.example.txt'), 'utf8');

let passed = 0, failed = 0;
const out = [];
function check(name, fn) {
  let ok = false, detail = '';
  try {
    const r = fn();
    ok = r === true || r === undefined;
    if (!ok) detail = ` (got ${JSON.stringify(r)})`;
  } catch (e) { detail = ` (threw ${e.message})`; }
  ok ? passed++ : failed++;
  out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail}`);
}

const plan = planIntake(RESUME, { industry: 'finance' });
const { seeds, gaps, script } = plan;
const seedFor = (re) => seeds.find((s) => re.test(s.text));

// ------------------------------------------------------------------ parsing

check('finds the resume sections', () => {
  const headings = parseResume(RESUME).map((s) => s.heading);
  return headings.includes('education') && headings.includes('experience')
    && headings.includes('volunteer') && headings.includes('skills');
});

check('reads role, org and dates off an entry line', () => {
  const exp = parseResume(RESUME).find((s) => s.heading === 'experience');
  const intern = exp.entries[0];
  return intern.role === 'Finance Intern' && intern.org === 'Meridian Advisory'
    && /Nov 2025/.test(intern.dates);
});

check('attaches bullets to the right employer', () => {
  const exp = parseResume(RESUME).find((s) => s.heading === 'experience');
  const retail = exp.entries.find((e) => e.org === 'Harborline Supermarkets');
  return retail.bullets.length === 4;
});

// ------------------------------------------------------------------ scoring

check('a real achievement scores as a moment', () =>
  scoreSeed('Coordinated quarterly stocktake for a high-volume store, identifying a supplier discrepancy worth $2,000').score >= 4);

check('"Responsible for general customer service duties" is not a moment', () =>
  scoreSeed('Responsible for general customer service duties').score < 2);

check('"Assisted with day-to-day operational tasks as required" is not a moment', () =>
  scoreSeed('Assisted with day-to-day operational tasks as required').score < 2);

check('"Various tasks as required" is not a moment', () =>
  scoreSeed('Various tasks as required').score < 2);

check('a skills list is not a moment', () =>
  scoreSeed('Proficient in Excel, Power BI, SQL, Python, Xero').score < 2);

check('duty statements are excluded from the strong set', () =>
  !seeds.filter((s) => s.strong).some((s) => /responsible for|as required|various tasks/i.test(s.text)));

check('the skills section is skipped entirely', () =>
  !seeds.some((s) => s.section === 'skills'));

check('finds a useful number of real moments', () => {
  const n = seeds.filter((s) => s.strong).length;
  return n >= 5 && n <= 12;
});

// --------------------------------------------------------- resume -> themes

check('Power BI rebuild reads as initiative or learning', () => {
  const s = seedFor(/Power BI/);
  return s.themes.includes('initiative') || s.themes.includes('learning');
});

check('reconciliation reads as attention to detail', () =>
  seedFor(/Reconciled supplier ledgers/).themes.includes('detail'));

check('training new starters reads as leadership', () =>
  seedFor(/Trained two new starters/).themes.includes('leadership'));

check('cafe complaints read as customer', () =>
  seedFor(/Handled customer orders and complaints/).themes.includes('customer'));

check('covering two roles at once reads as priorities', () =>
  seedFor(/Covered register and floor/).themes.includes('priorities'));

check('group project reads as teamwork', () =>
  seedFor(/group project/).themes.includes('teamwork'));

// -------------------------------------------------------------------- gaps

check('failure, conflict and ethics are ALWAYS gaps', () =>
  NEVER_ON_RESUME.every((t) => gaps.gaps.some((g) => g.theme === t)));

check('those three are marked unreachable, not merely missing', () =>
  gaps.rows.filter((r) => r.unreachable).every((r) => !r.covered));

check('no resume can ever cover them', () => {
  // Even a resume stuffed with every hint word leaves these three empty.
  const stuffed = `EXPERIENCE\nAll Rounder | Everything Co | 2020 - 2024\n`
    + `- Led coordinated collaborative customer reconciliation training safety procedure\n`
    + `- Launched improved automated migration under deadline with multiple simultaneous priorities\n`;
  const g = analyseGaps(extractSeeds(stuffed, { industry: 'health' }), { industry: 'health' });
  return NEVER_ON_RESUME.every((t) => g.gaps.some((x) => x.theme === t));
});

check('the resume does cover a decent share of the rest', () =>
  gaps.coveredCount >= 6);

check('gaps are ordered by how often they get asked', () => {
  const f = gaps.gaps.map((g) => g.frequency);
  return f.every((v, i) => i === 0 || f[i - 1] >= v);
});

check('finance candidate picks up the procedure add-on theme', () =>
  gaps.rows.some((r) => r.theme === 'procedure'));

check('a generic candidate does not get safety questions', () => {
  const p = planIntake(RESUME);
  return !p.gaps.rows.some((r) => r.theme === 'safety');
});

// ------------------------------------------------------------------ script

check('anchors on the longest-held job', () => anchorRole(seeds) === 'Harborline Supermarkets');

check('every gap question names a real place, never abstract', () =>
  script.questions.filter((q) => q.kind === 'gap')
    .every((q) => q.ask.includes('Harborline Supermarkets')));

check('never asks the useless abstract version', () =>
  !script.questions.some((q) => /^tell me about a time you (failed|made a mistake)\.?$/i.test(q.ask.trim())));

check('asks about failure and conflict explicitly', () => {
  const themes = script.questions.flatMap((q) => q.themes);
  return themes.includes('failure') && themes.includes('conflict');
});

check('seed questions quote the resume line back', () =>
  script.questions.filter((q) => q.kind === 'seed').every((q) => q.ask.includes('"')));

check('every question carries the three probes', () =>
  script.questions.every((q) => q.probes.length === 3
    && q.probes[0].includes('specifically')
    && q.probes[1].includes('NOT')));

check('the whole thing fits in one sitting', () =>
  script.estimatedMinutes > 0 && script.estimatedMinutes <= 90);

check('question count is workable', () =>
  script.questions.length >= 8 && script.questions.length <= 18);

check('handles an empty resume without falling over', () => {
  const p = planIntake('');
  return p.seeds.length === 0 && p.script.questions.length > 0
    && p.script.questions.every((q) => q.kind === 'gap');
});

check('handles a resume with no dated entries', () => {
  const p = planIntake('EXPERIENCE\n- Did some things\n- Did other things');
  return Array.isArray(p.seeds);
});

// ------------------------------------------------------------------- report

console.log(out.join('\n'));
console.log(`\n${passed}/${passed + failed} passed`);

if (failed === 0) {
  console.log(`\n${'='.repeat(78)}`);
  console.log(formatScript(plan));
}

process.exit(failed ? 1 : 0);
