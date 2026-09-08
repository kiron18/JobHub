/**
 * Mobile sweep — visit every route at phone size and report what is broken.
 *
 * Screenshots are the easy half. The useful half is the audit: for each page it
 * measures the things that are objectively wrong on a phone and can be checked
 * without an opinion —
 *
 *   overflowX     the page can be dragged sideways, and WHICH elements stick out
 *   tinyTaps      interactive controls smaller than 44px
 *   tinyText      body text under 12px
 *   zoomInputs    form controls under 16px, which make iOS zoom the page in
 *   clipped       text sitting in a box shorter than the text itself
 *   narrow        paragraphs wrapping at fewer than 38 characters a line
 *
 * Run:  node scripts/mobile-sweep.mjs [--tag before] [--only 11-apply]
 */
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = 'http://localhost:5173';
const EMAIL = process.env.CAPTURE_EMAIL || 'kiron182@gmail.com';

const args = process.argv.slice(2);
const argOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const TAG = argOf('--tag') || 'now';
const ONLY = argOf('--only');
const WIDTH = Number(argOf('--width') || 390);
const TALL = args.includes('--tall');
/** Extra settle time, for screens that generate their content on arrival. */
const EXTRA_WAIT = Number(argOf('--wait') || 0);

const OUT = path.join(ROOT, 'shots', 'mobile', TAG);

