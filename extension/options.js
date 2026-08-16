// The bank page. Load a bank, see what it covers, take it away again.
//
// The coverage strip is the point of this page. A bank with eight stories that
// all evidence the same two themes looks full and answers a third of a form, and
// nothing else in the product would ever tell the candidate that.

import { validateBank, bankCoverage, withLearned } from './matcher/bank.js';
import { PROFILE_FIELDS } from './matcher/profile.js';

const KEYS = { bank: 'agcBank', learned: 'agcLearned' };
const $ = (id) => document.getElementById(id);

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function message(kind, title, items = []) {
  const box = el('div', `msg ${kind}`);
  box.appendChild(el('div', null, title));
  if (items.length) {
    const ul = el('ul');
    for (const item of items) ul.appendChild(el('li', null, item));
    box.appendChild(ul);
  }
  return box;
}

async function read() {
  const got = await chrome.storage.local.get([KEYS.bank, KEYS.learned]);
  return { bank: got[KEYS.bank] || null, learned: got[KEYS.learned] || {} };
}

// ------------------------------------------------------------------ rendering

function renderStatus({ bank, learned }) {
  const stats = $('stats');
  const coverage = $('coverage');
  const profile = $('profile');
  stats.replaceChildren();
  coverage.replaceChildren();
  profile.replaceChildren();

  if (!bank) {
    stats.appendChild(el('div', null, 'No bank loaded yet. Paste one below, or load the example to see the shape of it.'));
    return;
  }

  const report = validateBank(bank);
  const cover = bankCoverage(report.bank, { industry: bank.profile?.industry });

  const tiles = [
    [report.stats.stories, 'stories'],
    [report.stats.statements, 'statements'],
    [`${cover.covered}/${cover.total}`, 'themes covered'],
    [Object.keys(learned).length, 'answers remembered'],
  ];
  for (const [value, label] of tiles) {
    const tile = el('div', 'stat');
    tile.appendChild(el('b', null, String(value)));
    tile.appendChild(el('span', null, label));
    stats.appendChild(tile);
  }

  for (const row of cover.rows) {
    coverage.appendChild(el('span', `theme ${row.covered ? 'on' : 'off'}`,
      `${row.label}${row.count > 1 ? ` ×${row.count}` : ''}`));
  }

  for (const field of PROFILE_FIELDS) {
    const value = bank.profile ? bank.profile[field.key] : undefined;
    const set = value !== undefined && value !== '';
    const row = el('div', set ? 'set' : '');
    row.appendChild(el('b', null, `${field.label}: `));
    row.appendChild(document.createTextNode(set ? String(value) : 'not set'));
    profile.appendChild(row);
  }

  if (cover.gaps.length) {
    coverage.appendChild(el('span', 'theme off',
      `nothing yet for: ${cover.gaps.join(', ')}`));
  }
}

async function refresh() {
  renderStatus(await read());
}

// -------------------------------------------------------------------- actions

async function save(text) {
  const messages = $('messages');
  messages.replaceChildren();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    messages.appendChild(message('err', `That is not valid JSON: ${err.message}`));
    return;
  }

  const report = validateBank(parsed);
  if (!report.ok) {
    messages.appendChild(message('err', 'Not saved. Fix these first:', report.errors));
    return;
  }

  await chrome.storage.local.set({ [KEYS.bank]: report.bank });
  messages.appendChild(message('ok',
    `Saved. ${report.stats.stories} stories, ${report.stats.statements} statements, ready to use on the next form.`));
  if (report.warnings.length) {
    messages.appendChild(message('warn', 'Worth fixing when you get a chance:', report.warnings));
  }
  await refresh();
}

$('save').addEventListener('click', () => save($('editor').value));

$('pick').addEventListener('click', () => $('file').click());

$('file').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const text = await file.text();
  $('editor').value = text;
  await save(text);
  e.target.value = '';
});

$('example').addEventListener('click', async () => {
  const res = await fetch(chrome.runtime.getURL('matcher/bank.example.json'));
  $('editor').value = await res.text();
  $('messages').replaceChildren(message('warn',
    'This is Priya, an example candidate. Read it as the shape to fill in, then press Save.'));
});

$('export').addEventListener('click', async () => {
  const { bank, learned } = await read();
  if (!bank) return;
  const merged = withLearned(bank, learned);
  const name = (merged.profile?.name || 'answer-bank').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const blob = new Blob([JSON.stringify(merged, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}-bank.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('forget').addEventListener('click', async () => {
  await chrome.storage.local.set({ [KEYS.learned]: {} });
  $('messages').replaceChildren(message('ok', 'Remembered answers cleared. Matching starts fresh.'));
  await refresh();
});

$('clear').addEventListener('click', async () => {
  await chrome.storage.local.remove([KEYS.bank]);
  $('messages').replaceChildren(message('ok', 'Bank removed from this computer.'));
  await refresh();
});

// Show what is already stored, so the page opens on the truth rather than blank.
read().then(({ bank, learned }) => {
  renderStatus({ bank, learned });
  if (bank) $('editor').value = JSON.stringify(withLearned(bank, learned), null, 2);
});
