import { chromium } from 'playwright';
import { mkdirSync, readdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, 'src', 'shared', 'ui-mocks');
const OUT = resolve(__dirname, 'output', 'ui-mocks');
const TMP = resolve(__dirname, '.render-tmp');
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

// Realistic default slot values so mocks render with meaningful content
const DEFAULTS = {
  analyse: {
    '{{TOGGLE_ON}}': 'true',
    '{{BROWSE_PILL_TEXT}}': 'Browse marketing jobs on Seek',
    '{{TEXTAREA_PLACEHOLDER}}': 'Paste the job description here...',
  },
  'process-strip': {
    '{{CURRENT_STEP}}': 'analyse',
    '{{CAPTION}}': 'Hit Analyse. We will build your tailored resume and cover letter.',
  },
  'tracker-pipeline': {
    '{{JOB1_STATUS}}': 'SAVED',
    '{{JOB1_AGE}}': 'Started 2 days ago',
    '{{JOB1_TITLE}}': 'Senior Marketing Manager',
    '{{JOB1_COMPANY}}': 'Atlassian &middot; Sydney',
    '{{JOB2_STATUS}}': 'APPLIED',
    '{{JOB2_AGE}}': 'Applied 5 days ago',
    '{{JOB2_TITLE}}': 'Graduate Data Analyst',
    '{{JOB2_COMPANY}}': 'Canva &middot; Sydney',
    '{{JOB3_STATUS}}': 'INTERVIEW',
    '{{JOB3_AGE}}': 'Interview next week',
    '{{JOB3_TITLE}}': 'Product Design Graduate',
    '{{JOB3_COMPANY}}': 'Atlassian &middot; Sydney',
  },
  'editor-with-rewrites': {
    '{{ACTIVE_TAB}}': 'resume',
    '{{BULLET_NORMAL}}': 'Led the migration of 14 legacy customer reporting workflows to a unified Tableau dashboard, reducing monthly close time by 40%.',
    '{{BULLET_REWRITTEN}}': 'Rebuilt the data ingestion pipeline, cutting client report turnaround from 14 days to under 6 hours.',
  },
  'diagnostic-card': {
    '{{FIX_NUMBER}}': '03',
    '{{FINDING_TITLE}}': 'Your opening line introduces you. It should sell you.',
    '{{BEFORE_TEXT}}': 'I am a results-driven marketing professional with 5 years of experience in B2B SaaS, looking to leverage my skills...',
    '{{AFTER_TEXT}}': 'Drove $2.3M in pipeline at Atlassian by rebuilding the SMB outbound motion from scratch.',
    '{{EXPLANATION}}': "The 'after' version names the company, quantifies impact, and states the action you took. Recruiters scan for these three signals in the first 3 seconds.",
  },
  'section-intro-banner': {
    '{{BANNER_TEXT}}': "70% of Aussie roles are filled via networking. This is your LinkedIn toolkit: profile rewrite, outreach templates, headline drafts.",
  },
  'linkedin-toolkit-card': {
    '{{ICON_SVG}}': '<svg width="20" height="20" viewBox="0 0 24 24" fill="#2D5A6E"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/></svg>',
    '{{CARD_TITLE}}': 'Outreach Templates',
    '{{CARD_BODY}}': 'Pre-written messages for every networking stage - from cold connection to direct ask.',
  },
  'email-template-card': {
    '{{CATEGORY_LABEL}}': 'Follow-up &middot; After application',
    '{{TEMPLATE_TITLE}}': 'Polite 7-day follow-up',
    '{{EMAIL_BODY}}': 'Hi {Hiring Manager},\n\nI applied for the {role} position last week and wanted to reaffirm my interest. I am confident my experience in {field} would bring value to your team.\n\nWould you be available for a brief chat this week?',
    '{{PERSONALISE_NOTE}}': 'Personalisable &middot; 3 fields to fill',
  },
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ deviceScaleFactor: 2 });

const files = readdirSync(SRC).filter(f => f.endsWith('.html')).sort();
let ok = 0, fail = 0;

for (const file of files) {
  const htmlPath = resolve(SRC, file);
  const raw = readFileSync(htmlPath, 'utf-8');

  // Find matching defaults
  let html = raw;
  const key = file.replace('.html', '');
  const defaults = DEFAULTS[key];
  if (defaults) {
    for (const [slot, value] of Object.entries(defaults)) {
      html = html.replaceAll(slot, value);
    }
  }

  // Write temp file
  const tmpPath = resolve(TMP, file);
  writeFileSync(tmpPath, html, 'utf-8');
  const fileUrl = 'file:///' + tmpPath.replace(/\\/g, '/');
  const pngPath = resolve(OUT, file.replace('.html', '.png'));

  try {
    const page = await ctx.newPage();
    await page.goto(fileUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const section = await page.locator('section.jobhub-mock');
    await section.waitFor({ state: 'visible', timeout: 5000 });
    const box = await section.boundingBox();
    if (box) {
      await page.screenshot({
        path: pngPath,
        clip: { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height: Math.ceil(box.height) },
      });
    } else {
      await page.screenshot({ path: pngPath });
    }
    await page.close();
    ok++;
    process.stdout.write('.');
  } catch (err) {
    fail++;
    console.error(`\nX ${file}: ${err.message}`);
  }
}

// Cleanup tmp
rmSync(TMP, { recursive: true, force: true });

await browser.close();
console.log(`\nDone. ${ok} rendered, ${fail} failed.`);
