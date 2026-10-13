/**
 * Screen recorder for walkthrough videos.
 *
 * Playwright's own recordVideo is 1x and heavily compressed, which goes soft the
 * moment the edit zooms in. This records the CDP screencast instead: full
 * device-pixel frames, each with its real timestamp, stitched to a constant
 * frame rate afterwards.
 *
 * It also keeps an event log (cursor moves, clicks, named marks) on the same
 * clock as the frames. The edit reads that log to place zooms and to draw the
 * cursor, so nothing in the edit is positioned by eye.
 */
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const VIEW = { width: 1280, height: 720, scale: 2 };
/**
 * The phone take, for the 1080x1920 cut. 400 wide so the 800px vertical stage
 * (PORTRAIT in Walkthrough.tsx) shows it at exactly 2x, and taller than that
 * stage shows: the edit picks which part of the screen to hold, so less is
 * filmed scrolling.
 */
export const PHONE = { width: 400, height: 800, scale: 3 };
/** `node shoot-x.mjs --vertical` films the phone layout into out/x-9x16. */
export const take = (name) => {
  const vertical = process.argv.includes('--vertical');
  return { vertical, view: vertical ? PHONE : VIEW, dir: vertical ? `${name}-9x16` : name };
};
const MIN_GAP = 1 / 40; // drop frames closer together than this, in seconds

/**
 * Keep robot sessions out of the numbers. Local dev still initialises PostHog
 * with the production project key, so an unblocked shoot is counted as a real
 * visit and a real resume upload.
 */
