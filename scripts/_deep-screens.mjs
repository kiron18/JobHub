/**
 * The phone screens mobile-sweep.mjs cannot reach, and the gesture it cannot test.
 *
 * The sweep visits a route and photographs whatever renders. That covers most
 * of the product and misses the parts that only exist AFTER something happens:
 *
 *   the rebuilt resume   four steps and two model calls behind /welcome
 *   the fit report       needs an ad checked against a profile
 *   the apply documents  needs a generation, and lives inside a scroll
 *                        container the sweep's fullPage capture cannot see
 *   the outreach drafts  three steps deeper still
 *   the loupe            a press-and-hold, which no screenshot can exercise
 *
 * So this drives them. It costs real model calls, so it is not part of the
 * sweep and is not run on every change — run it when something on those screens
 * moves.
 *
 *   node scripts/_deep-screens.mjs              both journeys
 *   node scripts/_deep-screens.mjs welcome      signed out: upload → resume
 *   node scripts/_deep-screens.mjs apply        signed in: fit → docs → outreach
 *
 * Output lands in shots/mobile/pass, which is gitignored with the rest.
 */
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = 'http://localhost:5173';
const EMAIL = process.env.CAPTURE_EMAIL || 'kiron182@gmail.com';
const OUT = path.join(ROOT, 'shots', 'mobile', 'pass');
const CV = process.env.CAPTURE_CV || path.join(ROOT, 'Resumes', 'ALEENA SAJU CV.pdf');

const which = process.argv[2] || 'both';

