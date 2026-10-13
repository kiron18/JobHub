/**
 * Shoots the diagnosis chapter: drop a resume on the home page, wait for the
 * read, open the findings, press Fix.
 *
 *   node video/shoot-diagnosis.mjs
 *
 * Needs `npm run dev` and the server on :3002. Costs real model calls.
 * Output: video/out/diagnosis/screen.mp4 + events.json
 *
 * The waits here are the pacing of the raw take, not of the video: the edit
 * (src/diagnosis.tsx) cuts by the named marks, so leave a little air and trim there.
 */
import path from 'node:path';
import fs from 'node:fs';
import { startRecording, take } from './lib/recorder.mjs';

const ROOT = path.resolve(import.meta.dirname);
const APP = process.env.CAPTURE_APP_URL || 'http://localhost:5173';
const CV = path.join(ROOT, 'assets', 'Maya_Fernando_Resume.pdf');
const { view, dir, vertical } = take('diagnosis');
// On a phone the finding cards are a stack of short tiles, not a row of tall ones.
const CARD = { minH: vertical ? 60 : 150 };
const OUT = path.join(ROOT, 'out', dir);
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });

const rec = await startRecording(OUT, { view });
const { page, wait, mark, moveTo, click, scroll, logRect } = rec;
const still = (n) => page.screenshot({ path: path.join(OUT, 'stills', `${n}.png`) });

await page.goto(`${APP}/`, { waitUntil: 'networkidle' }).catch(() => {});
await wait(1500);
await rec.begin();
await wait(1500);
mark('front-door');

// The upload is a file input behind the drop zone. Glide to the zone so the
// viewer sees where the resume goes, then hand the file over.
const zone = page.getByText('Upload your resume', { exact: true }).first();
await logRect('upload-zone', zone, { minH: 120 });
await moveTo(zone, { ms: 600, at: [0.5, 1.6] });
mark('at-zone');
await wait(900);
mark('upload');
await page.locator('input[type=file]').first().setInputFiles(CV);

await page.waitForSelector('text=/Reading|Working out|Pulling out/i', { timeout: 30000 }).catch(() => {});
mark('loading');

await page.waitForSelector('text=/losing interviews|Your biggest gap/i', { timeout: 240000 });
mark('diagnosis');
await wait(1200);

// Each finding is a card that opens a panel under the row. Opening one closes
// the others, so they are found by title, not by counting "Show me" links.
const cardOf = (title) => page.getByText(title, { exact: true }).first();
for (const [name, title] of [['card-overview', 'Overview'], ['card-gap', 'Your biggest gap'], ['card-fix', 'What we need to fix']]) {
  await logRect(name, cardOf(title), CARD);
}
await still('1-cards');
await wait(2600);

await click(cardOf('Your biggest gap'), { ms: 500, name: 'open-gap' });
await wait(1200);
await still('2-gap');
await wait(3600);

// The row has moved up now that a panel is open under it.
if (vertical) {
  // The open panel has pushed this tile a screen and a half down. Bring it up
  // off camera (the edit cuts to it) instead of filming the scroll.
  await rec.reveal('card-fix-2', cardOf('What we need to fix'), CARD);
} else {
  await logRect('card-fix-2', cardOf('What we need to fix'), CARD);
}
await wait(400);
await click(cardOf('What we need to fix'), { ms: 500, name: 'open-fix' });
await wait(1300);
await scroll(300, 450);
mark('fix-scrolled');
const pills = page.getByRole('button', { name: /^Fix$/ });
const shown = Math.min(4, await pills.count());
for (let i = 0; i < shown; i++) await logRect(`pill-${i}`, pills.nth(i));
await still('3-fix');
await wait(4000);

const fix = page.getByRole('button', { name: /fix all of this/i }).first();
await fix.evaluate((el) => el.scrollIntoView({ block: 'center' }));
await wait(700);
mark('cta-ready');
await logRect('cta', fix);
await still('4-cta');
await wait(900);
await click(fix, { ms: 500, hold: 700, name: 'press-fix' });
await wait(1200);

console.log(await rec.finish());
