/**
 * Photograph the first-application celebration, which only ever fires once per
 * account and so cannot be reached by loading a route.
 *
 * It is triggered by a transition in localStorage — previous sent count 0, the
 * live count at 1 or more, and the "already celebrated" lock absent — so this
 * seeds exactly that and loads the dashboard.
 *
 * Shot on a SHORT phone as well as a normal one, because the bug it had was
 * being taller than the screen with no scroller: clipped at both ends, its own
 * button unreachable.
 *
 *   node scripts/_shoot_celebration.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = 'http://localhost:5173';
const OUT = path.join(ROOT, 'shots', 'mobile', 'pass');
const SIZES = [
  { name: 'phone-390x740', width: 390, height: 740 },
  { name: 'phone-360x640', width: 360, height: 640 },
  { name: 'desktop', width: 1280, height: 900 },
];

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

  for (const size of SIZES) {
    const ctx = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 1,
      isMobile: size.width <= 768, hasTouch: size.width <= 768,
    });
    await ctx.addInitScript(([k, s]) => {
      try {
        window.localStorage.setItem(k, s);
        window.localStorage.setItem('jobhub_report_seen', 'true');
        // The transition the modal watches for.
        window.localStorage.setItem('jobhub_sent_count_prev', '0');
        window.localStorage.removeItem('jobhub_first_application_celebrated');
      } catch { /* ignore */ }
    }, [`sb-${ref}-auth-token`, JSON.stringify(v.session)]);

    const p = await ctx.newPage();
    await p.goto(APP, { waitUntil: 'networkidle' }).catch(() => {});
    await p.waitForSelector('text=Your first application is out', { timeout: 30000 }).catch(() => {});
    await wait(1200);

    const fit = await p.evaluate(() => {
      const h = Array.from(document.querySelectorAll('h2')).find((e) => /first application is out/i.test(e.textContent || ''));
      const card = h?.closest('div[style*="border-radius"]');
      const cta = Array.from(document.querySelectorAll('button')).find((b) => /Send another/.test(b.textContent || ''));
      if (!card) return { shown: false };
      const r = card.getBoundingClientRect();
      const c = cta?.getBoundingClientRect();
      return {
        shown: true,
        cardTop: Math.round(r.top), cardBottom: Math.round(r.bottom), cardHeight: Math.round(r.height),
        ctaBottom: c ? Math.round(c.bottom) : null,
        viewport: window.innerHeight,
        clipped: r.top < 0 || r.bottom > window.innerHeight + 1,
        ctaReachable: c ? c.bottom <= window.innerHeight + 1 && c.top >= 0 : false,
      };
    });
    console.log(`${size.name.padEnd(15)} ${JSON.stringify(fit)}`);
    await p.screenshot({ path: path.join(OUT, `celebration-${size.name}.png`) });
    await ctx.close();
  }

  await browser.close();
  console.log(`→ ${path.relative(ROOT, OUT)}`);
};

run().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
