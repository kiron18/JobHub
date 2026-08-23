// Service worker: storage and messaging, and nothing else.
//
// All the thinking lives in matcher/, as plain ES modules with no browser in
// them, which is why the whole path from "a form" to "an answer sheet" can be
// tested in node. This file is the part that cannot be: it injects the reader
// into every frame, holds the per-frame results until the top frame asks for
// them, and relays an insert back to the frame that owns the field.
//
// Frames matter: Greenhouse and Workable are very often embedded in a
// cross-origin iframe on the company's own careers page, so a capture that only
// looks at the top document finds an empty page and reports nothing.

import { buildSheet } from './matcher/sheet.js';
import { buildRecord, addToBasket, toPayload, MAX_BASKET } from './seek/record.js';
import { pageContext, mergeContexts } from './matcher/context.js';
import { normalise } from './matcher/normalise.js';
import { validateBank } from './matcher/bank.js';

const STORE_KEYS = {
  bank: 'agcBank',
  learned: 'agcLearned',
  basket: 'agcSeekBasket',
  token: 'agcApiToken',
  apiBase: 'agcApiBase',
};

const DEFAULT_API_BASE = 'https://jobhub-production-f138.up.railway.app';

/** @type {Map<number, {frames: Array<object>}>} */
const store = new Map();

// ------------------------------------------------------------------ storage

async function loadBank() {
  const got = await chrome.storage.local.get([STORE_KEYS.bank, STORE_KEYS.learned]);
  const raw = got[STORE_KEYS.bank] || null;
  if (!raw) return { bank: null, learned: {} };
  // Validation runs on every load, not just on import: a bank saved by an older
  // version can still carry a learned pointer to a story since deleted.
  const { bank } = validateBank(raw);
  return { bank, learned: got[STORE_KEYS.learned] || {} };
}

async function remember(question, entryId, ctx) {
  const key = normalise(question, { company: ctx.company || '', role: ctx.role || '' });
  if (!key) return;
  const got = await chrome.storage.local.get(STORE_KEYS.learned);
  const learned = got[STORE_KEYS.learned] || {};
  if (entryId) learned[key] = entryId;
  else delete learned[key];
  await chrome.storage.local.set({ [STORE_KEYS.learned]: learned });
}

// -------------------------------------------------------------------- click

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  // Fresh run: drop anything held from the last click on this tab.
  store.set(tab.id, { frames: [] });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['reader/capture.js'],
    });
  } catch (err) {
    // Chrome Web Store, chrome:// pages and a few others refuse injection.
    console.warn('[AGC] injection failed', err);
  }
});

// ----------------------------------------------------------------- messages

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab && sender.tab.id;

  if (msg.type === 'AGC_OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (typeof tabId !== 'number') return;

  if (msg.type === 'AGC_FRAME_RESULT') {
    const entry = store.get(tabId) || { frames: [] };
    entry.frames.push({ ...msg.payload, frameId: sender.frameId });
    store.set(tabId, entry);
    return;
  }

  if (msg.type === 'AGC_GET_SHEET') {
    (async () => {
      const entry = store.get(tabId) || { frames: [] };

      // Context comes from EVERY frame, including the ones with no fields in
      // them: on an embedded board the host page is where the job title is
      // written, and it is exactly the frame the field filter would drop.
      const contexts = entry.frames
        .slice()
        .sort((a, b) => Number(b.isTop) - Number(a.isTop))
        .map((f) => pageContext(f.page || { url: f.url, title: f.title }));
      const context = mergeContexts(contexts);

      const frames = entry.frames.filter((f) => (f.fields || []).length > 0);
      frames.sort((a, b) => Number(b.isTop) - Number(a.isTop));

      const { bank, learned } = await loadBank();

      sendResponse(buildSheet({ frames, context, bank, learned }));
    })();
    return true; // keep the channel open for the async response
  }

  if (msg.type === 'AGC_LEARN') {
    (async () => {
      await remember(msg.question, msg.entryId, msg.context || {});
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'AGC_INSERT') {
    (async () => {
      try {
        const reply = await chrome.tabs.sendMessage(
          tabId,
          { type: 'AGC_DO_INSERT', fieldId: msg.fieldId, text: msg.text, option: msg.option },
          { frameId: msg.frameId }
        );
        sendResponse(reply || { ok: false, error: 'no reply from the frame' });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      }
    })();
    return true;
  }
});


// ------------------------------------------------------------ seek collector
//
// The page half (seek/collect.js) reads the DOM and hands the raw strings over.
// Everything that decides whether those strings are a job, and everything that
// touches the network, happens here — the same split the form assistant uses.

async function getBasket() {
  const got = await chrome.storage.local.get(STORE_KEYS.basket);
  return Array.isArray(got[STORE_KEYS.basket]) ? got[STORE_KEYS.basket] : [];
}

async function setBasket(basket) {
  await chrome.storage.local.set({ [STORE_KEYS.basket]: basket });
  // The badge is the only thing that survives navigating away from Seek, so it
  // is where "you have four jobs waiting" actually lives.
  await chrome.action.setBadgeText({ text: basket.length ? String(basket.length) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#38bdf8' });
}

async function sendBasket() {
  const basket = await getBasket();
  if (!basket.length) return { ok: false, reason: 'Nothing to send' };

  const got = await chrome.storage.local.get([STORE_KEYS.token, STORE_KEYS.apiBase]);
  const token = got[STORE_KEYS.token];
  if (!token) {
    return { ok: false, reason: 'Add your JobHub key in the extension options first' };
  }
  const base = (got[STORE_KEYS.apiBase] || DEFAULT_API_BASE).replace(/\/+$/, '');

  let res;
  try {
    res = await fetch(`${base}/api/jobs/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jobs: toPayload(basket) }),
    });
  } catch {
    // Keep the basket. A dropped connection must not cost someone ten jobs.
    return { ok: false, reason: 'Could not reach JobHub. Your jobs are still saved here.' };
  }

  if (res.status === 401) return { ok: false, reason: 'That JobHub key was rejected. Re-copy it from your dashboard.' };
  if (!res.ok) return { ok: false, reason: `JobHub said no (${res.status}). Your jobs are still saved here.` };

  const body = await res.json().catch(() => ({}));
  await setBasket([]);
  return { ok: true, savedCount: body.savedCount ?? 0, skippedCount: body.skippedCount ?? 0 };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'AGC_SEEK_COUNT') {
    getBasket().then((b) => sendResponse({ ok: true, count: b.length }));
    return true;
  }

  if (msg.type === 'AGC_SEEK_ADD') {
    (async () => {
      const built = buildRecord({ read: (name) => msg.fields?.[name] ?? null, url: msg.url });
      if (!built.ok) {
        sendResponse({ ok: false, reason: built.reason });
        return;
      }
      const basket = await getBasket();
      const out = addToBasket(basket, built.record);
      if (out.added) await setBasket(out.basket);
      sendResponse({ ok: true, added: out.added, reason: out.reason, count: out.basket.length, max: MAX_BASKET });
    })();
    return true;
  }

  if (msg.type === 'AGC_SEEK_SEND') {
    sendBasket().then(sendResponse);
    return true;
  }

  if (msg.type === 'AGC_SEEK_CLEAR') {
    setBasket([]).then(() => sendResponse({ ok: true, count: 0 }));
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => store.delete(tabId));
