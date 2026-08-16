// Offline harness for the capture step. Runs capture.js against a fixture that
// bundles the label patterns real ATS forms actually use.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const CAPTURE = readFileSync(join(here, 'capture.js'), 'utf8');

const HTML = `<!doctype html><html>
<head><title>Apply for Graduate Analyst | Atlassian</title></head>
<body>
  <header><input type="search" placeholder="Search jobs"></header>
  <h1>Graduate Analyst</h1>

  <form>
    <!-- 1. classic label[for] -->
    <label for="fn">First name *</label>
    <input id="fn" name="first_name" type="text" required>

    <!-- 2. wrapping label -->
    <label>Email address <input name="email" type="email" required></label>

    <!-- 3. aria-label only -->
    <input name="phone" type="tel" aria-label="Phone number">

    <!-- 4. question in a plain div above a textarea (no label anywhere) -->
    <div class="field">
      <div class="question">Why do you want to work at Atlassian?</div>
      <textarea name="q1" maxlength="2000" required></textarea>
    </div>

    <!-- 5. behavioural question, aria-labelledby -->
    <p id="q2label">Tell us about a time when you had to deal with a difficult stakeholder.</p>
    <textarea name="q2" aria-labelledby="q2label"></textarea>

    <!-- 6. radio group inside a fieldset with a legend -->
    <fieldset>
      <legend>Do you have full working rights in Australia?</legend>
      <label><input type="radio" name="rights" value="y"> Yes</label>
      <label><input type="radio" name="rights" value="n"> No</label>
      <label><input type="radio" name="rights" value="s"> I require sponsorship</label>
    </fieldset>

    <!-- 7. radio group with NO fieldset, question sits in a div -->
    <div class="grp">
      <div>Will you now or in the future require visa sponsorship?</div>
      <label><input type="radio" name="spon" value="yes"> Yes</label>
      <label><input type="radio" name="spon" value="no"> No</label>
    </div>

    <!-- 8. select -->
    <label for="hear">How did you hear about this role?</label>
    <select id="hear" name="source">
      <option>LinkedIn</option><option>Seek</option><option>Referral</option>
    </select>

    <!-- 9. single consent checkbox -->
    <label><input type="checkbox" name="privacy" required> I agree to the privacy policy</label>

    <!-- 10. file upload -->
    <label for="cv">Upload your resume</label>
    <input id="cv" name="resume" type="file">

    <!-- 11. short answer that is NOT subjective -->
    <label for="notice">Notice period (weeks)</label>
    <input id="notice" name="notice" type="number">

    <!-- noise that must be stripped -->
    <input type="hidden" name="csrf_token" value="abc">
    <input type="text" name="honeypot_address" style="display:none">
    <div style="display:none"><label>Hidden collapsed field<input name="collapsed"></label></div>
  </form>

  <div id="onetrust-banner">
    <label><input type="checkbox" name="analytics_cookies"> Allow analytics cookies</label>
  </div>
</body></html>`;

const dom = new JSDOM(HTML, { url: 'https://boards.greenhouse.io/atlassian/jobs/123', runScripts: 'dangerously' });
const { window } = dom;

// jsdom has no layout engine, so every rect is 0x0 and the visibility check
// would reject the whole page. Give elements a box; display:none still works
// through getComputedStyle, which is what the hidden-field cases rely on.
window.Element.prototype.getBoundingClientRect = function () {
  return { width: 120, height: 24, top: 0, left: 0, right: 120, bottom: 24, x: 0, y: 0 };
};

let captured = null;
window.chrome = {
  runtime: {
    sendMessage: (msg, cb) => {
      if (msg.type === 'AGC_FRAME_RESULT') captured = msg.payload;
      if (msg.type === 'AGC_GET_SHEET' && cb) cb(null);
    },
    onMessage: { addListener: () => {} },
  },
};

window.eval(CAPTURE);

const fields = captured.fields;
console.log(`\n${fields.length} questions found\n${'='.repeat(78)}`);
for (const f of fields) {
  const tags = [f.type, f.required ? 'required' : null, f.likelySubjective ? 'OPEN-ENDED' : null,
                f.maxLength ? `max ${f.maxLength}` : null].filter(Boolean).join(', ');
  console.log(`\n[${f.id}] ${f.label || '((NO LABEL))'}`);
  console.log(`      ${tags}   <- via ${f.labelSource}`);
  if (f.options.length) console.log(`      options: ${f.options.join(' | ')}`);
}

// ------------------------------------------------------------------ assertions
const byLabel = (re) => fields.find((f) => re.test(f.label));
const checks = [
  ['first name read',        () => byLabel(/^First name$/)],
  ['required marker strip',  () => !fields.some((f) => f.label.endsWith('*'))],
  ['wrapping label email',   () => byLabel(/^Email address$/)],
  ['aria-label phone',       () => byLabel(/^Phone number$/)],
  ['div-above question',     () => byLabel(/^Why do you want to work at Atlassian\?$/)],
  ['q1 flagged open-ended',  () => byLabel(/Atlassian/).likelySubjective === true],
  ['aria-labelledby q2',     () => byLabel(/difficult stakeholder/)],
  ['legend radio group',     () => byLabel(/full working rights/)],
  ['legend group 3 options', () => byLabel(/full working rights/).options.length === 3],
  ['fieldset-less group',    () => byLabel(/require visa sponsorship/)],
  ['group question clean',   () => !/^\s*Yes\s*No/.test(byLabel(/require visa sponsorship/).label)],
  ['select options',         () => byLabel(/hear about this role/).options.length === 3],
  ['consent checkbox',       () => byLabel(/privacy policy/)],
  ['file upload',            () => byLabel(/Upload your resume/) && byLabel(/Upload your resume/).type === 'file'],
  ['notice NOT subjective',  () => byLabel(/Notice period/).likelySubjective === false],
  ['nav search stripped',    () => !byLabel(/Search jobs/)],
  ['csrf stripped',          () => !fields.some((f) => /csrf/i.test(f.label))],
  ['honeypot stripped',      () => !fields.some((f) => /honeypot/i.test(f.label))],
  ['hidden field stripped',  () => !byLabel(/Hidden collapsed/)],
  ['cookie banner stripped', () => !byLabel(/analytics cookies/i)],
  ['page url reported',      () => /greenhouse\.io/.test(captured.page.url)],
  ['page heading reported',  () => captured.page.headings.includes('Graduate Analyst')],
];

console.log(`\n${'='.repeat(78)}`);
let failed = 0;
for (const [name, fn] of checks) {
  let ok = false;
  try { ok = !!fn(); } catch { ok = false; }
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
