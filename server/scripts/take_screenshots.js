/**
 * JobHub Marketing Screenshot Suite
 * ====================================
 * Uses Playwright to capture key emotional and functional moments
 * from the app for marketing and product promotion.
 *
 * All API calls are mocked so screenshots show perfect, curated data.
 * Run: node server/scripts/take_screenshots.js
 */

'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const APP_URL = 'http://localhost:5175';
const OUT_DIR = path.join(__dirname, '../../screenshots');
const SUPABASE_URL = 'https://wnpmqyjhuuayirpanzzz.supabase.co';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: '00ddaaef-1799-4591-bbb5-536f6f81769e',
  email: 'kiron182@gmail.com',
  user_metadata: { full_name: 'Kiron Kurian' }
};

const MOCK_SESSION = {
  access_token: 'mock_access_token_' + Date.now(),
  refresh_token: 'mock_refresh_token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 7200,
  token_type: 'bearer',
  user: MOCK_USER
};

const MOCK_PROFILE = {
  id: MOCK_USER.id,
  userId: MOCK_USER.id,
  name: 'Kiron Kurian',
  email: 'kiron182@gmail.com',
  phone: '+61 412 345 678',
  location: 'Sydney, NSW, Australia',
  linkedin: 'linkedin.com/in/kironkurian',
  professionalSummary: 'Senior ICT Project Manager with 12+ years delivering complex digital transformation programmes across government and enterprise. Proven track record leading $4M–$18M multi-vendor technology programmes with a focus on risk governance, stakeholder alignment, and on-time delivery. PRINCE2 Practitioner certified.',
  skills: {
    technical: ['PRINCE2', 'PMBOK', 'Jira', 'Confluence', 'MS Project', 'Azure DevOps', 'Agile/Scrum', 'Risk Management'],
    industryKnowledge: ['Digital Transformation', 'Government ICT', 'Vendor Management', 'Change Management'],
    softSkills: ['Executive Stakeholder Engagement', 'Cross-functional Leadership', 'Strategic Communication']
  },
  experience: [
    {
      role: 'Senior ICT Project Manager',
      company: 'NSW Department of Customer Service',
      startDate: '2021-03',
      endDate: 'Present',
      bullets: [
        'Led $18M digital service transformation programme delivering a new citizen portal across 4 agencies, 6 weeks ahead of schedule',
        'Managed 3 concurrent multi-vendor ICT implementations, coordinating 14 contractors and 6 internal teams',
        'Reduced project reporting cycle from 3 weeks to 4 days by implementing real-time dashboards via Azure DevOps'
      ]
    },
    {
      role: 'ICT Project Manager',
      company: 'Telstra Enterprise',
      startDate: '2018-06',
      endDate: '2021-02',
      bullets: [
        'Delivered $4.2M network infrastructure upgrade across 12 sites, 98.7% on-budget',
        'Established PMO governance framework adopted across 3 business units, reducing escalations by 40%'
      ]
    }
  ],
  education: [{ institution: 'University of Technology Sydney', degree: 'Bachelor of Business (Information Systems)', year: '2012' }],
  certifications: [
    { name: 'PRINCE2 Practitioner', issuer: 'AXELOS', year: '2019' },
    { name: 'PMP', issuer: 'PMI', year: '2020' }
  ],
  volunteering: [{ org: 'Code Like a Girl', role: 'Mentor', desc: 'Monthly mentoring sessions for women entering tech careers' }],
  languages: [{ name: 'English', proficiency: 'Native' }, { name: 'Malayalam', proficiency: 'Conversational' }],
  achievements: [
    { id: 'ach1', title: '$18M Digital Portal Delivery', description: 'Led $18M digital transformation — 6 weeks early', metric: '$18M, 6 weeks early', metricType: 'Scale' },
    { id: 'ach2', title: 'PMO Framework Rollout', description: 'Reduced escalations by 40% across 3 business units', metric: '40% reduction', metricType: 'Efficiency' },
    { id: 'ach3', title: '14-Vendor Programme Management', description: 'Coordinated 14 contractors, 6 internal teams simultaneously', metric: '14 vendors', metricType: 'Scale' }
  ],
  completion: {
    score: 95,
    isReady: true,
    missingFields: []
  }
};

