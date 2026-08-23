// The Seek collector's decisions, with no browser anywhere near them.
// Run: node seek/record.test.mjs

import {
  buildRecord, addToBasket, removeFromBasket, toPayload,
  jobIdFromUrl, canonicalUrl, FIELDS, MAX_BASKET, MIN_DESCRIPTION_CHARS,
} from './record.js';

const NL = String.fromCharCode(10);

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

const BODY = 'We are hiring a Business Analyst. '.repeat(20); // comfortably over the floor
const page = (over = {}) => ({
  [FIELDS.title]: 'Business Analyst',
  [FIELDS.company]: 'Odoo',
  [FIELDS.description]: BODY,
  [FIELDS.location]: 'Sydney NSW',
  [FIELDS.workType]: 'Full time',
  [FIELDS.classification]: 'Information & Communication Technology',
  ...over,
});
const from = (fields, url = 'https://au.seek.com/job/93833475') =>
  buildRecord({ read: (k) => fields[k] ?? null, url });

// ------------------------------------------------------------------- job ids

check('reads the id out of a plain job url', () =>
  jobIdFromUrl('https://au.seek.com/job/93833475') === '93833475');

check('reads it with a query string attached', () =>
  jobIdFromUrl('https://au.seek.com/job/93833475?type=standard&ref=search') === '93833475');

check('reads it from a search page that has a job open in the pane', () =>
  jobIdFromUrl('https://au.seek.com/business-analyst-jobs#/job/93833475') === '93833475');

check('a search page with no job open has no id', () =>
  jobIdFromUrl('https://au.seek.com/business-analyst-jobs') === null);

check('canonical url drops the tracking', () =>
  canonicalUrl('93833475') === 'https://au.seek.com/job/93833475');

// ------------------------------------------------------------------- records

check('a normal ad becomes a record', () => {
  const r = from(page());
  return r.ok && r.record.title === 'Business Analyst' && r.record.company === 'Odoo';
});

check('the canonical url is stored, not the one with tracking on it', () => {
  const r = from(page(), 'https://au.seek.com/job/93833475?type=promoted&ref=search-standalone');
  return r.record.sourceUrl === 'https://au.seek.com/job/93833475';
});

check('THE POINT: the advertiser name is captured, which a paste never contains', () =>
  from(page()).record.company === 'Odoo');

check('an ad with no advertiser gives null, never a placeholder', () => {
  const r = from(page({ [FIELDS.company]: '' }));
  return r.ok && r.record.company === null;
});

check('a missing advertiser does not block the capture', () =>
  from(page({ [FIELDS.company]: null })).ok === true);

check('whitespace in the advertiser name is squashed', () =>
  from(page({ [FIELDS.company]: `  ETE Group   Pty Ltd ${NL}` })).record.company === 'ETE Group Pty Ltd');

check('paragraph breaks in the body survive, because the generator reads them', () => {
  const gap = NL + NL;
  const body = `About the role${gap}${BODY}${gap}What you will do${gap}${BODY}`;
  return from(page({ [FIELDS.description]: body })).record.description.includes(gap);
});

check('runs of blank lines are collapsed to one break', () => {
  const body = BODY + NL + NL + NL + NL + BODY;
  const out = from(page({ [FIELDS.description]: body })).record.description;
  return !out.includes(NL + NL + NL);
});

// ------------------------------------------------------------------ refusals

check('a page that is not a job ad is refused', () => {
  const r = from(page(), 'https://au.seek.com/business-analyst-jobs');
  return r.ok === false && /job ad/i.test(r.reason);
});

check('no title is refused', () =>
  from(page({ [FIELDS.title]: '' })).ok === false);

check('a body under the floor is refused rather than half-saved', () => {
  const r = from(page({ [FIELDS.description]: 'Apply now.' }));
  return r.ok === false && /did not load/i.test(r.reason);
});

check('the floor matches the server so nothing is accepted here and rejected there', () =>
  MIN_DESCRIPTION_CHARS === 400);

check('every refusal reason is something a person could read off a button', () => {
  const reasons = [
    from(page(), 'https://au.seek.com/jobs').reason,
    from(page({ [FIELDS.title]: '' })).reason,
    from(page({ [FIELDS.description]: 'x' })).reason,
  ];
  const junk = /undefined|null|object Object/;
  return reasons.every((r) => typeof r === 'string' && r.length > 8 && !junk.test(r));
});

// ------------------------------------------------------------------- basket

const rec = (id) => from(page(), `https://au.seek.com/job/${id}`).record;

check('adding puts it in', () => addToBasket([], rec('1111111')).basket.length === 1);

check('the same job twice is a no-op, not an error', () => {
  const one = addToBasket([], rec('1111111')).basket;
  const two = addToBasket(one, rec('1111111'));
  return two.basket.length === 1 && two.added === false;
});

check(`the basket stops at ${MAX_BASKET}`, () => {
  let b = [];
  for (let i = 0; i < MAX_BASKET + 4; i++) b = addToBasket(b, rec(String(9000000 + i))).basket;
  return b.length === MAX_BASKET;
});

check('being full gives a reason rather than silently dropping the job', () => {
  let b = [];
  for (let i = 0; i < MAX_BASKET; i++) b = addToBasket(b, rec(String(9000000 + i))).basket;
  const out = addToBasket(b, rec('7777777'));
  return out.added === false && /Send them first/.test(out.reason);
});

check('removing takes it out and leaves the rest', () => {
  const b = addToBasket(addToBasket([], rec('1111111')).basket, rec('2222222')).basket;
  const after = removeFromBasket(b, '1111111');
  return after.length === 1 && after[0].jobId === '2222222';
});

// ------------------------------------------------------------------- payload

check('the payload carries exactly the four fields the endpoint takes', () => {
  const [row] = toPayload([rec('1111111')]);
  return JSON.stringify(Object.keys(row).sort()) ===
    JSON.stringify(['company', 'description', 'sourceUrl', 'title']);
});

check('local-only extras never go over the wire', () => {
  const [row] = toPayload([rec('1111111')]);
  return row.capturedAt === undefined && row.jobId === undefined && row.classification === undefined;
});

check('an empty basket sends an empty payload rather than throwing', () =>
  toPayload([]).length === 0 && toPayload(undefined).length === 0);

console.log(results.join(NL));
console.log(`${NL}${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
