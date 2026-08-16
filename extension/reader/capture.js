// AGC Form Assistant - the page half.
//
// Two jobs, in this order:
//   1. work out what every control on the page is asking (the capture)
//   2. show the answer sheet the service worker builds back from it, and put a
//      chosen answer into the box the candidate is looking at
//
// It never clicks a button and never submits a form. The only writes it makes
// are into the one field whose Insert button was pressed.
//
// Deliberately not innerHTML: a job page is half a megabyte of utility classes,
// SVG paths and tracking divs. We only ever look at form controls and at the
// text that names them, which is how the output stays a couple of KB.
//
// Naming a field uses the browser's own accessible-name rules (the ones screen
// readers follow), because that is already a solved, standardised answer to
// "what is this box asking?" and it needs no AI at all. Everything falls back
// to reading the surrounding container only when those rules come up empty.

(() => {
  'use strict';

  const MAX_LABEL = 300;
  const PANEL_ID = 'agc-form-reader-panel';

  // ---------------------------------------------------------------- helpers

  const clean = (s) =>
    (s || '')
      .replace(/\s+/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s*\*\s*$/, '')            // trailing required marker
      .replace(/\s*\((required|optional)\)\s*$/i, '')
      .trim()
      .slice(0, MAX_LABEL);

  const isVisible = (el) => {
    if (!el || !el.isConnected) return false;

    // Chrome's own answer, and the only one that accounts for content-visibility.
    if (typeof el.checkVisibility === 'function') {
      if (!el.checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true })) return false;
    }

    // Walk ancestors. A control inside a display:none wrapper is invisible, but
    // getComputedStyle on the control itself still reports its own display, so
    // checking only the element would let collapsed sections through.
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      if (node.hasAttribute('hidden')) return false;
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && !el.offsetParent) return false;
    return true;
  };

  const esc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&'));

  // Text of an element with the text of any form controls inside it removed, so
  // a label that wraps its own input does not swallow the input's value.
  const textWithoutControls = (el) => {
    if (!el) return '';
    const clone = el.cloneNode(true);
    clone.querySelectorAll('input, textarea, select, button, svg, script, style').forEach((n) => n.remove());
    return clean(clone.textContent);
  };

  // ------------------------------------------------------------ noise filter

  const NOISE_CONTAINER = /cookie|consent|gdpr|onetrust|newsletter|subscribe|chat-widget|intercom/i;
  const NOISE_NAME = /honeypot|bot-field|csrf|utm_|recaptcha|^_/i;

  const isNoise = (el) => {
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) return true;
    if (type === 'search') return true;
    if (el.closest('[role="search"], nav, header, footer')) return true;
    if (el.closest(`#${PANEL_ID}`)) return true;
    if (el.closest('[aria-hidden="true"]')) return true;

    const name = `${el.name || ''} ${el.id || ''}`;
    if (NOISE_NAME.test(name)) return true;

    let node = el.parentElement;
    for (let i = 0; node && i < 6; i++, node = node.parentElement) {
      const sig = `${node.id || ''} ${typeof node.className === 'string' ? node.className : ''}`;
      if (NOISE_CONTAINER.test(sig)) return true;
    }
    return false;
  };

  // ------------------------------------------------------- accessible name

  function accessibleName(el, doc) {
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const text = labelledby
        .split(/\s+/)
        .map((id) => doc.getElementById(id))
        .filter(Boolean)
        .map((n) => clean(n.textContent))
        .join(' ');
      if (text) return { label: clean(text), source: 'aria-labelledby' };
    }

    const ariaLabel = clean(el.getAttribute('aria-label'));
    if (ariaLabel) return { label: ariaLabel, source: 'aria-label' };

    if (el.id) {
      const forLabel = doc.querySelector(`label[for="${esc(el.id)}"]`);
      const text = textWithoutControls(forLabel);
      if (text) return { label: text, source: 'label[for]' };
    }

    const wrapping = el.closest('label');
    if (wrapping) {
      const text = textWithoutControls(wrapping);
      if (text) return { label: text, source: 'wrapping label' };
    }

    const placeholder = clean(el.getAttribute('placeholder'));
    if (placeholder) return { label: placeholder, source: 'placeholder' };

    const title = clean(el.getAttribute('title'));
    if (title) return { label: title, source: 'title' };

    const fromContainer = containerQuestion(el);
    if (fromContainer) return { label: fromContainer, source: 'container text' };

    if (el.name) {
      const humanised = clean(el.name.replace(/[_\-.\[\]]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'));
      if (humanised) return { label: humanised, source: 'name attribute' };
    }

    return { label: '', source: 'none' };
  }

  // Many real forms put the question in a plain div above the box rather than in
  // a <label>. Walk up while this control is the only one in the container and
  // take whatever text that container holds.
  function containerQuestion(el) {
    let node = el.parentElement;
    for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
      if (node.tagName === 'FORM' || node.tagName === 'BODY') break;
      const controls = node.querySelectorAll('input:not([type="hidden"]), textarea, select');
      if (controls.length > 1) break;
      const text = textWithoutControls(node);
      if (text.length > 2) return text;
    }
    return '';
  }

  // ----------------------------------------------------- subjective heuristic

  const SUBJECTIVE_HINTS = /\b(why|describe|tell us|tell me|explain|what makes|a time (when|that)|cover letter|in your own words|how would you|what interests|elaborate|walk us through)\b/i;

  function looksSubjective(field) {
    if (field.type === 'textarea' || field.type === 'richtext') return true;
    if (field.maxLength && field.maxLength >= 200) return true;
    if (SUBJECTIVE_HINTS.test(field.label)) return true;
    if (field.label.length > 60 && field.label.trim().endsWith('?')) return true;
    return false;
  }

  // ------------------------------------------------------------- collection

  // Field id -> the live element(s) behind it, so an insert knows where to go.
  //
  // It hangs off the window, and applyInsert reads it from there rather than
  // closing over it. The service worker re-injects this file on every click, so
  // each click builds a fresh map, while the message listener below is only
  // registered once: a closure would pin it to the FIRST click's elements and
  // silently insert into the wrong field on the second.
  const registry = new Map();
  window.__agcRegistry = registry;

  function collect(doc) {
    const fields = [];
    let counter = 0;
    const nextId = () => `f${++counter}`;
    const seen = new WeakSet();

    // --- radios and checkboxes first, grouped into one question each ---
    const groups = new Map();
    doc.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach((el) => {
      if (!isVisible(el) || isNoise(el)) return;
      const groupEl = el.closest('fieldset, [role="group"], [role="radiogroup"]');
      const key = el.name ? `name:${el.name}` : `el:${groupEl ? groupEl.dataset.agcGroup || (groupEl.dataset.agcGroup = String(Math.random())) : nextId()}`;
      if (!groups.has(key)) groups.set(key, { inputs: [], groupEl, type: el.type });
      groups.get(key).inputs.push(el);
      seen.add(el);
    });

    groups.forEach(({ inputs, groupEl, type }) => {
      const first = inputs[0];
      let label = '';
      let source = '';

      if (groupEl) {
        const legend = groupEl.querySelector('legend');
        const legendText = clean(legend && legend.textContent);
        if (legendText) {
          label = legendText;
          source = 'legend';
        } else {
          const named = accessibleName(groupEl, doc);
          if (named.label) {
            label = named.label;
            source = `group ${named.source}`;
          }
        }
      }

      if (!label && inputs.length > 1) {
        // Common ancestor of the options usually holds the question text.
        let ancestor = first.parentElement;
        while (ancestor && !inputs.every((i) => ancestor.contains(i))) ancestor = ancestor.parentElement;
        const text = ancestor ? textWithoutControls(ancestor) : '';
        // Strip the option labels out of it so only the question remains.
        const optionTexts = inputs.map((i) => accessibleName(i, doc).label).filter(Boolean);
        let stripped = text;
        optionTexts.forEach((o) => { stripped = stripped.split(o).join(' '); });
        label = clean(stripped);
        source = 'group container text';
      }

      if (!label) {
        const named = accessibleName(first, doc);
        label = named.label;
        source = named.source;
      }

      const options = inputs
        .map((i) => accessibleName(i, doc).label || clean(i.value))
        .filter(Boolean);

      const field = {
        id: nextId(),
        label,
        labelSource: source,
        type: inputs.length === 1 && type === 'checkbox' ? 'checkbox' : type,
        required: inputs.some((i) => i.required || i.getAttribute('aria-required') === 'true'),
        options,
        maxLength: null,
      };
      field.likelySubjective = looksSubjective(field);
      registry.set(field.id, { kind: 'group', inputs, labels: options });
      fields.push(field);
    });

    // --- everything else ---
    const SELECTOR = 'input, textarea, select, [contenteditable="true"], [role="combobox"]';
    doc.querySelectorAll(SELECTOR).forEach((el) => {
      if (seen.has(el)) return;
      if (!isVisible(el) || isNoise(el)) return;
      if (el.disabled) return;
      seen.add(el);

      const tag = el.tagName.toLowerCase();
      let type;
      if (tag === 'textarea') type = 'textarea';
      else if (tag === 'select') type = 'select';
      else if (el.getAttribute('contenteditable') === 'true') type = 'richtext';
      else if (el.getAttribute('role') === 'combobox') type = 'combobox';
      else type = (el.getAttribute('type') || 'text').toLowerCase();

      const { label, source } = accessibleName(el, doc);

      const maxAttr = parseInt(el.getAttribute('maxlength'), 10);
      const field = {
        id: nextId(),
        label,
        labelSource: source,
        type,
        required: !!el.required || el.getAttribute('aria-required') === 'true',
        options: tag === 'select'
          ? Array.from(el.options).map((o) => clean(o.textContent)).filter(Boolean).slice(0, 40)
          : [],
        maxLength: Number.isFinite(maxAttr) ? maxAttr : null,
      };
      field.likelySubjective = looksSubjective(field);
      registry.set(field.id, { kind: tag === 'select' ? 'select' : 'single', el });
      fields.push(field);
    });

    return fields;
  }

  // -------------------------------------------------------- page description

  // Raw material for working out the employer and the role. The reasoning lives
  // in matcher/context.js so it can be tested without a browser.
  function describePage(doc) {
    const meta = (prop) => {
      const el = doc.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
      return el ? clean(el.getAttribute('content')) : null;
    };
    const headings = Array.from(doc.querySelectorAll('h1, h2'))
      .filter(isVisible)
      .map((h) => clean(h.textContent))
      .filter(Boolean)
      .slice(0, 6);

    return {
      url: location.href,
      title: doc.title,
      headings,
      meta: { siteName: meta('og:site_name'), title: meta('og:title') },
    };
  }

  // ------------------------------------------------------------------ insert

  const fire = (el) => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // React (and every framework like it) tracks the value it last wrote, so a
  // plain el.value = x is reverted on the next render. Going through the
  // prototype's own setter is what makes the change stick.
  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (setter && setter.set) setter.set.call(el, value);
    else el.value = value;
  }

  const flash = (el) => {
    try {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const previous = el.style.outline;
      el.style.outline = '2px solid #38bdf8';
      setTimeout(() => { el.style.outline = previous; }, 1200);
    } catch { /* an element mid-teardown is not worth an error */ }
  };

  // Everything a page can throw at a write lands here: an input that refuses a
  // string, a framework that has already torn the node down, a getter that
  // throws on read. The panel has to hear back either way, or its button sits
  // on "…" forever.
  function applyInsert(fieldId, text, option) {
    try {
      return insertInto(fieldId, text, option);
    } catch (err) {
      return { ok: false, error: `the page refused it (${err && err.message ? err.message : err})` };
    }
  }

  function insertInto(fieldId, text, option) {
    const rec = (window.__agcRegistry || registry).get(fieldId);
    if (!rec) return { ok: false, error: 'that field is no longer on the page' };

    if (rec.kind === 'group') {
      const wanted = String(option || text || '').trim().toLowerCase();
      const idx = rec.labels.findIndex((l) => String(l).trim().toLowerCase() === wanted);
      const pick = idx >= 0 ? rec.inputs[idx] : null;
      if (!pick) return { ok: false, error: `no option called "${option || text}"` };
      pick.checked = true;
      fire(pick);
      flash(pick);
      return { ok: true, wrote: rec.labels[idx] };
    }

    const el = rec.el;
    if (!el || !el.isConnected) return { ok: false, error: 'that field is no longer on the page' };

    if (rec.kind === 'select') {
      const wanted = String(option || text || '').trim().toLowerCase();
      const match = Array.from(el.options).find((o) => o.textContent.trim().toLowerCase() === wanted)
        || Array.from(el.options).find((o) => o.textContent.trim().toLowerCase().includes(wanted));
      if (!match) return { ok: false, error: `no option called "${option || text}"` };
      el.value = match.value;
      fire(el);
      flash(el);
      return { ok: true, wrote: match.textContent.trim() };
    }

    if (el.isContentEditable) {
      el.focus();
      el.textContent = text;
      fire(el);
      flash(el);
      return { ok: true, wrote: `${text.length} characters` };
    }

    el.focus();
    setNativeValue(el, text);
    fire(el);
    flash(el);
    return { ok: true, wrote: `${text.length} characters` };
  }

  // The listener is registered once per frame. Later injections replace the
  // registry contents above, and this closure reads whichever one is current.
  if (!window.__agcInsertReady) {
    window.__agcInsertReady = true;
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.type === 'AGC_DO_INSERT') {
        sendResponse(applyInsert(msg.fieldId, msg.text, msg.option));
      }
    });
  }

  // ------------------------------------------------------------------ panel

  const PANEL_CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; }
    .wrap { display:flex; flex-direction:column; height:100vh; background:#0f172a; color:#e2e8f0;
            box-shadow:-8px 0 24px rgba(0,0,0,.35); }
    header { padding:14px 16px; background:#1e293b; border-bottom:1px solid #334155; }
    h1 { margin:0 0 4px; font-size:15px; font-weight:600; color:#f8fafc; }
    .who { font-size:12px; color:#cbd5e1; margin-bottom:6px; }
    .who b { color:#f8fafc; }
    .stats { font-size:12px; color:#94a3b8; }
    .stats b { color:#38bdf8; font-weight:600; }
    .warn { color:#f59e0b; }
    .bar { display:flex; gap:8px; padding:10px 16px; background:#1e293b; border-bottom:1px solid #334155; }
    button { padding:7px 10px; font-size:12px; font-weight:600; border:1px solid #334155;
             border-radius:6px; background:#0f172a; color:#e2e8f0; cursor:pointer; }
    button:hover { background:#334155; }
    .bar button { flex:1; }
    .bar button.close { flex:0 0 auto; }
    .list { flex:1; overflow-y:auto; padding:8px 12px 24px; }
    .item { padding:10px 12px; margin-bottom:8px; background:#1e293b; border-radius:8px;
            border-left:3px solid #334155; }
    .item.open { border-left-color:#38bdf8; }
    .item.fact { border-left-color:#34d399; }
    .item.weak { border-left-color:#f59e0b; }
    .item.empty { border-left-color:#f59e0b; }
    .q { font-size:13px; line-height:1.45; color:#f1f5f9; margin-bottom:6px; word-break:break-word; }
    .q.none { color:#f59e0b; font-style:italic; }
    .meta { display:flex; flex-wrap:wrap; gap:5px; }
    .tag { font-size:11px; padding:2px 6px; border-radius:4px; background:#0f172a; color:#94a3b8;
           border:1px solid #334155; }
    .tag.t { color:#7dd3fc; } .tag.r { color:#fca5a5; } .tag.s { color:#38bdf8; border-color:#38bdf8; }
    .tag.f { color:#34d399; border-color:#34d399; }
    .opts { font-size:11px; color:#94a3b8; margin-top:5px; }
    .frame { font-size:11px; color:#64748b; padding:6px 2px 4px; text-transform:uppercase;
             letter-spacing:.04em; }
    .answer { margin-top:8px; }
    .answer textarea { width:100%; min-height:74px; font-family:inherit; font-size:12.5px; line-height:1.5;
                       background:#020617; color:#e2e8f0; border:1px solid #334155; border-radius:6px;
                       padding:8px; resize:vertical; }
    .answer textarea:focus { outline:none; border-color:#38bdf8; }
    .from { font-size:11px; color:#94a3b8; margin-top:6px; }
    .from b { color:#cbd5e1; font-weight:600; }
    .foot { display:flex; align-items:center; gap:6px; margin-top:6px; }
    .count { font-size:11px; color:#94a3b8; margin-right:auto; }
    .count.over { color:#fca5a5; font-weight:600; }
    .foot button { padding:5px 9px; font-size:11px; }
    .note { font-size:11.5px; color:#fbbf24; margin-top:7px; line-height:1.45; }
    .alts { margin-top:8px; display:none; }
    .alts.on { display:block; }
    .alt { padding:7px 9px; margin-top:6px; background:#0f172a; border:1px solid #334155;
           border-radius:6px; cursor:pointer; }
    .alt:hover { border-color:#38bdf8; }
    .alt b { display:block; font-size:11.5px; color:#e2e8f0; margin-bottom:3px; }
    .alt span { font-size:11px; color:#94a3b8; line-height:1.4; }
    .empty-state { padding:18px 14px; text-align:center; color:#94a3b8; font-size:12.5px; line-height:1.6; }
    .empty-state button { margin-top:10px; }
    .dump { width:100%; height:120px; font-family:monospace; font-size:11px; background:#020617;
            color:#94a3b8; border:1px solid #334155; border-radius:6px; padding:8px; }
  `;

  const say = (n, one, many) => `${n} ${n === 1 ? one : many || `${one}s`}`;

  function renderPanel(sheet) {
    document.getElementById(PANEL_ID)?.remove();

    const host = document.createElement('div');
    host.id = PANEL_ID;
    host.style.cssText = 'position:fixed;top:0;right:0;width:440px;height:100vh;z-index:2147483647;';
    const shadow = host.attachShadow({ mode: 'open' });

    const s = sheet.stats;
    const where = [sheet.context.role, sheet.context.company].filter(Boolean).join(' at ');

    shadow.innerHTML = `
      <style>${PANEL_CSS}</style>
      <div class="wrap">
        <header>
          <h1>Form Assistant</h1>
          <div class="who">
            ${sheet.hasBank
              ? `Answering as <b>${escapeHtml(sheet.candidate || 'your bank')}</b>${where ? ` &nbsp;·&nbsp; ${escapeHtml(where)}` : ''}`
              : 'No answer bank loaded'}
          </div>
          <div class="stats">
            <b>${s.questions}</b> ${s.questions === 1 ? 'question' : 'questions'} &nbsp;·&nbsp;
            <b>${s.answered}</b> answered &nbsp;·&nbsp;
            ${say(s.openEnded, 'open-ended')}
            ${s.needsReview ? `&nbsp;·&nbsp; <span class="warn">${s.needsReview} to check</span>` : ''}
            ${s.unlabelled ? `&nbsp;·&nbsp; <span class="warn">${s.unlabelled} unnamed</span>` : ''}
          </div>
        </header>
        <div class="bar">
          <button id="copyall">Copy all</button>
          <button id="save">Download</button>
          <button id="bank">Bank</button>
          <button id="close" class="close">✕</button>
        </div>
        <div class="list" id="list"></div>
      </div>
    `;

    const list = shadow.getElementById('list');

    if (!sheet.hasBank) {
      const box = document.createElement('div');
      box.className = 'empty-state';
      box.innerHTML = 'The questions below were read from this page.<br>Load your answer bank and they get answered.';
      const load = document.createElement('button');
      load.textContent = 'Load your answer bank';
      load.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'AGC_OPEN_OPTIONS' }));
      box.appendChild(load);
      list.appendChild(box);
    }

    sheet.frames.forEach((frame) => {
      if (sheet.frames.length > 1) {
        const h = document.createElement('div');
        h.className = 'frame';
        h.textContent = frame.isTop ? 'main page' : `iframe · ${String(frame.url).slice(0, 60)}`;
        list.appendChild(h);
      }
      frame.fields.forEach((field) => list.appendChild(renderField(field, frame, sheet)));
    });

    // ---- header actions ----
    const json = JSON.stringify(sheet, null, 2);

    shadow.getElementById('copyall').addEventListener('click', (e) => {
      copyText(shadow, formatSheetText(sheet), e.target, 'Copy all');
    });

    shadow.getElementById('save').addEventListener('click', () => {
      const hostname = location.hostname.replace(/^www\./, '');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `form-${hostname}-${stamp}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

    shadow.getElementById('bank').addEventListener('click', () =>
      chrome.runtime.sendMessage({ type: 'AGC_OPEN_OPTIONS' }));

    shadow.getElementById('close').addEventListener('click', () => host.remove());

    document.documentElement.appendChild(host);
    return shadow;
  }

  function renderField(field, frame, sheet) {
    const div = document.createElement('div');
    const cls = field.kind === 'fact' ? 'fact'
      : field.confidence === 'weak' ? 'weak'
      : field.kind === 'open' ? 'open'
      : !field.label ? 'empty' : '';
    div.className = `item ${cls}`.trim();

    const q = document.createElement('div');
    q.className = `q${field.label ? '' : ' none'}`;
    q.textContent = field.label || '(could not read a label for this field)';
    div.appendChild(q);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const tag = (text, klass) => {
      const el = document.createElement('span');
      el.className = `tag ${klass || ''}`.trim();
      el.textContent = text;
      meta.appendChild(el);
    };
    tag(field.type, 't');
    if (field.required) tag('required', 'r');
    if (field.kind === 'fact') tag('fact', 'f');
    else if (field.likelySubjective) tag('open-ended', 's');
    if (field.wordLimit) tag(`${field.wordLimit} words`);
    else if (field.maxLength) tag(`max ${field.maxLength}`);
    tag(field.labelSource);
    div.appendChild(meta);

    if (field.options && field.options.length) {
      const o = document.createElement('div');
      o.className = 'opts';
      o.textContent = `Options: ${field.options.slice(0, 8).join(' · ')}${field.options.length > 8 ? ` … +${field.options.length - 8}` : ''}`;
      div.appendChild(o);
    }

    if (field.answer) div.appendChild(renderAnswerBlock(field, frame, sheet));

    if (field.note) {
      const note = document.createElement('div');
      note.className = 'note';
      note.textContent = field.note;
      div.appendChild(note);
    }

    return div;
  }

  function renderAnswerBlock(field, frame, sheet) {
    const wrap = document.createElement('div');
    wrap.className = 'answer';

    const box = document.createElement('textarea');
    box.value = field.answer.text || '';
    box.rows = 3;
    if (field.kind === 'fact') box.style.minHeight = '38px';
    wrap.appendChild(box);

    const from = document.createElement('div');
    from.className = 'from';
    const why = (field.answer.why || []).slice(0, 3).join(', ');
    from.innerHTML = `from <b>${escapeHtml(field.answer.from.title)}</b>${why ? ` · ${escapeHtml(why)}` : ''}${
      field.answer.option ? ` · select <b>${escapeHtml(field.answer.option)}</b>` : ''}`;
    wrap.appendChild(from);

    const foot = document.createElement('div');
    foot.className = 'foot';

    const count = document.createElement('span');
    count.className = 'count';
    const limit = field.answer.limit;
    const update = () => {
      const n = box.value.trim().split(/\s+/).filter(Boolean).length;
      count.textContent = limit ? `${n} / ${limit} words` : `${n} words`;
      count.classList.toggle('over', !!limit && n > limit);
    };
    update();
    box.addEventListener('input', update);
    foot.appendChild(count);

    const copy = document.createElement('button');
    copy.textContent = 'Copy';
    copy.addEventListener('click', () => {
      copyText(wrap.getRootNode(), box.value, copy, 'Copy');
      learn(field, sheet);
    });
    foot.appendChild(copy);

    const insert = document.createElement('button');
    insert.textContent = 'Insert';
    insert.addEventListener('click', () => {
      insert.textContent = '…';
      chrome.runtime.sendMessage(
        {
          type: 'AGC_INSERT',
          frameId: frame.frameId,
          fieldId: field.id,
          text: box.value,
          option: field.answer.option,
        },
        (reply) => {
          insert.textContent = reply && reply.ok ? 'Inserted' : 'Could not';
          if (reply && !reply.ok) {
            const note = document.createElement('div');
            note.className = 'note';
            note.textContent = reply.error || 'The page would not take it.';
            wrap.appendChild(note);
          } else {
            learn(field, sheet);
          }
          setTimeout(() => { insert.textContent = 'Insert'; }, 1800);
        }
      );
    });
    foot.appendChild(insert);

    if (field.alternatives && field.alternatives.length) {
      const swap = document.createElement('button');
      swap.textContent = `Other (${field.alternatives.length})`;
      foot.appendChild(swap);

      const alts = document.createElement('div');
      alts.className = 'alts';
      field.alternatives.forEach((alt) => {
        const row = document.createElement('div');
        row.className = 'alt';
        const title = document.createElement('b');
        title.textContent = `${alt.title} · ${alt.words} words`;
        const preview = document.createElement('span');
        preview.textContent = `${alt.text.slice(0, 130)}${alt.text.length > 130 ? '…' : ''}`;
        row.append(title, preview);
        row.addEventListener('click', () => {
          box.value = alt.text;
          update();
          from.innerHTML = `from <b>${escapeHtml(alt.title)}</b> · you chose this`;
          alts.classList.remove('on');
          field.answer.from = { id: alt.id, title: alt.title, kind: 'story' };
          learn(field, sheet, alt.id);
        });
        alts.appendChild(row);
      });

      swap.addEventListener('click', () => alts.classList.toggle('on'));
      wrap.appendChild(foot);
      wrap.appendChild(alts);
      return wrap;
    }

    wrap.appendChild(foot);
    return wrap;
  }

  /**
   * Using an answer is the choice. There is no separate "remember this" button
   * because nobody would press it, and the next form asking the same question
   * should already know.
   */
  function learn(field, sheet, entryId) {
    const id = entryId || (field.answer && field.answer.from && field.answer.from.id);
    if (!id || String(id).startsWith('profile.')) return;
    chrome.runtime.sendMessage({
      type: 'AGC_LEARN',
      question: field.label,
      entryId: id,
      context: sheet.context,
    });
  }

  function copyText(root, text, button, restore) {
    const done = (label) => {
      button.textContent = label;
      setTimeout(() => { button.textContent = restore; }, 1800);
    };

    // Fall back to a selectable box: the clipboard API is blocked outright on
    // some sites, and does not exist at all on a page served over plain http,
    // which plenty of smaller employers' careers sites still are.
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.className = 'dump';
      ta.value = text;
      const list = root.getElementById ? root.getElementById('list') : null;
      (list || root).prepend(ta);
      ta.select();
      done('Select above');
    };

    try {
      const write = navigator.clipboard && navigator.clipboard.writeText(text);
      if (!write) return fallback();
      write.then(() => done('Copied'), fallback);
    } catch {
      fallback();
    }
  }

  function formatSheetText(sheet) {
    const lines = [];
    const { company, role } = sheet.context || {};
    lines.push(`APPLICATION ANSWERS${company ? ` - ${company}` : ''}${role ? ` - ${role}` : ''}`);
    lines.push(`${sheet.stats.answered} of ${sheet.stats.questions} questions answered`);
    for (const frame of sheet.frames) {
      for (const field of frame.fields) {
        if (field.kind === 'skip') continue;
        lines.push('', '-'.repeat(70), field.label || '(no label)');
        if (field.wordLimit) lines.push(`(limit ${field.wordLimit} words)`);
        lines.push('');
        if (field.answer) {
          if (field.answer.option) lines.push(`[select: ${field.answer.option}]`);
          lines.push(field.answer.text || '');
        } else {
          lines.push(field.note || '(nothing in the bank covers this yet)');
        }
      }
    }
    return lines.join('\n');
  }

  const escapeHtml = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // -------------------------------------------------------------------- run

  const isTop = window.top === window;
  const fields = collect(document);

  chrome.runtime.sendMessage({
    type: 'AGC_FRAME_RESULT',
    payload: { url: location.href, title: document.title, isTop, fields, page: describePage(document) },
  });

  if (isTop) {
    // Give the sub-frames a moment to report in, then ask for the whole sheet.
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'AGC_GET_SHEET' }, (sheet) => {
        if (!sheet) return;
        if (!sheet.frames.length) {
          sheet.frames = [{ url: location.href, title: document.title, isTop: true, frameId: 0, fields: [] }];
        }
        renderPanel(sheet);
      });
    }, 400);
  }
})();
