/**
 * Measure the dashboard's browse/check button pair across viewport widths.
 *
 * The sweep checks 390 and 360. A layout can be clean at both and broken at
 * 520 or 790 — a phone in landscape, a split-screen tablet, a narrowed desktop
 * window — and the sweep would never see it.
 *
 * It also measures the button against the LONGEST label the label rule can
 * produce rather than whatever this account happens to have, because a button
 * with white-space:nowrap on it is only as safe as its worst string.
 *
 *   node scripts/_widthcheck.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = 'http://localhost:5173';
const OUT = path.join(ROOT, 'shots', 'mobile', 'pass');
const WIDTHS = [320, 360, 390, 430, 520, 620, 700, 767, 769, 790, 820, 1024];

/** 24 characters, the cap in lib/roleLabel, so this is the widest legal label. */
const WORST_LABEL = 'Browse marketing communications jobs';

const readEnv = (f) => Object.fromEntries(
  fs.readFileSync(path.join(ROOT, f), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const feEnv = readEnv('.env.local');
const beEnv = readEnv(path.join('server', '.env'));
const SUPA_URL = feEnv.VITE_SUPABASE_URL || beEnv.SUPABASE_URL;
const ANON = feEnv.VITE_SUPABASE_ANON_KEY;
const SERVICE = beEnv.SUPABASE_SERVICE_ROLE_KEY;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const admin = createClient(SUPA_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email: process.env.CAPTURE_EMAIL || 'kiron182@gmail.com' });
  const anon = createClient(SUPA_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: v } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' });
  const ref = new URL(SUPA_URL).hostname.split('.')[0];

  const browser = await chromium.launch();

  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: 780 }, deviceScaleFactor: 1,
      isMobile: width <= 768, hasTouch: width <= 768,
    });
    await ctx.addInitScript(([k, s]) => {
      try {
        window.localStorage.setItem(k, s);
        window.localStorage.setItem('jobhub_report_seen', 'true');
      } catch { /* ignore */ }
    }, [`sb-${ref}-auth-token`, JSON.stringify(v.session)]);

    const p = await ctx.newPage();
    await p.goto(APP, { waitUntil: 'networkidle' }).catch(() => {});
    await wait(3500);
    await p.getByRole('button', { name: /dismiss/i }).click({ timeout: 1500 }).catch(() => {});
    await wait(500);

    const m = await p.evaluate((worst) => {
      const browse = Array.from(document.querySelectorAll('a')).find((a) => /^Browse .* jobs$/.test(a.textContent.trim()));
      const check = Array.from(document.querySelectorAll('button')).find((b) => /Check eligibility|Reading the ad/.test(b.textContent));
      if (!browse) return null;
      const row = browse.parentElement;
      const card = row?.parentElement;
      const rect = (e) => e ? { l: Math.round(e.getBoundingClientRect().left), r: Math.round(e.getBoundingClientRect().right), w: Math.round(e.getBoundingClientRect().width) } : null;

      const before = { browse: rect(browse), check: rect(check), row: rect(row), card: rect(card) };

      // Swap in the worst legal label and re-measure. The <a> holds the text
      // plus an icon span, so only the text node is replaced.
      const textNode = Array.from(browse.childNodes).find((n) => n.nodeType === 3 && n.textContent.trim().length > 3);
      const original = textNode?.textContent;
      if (textNode) textNode.textContent = worst;
      const after = { browse: rect(browse), check: rect(check), row: rect(row), card: rect(card) };
      if (textNode) textNode.textContent = original;

      return { before, after, docOverflow: Math.round(document.documentElement.scrollWidth - window.innerWidth) };
    }, WORST_LABEL);

    if (!m) { console.log(`${String(width).padStart(4)}  (button not found)`); await ctx.close(); continue; }

    const spill = (s) => s.card && s.browse
      ? Math.max(s.browse.r - s.card.r, s.check ? s.check.r - s.card.r : 0)
      : null;
    const now = spill(m.before);
    const worst = spill(m.after);
    console.log(
      `${String(width).padStart(4)}  card ${m.before.card.l}-${m.before.card.r}` +
      `  this-account spill ${String(now).padStart(4)}px` +
      `  worst-label spill ${String(worst).padStart(4)}px  (w${m.after.browse.w})` +
      `${worst > 1 ? '   <<< OVERFLOWS' : ''}`
    );
    await ctx.close();
  }

  await browser.close();
};

run().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
