/**
 * JobHub QA Test Runner — Comprehensive Case Study Edition
 * =========================================================
 * Processes all resumes through the full pipeline:
 * extract → profile save → job analysis → cover letter → resume
 *
 * Outputs a rich case study report to server/scripts/qa_report.md
 *
 * Prerequisites:
 *   - Server running on localhost:3002
 *   - DEV_BYPASS_AUTH=true in server/.env
 *   - MAX_DAILY_GENERATIONS=100 in server/.env
 *
 * Run: node server/scripts/run_qa_tests.js
 *
 * WARNING: This test overwrites the profile of the bypass user account.
 * Re-import your own resume after running.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const BASE_URL = 'http://localhost:3002/api';
const RESUMES_DIR = path.join(__dirname, '../../Resumes');
const REPORT_PATH = path.join(__dirname, 'qa_report.md');

// ─── 10 Real-world Australian Job Descriptions ─────────────────────────────

const JOBS = [
  {
    id: 'J01',
    title: 'Senior Software Engineer – React/Node.js',
    company: 'Atlassian',
    field: 'software',
    jd: `Senior Software Engineer — Atlassian, Sydney NSW

Atlassian is looking for a Senior Software Engineer to join our Cloud Platform team. You will design, build and maintain scalable services that power Jira, Confluence and Trello for millions of users worldwide.

About the Role
• Design and implement full-stack features using React, TypeScript, and Node.js
• Lead technical design reviews and code reviews within an Agile squad
• Collaborate with Product Managers and UX Designers to deliver high-quality user experiences
• Champion engineering best practices: testing, observability, CI/CD, and documentation
• Mentor junior engineers and contribute to technical hiring decisions

About You
• 5+ years of professional software engineering experience
• Deep expertise in React, TypeScript and modern JavaScript (ES2020+)
• Strong backend experience with Node.js, REST APIs, and microservices
• Experience with cloud platforms (AWS, GCP or Azure) and Docker/Kubernetes
• Comfortable working in a distributed team across multiple time zones
• Strong communication skills and ability to translate technical concepts for non-technical stakeholders

Nice to Have
• Experience with GraphQL
• Contributions to open-source projects
• Familiarity with Atlassian products

Atlassian is an equal opportunity employer and welcomes candidates from all backgrounds. Candidates with international experience are encouraged to apply.

Salary: $140,000 – $175,000 + equity + benefits
Location: Sydney, NSW (hybrid — 2 days in office)`
  },
  {
    id: 'J02',
    title: 'AI Engineer – Agent Systems & Automation',
    company: 'Canva',
    field: 'ai',
    jd: `AI Engineer — Canva, Melbourne VIC

Canva's AI team is building the next generation of creative tools powered by large language models and autonomous agents. We are looking for an AI Engineer to join our Agent Systems team and help design the workflows that make Canva Magic real.

About the Role
• Design and implement LLM-powered automation pipelines using Python and TypeScript
• Build and evaluate multi-agent workflows using frameworks such as LangChain, LlamaIndex, or AutoGen
• Develop robust RAG (Retrieval-Augmented Generation) systems using vector databases (Pinecone, Weaviate, or equivalent)
• Evaluate model outputs at scale — build red-teaming tools, benchmark harnesses, and quality gates
• Collaborate with ML Engineers and Product teams to move AI experiments into production

About You
• 3+ years of software engineering experience with at least 1 year focused on LLM/AI systems
• Strong Python skills; TypeScript is a plus
• Practical experience with at least one agent orchestration framework
• Comfortable working with embeddings, vector search, and semantic retrieval
• Deep understanding of prompt engineering, few-shot learning and in-context learning
• Strong written communication — you can explain complex AI behaviour clearly

Nice to Have
• Experience fine-tuning or evaluating open-source models (Llama, Mistral, etc.)
• Background in ML Ops (model serving, monitoring, experiment tracking)
• Prior experience at a product company where you shipped AI features to end-users

Salary: $130,000 – $165,000 + equity
Location: Melbourne, VIC (hybrid)`
  },
  {
    id: 'J03',
    title: 'Business Analyst – Digital Transformation',
    company: 'Deloitte',
    field: 'business_analysis',
    jd: `Business Analyst — Digital Transformation — Deloitte, Brisbane QLD

Deloitte's Technology & Digital practice is looking for a Business Analyst to join a major financial services client engagement. You will bridge business strategy and technology delivery across a multi-year core banking transformation.

About the Role
• Elicit, document and validate business requirements from senior stakeholders
• Facilitate workshops and interviews with operational and executive teams
• Translate business needs into functional specifications, user stories, and acceptance criteria
• Conduct gap analysis between current-state processes and future-state technology solutions
• Create and maintain process maps, data flow diagrams, and RACI matrices
• Support UAT (User Acceptance Testing) and change management activities

About You
• 3+ years of BA experience in financial services, banking or insurance preferred
• Strong experience with Agile/Scrum delivery (Jira, Confluence)
• Proficiency in business process modelling (BPMN, Visio or equivalent)
• Excellent stakeholder management — comfortable presenting to C-suite
• Strong analytical thinking and problem-solving under ambiguity
• Tertiary degree in Business, IT, Finance or related discipline
• CBAP or equivalent BA certification is desirable

The Deloitte Difference
We value diverse perspectives. Candidates from non-Australian backgrounds bring global financial systems knowledge that enriches our teams. Consulting experience from overseas markets is highly regarded.

Salary: $95,000 – $120,000 + super + bonus
Location: Brisbane, QLD (client site 3 days/week)`
  },
  {
    id: 'J04',
    title: 'Civil Engineer – Infrastructure Delivery',
    company: 'John Holland',
    field: 'civil_engineering',
    jd: `Civil Engineer — John Holland, Perth WA

John Holland is seeking a Civil Engineer to join our Infrastructure Delivery division. You will contribute to the design and delivery of major civil infrastructure projects across Western Australia including roads, bridges, and utilities.

About the Role
• Prepare and review engineering designs, drawings, and specifications for civil works
• Conduct geotechnical and hydraulic analysis to support design decisions
• Liaise with local councils, state authorities, and subcontractors
• Monitor construction progress against programme and budget
• Prepare technical reports, RFIs, and variation claims
• Ensure compliance with WH&S and environmental regulations on site

About You
• Bachelor's degree in Civil Engineering (or equivalent) — Engineers Australia recognition or recognition-in-progress is required
• 3–6 years of experience in civil infrastructure delivery
• Proficiency in AutoCAD, Civil 3D, or equivalent design software
• Experience with Australian Standards and MRWA or equivalent state road authority specifications
• Strong written and verbal communication skills
• Current driver's licence

About International Applicants
John Holland actively recruits engineers from overseas backgrounds. We support skilled migration visa sponsorship for exceptional candidates. All international engineering qualifications will be assessed against Engineers Australia competency standards.

Salary: $95,000 – $115,000 + super + site allowances
Location: Perth, WA (FIFO options available for regional projects)`
  },
  {
    id: 'J05',
    title: 'ICT Project Manager',
    company: 'NSW Government',
    field: 'project_management',
    jd: `ICT Project Manager — NSW Department of Customer Service, Sydney NSW

The NSW Department of Customer Service is undertaking a major digital modernisation programme. We are seeking an experienced ICT Project Manager to lead the delivery of a new citizen-facing digital service platform.

About the Role
• Manage end-to-end delivery of ICT projects valued between $1M–$10M
• Develop and maintain project plans, risk registers, and status reports for executive audiences
• Coordinate internal technical teams, external vendors, and business stakeholders
• Apply PMBOK or PRINCE2 methodology to ensure disciplined project governance
• Manage project budgets, procurement, and contract administration
• Report monthly to Steering Committee and prepare ministerial briefings as required

About You
• 5+ years of ICT project management experience, ideally in government or regulated industries
• PMP, PRINCE2 Practitioner or equivalent certification (mandatory)
• Experience managing complex multi-vendor technology implementations
• Strong risk and issue management skills
• Excellent written communication — capable of producing executive-level papers
• Familiarity with NSW Government procurement frameworks is advantageous but not essential

We Strongly Encourage
Applications from candidates with international government or public sector project management experience. Equivalent delivery methodologies from overseas are recognised and valued.

Salary: $120,000 – $140,000 + super (Grade 11/12)
Location: Parramatta, NSW (hybrid — 3 days on-site)`
  },
  {
    id: 'J06',
    title: 'Data Analyst',
    company: 'Woolworths Group',
    field: 'data',
    jd: `Data Analyst — Woolworths Group, Sydney NSW

Woolworths Group's Data & Analytics team turns retail data into decisions that affect 20 million customer transactions a week. We're looking for a Data Analyst to join our Loyalty & Customer team.

About the Role
• Analyse large customer datasets using SQL and Python to surface actionable insights
• Build and maintain dashboards and reporting in Tableau or Power BI
• Partner with Category Managers and Marketing teams to design and evaluate promotions
• Develop A/B test frameworks for loyalty programme experiments
• Document analytical methodologies and present findings to non-technical stakeholders
• Support data governance initiatives and ensure data quality standards are met

About You
• 2–4 years of experience in a data analyst or BI analyst role
• Proficiency in SQL (complex queries, window functions, subqueries)
• Experience with Python (pandas, numpy, matplotlib) for data manipulation and visualisation
• Exposure to Tableau, Power BI or Looker
• Strong attention to detail with the ability to handle ambiguous business questions
• Tertiary qualification in Statistics, Mathematics, Computer Science or related discipline

Nice to Have
• Experience with cloud data warehouses (BigQuery, Redshift, Snowflake)
• Retail or FMCG industry experience
• Experience with loyalty programme or customer segmentation analytics

Salary: $85,000 – $100,000 + super
Location: Surry Hills, Sydney NSW (hybrid — 2 days in office)`
  },
  {
    id: 'J07',
    title: 'Digital Marketing Coordinator',
    company: 'Flight Centre Travel Group',
    field: 'marketing',
    jd: `Digital Marketing Coordinator — Flight Centre Travel Group, Brisbane QLD

Flight Centre Travel Group is looking for an energetic Digital Marketing Coordinator to join our eCommerce team. You will support the execution of paid and organic digital campaigns that drive bookings across our family of brands.

About the Role
• Coordinate paid search (Google Ads) and paid social campaigns (Meta, TikTok)
• Assist with SEO audits, keyword research, and content optimisation
• Write copy for email campaigns, landing pages, and social media posts
• Monitor campaign performance and prepare weekly reporting for channel leads
• Liaise with the creative team to brief and traffic digital assets
• Support the Content team on blog posts, destination guides, and influencer briefs

About You
• 1–2 years of experience in a digital marketing or marketing coordinator role
• Understanding of Google Ads, Meta Ads Manager and Google Analytics 4
• Strong copywriting skills — able to adapt tone for different brand audiences
• Organised and detail-oriented with the ability to manage multiple campaigns
• A passion for travel is a big plus
• Tertiary qualification in Marketing, Communications or related field

Salary: $60,000 – $72,000 + super + travel benefits
Location: Brisbane, QLD (in-office)`
  },
  {
    id: 'J08',
    title: 'Junior Accountant',
    company: 'BDO Australia',
    field: 'accounting',
    jd: `Junior Accountant — BDO Australia, Melbourne VIC

BDO is a leading global accounting firm with a strong Australian presence. We're growing our Business Services & Advisory team and looking for a Junior Accountant to support our SME client portfolio.

About the Role
• Prepare financial statements and management accounts for small to medium businesses
• Assist with tax return preparation (individual, company, partnership, trust)
• Reconcile bank accounts and assist with bookkeeping for clients on Xero and MYOB
• Assist senior accountants with audit preparation and due diligence engagements
• Maintain client files and support practice management administrative tasks

About You
• Completed or in progress: Bachelor's degree in Accounting or Commerce
• Working towards CPA or CA qualification
• Understanding of Australian accounting standards (AASB) and tax law (ITAA)
• Experience with Xero, MYOB or QuickBooks
• High attention to detail and strong numerical reasoning
• Good written and verbal communication skills

About International Applicants
Candidates with overseas accounting qualifications are encouraged to apply. BDO supports CPA equivalency assessment for internationally trained accountants. Relevant experience in public practice from any country is considered.

Salary: $60,000 – $72,000 + super + study support
Location: Melbourne, VIC`
  },
  {
    id: 'J09',
    title: 'HR Business Partner',
    company: 'ANZ Bank',
    field: 'hr',
    jd: `HR Business Partner — ANZ Bank, Melbourne VIC

ANZ is looking for a seasoned HR Business Partner to join our Institutional Banking division. You will act as a trusted advisor to senior leaders on people strategy, talent management and organisational effectiveness.

About the Role
• Partner with 3–4 senior leaders across a business unit of ~400 employees
• Lead annual performance and talent review cycles (calibration, succession planning)
• Provide expert guidance on employee relations matters, including disciplinary investigations and performance improvement plans
• Translate business strategy into people plans: capability uplift, restructures, retention initiatives
• Analyse people data (attrition, engagement, DEIB metrics) and present insights to leadership
• Coach and develop line managers to build people leadership capability

About You
• 6+ years of HR generalist or HRBP experience, preferably in financial services
• Deep knowledge of the Fair Work Act and Australian employment law
• Demonstrated experience managing complex ER matters and restructures
• Data-driven approach to HR — strong Excel and HRIS (SAP, Workday or SuccessFactors)
• Strong executive presence and ability to influence at Director/GM level
• Tertiary qualification in HR, Organisational Psychology or related discipline

Note on International Experience
HR professionals with experience in comparable jurisdictions (UK, Singapore, India) who can demonstrate Australian employment law knowledge (or willingness to upskill) are encouraged to apply.

Salary: $130,000 – $155,000 + super + performance bonus
Location: Docklands, Melbourne VIC (hybrid)`
  },
  {
    id: 'J10',
    title: 'Customer Experience Manager',
    company: 'Telstra',
    field: 'cx_management',
    jd: `Customer Experience Manager — Telstra, Sydney NSW

Telstra's Consumer & Small Business division is looking for a Customer Experience Manager to lead service transformation initiatives across our retail and digital channels.

About the Role
• Own the end-to-end customer journey for a defined product or segment
• Identify pain points through NPS, CSAT, and qualitative research — then drive cross-functional improvements
• Lead a team of 4 CX Analysts and facilitate design thinking workshops with frontline staff
• Build and maintain the Customer Experience Dashboard for executive reporting
• Collaborate with Digital, Product, and Operations teams to prioritise and deliver CX improvements
• Represent the customer voice in quarterly product roadmap planning sessions

About You
• 5+ years of CX, operations or service design experience
• Experience using CX measurement tools (Medallia, Qualtrics or equivalent)
• Strong analytical skills — comfortable interpreting quantitative and qualitative data
• Demonstrated ability to lead change in a large, matrixed organisation
• Exceptional facilitation and stakeholder engagement skills
• Tertiary qualification in Business, Marketing, Human-Centred Design or related discipline

Salary: $115,000 – $135,000 + super + bonus
Location: Sydney, NSW (hybrid — 2 days in office)`
  }
];

// ─── Resume → Job pairing strategy ─────────────────────────────────────────
// Each resume is assigned 2 jobs: [primary (good match), secondary (stretch/mismatch)]

const PAIRINGS = {
  'ALEENA SAJU CV.pdf':                                ['J09', 'J03'],
  'Evgenii Korolev — Resume (AI Agents & Automation).pdf': ['J02', 'J01'],
  'G_GeetaliCV.pdf':                                   ['J06', 'J03'],
  'Kunal_Krishneel_Chand_AU_v2.pdf':                   ['J01', 'J05'],
  'Kurian_John_Resume_UC.pdf':                         ['J01', 'J06'],
  'MI-Resume-2026.pdf':                                ['J03', 'J10'],
  'Resume - Kiron Kurian.pdf':                         ['J05', 'J01'],
  'Resume (Jairaj Bhagat) (1).docx':                   ['J03', 'J08'],
  'Resume of Pawan Kanthaka Lokugan Hewage.docx':      ['J04', 'J05'],
  'RITVIK_SHARMA_-_ (7).pdf':                          ['J01', 'J02'],
  'Sandhya_Vijayan_Resume.pdf':                        ['J09', 'J03'],
  'Vijay Resume_CE.pdf':                               ['J04', 'J05'],
  'Vishukanth Sriskantharaj - CV (5).pdf':             ['J01', 'J06'],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const { PDFParse } = pdfParse;
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    return data.text;
  } else if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  throw new Error(`Unsupported file type: ${ext}`);
}

async function apiPost(endpoint, body, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({ error: 'Non-JSON response', status: res.status }));
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function scoreDocument(text, jd, companyName, matchScore, docType = 'cover_letter') {
  const isResume = docType === 'resume';
  const cl = text.toLowerCase();
  const jdLower = jd.toLowerCase();

  // Hard fail: hallucinated placeholders
  const placeholders = (text.match(/\[MISSING[^\]]*\]|\[INSERT[^\]]*\]|\[YOUR[^\]]*\]|\[CANDIDATE[^\]]*\]/gi) || []);

  // Hard fail: generic openers
  const genericOpeners = [
    'i am writing to express',
    'i am writing to apply',
    'passionate and dedicated',
    'i am a motivated professional',
    'i would like to apply',
    'please find attached',
    'i am excited to apply'
  ];
  const genericFound = genericOpeners.filter(g => cl.includes(g));

  // Hard fail: JD specificity
  const jdWords = jdLower.match(/\b[a-z]{5,}\b/g) || [];
  const jdWordFreq = {};
  jdWords.forEach(w => { jdWordFreq[w] = (jdWordFreq[w] || 0) + 1; });
  const stopwords = new Set(['about', 'their', 'which', 'would', 'skills', 'experience', 'working', 'ability', 'strong', 'required', 'including', 'across', 'following', 'ensure', 'within', 'management', 'provide', 'develop', 'support']);
  const topJdWords = Object.entries(jdWordFreq)
    .filter(([w]) => !stopwords.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([w]) => w);
  const jdWordsHit = topJdWords.filter(w => cl.includes(w));
  const specificityScore = Math.round((jdWordsHit.length / Math.max(topJdWords.length, 1)) * 100);

  // Soft: metrics (relaxed for low-match candidates)
  const hasMetrics = /\b\d+[%$km]?\b/.test(text);

  // Soft: company name referenced (cover letters only — resumes don't mention company)
  const companyNamed = isResume ? true : (companyName ? cl.includes(companyName.toLowerCase().split(' ')[0]) : true);

  // Soft: Australian English marker
  const hasAuEnglish = /(organised|recognised|programme|colour|labour|analysed|behaviour|realise|prioritise)/.test(cl);

  // VERIFY tags (new — inferred metrics needing confirmation)
  const verifyTags = (text.match(/\[VERIFY:[^\]]*\]/gi) || []);

  // Word count
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

  // Low-match relaxed scoring: if matchScore < 40, metrics is not a hard fail
  // Resumes always require metrics (bullet points with numbers are standard)
  const isLowMatch = !isResume && matchScore < 40;
  const hardPass = placeholders.length === 0 && genericFound.length === 0 && specificityScore >= 30 && companyNamed;
  const softPass = hasMetrics || isLowMatch; // relaxed for low-match cover letters

  return {
    placeholders,
    genericOpeners: genericFound,
    specificityScore,
    topJdWords,
    jdWordsHit,
    hasMetrics,
    companyNamed,
    hasAuEnglish,
    verifyTags,
    wordCount,
    isLowMatch,
    isResume,
    pass: hardPass && softPass
  };
}

// ─── Report helpers ──────────────────────────────────────────────────────────

function md_scoreTable(score) {
  const lines = [];
  lines.push(`| Criterion | Result | Status |`);
  lines.push(`|---|---|---|`);
  lines.push(`| Placeholder leakage | ${score.placeholders.length === 0 ? 'None' : score.placeholders.join(', ')} | ${score.placeholders.length === 0 ? '✅' : '❌ HARD FAIL'} |`);
  lines.push(`| Generic opener | ${score.genericOpeners.length === 0 ? 'None detected' : score.genericOpeners.join(', ')} | ${score.genericOpeners.length === 0 ? '✅' : '❌ HARD FAIL'} |`);
  lines.push(`| JD specificity | ${score.specificityScore}% — ${score.jdWordsHit.join(', ')} | ${score.specificityScore >= 30 ? '✅' : '❌ HARD FAIL'} |`);
  if (!score.isResume) lines.push(`| Company named | ${score.companyNamed ? 'Yes' : 'No'} | ${score.companyNamed ? '✅' : '❌ HARD FAIL'} |`);
  lines.push(`| Contains metrics | ${score.hasMetrics ? 'Yes' : 'No'} | ${score.hasMetrics ? '✅' : score.isLowMatch ? '⚠️ LOW-MATCH (expected)' : '❌ SOFT FAIL'} |`);
  lines.push(`| VERIFY tags (inferred metrics) | ${score.verifyTags.length === 0 ? 'None' : score.verifyTags.length + ' tag(s)'} | ${score.verifyTags.length > 0 ? '⚠️ Candidate must verify' : 'ℹ️'} |`);
  lines.push(`| Australian English | ${score.hasAuEnglish ? 'Yes' : 'No'} | ${score.hasAuEnglish ? '✅' : '⚠️ Soft fail'} |`);
  lines.push(`| Word count | ${score.wordCount} | ${score.wordCount >= 200 && score.wordCount <= 700 ? '✅' : '⚠️'} |`);
  lines.push(`| Match context | ${score.isLowMatch ? 'LOW MATCH — relaxed criteria applied' : 'Standard criteria'} | ℹ️ |`);
  lines.push(`| **Overall** | | ${score.pass ? '✅ PASS' : '❌ FAIL'} |`);
  return lines.join('\n');
}

function md_achievementTable(achievements) {
  if (!achievements || achievements.length === 0) return '_No achievements extracted._';
  const lines = [];
  lines.push(`| Title | Metric | Type | Industry | Skills |`);
  lines.push(`|---|---|---|---|---|`);
  achievements.slice(0, 20).forEach(a => {
    lines.push(`| ${(a.title || '').replace(/\|/g, '/')} | ${a.metric || '—'} | ${a.metricType || '—'} | ${a.industry || '—'} | ${(a.skills || []).slice(0, 3).join(', ')} |`);
  });
  return lines.join('\n');
}

function md_coachingAlerts(alerts) {
  if (!alerts || alerts.length === 0) return '_No coaching alerts._';
  const lines = [];
  lines.push(`| Severity | Field | Message |`);
  lines.push(`|---|---|---|`);
  alerts.slice(0, 15).forEach(a => {
    const icon = a.color === 'red' ? '🔴' : '🟠';
    lines.push(`| ${icon} ${a.color?.toUpperCase() || 'INFO'} | ${a.field || '—'} | ${(a.message || '').replace(/\|/g, '/')} |`);
  });
  return lines.join('\n');
}

function md_rankedAchievements(ranked) {
  if (!ranked || ranked.length === 0) return '_No ranked achievements._';
  const lines = [];
  lines.push(`| Rank | Score | Tier | Why It Matters for This Role |`);
  lines.push(`|---|---|---|---|`);
  ranked.slice(0, 8).forEach((a, i) => {
    const tierIcon = a.tier === 'STRONG' ? '🟢' : a.tier === 'MODERATE' ? '🟡' : '🔴';
    lines.push(`| ${i + 1} | ${a.relevanceScore}% | ${tierIcon} ${a.tier} | ${(a.reason || '').replace(/\|/g, '/')} |`);
  });
  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now();
  const summary = { total: 0, passed: 0, failed: 0, errors: 0, lowMatchBlocked: 0 };

  // ── Check server health ──
  console.log('Checking server health...');
  try {
    const health = await fetch(`${BASE_URL}/health`);
    const hData = await health.json();
    console.log('Server status:', hData);
  } catch (e) {
    console.error('Server not reachable at', BASE_URL);
    console.error('Start the server with: npm run dev (in server/ directory)');
    process.exit(1);
  }

  // ── Index page (overview table) ──
  const indexLines = [];
  indexLines.push(`# JobHub QA — Case Study Report\n`);
  indexLines.push(`**Generated:** ${new Date().toISOString()}  \n`);
  indexLines.push(`**Resumes tested:** ${Object.keys(PAIRINGS).length}  \n`);
  indexLines.push(`**Pairings (cover letter + resume each):** ${Object.keys(PAIRINGS).length * 2}  \n\n`);
  indexLines.push(`---\n\n`);
  indexLines.push(`## Overview Table\n\n`);
  indexLines.push(`| # | Candidate | Job | Company | Match | CL | Resume | Status |\n`);
  indexLines.push(`|---|---|---|---|---|---|---|---|\n`);

  const caseStudies = [];
  const resumeFiles = Object.keys(PAIRINGS);

  for (let ri = 0; ri < resumeFiles.length; ri++) {
    const fileName = resumeFiles[ri];
    const filePath = path.join(RESUMES_DIR, fileName);
    const jobIds = PAIRINGS[fileName];

    console.log(`\n${'='.repeat(70)}`);
    console.log(`[${ri + 1}/${resumeFiles.length}] Processing: ${fileName}`);
    console.log(`${'='.repeat(70)}`);

    const cs = {
      resumeFile: fileName,
      candidateName: '(unknown)',
      originalTextExcerpt: '',
      extraction: null,
      jobs: []
    };

    // ── Step 1: Extract text ──
    let resumeText;
    try {
      console.log('  Step 1: Extracting text...');
      resumeText = await extractText(filePath);
      console.log(`  Extracted ${resumeText.length} characters`);
      cs.originalTextExcerpt = resumeText.substring(0, 800);
    } catch (e) {
      console.error('  FAILED to extract text:', e.message);
      cs.extractionError = e.message;
      summary.errors++;
      caseStudies.push(cs);
      continue;
    }

    // ── Step 2: AI extraction ──
    let extracted;
    console.log('  Step 2: Running AI extraction (30–90s)...');
    try {
      const resp = await apiPost('/extract/resume', { text: resumeText }, 180000);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${JSON.stringify(resp.data)}`);
      extracted = resp.data;
      cs.extraction = extracted;
      cs.candidateName = extracted.profile?.name || fileName;
      console.log(`  Extracted: ${extracted.experience?.length || 0} roles, ${extracted.discoveredAchievements?.length || 0} achievements, ${extracted.coachingAlerts?.length || 0} alerts`);
    } catch (e) {
      console.error('  FAILED AI extraction:', e.message);
      cs.extractionError = e.message;
      summary.errors++;
      caseStudies.push(cs);
      continue;
    }

    // ── Step 3: Save profile ──
    console.log('  Step 3: Saving profile...');
    try {
      const saveResp = await apiPost('/profile', {
        profile: extracted.profile,
        experience: extracted.experience,
        education: extracted.education,
        volunteering: extracted.volunteering,
        certifications: extracted.certifications,
        languages: extracted.languages,
        skills: extracted.skills,
        coachingAlerts: extracted.coachingAlerts,
        discoveredAchievements: extracted.discoveredAchievements
      }, 60000);
      if (!saveResp.ok) throw new Error(`HTTP ${saveResp.status}: ${JSON.stringify(saveResp.data)}`);
      console.log('  Profile saved');
    } catch (e) {
      console.error('  FAILED to save profile:', e.message);
      cs.profileSaveError = e.message;
      summary.errors++;
      caseStudies.push(cs);
      continue;
    }

    await sleep(3000); // Allow Pinecone indexing

    // ── Steps 4–7: For each paired job ──
    for (const jobId of jobIds) {
      const job = JOBS.find(j => j.id === jobId);
      if (!job) continue;

      console.log(`\n  Job: [${job.id}] ${job.title} @ ${job.company}`);
      summary.total++;

      const jobResult = {
        job,
        analysisResult: null,
        coverLetter: null,
        resume: null,
        clScore: null,
        resumeScore: null,
        blueprint: null,
        error: null
      };

      // Step 4: Analyze
      console.log('    Step 4: Analyzing job match...');
      try {
        const analyzeResp = await apiPost('/analyze/job', { jobDescription: job.jd }, 120000);
        if (!analyzeResp.ok) throw new Error(`HTTP ${analyzeResp.status}: ${JSON.stringify(analyzeResp.data)}`);
        jobResult.analysisResult = analyzeResp.data;
        const matchScore = analyzeResp.data.matchScore;
        console.log(`    Match score: ${matchScore}% | Strong: ${(analyzeResp.data.rankedAchievements || []).filter(a => a.tier === 'STRONG').length} achievements`);

        if (matchScore < 40) {
          summary.lowMatchBlocked++;
          console.log(`    ⚠️  LOW MATCH (${matchScore}%) — would show warning gate in UI. Generating anyway for QA purposes.`);
        }
      } catch (e) {
        console.error('    FAILED analysis:', e.message);
        jobResult.error = `Analysis failed: ${e.message}`;
        summary.errors++;
        cs.jobs.push(jobResult);
        continue;
      }

      const matchScore = jobResult.analysisResult.matchScore;
      const selectedIds = (jobResult.analysisResult.rankedAchievements || [])
        .filter(a => a.tier === 'STRONG' || a.tier === 'MODERATE')
        .slice(0, 5)
        .map(a => a.id);

      // Step 5: Generate cover letter
      console.log('    Step 5: Generating cover letter (30–120s)...');
      try {
        const genResp = await apiPost('/generate/cover-letter', {
          jobDescription: job.jd,
          selectedAchievementIds: selectedIds,
          analysisContext: {
            tone: jobResult.analysisResult.analysisTone,
            competencies: jobResult.analysisResult.coreCompetencies || [],
          },
          jobApplicationId: jobResult.analysisResult.jobApplicationId
        }, 180000);

        if (!genResp.ok) throw new Error(`HTTP ${genResp.status}: ${JSON.stringify(genResp.data)}`);
        jobResult.coverLetter = genResp.data.content;
        jobResult.blueprint = genResp.data.blueprint;
        const cost = genResp.data.costBreakdown;
        console.log(`    Cover letter: ${jobResult.coverLetter.length} chars | Cost: $${cost?.total_cost_usd?.toFixed(4) || '?'} | Stage1 cached: ${cost?.stage1_cached}`);
        jobResult.clScore = scoreDocument(jobResult.coverLetter, job.jd, job.company, matchScore);
        if (jobResult.clScore.pass) summary.passed++; else summary.failed++;
      } catch (e) {
        console.error('    FAILED cover letter generation:', e.message);
        jobResult.clError = e.message;
        summary.errors++;
      }

      await sleep(2000);

      // Step 6: Generate resume
      console.log('    Step 6: Generating resume (30–120s)...');
      try {
        const resumeResp = await apiPost('/generate/resume', {
          jobDescription: job.jd,
          selectedAchievementIds: selectedIds,
          analysisContext: {
            tone: jobResult.analysisResult.analysisTone,
            competencies: jobResult.analysisResult.coreCompetencies || [],
          },
          jobApplicationId: jobResult.analysisResult.jobApplicationId
        }, 180000);

        if (!resumeResp.ok) throw new Error(`HTTP ${resumeResp.status}: ${JSON.stringify(resumeResp.data)}`);
        jobResult.resume = resumeResp.data.content;
        if (!jobResult.blueprint) jobResult.blueprint = resumeResp.data.blueprint;
        console.log(`    Resume: ${jobResult.resume.length} chars`);
        jobResult.resumeScore = scoreDocument(jobResult.resume, job.jd, job.company, matchScore, 'resume');
      } catch (e) {
        console.error('    FAILED resume generation:', e.message);
        jobResult.resumeError = e.message;
        summary.errors++;
      }

      await sleep(2000);
      cs.jobs.push(jobResult);
    }

    caseStudies.push(cs);
    console.log(`\n  Done with ${fileName}`);
  }

  // ── Build report ─────────────────────────────────────────────────────────

  const reportLines = [...indexLines];

  // Fill overview table rows
  let overviewRows = [];
  caseStudies.forEach((cs, csi) => {
    cs.jobs.forEach(jr => {
      const matchScore = jr.analysisResult?.matchScore ?? '?';
      const matchBadge = matchScore === '?' ? '❓' : matchScore >= 70 ? '🟢' : matchScore >= 40 ? '🟡' : '🔴';
      const clStatus = jr.clScore ? (jr.clScore.pass ? '✅' : '❌') : (jr.clError ? '💥' : '—');
      const resumeStatus = jr.resumeScore ? (jr.resumeScore.pass ? '✅' : '❌') : (jr.resumeError ? '💥' : '—');
      const overall = jr.clScore?.pass && jr.resumeScore?.pass ? '✅ PASS' : '❌ FAIL';
      overviewRows.push(`| ${csi + 1} | ${cs.candidateName} | ${jr.job.title} | ${jr.job.company} | ${matchBadge} ${matchScore}% | ${clStatus} | ${resumeStatus} | ${overall} |`);
    });
  });

  reportLines.push(overviewRows.join('\n') + '\n\n');
  reportLines.push(`---\n\n`);
  reportLines.push(`## Case Studies\n\n`);

  // Individual case studies
  let caseNum = 0;
  caseStudies.forEach(cs => {
    caseNum++;
    reportLines.push(`---\n\n`);
    reportLines.push(`# Case Study ${caseNum}: ${cs.candidateName}\n\n`);
    reportLines.push(`**Source file:** \`${cs.resumeFile}\`\n\n`);

    if (cs.extractionError) {
      reportLines.push(`> ❌ **Extraction failed:** ${cs.extractionError}\n\n`);
      return;
    }

    // Candidate snapshot
    const profile = cs.extraction?.profile;
    reportLines.push(`## Candidate Profile\n\n`);
    reportLines.push(`| Field | Value |\n|---|---|\n`);
    reportLines.push(`| Name | ${profile?.name || '—'} |\n`);
    reportLines.push(`| Location | ${profile?.location || '—'} |\n`);
    reportLines.push(`| Email | ${profile?.email || '—'} |\n`);
    reportLines.push(`| LinkedIn | ${profile?.linkedin || '—'} |\n\n`);
    if (profile?.professionalSummary) {
      reportLines.push(`**Professional Summary (AI-generated):**\n> ${profile.professionalSummary}\n\n`);
    }

    // Original resume excerpt
    reportLines.push(`<details>\n<summary>📄 Original Resume Text (first 800 chars)</summary>\n\n`);
    reportLines.push('```\n' + cs.originalTextExcerpt + '\n```\n\n');
    reportLines.push('</details>\n\n');

    // Experience
    if (cs.extraction?.experience?.length > 0) {
      reportLines.push(`## Work History Extracted\n\n`);
      cs.extraction.experience.forEach(exp => {
        reportLines.push(`**${exp.role}** @ ${exp.company} (${exp.startDate || '?'} – ${exp.endDate || '?'})\n`);
        if (exp.bullets?.length > 0) {
          exp.bullets.slice(0, 3).forEach(b => reportLines.push(`- ${b}\n`));
        }
        reportLines.push('\n');
      });
    }

    // Achievement bank
    reportLines.push(`## Achievement Bank (${cs.extraction?.discoveredAchievements?.length || 0} achievements identified)\n\n`);
    reportLines.push(md_achievementTable(cs.extraction?.discoveredAchievements) + '\n\n');

    // Coaching alerts
    reportLines.push(`## AI Coaching Alerts (${cs.extraction?.coachingAlerts?.length || 0} issues found)\n\n`);
    reportLines.push(md_coachingAlerts(cs.extraction?.coachingAlerts) + '\n\n');

    // Per-job sections
    cs.jobs.forEach(jr => {
      const matchScore = jr.analysisResult?.matchScore ?? '?';
      const matchBadge = matchScore === '?' ? '' : matchScore >= 70 ? '🟢' : matchScore >= 40 ? '🟡' : '🔴';
      const isLowMatch = matchScore !== '?' && matchScore < 40;

      reportLines.push(`---\n\n`);
      reportLines.push(`## Application: ${jr.job.title} @ ${jr.job.company}\n\n`);

      if (jr.error) {
        reportLines.push(`> ❌ **Analysis failed:** ${jr.error}\n\n`);
        return;
      }

      // Match analysis
      reportLines.push(`### Match Analysis\n\n`);
      reportLines.push(`| Metric | Value |\n|---|---|\n`);
      reportLines.push(`| Match Score | ${matchBadge} **${matchScore}%** |\n`);
      reportLines.push(`| Tone | ${jr.analysisResult?.analysisTone || '—'} |\n`);
      reportLines.push(`| Strong Achievements | ${(jr.analysisResult?.rankedAchievements || []).filter(a => a.tier === 'STRONG').length} / ${jr.analysisResult?.rankedAchievements?.length || 0} |\n`);
      if (jr.analysisResult?.evidenceWarning) {
        reportLines.push(`| Evidence Warning | ${jr.analysisResult.evidenceWarning} |\n`);
      }
      reportLines.push('\n');

      if (isLowMatch) {
        reportLines.push(`> 🔴 **LOW MATCH GATE** — In the live app, users would see the low-match warning modal before being able to generate. This application is a poor fit. The content below was generated for QA purposes only.\n\n`);
      }

      // Keywords
      if (jr.analysisResult?.keywords?.length > 0) {
        reportLines.push(`**JD Keywords:** ${jr.analysisResult.keywords.slice(0, 10).join(' • ')}\n\n`);
      }

      // Ranked achievements
      reportLines.push(`**Achievement Relevance for This Role:**\n\n`);
      reportLines.push(md_rankedAchievements(jr.analysisResult?.rankedAchievements) + '\n\n');

      // Blueprint (if available)
      if (jr.blueprint) {
        reportLines.push(`### Claude's Strategy Blueprint\n\n`);
        reportLines.push(`> **Opening Hook:** *"${jr.blueprint.openingHook}"*\n\n`);
        reportLines.push(`> **Positioning:** ${jr.blueprint.positioningStatement}\n\n`);
        reportLines.push(`**Key Themes:** ${(jr.blueprint.messagingAngles || []).join(' • ')}\n\n`);
        reportLines.push(`**Tone Directive:** ${jr.blueprint.toneBlueprint}\n\n`);
        if (jr.blueprint.pitfallFlags?.length > 0) {
          reportLines.push(`**Phrases Blocked:** ${jr.blueprint.pitfallFlags.slice(0, 5).map(f => `~~"${f}"~~`).join(' ')}\n\n`);
        }
        if (jr.blueprint.employerInsight && !jr.blueprint.employerInsight.includes('[MISSING:')) {
          reportLines.push(`**Employer Insight Used:** ${jr.blueprint.employerInsight}\n\n`);
        }
      }

      // Cover Letter
      if (jr.coverLetter) {
        reportLines.push(`### Generated Cover Letter\n\n`);
        reportLines.push(md_scoreTable(jr.clScore) + '\n\n');
        if (jr.clScore?.verifyTags?.length > 0) {
          reportLines.push(`> ⚠️ **Candidate action required:** The following inferred metrics need verification before sending:\n`);
          jr.clScore.verifyTags.forEach(t => reportLines.push(`> - ${t}\n`));
          reportLines.push('\n');
        }
        reportLines.push(`<details>\n<summary>📝 Full Cover Letter</summary>\n\n`);
        reportLines.push('```\n' + jr.coverLetter + '\n```\n\n');
        reportLines.push('</details>\n\n');
      } else if (jr.clError) {
        reportLines.push(`> ❌ **Cover letter failed:** ${jr.clError}\n\n`);
      }

      // Resume
      if (jr.resume) {
        reportLines.push(`### Generated Resume\n\n`);
        reportLines.push(md_scoreTable(jr.resumeScore) + '\n\n');
        reportLines.push(`<details>\n<summary>📄 Full Tailored Resume</summary>\n\n`);
        reportLines.push('```\n' + jr.resume + '\n```\n\n');
        reportLines.push('</details>\n\n');
      } else if (jr.resumeError) {
        reportLines.push(`> ❌ **Resume failed:** ${jr.resumeError}\n\n`);
      }
    });
  });

  // ── Summary ──────────────────────────────────────────────────────────────
  const elapsed = Math.round((Date.now() - startTime) / 1000);

  reportLines.push(`---\n\n`);
  reportLines.push(`# Test Results Summary\n\n`);
  reportLines.push(`| Metric | Value |\n|---|---|\n`);
  reportLines.push(`| Total applications scored | ${summary.total} |\n`);
  reportLines.push(`| Cover letter PASS | ${summary.passed} |\n`);
  reportLines.push(`| Cover letter FAIL | ${summary.failed} |\n`);
  reportLines.push(`| Errors (skipped) | ${summary.errors} |\n`);
  reportLines.push(`| Low-match gate triggered | ${summary.lowMatchBlocked} |\n`);
  reportLines.push(`| Pass rate | ${summary.total > 0 ? Math.round(summary.passed / summary.total * 100) : 0}% |\n`);
  reportLines.push(`| Total runtime | ${Math.floor(elapsed / 60)}m ${elapsed % 60}s |\n`);

  // Write report
  const reportContent = reportLines.join('');
  fs.writeFileSync(REPORT_PATH, reportContent, 'utf-8');

  console.log(`\n${'='.repeat(70)}`);
  console.log('QA TEST COMPLETE');
  console.log(`${'='.repeat(70)}`);
  console.log(`Total:        ${summary.total}`);
  console.log(`Passed:       ${summary.passed}`);
  console.log(`Failed:       ${summary.failed}`);
  console.log(`Errors:       ${summary.errors}`);
  console.log(`Low-match:    ${summary.lowMatchBlocked} (would trigger gate in UI)`);
  console.log(`Runtime:      ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
  console.log(`Report:       ${REPORT_PATH}`);
  console.log(`\nWARNING: The bypass user's profile has been overwritten by the last test resume.`);
  console.log(`Re-import your resume to restore it.`);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
