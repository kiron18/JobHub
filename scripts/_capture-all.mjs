/**
 * Log in as Kiron via the Supabase admin API, then screenshot every page in
 * mobile view. Run from the JobHub repo root.
 */
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = 'http://localhost:5173';
const EMAIL = process.env.CAPTURE_EMAIL || 'kiron182@gmail.com';
const OUT = path.join(ROOT, 'marketing', 'mobile');
const TALL = path.join(ROOT, 'marketing', 'mobile-tall');

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

if (!SUPA_URL || !ANON || !SERVICE) {
  console.error('Missing Supabase config:', {
    url: !!SUPA_URL, anon: !!ANON, service: !!SERVICE,
  });
  process.exit(1);
}

const PAGES = [
  // public
  { id: '00-landing',        url: '/' },
  { id: '01-welcome',        url: '/welcome' },
  { id: '02-session-signup', url: '/session' },
  { id: '03-receipts',       url: '/the-receipts' },
  { id: '04-visa-sponsors',  url: '/visa-sponsors' },
  { id: '05-book-a-call',    url: '/book-a-call' },
  // protected
  { id: '10-dashboard',      url: '/' },
  { id: '11-apply',          url: '/apply' },
  { id: '12-tracker',        url: '/tracker' },
  { id: '13-documents',      url: '/documents' },
  { id: '14-email-templates',url: '/email-templates' },
  { id: '15-linkedin',       url: '/linkedin' },
  { id: '16-leaderboard',    url: '/leaderboard' },
  { id: '17-mindset',        url: '/mindset' },
  { id: '18-local-exp',      url: '/local-experience-playbook' },
  { id: '19-skipped',        url: '/skipped' },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function mintSession() {
  const admin = createClient(SUPA_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL });
  if (error) throw new Error(`generateLink failed: ${error.message}`);
  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) throw new Error('no hashed_token returned');

  const anon = createClient(SUPA_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: v, error: vErr } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  if (vErr) throw new Error(`verifyOtp failed: ${vErr.message}`);
  console.log(`session minted for ${v.user?.email}`);
  return v.session;
}

const run = async () => {
  const session = await mintSession();
  const ref = new URL(SUPA_URL).hostname.split('.')[0];
  const storageKey = `sb-${ref}-auth-token`;

  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(TALL, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(
    ([key, value]) => { try { window.localStorage.setItem(key, value); } catch {} },
    [storageKey, JSON.stringify(session)]
  );

  const page = await ctx.newPage();
  const results = [];

  for (const p of PAGES) {
    process.stdout.write(`${p.id.padEnd(20)} ${p.url.padEnd(30)}`);
    try {
      await page.goto(APP + p.url, { waitUntil: 'networkidle', timeout: 40000 });
    } catch { /* capture whatever rendered */ }
    await wait(2500);

    // Dismiss coach-marks / toasts so the UI photographs clean.
    await page.evaluate(() => {
      const hit = (el) => { try { el.click(); } catch {} };
      document.querySelectorAll('[aria-label*="lose" i],[aria-label*="ismiss" i],button[title*="lose" i]')
        .forEach(hit);
      document.querySelectorAll('[data-sonner-toast],[role="status"]').forEach((n) => n.remove());
    }).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    await wait(600);

    const landed = new URL(page.url()).pathname;
    await page.screenshot({ path: path.join(OUT, `${p.id}.png`) });

    // DashboardLayout is `h-screen overflow-hidden` with an `overflow-y-auto`
    // <main>, so fullPage would only ever return the viewport. Release those
    // constraints for the tall capture, then put them back.
    // Public pages scroll <body> and already capture correctly with fullPage.
    // Only the dashboard shell needs unlocking, and the release has to stay
    // vertical — freeing overflow outright lets the flex row expand sideways
    // and the capture comes out 3000px wide.
    const needsUnlock = true; // width is pinned in the CSS, so this is safe everywhere
    let unlock = null;
    if (needsUnlock) {
      unlock = await page.addStyleTag({
        content: `
          html, body { height: auto !important; width: 390px !important;
                       overflow-y: visible !important; overflow-x: hidden !important; }
          .h-screen { height: auto !important; }
          .w-screen { width: 390px !important; max-width: 390px !important; }
          .overflow-hidden { overflow-y: visible !important; overflow-x: hidden !important; }
          main { overflow-y: visible !important; height: auto !important; }
        `,
      });
      await wait(700);
    }
    await page.screenshot({ path: path.join(TALL, `${p.id}.png`), fullPage: true });
    if (unlock) await unlock.evaluate((el) => el.remove()).catch(() => {});

    const h = await page.evaluate(() => document.body.scrollHeight).catch(() => 0);
    console.log(` → ${landed}  (h=${h})`);
    results.push({ ...p, landed, h });
  }

  await browser.close();
  console.log('\n--- redirected away (not logged in / no route) ---');
  results.filter((r) => r.landed !== r.url).forEach((r) => console.log(`  ${r.id}: ${r.url} → ${r.landed}`));
};

run().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
