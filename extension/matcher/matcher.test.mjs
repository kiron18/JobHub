// Tests for the matcher. No browser, no network, no API key.
// Run: node matcher.test.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  normalise, extractWordLimit, pickVariant, classifyShape,
  scoreThemes, matchQuestion, renderAnswer, fitVariant,
} from './matcher.js';

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

const top = (q, opts = {}) => matchQuestion(q, bank, opts).candidates[0];
const topId = (q, opts = {}) => (top(q, opts) || {}).entry?.id;
const themesOf = (q, opts = {}) => matchQuestion(q, bank, opts).themes;

// ---------------------------------------------------------- the two hard cases

check('mistake -> failure story', () =>
  topId('Tell me about a time you made a mistake.') === 's3');

check('setback -> SAME story, despite sharing no keywords', () =>
  topId('Describe a setback you learned from.') === 's3');

check('teamwork question scores teamwork top', () =>
  themesOf('Tell me about a time you worked in a team.')[0].theme === 'teamwork');

check('team CONFLICT scores conflict top', () =>
  themesOf('Tell me about a time you had a conflict with a team member.')[0].theme === 'conflict');

check('team conflict suppresses teamwork entirely', () =>
  !themesOf('Tell me about a time you had a conflict with a team member.')
    .some((t) => t.theme === 'teamwork'));

// ------------------------------------------------------------------- shapes

check('past event stem', () =>
  classifyShape(normalise('Tell me about a time you led a group.')).shape === 'past_event');

check('hypothetical stem', () =>
  classifyShape(normalise('What would you do if a customer became aggressive?')).shape === 'hypothetical');

check('self description stem', () =>
  classifyShape(normalise('Tell us about yourself.')).shape === 'self_description');

check('motivation stem', () =>
  classifyShape(normalise('Why do you want to work here?')).shape === 'motivation');

check('fact stem routes to profile', () => {
  const r = matchQuestion('Do you have the right to work in Australia?', bank);
  return r.shape === 'fact' && r.answeredBy === 'profile' && r.source === 'profile';
});

check('longest stem wins over shorter overlap', () =>
  classifyShape(normalise('Why should we hire you over other candidates?')).shape === 'motivation');

check('unknown stem still routes to stories', () => {
  const r = matchQuestion('Describe a setback you learned from.', bank);
  return r.shape === 'unknown' && r.answeredBy === 'story';
});

// ------------------------------------------------------------- normalisation

check('company name stripped', () =>
  !normalise('Why do you want to work at Canva?', { company: 'Canva' }).includes('canva'));

check('word limit stripped from the cache key', () =>
  !normalise('Why do you want to work here? (250 words max)').includes('250'));

check('same question about two employers collapses to one key', () =>
  normalise('Why do you want to work at Canva?', { company: 'Canva' })
  === normalise('Why do you want to work at Atlassian?', { company: 'Atlassian' }));

// -------------------------------------------------------------- word limits

check('trailing "250 words max"', () =>
  extractWordLimit('Why do you want to work here? (250 words max)') === 250);

check('leading "no more than 500 words"', () =>
  extractWordLimit('Answer in no more than 500 words.') === 500);

check('character limit converts to words', () =>
  extractWordLimit('Tell us why (max 1500 characters)') === 250);

check('field maxlength used when text says nothing', () =>
  extractWordLimit('Why?', 600) === 100);

check('tighter of text limit and field limit wins', () =>
  extractWordLimit('Answer in no more than 500 words.', 600) === 100);

check('implausible tiny maxlength ignored', () =>
  extractWordLimit('Tell me about a time you led a team.', 60) === null);

check('variant bands', () =>
  pickVariant(25) === 'headline' && pickVariant(80) === 'short'
  && pickVariant(150) === 'medium' && pickVariant(400) === 'full');

check('no stated limit defaults to medium', () => pickVariant(null) === 'medium');

// ------------------------------------------------------------ statement half

check('tell us about yourself -> about-me statement', () =>
  topId('Tell us about yourself.') === 'st1');

check('why should we hire you -> why-company statement', () =>
  topId('Why should we hire you?') === 'st5');

check('why do you want to work here -> why-company statement', () =>
  topId('Why do you want to work at Canva?', { company: 'Canva' }) === 'st5');

check('strengths -> strengths statement', () =>
  topId('What are your greatest strengths?') === 'st2');

check('statements never returned for a past-event question', () => {
  const r = matchQuestion('Tell me about a time you made a mistake.', bank);
  return r.candidates.every((c) => c.entry.id.startsWith('s') && !c.entry.id.startsWith('st'));
});

// ------------------------------------------------------- industry add-ons

check('safety theme absent for a generic candidate', () =>
  !themesOf('Describe a time you identified a safety hazard in the workplace.')
    .some((t) => t.theme === 'safety'));

check('safety theme appears for a health candidate', () =>
  themesOf('Describe a time you identified a safety hazard in the workplace.',
    { industry: 'health' })[0].theme === 'safety');

// ------------------------------------------------------------ learned cache

