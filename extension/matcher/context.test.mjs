// Tests for employer and role detection. Run: node matcher/context.test.mjs
//
// Every URL here is the real shape of a page a client applies through.

import { pageContext, mergeContexts, humanise } from './context.js';

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

const company = (page) => pageContext(page).company;
const role = (page) => pageContext(page).role;

// ------------------------------------------------------- applicant tracking

check('greenhouse path slug', () =>
  company({ url: 'https://boards.greenhouse.io/canva/jobs/4512345' }) === 'Canva');

check('greenhouse embed ?for=', () =>
  company({ url: 'https://boards.greenhouse.io/embed/job_app?for=atlassian&token=99' }) === 'Atlassian');

check('lever hyphenated slug', () =>
  company({ url: 'https://jobs.lever.co/culture-amp/8f2c' }) === 'Culture Amp');

check('workable', () =>
  company({ url: 'https://apply.workable.com/deputy/j/A1B2C3/' }) === 'Deputy');

check('workday subdomain', () =>
  company({ url: 'https://nab.wd3.myworkdayjobs.com/en-US/NAB/job/Analyst_123' }) === 'Nab');

check('bamboohr subdomain', () =>
  company({ url: 'https://linktree.bamboohr.com/careers/42' }) === 'Linktree');

check('smartrecruiters keeps its own casing', () =>
  company({ url: 'https://jobs.smartrecruiters.com/Telstra/744000012' }) === 'Telstra');

check('ats is reported', () =>
  pageContext({ url: 'https://jobs.lever.co/canva/1' }).ats === 'lever');

// --------------------------------------------------------- corporate sites

check('careers subdomain stripped', () =>
  company({ url: 'https://careers.canva.com/jobs/123' }) === 'Canva');

check('www and country tld stripped', () =>
  company({ url: 'https://www.commbank.com.au/careers/apply' }) === 'Commbank');

check('og:site_name beats the hostname', () =>
  company({ url: 'https://apply.erecruit.co/x', meta: { siteName: 'Ramsay Health Care' } }) === 'Ramsay Health Care');

// ------------------------------------------------------------- job boards

check('board name is never the employer', () =>
  company({ url: 'https://www.seek.com.au/job/78123456', title: 'Graduate Analyst - Canva - SEEK' }) === 'Canva');

check('board still reads the role', () =>
  role({ url: 'https://www.seek.com.au/job/78123456', title: 'Graduate Analyst - Canva - SEEK' }) === 'Graduate Analyst');

check('board flagged as a board', () =>
  pageContext({ url: 'https://au.indeed.com/viewjob?jk=1' }).board === true);

// ------------------------------------------------------------------ roles

check('heading beats the title', () =>
  role({
    url: 'https://boards.greenhouse.io/canva/jobs/1',
    title: 'Job Application',
    headings: ['Graduate Data Analyst'],
  }) === 'Graduate Data Analyst');

check('"apply for" prefix stripped', () =>
  role({ url: 'https://x.com', headings: ['Apply for Junior Accountant'] }) === 'Junior Accountant');

check('"role at company" splits both ways', () => {
  const ctx = pageContext({ url: 'https://apply.livehire.com/x', headings: ['Graduate Engineer at Aurecon'] });
  return ctx.role === 'Graduate Engineer' && ctx.company === 'Aurecon';
});

check('a heading of just the company is not a role', () =>
  role({ url: 'https://careers.canva.com/x', headings: ['Canva', 'Product Analyst'] }) === 'Product Analyst');

check('"Careers" is never a role', () =>
  role({ url: 'https://careers.canva.com/x', headings: ['Careers'], title: 'Careers' }) === null);

// ------------------------------------------------------------------ merge

check('the ATS iframe outranks the host page hostname', () => {
  const top = pageContext({ url: 'https://www.some-agency-site.com.au/vacancies', headings: ['Graduate Analyst'] });
  const frame = pageContext({ url: 'https://boards.greenhouse.io/canva/jobs/1' });
  const merged = mergeContexts([top, frame]);
  return merged.company === 'Canva' && merged.role === 'Graduate Analyst';
});

check('merge survives an empty frame', () =>
  mergeContexts([null, pageContext({ url: 'https://jobs.lever.co/canva/1' })]).company === 'Canva');

check('nothing readable returns nulls rather than guesses', () => {
  const ctx = pageContext({ url: 'about:blank', title: '' });
  return ctx.company === null && ctx.role === null;
});

// ----------------------------------------------------------------- humanise

check('slug to words', () => humanise('senior-data-analyst') === 'Senior Data Analyst');
check('deliberate casing kept', () => humanise('McKinsey') === 'McKinsey');

console.log(results.join('\n'));
console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
