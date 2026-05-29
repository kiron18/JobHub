import { mkdirSync, writeFileSync, readdirSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, 'src');

// ── Available illustrations ──────────────────────────────────────────
// Slug → filename. Slugs and filenames are kept identical so DeepSeek
// can reference either form without confusion. Full descriptions and
// previews live in `src/shared/processed/index.md`.
const ILL = {
  'determined-walk':       'determined-walk.webp',
  'documents-standards':   'documents-standards.webp',
  'emotional-burden':      'emotional-burden.webp',
  'frustrated-laptop':     'frustrated-laptop.webp',
  'graduate-future':       'graduate-future.webp',
  'grind-work':            'grind-work.webp',
  'laptop-ambiguous':      'laptop-ambiguous.webp',
  'major-hurdle':          'major-hurdle.webp',
  'mentor-session':        'mentor-session.webp',
  'migrant-arrival':       'migrant-arrival.webp',
  'migrant-newcity':       'migrant-newcity.webp',
  'overwhelmed-woman':     'overwhelmed-woman.webp',
  'pensive-window':        'pensive-window.webp',
  'pipeline-stages':       'pipeline-stages.webp',
  'success-path':          'success-path.webp',
  'targeting-positioning': 'targeting-positioning.webp',
  'three-steps':           'three-steps.webp',
  'waiting-period':        'waiting-period.webp',
};

function img(src) {
  const file = ILL[src];
  if (!file) return '';
  return `../../shared/processed/${file}`;
}

// ── Safeguard 1: verify all referenced illustration files exist ──────
function verifyImages() {
  const processedDir = resolve(__dirname, 'src', 'shared', 'processed');
  const missing = [];

  for (const [key, filename] of Object.entries(ILL)) {
    if (!existsSync(resolve(processedDir, filename))) {
      missing.push(`${key} → ${filename}`);
    }
  }

  if (missing.length > 0) {
    console.error(`\nERROR: ${missing.length} illustration(s) not found in ${processedDir}:`);
    missing.forEach(f => console.error(`  - ${f}`));
    console.error('\nThe ILL mapping in build.js does not match the processed files.');
    console.error('Either update the mapping or re-run `node scripts/process-illustrations.js`.');
    process.exit(1);
  }
  console.log(`  [✓] All ${Object.keys(ILL).length} illustrations verified on disk`);
}

// ── Safeguard 2: auto-regenerate processed images if missing ────────
function ensureProcessedImages() {
  const processedDir = resolve(__dirname, 'src', 'shared', 'processed');

  const hasFiles = existsSync(processedDir) &&
    readdirSync(processedDir).some(f => f.endsWith('.webp'));

  if (!hasFiles) {
    console.log('\nProcessed image directory missing or empty. Regenerating from source...');
    const scriptPath = resolve(__dirname, '..', 'scripts', 'process-illustrations.js');
    const result = spawnSync(process.execPath, [scriptPath], {
      stdio: 'inherit',
      cwd: resolve(__dirname, '..'),
    });

    if (result.status !== 0) {
      console.error('\nERROR: Illustration processing failed. Build cannot continue.');
      process.exit(1);
    }

    const nowHasFiles = existsSync(processedDir) &&
      readdirSync(processedDir).some(f => f.endsWith('.webp'));
    if (!nowHasFiles) {
      console.error('\nERROR: Processing completed but no files found in output directory.');
      process.exit(1);
    }

    console.log('Illustrations regenerated successfully.\n');
  }
}

// ── Safeguard 3: ensure every slide has at least one accent element ──
function hasAccent(str) {
  // Check for explicit accent colour usage in slide content (classes + inline)
  return /text-petrol|text-gold|gold-rule|stat-hero|brand-bar--cta|list-marker--gold|brand-bar--deep|list-number|var\(--gold\)|var\(--petrol\)/.test(str);
}

function ensureAccent(html, slide) {
  // The brand bar and top-bar are excluded — only check the content-area
  if (hasAccent(html)) return html;

  // Fallback: inject a gold-rule as decorative accent inside the first container
  const goldRule = '<div class="gold-rule gold-rule--center" style="margin-bottom:var(--sp-sm);"></div>\n      ';
  if (html.includes('<div class="split-text">')) {
    // content role side-by-side layout
    return html.replace(
      '<div class="split-text">',
      '<div class="split-text">\n        ' + goldRule
    );
  }
  return html.replace('<div class="hero-zone"', `${goldRule}<div class="hero-zone"`);
}

