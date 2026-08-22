// Tests for bank validation and coverage. Run: node matcher/bank.test.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateBank, bankCoverage, withLearned, emptyBank } from './bank.js';

const here = dirname(fileURLToPath(import.meta.url));
const bank = JSON.parse(readFileSync(join(here, 'bank.example.json'), 'utf8'));

let passed = 0, failed = 0;
const results = [];
function check(name, fn) {
  let ok = false, detail = '';
  try {
    const r = fn();
    ok = r === true || r === undefined;
    if (!ok) detail = ` (got ${JSON.stringify(r)})`;
  } catch (e) {
    detail = ` (threw ${e.message})`;
  }
  ok ? passed++ : failed++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail}`);
}

const clone = () => JSON.parse(JSON.stringify(bank));
const errorsOf = (b) => validateBank(b).errors;

// ------------------------------------------------------------------ the good

check('the example bank is valid', () => validateBank(bank).ok === true);

check('stats count what is there', () => {
  const { stats } = validateBank(bank);
  return stats.stories === 8 && stats.statements === 5 && stats.industry === 'finance';
});

// ---------------------------------------------------------------- the broken

check('not an object at all', () => !validateBank('hello').ok);

check('an entry with no text anywhere is an error', () => {
  const b = clone();
  b.stories[0].variants = { medium: '   ' };
  return errorsOf(b).some((e) => /no answer text/.test(e));
});

check('two entries sharing an id is an error', () => {
  const b = clone();
  b.stories[1].id = b.stories[0].id;
  return errorsOf(b).some((e) => /share the id/.test(e));
});

check('stories must be a list', () => {
  const b = clone();
  b.stories = { s1: {} };
  return errorsOf(b).some((e) => /must be a list/.test(e));
});

check('an unknown theme is a warning, not an error', () => {
  const b = clone();
  b.stories[0].themes = ['dragon-slaying'];
  const r = validateBank(b);
  return r.ok === true && r.warnings.some((w) => /unknown theme/.test(w));
});

check('a stray placeholder is a warning', () => {
  const b = clone();
  b.stories[0].variants.medium += ' I would love to join {{team}}.';
  return validateBank(b).warnings.some((w) => /\{\{team\}\}/.test(w));
});

check('a learned answer pointing at a deleted story is dropped', () => {
  const b = clone();
  b.learned = { 'tell me about a time you made a mistake': 'gone' };
  const r = validateBank(b);
  return r.bank.learned.gone === undefined
    && Object.keys(r.bank.learned).length === 0
    && r.warnings.some((w) => /pointed at deleted entries/.test(w));
});

check('a learned answer pointing at a live story survives', () => {
  const b = clone();
  b.learned = { 'tell me about a time you made a mistake': 's3' };
  return validateBank(b).bank.learned['tell me about a time you made a mistake'] === 's3';
});

check('a thin profile is a warning', () => {
  const b = clone();
  delete b.profile.email;
  return validateBank(b).warnings.some((w) => /Profile is missing: Email/.test(w));
});

// ---------------------------------------------------------------- coverage

check('coverage counts the themes the bank can answer on', () => {
  const c = bankCoverage(bank, { industry: 'finance' });
  return c.covered > 0 && c.covered <= c.total && c.rows.some((r) => r.theme === 'failure' && r.covered);
});

check('a bank with nothing on conflict says so', () => {
  const b = clone();
  b.stories = b.stories.filter((s) => !(s.themes || []).includes('conflict'));
  return bankCoverage(b).gaps.includes('Conflict or disagreement');
});

check('an empty bank covers nothing', () => bankCoverage(emptyBank()).covered === 0);

// ------------------------------------------------------------------ learned

check('withLearned does not mutate the bank', () => {
  const merged = withLearned(bank, { 'why do you want to work here': 'st5' });
  return merged.learned['why do you want to work here'] === 'st5'
    && bank.learned['why do you want to work here'] === undefined;
});

// ----------------------------------------------------------------- scaffold

// The intake that produces a scaffold now lives in the JobHub server, which is
// the only place a resume exists. What the extension still has to guarantee is
// the other half of that contract: an unfilled scaffold must be REFUSED. A bank
// that loads with empty answers fills forms with nothing and looks like it worked.
const SCAFFOLD = {
  profile: { name: '', email: '' },
  stories: [
    { id: 's1', title: 'failure: (name the story once you have told it)', context: '', themes: ['failure'],
      keywords: [], prompt: 'At Harborline, think of a shift that went badly.',
      raw: '', variants: { headline: '', short: '', medium: '', full: '' } },
    { id: 's2', title: 'teamwork', context: '', themes: ['teamwork'],
      keywords: [], prompt: 'Tell me about a time you relied on other people.',
      raw: '', variants: { headline: '', short: '', medium: '', full: '' } },
  ],
  statements: [],
  learned: {},
};

check('a fresh scaffold deliberately does NOT validate', () => {
  const r = validateBank(SCAFFOLD);
  return r.ok === false && r.errors.every((e) => /no answer text/.test(e));
});

check('a scaffold with one story filled in still refuses the empty one', () => {
  const half = structuredClone(SCAFFOLD);
  half.stories[0].raw = 'A real story, told properly, with enough words in it to be usable on a form.';
  half.stories[0].variants = {
    headline: 'A real story.', short: 'A real story, told properly.',
    medium: 'A real story, told properly, with enough words in it.',
    full: 'A real story, told properly, with enough words in it to be usable on a form.',
  };
  const r = validateBank(half);
  return r.ok === false && r.errors.length === 1;
});

console.log(results.join('\n'));
console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
