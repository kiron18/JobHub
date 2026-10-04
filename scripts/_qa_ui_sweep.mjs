// QA: every page, in a real browser, against the STAGING API.
// Four people: signed out, a brand-new account, a member with real data, and
// Kiron (admin). Two widths. Records crashes, console errors, failed API calls,
// blank screens, error screens and sideways scroll, plus a screenshot of each.
// Read-only: it opens pages and never clicks anything.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const APP = 'http://localhost:5173';
const OUT = process.argv[2];
const SHOTS = path.join(OUT, 'ui');
fs.mkdirSync(SHOTS, { recursive: true });

const readEnv = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/)
  .filter(l => l && !l.startsWith('#') && l.includes('='))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const fe = readEnv('.env.local');
const be = readEnv('server/.env.local');
const SUPA = fe.VITE_SUPABASE_URL, ANON = fe.VITE_SUPABASE_ANON_KEY, SERVICE = be.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA.includes('eijnehebvhapmeudfjtj')) throw new Error('refusing: Supabase is not the staging project');
const ref = new URL(SUPA).hostname.split('.')[0];

const admin = createClient(SUPA, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
async function session(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw new Error(`generateLink ${email}: ${error.message}`);
  const anon = createClient(SUPA, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  let { data: v, error: e2 } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'email' });
  if (e2) ({ data: v, error: e2 } = await anon.auth.verifyOtp({ email, token: data.properties.email_otp, type: 'email' }));
  if (e2) throw new Error(`verifyOtp ${email}: ${e2.message}`);
  return v.session;
}

const PUBLIC = ['/', '/auth', '/set-password', '/welcome', '/pricing', '/legal/privacy', '/legal', '/visa-sponsors',
  '/book-a-call', '/session', '/webinar', '/register', '/claim', '/the-receipts',
  '/free/resume', '/free/all', '/free/not-a-real-slug', '/report/demo',
  '/classroom', '/classroom/walkthrough', '/classroom/resume', '/classroom/primer', '/classroom/not-a-module',
  '/styleguide', '/dev/trial-preview', '/dev/engagement-preview', '/dev/engagement-dashboard', '/dev/interview-prep-redesign'];
const PROTECTED = ['/tracker', '/check', '/interview-prep', '/workspace', '/documents', '/email-templates', '/linkedin',
  '/leaderboard', '/resources', '/answer-bank', '/mindset', '/local-experience-playbook', '/video-cover-letter'];
const DASH = ['/', ...PROTECTED, '/linkedin?tab=outreach', '/visa-sponsors', '/jobs', '/apply', '/some-unknown-page'];
const ADMIN = ['/admin', '/admin/coach', '/admin/funnel', '/admin/sales', '/admin/workshop', '/admin/quality',
  '/admin/users', '/admin/friday-brief', '/admin/contacts', '/admin/broadcasts', '/admin/email-analytics'];

const PLAN = [
  ...PUBLIC.map(u => ({ who: 'anon', url: u })),
  ...PROTECTED.map(u => ({ who: 'anon', url: u })),
  ...['/', '/tracker', '/resources', '/classroom', '/video-cover-letter'].map(u => ({ who: 'fresh', url: u })),
  ...DASH.map(u => ({ who: 'member', url: u })),
  ...ADMIN.map(u => ({ who: 'admin', url: u })),
];

const sessions = {
  fresh: await session('qa-fresh@jobhub-test.local'),
  member: await session('dev-test@jobhub.local'),
  admin: await session('kiron182@gmail.com'),
};
const browser = await chromium.launch();
const results = [];

for (const [vpName, vp] of [['desk', { width: 1366, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const ctxs = {};
  for (const who of ['anon', 'fresh', 'member', 'admin']) {
    const ctx = await browser.newContext({ viewport: vp, ...(vpName === 'phone' ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    if (sessions[who]) {
      await ctx.addInitScript(([k, v]) => {
        try { localStorage.setItem(k, v); localStorage.setItem('jobhub_report_seen', 'true'); } catch {}
      }, [`sb-${ref}-auth-token`, JSON.stringify(sessions[who])]);
    }
    ctxs[who] = ctx;
  }

  for (const step of PLAN) {
    const page = await ctxs[step.who].newPage();
    const r = { vp: vpName, who: step.who, url: step.url, pageErrors: [], consoleErrors: [], failed: [] };
    page.on('pageerror', e => r.pageErrors.push(e.message.slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') r.consoleErrors.push(m.text().slice(0, 200)); });
    page.on('response', res => {
      const u = res.url();
      if (u.includes('/api/') && res.status() >= 400) r.failed.push(`${res.status()} ${res.request().method()} ${u.replace(/^https?:\/\/[^/]+/, '')}`);
    });
    const hang = setTimeout(() => { r.navError = 'hung >70s'; page.close().catch(() => {}); }, 70000);
    try {
      await page.goto(APP + step.url, { waitUntil: 'load', timeout: 45000 });
      const t0 = Date.now();
      for (let i = 0; i < 40; i++) {
        if (await page.evaluate(() => (document.body.innerText || '').trim().length > 40)) break;
        await page.waitForTimeout(500);
      }
      r.readyMs = Date.now() - t0;
      await page.waitForTimeout(2500);
      r.finalUrl = page.url().replace(APP, '');
      Object.assign(r, await page.evaluate(() => ({
        text: (document.body.innerText || '').trim().length,
        boundary: /something went wrong|unexpected error|failed to load/i.test(document.body.innerText || ''),
        overflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      })));
      r.shot = `${vpName}-${step.who}-${step.url.replace(/[^a-z0-9]+/gi, '_') || 'root'}.png`;
      await page.screenshot({ path: path.join(SHOTS, r.shot) });
    } catch (e) {
      r.navError = e.message.slice(0, 200);
    }
    clearTimeout(hang);
    results.push(r);
    await page.close().catch(() => {});
    process.stdout.write('.');
  }
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'ui-results.json'), JSON.stringify(results, null, 2));

const notable = (f) => !/^401 /.test(f);
const flag = results.filter(r => r.navError || r.pageErrors.length || r.boundary || r.text < 40 || r.overflowX > 0
  || r.failed.some(notable) || r.consoleErrors.length);
console.log(`\n${results.length} page loads. Flagged: ${flag.length}`);
for (const r of flag) {
  const why = [
    r.navError && `nav: ${r.navError}`,
    r.pageErrors.length && `crash: ${r.pageErrors[0]}`,
    r.boundary && 'error screen',
    r.text < 40 && `blank (${r.text} chars)`,
    r.overflowX > 0 && `sideways +${r.overflowX}px`,
    r.failed.some(notable) && `api: ${[...new Set(r.failed.filter(notable))].slice(0, 3).join(' | ')}`,
    r.consoleErrors.length && `console: ${r.consoleErrors[0]}`,
  ].filter(Boolean).join(' ; ');
  console.log(`  ${r.vp} ${r.who.padEnd(6)} ${r.url} -> ${r.finalUrl ?? '?'} :: ${why}`);
}
