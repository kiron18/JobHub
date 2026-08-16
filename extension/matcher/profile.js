// The plain-fact half of an application form.
//
// These questions have exactly one right answer and it never changes between
// employers: working rights, notice period, salary, licence. They do not need
// scoring, a story or a model. They need a lookup.
//
// Two rules, both deliberate:
//
//   1. A yes/no option is only ever suggested from an EXPLICIT boolean in the
//      bank. Nothing here infers "has working rights" from the text of a visa
//      subclass. Getting a work-rights answer wrong ends the application, and a
//      confident wrong answer is worse than no answer at all.
//   2. A missing field returns a `missing` result rather than nothing, so the
//      panel can say "your bank has never answered this" instead of staying
//      silent about a question the form requires.

import { normalise } from './normalise.js';

/** Everything the profile half of a bank can hold. Drives the options page too. */
export const PROFILE_FIELDS = [
  { key: 'name', label: 'Full name', example: 'Priya Nair' },
  { key: 'email', label: 'Email', example: 'priya.nair@example.com' },
  { key: 'phone', label: 'Phone', example: '0412 345 678' },
  { key: 'location', label: 'Location', example: 'Melbourne, VIC' },
  { key: 'linkedin', label: 'LinkedIn URL', example: 'https://www.linkedin.com/in/…' },
  { key: 'workRights', label: 'Working rights (in words)', example: 'Temporary Graduate visa (485), full working rights until March 2028' },
  { key: 'hasWorkRights', label: 'Has working rights (true/false)', example: 'true', boolean: true },
  { key: 'requiresSponsorship', label: 'Will need sponsorship (true/false)', example: 'false', boolean: true },
  { key: 'noticePeriod', label: 'Notice period / availability', example: '1 week' },
  { key: 'salaryExpectation', label: 'Salary expectation', example: '70,000 - 78,000 AUD' },
  { key: 'driversLicence', label: "Driver's licence", example: 'Full Victorian licence, own car' },
  { key: 'willingToRelocate', label: 'Willing to relocate (true/false)', example: 'false', boolean: true },
  { key: 'willingToTravel', label: 'Willing to travel (true/false)', example: 'true', boolean: true },
  { key: 'policeCheck', label: 'Police check', example: 'Cleared, issued Feb 2026' },
  { key: 'workingWithChildren', label: 'Working with children check', example: 'Not held, happy to obtain' },
  { key: 'industry', label: 'Industry (turns on extra themes)', example: 'finance' },
];

/**
 * A fact question, the profile field that answers it, and - where a yes/no
 * option list is involved - which boolean decides and which way round it reads.
 *
 * `polarity: 'affirms'`  yes means the boolean is true  ("do you have a licence")
 * `polarity: 'denies'`   yes means the boolean is false ("do you need sponsorship"
 *                        answered from requiresSponsorship is still 'affirms';
 *                        'denies' is for "are you free of…" style wording)
 */
