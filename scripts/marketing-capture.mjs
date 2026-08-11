#!/usr/bin/env node
/**
 * Marketing capture — JobHub UI → vertical (9:16) frames for Instagram/Reels.
 *
 * Attaches to a Chrome you have already logged into (over CDP), so every shot
 * uses your real account and real data. Nothing is typed into the app unless a
 * shot defines an `act`, and no credentials are handled by this script.
 *
 * ── Setup (once per session) ────────────────────────────────────────────────
 *   1. npm run dev            (in repo root)   → frontend on :5173
 *   2. cd server && npm run dev                → backend  on :3002
 *   3. Launch a debuggable Chrome and make sure you are logged into JobHub:
 *        node scripts/marketing-capture.mjs --chrome-default
 *          → reuses your normal Chrome profile, so you are already logged in.
 *            Close every other Chrome window first or Chrome ignores the flag.
 *        node scripts/marketing-capture.mjs --chrome
 *          → clean isolated profile; you will have to log in via email OTP.
 *      Leave the window open, on any page. Auto mode navigates on its own.
 *
 * ── Capture ─────────────────────────────────────────────────────────────────
 *   node scripts/marketing-capture.mjs            # auto — walks every route
 *   node scripts/marketing-capture.mjs --manual   # you drive, Enter to shoot
 *   node scripts/marketing-capture.mjs --compose  # re-render verticals only
 *
 * Output:
 *   marketing/raw/       2880x1800 desktop captures (the master files)
 *   marketing/vertical/  1080x1920 — full UI in frame, room for text above
 *   marketing/punch/     1080x1920 — punched in on the action
 */

import { chromium } from 'playwright';
import sharp from 'sharp';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

const APP = process.env.CAPTURE_APP_URL || 'http://localhost:5173';
const CDP = 'http://localhost:9222';
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = {
  raw: path.join(ROOT, 'marketing', 'raw'),
  vertical: path.join(ROOT, 'marketing', 'vertical'),
  punch: path.join(ROOT, 'marketing', 'punch'),
};

// Desktop capture size. 1440x900 at 2x = 2880x1800 — enough resolution to punch
// in 2x inside a 1080-wide vertical frame without softening.
const VIEW = { width: 1440, height: 900, scale: 2 };

// Mobile capture size. iPhone 14 Pro at 3x = 1170x2532 — already 9:16, so these
// need no compositing at all, just a resize down to 1080x1920. The app's
// responsive layout fills the frame, which is why text stays readable on a phone
// where a shrunken desktop screenshot does not.
const MOBILE = { width: 390, height: 844, scale: 3 };

// Vertical frame. The UI card sits low so the top ~520px stays free for a hook
// caption added in the editor — that's the layout that performs on Reels.
const FRAME = { w: 1080, h: 1920, cardW: 1000, cardY: 560, radius: 28 };
const BG = '#0B0F16'; // matches the app's dark shell

/**
 * The flow, in the order it should be told on camera.
 *
 * url      — route to land on
 * act      — optional async (page) => {} to reach an interaction state
 * settle   — ms to wait after arriving (animations, data fetch)
 * punch    — crop region of the 2880x1800 master, as fractions of w/h
 */