const MOCK_ACHIEVEMENTS = [
  { id: 'ach1', title: '$18M Digital Portal Delivery — 6 Weeks Early', description: 'Led end-to-end delivery of the NSW citizen portal, coordinating 4 agencies, 14 contractors and 6 internal teams. Delivered 6 weeks ahead of the original 18-month timeline.', metric: '$18M, 6 weeks early', metricType: 'Scale', industry: 'Government ICT', skills: ['PRINCE2', 'Stakeholder Management', 'Programme Delivery'], tags: ['government', 'digital-transformation'] },
  { id: 'ach2', title: 'PMO Governance Framework — 40% Escalation Reduction', description: 'Designed and implemented a PMO governance framework adopted across 3 Telstra business units, cutting executive escalations by 40% within 6 months.', metric: '40% reduction', metricType: 'Efficiency', industry: 'Telecommunications', skills: ['PMO', 'PRINCE2', 'Process Design'], tags: ['governance', 'leadership'] },
  { id: 'ach3', title: '$4.2M Network Upgrade — 98.7% On Budget', description: 'Delivered 12-site network infrastructure programme at $4.2M, tracking at 98.7% of approved budget. Zero unplanned outages during cutover.', metric: '$4.2M, 98.7% on-budget', metricType: 'Cost', industry: 'Telecommunications', skills: ['Budget Management', 'Risk Management', 'Vendor Management'], tags: ['infrastructure', 'budget'] },
  { id: 'ach4', title: 'Real-Time Reporting: 3 Weeks → 4 Days', description: 'Redesigned project reporting using Azure DevOps dashboards, compressing reporting cycle from 3 weeks to 4 days — enabling faster executive decision-making.', metric: '75% time reduction', metricType: 'Efficiency', industry: 'Government', skills: ['Azure DevOps', 'Data Visualisation', 'Reporting'], tags: ['automation', 'efficiency'] },
];

const MOCK_JOBS = [
  { id: 'job1', company: 'NSW Government', role: 'ICT Project Manager', status: 'IN_PROGRESS', matchScore: 92, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'job2', company: 'Atlassian', role: 'Senior Programme Manager', status: 'APPLIED', matchScore: 67, createdAt: new Date(Date.now() - 172800000).toISOString() },
  { id: 'job3', company: 'Canva', role: 'AI Product Manager', status: 'INTERVIEW', matchScore: 74, createdAt: new Date(Date.now() - 259200000).toISOString() },
];

const MOCK_ANALYSIS_GOOD = {
  matchScore: 92,
  keywords: ['ICT Project Manager', 'PRINCE2', 'Digital Transformation', 'Stakeholder Management', 'Programme Delivery', 'Government', 'Risk Management', 'Multi-vendor'],
  analysisTone: 'Government & Formal',
  requiresSelectionCriteria: false,
  coreCompetencies: ['Complex programme delivery', 'Executive stakeholder management', 'Risk and governance frameworks'],
  extractedMetadata: { company: 'NSW Government', role: 'ICT Project Manager' },
  jobApplicationId: 'job1',
  hasSufficientEvidence: true,
  rankedAchievements: [
    { id: 'ach1', relevanceScore: 96, tier: 'STRONG', reason: 'Direct match: $18M government digital transformation maps exactly to the JD\'s "$1M–$10M ICT project" requirement and citizen-facing digital service context.' },
    { id: 'ach2', relevanceScore: 88, tier: 'STRONG', reason: 'PMO governance framework directly evidences the PMBOK/PRINCE2 methodology requirement and "project governance" emphasis in the JD.' },
    { id: 'ach4', relevanceScore: 82, tier: 'STRONG', reason: 'Real-time reporting achievement proves the "status reports for executive audiences" and Steering Committee reporting requirement.' },
    { id: 'ach3', relevanceScore: 71, tier: 'MODERATE', reason: 'Budget management at scale demonstrates financial accountability, though the government context is less direct than other achievements.' },
  ]
};

