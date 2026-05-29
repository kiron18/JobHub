import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROCESSED = resolve(__dirname, '..', 'carousels', 'src', 'shared', 'processed');
const OUT = resolve(__dirname, '..', 'carousels', 'preview');
mkdirSync(OUT, { recursive: true });

const SLIDE = { r: 250, g: 247, b: 242 }; // #FAF7F2

const samples = [
  'a-person-using-their-laptop-they-could-be-using-all-the-grad.webp',
  'the-credit-waiting-period-where-you-see-everything-working-f.webp',
  'a-girl-who-has-just-graduated-and-is-excited-about-the-futur.webp',
  'being-counselled-by-a-professional-get-guidance-get-help-in.webp',
  'girl-looking-out-of-window-pensively-and-hopeful-about-the-f.webp',
  'this-is-one-major-hurdle-that-is-holding-you-back-and-if-you.webp',
];

for (const name of samples) {
  const inputPath = resolve(PROCESSED, name);
  const inputMeta = await sharp(inputPath).metadata();

  await sharp({
    create: {
      width: inputMeta.width,
      height: inputMeta.height,
      channels: 4,
      background: { ...SLIDE, alpha: 1 },
    },
  })
    .composite([{ input: inputPath }])
    .png()
    .toFile(resolve(OUT, name.replace('.webp', '_on-canvas.png')));

  console.log(`✓ ${name}`);
}

console.log(`\nPreviews written to ${OUT}`);
