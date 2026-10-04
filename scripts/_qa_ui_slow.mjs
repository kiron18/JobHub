// QA: how long signed-in pages take to get past the spinner, and which calls hold them up.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const APP = 'http://localhost:5173';
const OUT = process.argv[2];
const readEnv = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/)
  .filter(l => l && !l.startsWith('#') && l.includes('='))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const fe = readEnv('.env.local'), be = readEnv('server/.env.local');
const SUPA = fe.VITE_SUPABASE_URL, ANON = fe.VITE_SUPABASE_ANON_KEY, SERVICE = be.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA.includes('eijnehebvhapmeudfjtj')) throw new Error('not staging');
const ref = new URL(SUPA).hostname.split('.')[0];
const admin = createClient(SUPA, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
async function session(email) {
  const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const anon = createClient(SUPA, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  let { data: v, error } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'email' });
  if (error) ({ data: v, error } = await anon.auth.verifyOtp({ email, token: data.properties.email_otp, type: 'email' }));
  if (error) throw error;
  return v.session;
}

const PLAN = [['fresh', '/'], ['fresh', '/tracker'], ['fresh', '/resources']];
const emails = { member: 'dev-test@jobhub.local', fresh: 'qa-fresh@jobhub-test.local', admin: 'kiron182@gmail.com' };
const browser = await chromium.launch();
for (const [who, url] of PLAN) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const s = await session(emails[who]);
  await ctx.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('jobhub_report_seen', 'true'); },
    [`sb-${ref}-auth-token`, JSON.stringify(s)]);
  const page = await ctx.newPage();
  const calls = new Map();
  page.on('request', q => { if (q.url().includes('/api/')) calls.set(q, { url: q.url().split('/api')[1], t0: Date.now() }); });
  page.on('requestfinished', async q => { const c = calls.get(q); if (c) { c.ms = Date.now() - c.t0; c.status = (await q.response())?.status(); } });
  page.on('requestfailed', q => { const c = calls.get(q); if (c) { c.ms = Date.now() - c.t0; c.status = 'FAILED ' + q.failure()?.errorText; } });
  const t0 = Date.now();
  await page.goto(APP + url, { waitUntil: 'load' });
  let ready = null;
  for (let i = 0; i < 80; i++) {
    const n = await page.evaluate(() => (document.body.innerText || '').trim().length);
    if (n > 40) { ready = Date.now() - t0; break; }
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(OUT, `slow-${who}-${url.replace(/\W+/g, '_')}.png`) });
  console.log(`\n${who} ${url}: ${ready ? `content after ${ready}ms` : 'STILL SPINNING after 40s'} -> ${page.url().replace(APP, '')}`);
  for (const c of [...calls.values()].sort((a, b) => (b.ms ?? 99999) - (a.ms ?? 99999)).slice(0, 6))
    console.log(`   ${String(c.ms ?? 'pending').padStart(7)}ms ${c.status ?? ''} ${c.url}`);
  await ctx.close();
}
await browser.close();