const SHOTS = [
  { id: '01-dashboard',        url: '/',            label: 'The dashboard',              punch: [0.10, 0.05, 0.80, 0.55] },
  { id: '02-paste-job',        url: '/apply',       label: 'Paste the job ad',           punch: [0.10, 0.10, 0.80, 0.55] },
  { id: '03-generating',       url: '/apply',       label: 'Generating',                 punch: [0.20, 0.20, 0.60, 0.40] },
  { id: '04-resume',           url: '/apply',       label: 'Tailored resume',            punch: [0.25, 0.05, 0.65, 0.70] },
  { id: '05-cover-letter',     url: '/apply',       label: 'Cover letter',               punch: [0.25, 0.05, 0.65, 0.70] },
  { id: '06-criteria-paste',   url: '/apply',       label: 'Paste selection criteria',   punch: [0.15, 0.10, 0.70, 0.55] },
  { id: '07-criteria-done',    url: '/apply',       label: 'Criteria answered',          punch: [0.25, 0.05, 0.65, 0.70] },
  { id: '08-documents',        url: '/documents',   label: 'Document library',           punch: [0.08, 0.08, 0.84, 0.55] },
  { id: '09-tracker',          url: '/tracker',     label: 'Application tracker',        punch: [0.08, 0.08, 0.84, 0.55] },
  { id: '10-followup',         url: '/tracker',     label: 'Follow-up, ready to copy',   punch: [0.20, 0.15, 0.60, 0.55] },
  { id: '11-email-templates',  url: '/email-templates', label: 'Email templates',        punch: [0.08, 0.08, 0.84, 0.55] },
  { id: '12-linkedin',         url: '/linkedin',    label: 'LinkedIn optimisation',      punch: [0.10, 0.05, 0.80, 0.60] },
  { id: '13-outreach',         url: '/linkedin',    label: 'Outreach messages',          punch: [0.20, 0.10, 0.62, 0.60] },
  { id: '14-leaderboard',      url: '/leaderboard', label: 'Streak + metrics',           punch: [0.10, 0.05, 0.80, 0.55] },
  { id: '15-interview',        url: '/',            label: 'Interview prep',             punch: [0.15, 0.08, 0.72, 0.60] },
  { id: '16-visa-sponsors',    url: '/visa-sponsors', label: 'Visa sponsor list',        punch: [0.08, 0.08, 0.84, 0.55] },
  { id: '17-mindset',          url: '/mindset',     label: 'Mindset',                    punch: [0.10, 0.05, 0.80, 0.55] },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * `useDefault` reuses your everyday Chrome profile, so you are already logged
 * into JobHub. Chrome refuses remote debugging on a profile that is already
 * running, so every Chrome window must be closed first.
 */
async function launchChrome(useDefault = false) {
  const profile = useDefault
    ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data')
    : path.join(ROOT, '.capture-profile');
  if (!useDefault) await fs.mkdir(profile, { recursive: true });
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
  ];
  let exe = null;
  for (const c of candidates) {
    try { await fs.access(c); exe = c; break; } catch { /* keep looking */ }
  }
  if (!exe) {
    console.error('Chrome not found. Set CHROME_PATH and re-run.');
    process.exit(1);
  }
  console.log('Opening Chrome with remote debugging on :9222');
  console.log('→ Log into JobHub in that window, then leave it open and run the capture.');
  spawn(exe, [
    '--remote-debugging-port=9222',
    `--user-data-dir=${profile}`,
    '--window-size=1500,1000',
    '--hide-crash-restore-bubble',
    APP,
  ], { detached: true, stdio: 'ignore' }).unref();
}

async function connect(device = VIEW) {
  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP);
  } catch {
    console.error(`\nNo debuggable Chrome on ${CDP}.`);
    console.error('Run:  node scripts/marketing-capture.mjs --chrome   then log in.\n');
    process.exit(1);
  }
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => !p.url().startsWith('devtools://')) || (await ctx.newPage());
  // connectOverCDP can't resize via setViewportSize, so drive the emulation
  // layer directly — this is what gives us 2880x1800 masters.
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: device.width, height: device.height,
    deviceScaleFactor: device.scale, mobile: device === MOBILE,
  });
  return { browser, page, cdp };
}

/**
 * Mobile pass — the one that feeds the motion-graphics build.
 *
 * Each screen yields two files:
 *   vertical/<id>.png   the viewport, resized to exactly 1080x1920
 *   tall/<id>.png       the FULL scrollable page as one tall image
 *
 * The tall version is what makes scrolling recreatable in Remotion: instead of
 * filming a scroll, animate the image's y-offset behind a 1080x1920 window.
 */