const readEnv = (f) => Object.fromEntries(
  fs.readFileSync(path.join(ROOT, f), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const feEnv = readEnv('.env.local');
const beEnv = readEnv(path.join('server', '.env'));
const SUPA_URL = feEnv.VITE_SUPABASE_URL || beEnv.SUPABASE_URL;
const ANON = feEnv.VITE_SUPABASE_ANON_KEY;
const SERVICE = beEnv.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Every surface, in the order a person meets them. `auth: false` pages are
 * captured signed out, in a fresh context, because that is the only state in
 * which they render what they are for.
 */
const PAGES = [
  // ── public ──
  { id: '00-landing',         url: '/',                         auth: false },
  { id: '01-auth',            url: '/auth',                     auth: false },
  { id: '02-set-password',    url: '/set-password',             auth: false },
  { id: '03-pricing',         url: '/pricing',                  auth: false },
  { id: '04-legal',           url: '/legal/privacy',            auth: false },
  { id: '05-visa-sponsors',   url: '/visa-sponsors',            auth: false },
  { id: '06-book-a-call',     url: '/book-a-call',              auth: false },
  { id: '07-session-signup',  url: '/session',                  auth: false },
  { id: '08-claim',           url: '/claim',                    auth: false },
  { id: '10-receipts',        url: '/the-receipts',             auth: false },
  { id: '11-free-resource',   url: '/free/resume',              auth: false },
  { id: '12-gap-report',      url: '/report/demo',              auth: false },

  // ── dashboard ──
  { id: '20-dashboard',       url: '/' },
  { id: '21-check',           url: '/check' },
  { id: '22-apply',           url: '/apply', seed: true },
  { id: '23-tracker',         url: '/tracker' },
  { id: '24-interview-index', url: '/interview-prep' },
  { id: '25-workspace',       url: '/workspace' },
  { id: '26-documents',       url: '/documents' },
  { id: '27-email-templates', url: '/email-templates' },
  { id: '28-linkedin',        url: '/linkedin' },
  { id: '29-linkedin-out',    url: '/linkedin?tab=outreach' },
  { id: '30-leaderboard',     url: '/leaderboard' },
  { id: '31-resources',       url: '/resources' },
  { id: '32-answer-bank',     url: '/answer-bank' },
  { id: '33-mindset',         url: '/mindset' },
  { id: '34-local-exp',       url: '/local-experience-playbook' },
  { id: '35-visa-in-app',     url: '/visa-sponsors' },
  /*
    The diagnostic is a STAGE of the dashboard route, not a URL — the sidebar
    reaches it by firing an event. Without this it never gets photographed, and
    it is the first full screen a new client sees.
  */
  { id: '36-diagnostic',      url: '/', act: 'diagnostic' },

  // ── admin (light pass) ──
  { id: '40-admin',           url: '/admin' },
  { id: '41-admin-coach',     url: '/admin/coach' },
  { id: '42-admin-funnel',    url: '/admin/funnel' },
  { id: '43-admin-sales',     url: '/admin/sales' },
  { id: '44-admin-workshop',  url: '/admin/workshop' },
  { id: '45-admin-quality',   url: '/admin/quality' },
  { id: '46-admin-users',     url: '/admin/users' },
  { id: '47-admin-brief',     url: '/admin/friday-brief' },
  { id: '48-admin-contacts',  url: '/admin/contacts' },
  { id: '49-admin-broadcast', url: '/admin/broadcasts' },
  { id: '50-admin-email',     url: '/admin/email-analytics' },
];

/**
 * /apply reads its job from router state, falling back to sessionStorage, and
 * renders nothing at all without one. Seeding a real ad is the only way to
 * photograph the screen people actually use.
 */
const APPLY_SEED = JSON.stringify({
  jobDescription: [
    'Marketing Coordinator — Sydney, NSW',
    '',
    'About the role',
    'We are looking for a Marketing Coordinator to join our growing team. You',
    'will coordinate campaigns end to end, from competitor research and content',
    'calendars through to social media delivery across multiple channels.',
    '',
    'Key responsibilities',
    '- Plan and deliver integrated multi-channel campaigns',
    '- Own the content calendar across LinkedIn, Instagram and EDM',
    '- Report on campaign performance and recommend improvements',
    '- Work with designers, agencies and internal stakeholders',
    '',
    'What you will bring',
    '- A degree in Marketing, Communications or similar',
    '- 1-2 years of experience in a marketing or agency environment',
    '- Strong written communication and attention to detail',
    '- Familiarity with Google Analytics, Meta Business Suite and Canva',
    '',
    'Australian working rights required. This is a full-time, permanent role.',
  ].join('\n'),
  company: 'Brightline Media',
  role: 'Marketing Coordinator',
  location: 'Sydney, NSW',
  sc: false,
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function mintSession() {
  const admin = createClient(SUPA_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL });
  if (error) throw new Error(`generateLink failed: ${error.message}`);
  const tokenHash = data.properties?.hashed_token;
  const anon = createClient(SUPA_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: v, error: vErr } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  if (vErr) throw new Error(`verifyOtp failed: ${vErr.message}`);
  return v.session;
}

/** Runs in the page. Everything it returns is a fact about the rendered DOM. */
const AUDIT = (vw) => {
  const out = { overflowX: 0, offenders: [], tinyTaps: [], tinyText: [], zoomInputs: [], clipped: [], nested: [], hoverOnly: [], narrow: [] };
  const de = document.documentElement;
  out.overflowX = Math.max(0, Math.round(de.scrollWidth - vw));

  const label = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className
      ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
      : '';
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${id}${cls}${txt ? ` "${txt}"` : ''}`;
  };

  // Anything that scrolls sideways INSIDE the page. The dashboard shell puts
  // its scroll on <main>, so a page that overflows within it leaves
  // documentElement.scrollWidth untouched and looks clean from the outside.
  out.innerOverflow = [];
  for (const el of document.querySelectorAll('body *')) {
    const over = el.scrollWidth - el.clientWidth;
    if (over > 2 && el.clientWidth > 100) {
      const cs = getComputedStyle(el);
      const scrolls = ['auto', 'scroll'].includes(cs.overflowX);
      // A deliberate `.scroll-x` rail is fine, and so is the clipped frame
      // DocumentPaper draws: it holds an A4 page at its true 794px width and
      // scales it down with a transform, so the child really is wider than the
      // box and the box really cannot be dragged. Anything else is the page
      // being wider than the phone.
      const deliberate = el.classList.contains('scroll-x') || el.classList.contains('agc-scaled-page');
      if (!deliberate && out.innerOverflow.length < 10) {
        out.innerOverflow.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} +${Math.round(over)}px${scrolls ? ' (scrolls)' : ''}`);
      }
    }
  }

  // A button inside a button (or a link inside a link) is invalid HTML, and
  // browsers disagree about which one a tap belongs to. On touch the outer one
  // usually wins, so the inner control silently does the wrong thing.
  for (const el of document.querySelectorAll('button button, a a, button a, a button')) {
    if (out.nested.length < 8) out.nested.push(label(el));
  }

  // Anything only reachable by hovering. A phone cannot hover, so these are
  // controls that exist on the page and cannot be operated.
  for (const el of document.querySelectorAll('button, a, [role="button"]')) {
    const cs = getComputedStyle(el);
    const hidden = parseFloat(cs.opacity) < 0.05 || cs.visibility === 'hidden';
    if (!hidden) continue;
    // Only count it if an ancestor is on screen — an offscreen menu is fine.
    const host = el.closest('[class*="group"], div');
    if (host && host.getBoundingClientRect().width > 0 && out.hoverOnly.length < 8) {
      out.hoverOnly.push(label(el));
    }
  }

  const all = Array.from(document.querySelectorAll('body *'));
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;

    // Sticks out past the right edge, and is not inside something that scrolls
    // horizontally on purpose.
    if (out.overflowX > 0 && r.right > vw + 1) {
      let scrollParent = false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.overflowX === 'auto' || ps.overflowX === 'scroll' || ps.overflowX === 'hidden') { scrollParent = true; break; }
      }
      if (!scrollParent && out.offenders.length < 12) {
        out.offenders.push(`${label(el)} → right:${Math.round(r.right)}`);
      }
    }

    const tag = el.tagName.toLowerCase();
    const interactive = tag === 'button' || tag === 'a' || tag === 'select'
      || el.getAttribute('role') === 'button' || (tag === 'input' && ['checkbox', 'radio', 'submit', 'button'].includes(el.type));
    const hitAreaExpanded = el.classList.contains('tap-target');
    if (interactive && !hitAreaExpanded && r.width > 0 && (r.height < 40 || r.width < 28) && out.tinyTaps.length < 12) {
      // Ignore links inside a run of prose — those are read, not aimed at.
      const inProse = el.closest('p, li, td');
      if (!inProse) out.tinyTaps.push(`${label(el)} → ${Math.round(r.width)}x${Math.round(r.height)}`);
    }

    if (['input', 'textarea', 'select'].includes(tag)
        && !['checkbox', 'radio', 'range', 'hidden'].includes(el.type)) {
      const fs = parseFloat(cs.fontSize);
      if (fs < 16 && out.zoomInputs.length < 10) out.zoomInputs.push(`${label(el)} → ${fs}px`);
    }

    // Body text under 12px. Only leaf nodes with real text.
    if (el.children.length === 0 && (el.textContent || '').trim().length > 12) {
      const fs = parseFloat(cs.fontSize);
      // 11px is the design system's smallest step ("micro"), and it is used
      // deliberately. Anything BELOW it is off the scale and unreadable on a
      // phone held at arm's length.
      if (fs < 11 && out.tinyText.length < 10) out.tinyText.push(`${label(el)} → ${fs}px`);
    }

    /*
      Paragraphs wrapping three or four words to a line.

      The complaint this measures is "the product looks text-heavy on a phone",
      and the cause is almost never the font size: it is nesting. A page gutter
      plus a card plus a panel inside the card spends over a quarter of a 390px
      screen on whitespace before a word is set, and what is left wraps at
      under 30 characters.

      Measured rather than eyeballed. A Range over the node reports one client
      rect per LINE BOX, so text length divided by rect count is the real
      average characters a line — no assumptions about font metrics, and it
      counts what the browser actually did.

      Only multi-line running text: a heading, a button label or a one-line
      caption is short because it is short, not because the column is narrow.
    */
    if (el.children.length === 0 && out.narrow.length < 12) {
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
      const isRunningText = /^(P|LI|SPAN|DIV|TD|BLOCKQUOTE)$/.test(el.tagName);
      if (isRunningText && text.length >= 90) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const lines = Array.from(range.getClientRects()).filter((r) => r.height > 1 && r.width > 1).length;
        range.detach?.();
        // Two lines is not a column, it is a sentence that happened to wrap.
        if (lines >= 3) {
          const perLine = Math.round(text.length / lines);
          if (perLine < 38) out.narrow.push(`${label(el)} → ${perLine} chars/line over ${lines} lines`);
        }
      }
    }

    // Text taller than the box holding it, with the overflow hidden.
    // A -webkit-line-clamp box clips on purpose; that is the whole point of it.
    const clampedOnPurpose = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
    if (!clampedOnPurpose && el.children.length === 0 && el.scrollHeight > el.clientHeight + 4 && cs.overflowY === 'hidden' && out.clipped.length < 10) {
      out.clipped.push(`${label(el)} → ${el.scrollHeight}>${el.clientHeight}`);
    }
  }
  return out;
};