// ── UI Mock template loader (for embedding app screenshots inline) ─
function loadMock(name) {
  const path = resolve(__dirname, 'src', 'shared', 'ui-mocks', `${name}.html`);
  if (!existsSync(path)) {
    console.error(`\nERROR: UI mock "${name}" not found at ${path}`);
    process.exit(1);
  }
  return readFileSync(path, 'utf-8');
}

function extractMockContent(html, slots) {
  let filled = html;
  for (const [key, value] of Object.entries(slots)) {
    filled = filled.replaceAll(`{{${key}}}`, String(value));
  }
  const styleMatch = filled.match(/<style>([\s\S]*?)<\/style>/);
  const style = styleMatch ? styleMatch[1] : '';
  const sectionMatch = filled.match(/(<section[\s\S]*?<\/section>)/);
  const section = sectionMatch ? sectionMatch[1] : '';
  return { style, section };
}

// ── HTML template ────────────────────────────────────────────────────
function slideHTML(slide, total, isLinkedIn) {
  const h = isLinkedIn ? 1350 : 1080;
  const cls = isLinkedIn ? 'slide-linkedin' : '';
  const num = `${String(slide.num).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;

  let topBar = '';
  if (slide.role !== 'hook' && slide.role !== 'cta') {
    topBar = `<div class="top-bar"><span class="slide-num">${num}</span></div>`;
  }

  let brandBarClass = '';
  let brandBarText = 'aussiegradcareers.com.au';
  if (slide.role === 'cta') {
    brandBarClass = ' brand-bar--cta';
    brandBarText = 'aussiegradcareers.com.au';
  }
  if (slide.role === 'deep' || slide.deepBg) {
    brandBarClass += ' brand-bar--deep';
  }

  let ghostImage = '';
  if (slide.bgImage) {
    ghostImage = `<img class="line-drawing--bg" style="width:520px;right:-40px;bottom:80px;" src="${img(slide.image)}" alt="">`;
  }

  let cornerImage = '';
  if (slide.cornerImage) {
    cornerImage = `<img class="line-drawing--corner" style="width:38%;bottom:80px;" src="${img(slide.cornerImage)}" alt="">`;
  }

  let content = '';

  // ── ROLE: hook ──
  if (slide.role === 'hook') {
    const lines = slide.headline.map((h, i) => {
      if (i === 1) return `<h1 class="headline-hook text-gold" style="font-weight:700;">${h}</h1>`;
      return `<h1 class="headline-hook" style="${i > 0 ? 'margin-top:-4px;' : ''}">${h}</h1>`;
    }).join('\n      ');
    content = `
    <div class="hero-zone">
      ${lines}
      <div class="gold-rule gold-rule--center" style="margin-top:8px;"></div>
      ${slide.subtext ? `<p class="headline-hook" style="font-weight:600;font-size:72px;margin-top:8px;">${slide.subtext}</p>` : ''}
    </div>`;
  }

  // ── ROLE: content (side-by-side) ──
  else if (slide.role === 'content') {
    const headHtml = slide.headline.map(h => `<h2 class="headline-section" style="font-size:52px;">${h}</h2>`).join('\n        ');
    content = `
    <div class="split">
      <div class="split-text">
        ${headHtml}
        ${slide.body ? `<p class="body-copy" style="margin-top:12px;">${slide.body}</p>` : ''}
        ${slide.subtext ? `<p class="body-copy" style="font-size:28px;margin-top:8px;">${slide.subtext}</p>` : ''}
      </div>
      <div class="split-image">
        <img class="line-drawing line-drawing--side" src="${img(slide.image)}" alt="">
      </div>
    </div>`;
  }

  // ── ROLE: stat ──
  else if (slide.role === 'stat') {
    content = `
    <div class="hero-zone">
      <div class="stat-hero text-petrol">${slide.stat}</div>
      <p class="stat-label" style="max-width:540px;">${slide.label}</p>
      <div class="gold-rule gold-rule--center" style="margin-top:12px;"></div>
      ${slide.body ? `<p class="body-copy" style="font-size:28px;margin-top:12px;max-width:600px;">${slide.body}</p>` : ''}
    </div>`;
  }

  // ── ROLE: list ──
  else if (slide.role === 'list') {
    const items = slide.items.map((item, i) => {
      const n = String(i + 1).padStart(2, '0');
      return `<div class="list-item"><span class="list-number">${n}</span><span class="list-text">${item}</span></div>`;
    }).join('\n          ');
    content = `
    <div class="hero-zone" style="align-items:flex-start;text-align:left;gap:var(--sp-md);">
      <h2 class="headline-section" style="font-size:52px;">${slide.headline}</h2>
      <div style="display:flex;flex-direction:column;gap:20px;width:100%;max-width:720px;margin-top:8px;">
        ${items}
      </div>
    </div>`;
  }

  // ── ROLE: cta ──
  else if (slide.role === 'cta') {
    content = `
    <div class="hero-zone">
      <h2 class="headline-hook" style="font-size:76px;font-weight:700;">${slide.headline[0]}</h2>
      <h2 class="headline-hook" style="font-size:76px;font-weight:700;color:var(--petrol);margin-top:-8px;">${slide.headline[1]}</h2>
      <div class="cta-box" style="margin-top:24px;">${slide.url}</div>
    </div>`;
  }

  // ── ROLE: ui (app screenshot embedded inline) ──
  else if (slide.role === 'ui') {
    const mock = extractMockContent(loadMock(slide.mock), slide.slots || {});
    content = `
    <style>${mock.style}</style>
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;width:100%;gap:var(--sp-sm);padding:var(--sp-sm) 0;">
      ${slide.headline ? `<h2 class="headline-section" style="font-size:38px;text-align:center;">${slide.headline}</h2>` : ''}
      <div class="gold-rule gold-rule--center"></div>
      <div style="display:flex;align-items:center;justify-content:center;width:100%;">
        ${mock.section}
      </div>
      ${slide.caption ? `<p class="body-copy" style="font-size:22px;color:var(--text-secondary);text-align:center;max-width:640px;">${slide.caption}</p>` : ''}
    </div>`;
  }

  // ── ROLE: deep (emotional dark slide) ──
  else if (slide.role === 'deep') {
    const lines = slide.headline.map(h => `<h2 class="headline-section text-on-deep" style="font-size:52px;">${h}</h2>`).join('\n        ');
    content = `
    <div class="hero-zone">
      ${lines}
      ${slide.body ? `<p class="body-copy" style="margin-top:16px;color:rgba(250,247,242,0.7);">${slide.body}</p>` : ''}
      ${slide.subtext ? `<p class="headline-section" style="font-size:40px;color:var(--gold);margin-top:12px;">${slide.subtext}</p>` : ''}
    </div>`;
  }

  // Safeguard 3: enforce accent colour on every slide
  content = ensureAccent(content, slide);

  const deepClass = slide.deepBg ? ' slide-deep' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;0,9..144,800;0,9..144,900;1,9..144,400;1,9..144,600;1,9..144,700&family=Geist:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../../framework.css">
<title>${slide.title || ''}</title>
</head>
<body>
<div class="slide${deepClass}" style="height:${h}px;">
  ${ghostImage}
  ${cornerImage}
  ${topBar}
  <div class="content-area">
    ${content}
  </div>
  <div class="brand-bar${brandBarClass}">${brandBarText}</div>
</div>
</body>
</html>`;
}

