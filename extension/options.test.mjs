// The bank page, driven the way a person drives it. Run: node options.test.mjs
//
// It is the one surface with no capture and no matcher behind it, so the only
// way to know the buttons are wired to anything is to press them.

import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(here, 'options.html'), 'utf8');
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

// ------------------------------------------------------------------ the page

const dom = new JSDOM(HTML, { url: 'chrome-extension://test/options.html' });
const { window } = dom;

const storage = { agcBank: JSON.parse(JSON.stringify(BANK)), agcLearned: { 'why do you want to work at': 'st5' } };
const downloads = [];

globalThis.window = window;
globalThis.document = window.document;
globalThis.Blob = window.Blob;
globalThis.URL = window.URL;
window.URL.createObjectURL = () => 'blob:test';
window.URL.revokeObjectURL = () => {};
window.HTMLAnchorElement.prototype.click = function click() { downloads.push(this.download); };

globalThis.chrome = {
  runtime: { getURL: (p) => `chrome-extension://test/${p}` },
  storage: {
    local: {
      get: async (keys) => {
        const out = {};
        for (const k of (Array.isArray(keys) ? keys : [keys])) if (storage[k] !== undefined) out[k] = storage[k];
        return out;
      },
      set: async (obj) => { Object.assign(storage, obj); },
      remove: async (keys) => { for (const k of (Array.isArray(keys) ? keys : [keys])) delete storage[k]; },
    },
  },
};

// The example bank is read through fetch(chrome.runtime.getURL(...)).
globalThis.fetch = async () => ({ text: async () => JSON.stringify(BANK) });

const $ = (id) => window.document.getElementById(id);
const press = (id) => $(id).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

await import('./options.js');
await sleep(60);

// ------------------------------------------------------------- what it shows

check('the page opens on what is already stored', () =>
  /Priya Nair/.test($('editor').value));

check('the remembered answers are folded into what it shows', () =>
  JSON.parse($('editor').value).learned['why do you want to work at'] === 'st5');

check('it counts the bank', () => {
  const text = $('stats').textContent;
  return /8/.test(text) && /stories/.test(text) && /statements/.test(text);
});

check('it says how many themes are covered', () =>
  /\d+\/\d+/.test($('stats').textContent) && /themes covered/.test($('stats').textContent));

check('it shows a chip per theme, covered or not', () =>
  $('coverage').querySelectorAll('.theme').length >= 11);

check('an uncovered theme is marked, not omitted', () =>
  $('coverage').querySelectorAll('.theme.off').length + $('coverage').querySelectorAll('.theme.on').length
  === $('coverage').querySelectorAll('.theme').length);

check('it lists the profile fields, set and unset', () => {
  const text = $('profile').textContent;
  return /Full name: Priya Nair/.test(text) && /not set/.test(text);
});

// ---------------------------------------------------------------- saving

$('editor').value = 'this is not json';
press('save');
await sleep(30);
check('rubbish is refused', () =>
  /not valid JSON/.test($('messages').textContent) && storage.agcBank.profile.name === 'Priya Nair');

$('editor').value = JSON.stringify({ profile: {}, stories: [{ id: 's1', variants: {} }], statements: [] });
press('save');
await sleep(30);
check('a bank with an empty entry is refused, and the old one is left alone', () =>
  /no answer text/.test($('messages').textContent) && storage.agcBank.stories.length === 8);

const good = JSON.parse(JSON.stringify(BANK));
good.profile.name = 'Someone Else';
$('editor').value = JSON.stringify(good);
press('save');
await sleep(40);
check('a good bank saves', () =>
  storage.agcBank.profile.name === 'Someone Else' && /Saved/.test($('messages').textContent));

check('saving refreshes what the page shows', () =>
  /Someone Else/.test($('profile').textContent));

good.stories[0].themes = ['not-a-theme'];
$('editor').value = JSON.stringify(good);
press('save');
await sleep(40);
check('a warning saves but says so', () =>
  /Saved/.test($('messages').textContent) && /unknown theme/.test($('messages').textContent));

// ---------------------------------------------------------------- the rest

press('example');
await sleep(40);
check('the example bank loads into the editor without saving itself', () =>
  /Priya Nair/.test($('editor').value) && storage.agcBank.profile.name === 'Someone Else');

press('export');
await sleep(40);
check('export names the file after the candidate', () =>
  downloads.some((d) => /someone-else-bank\.json/.test(d)));

press('forget');
await sleep(40);
check('forget empties the remembered answers only', () =>
  Object.keys(storage.agcLearned).length === 0 && !!storage.agcBank);

press('clear');
await sleep(40);
check('remove takes the bank off the machine', () => storage.agcBank === undefined);

check('with nothing stored it says so rather than breaking', () =>
  /No bank loaded/.test($('stats').textContent));

console.log(results.join('\n'));
console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