export const FACTS = [
  {
    id: 'right_to_work',
    label: 'Working rights',
    field: 'workRights',
    boolean: 'hasWorkRights',
    polarity: 'affirms',
    stems: [
      'do you have the right to work', 'right to work', 'working rights',
      'work rights', 'are you legally entitled', 'are you legally able',
      'are you authorised to work', 'are you authorized to work',
      'eligible to work', 'permitted to work', 'unrestricted working',
      'work permit', 'visa status', 'what is your visa',
    ],
  },
  {
    // Deliberately has no boolean. Having full working rights does not make
    // someone a citizen or a permanent resident, and answering "yes" here off
    // the back of a 485 visa is a false statement on an application.
    id: 'citizenship',
    label: 'Citizenship or residency',
    field: 'workRights',
    stems: [
      'citizenship status', 'are you an australian citizen', 'are you a citizen',
      'are you a permanent resident', 'residency status', 'permanent residency',
    ],
  },
  {
    id: 'sponsorship',
    label: 'Sponsorship',
    field: 'workRights',
    boolean: 'requiresSponsorship',
    polarity: 'affirms',
    stems: [
      'require sponsorship', 'require visa sponsorship', 'need sponsorship',
      'will you now or in the future require', 'requires sponsorship',
      'sponsorship to work', 'employment visa sponsorship',
    ],
  },
  {
    id: 'notice',
    label: 'Notice period',
    field: 'noticePeriod',
    stems: [
      'notice period', 'when can you start', 'when could you start',
      'earliest start', 'available to start', 'availability to commence',
      'commencement date', 'how soon can you start', 'your availability',
    ],
  },
  {
    id: 'salary',
    label: 'Salary expectation',
    field: 'salaryExpectation',
    stems: [
      'salary expectation', 'expected salary', 'salary requirement',
      'remuneration expectation', 'pay expectation', 'desired salary',
      'what are your salary', 'package expectation',
    ],
  },
  {
    id: 'licence',
    label: "Driver's licence",
    field: 'driversLicence',
    stems: [
      'drivers licence', 'driver s licence', 'drivers license', 'driver s license',
      'do you hold a licence', 'do you hold a license', 'valid licence',
      'valid license', 'own vehicle', 'own transport', 'own car',
    ],
  },
  {
    id: 'relocate',
    label: 'Relocation',
    field: 'location',
    boolean: 'willingToRelocate',
    polarity: 'affirms',
    stems: ['willing to relocate', 'able to relocate', 'open to relocation', 'consider relocating'],
  },
  {
    id: 'travel',
    label: 'Travel',
    field: 'location',
    boolean: 'willingToTravel',
    polarity: 'affirms',
    stems: ['willing to travel', 'able to travel', 'travel for work', 'interstate travel'],
  },
  {
    id: 'police_check',
    label: 'Police check',
    field: 'policeCheck',
    stems: ['police check', 'criminal record check', 'national police', 'background check'],
  },
  {
    id: 'wwcc',
    label: 'Working with children',
    field: 'workingWithChildren',
    stems: ['working with children', 'wwcc', 'blue card', 'child safety check'],
  },
  {
    id: 'location',
    label: 'Location',
    field: 'location',
    stems: ['where are you located', 'where are you based', 'current location',
            'city and state', 'suburb and postcode', 'your location'],
  },
  // Never a bare "name": "Name a time when you..." is a story question, and a
  // fact answer there would drop the candidate's name into a behavioural box.
  { id: 'name', label: 'Name', field: 'name', stems: ['full name', 'your name', 'legal name', 'name as it appears'] },
  { id: 'first_name', label: 'First name', field: 'firstName', stems: ['first name', 'given name', 'preferred name'] },
  { id: 'last_name', label: 'Last name', field: 'lastName', stems: ['last name', 'surname', 'family name'] },
  { id: 'email', label: 'Email', field: 'email', stems: ['email address', 'e mail address', 'your email'] },
  { id: 'phone', label: 'Phone', field: 'phone', stems: ['phone number', 'mobile number', 'contact number', 'telephone'] },
  { id: 'linkedin', label: 'LinkedIn', field: 'linkedin', stems: ['linkedin', 'linked in profile'] },
];

/** Longest stem wins, same rule the shape classifier uses. */
export function classifyFact(question, opts = {}) {
  // normalise is idempotent, so an already-normalised question is safe to pass.
  const text = normalise(question, opts);
  let best = null;
  for (const fact of FACTS) {
    for (const stem of fact.stems) {
      if (text.includes(stem) && (!best || stem.length > best.stem.length)) {
        best = { fact, stem };
      }
    }
  }
  return best ? { ...best.fact, matchedStem: best.stem } : null;
}

const YES = /^\s*(yes|y|true)\b/i;
const NO = /^\s*(no|n|false|none)\b/i;

/**
 * A form asks for the halves of a name far more often than the whole of it, so
 * they are split out of `name` rather than stored twice and left to drift.
 */
function withDerived(profile) {
  if (!profile.name || (profile.firstName && profile.lastName)) return profile;
  const parts = String(profile.name).trim().split(/\s+/);
  return {
    firstName: parts[0] || '',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
    ...profile,
  };
}

/**
 * Answer a fact question from the bank's profile.
 *
 * @returns {null} the question is not a fact question at all
 * @returns {{fact, label, field, text, option, missing}} otherwise. `missing`
 *          means the question IS a fact question and the bank has no value for
 *          it, which the panel surfaces rather than hides.
 */
export function answerFromProfile(question, profile = {}, { options = [] } = {}) {
  const fact = classifyFact(question);
  if (!fact) return null;

  const raw = withDerived(profile)[fact.field];
  const value = raw === undefined || raw === null || raw === '' ? null : String(raw);

  const result = {
    fact: fact.id,
    label: fact.label,
    field: fact.field,
    matchedStem: fact.matchedStem,
    text: value,
    option: null,
    missing: value === null,
  };

  // A yes/no option is only ever suggested from an explicit boolean.
  if (fact.boolean && options.length) {
    const flag = profile[fact.boolean];
    if (typeof flag === 'boolean') {
      const wantYes = fact.polarity === 'denies' ? !flag : flag;
      const pick = options.find((o) => (wantYes ? YES : NO).test(o));
      if (pick) {
        result.option = pick;
        result.missing = false;
        if (!result.text) result.text = pick;
      }
    }
  }

  return result;
}