const run = async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const session = await mintSession();
  const ref = new URL(SUPA_URL).hostname.split('.')[0];
  const storageKey = `sb-${ref}-auth-token`;

  const browser = await chromium.launch();
  const viewport = { width: WIDTH, height: 844 };
  const common = { viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

  const authCtx = await browser.newContext(common);
  await authCtx.addInitScript(
    ([k, v]) => { try { window.localStorage.setItem(k, v); window.localStorage.setItem('jobhub_report_seen', 'true'); } catch {} },
    [storageKey, JSON.stringify(session)]
  );
  const anonCtx = await browser.newContext(common);

  const report = [];
  const list = ONLY ? PAGES.filter((p) => p.id.includes(ONLY)) : PAGES;

  for (const p of list) {
    const ctx = p.auth === false ? anonCtx : authCtx;
    const page = await ctx.newPage();
    if (p.seed) {
      await page.addInitScript(
        (v) => { try { window.sessionStorage.setItem('apply:context', v); } catch {} },
        APPLY_SEED
      );
    }
    let landed = p.url;
    try {
      await page.goto(APP + p.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    } catch { /* capture whatever rendered */ }
    await wait(1800 + EXTRA_WAIT);
    await page.evaluate(() => {
      document.querySelectorAll('[data-sonner-toast]').forEach((n) => n.remove());
    }).catch(() => {});

    if (p.act === 'diagnostic') {
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('show-diagnostic'))).catch(() => {});
      await wait(1800);
    }

    try { landed = new URL(page.url()).pathname + new URL(page.url()).search; } catch {}

    let audit = null;
    try { audit = await page.evaluate(AUDIT, WIDTH); } catch (e) { audit = { error: String(e).slice(0, 120) }; }
    try { await page.screenshot({ path: path.join(OUT, `${p.id}.png`), fullPage: false }); } catch {}

    /*
      The whole page, not just the first screen.

      The dashboard shell is a fixed-height flex row whose <main> owns the
      scroll, so Playwright's fullPage only ever returns the viewport. Releasing
      the height constraints lets the document grow to its real length. The
      release has to stay vertical: freeing overflow outright lets the flex row
      expand sideways and the capture comes back 3000px wide.
    */
    if (TALL) {
      let unlock = null;
      try {
        unlock = await page.addStyleTag({
          content: `
            html, body { height: auto !important; width: ${WIDTH}px !important;
                         overflow-y: visible !important; overflow-x: hidden !important; }
            #root { height: auto !important; }
            main { overflow-y: visible !important; height: auto !important; }
            [style*="dvh"], [style*="100vh"] { height: auto !important; max-height: none !important; }
          `,
        });
        await wait(700);
        await page.screenshot({ path: path.join(OUT, `${p.id}-tall.png`), fullPage: true });
      } catch {}
      if (unlock) await unlock.evaluate((el) => el.remove()).catch(() => {});
    }

    const flags = [];
    if (audit?.overflowX > 0) flags.push(`OVERFLOW +${audit.overflowX}px`);
    if (audit?.innerOverflow?.length) flags.push(`inner-overflow ${audit.innerOverflow.length}`);
    if (audit?.zoomInputs?.length) flags.push(`zoom-inputs ${audit.zoomInputs.length}`);
    if (audit?.tinyTaps?.length) flags.push(`tiny-taps ${audit.tinyTaps.length}`);
    if (audit?.tinyText?.length) flags.push(`tiny-text ${audit.tinyText.length}`);
    if (audit?.clipped?.length) flags.push(`clipped ${audit.clipped.length}`);
    if (audit?.narrow?.length) flags.push(`narrow ${audit.narrow.length}`);
    if (audit?.nested?.length) flags.push(`NESTED-BTN ${audit.nested.length}`);
    if (audit?.hoverOnly?.length) flags.push(`HOVER-ONLY ${audit.hoverOnly.length}`);
    console.log(`${p.id.padEnd(20)} ${landed.padEnd(34)} ${flags.join('  ') || 'clean'}`);

    report.push({ ...p, landed, audit });
    await page.close();
  }

  fs.writeFileSync(path.join(OUT, '_report.json'), JSON.stringify(report, null, 2));
  await browser.close();

  const bad = report.filter((r) => r.audit?.overflowX > 0);
  console.log(`\n${bad.length} of ${report.length} pages scroll sideways.`);
  const cramped = report.filter((r) => r.audit?.narrow?.length);
  const crampedTotal = cramped.reduce((n, r) => n + r.audit.narrow.length, 0);
  console.log(`${crampedTotal} paragraphs under 38 chars/line, across ${cramped.length} pages.`);
  console.log(`shots + _report.json → ${path.relative(ROOT, OUT)}`);
};

run().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
