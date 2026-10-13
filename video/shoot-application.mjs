/**
 * Shoots the application chapter: paste a job ad, get the verdict, then the
 * tailored resume, the cover letter, and the tracker.
 *
 *   node video/shoot-application.mjs
 *
 * Needs `npm run dev`, and the API started with video/lib/server-real-auth.mts
 * (the normal dev server signs everything in as a shared dev user).
 * Costs real model calls. Output: video/out/application/screen.mp4 + events.json
 */
import path from 'node:path';
import fs from 'node:fs';
import { startRecording, take } from './lib/recorder.mjs';
import { APP, signIn } from './lib/demo.mjs';
import { AD } from './assets/job-ad.mjs';

const { view, dir } = take('application');
const OUT = path.join(import.meta.dirname, 'out', dir);
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });

const rec = await startRecording(OUT, {
  view,
  // The Edit button's first-use pop-up sits on top of the document. Mark it seen;
  // leave "used" unset so the button still wears its shimmer.
  prepare: (ctx) => signIn(ctx, { jobhub_report_seen: 'true', jobhub_edit_intro_seen: 'true' }),
});
const { page, wait, mark, moveTo, click, logRect, reveal } = rec;
const still = (n) => page.screenshot({ path: path.join(OUT, 'stills', `${n}.png`) });
const button = (name) => page.getByRole('button', { name }).first();

await page.goto(`${APP}/check`, { waitUntil: 'networkidle' }).catch(() => {});
await wait(2000);
await rec.begin();
await wait(1200);
mark('start');

// Paste the ad.
const box = page.locator('textarea').first();
await logRect('ad-box', box);
await moveTo(box, { ms: 500, at: [0.5, 0.4] });
await wait(500);
mark('paste');
// Set the text the way a paste does, but in one step with the caret at the
// start. A plain fill() leaves the caret, and so the view, at the end of the ad,
// and the box shows its last lines instead of the job title.
await box.evaluate((el, text) => {
  el.focus();
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, text);
  el.setSelectionRange(0, 0);
  el.scrollTop = 0;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, AD);
await wait(1300);
await logRect('find-out', button(/find out/i));
await click(button(/find out/i), { ms: 450, hold: 450, name: 'find-out' });

// The verdict.
await page.waitForSelector('text=/Worth applying|Not this one/', { timeout: 120000 });
mark('verdict');
await wait(900);
await logRect('verdict-box', page.getByText(/^(Worth applying|Not this one)/).first(), { minH: 70 });
await logRect('why', page.getByText('Why', { exact: true }).first(), { minH: 100 });
await logRect('against', page.getByText('What is against you', { exact: true }).first(), { minH: 60 });
await still('1-verdict');
await wait(3600);

await reveal('write', button(/write my resume/i));
await still('2-write');
await wait(900);
await click(button(/write my resume/i), { ms: 450, hold: 500, name: 'write' });
await page.waitForSelector('text=/Pulling|TAILORED RESUME/i', { timeout: 30000 }).catch(() => {});
mark('writing');

// The resume.
await page.waitForSelector('text=/Download resume/i', { timeout: 300000 });
mark('resume-done');
await wait(1300);
await logRect('resume-doc', page.getByText('Maya Fernando', { exact: true }).first(), { minH: 300 });
await logRect('edit', button(/^Edit$/));
await logRect('download-resume', button(/download resume/i));
await still('3-resume');
await wait(3800);

await reveal('save1', button(/save & continue/i));
await still('4-save1');
await wait(900);
await click(button(/save & continue/i), { ms: 450, hold: 500, name: 'save1' });

// The cover letter.
await page.waitForSelector('text=/Download cover letter/i', { timeout: 300000 });
mark('cover-done');
await wait(1300);
await logRect('letter-doc', page.getByText(/^Dear /).first(), { minH: 300 });
await logRect('download-both', button(/download both/i));
await still('5-cover');
await wait(3800);

await reveal('save2', button(/save & continue/i));
await wait(900);
await click(button(/save & continue/i), { ms: 450, hold: 500, name: 'save2' });

// Saved to the tracker.
await page.waitForSelector('text=/in your tracker/i', { timeout: 120000 });
mark('tracked');
await wait(1100);
await logRect('tracked-head', page.getByText(/in your tracker/i).first());
const saved = page.getByText('Draft saved', { exact: true });
for (let i = 0; i < Math.min(2, await saved.count()); i++) await logRect(`row-${i}`, saved.nth(i), { minH: 36 });
await logRect('download-all', button(/download all/i));
await still('6-tracked');
await wait(4000);

console.log(await rec.finish());
