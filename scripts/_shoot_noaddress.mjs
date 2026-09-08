/**
 * The outreach card when contact discovery finds nobody.
 *
 * That is the outcome for roughly two employers in three, and it is the one
 * that used to render as a hole: the address a successful lookup shows above
 * the subject line was simply absent, so "we found no one" and "you missed it"
 * looked identical. This forces the empty case deterministically by stubbing
 * the lookup, rather than hunting for an employer that happens to fail.
 */
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = 'http://localhost:5173';
const OUT = path.join(ROOT, 'shots', 'mobile', 'pass');

const readEnv = (f) => Object.fromEntries(
  fs.readFileSync(path.join(ROOT, f), 'utf8')
    .split(/\r?\n/).filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const feEnv = readEnv('.env.local');
const beEnv = readEnv(path.join('server', '.env'));
const SUPA_URL = feEnv.VITE_SUPABASE_URL || beEnv.SUPABASE_URL;
const ANON = feEnv.VITE_SUPABASE_ANON_KEY;
const SERVICE = beEnv.SUPABASE_SERVICE_ROLE_KEY;

const SEED = JSON.stringify({
  jobDescription: 'Marketing & Bid Coordinator — Brisbane, QLD\nGrowth Workplace Design\n\nCoordinate bid and tender submissions end to end. Own the content calendar across LinkedIn and EDM. 2+ years writing bids or proposals.',
  company: 'Growth Workplace Design',
  role: 'Marketing & Bid Coordinator',
  location: 'Brisbane, QLD',
  sc: false,
});

/** Set to null to photograph the other failure: no domain at all. */
const DOMAIN = process.env.CAPTURE_DOMAIN === 'none' ? null : (process.env.CAPTURE_DOMAIN || 'bcec.com.au');
/** Set CAPTURE_ADDRESS to photograph the state where a send is one tap. */
const ADDRESS = process.env.CAPTURE_ADDRESS || null;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const admin = createClient(SUPA_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'kiron182@gmail.com' });
  const anon = createClient(SUPA_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: v } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' });
  const ref = new URL(SUPA_URL).hostname.split('.')[0];

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([k, s, seed]) => {
    try {
      window.localStorage.setItem(k, s);
      window.localStorage.setItem('jobhub_report_seen', 'true');
      window.sessionStorage.setItem('apply:context', seed);
    } catch { /* ignore */ }
  }, [`sb-${ref}-auth-token`, JSON.stringify(v.session), SEED]);

  const p = await ctx.newPage();
  // The whole point: a lookup that succeeds and finds nobody.
  await p.route('**/research/company', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      source: 'search', domain: DOMAIN,
      slots: ADDRESS
        ? { talent: { name: 'Growth Workplace Design enquiries', email: ADDRESS, position: null, department: null, verification: null, why: ['A shared inbox at this employer, not a person.'] }, hiringManager: null, teamInsider: null }
        : { talent: null, hiringManager: null, teamInsider: null },
      rejected: [], candidates: [], hiringManager: null, hiringManagerTitle: null,
      salutation: 'Dear Hiring Manager', highlights: [], companySize: null,
    }),
  }));

  await p.goto(`${APP}/apply`, { waitUntil: 'networkidle' }).catch(() => {});
  for (let i = 0; i < 2; i++) {
    await p.waitForSelector('text=/Download (resume|cover letter)/i', { timeout: 240000 }).catch(() => {});
    await wait(3000);
    await p.getByRole('button', { name: /continue|next|cover letter|track/i }).last().click({ timeout: 15000 }).catch(() => {});
    await wait(4000);
  }
  await p.waitForSelector('text=/you have applied/i', { timeout: 120000 }).catch(() => {});
  await wait(5000);

  const seen = await p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
      .filter((b) => /follow-up|LinkedIn note|Draft the email/i.test(b.textContent || ''))
      .map((b) => ({ label: b.textContent.trim(), primary: getComputedStyle(b).borderStyle === 'none' }));
    const links = Array.from(document.querySelectorAll('a'))
      .filter((a) => /Find someone|Look up/i.test(a.textContent || ''))
      .map((a) => a.textContent.trim());
    return { buttons: btns, links };
  });
  console.log('card:', JSON.stringify(seen, null, 1));

  for (let n = 0; n < 5; n++) {
    await p.screenshot({ path: path.join(OUT, `noaddress-${n}.png`) });
    const more = await p.evaluate(() => {
      const el = Array.from(document.querySelectorAll('div, main')).find((e) => e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 400);
      if (!el) return false;
      const b = el.scrollTop; el.scrollTop = b + el.clientHeight - 60; return el.scrollTop > b;
    });
    if (!more) break;
    await wait(500);
  }
  await browser.close();
  console.log(`→ ${path.relative(ROOT, OUT)}`);
};
run().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
