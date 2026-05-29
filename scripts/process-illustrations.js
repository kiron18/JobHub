import sharp from 'sharp';
import { readdirSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync, rmSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ASSETS_DIR  = resolve(__dirname, '..', 'public', 'Assets');
const OUT_DIR     = resolve(__dirname, '..', 'carousels', 'src', 'shared', 'processed');
const PREVIEW_DIR = resolve(OUT_DIR, '_previews');

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(PREVIEW_DIR, { recursive: true });

// ── Short slug + human description for every source PNG ─────────────────
// Source filename (without .png extension) → { slug, description, mood }
//
// Slugs are short, kebab-case, memorable. Used as the filename of the
// processed .webp AND as the canonical reference DeepSeek uses in slide HTML.
// Description is a one-line summary used in index.md so DeepSeek can match
// the illustration to a slide concept without opening every file.
const SLUG_MAP = {
  'A girl who has just graduated and is excited about the future and all the possibilities that lay ahead of her':
    { slug: 'graduate-future', description: 'Graduate in cap and gown looking out at a city skyline, full of hope and possibility.', mood: 'hopeful, aspirational, milestone' },

  'A migrant who has just arrived to Australia and is super excited about all the possibilities that lay ahead of him also it could be a guy who has traveled thousands of miles and left his home to build a new futu':
    { slug: 'migrant-arrival', description: 'New arrival to Australia, optimistic about the future ahead. Suitcase, fresh start.', mood: 'hopeful, fresh start, courage' },

  'A person using the laptop that is frustrated they may be using the old application method which doesn\'t work or they may have faced rejection another rejection letter':
    { slug: 'frustrated-laptop', description: 'Person at laptop, head in hands or visibly frustrated. Rejection, the old method failing.', mood: 'frustration, defeat, stuck' },

  'A person using their laptop they could be using all the grad careers.com they could be using the old fashioned wrong method it could work either ways':
    { slug: 'laptop-ambiguous', description: 'Person at a laptop working — neutral, ambiguous. Could illustrate any application-related concept.', mood: 'neutral, focused, working' },

  'A woman sitting at a laptop overwhelmed by the different possibilities options and things to do so much to do such little time':
    { slug: 'overwhelmed-woman', description: 'Woman at a laptop surrounded by tabs, options, post-its. Overwhelmed by choice.', mood: 'overwhelm, decision fatigue, paralysis' },

  'Application Pipeline where exactly in the process are you getting stuck the job application process has many stages and which stage you are stuck in usually reveals a lot about what  is going wrong with your job hunting st':
    { slug: 'pipeline-stages', description: 'Horizontal pipeline: application → screen → interview → assessment → offer. Shows funnel.', mood: 'analytical, diagnostic, process' },

  'being counselled by a professional get guidance get help in your job search today get help from mentors this is great advice':
    { slug: 'mentor-session', description: 'Two people at a cafe table — mentor giving guidance to a job seeker. Coaching, advice.', mood: 'guidance, mentorship, support' },

  'girl looking out of window pensively and hopeful about the future':
    { slug: 'pensive-window', description: 'Young woman at a window holding a cup, looking out reflectively. "Maybe one day this will all be worth it."', mood: 'reflective, quietly hopeful, patience' },

  'Make sure your documents meet australian hiring standards and fit the cultural norms and language requirements':
    { slug: 'documents-standards', description: 'Documents being reviewed against Australian hiring standards. CV format, compliance.', mood: 'compliance, standards, attention to detail' },

  'Targetting the right choices in your job search - positioning yourself is setting yourself up for success':
    { slug: 'targeting-positioning', description: 'Visual metaphor for targeted aim — picking the right jobs, positioning strategically.', mood: 'strategic, focused, intentional' },

  'The credit waiting period where you see everything working for everyone else but not for you and you wonder what\'s wrong with me what\'s wrong with me':
    { slug: 'waiting-period', description: 'Man sitting on steps watching others walk towards the city. Stuck while others move on.', mood: 'isolation, comparison, self-doubt' },

  'The grind of working and planning and trying to get a job and working hard to get a job but not knowing what is working':
    { slug: 'grind-work', description: 'Person grinding through job hunt work — applications, planning, no clear feedback signal.', mood: 'persistence, grind, ambiguity' },

  'the hardest thing about the job hunt is the emotional burden this shit gets tiring fast':
    { slug: 'emotional-burden', description: 'Visual of the weight, the emotional toll of job hunting. Tired figure, heavy shoulders.', mood: 'exhaustion, emotional weight, vulnerability' },

  'this is one major hurdle that is holding you back and if you crack it you can move forward easily':
    { slug: 'major-hurdle', description: 'Person facing a large rock/hurdle on one side, walking unburdened on the other.', mood: 'obstacle, breakthrough, before-and-after' },

  'This is the first time a migrant has entered a new city and is taken in by all the wonderful sights and sounds this could be an overwhelming experience in a positive way and a negative way it could work either w':
    { slug: 'migrant-newcity', description: 'New arrival in a busy city — vivid sensory overwhelm, equal parts wonder and disorientation.', mood: 'wonder, disorientation, newness' },

  'This is the image of a person who is going their own way who has taken accountability and will move forward is determined to achieve their goals regardless of what':
    { slug: 'determined-walk', description: 'Figure walking forward with purpose, alone, accountability mode. Self-directed.', mood: 'determination, accountability, agency' },

  'three things you can do steps you can take to make your life and job hunt process easier':
    { slug: 'three-steps', description: 'Visual of 3 steps or 3 actionable items. Practical, list-shaped illustration.', mood: 'actionable, practical, structured' },

  'you are on your way to success you will get your job achieve your dreams':
    { slug: 'success-path', description: 'Figure walking towards a goal or arriving at success — positive forward motion.', mood: 'optimistic, triumphant, momentum' },
};

const SLIDE_BG = { r: 250, g: 247, b: 242 }; // #FAF7F2 — the slide canvas

// ── Existing background-detection helper ────────────────────────────────
function detectBgColor(data, width, height) {
  const samples = [];
  const margin = 3;

  for (let x = 0; x < width; x += 2) {
    const i = (margin * width + x) * 4;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  for (let x = 0; x < width; x += 2) {
    const i = ((height - 1 - margin) * width + x) * 4;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  for (let y = margin + 1; y < height - margin - 1; y += 2) {
    const i = (y * width + margin) * 4;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  for (let y = margin + 1; y < height - margin - 1; y += 2) {
    const i = (y * width + (width - 1 - margin)) * 4;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }

  const buckets = [];
  const clusterThreshold = 20;

  for (const [r, g, b] of samples) {
    let found = false;
    for (const bucket of buckets) {
      const dr = bucket.avgR - r;
      const dg = bucket.avgG - g;
      const db = bucket.avgB - b;
      if (Math.sqrt(dr * dr + dg * dg + db * db) < clusterThreshold) {
        bucket.avgR = (bucket.avgR * bucket.count + r) / (bucket.count + 1);
        bucket.avgG = (bucket.avgG * bucket.count + g) / (bucket.count + 1);
        bucket.avgB = (bucket.avgB * bucket.count + b) / (bucket.count + 1);
        bucket.count++;
        found = true;
        break;
      }
    }
    if (!found) {
      buckets.push({ avgR: r, avgG: g, avgB: b, count: 1 });
    }
  }

  buckets.sort((a, b) => b.count - a.count);
  const best = buckets[0];

  return {
    r: Math.round(best.avgR),
    g: Math.round(best.avgG),
    b: Math.round(best.avgB),
  };
}

const INNER_THRESHOLD = 28;
const OUTER_THRESHOLD = 55;
const DARKEN_AMOUNT   = 70;
const DARKEN_LUM_MIN  = 60;
const DARKEN_LUM_MAX  = 225;

// ── Clear any stale output (old long-named files from previous runs) ────
for (const f of readdirSync(OUT_DIR)) {
  if (f.endsWith('.webp')) {
    unlinkSync(resolve(OUT_DIR, f));
  }
}
if (existsSync(PREVIEW_DIR)) {
  rmSync(PREVIEW_DIR, { recursive: true, force: true });
  mkdirSync(PREVIEW_DIR, { recursive: true });
}

const sourceFiles = readdirSync(ASSETS_DIR).filter(f => f.endsWith('.png'));
console.log(`Found ${sourceFiles.length} source illustrations.\n`);

const indexEntries = [];
let processed = 0;
let failed = 0;
let unmapped = 0;

for (const file of sourceFiles) {
  const stem = basename(file, '.png');
  const mapping = SLUG_MAP[stem];

  if (!mapping) {
    unmapped++;
    console.warn(`  ! No SLUG_MAP entry for: ${file}`);
    continue;
  }

  const inputPath  = resolve(ASSETS_DIR, file);
  const outPath    = resolve(OUT_DIR, `${mapping.slug}.webp`);
  const previewPath = resolve(PREVIEW_DIR, `${mapping.slug}.png`);

  try {
    const buffer = readFileSync(inputPath);

    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const bg = detectBgColor(data, info.width, info.height);

    // Alpha key + line darken pass (see comments in earlier versions).
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const dist = Math.sqrt(
        (bg.r - r) ** 2 + (bg.g - g) ** 2 + (bg.b - b) ** 2
      );

      let alpha;
      if (dist <= INNER_THRESHOLD) {
        alpha = 0;
      } else if (dist >= OUTER_THRESHOLD) {
        alpha = 255;
      } else {
        alpha = Math.round(
          ((dist - INNER_THRESHOLD) / (OUTER_THRESHOLD - INNER_THRESHOLD)) * 255
        );
      }
      data[i + 3] = alpha;

      if (alpha > 0) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum >= DARKEN_LUM_MIN && lum <= DARKEN_LUM_MAX) {
          data[i]     = Math.max(0, r - DARKEN_AMOUNT);
          data[i + 1] = Math.max(0, g - DARKEN_AMOUNT);
          data[i + 2] = Math.max(0, b - DARKEN_AMOUNT);
        }
      }
    }

    // Write transparent webp
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .webp({ lossless: true, alphaQuality: 100 })
      .toFile(outPath);

    // Write preview composited over slide canvas
    await sharp({
      create: {
        width: info.width,
        height: info.height,
        channels: 4,
        background: { ...SLIDE_BG, alpha: 1 },
      },
    })
      .composite([{
        input: await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
          .png()
          .toBuffer()
      }])
      .png()
      .toFile(previewPath);

    indexEntries.push({
      slug: mapping.slug,
      description: mapping.description,
      mood: mapping.mood,
      width: info.width,
      height: info.height,
      sourceBg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`,
    });

    processed++;
    process.stdout.write(`  ✓ ${mapping.slug.padEnd(24)} (bg ${bg.r},${bg.g},${bg.b})\n`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${file}: ${err.message}`);
  }
}

// ── Generate index.md ───────────────────────────────────────────────────
let indexMd = `# Line Drawing Library

This folder holds the processed line-drawing illustrations used by the AGC carousel system.

Every file is a **lossless WebP with a transparent background** — drop it onto any slide colour and the lines will read at full strength with no halo or rectangle. Do NOT add \`mix-blend-mode: multiply\` or sub-1 opacity in CSS (except for the documented "background ghost" placement, see the master prompt).

To preview what each illustration looks like on the actual slide canvas (#FAF7F2), open the matching file in \`_previews/\`.

To re-process from source: \`node scripts/process-illustrations.js\` from the repo root.

---

## Available illustrations (${indexEntries.length})

| Slug | Description | Mood / use case | Preview |
|------|-------------|-----------------|---------|
`;

const sortedEntries = [...indexEntries].sort((a, b) => a.slug.localeCompare(b.slug));
for (const e of sortedEntries) {
  indexMd += `| \`${e.slug}.webp\` | ${e.description} | ${e.mood} | ![${e.slug}](./_previews/${e.slug}.png) |\n`;
}

indexMd += `
---

## How to reference in slide HTML

\`\`\`html
<img class="line-drawing"
     src="./shared/processed/<slug>.webp"
     alt="<one-line description of what the drawing depicts>"
     width="<px>" height="<px>"
     loading="eager">
\`\`\`

Replace \`<slug>\` with one of the slugs in the table above (e.g., \`frustrated-laptop\`). Width/height should be set per the placement type defined in the master prompt:

- **Side panel**: 35–45% of canvas width
- **Corner accent**: 30–40% of canvas width, can bleed off by max 15%
- **Background ghost**: 60–80% of canvas width, \`opacity: 0.12–0.18\`

Do NOT add \`mix-blend-mode\` or further \`opacity\` reduction. The transparent background handles colour-matching automatically.
`;

writeFileSync(resolve(OUT_DIR, 'index.md'), indexMd);

console.log(`\n${processed} processed, ${failed} failed, ${unmapped} unmapped.`);
console.log(`Output:   ${OUT_DIR}`);
console.log(`Previews: ${PREVIEW_DIR}`);
console.log(`Index:    ${resolve(OUT_DIR, 'index.md')}`);

if (unmapped > 0) {
  console.warn(`\n${unmapped} source file(s) had no SLUG_MAP entry — they were skipped. Add them to the SLUG_MAP at the top of this script and re-run.`);
  process.exit(1);
}
