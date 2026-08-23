// Checks the things Chrome only tells you about after you have loaded the
// folder and clicked the button. Run: node package.test.mjs
//
// The one that matters most: a content script injected with executeScript is a
// CLASSIC script. An `import` at the top of capture.js is a syntax error in the
// page, the panel never appears, and nothing in the unit tests would catch it
// because node is perfectly happy to import the file.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');

/**
 * Source with comments removed. The network check below scans for the word
 * `fetch`, and a file that merely *mentions* fetching in a comment is not a
 * file that fetches. Reading prose as code made this fail on a doc comment.
 */
const readCode = (p) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
const manifest = JSON.parse(read('manifest.json'));

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

// ------------------------------------------------------------------ manifest

check('manifest v3', () => manifest.manifest_version === 3);
check('has a version', () => /^\d+\.\d+/.test(manifest.version));

check('the service worker is a module, so it can import the matcher', () =>
  manifest.background.type === 'module');

check('every file the manifest names exists', () => {
  const paths = [manifest.background.service_worker, manifest.options_ui?.page].filter(Boolean);
  return paths.every((p) => existsSync(join(here, p)));
});

check('the content script the worker injects exists', () =>
  existsSync(join(here, 'reader/capture.js')));

check('every declared content script exists', () =>
  (manifest.content_scripts || []).every((cs) => cs.js.every((f) => existsSync(join(here, f)))));

// A second manifest deeper in the tree is a folder someone can load by mistake,
// and they would get whichever older version of the extension it describes.
check('there is exactly one manifest to load', () =>
  !existsSync(join(here, 'reader/manifest.json')) && !existsSync(join(here, 'matcher/manifest.json')));

check('permissions stay minimal', () => {
  const wanted = new Set(['activeTab', 'scripting', 'storage']);
  return manifest.permissions.length === wanted.size && manifest.permissions.every((p) => wanted.has(p));
});

// Host permissions are the single biggest thing a Chrome Web Store reviewer
// weighs, and the difference between a review measured in days and one measured
// in weeks. Two exact hosts, no wildcards in the domain, nothing speculative.
check('host permissions name exact hosts and never a wildcard domain', () => {
  const hosts = manifest.host_permissions || [];
  const allowed = new Set([
    'https://au.seek.com/*',
    'https://jobhub-production-f138.up.railway.app/*',
  ]);
  const bad = hosts.filter((h) => !allowed.has(h));
  return bad.length ? bad : hosts.length === allowed.size;
});

check('never asks for <all_urls> or a bare wildcard', () =>
  !(manifest.host_permissions || []).some((h) => /^\*|<all_urls>|:\/\/\*\//.test(h)));

check('no sensitive permissions that would slow a store review', () => {
  const sensitive = ['cookies', 'history', 'webRequest', 'downloads', 'tabs', 'management', 'debugger'];
  const found = (manifest.permissions || []).filter((x) => sensitive.includes(x));
  return found.length ? found : true;
});

// The collector reads a page the candidate already has open. It must never
// write to it, and above all never press Apply on their behalf.
const collect = read('seek/collect.js');

check('the seek collector is a classic script, not a module', () =>
  !/^\s*(import|export)\s/m.test(collect));

check('the seek collector never clicks or submits anything on the page', () =>
  !/\.submit\s*\(/.test(collect) &&
  !/document\.querySelector\([^)]*\)\.click\s*\(/.test(collect));

check('the seek collector itself never touches the network', () =>
  !/(fetch|XMLHttpRequest|WebSocket|sendBeacon)/.test(readCode('seek/collect.js')));

// ----------------------------------------------------------- content script

const capture = read('reader/capture.js');

check('capture.js is a classic script, not a module', () =>
  !/^\s*(import|export)\s/m.test(capture));

check('capture.js never submits a form', () =>
  !/\.submit\s*\(|type=["']submit["']\s*\)?\.click/.test(capture));

check('capture.js only ever clicks nothing at all', () =>
  !/\.click\s*\(\)/.test(capture.replace(/a\.click\(\);/g, '')));  // the download anchor is ours

// ---------------------------------------------------------------- es modules

/** Every relative import in the extension's modules has to resolve on disk. */
function importsOf(file) {
  const src = read(file);
  return [...src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
}

const MODULES = [
  'background.js', 'options.js', 'seek/record.js',
  'matcher/matcher.js', 'matcher/sheet.js', 'matcher/bank.js',
  'matcher/profile.js', 'matcher/context.js', 'matcher/taxonomy.js',
  'matcher/normalise.js',
];

check('every import resolves', () => {
  const missing = [];
  for (const file of MODULES) {
    for (const spec of importsOf(file)) {
      const target = resolve(dirname(join(here, file)), spec);
      if (!existsSync(target)) missing.push(`${file} -> ${spec}`);
    }
  }
  return missing.length ? missing : true;
});

// The service worker is now the ONLY file allowed to reach the network, and
// only to JobHub. Keeping that true in one file is what makes the data-use
// declaration on the store listing checkable rather than a promise.
check('only the service worker reaches the network', () => {
  const offenders = [];
  for (const file of [...MODULES, 'reader/capture.js', 'seek/collect.js']) {
    if (file === 'background.js') continue;
    const src = readCode(file);
    // options.js fetches the bundled example bank through the extension's own
    // URL, which never leaves the machine.
    const network = src.match(/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\b/g) || [];
    const local = (src.match(/fetch\(chrome\.runtime\.getURL/g) || []).length;
    if (network.length > local) offenders.push(file);
  }
  return offenders.length ? offenders : true;
});


check('the service worker only ever posts to the JobHub API', () => {
  const src = read('background.js');
  const urls = [...src.matchAll(/fetch\(`?([^`)'",\s]+)/g)].map((m) => m[1]);
  const bad = urls.filter((u) => !u.includes('${base}') && !u.startsWith('chrome'));
  return bad.length ? bad : true;
});

check('no secret is baked into the extension; the candidate pastes their own key', () =>
  !/agc_[A-Za-z0-9_-]{20,}/.test(read('background.js') + read('options.js')));

// -------------------------------------------------------------- options page

const optionsHtml = read('options.html');

check('the options page loads its script as a module', () =>
  /<script\s+type="module"\s+src="options\.js"><\/script>/.test(optionsHtml));

check('no inline script, which the extension CSP would block', () =>
  !/<script(?![^>]*\bsrc=)/i.test(optionsHtml));

check('the example bank it offers is packaged', () =>
  existsSync(join(here, 'matcher/bank.example.json')));

console.log(results.join('\n'));
console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