const MOCK_ANALYSIS_BAD = {
  matchScore: 18,
  keywords: ['Machine Learning', 'PyTorch', 'LLM Fine-tuning', 'CUDA', 'Model Architecture', 'Research Publications', 'PhD', 'Computer Vision'],
  analysisTone: 'Deep Tech / Research',
  requiresSelectionCriteria: false,
  coreCompetencies: ['ML model development and training', 'Research publication track record', 'Deep learning architecture expertise'],
  extractedMetadata: { company: 'Google DeepMind', role: 'Senior ML Research Scientist' },
  jobApplicationId: 'job-bad',
  hasSufficientEvidence: false,
  evidenceWarning: 'You have 0 achievements matching the core ML/research requirements. This role requires a PhD and 5+ publications.',
  rankedAchievements: [
    { id: 'ach1', relevanceScore: 8, tier: 'WEAK', reason: 'Government programme management has no overlap with ML research. DeepMind requires deep learning expertise, not ICT delivery methodology.' },
    { id: 'ach2', relevanceScore: 5, tier: 'WEAK', reason: 'PMO governance frameworks are not relevant to a research scientist role focused on model architecture and academic output.' },
    { id: 'ach3', relevanceScore: 3, tier: 'WEAK', reason: 'Network infrastructure delivery demonstrates no evidence of ML engineering, CUDA programming, or research capabilities required by this role.' },
    { id: 'ach4', relevanceScore: 2, tier: 'WEAK', reason: 'Azure DevOps dashboards are unrelated to PyTorch model development, academic research, or the deep learning stack central to this role.' },
  ]
};

const MOCK_BLUEPRINT = {
  openingHook: "NSW's digital modernisation agenda — particularly the Department of Customer Service's mandate to unify 14 citizen-facing services under a single platform — is exactly the complexity I've built my programme management practice around.",
  positioningStatement: "As a PRINCE2 Practitioner and PMP with 12 years in government ICT delivery, I bring a proven framework for managing multi-vendor complexity at the $10M+ scale this role demands. My recent $18M NSW portal programme — delivered 6 weeks ahead of schedule — maps directly to the citizen-facing digital service context described in this JD.",
  proofPoints: [
    { achievementId: 'ach1', framingAngle: 'Lead with the scale and government context — JD is cost-obsessed and programme-scale focused', jdConnection: '"manage end-to-end delivery of ICT projects valued between $1M–$10M"', narrativeNote: 'Surface the 4-agency coordination complexity, not just the dollar value — that\'s the stakeholder management story' },
    { achievementId: 'ach2', framingAngle: 'Frame as methodology discipline, not just process improvement', jdConnection: '"Apply PMBOK or PRINCE2 methodology to ensure disciplined project governance"', narrativeNote: 'Connect the 40% escalation reduction to executive confidence — the Steering Committee reporting dimension' },
  ],
  messagingAngles: [
    'Programme governance at scale — not just task management',
    'Citizen-facing digital delivery in the NSW government context',
    'Multi-vendor coordination and contract administration',
    'Executive Steering Committee reporting and ministerial briefing experience'
  ],
  toneBlueprint: 'Formal and evidence-first. The JD uses "disciplined", "governance", "executive" and "ministerial" — this employer values gravitas over enthusiasm. No startup language.',
  structureNotes: 'Cover letter: 4 tight paragraphs. No fluff. Hook → Evidence → Governance credentials → CTA. Aim for 380–420 words.',
  pitfallFlags: [
    'I am writing to express my strong interest in',
    'I am a passionate project manager',
    'I believe I would be a great fit',
    'I am excited about the opportunity to',
    'With my years of experience',
    'I am a people person',
    'dynamic and results-driven professional'
  ],
  employerInsight: "The NSW Department of Customer Service's 2024–2025 Digital Strategy explicitly names the consolidation of 14 agency portals as its top delivery priority — a direct match for this candidate's recent $18M citizen portal programme.",
  sector: 'GOVERNMENT'
};