check('learned cache short-circuits everything', () => {
  const withLearned = { ...bank, learned: { 'tell me about a time you made a mistake': 's7' } };
  const r = matchQuestion('Tell me about a time you made a mistake.', withLearned);
  return r.source === 'learned' && r.candidates[0].entry.id === 's7';
});

check('learned cache survives a different employer and word limit', () => {
  const key = normalise('Why do you want to work at Canva? (250 words max)', { company: 'Canva' });
  const withLearned = { ...bank, learned: { [key]: 'st5' } };
  const r = matchQuestion('Why do you want to work at Atlassian? (400 words max)',
    withLearned, { company: 'Atlassian' });
  return r.source === 'learned';
});

// -------------------------------------------------------------- rendering

check('renders the variant the length band asked for', () => {
  const r = matchQuestion('Why do you want to work at Canva? (150 words max)',
    bank, { company: 'Canva', role: 'Graduate Analyst' });
  const text = renderAnswer(r.candidates[0].entry, r.variant, { company: 'Canva', role: 'Graduate Analyst' });
  return r.variant === 'medium' && text.includes('Canva') && text.includes('Graduate Analyst');
});

check('no unreplaced placeholders leak through', () => {
  const r = matchQuestion('Why do you want to work at Canva?', bank, { company: 'Canva' });
  return !renderAnswer(r.candidates[0].entry, r.variant, { company: 'Canva' }).includes('{{');
});

check('falls back to a longer variant rather than returning nothing', () => {
  const sparse = { variants: { full: 'only the full version exists' } };
  return renderAnswer(sparse, 'headline') === 'only the full version exists';
});

check('falls back downward when the asked-for variant is missing', () => {
  const sparse = { variants: { short: 'only short exists' } };
  return renderAnswer(sparse, 'full') === 'only short exists';
});

// --------------------------------------------------- fitting a stated limit

const LONG = { variants: { headline: w(20), short: w(80), medium: w(190), full: w(400) } };
function w(n) { return Array.from({ length: n }, (_, i) => `word${i}`).join(' '); }

check('with no limit the band decides', () =>
  fitVariant(LONG, 'medium').variant === 'medium');

check('a limit the band variant would breach steps down', () =>
  fitVariant(LONG, 'medium', { limit: 150 }).variant === 'short');

check('a limit that fits leaves the band variant alone', () =>
  fitVariant(LONG, 'medium', { limit: 200 }).variant === 'medium');

check('over-limit is admitted rather than hidden', () => {
  const only = { variants: { medium: w(190) } };
  const fitted = fitVariant(only, 'medium', { limit: 100 });
  return fitted.variant === 'medium' && fitted.overLimit === true;
});

check('a tight limit reaches the headline', () =>
  fitVariant(LONG, 'full', { limit: 25 }).variant === 'headline');

check('renderAnswer honours the limit too', () =>
  renderAnswer(LONG, 'medium', { limit: 150 }).split(/\s+/).length === 80);

// ------------------------------------------------- realistic entry-level sweep

const SWEEP = [
  ['Tell me about a time you had to work to a tight deadline.', 'pressure'],
  ['Describe a situation where you went above and beyond.', 'initiative'],
  ['Give an example of when you dealt with a difficult customer.', 'customer'],
  ['Tell us about a time you had to learn something new quickly.', 'learning'],
  ['Describe a time you had to juggle multiple tasks at once.', 'priorities'],
  ['Tell me about a time you took the lead on something.', 'leadership'],
  ['Give an example of when your attention to detail made a difference.', 'detail'],
  ['Describe a time when plans changed unexpectedly.', 'change'],
];

for (const [q, expected] of SWEEP) {
  check(`sweep: "${q.slice(0, 46)}..." -> ${expected}`, () => {
    const t = themesOf(q);
    return t.length > 0 && t[0].theme === expected;
  });
}

check('every sweep question finds at least one story', () =>
  SWEEP.every(([q]) => matchQuestion(q, bank).candidates.length > 0));

// -------------------------------------------------------------------- report

console.log(results.join('\n'));
console.log(`\n${passed}/${passed + failed} passed`);

if (failed === 0) {
  console.log('\nWorked example:');
  const r = matchQuestion(
    'Tell us about a time you made a mistake and what you learned from it. (250 words max)',
    bank, { company: 'Canva', role: 'Graduate Analyst' }
  );
  console.log(`  shape      ${r.shape} -> ${r.answeredBy}`);
  console.log(`  themes     ${r.themes.map((t) => `${t.theme}(${t.score})`).join(', ')}`);
  console.log(`  limit      ${r.wordLimit} words -> "${r.variant}" variant`);
  console.log(`  top match  ${r.candidates[0].entry.title}  [${r.candidates[0].why.join(', ')}]`);
  console.log(`  runners up ${r.candidates.slice(1).map((c) => c.entry.title).join(' | ') || '(none)'}`);
  const text = renderAnswer(r.candidates[0].entry, r.variant, { company: 'Canva' });
  console.log(`  answer     ${text.split(/\s+/).length} words, LLM calls used: 0`);
}

process.exit(failed ? 1 : 0);