/** 390x740, not the sweep's 844: the shortest phone anything here has to fit. */
const PHONE = { viewport: { width: 390, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

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

const AD = [
  'Marketing & Bid Coordinator — Brisbane, QLD',
  'Growth Workplace Design',
  '',
  'Coordinate bid and tender submissions end to end. Write and edit proposal',
  'content against client criteria. Own the content calendar across LinkedIn',
  'and EDM. Support campaign delivery with designers and consultants.',
  '',
  '2+ years writing bids, tenders or proposals. A degree in Marketing,',
  'Communications or similar. Strong written communication.',
].join('\n');

const SEED = JSON.stringify({
  jobDescription: AD,
  company: 'Growth Workplace Design',
  role: 'Marketing & Bid Coordinator',
  location: 'Brisbane, QLD',
  sc: false,
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

async function mintSession() {
  const admin = createClient(SUPA_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL });
  if (error) throw new Error(`generateLink failed: ${error.message}`);
  const anon = createClient(SUPA_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: v, error: vErr } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' });
  if (vErr) throw new Error(`verifyOtp failed: ${vErr.message}`);
  return v.session;
}

/**
 * Scroll the app's own scroll container, not the document.
 *
 * The shell keeps body at overflow:hidden and scrolls an inner element, so
 * both window.scrollBy and Playwright's fullPage capture see a page one
 * viewport tall no matter how long it really is.
 */
const scrollInner = (page, by) => page.evaluate((amount) => {
  const el = Array.from(document.querySelectorAll('div, main'))
    .find((e) => e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 400);
  if (!el) return false;
  const before = el.scrollTop;
  el.scrollTop = before + (amount ?? el.clientHeight - 60);
  return el.scrollTop > before;
}, by);

/* -- Signed out: the front door through to the rebuilt resume -------------- */

async function welcomeJourney(browser) {
  if (!fs.existsSync(CV)) throw new Error(`no CV at ${CV} — set CAPTURE_CV`);
  const ctx = await browser.newContext(PHONE);
  const p = await ctx.newPage();

  await p.goto(`${APP}/welcome`, { waitUntil: 'networkidle' }).catch(() => {});
  await wait(2000);
  await shot(p, 'welcome-front-door');

  // The front door's one job on a phone is fitting on it: the whole card above
  // the fold, and the log-in chip clear of the card rather than on its corner.
  const fold = await p.evaluate(() => {
    const card = document.querySelector('input[type=file]')?.closest('div[style*="border-radius"]');
    const login = Array.from(document.querySelectorAll('a')).find((a) => a.textContent.trim() === 'Log in');
    return {
      cardTop: card ? Math.round(card.getBoundingClientRect().top) : null,
      cardBottom: card ? Math.round(card.getBoundingClientRect().bottom) : null,
      loginBottom: login ? Math.round(login.getBoundingClientRect().bottom) : null,
      viewport: window.innerHeight,
      docHeight: Math.round(document.documentElement.scrollHeight),
    };
  });
  console.log('front door:', JSON.stringify(fold), fold.cardBottom <= fold.viewport ? '(fits)' : '(BELOW THE FOLD)');

  await p.setInputFiles('input[type=file]', CV);
  await p.waitForSelector('text=/What roles are you targeting|losing interviews|Your biggest gap/i', { timeout: 240000 });
  await wait(2500);
  await shot(p, 'welcome-diagnosis');

  /*
    Past the diagnosis screen by declining its questions rather than answering
    them. This is photographing layout, not testing the intake, and declining
    is a door a real candidate in a hurry takes anyway.
  */
  if (!await p.locator('text=What roles are you targeting').isVisible().catch(() => false)) {
    await p.getByRole('button', { name: /fix all of this/i }).click({ timeout: 10000 }).catch(() => {});
    for (let i = 0; i < 15; i++) {
      const skip = p.getByRole('button', { name: /^skip this one$/i }).first();
      if (!(await skip.isVisible().catch(() => false))) break;
      await skip.click({ timeout: 5000 }).catch(() => {});
      await wait(400);
    }
    // With every question dealt with, the same button carries on to the roles
    // box instead of reopening the list.
    await p.getByRole('button', { name: /fix all of this|rebuild it anyway/i }).click({ timeout: 8000 }).catch(() => {});
    await p.waitForSelector('text=What roles are you targeting', { timeout: 90000 }).catch(() => {});
  }
  await wait(1500);
  console.log('seeded target role:', JSON.stringify(await p.locator('input').first().inputValue().catch(() => '')));
  await shot(p, 'welcome-roles');

  await p.getByRole('button', { name: /build my resume/i }).click({ timeout: 15000 }).catch(() => {});
  await p.waitForSelector('.agc-scaled-page', { timeout: 300000 });
  await wait(3000);
  await shot(p, 'welcome-resume');
  console.log('rebuilt resume:', JSON.stringify(await describePage(p)));

  await ctx.close();
}

/** What the scaled document actually rendered as. */
const describePage = (page) => page.evaluate(() => {
  const frame = document.querySelector('.agc-scaled-page');
  const paper = frame?.firstElementChild;
  const r = frame?.getBoundingClientRect();
  return {
    frame: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
    paperNaturalWidth: paper ? paper.offsetWidth : null,
    hint: Array.from(document.querySelectorAll('p')).some((e) => /press and hold/i.test(e.textContent || '')),
  };
});

/* -- Signed in: fit report, documents, the loupe, the drafts --------------- */

async function applyJourney(browser) {
  const session = await mintSession();
  const ref = new URL(SUPA_URL).hostname.split('.')[0];
  const ctx = await browser.newContext(PHONE);
  await ctx.addInitScript(([k, s, seed]) => {
    try {
      window.localStorage.setItem(k, s);
      window.localStorage.setItem('jobhub_report_seen', 'true');
      window.sessionStorage.setItem('apply:context', seed);
    } catch { /* ignore */ }
  }, [`sb-${ref}-auth-token`, JSON.stringify(session), SEED]);

  // -- The fit report ------------------------------------------------------
  const c = await ctx.newPage();
  await c.goto(`${APP}/check`, { waitUntil: 'networkidle' }).catch(() => {});
  await wait(3000);
  await c.getByRole('button', { name: /dismiss/i }).click({ timeout: 2000 }).catch(() => {});
  await c.locator('textarea').first().fill(AD);
  await c.getByRole('button', { name: /find out/i }).click({ timeout: 5000 }).catch(() => {});
  await c.waitForSelector('text=/Worth applying|Not this one/', { timeout: 120000 }).catch(() => {});
  await wait(1500);
  await shot(c, 'fit-report');
  console.log('fit report captured');
  await c.close();

  // -- The document, and the loupe over it ---------------------------------
  const p = await ctx.newPage();
  await p.goto(`${APP}/apply`, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForSelector('.agc-scaled-page', { timeout: 240000 });
  await wait(3000);
  console.log('tailored resume:', JSON.stringify(await describePage(p)));

  // CDP dispatches at VIEWPORT coordinates, so a target below the fold reaches
  // no element at all and the gesture silently does nothing.
  await p.evaluate(() => document.querySelector('.agc-scaled-page')?.scrollIntoView({ block: 'center' }));
  await wait(1200);
  await shot(p, 'apply-document');

  const box = await p.locator('.agc-scaled-page').first().boundingBox();
  const cdp = await ctx.newCDPSession(p);
  const x = Math.round(box.x + box.width / 2);
  const touch = (type, px, py) => cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py, radiusX: 10, radiusY: 10, force: 1 }],
  });
  const readLens = () => p.evaluate(() => {
    const el = document.querySelector('div[aria-hidden][style*="position: fixed"]');
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    return {
      found: true, visible: getComputedStyle(el).visibility,
      top: Math.round(r.top), h: Math.round(r.height),
      textInside: (el.textContent || '').trim().slice(0, 40),
    };
  });

  // Room above the finger: the lens must float clear of the thumb.
  const y = Math.round(Math.min(box.y + box.height - 40, 560));
  await touch('touchStart', x, y);
  await wait(320);                      // past the hold threshold
  await touch('touchMove', x, y + 40);  // and drag
  await wait(220);
  const lens = await readLens();
  console.log('loupe, room above:', JSON.stringify(lens));
  console.log('  gap above finger:', y + 40 - (lens.top + lens.h), 'px (want ~70)');
  await shot(p, 'loupe');
  await touch('touchEnd', x, y + 40);
  await wait(300);

  // No room above: it must flip below rather than clip off the viewport.
  const yTop = Math.round(Math.max(box.y + 10, 150));
  await touch('touchStart', x, yTop);
  await wait(320);
  await touch('touchMove', x, yTop + 5);
  await wait(220);
  const flipped = await readLens();
  console.log('loupe, no room above:', JSON.stringify(flipped));
  console.log('  lens top vs finger:', flipped.top - (yTop + 5), 'px (positive = flipped, not clipped)');
  await shot(p, 'loupe-flipped');
  await touch('touchEnd', x, yTop + 5);
  await wait(300);
  console.log('after release:', await p.evaluate(() => {
    const el = document.querySelector('div[aria-hidden][style*="position: fixed"]');
    return el ? getComputedStyle(el).visibility : 'gone';
  }));

  // A short press that never moved is a tap, and a tap opens the reader.
  await touch('touchStart', x, y);
  await wait(80);
  await touch('touchEnd', x, y);
  await wait(600);
  console.log('tap → reader:', await p.evaluate(() => {
    const el = document.querySelector('div[role="dialog"][aria-modal="true"]');
    return el ? (el.getAttribute('aria-label') || 'open') : 'NOT OPEN';
  }));
  await shot(p, 'reader');
  await p.keyboard.press('Escape');
  await wait(600);

  // -- On to the outreach drafts -------------------------------------------
  // The rail only lets you past a step once that step has a draft, so the
  // drafts are two more generations deep. Walk it.
  for (let i = 0; i < 2; i++) {
    await p.waitForSelector('text=/Download (resume|cover letter)/i', { timeout: 240000 }).catch(() => {});
    await wait(3000);
    await p.getByRole('button', { name: /continue|next|cover letter|track/i }).last().click({ timeout: 15000 }).catch(() => {});
    await wait(4000);
  }
  await p.waitForSelector('text=/you have applied/i', { timeout: 120000 }).catch(() => {});
  await wait(6000);
  for (let n = 0; n < 6; n++) {
    await shot(p, `outreach-${n}`);
    if (!await scrollInner(p)) break;
    await wait(600);
  }
  console.log('outreach captured');

  await ctx.close();
}

const run = async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  if (which === 'both' || which === 'welcome') await welcomeJourney(browser);
  if (which === 'both' || which === 'apply') await applyJourney(browser);
  await browser.close();
  console.log(`→ ${path.relative(ROOT, OUT)}`);
};

run().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