// ── Content definitions ──────────────────────────────────────────────
// Each carousel: topic → [platform → slides[]]
// Shared content key: !image = illustration key, bgImage = ghost bg, cornerImage = corner placement, deepBg = dark bg

const CAROUSELS = {

  'why-youre-getting-rejected': {
    instagram: [
      { num:1, role:'hook',    headline:['200<br>applications.','One rejection.'], subtext:'Or worse...<br>silence.', image:'frustrated-laptop', bgImage:true },
      { num:2, role:'content', headline:['You have the<br>skills.','You have the<br>degree.'], body:'So why does every response say<br><strong class="fw-700 text-petrol">&ldquo;not enough experience&rdquo;?</strong>', image:'pensive-window' },
      { num:3, role:'deep',    headline:['You left everything<br>behind.'], body:'Your family. Your friends. Your home.', subtext:'Was it worth it?', deepBg:true, image:'emotional-burden', bgImage:true },
      { num:4, role:'stat',    stat:'65%', label:'of international grad applicants<br>never hear back from employers', body:'Not because you lack potential.<br><span class="fw-600 text-petrol">Because you lack a system.</span>' },
      { num:5, role:'list',    headline:'4 steps to master<br>the system:', items:['<strong class="fw-600 text-petrol">Diagnose</strong> the gap between you and the role','<strong class="fw-600 text-petrol">Bridge</strong> what is missing with targeted action','<strong class="fw-600 text-petrol">Tailor</strong> your story to their language','<strong class="fw-600 text-petrol">Track</strong> what works and iterate'] },
      { num:6, role:'content', headline:['Paste a job<br>description.'], body:'Get an instant gap analysis of<br>your profile against the role.', subtext:'One dashboard. One workflow.<br><span class="fw-600 text-petrol">No more guessing.</span>', image:'laptop-ambiguous' },
      { num:7, role:'ui', mock:'diagnostic-card', headline:'See the gap for yourself.', caption:'One paste. One dashboard. No more guessing.', slots:{ FIX_NUMBER:'01', FINDING_TITLE:'Your opening line introduces you. It should sell you.', BEFORE_TEXT:'Motivated marketing graduate with strong communication skills looking for an opportunity to contribute to your team.', AFTER_TEXT:'Drove $12K in fundraising revenue at UniMelb by restructuring the student outreach campaign, cutting acquisition cost by 30%.', EXPLANATION:'The "after" version names the university, quantifies impact, and states the action. Recruiters scan for these three signals in the first 3 seconds.' } },
      { num:8, role:'cta',     headline:['Stop guessing.','Start knowing.'], url:'aussiegradcareers.com.au', cornerImage:'determined-walk' },
    ],
    linkedin: [
      { num:1, role:'hook',    headline:['The Real Reason Your<br>Graduate Applications','Get Rejected'], subtext:'And the system to fix it. No experience required.', image:'frustrated-laptop', bgImage:true },
      { num:2, role:'stat',    stat:'65%', label:'of international grad applicants<br>never hear back from employers', body:'Not because you lack potential.<br><span class="fw-600 text-petrol">Because you lack a system.</span>' },
      { num:3, role:'content', headline:['It is not a skills gap.'], body:'It is a <strong class="fw-600 text-petrol">visibility gap</strong>. Employers see a resume that does not connect to their needs. You have the capability framed in the wrong language.', image:'major-hurdle' },
      { num:4, role:'list',    headline:'The 4-step system:', items:['<strong class="fw-600 text-petrol">Diagnose</strong> - find the gaps in your profile','<strong class="fw-600 text-petrol">Bridge</strong> - build what is missing','<strong class="fw-600 text-petrol">Tailor</strong> - fit your story to their language','<strong class="fw-600 text-petrol">Track</strong> - measure what works and iterate'] },
      { num:5, role:'content', headline:['One platform.','One workflow.'], body:'Paste any job description. Get a diagnostic. Generate tailored documents. Track every application.', subtext:'<span class="fw-600 text-petrol">All in one place.</span>', image:'laptop-ambiguous' },
      { num:6, role:'ui', mock:'diagnostic-card', headline:'See the gap analysis for yourself.', caption:'', slots:{ FIX_NUMBER:'01', FINDING_TITLE:'Your opening line introduces you. It should sell you.', BEFORE_TEXT:'Motivated marketing graduate with strong communication skills looking for an opportunity to contribute to your team.', AFTER_TEXT:'Drove $12K in fundraising revenue at UniMelb by restructuring the student outreach campaign, cutting acquisition cost by 30%.', EXPLANATION:'The "after" version names the university, quantifies impact, and states the action. Recruiters scan for these three signals in the first 3 seconds.' } },
      { num:7, role:'cta',     headline:['Stop guessing.','Start knowing.'], url:'aussiegradcareers.com.au &rarr;', cornerImage:'determined-walk' },
    ]
  },

  'the-experience-gap-myth': {
    instagram: [
      { num:1, role:'hook',    headline:['&ldquo;Not enough','experience&rdquo;'], subtext:'They keep saying it.<br>But what if they are wrong?', image:'frustrated-laptop', bgImage:true },
      { num:2, role:'content', headline:['You have the<br>experience.'], body:'You have projects. You have coursework. You have skills you built while adapting to a new country.', subtext:'<span class="fw-600 text-petrol">That is experience.</span>', image:'pensive-window' },
      { num:3, role:'deep',    headline:['The problem is not<br>what you have.'], body:'It is how you translate it into the language employers understand.', subtext:'Translation, not gaps.', deepBg:true, image:'major-hurdle', bgImage:true },
      { num:4, role:'list',    headline:'Bridging the gap:', items:['Map your skills to their keywords','Reframe projects as professional experience','Use the language of their industry','Quantify your impact'] },
      { num:5, role:'content', headline:['AussieGrad Careers<br>does this for you.'], body:'Paste the job description. The system <span class="fw-600 text-petrol">analyses your profile</span> and shows exactly how to reframe your experience to match.', image:'laptop-ambiguous' },
      { num:6, role:'ui', mock:'analyse-card', headline:'Try it yourself.', caption:'Paste any job description. See what you are missing.', slots:{ TOGGLE_ON:'true', BROWSE_PILL_TEXT:'Browse graduate jobs on LinkedIn', TEXTAREA_PLACEHOLDER:'Paste a job description here...\n\nWe are hiring a Graduate Marketing Coordinator to join our Sydney office. You will support campaign execution, content creation, and social media management across multiple channels.' } },
      { num:7, role:'cta',     headline:['Bridge the gap.','Get the role.'], url:'aussiegradcareers.com.au', cornerImage:'determined-walk' },
    ],
    linkedin: [
      { num:1, role:'hook',    headline:['What If It Is Not an<br>Experience Gap?','What If It Is a<br>Translation Gap?'], subtext:'Your resume says one thing. Employers need another.', image:'major-hurdle', bgImage:true },
      { num:2, role:'stat',    stat:'3x', label:'More applications international grads<br>need vs domestic for the same outcome', body:'<span class="fw-600 text-petrol">The gap is not capability. It is framing.</span>' },
      { num:3, role:'content', headline:['You have more than<br>you think.'], body:'Coursework, projects, volunteering, cross-cultural adaptability. These are <span class="fw-600 text-petrol">professional assets</span> framed in the wrong language.', image:'pensive-window' },
      { num:4, role:'list',    headline:'How to bridge it:', items:['Identify keywords in the job description','Map your experience to their language','Reframe each point with their terminology','Show impact, not just activity'] },
      { num:5, role:'content', headline:['The platform that<br>translates for you.'], body:'AussieGrad Careers analyses any job description against your profile and <span class="fw-600 text-petrol">tells you exactly what to reframe</span> and how.', image:'laptop-ambiguous' },
      { num:6, role:'ui', mock:'analyse-card', headline:'Try it yourself.', caption:'See how your profile measures up against any role.', slots:{ TOGGLE_ON:'true', BROWSE_PILL_TEXT:'Browse graduate jobs on LinkedIn', TEXTAREA_PLACEHOLDER:'Paste a job description here...\n\nWe are hiring a Graduate Marketing Coordinator to join our Sydney office. You will support campaign execution, content creation, and social media management across multiple channels.' } },
      { num:7, role:'cta',     headline:['Start translating.','Get results.'], url:'aussiegradcareers.com.au &rarr;', cornerImage:'determined-walk' },
    ]
  },

  'the-5-step-system': {
    instagram: [
      { num:1, role:'hook',    headline:['Your job search<br>needs a system.'], subtext:'Not luck. Not another spreadsheet.<br>A repeatable process.', image:'pipeline', bgImage:true },
      { num:2, role:'content', headline:['Step 1: Diagnose.'], body:'Understand exactly what each role needs and where your profile stands relative to it.', subtext:'<span class="fw-600 text-petrol">Know before you act.</span>', image:'pensive-window' },
      { num:3, role:'ui', mock:'diagnostic-card', headline:'Your diagnostic in seconds.', caption:'The system pinpoints what you have, what you are missing, and how to bridge it.', slots:{ FIX_NUMBER:'02', FINDING_TITLE:'Your skills section lists duties. It should show outcomes.', BEFORE_TEXT:'Responsible for managing the university marketing social media accounts and creating content for the Facebook page.', AFTER_TEXT:'Grew the UniMelb Careers Facebook group from 400 to 2,400 members in 6 months through a targeted content strategy.', EXPLANATION:'Employers scan for results, not responsibilities. Quantify every achievement and name the platform or context.' } },
      { num:4, role:'content', headline:['Step 2: Bridge.'], body:'Build the missing pieces. <span class="fw-600 text-petrol">Targeted action for each gap</span> instead of guessing what to work on.', image:'targetting' },
      { num:5, role:'content', headline:['Step 3: Tailor.'], body:'Fit your story to their language. <span class="fw-600 text-petrol">Every application speaks directly</span> to what they asked for.', image:'documents' },
      { num:6, role:'content', headline:['Step 4: Apply.'], body:'Submit with purpose. <span class="fw-600 text-petrol">Track where each application stands</span> and what comes next.', image:'laptop-ambiguous' },
      { num:7, role:'content', headline:['Step 5: Track.'], body:'Follow up at the right time. <span class="fw-600 text-petrol">Know what works. Iterate.</span>', image:'determined-walk' },
      { num:8, role:'ui', mock:'tracker-pipeline', headline:'Every application. One view.', caption:'From saved to interview — know where you stand with every role.', slots:{ JOB1_STATUS:'SAVED', JOB1_AGE:'Added 2 days ago', JOB1_TITLE:'Graduate Marketing Associate', JOB1_COMPANY:'Canva &middot; Sydney', JOB2_STATUS:'APPLIED', JOB2_AGE:'Applied 5 days ago', JOB2_TITLE:'Graduate Data Analyst', JOB2_COMPANY:'Atlassian &middot; Sydney', JOB3_STATUS:'INTERVIEW', JOB3_AGE:'Interview next week', JOB3_TITLE:'Grad Software Engineer', JOB3_COMPANY:'CommBank &middot; Sydney' } },
      { num:9, role:'cta',     headline:['Get the system.','Get the job.'], url:'aussiegradcareers.com.au', cornerImage:'success-path' },
    ],
    linkedin: [
      { num:1, role:'hook',    headline:['The 5-Step System<br>for Your Job Search'], subtext:'A repeatable process. No luck required.', image:'pipeline', bgImage:true },
      { num:2, role:'content', headline:['1. Diagnose'], body:'Every job description contains a blueprint of what the employer wants. The first step is <span class="fw-600 text-petrol">understanding that blueprint</span> and measuring yourself against it.', image:'pensive-window' },
      { num:3, role:'content', headline:['2. Bridge'], body:'Where there are gaps, build. Not by guessing, but by following a <span class="fw-600 text-petrol">targeted plan</span> that addresses each specific shortfall.', image:'targetting' },
      { num:4, role:'content', headline:['3. Tailor'], body:'Generic applications get generic responses. <span class="fw-600 text-petrol">Tailored applications get interviews.</span> Framing your story in their language makes the difference.', image:'documents' },
      { num:5, role:'content', headline:['4. Track &amp; Improve'], body:'Submit, follow up, measure what works. The best job seekers treat their search as an <span class="fw-600 text-petrol">iterative process</span>, not a lottery.', image:'laptop-ambiguous' },
      { num:6, role:'ui', mock:'tracker-pipeline', headline:'Every application tracked.', caption:'Know where each application stands and what to do next.', slots:{ JOB1_STATUS:'SAVED', JOB1_AGE:'Added 2 days ago', JOB1_TITLE:'Graduate Marketing Associate', JOB1_COMPANY:'Canva &middot; Sydney', JOB2_STATUS:'APPLIED', JOB2_AGE:'Applied 5 days ago', JOB2_TITLE:'Graduate Data Analyst', JOB2_COMPANY:'Atlassian &middot; Sydney', JOB3_STATUS:'INTERVIEW', JOB3_AGE:'Interview next week', JOB3_TITLE:'Grad Software Engineer', JOB3_COMPANY:'CommBank &middot; Sydney' } },
      { num:7, role:'cta',     headline:['Stop hoping.','Start doing.'], url:'aussiegradcareers.com.au &rarr;', cornerImage:'determined-walk' },
    ]
  },

  'what-you-get': {
    instagram: [
      { num:1, role:'hook',    headline:['What if your job<br>search had a','dashboard?'], subtext:'One place to manage everything.', image:'overwhelmed', bgImage:true },
      { num:2, role:'content', headline:['Instant Diagnostic.'], body:'Paste any job description. Get a <span class="fw-600 text-petrol">full gap analysis</span> across skills, experience, and presentation in seconds.', image:'documents' },
      { num:3, role:'ui', mock:'diagnostic-card', headline:'See your gap analysis.', caption:'Before and after — the system shows you exactly what to change.', slots:{ FIX_NUMBER:'03', FINDING_TITLE:'Your summary is generic. It should be role-specific.', BEFORE_TEXT:'Hardworking and dedicated professional with a passion for marketing and a desire to grow within your organisation.', AFTER_TEXT:'Proposed and piloted a TikTok content strategy for UniMelb Careers that reached 45K students in the first month, driving a 60% increase in event attendance.', EXPLANATION:'Generic openers waste the first 6 seconds. Name what you did, where, and what happened — every time.' } },
      { num:4, role:'content', headline:['Application Tracker.'], body:'Know where every application stands. <span class="fw-600 text-petrol">Built-in follow-up reminders</span> so you never miss a thank-you or status check.', image:'laptop-ambiguous' },
      { num:5, role:'ui', mock:'tracker-pipeline', headline:'Know where you stand.', caption:'Every application. Every status. One dashboard.', slots:{ JOB1_STATUS:'SAVED', JOB1_AGE:'Added 2 days ago', JOB1_TITLE:'Graduate Marketing Associate', JOB1_COMPANY:'Canva &middot; Sydney', JOB2_STATUS:'APPLIED', JOB2_AGE:'Applied 5 days ago', JOB2_TITLE:'Graduate Data Analyst', JOB2_COMPANY:'Atlassian &middot; Sydney', JOB3_STATUS:'INTERVIEW', JOB3_AGE:'Interview next week', JOB3_TITLE:'Grad Software Engineer', JOB3_COMPANY:'CommBank &middot; Sydney' } },
      { num:6, role:'content', headline:['Bridging Tools.'], body:'Generate targeted cover letters, tailored resumes, and bridging documents that <span class="fw-600 text-petrol">close the gap</span> between you and the role.', image:'targetting' },
      { num:7, role:'ui', mock:'editor-with-rewrites', headline:'Tailored documents. AI-powered.', caption:'Paste a JD. Get a resume and cover letter built around your unique profile.', slots:{ ACTIVE_TAB:'resume', BULLET_NORMAL:'Assisted with social media content creation and scheduling for the university marketing department.', BULLET_REWRITTEN:'Developed a 12-week social media campaign for UniMelb that increased event sign-ups by 45% across Instagram and LinkedIn.' } },
      { num:8, role:'stat',    stat:'One', label:'dashboard. One workflow.<br>Every application.', body:'<span class="fw-600 text-petrol">From chaos to clarity.</span>' },
      { num:9, role:'cta',     headline:['See it for yourself.','Free to start.'], url:'aussiegradcareers.com.au', cornerImage:'success-path' },
    ],
    linkedin: [
      { num:1, role:'hook',    headline:['What If Your Job Search<br>Had a Dashboard?'], subtext:'No more spreadsheets. No more missed follow-ups. One place to manage everything.', image:'overwhelmed', bgImage:true },
      { num:2, role:'content', headline:['The Diagnostic'], body:'Paste any job description and get an <span class="fw-600 text-petrol">instant gap analysis</span>. The system identifies what you have, what you are missing, and how to bridge it.', image:'documents' },
      { num:3, role:'ui', mock:'diagnostic-card', headline:'Your gap analysis in seconds.', caption:'', slots:{ FIX_NUMBER:'03', FINDING_TITLE:'Your summary is generic. It should be role-specific.', BEFORE_TEXT:'Hardworking and dedicated professional with a passion for marketing and a desire to grow within your organisation.', AFTER_TEXT:'Proposed and piloted a TikTok content strategy for UniMelb Careers that reached 45K students in the first month, driving a 60% increase in event attendance.', EXPLANATION:'Generic openers waste the first 6 seconds. Name what you did, where, and what happened — every time.' } },
      { num:4, role:'content', headline:['The Tracker'], body:'Every application in one view. Status, next steps, follow-up reminders. <span class="fw-600 text-petrol">Never lose track</span> of where you stand with any employer.', image:'laptop-ambiguous' },
      { num:5, role:'ui', mock:'tracker-pipeline', headline:'Every application. One view.', caption:'', slots:{ JOB1_STATUS:'SAVED', JOB1_AGE:'Added 2 days ago', JOB1_TITLE:'Graduate Marketing Associate', JOB1_COMPANY:'Canva &middot; Sydney', JOB2_STATUS:'APPLIED', JOB2_AGE:'Applied 5 days ago', JOB2_TITLE:'Graduate Data Analyst', JOB2_COMPANY:'Atlassian &middot; Sydney', JOB3_STATUS:'INTERVIEW', JOB3_AGE:'Interview next week', JOB3_TITLE:'Grad Software Engineer', JOB3_COMPANY:'CommBank &middot; Sydney' } },
      { num:6, role:'content', headline:['Bridging Tools'], body:'Generate tailored applications that <span class="fw-600 text-petrol">speak directly to each role</span>. Cover letters, resumes, key selection criteria responses built around your unique profile.', image:'targetting' },
      { num:7, role:'ui', mock:'editor-with-rewrites', headline:'Tailored. Targeted. Effective.', caption:'', slots:{ ACTIVE_TAB:'resume', BULLET_NORMAL:'Assisted with social media content creation and scheduling for the university marketing department.', BULLET_REWRITTEN:'Developed a 12-week social media campaign for UniMelb that increased event sign-ups by 45% across Instagram and LinkedIn.' } },
      { num:8, role:'stat',    stat:'1', label:'dashboard. 1 workflow. Every application.', body:'<span class="fw-600 text-petrol">From chaos to clarity.</span>' },
      { num:9, role:'cta',     headline:['Try it free.','No credit card needed.'], url:'aussiegradcareers.com.au &rarr;', cornerImage:'success-path' },
    ]
  },

  'your-first-step': {
    instagram: [
      { num:1, role:'hook',    headline:['You have already<br>done the','hard part.'], subtext:'You moved countries. You built a life.<br>This is just the next step.', image:'determined-walk', bgImage:true },
      { num:2, role:'deep',    headline:['Everything you have<br>overcome.'], body:'The visa process. The move. The loneliness. The constant question of whether you made the right choice.', subtext:'You are still here. That matters.', deepBg:true, image:'pensive-window', bgImage:true },
      { num:3, role:'content', headline:['Now let us make it<br>count.'], body:'The same determination that got you here will get you the role. You just need <span class="fw-600 text-petrol">the right system</span>.', image:'three-steps' },
      { num:4, role:'stat',    stat:'Free', label:'diagnostic tool. No time limit.<br>No credit card required.', body:'<span class="fw-600 text-petrol">Zero risk. All value.</span>' },
      { num:5, role:'list',    headline:'What you get when<br>you sign up:', items:['Instant job description analysis','Personalised gap assessment','Application tracking system','Follow-up tools and templates'] },
      { num:6, role:'ui', mock:'process-strip', headline:'Your workflow.', caption:'From paste to track in one seamless platform.', slots:{ CURRENT_STEP:'analyse', CAPTION:'Hit Analyse. We build your tailored resume and cover letter based on your unique profile.' } },
      { num:7, role:'cta',     headline:['You have got this.','We have got the tools.'], url:'aussiegradcareers.com.au', cornerImage:'success-path' },
    ],
    linkedin: [
      { num:1, role:'hook',    headline:['You Have Already Done<br>the Hard Part.'], subtext:'Everything after this is just the next chapter. And you are not alone in writing it.', image:'determined-walk', bgImage:true },
      { num:2, role:'deep',    headline:['The Journey So Far'], body:'The visa. The move. The uncertainty. The courage to leave everything behind and start again in a new country.', subtext:'That took more strength than any job application ever will.', deepBg:true, image:'pensive-window', bgImage:true },
      { num:3, role:'stat',    stat:'Free', label:'No time limit. No credit card.<br>Just the system you deserve.', body:'<span class="fw-600 text-petrol">Start with a single job description.</span>' },
      { num:4, role:'content', headline:['What Happens Next'], body:'You sign up. You paste a job description. You get a <span class="fw-600 text-petrol">personalised diagnostic</span>. You start building your bridge to the role. One step at a time.', image:'laptop-ambiguous' },
      { num:5, role:'list',    headline:'Your first 15 minutes:', items:['Create your free account','Paste any job description','Get your instant gap analysis','Start your first bridging action'] },
      { num:6, role:'ui', mock:'process-strip', headline:'Your 5-step workflow.', caption:'Paste. Analyse. Tailor. Save. Track.', slots:{ CURRENT_STEP:'analyse', CAPTION:'Hit Analyse. We build your tailored resume and cover letter based on your unique profile.' } },
      { num:7, role:'cta',     headline:['Start your free account.','aussiegradcareers.com.au'], url:'aussiegradcareers.com.au &rarr;', cornerImage:'success-path' },
    ]
  },
};

// ── Run safeguards before building ──────────────────────────────────
ensureProcessedImages();
verifyImages();
console.log('');

// ── Build ────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }

for (const [topic, platforms] of Object.entries(CAROUSELS)) {
  const topicSlug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  for (const [platform, slides] of Object.entries(platforms)) {
    const isLinkedIn = platform === 'linkedin';
    const slideDir = resolve(SRC, platform, topicSlug);
    mkdirSync(slideDir, { recursive: true });

    for (const slide of slides) {
      const html = slideHTML({ ...slide, title: `${topic} - ${platform} ${pad(slide.num)}` }, slides.length, isLinkedIn);
      const filePath = resolve(slideDir, `slide-${pad(slide.num)}.html`);
      writeFileSync(filePath, html, 'utf-8');
    }
    console.log(`  Built ${platform}/${topicSlug} (${slides.length} slides)`);
  }
}

console.log(`\nAll carousels built.`);