async function runMobile(ids = null) {
  const { browser, page } = await connect(MOBILE);
  const tallDir = path.join(ROOT, 'marketing', 'tall');
  await fs.mkdir(OUT.raw, { recursive: true });
  await fs.mkdir(OUT.vertical, { recursive: true });
  await fs.mkdir(tallDir, { recursive: true });

  const list = ids ? SHOTS.filter((s) => ids.includes(s.id)) : SHOTS;
  for (const shot of list) {
    console.log(`\n${shot.id} — ${shot.label}`);
    try {
      await page.goto(APP + shot.url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch {
      console.log('  (networkidle timed out — capturing anyway)');
    }
    await wait(shot.settle ?? 1500);
    if (shot.act) {
      try { await shot.act(page); } catch (e) { console.log(`  act failed: ${e.message}`); }
    }

    const viewBuf = await page.screenshot();
    await sharp(viewBuf)
      .resize(FRAME.w, FRAME.h, { fit: 'fill' })
      .png()
      .toFile(path.join(OUT.vertical, `${shot.id}.png`));

    const tallBuf = await page.screenshot({ fullPage: true });
    const tallMeta = await sharp(tallBuf).metadata();
    await sharp(tallBuf)
      .resize({ width: FRAME.w })
      .png()
      .toFile(path.join(tallDir, `${shot.id}.png`));

    await fs.writeFile(path.join(OUT.raw, `${shot.id}.png`), viewBuf);
    console.log(`  vertical 1080x1920 + tall ${FRAME.w}x${Math.round(tallMeta.height * FRAME.w / tallMeta.width)}`);
  }
  await browser.close();
  console.log('\nDone. marketing/vertical (frames) + marketing/tall (scrollable)');
}

async function shoot(page, id) {
  await fs.mkdir(OUT.raw, { recursive: true });
  const file = path.join(OUT.raw, `${id}.png`);
  await page.screenshot({ path: file });
  console.log(`  captured  ${id}.png`);
  return file;
}

/** Rounded-corner mask + drop shadow, composited onto the vertical canvas. */
async function card(buf, width, radius) {
  const img = sharp(buf).resize({ width });
  const { width: w, height: h } = await img.toBuffer({ resolveWithObject: true })
    .then(({ info }) => info);
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
  );
  return {
    buf: await img.composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer(),
    w, h,
  };
}

async function compose(rawFile, shot) {
  const buf = await fs.readFile(rawFile);
  const meta = await sharp(buf).metadata();

  // ── full frame: whole UI, sitting low, headroom for a hook caption ────────
  const full = await card(buf, FRAME.cardW, FRAME.radius);
  await fs.mkdir(OUT.vertical, { recursive: true });
  await sharp({
    create: { width: FRAME.w, height: FRAME.h, channels: 4, background: BG },
  })
    .composite([{ input: full.buf, left: Math.round((FRAME.w - full.w) / 2), top: FRAME.cardY }])
    .png()
    .toFile(path.join(OUT.vertical, `${shot.id}.png`));

  // ── punch frame: cropped to the action, scaled to fill more of the frame ──
  const [fx, fy, fw, fh] = shot.punch || [0.1, 0.05, 0.8, 0.6];
  const crop = {
    left: Math.round(meta.width * fx),
    top: Math.round(meta.height * fy),
    width: Math.round(meta.width * fw),
    height: Math.round(meta.height * fh),
  };
  const cropped = await sharp(buf).extract(crop).png().toBuffer();
  const punched = await card(cropped, FRAME.w - 80, FRAME.radius);
  await fs.mkdir(OUT.punch, { recursive: true });
  await sharp({
    create: { width: FRAME.w, height: FRAME.h, channels: 4, background: BG },
  })
    .composite([{
      input: punched.buf,
      left: 40,
      top: Math.round((FRAME.h - punched.h) / 2),
    }])
    .png()
    .toFile(path.join(OUT.punch, `${shot.id}.png`));

  console.log(`  composed  ${shot.id}  (vertical + punch)`);
}

async function runAuto() {
  const { browser, page } = await connect();
  for (const shot of SHOTS) {
    console.log(`\n${shot.id} — ${shot.label}`);
    try {
      await page.goto(APP + shot.url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch {
      console.log('  (networkidle timed out — capturing anyway)');
    }
    await wait(shot.settle ?? 1500);
    if (shot.act) {
      try { await shot.act(page); } catch (e) { console.log(`  act failed: ${e.message}`); }
    }
    const raw = await shoot(page, shot.id);
    await compose(raw, shot);
  }
  await browser.close();
  console.log(`\nDone. Verticals in marketing/vertical + marketing/punch`);
}

/** You click through the app; press Enter to capture whatever is on screen. */
async function runManual() {
  const { browser, page } = await connect();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, r));

  console.log('\nManual mode. Drive the app in Chrome.');
  console.log('Enter a shot name then hit Enter to capture. Blank name quits.\n');

  for (;;) {
    const id = (await ask('shot name > ')).trim();
    if (!id) break;
    const raw = await shoot(page, id);
    await compose(raw, { id, punch: [0.1, 0.05, 0.8, 0.6] });
  }
  rl.close();
  await browser.close();
}

async function runCompose() {
  const files = await fs.readdir(OUT.raw);
  for (const f of files.filter((f) => f.endsWith('.png'))) {
    const id = f.replace(/\.png$/, '');
    const shot = SHOTS.find((s) => s.id === id) || { id, punch: [0.1, 0.05, 0.8, 0.6] };
    await compose(path.join(OUT.raw, f), shot);
  }
}

const arg = process.argv[2];
if (arg === '--chrome') await launchChrome(false);
else if (arg === '--chrome-default') await launchChrome(true);
else if (arg === '--mobile') await runMobile(process.argv.slice(3).filter(Boolean).length ? process.argv.slice(3) : null);
else if (arg === '--manual') await runManual();
else if (arg === '--compose') await runCompose();
else await runAuto();
