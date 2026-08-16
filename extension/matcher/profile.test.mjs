// Tests for the plain-fact half. Run: node matcher/profile.test.mjs

import { answerFromProfile, classifyFact } from './profile.js';

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

const PROFILE = {
  name: 'Priya Nair',
  email: 'priya.nair@example.com',
  phone: '0412 345 678',
  location: 'Melbourne, VIC',
  workRights: 'Temporary Graduate visa (485), full working rights until March 2028',
  hasWorkRights: true,
  requiresSponsorship: false,
  noticePeriod: '1 week',
  salaryExpectation: '70,000 - 78,000 AUD',
};

const ask = (q, opts) => answerFromProfile(q, PROFILE, opts);

// ------------------------------------------------------------------ routing

check('right to work is a fact', () => ask('Do you have the right to work in Australia?').fact === 'right_to_work');
check('notice period is a fact', () => ask('What is your notice period?').field === 'noticePeriod');
check('start date reads as notice', () => ask('When can you start?').field === 'noticePeriod');
check('salary is a fact', () => ask('What are your salary expectations?').field === 'salaryExpectation');
check('sponsorship is its own fact', () =>
  ask('Will you now or in the future require visa sponsorship?').fact === 'sponsorship');

check('a behavioural question is not a fact', () =>
  ask('Tell me about a time you made a mistake.') === null);

check('"name a time" does not fire the name fact', () =>
  ask('Name a time when you had to work under pressure.') === null);

check('why-this-company is not a fact', () =>
  ask('Why do you want to work here?') === null);

// -------------------------------------------------------------------- values

check('the answer is the stored value', () =>
  ask('What is your notice period?').text === '1 week');

check('first name is split out of the full name', () =>
  ask('First name').text === 'Priya');

check('last name takes everything after the first', () =>
  answerFromProfile('Surname', { name: 'Ana Maria De Souza' }).text === 'Maria De Souza');

check('an explicit firstName is not overwritten', () =>
  answerFromProfile('First name', { name: 'Priyadarshini Nair', firstName: 'Priya' }).text === 'Priya');

// ------------------------------------------------------------ option picking

const YESNO = { options: ['Yes', 'No'] };

check('working rights picks Yes from the boolean', () =>
  ask('Do you have full working rights in Australia?', YESNO).option === 'Yes');

check('sponsorship picks No from the boolean', () =>
  ask('Will you now or in the future require visa sponsorship?', YESNO).option === 'No');

check('a three-way group still picks the right option', () =>
  ask('Do you have full working rights in Australia?',
    { options: ['Yes', 'No', 'I require sponsorship'] }).option === 'Yes');

check('NO boolean means NO suggested option, ever', () => {
  const r = answerFromProfile('Do you have full working rights in Australia?',
    { workRights: 'Student visa 500 with 48 hours a fortnight' }, YESNO);
  return r.option === null && r.text.startsWith('Student visa');
});

check('a missing field is reported, not hidden', () => {
  const r = answerFromProfile('What are your salary expectations?', { name: 'X' });
  return r.missing === true && r.text === null && r.label === 'Salary expectation';
});

// ------------------------------------------------------------- longest stem

check('a citizenship question is never answered from working rights', () => {
  const r = ask('Are you an Australian citizen or permanent resident?', YESNO);
  return r.fact === 'citizenship' && r.option === null && /485/.test(r.text);
});

check('longest stem wins between overlapping facts', () =>
  classifyFact('Will you now or in the future require visa sponsorship?').id === 'sponsorship');

check('licence question is not caught by "do you hold"', () =>
  ask("Do you hold a current driver's licence?").fact === 'licence');

console.log(results.join('\n'));
console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
