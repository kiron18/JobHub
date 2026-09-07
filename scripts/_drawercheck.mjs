/** Throwaway: does the phone drawer actually open, navigate and close? */
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import fs from 'node:fs';

const readEnv = (f) => Object.fromEntries(
  fs.readFileSync(f, 'utf8').split(/\r?\n/)
    .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));

const fe = readEnv('.env.local'), be = readEnv('server/.env');
const U = fe.VITE_SUPABASE_URL || be.SUPABASE_URL, A = fe.VITE_SUPABASE_ANON_KEY, S = be.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(U, S, { auth: { autoRefreshToken: false, persistSession: false } });
const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'kiron182@gmail.com' });
const anon = createClient(U, A, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: v } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' });
const key = `sb-${new URL(U).hostname.split('.')[0]}-auth-token`;

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await c.addInitScript(([k, val]) => { try { localStorage.setItem(k, val); localStorage.setItem('jobhub_report_seen', 'true'); } catch {} }, [key, JSON.stringify(v.session)]);
const p = await c.newPage();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const step = async (name, fn) => {
  try { const r = await fn(); console.log(`${r ? 'PASS' : 'FAIL'}  ${name}${r && r !== true ? ` (${r})` : ''}`); }
  catch (e) { console.log(`FAIL  ${name} — ${String(e).slice(0, 90)}`); }
};

await p.goto('http://localhost:5173/tracker', { waitUntil: 'networkidle' });
await wait(2000);

await step('drawer is closed on arrival', async () =>
  (await p.locator('[role="dialog"][aria-label="Navigation"]').count()) === 0);

await step('hamburger opens the drawer', async () => {
  await p.locator('button[aria-label="Open navigation"]').tap();
  await wait(500);
  return (await p.locator('[role="dialog"][aria-label="Navigation"]').isVisible());
});

await step('page behind the drawer is frozen', async () =>
  (await p.evaluate(() => document.body.style.overflow)) === 'hidden');

await step('tapping a nav item navigates and closes', async () => {
  await p.locator('[role="dialog"] a:has-text("Your profile")').tap();
  await wait(900);
  const path = new URL(p.url()).pathname;
  const gone = (await p.locator('[role="dialog"][aria-label="Navigation"]').count()) === 0;
  return gone && path === '/workspace' ? path : false;
});

await step('scroll lock is released after close', async () =>
  (await p.evaluate(() => document.body.style.overflow)) !== 'hidden');

// /workspace auto-opens its explainer modal over the top bar. Go somewhere
// without one before testing the remaining drawer behaviour.
await p.goto('http://localhost:5173/tracker', { waitUntil: 'networkidle' });
await wait(1500);

await step('back button does not resurrect the drawer', async () => {
  await p.locator('button[aria-label="Open navigation"]').tap();
  await wait(400);
  await p.goBack();
  await wait(1200);
  return (await p.locator('[role="dialog"][aria-label="Navigation"]').count()) === 0;
});

await step('escape closes the drawer', async () => {
  await p.locator('button[aria-label="Open navigation"]').tap();
  await wait(400);
  await p.keyboard.press('Escape');
  await wait(500);
  return (await p.locator('[role="dialog"][aria-label="Navigation"]').count()) === 0;
});

await step('scrim closes the drawer', async () => {
  await p.locator('button[aria-label="Open navigation"]').tap();
  await wait(400);
  await p.mouse.click(360, 700);
  await wait(500);
  return (await p.locator('[role="dialog"][aria-label="Navigation"]').count()) === 0;
});

await b.close();
