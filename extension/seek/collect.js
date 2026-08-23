// The page half of the Seek collector. A classic script: content scripts
// declared in the manifest are not modules, and an `import` here is a syntax
// error the unit tests would never catch (see package.test.mjs).
//
// It reads. It never clicks anything, never submits anything, and never writes
// into the page beyond its own pill in the corner.
//
// Seek is a single-page app: clicking a card on the search results page swaps
// the job in the right-hand pane without a navigation. So this watches for the
// job id in the URL changing rather than running once on load, which is what
// makes "tick through ten jobs on the results page" work at all.

(() => {
  'use strict';

  const PILL_ID = 'agc-seek-pill';
  const FIELDS = {
    title: 'job-detail-title',
    company: 'advertiser-name',
    description: 'jobAdDetails',
    location: 'job-detail-location',
    workType: 'job-detail-work-type',
    classification: 'job-detail-classifications',
  };

  const read = (automation) => {
    const el = document.querySelector(`[data-automation="${automation}"]`);
    return el ? el.innerText : null;
  };

  const onJobPage = () => !!document.querySelector(`[data-automation="${FIELDS.title}"]`);

  // ------------------------------------------------------------------- pill

  let els = null;

  function build() {
    if (document.getElementById(PILL_ID)) return;

    const host = document.createElement('div');
    host.id = PILL_ID;
    // A shadow root so Seek's stylesheet cannot reach in and our styles cannot
    // leak out onto their page.
    const root = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      .pill { position:fixed; right:20px; bottom:20px; z-index:2147483000;
        font:500 13px/1.4 -apple-system,"Segoe UI",Roboto,sans-serif;
        background:#0f172a; color:#e2e8f0; border:1px solid #334155;
        border-radius:12px; box-shadow:0 8px 28px rgba(0,0,0,.35);
        padding:10px; display:flex; flex-direction:column; gap:8px; min-width:210px; }
      .row { display:flex; gap:8px; align-items:center; }
      button { font:inherit; font-weight:600; padding:7px 12px; border-radius:8px;
        border:1px solid #334155; background:#1e293b; color:#e2e8f0; cursor:pointer; }
      button:hover:not(:disabled) { background:#334155; }
      button:disabled { opacity:.5; cursor:default; }
      button.go { background:#38bdf8; border-color:#38bdf8; color:#04263a; flex:1; }
      button.go:hover:not(:disabled) { background:#7dd3fc; }
      .count { font-variant-numeric:tabular-nums; color:#94a3b8; font-size:12px; }
      .msg { font-size:12px; color:#94a3b8; }
      .msg.bad { color:#fca5a5; }
      .msg.good { color:#86efac; }
      .hide { display:none; }
    `;

    const wrap = document.createElement('div');
    wrap.className = 'pill';
    wrap.innerHTML = `
      <div class="row">
        <button class="save" type="button">Save job</button>
        <span class="count"></span>
      </div>
      <div class="row send hide">
        <button class="go" type="button"></button>
        <button class="clear" type="button" title="Empty the list">Clear</button>
      </div>
      <div class="msg"></div>
    `;
    root.append(style, wrap);
    document.documentElement.appendChild(host);

    els = {
      host,
      save: root.querySelector('.save'),
      count: root.querySelector('.count'),
      sendRow: root.querySelector('.send'),
      go: root.querySelector('.go'),
      clear: root.querySelector('.clear'),
      msg: root.querySelector('.msg'),
    };

    els.save.addEventListener('click', onSave);
    els.go.addEventListener('click', onSend);
    els.clear.addEventListener('click', onClear);
  }

  function say(text, kind) {
    if (!els) return;
    els.msg.textContent = text || '';
    els.msg.className = `msg${kind ? ' ' + kind : ''}`;
  }

  function paint(n) {
    if (!els) return;
    els.count.textContent = n ? `${n} saved` : '';
    els.sendRow.classList.toggle('hide', n === 0);
    els.go.textContent = n === 1 ? 'Send 1 to JobHub' : `Send ${n} to JobHub`;
  }

  // --------------------------------------------------------------- actions

  const ask = (msg) =>
    new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => resolve(r || { ok: false })));

  async function refresh() {
    const r = await ask({ type: 'AGC_SEEK_COUNT' });
    paint(r.count || 0);
  }

  async function onSave() {
    els.save.disabled = true;
    say('');
    const fields = {};
    for (const name of Object.values(FIELDS)) fields[name] = read(name);

    const r = await ask({ type: 'AGC_SEEK_ADD', fields, url: location.href });
    if (r.ok) {
      say(r.added ? 'Saved' : r.reason || 'Already saved', r.added ? 'good' : null);
      paint(r.count);
    } else {
      say(r.reason || 'Could not read this page', 'bad');
    }
    els.save.disabled = false;
  }

  async function onSend() {
    els.go.disabled = true;
    say('Sending…');
    const r = await ask({ type: 'AGC_SEEK_SEND' });
    if (r.ok) {
      const bits = [`${r.savedCount} added`];
      if (r.skippedCount) bits.push(`${r.skippedCount} skipped`);
      say(bits.join(', '), 'good');
      paint(0);
    } else {
      say(r.reason || 'Send failed', 'bad');
    }
    els.go.disabled = false;
  }

  async function onClear() {
    await ask({ type: 'AGC_SEEK_CLEAR' });
    say('');
    paint(0);
  }

  // ------------------------------------------------------------- lifecycle

  function sync() {
    if (onJobPage()) {
      build();
      if (els) els.host.style.display = '';
      refresh();
    } else if (els) {
      els.host.style.display = 'none';
    }
  }

  // Seek swaps jobs without navigating, so poll the URL. An observer on the
  // whole document fires hundreds of times a second on a page this busy; a
  // second-resolution check is cheaper and quite fast enough for a human
  // clicking job cards.
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      say('');
      setTimeout(sync, 400); // let the new pane render
    }
  }, 500);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sync, { once: true });
  } else {
    sync();
  }
})();