const MOCK_COVER_LETTER = `NSW's digital modernisation agenda — particularly the Department of Customer Service's mandate to unify 14 citizen-facing services under a single platform — is exactly the complexity I've built my programme management practice around.

Over the past 4 years at NSW DCS, I led the $18M digital citizen portal programme: 4 agencies, 14 external contractors, 6 internal delivery teams, and an 18-month timeline that we closed 6 weeks early. The programme's governance architecture — weekly Steering Committee reporting, monthly ministerial briefings, and a structured risk register maintained across 22 concurrent workstreams — maps directly to what this ICT Project Manager role demands. PRINCE2 Practitioner and PMP certified, with procurement and contract administration experience across NSW Government frameworks.

At Telstra Enterprise before that, I designed a PMO governance framework adopted across 3 business units that cut executive escalations by 40% within 6 months. That result came from building reporting systems that gave senior leaders genuine visibility — not status updates that consumed their time without informing their decisions. The $4.2M network infrastructure programme I managed across 12 sites finished at 98.7% of approved budget with zero unplanned outages during cutover: the kind of financial discipline and operational rigour that Government ICT projects require.

The NSW Digital Strategy's 2024–2025 priority — consolidating 14 agency portals — is work I have done at scale. I would welcome the opportunity to discuss how my programme delivery record translates to this specific engagement.

I hold full working rights in Australia and am available to commence within 4 weeks of offer.`;

const MOCK_RESUME = `# Kiron Kurian
*ICT Project Manager | Digital Transformation | Government*
kiron182@gmail.com | +61 412 345 678 | linkedin.com/in/kironkurian | Sydney, NSW, Australia

## Professional Summary
Senior ICT Project Manager with 12+ years delivering complex digital transformation programmes across government and enterprise. Proven track record leading $4M–$18M multi-vendor technology programmes with a focus on risk governance, stakeholder alignment, and on-time delivery. PRINCE2 Practitioner and PMP certified.

## Skills

**Technical Skills:** PRINCE2 • PMBOK • Jira • Confluence • MS Project • Azure DevOps • Agile/Scrum • Risk Management

**Industry Knowledge:** Digital Transformation • Government ICT • Vendor Management • Change Management

**Soft Skills:** Executive Stakeholder Engagement • Cross-functional Leadership • Strategic Communication

## Experience

### Senior ICT Project Manager
**NSW Department of Customer Service** | Mar 2021 – Present

- Led $18M digital citizen portal programme across 4 agencies and 14 contractors, delivered 6 weeks ahead of the 18-month schedule
- Managed 3 concurrent multi-vendor ICT implementations coordinating 14 external contractors and 6 internal teams
- Compressed project reporting cycle from 3 weeks to 4 days via Azure DevOps real-time dashboards — enabling faster Steering Committee decision-making
- Prepared monthly executive status reports and ministerial briefings for delivery programmes valued $1M–$18M

### ICT Project Manager
**Telstra Enterprise** | Jun 2018 – Feb 2021

- Delivered $4.2M network infrastructure upgrade across 12 sites at 98.7% of approved budget with zero unplanned outages during cutover
- Designed PMO governance framework adopted across 3 business units — reduced executive escalations by 40% within 6 months

## Education
**Bachelor of Business (Information Systems)** — University of Technology Sydney, 2012

## Certifications
- PRINCE2 Practitioner — AXELOS (2019)
- PMP — Project Management Institute (2020)

## Volunteering
**Mentor** — Code Like a Girl | Monthly mentoring for women entering technology careers`;

// ─── Screenshot helper ───────────────────────────────────────────────────────

async function shot(page, name, caption) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`📸  ${name}.png — ${caption}`);
  return file;
}

