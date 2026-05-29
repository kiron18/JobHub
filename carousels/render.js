import { chromium } from 'playwright';
import { mkdirSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, 'src');
const OUT = resolve(__dirname, 'output');

const PLATFORMS = [
  { name: 'instagram', width: 1080, height: 1080 },
  { name: 'linkedin',  width: 1080, height: 1350 },
];

const topics = readdirSync(resolve(SRC, 'instagram'));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ deviceScaleFactor: 2 });

let total = 0;
let failed = 0;

for (const platform of PLATFORMS) {
  const srcDir = resolve(SRC, platform.name);
  const topics = readdirSync(srcDir);

  for (const topic of topics) {
    const outDir = resolve(OUT, platform.name, topic);
    mkdirSync(outDir, { recursive: true });

    const slideDir = resolve(srcDir, topic);
    const files = readdirSync(slideDir).filter(f => f.endsWith('.html')).sort();

    for (const file of files) {
      const htmlPath = resolve(slideDir, file);
      const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
      const pngName = file.replace('.html', '.png');
      const outPath = resolve(outDir, pngName);

      try {
        const page = await ctx.newPage();
        await page.setViewportSize({ width: platform.width, height: platform.height });
        await page.goto(fileUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: platform.width, height: platform.height } });
        await page.close();
        total++;
        process.stdout.write(`.`); // progress dot
      } catch (err) {
        failed++;
        console.error(`\nX ${platform.name}/${topic}/${file}: ${err.message}`);
      }
    }
  }
}

await browser.close();
console.log(`\n\nDone. ${total} slides rendered, ${failed} failed.`);
console.log(`Output: ${OUT}`);
