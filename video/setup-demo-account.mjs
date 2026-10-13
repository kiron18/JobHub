/**
 * Builds the demo account once: walks the real front door with Maya's resume
 * (so her profile is made by the same code a real person's is), then claims the
 * result onto the demo login.
 *
 *   node video/setup-demo-account.mjs
 *
 * Needs `npm run dev` and the server on :3002. Costs real model calls.
 * Safe to re-run: it replaces the resume on the same account.
 *
 * A new account is on the free plan, where "Write my resume" is gated. Once,
 * after the first run, give it member access (staging only):
 *   cd server && cp ../video/lib/grant-demo-access.ts _g.ts && npx tsx _g.ts && rm _g.ts
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { APP, API, DEMO_EMAIL, demoSession } from './lib/demo.mjs';
import { blockAnalytics } from './lib/recorder.mjs';

const CV = path.join(import.meta.dirname, 'assets', 'Maya_Fernando_Resume_Strong.pdf');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await blockAnalytics(ctx);
const p = await ctx.newPage();

let token = null;
p.on('response', async (r) => {
  if (r.url().includes('/welcome/brief') && r.ok()) token = (await r.json().catch(() => ({}))).token ?? token;
});

await p.goto(`${APP}/`, { waitUntil: 'networkidle' }).catch(() => {});
await p.setInputFiles('input[type=file]', CV);
await p.waitForSelector('text=/What roles are you targeting|losing interviews|Your biggest gap/i', { timeout: 240000 });
await wait(1500);

// Decline the questions: the strong resume already carries the numbers they ask for.
if (!await p.locator('text=What roles are you targeting').isVisible().catch(() => false)) {
  await p.getByRole('button', { name: /fix all of this/i }).click({ timeout: 10000 }).catch(() => {});
  for (let i = 0; i < 15; i++) {
    const skip = p.getByRole('button', { name: /^skip this one$/i }).first();
    if (!(await skip.isVisible().catch(() => false))) break;
    await skip.click({ timeout: 5000 }).catch(() => {});
    await wait(400);
  }
  await p.getByRole('button', { name: /fix all of this|rebuild it anyway/i }).click({ timeout: 8000 }).catch(() => {});
  await p.waitForSelector('text=What roles are you targeting', { timeout: 90000 });
}
await wait(1000);
await p.getByRole('button', { name: /build my resume/i }).click({ timeout: 15000 });
// The desktop resume screen. (.agc-scaled-page is the phone layout only.)
await p.waitForSelector('text=/new and improved resume/i', { timeout: 300000 });
await wait(2000);
await browser.close();
if (!token) throw new Error('never saw a welcome session token');

const session = await demoSession();
const res = await fetch(`${API}/welcome/finish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
  body: JSON.stringify({ token, targetRoles: ['Marketing Coordinator'], targetCity: 'Melbourne' }),
});
console.log('finish:', res.status, (await res.text()).slice(0, 300));
console.log('demo account:', DEMO_EMAIL);
