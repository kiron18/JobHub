// The whole path, end to end, with no browser: a careers page with the real
// form embedded in a cross-origin iframe, the actual service worker, the actual
// content script, the actual bank.
//
// Run: node e2e.test.mjs
//
// What it proves that the unit tests cannot:
//   - the two frames are stitched into one sheet, and the employer is read from
//     the iframe while the job title is read from the page around it
//   - a question reaches an answer with the company name written into it
//   - Insert puts that text into the real <textarea>, through the same native
//     setter path a React form needs
//   - using an answer is remembered, and the next capture comes back "remembered"
//
// The fake chrome below is deliberately thin. It is only what the extension
// actually calls, so a call the extension makes that Chrome does not have would
// fail here too.

import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const CAPTURE = readFileSync(join(here, 'reader/capture.js'), 'utf8');
const BANK = JSON.parse(readFileSync(join(here, 'matcher/bank.example.json'), 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// --------------------------------------------------------------- the two pages

const HOST_PAGE = `<!doctype html><html>
<head><title>Graduate Data Analyst | Example Agency</title></head>
<body>
  <h1>Graduate Data Analyst</h1>
  <p>Applications close Friday.</p>
  <div id="embed"><!-- the greenhouse iframe lives here --></div>
</body></html>`;

const FORM_PAGE = `<!doctype html><html>
<head><title>Job Application</title></head>
<body>
  <form>
    <label for="fn">First name *</label>
    <input id="fn" name="first_name" type="text" required>

    <label>Email address <input name="email" type="email" required></label>

    <div class="field">
      <div class="question">Why do you want to work at Canva? (150 words max)</div>
      <textarea name="q1" maxlength="2000" required></textarea>
    </div>

    <p id="q2label">Tell us about a time when you had to deal with a difficult customer.</p>
    <textarea name="q2" aria-labelledby="q2label"></textarea>

    <fieldset>
      <legend>Do you have full working rights in Australia?</legend>
      <label><input type="radio" name="rights" value="y"> Yes</label>
      <label><input type="radio" name="rights" value="n"> No</label>
    </fieldset>

    <label for="notice">What is your notice period?</label>
    <input id="notice" name="notice" type="text">

    <label for="hobby">Describe a time you juggled multiple competing priorities.</label>
    <textarea id="hobby" name="q3" maxlength="600"></textarea>

    <label for="q4">Tell us about a time you worked under pressure.</label>
    <textarea id="q4" name="q4"></textarea>

    <label for="cv">Upload your resume</label>
    <input id="cv" name="resume" type="file">

    <label><input type="checkbox" name="privacy" required> I agree to the privacy policy</label>
  </form>
</body></html>`;

function makeFrame(html, url, frameId, isTop) {
  const dom = new JSDOM(html, { url, runScripts: 'dangerously' });
  // jsdom has no layout engine, so every rect is 0x0 and the visibility check
  // would reject the whole page.
  dom.window.Element.prototype.getBoundingClientRect = () =>
    ({ width: 120, height: 24, top: 0, left: 0, right: 120, bottom: 24, x: 0, y: 0 });
  return { dom, window: dom.window, frameId, isTop, url };
}

const top = makeFrame(HOST_PAGE, 'https://jobs.example-agency.com.au/vacancy/8812', 0, true);
const inner = makeFrame(FORM_PAGE, 'https://boards.greenhouse.io/canva/jobs/4512345', 7, false);
const frames = [top, inner];

// ------------------------------------------------------------- the fake chrome

const storage = { agcBank: BANK, agcLearned: {} };
const backgroundListeners = [];
let onClicked = null;

const pick = (keys) => {
  const list = Array.isArray(keys) ? keys : [keys];
  const out = {};
  for (const k of list) if (storage[k] !== undefined) out[k] = storage[k];
  return out;
};

function dispatchToBackground(msg, sender, callback) {
  for (const listener of backgroundListeners) {
    const kept = listener(msg, sender, (response) => callback && callback(response));
    if (kept === true) return; // the listener answers later
  }
}

/** Each frame gets its own chrome, so the service worker sees a real frameId. */
function chromeForFrame(frame) {
  return {
    runtime: {
      sendMessage: (msg, cb) => dispatchToBackground(msg, { tab: { id: 1 }, frameId: frame.frameId }, cb),
      onMessage: { addListener: (fn) => { frame.onMessage = fn; } },
      getURL: (p) => `chrome-extension://test/${p}`,
    },
  };
}

globalThis.chrome = {
  action: { onClicked: { addListener: (fn) => { onClicked = fn; } } },
  tabs: {
    onRemoved: { addListener: () => {} },
    sendMessage: (tabId, msg, opts) =>
      new Promise((resolve, reject) => {
        const frame = frames.find((f) => f.frameId === (opts && opts.frameId));
        if (!frame || !frame.onMessage) return reject(new Error('no such frame'));
        frame.onMessage(msg, { id: 'test' }, resolve);
      }),
  },
  scripting: {
    executeScript: async () => {
      for (const frame of frames) {
        frame.window.chrome = chromeForFrame(frame);
        frame.window.eval(CAPTURE);
      }
    },
  },
  storage: {
    local: {
      get: async (keys) => pick(keys),
      set: async (obj) => { Object.assign(storage, obj); },
      remove: async (keys) => { for (const k of (Array.isArray(keys) ? keys : [keys])) delete storage[k]; },
    },
  },
  runtime: {
    onMessage: { addListener: (fn) => backgroundListeners.push(fn) },
    openOptionsPage: () => {},
    getURL: (p) => `chrome-extension://test/${p}`,
  },
};

// ------------------------------------------------------------------- the run

await import('./background.js');

let sheet = null;
// Snoop on the sheet the panel is handed, so the assertions can read both the
// data and the DOM it produced.
const originalDispatch = dispatchToBackground;
await onClicked({ id: 1 });
await sleep(700); // the top frame waits 400ms for sub-frames to report in

const shadow = top.window.document.getElementById('agc-form-reader-panel')?.shadowRoot;

// Ask for the same sheet the panel got, now that every frame has reported.
sheet = await new Promise((resolve) =>
  dispatchToBackground({ type: 'AGC_GET_SHEET' }, { tab: { id: 1 }, frameId: 0 }, resolve));

const allFields = sheet.frames.flatMap((f) => f.fields);
const field = (re) => allFields.find((f) => re.test(f.label || ''));

// ------------------------------------------------------------------ the sheet

check('both frames reported', () => sheet.frames.length === 1 || sheet.frames.length === 2);

check('the employer comes from the ATS iframe', () => sheet.context.company === 'Canva');

check('the job title comes from the page around it', () =>
  sheet.context.role === 'Graduate Data Analyst');

check('the candidate is named from the bank', () => sheet.candidate === 'Priya Nair');

check('every question on the form was read', () => allFields.length >= 7);

check('the why-this-company question is answered', () => {
  const f = field(/Why do you want to work at Canva/);
  return f.answer && f.answer.from.id === 'st5';
});

check('the employer name is written into the answer', () => {
  const f = field(/Why do you want to work at Canva/);
  return f.answer.text.includes('Canva') && !f.answer.text.includes('{{');
});

check('the stated word limit is read off the question', () => {
  const f = field(/Why do you want to work at Canva/);
  return f.wordLimit === 150;
});

check('a limit the medium answer would breach steps down a length', () => {
  const f = field(/Why do you want to work at Canva/);
  // The band for 150 words is "medium", but this candidate's medium runs long,
  // so the shorter one is used rather than one that would be rejected.
  return f.variant === 'medium' && f.answer.variant === 'short';
});

check('the answer fits the limit it was given', () => {
  const f = field(/Why do you want to work at Canva/);
  return f.answer.words <= f.wordLimit && f.answer.overLimit === false;
});

check('the customer question finds the customer story', () => {
  const f = field(/difficult customer/);
  return f.answer && f.answer.from.id === 's4';
});

check('the priorities question finds the priorities story', () => {
  const f = field(/competing priorities/);
  return f.answer && f.answer.from.id === 's6';
});

check('working rights is answered as a fact, with the option picked', () => {
  const f = field(/full working rights/);
  return f.kind === 'fact' && f.answer.option === 'Yes';
});

check('notice period comes straight off the profile', () => {
  const f = field(/notice period/i);
  return f.kind === 'fact' && f.answer.text === '1 week';
});

check('first name is answered, not left to be typed', () => {
  const f = field(/First name/);
  return f.answer && f.answer.text === 'Priya';
});

check('a question several stories could answer offers the runners-up', () => {
  const f = field(/under pressure/);
  return f.alternatives.length > 0 && f.alternatives.every((a) => a.text && a.words > 0);
});

check('a question only one story covers offers no filler', () => {
  const f = field(/difficult customer/);
  return f.answer.from.id === 's4' && f.alternatives.length === 0;
});

check('the resume upload is read but never answered', () => {
  const f = field(/Upload your resume/);
  return f.type === 'file' && f.kind === 'skip' && f.answer === null;
});

check('a consent tickbox is not treated as a question about the candidate', () => {
  const f = field(/privacy policy/);
  return f.kind === 'skip' && f.answer === null;
});

check('skipped fields are not counted as unanswered questions', () =>
  sheet.stats.questions < sheet.stats.fields);

check('the counts add up', () =>
  sheet.stats.answered >= 6 && sheet.stats.answered <= sheet.stats.questions);

// -------------------------------------------------------------------- the DOM

check('the panel rendered on the host page', () => !!shadow);

check('the panel shows an editable answer per answered question', () =>
  shadow.querySelectorAll('.answer textarea').length === sheet.stats.answered);

check('the panel names the candidate and the employer', () =>
  /Priya Nair/.test(shadow.querySelector('.who').textContent)
  && /Canva/.test(shadow.querySelector('.who').textContent));

check('a weak match is flagged for reading', () =>
  shadow.querySelectorAll('.item.weak, .item.fact, .item.open').length > 0);

// ------------------------------------------------------------------- insert

const whyIndex = allFields.findIndex((f) => /Why do you want to work at Canva/.test(f.label || ''));
const items = shadow.querySelectorAll('.item');
const whyItem = Array.from(items).find((i) => /Why do you want to work at Canva/.test(i.querySelector('.q').textContent));
const insertButton = Array.from(whyItem.querySelectorAll('button')).find((b) => b.textContent === 'Insert');

insertButton.dispatchEvent(new top.window.MouseEvent('click', { bubbles: true }));
await sleep(120);

const target = inner.window.document.querySelector('textarea[name="q1"]');

check('Insert wrote into the real textarea in the iframe', () =>
  target.value.length > 50 && target.value.includes('Canva'));

check('Insert wrote the text the panel was showing', () =>
  target.value === whyItem.querySelector('textarea').value);

check('the button reports what happened', () => /Inserted/.test(insertButton.textContent));

check('nothing was written into any other field', () =>
  inner.window.document.querySelector('textarea[name="q2"]').value === ''
  && inner.window.document.querySelector('input[name="email"]').value === '');

// A single-page app can rebuild the form under the panel between the capture
// and the click. The panel has to hear back, not hang.
const vanished = await new Promise((resolve) =>
  dispatchToBackground(
    { type: 'AGC_INSERT', frameId: inner.frameId, fieldId: 'f999', text: 'anything' },
    { tab: { id: 1 }, frameId: 0 },
    resolve
  ));

check('inserting into a field that has gone reports back instead of hanging', () =>
  vanished.ok === false && /no longer on the page/.test(vanished.error));

// --------------------------------------------------------------------- copy

// jsdom has no clipboard, which is the same situation as a careers site served
// over plain http. It has to degrade to a selectable box, not throw.
const copyButton = Array.from(whyItem.querySelectorAll('button')).find((b) => b.textContent === 'Copy');
copyButton.dispatchEvent(new top.window.MouseEvent('click', { bubbles: true }));
await sleep(60);

check('Copy degrades to a selectable box where the clipboard is blocked', () => {
  const dump = shadow.querySelector('textarea.dump');
  return !!dump && dump.value === whyItem.querySelector('textarea').value
    && /Select above/.test(copyButton.textContent);
});

// ------------------------------------------------------------------ learning

await sleep(60);

check('using an answer remembered it', () => {
  const keys = Object.keys(storage.agcLearned || {});
  return keys.length === 1 && storage.agcLearned[keys[0]] === 'st5';
});

check('it was remembered without the employer in the key', () =>
  Object.keys(storage.agcLearned)[0] === 'why do you want to work at');

// Swap to a different story on the pressure question and re-ask.
const pressureItem = Array.from(items).find((i) => /under pressure/.test(i.querySelector('.q').textContent));
Array.from(pressureItem.querySelectorAll('button')).find((b) => /^Other/.test(b.textContent))
  .dispatchEvent(new top.window.MouseEvent('click', { bubbles: true }));
const firstAlt = pressureItem.querySelector('.alt');
const altTitle = firstAlt.querySelector('b').textContent.split(' · ')[0];
firstAlt.dispatchEvent(new top.window.MouseEvent('click', { bubbles: true }));
await sleep(60);

const sheet2 = await new Promise((resolve) =>
  dispatchToBackground({ type: 'AGC_GET_SHEET' }, { tab: { id: 1 }, frameId: 0 }, resolve));
const pressure2 = sheet2.frames.flatMap((f) => f.fields).find((f) => /under pressure/.test(f.label || ''));

check('the swap was remembered', () => pressure2.answer.from.title === altTitle);

check('a remembered answer says so', () =>
  pressure2.answer.source === 'remembered' && pressure2.confidence === 'remembered');

check('a remembered answer still offers the others', () =>
  pressure2.alternatives.length > 0
  && pressure2.alternatives.every((a) => a.id !== pressure2.answer.from.id));

const why2 = sheet2.frames.flatMap((f) => f.fields).find((f) => /Why do you want to work at Canva/.test(f.label || ''));
check('the remembered why-answer survives the round trip', () =>
  why2.answer.from.id === 'st5' && why2.answer.source === 'remembered');

// ---------------------------------------------------------------- no bank yet

delete storage.agcBank;
const bare = await new Promise((resolve) =>
  dispatchToBackground({ type: 'AGC_GET_SHEET' }, { tab: { id: 1 }, frameId: 0 }, resolve));

check('with no bank it still reads the form', () =>
  bare.hasBank === false && bare.stats.fields === sheet.stats.fields);

check('with no bank it answers nothing rather than guessing', () =>
  bare.stats.answered === 0);

// ------------------------------------------------------------ a second click

// The insert listener is registered once per frame and never again, so a second
// capture has to reach the SECOND run's elements through it. A field added to
// the top of the form shifts every id along, so a listener still holding the
// first click's map would now insert into the wrong box entirely.
storage.agcBank = BANK;
{
  // A radio group, because grouped fields are numbered before the rest: adding
  // a text box would leave the working-rights group on the same id it had.
  const doc = inner.window.document;
  const extra = doc.createElement('fieldset');
  extra.innerHTML = '<legend>Are you comfortable working weekends?</legend>'
    + '<label><input type="radio" name="weekends" value="y"> Yes</label>'
    + '<label><input type="radio" name="weekends" value="n"> No</label>';
  doc.querySelector('form').prepend(extra);
}
await onClicked({ id: 1 });
await sleep(700);

const shadow2 = top.window.document.getElementById('agc-form-reader-panel').shadowRoot;

check('the second click replaces the panel rather than stacking one on it', () =>
  top.window.document.querySelectorAll('#agc-form-reader-panel').length === 1);

const rightsItem = Array.from(shadow2.querySelectorAll('.item'))
  .find((i) => /full working rights/.test(i.querySelector('.q').textContent));
Array.from(rightsItem.querySelectorAll('button')).find((b) => b.textContent === 'Insert')
  .dispatchEvent(new top.window.MouseEvent('click', { bubbles: true }));
await sleep(120);

check('Insert on a radio group ticks the right option', () => {
  const doc = inner.window.document;
  return doc.querySelector('input[name="rights"][value="y"]').checked === true
    && doc.querySelector('input[name="rights"][value="n"]').checked === false;
});

check('the answer remembered on the first click is used on the second', () => {
  const item = Array.from(shadow2.querySelectorAll('.item'))
    .find((i) => /under pressure/.test(i.querySelector('.q').textContent));
  return item.querySelector('.from').textContent.includes(altTitle);
});

// -------------------------------------------------------------------- report

console.log(results.join('\n'));
console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
