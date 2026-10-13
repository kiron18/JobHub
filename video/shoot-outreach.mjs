/**
 * Shoots the outreach chapter: say who you want to reach, get the five
 * messages, save them to the tracker.
 *
 *   node video/shoot-outreach.mjs
 *
 * Needs `npm run dev`, and the API started with video/lib/server-real-auth.mts.
 * Costs real model calls. Output: video/out/outreach/screen.mp4 + events.json
 */
import path from 'node:path';
import fs from 'node:fs';
import { startRecording, take } from './lib/recorder.mjs';
import { APP, signIn } from './lib/demo.mjs';

const { view, dir } = take('outreach');
const OUT = path.join(import.meta.dirname, 'out', dir);
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });

const rec = await startRecording(OUT, { view, prepare: (ctx) => signIn(ctx, { jobhub_report_seen: 'true' }) });
const { page, wait, mark, click, logRect, reveal, type } = rec;
const still = (n) => page.screenshot({ path: path.join(OUT, 'stills', `${n}.png`) });
const button = (name) => page.getByRole('button', { name }).first();

await page.goto(`${APP}/linkedin`, { waitUntil: 'networkidle' }).catch(() => {});
await wait(2000);
// Off camera: bring the form up so every field and the button are on screen at once.
await page.locator('input:visible').nth(2).evaluate((el) => el.scrollIntoView({ block: 'center' }));
await wait(800);
await rec.begin();
await wait(1000);
mark('start');

const fields = page.locator('input:visible');
await logRect('field-name', fields.nth(0));
await logRect('field-company', fields.nth(1));
await logRect('field-topic', fields.nth(2));
await logRect('generate', button(/generate outreach/i));
await still('1-form');

await type('name', fields.nth(0), 'Priya');
await type('company', fields.nth(1), 'Wattle Street Events');
await type('topic', fields.nth(2), 'Head of Marketing. Posted about their sold-out industry night');
await wait(300);
await click(button(/generate outreach/i), { ms: 420, hold: 450, name: 'generate' });
await page.waitForSelector('text=/Generating templates/i', { timeout: 15000 }).catch(() => {});
mark('generating');

await page.waitForSelector('text=/Connection request note/i', { timeout: 180000 });
mark('generated');
await wait(1200);

// The five messages, each brought up and measured in turn.
const cards = [
  ['note', /^Connection request note/i],
  ['first', /^First message after connecting/i],
  ['after', /^After-conversation follow-up/i],
  ['again', /^Ask again for the call/i],
  ['later', /^The 3-4 week follow-up/i],
];
for (const [name, title] of cards) {
  await reveal(`card-${name}`, page.getByText(title).first(), { minH: 150 });
  if (name === 'note') {
    const count = (await page.getByText(/^\d+ \/ 200$/).first().textContent().catch(() => '')) || '';
    // The note is meant to fit LinkedIn's 200 characters. When the draft runs over,
    // the card turns red; the edit leaves that card out rather than show a warning state.
    if (parseInt(count, 10) > 200) mark('note-over-cap');
    console.log('connection note length:', count);
  }
  await still(`2-${name}`);
  await wait(name === 'note' || name === 'first' ? 3200 : 1500);
}

await reveal('save', button(/save this outreach/i));
await wait(900);
await click(button(/save this outreach/i), { ms: 450, hold: 500, name: 'save' });
await wait(2500);
mark('saved');
await still('3-saved');
await wait(1500);

console.log(await rec.finish());