async function shotElement(page, selector, name, caption) {
  const el = await page.$(selector);
  if (el) {
    const file = path.join(OUT_DIR, `${name}.png`);
    await el.screenshot({ path: file });
    console.log(`📸  ${name}.png — ${caption}`);
    return file;
  }
  console.warn(`⚠️  Element not found for ${name}: ${selector}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\nJobHub Marketing Screenshot Suite');
  console.log('===================================\n');

  const browser = await chromium.launch({
    headless: false, // Visible so we can see what's happening
    args: ['--window-size=1440,900']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // Retina quality
  });

  const page = await context.newPage();

  // ── Mock Supabase auth endpoints ──
  await page.route(`${SUPABASE_URL}/auth/v1/**`, async route => {
    const url = route.request().url();
    if (url.includes('/user') || url.includes('/session')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_USER)
      });
    } else if (url.includes('/token')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSION)
      });
    } else {
      await route.continue();
    }
  });

  // ── Mock backend API endpoints ──
  await page.route('http://localhost:3002/api/**', async route => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/profile')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROFILE) });
    } else if (url.includes('/achievements/count')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 4 }) });
    } else if (url.includes('/achievements')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ACHIEVEMENTS) });
    } else if (url.includes('/jobs')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_JOBS) });
    } else if (url.includes('/analyze/job') && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      const isLowMatch = body.jobDescription?.toLowerCase().includes('machine learning') ||
                         body.jobDescription?.toLowerCase().includes('deepmind');
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(isLowMatch ? MOCK_ANALYSIS_BAD : MOCK_ANALYSIS_GOOD)
      });
    } else if (url.includes('/generate/cover-letter') && method === 'POST') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ content: MOCK_COVER_LETTER, id: 'doc1', costBreakdown: { stage1_cached: false, total_cost_usd: 0.0187 }, blueprint: MOCK_BLUEPRINT })
      });
    } else if (url.includes('/generate/resume') && method === 'POST') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ content: MOCK_RESUME, id: 'doc2', costBreakdown: { stage1_cached: true, total_cost_usd: 0.0021 }, blueprint: MOCK_BLUEPRINT })
      });
    } else if (url.includes('/health')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    }
  });

  // ── Inject Supabase session into localStorage before app loads ──
  await page.addInitScript((session) => {
    const key = 'sb-wnpmqyjhuuayirpanzzz-auth-token';
    localStorage.setItem(key, JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      token_type: 'bearer',
      user: session.user
    }));
    // Also inject job state for workspace
    localStorage.setItem('jobhub_current_jd', 'ICT Project Manager — NSW Department of Customer Service\n\nManage end-to-end delivery of ICT projects valued between $1M–$10M...');
  }, MOCK_SESSION);

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ════════════════════════════════════════════════════════════
  // SCREENSHOT 1: Dashboard — The Command Centre
  // ════════════════════════════════════════════════════════════
  console.log('\n── Screenshot 1: Dashboard ──');
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await sleep(2000);
  await shot(page, '01_dashboard',
    'The Dashboard — "Good Evening, Kiron" — personalised command centre showing active applications and achievement count');

  // ════════════════════════════════════════════════════════════
  // SCREENSHOT 2: Match Engine — Paste JD
  // ════════════════════════════════════════════════════════════
  console.log('\n── Screenshot 2: Match Engine — JD input ──');
  const jdText = `ICT Project Manager — NSW Department of Customer Service, Sydney NSW

The NSW Department of Customer Service is undertaking a major digital modernisation programme. We are seeking an experienced ICT Project Manager to lead the delivery of a new citizen-facing digital service platform.

About the Role
• Manage end-to-end delivery of ICT projects valued between $1M–$10M
• Apply PMBOK or PRINCE2 methodology to ensure disciplined project governance
• Manage project budgets, procurement, and contract administration
• Report monthly to Steering Committee and prepare ministerial briefings

About You
• 5+ years of ICT project management experience in government
• PMP, PRINCE2 Practitioner or equivalent certification (mandatory)

Salary: $120,000 – $140,000 + super (Grade 11/12)
Location: Parramatta, NSW (hybrid — 3 days on-site)`;

  await page.fill('textarea[placeholder*="Paste Job Description"]', jdText);
  await sleep(800);
  await shot(page, '02_match_engine_input',
    'Match Engine — paste any job description and let the AI do the analysis');

  // ════════════════════════════════════════════════════════════
  // SCREENSHOT 3: High Match Result (92%)
  // ════════════════════════════════════════════════════════════
  console.log('\n── Screenshot 3: High match result ──');
  await page.click('button:has-text("Analyse This Role")');
  await sleep(2500);
  await shot(page, '03_match_result_high',
    '92% match — the green light moment. "Your achievements map directly to what this employer is looking for."');

  // ════════════════════════════════════════════════════════════
  // SCREENSHOT 4: Low Match Warning Modal
  // ════════════════════════════════════════════════════════════
  console.log('\n── Screenshot 4: Low Match Warning ──');
  // Set up a low-match JD
  await page.click('button:has-text("Reset")').catch(() => {});
  await sleep(500);

  const badJD = `Senior ML Research Scientist — Google DeepMind, Sydney NSW

We are looking for an exceptional ML Research Scientist to join our fundamental research team. You will develop novel deep learning architectures, publish at top-tier venues (NeurIPS, ICML, ICLR), and contribute to foundational AI safety research.

Requirements:
• PhD in Machine Learning, Computer Science, or related field
• 5+ peer-reviewed publications at top ML conferences
• Expert-level PyTorch, CUDA programming
• Experience with LLM pre-training at scale
• Demonstrated research contributions to model architecture or training methodology`;

  await page.fill('textarea[placeholder*="Paste Job Description"]', badJD);
  await sleep(500);
  await page.click('button:has-text("Analyse This Role")');
  await sleep(2500);
  await shot(page, '04_low_match_result',
    '18% match — the warning signal appears even before the modal. Red score, clear signal.');

  // Click "Write Cover Letter" to trigger the low match modal
  await page.click('button:has-text("Write Cover Letter")').catch(() => {});
  await sleep(800);
  await shot(page, '05_low_match_modal',
    'LOW MATCH GATE — "This Role Is a Significant Mismatch." The app actively protects users from wasting their best effort on poor-fit applications.');

  // Close modal and go back to good match
  await page.click('button:has-text("Go Back")').catch(() =>
    page.keyboard.press('Escape').catch(() => {})
  );
  await sleep(500);

  // ════════════════════════════════════════════════════════════
  // SCREENSHOT 5: Navigate to Workspace with Good Match
  // ════════════════════════════════════════════════════════════
  console.log('\n── Screenshot 5: Workspace loading ──');

  // Reset to good match
  await page.click('button:has-text("Reset")').catch(() => {});
  await sleep(400);
  await page.fill('textarea[placeholder*="Paste Job Description"]', jdText);
  await sleep(300);
  await page.click('button:has-text("Analyse This Role")');
  await sleep(2500);

  // Navigate to workspace
  await page.evaluate(() => {
    const analysis = {
      matchScore: 92,
      rankedAchievements: [
        { id: 'ach1', relevanceScore: 96, tier: 'STRONG', reason: 'Direct match to $18M government digital portal programme' },
        { id: 'ach2', relevanceScore: 88, tier: 'STRONG', reason: 'PMO governance maps to PRINCE2/PMBOK requirement' },
        { id: 'ach4', relevanceScore: 82, tier: 'STRONG', reason: 'Real-time reporting proves Steering Committee capability' },
        { id: 'ach3', relevanceScore: 71, tier: 'MODERATE', reason: 'Budget management demonstrates financial discipline' },
      ],
      analysisTone: 'Government & Formal',
      coreCompetencies: ['Complex programme delivery', 'Executive stakeholder management', 'Risk governance'],
      extractedMetadata: { company: 'NSW Government', role: 'ICT Project Manager' },
      jobApplicationId: 'job1',
      requiresSelectionCriteria: false
    };
    const jd = 'ICT Project Manager — NSW Department of Customer Service...';
    localStorage.setItem('jobhub_current_analysis', JSON.stringify(analysis));
    localStorage.setItem('jobhub_current_jd', jd);
    localStorage.setItem('jobhub_current_tab', 'cover-letter');
    localStorage.setItem('jobhub_current_docs', JSON.stringify({ resume: '', 'cover-letter': '', 'selection-criteria': '' }));
    localStorage.setItem('jobhub_current_docids', JSON.stringify({ resume: null, 'cover-letter': null, 'selection-criteria': null }));
  });

  await page.goto(`${APP_URL}/application-workspace`, { waitUntil: 'networkidle' });
  await sleep(3000); // Wait for cover letter generation mock

  await shot(page, '06_workspace_cover_letter',
    'Application Workspace — the generated cover letter appears. Professional, specific, evidence-backed. Not a template.');

  // ════════════════════════════════════════════════════════════
  // SCREENSHOT 6: Strategist Debrief — collapsed state
  // ════════════════════════════════════════════════════════════
  console.log('\n── Screenshot 6: Strategist Debrief ──');
  await shot(page, '07_strategist_debrief_closed',
    '"Strategist\'s Notes" pill visible below the document — one click away from understanding every AI decision');

  // Open the debrief
  await page.click('button:has-text("Strategist\'s Notes")').catch(async () => {
    // Try alternate selector
    await page.click('[class*="StrategistDebrief"] button').catch(() =>
      page.click('text=Strategist\'s Notes').catch(() => {})
    );
  });
  await sleep(600);

  await shot(page, '08_strategist_debrief_open',
    'STRATEGIST\'S NOTES — Full debrief open. "Here\'s the opening hook we chose and why. Here\'s which achievements we used and how they were framed."');

  // ════════════════════════════════════════════════════════════
  // SCREENSHOT 7: Language Blocked section
  // ════════════════════════════════════════════════════════════
  console.log('\n── Screenshot 7: Scroll to Language Blocked ──');
  await page.evaluate(() => {
    const blocker = document.querySelector('[class*="line-through"]')?.closest('[class*="p-5"]');
    if (blocker) blocker.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await sleep(500);
  await shot(page, '09_language_blocked',
    'LANGUAGE BLOCKED — every strikethrough phrase was suppressed from the output. "I am excited to apply" never made it in. The AI actively fought cliché on your behalf.');

  // ════════════════════════════════════════════════════════════
  // SCREENSHOT 8: Switch to Resume tab
  // ════════════════════════════════════════════════════════════
  console.log('\n── Screenshot 8: Resume tab ──');
  await page.click('button:has-text("resume")').catch(() =>
    page.click('[class*="tab"]:has-text("Resume")').catch(() => {})
  );
  await sleep(2500);
  await shot(page, '10_workspace_resume',
    'The tailored resume — auto-generated from the same AI strategy blueprint as the cover letter. One cohesive narrative across both documents.');

  // ════════════════════════════════════════════════════════════
  // SCREENSHOT 9: Achievement Bank
  // ════════════════════════════════════════════════════════════
  console.log('\n── Screenshot 9: Achievement Bank ──');
  await page.goto(`${APP_URL}/workspace`, { waitUntil: 'networkidle' });
  await sleep(2000);
  await shot(page, '11_achievement_bank',
    'Achievement Bank — every career win, stored, searchable, and ready to deploy. The raw material the AI builds your applications from.');

  // ════════════════════════════════════════════════════════════
  // SCREENSHOT 10: Application Tracker
  // ════════════════════════════════════════════════════════════
  console.log('\n── Screenshot 10: Application Tracker ──');
  // Navigate to tracker tab if available
  await page.evaluate(() => {
    // Try clicking Applications nav item
    document.querySelectorAll('a, button, nav *').forEach(el => {
      if (el.textContent?.trim().toLowerCase().includes('applications') || el.textContent?.trim().toLowerCase().includes('tracker')) {
        el.click();
      }
    });
  });
  await sleep(1500);
  await shot(page, '12_application_tracker',
    'Application Tracker — every job at a glance. Status, match score, document access. Your pipeline, organised.');

  // ════════════════════════════════════════════════════════════
  // FINAL COMPOSITE: Full workspace with proof points
  // ════════════════════════════════════════════════════════════
  console.log('\n── Final: Back to workspace for proof points close-up ──');
  await page.goto(`${APP_URL}/application-workspace`, { waitUntil: 'networkidle' });
  await sleep(3000);
  await page.click('button:has-text("Strategist\'s Notes")').catch(() =>
    page.click('text=Strategist\'s Notes').catch(() => {})
  );
  await sleep(800);

  // Scroll to proof points
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('span, p, div'))
      .find(e => e.textContent?.trim() === 'Why These Achievements Were Chosen');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await sleep(500);
  await shot(page, '13_proof_points',
    'PROOF POINTS — "Here\'s which achievement we chose and how we framed it for this specific role." Transparency that builds trust.');

  // ─── Done ─────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅  ${fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).length} screenshots saved to:`);
  console.log(`   ${OUT_DIR}`);
  console.log(`${'─'.repeat(50)}\n`);

  // Keep browser open for 5 seconds so user can see the final state
  await sleep(5000);
  await browser.close();
}

run().catch(err => {
  console.error('Screenshot error:', err);
  process.exit(1);
});