export const blockAnalytics = (ctx) => ctx.route(/posthog\.com|\/ingest\//,(route) => route.abort());

/** `prepare(ctx)` runs before the page exists: the place to sign in or seed localStorage. */
export async function startRecording(outDir, { view = VIEW, mobile = false, prepare } = {}) {
  const framesDir = path.join(outDir, 'frames');
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });

  // The screencast is in CSS pixels unless the BROWSER (not just the context)
  // is told the scale factor, and only the full Chromium build honours that.
  // Without both, frames come back 1280x720 whatever deviceScaleFactor says.
  const browser = await chromium.launch({
    channel: 'chromium',
    args: [`--force-device-scale-factor=${view.scale}`],
  });
  const ctx = await browser.newContext({
    viewport: { width: view.width, height: view.height },
    deviceScaleFactor: view.scale,
    isMobile: mobile,
    hasTouch: mobile,
  });
  await blockAnalytics(ctx);
  if (prepare) await prepare(ctx);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);

  const frames = []; // { file, t }
  const events = []; // { t, type, ... }
  let t0 = null;
  let last = -1;
  let cursor = { x: view.width / 2, y: view.height * 0.8 };

  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    const ts = metadata.timestamp;
    if (t0 === null) t0 = ts;
    const t = ts - t0;
    if (t - last < MIN_GAP) return;
    last = t;
    const file = `${String(frames.length).padStart(6, '0')}.jpg`;
    fs.writeFileSync(path.join(framesDir, file), Buffer.from(data, 'base64'));
    frames.push({ file, t });
  });

  const now = () => (t0 === null ? 0 : Date.now() / 1000 - t0);
  const wait = (ms) => page.waitForTimeout(ms);
  const mark = (name, extra = {}) => { events.push({ t: now(), type: 'mark', name, ...extra }); };

  const rectOf = async (locator) => {
    const b = await locator.boundingBox();
    if (!b) throw new Error('no bounding box');
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  };

  /** Glide the cursor to a locator. The real pointer moves too, so hover states fire. */
  const moveTo = async (locator, { ms = 700, at = [0.5, 0.5] } = {}) => {
    // Bring it on screen with a real, smooth wheel scroll so the move is filmable.
    let r = await rectOf(locator);
    const mid = r.y + r.h / 2;
    // Only when it is truly off screen: a sticky footer button sits near the edge
    // and cannot be scrolled to, and trying drags the page under it.
    if (mid < 10 || mid > view.height - 10) {
      await scroll(mid - view.height * 0.55, 450);
      r = await rectOf(locator);
    }
    const to = { x: r.x + r.w * at[0], y: r.y + r.h * at[1] };
    events.push({ t: now(), type: 'move', from: { ...cursor }, to, ms, rect: r });
    await page.mouse.move(to.x, to.y, { steps: Math.max(2, Math.round(ms / 16)) });
    await wait(120);
    cursor = to;
    return r;
  };

  /** Smooth wheel scroll under the cursor. Positive is down. */
  const scroll = async (dy, ms = 700) => {
    const steps = Math.max(8, Math.round(ms / 16));
    events.push({ t: now(), type: 'scroll', dy, ms });
    for (let i = 0; i < steps; i++) {
      // ease in and out so the page does not lurch
      const a = i / steps, b = (i + 1) / steps;
      const e = (x) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x));
      await page.mouse.wheel(0, dy * (e(b) - e(a)));
      await wait(16);
    }
    await wait(250);
  };

  /**
   * Log where something is right now, so the edit can put a highlight on it.
   * With minH, walks up to the nearest ancestor at least that tall: the way to
   * get "the whole card" from the title inside it.
   */
  const logRect = async (name, locator, { minH = 0 } = {}) => {
    const rect = await locator.evaluate((el, h) => {
      let n = el;
      while (n.parentElement && n.getBoundingClientRect().height < h) n = n.parentElement;
      const b = n.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height, radius: parseFloat(getComputedStyle(n).borderTopLeftRadius) || 0 };
    }, minH);
    events.push({ t: now(), type: 'rect', name, rect });
    return rect;
  };

  /**
   * Put something below the fold on screen, off camera, and log where it landed.
   * The edit cuts to it. A filmed scroll to reach a button is dead air.
   */
  const reveal = async (name, locator, opts = {}) => {
    // Centre the same node logRect will measure (the whole card, with minH), not the title inside it.
    await locator.evaluate((el, h) => {
      let n = el;
      while (n.parentElement && n.getBoundingClientRect().height < h) n = n.parentElement;
      n.scrollIntoView({ block: 'center' });
    }, opts.minH ?? 0);
    await wait(600);
    mark(`${name}-ready`);
    return logRect(name, locator, opts);
  };

  /** Click into a field and type like a person, with marks either side. */
  const type = async (name, locator, text, { delay = 18 } = {}) => {
    await click(locator, { ms: 300, hold: 100, at: [0.3, 0.5] });
    mark(`${name}-typing`);
    await locator.pressSequentially(text, { delay });
    mark(`${name}-typed`);
    await wait(250);
  };

  const click = async (locator, opts = {}) => {
    const r = await moveTo(locator, opts);
    await wait(opts.hold ?? 180);
    events.push({ t: now(), type: 'click', x: cursor.x, y: cursor.y, rect: r, name: opts.name });
    await page.mouse.down();
    await wait(60);
    await page.mouse.up();
  };

  const begin = async () => {
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  };

  const finish = async (fps = 30) => {
    await wait(400);
    await cdp.send('Page.stopScreencast').catch(() => {});
    const duration = now();
    await browser.close();

    // ffconcat with per-frame durations turns "a frame whenever the page changed"
    // into constant-rate video with holds where nothing moved.
    const lines = ['ffconcat version 1.0'];
    frames.forEach((f, i) => {
      const next = i + 1 < frames.length ? frames[i + 1].t : duration;
      lines.push(`file 'frames/${f.file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
    });
    lines.push(`file 'frames/${frames[frames.length - 1].file}'`);
    fs.writeFileSync(path.join(outDir, 'frames.ffconcat'), lines.join('\n'));
    const r = spawnSync('ffmpeg', [
      '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'frames.ffconcat',
      '-vf', `fps=${fps},format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'medium',
      '-g', String(fps), '-movflags', '+faststart', 'screen.mp4',
    ], { cwd: outDir, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`);

    fs.writeFileSync(path.join(outDir, 'events.json'), JSON.stringify({
      view, fps, duration, frameCount: frames.length, events,
    }, null, 2));
    fs.rmSync(framesDir, { recursive: true, force: true });
    return { duration, frames: frames.length };
  };

  return { page, begin, finish, wait, mark, moveTo, click, scroll, logRect, reveal, type, rectOf, now };
}
