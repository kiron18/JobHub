# JobHub — Prompt & Rule Surface: Complete Bundle

Generated for review. Every rule file and prompt that shapes user-facing output, with its actual runtime status.

**Read `PROMPT-SURFACE-MAP.md` first** — it explains what is wrong. This file is the raw material.

---

## Contents


**SECTION: LIVE RESUME PATH  (POST /generate/resume-structured)**

- `server/src/services/prompts/generationV2.ts` — **LIVE** — 142 lines
- `server/src/lib/styleLint.ts` — **LIVE** — 148 lines
- `server/src/services/prompts/emphasisPass.ts` — **LIVE** — 63 lines

**SECTION: LIVE INTAKE PATH  (the fix-it-once step)**

- `server/src/services/baselineResume.ts` — **LIVE** — 70 lines
- `server/src/services/prompts/extraction.ts` — **LIVE** — 113 lines

**SECTION: DOCTRINE  (1,627 lines of Australian-market rules)**

- `server/rules/resume_rules.md` — **PARTIALLY LIVE** — 398 lines
- `server/rules/cover_letter_rules.md` — **DEAD** — 423 lines
- `server/rules/Resume_ATS_Template.md` — **DEAD** — 52 lines
- `server/rules/selection_criteria_rules.md` — **DEAD** — 354 lines
- `server/rules/cold_outreach_rules.md` — **LIVE** — 44 lines
- `server/rules/interview_prep_rules.md` — **LIVE** — 106 lines
- `server/rules/offer_negotiation_rules.md` — **LIVE** — 57 lines
- `server/rules/rejection_response_rules.md` — **LIVE** — 41 lines
- `server/rules/linkedin_hub_profile_rules.md` — **LIVE** — 85 lines
- `server/rules/linkedin_outreach_rules.md` — **LIVE** — 68 lines

**SECTION: ORPHANED ARCHITECTURE  (built, wired, unreachable for resume/cover)**

- `server/src/services/prompts/resumeStructuredPrompt.ts` — **DEAD for the resume tab** — 175 lines
- `server/src/services/quality-gate.ts` — **DEAD for resume/cover** — 82 lines
- `server/src/services/prompts/strategy.ts` — **DEAD for resume/cover** — 174 lines
- `server/src/lib/atsKeywords.ts` — **DEAD for resume/cover** — 243 lines
- `server/src/services/prompts/generation.ts` — **DEAD for resume/cover** — 668 lines

**SECTION: SUPPORTING PROMPTS**

- `server/src/services/prompts/identity.ts` — **LIVE** — 70 lines
- `server/src/services/prompts/draftCritique.ts` — **LIVE** — 130 lines
- `server/src/services/prompts/achievementDraft.ts` — **LIVE** — 61 lines
- `server/src/services/prompts/analysis.ts` — **LIVE** — 95 lines
- `server/src/services/prompts/selectionCriteriaPrompt.ts` — **LIVE** — 60 lines
- `server/src/services/prompts/enrichmentPrompts.ts` — **LIVE** — 44 lines

---


# SECTION: LIVE RESUME PATH  (POST /generate/resume-structured)


## `server/src/services/prompts/generationV2.ts`

**Runtime status: LIVE**

RESUME_V2_PROMPT + COVER_LETTER_V2_PROMPT. This single file is what actually writes every resume and cover letter your users send.

```typescript
export const RESUME_V2_PROMPT = (resumeText: string, jobDescription: string) => `
You are an expert Australian resume writer. You write the way a top human career coach
writes: specific, honest, outcome-first, and tailored to one job.

You will receive:
1. THE CANDIDATE'S RESUME. This is the single source of truth. Every fact in your output
   must come from here.
2. THE JOB DESCRIPTION for the role they are applying to.

== HONESTY RULES (these override everything else) ==
- Every employer name, job title, date, qualification, institution, certification,
  publication, project name, link, and number in your output must appear in the candidate's
  resume. Copy them exactly.
- Never invent, estimate, round, or extrapolate a number. If a bullet has no metric, write
  it without one. A strong unmetriced bullet beats an invented metric every time.
- Never state a years-of-experience figure unless the resume's own dates clearly support it.
- Never import facts from the job description into the candidate's history, and never use
  your own outside knowledge about any company. If it is not in the resume, it does not exist.

== COMPLETENESS RULES (equal priority to honesty) ==
- Every category of content in the source resume must appear in your output. If the resume
  has publications, your output has a Publications section. Projects, volunteering, awards,
  patents, languages, certifications: same rule. Never delete a section the candidate had.
- Every employer, every education entry, every project title, every publication, and every
  certification in the source must survive into the output.
- To fit the length budget, tighten wording and trim the least relevant bullets within an
  entry. Never fit the budget by deleting an entry or a section.
- Contact line: reproduce every contact channel present in the resume (email, phone,
  LinkedIn, GitHub, portfolio, location). Omit any item that is a placeholder or
  note-to-self (e.g. "04XX XXX XXX", "add correct number", "TBD").

== TAILORING RULES ==
- Reframe, do not rewrite history. Reorder sections and bullets so the experience most
  relevant to THIS job is most prominent. Older or less relevant entries get shorter, not
  deleted.
- Mirror the job description's genuine vocabulary where the resume honestly supports it.
  Never mirror vocabulary the resume cannot support.
- 3 to 5 bullets for the most recent or most relevant roles, 2 to 3 for older ones. Every
  bullet starts with a strong verb and states an outcome or concrete scope.
- Professional summary: first person, 3 to 4 sentences, no name, no "he/she/they", anchored
  by one real proof point from the resume, ending with what they are targeting (aligned to
  this job). Plain prose. Never repeat a summary sentence verbatim in a bullet. Each
  sentence carries one idea: never stack an employer, a claim about that employer, a
  technology list, and a metric into a single sentence.
- Aim for 2 A4 pages of a standard resume layout, achieved per the completeness rules.
- Australian English. No em dashes anywhere. No cliches: never write "results-driven",
  "passionate", "dynamic", "proven track record", "leverage", "spearheaded", "synergy".

== OUTPUT FORMAT ==
Return ONLY the finished resume as markdown. No preamble, no code fences, no commentary.

Required conventions (the renderer depends on these):
- Line 1: # {Candidate full name exactly as in the resume}
- Then: *{The job title from the job description}*
- Then the contact line, items separated by " | ".
- "## Professional Summary" is the first section, "## Work Experience" (with each role as
  "### {Role} | {Company}" followed by "*{Mmm YYYY - Mmm YYYY or Present}*" on its own line
  and "- " bullets), "## Education" (each entry as "**{Degree}**  ·  {Year}" with the
  institution on the next line), and "## Skills & Competencies" (2 or 3 "**{Label}:**"
  lines) must all exist.
- All other sections mirror the source resume's own content, as "## {Section name}"
  headings, placed in the order that best serves this application. Projects use the same
  "### {name}" + date-line + bullets convention as roles.
- End with "## Referees" containing "Available upon request." unless the resume lists
  referees.

== EMPHASIS ==
A recruiter scans this page for about thirty seconds. Bold the result in a bullet so
their eye lands on it.
- Bold the figure and the few words that give it meaning, e.g.
  "- Cut invoice processing time by **40% across three teams**".
- At most ONE bolded span per bullet, and only in bullets that carry a real figure from
  the resume (a %, an amount, a count, a duration). Most bullets will have none.
- Six to ten bolded spans across the whole resume. Never more than twelve.
- NEVER bold a skill, tool, company, job title or date. That reads as keyword stuffing
  and is the fastest way to make a resume look machine-written.
- Bold ONLY inside the text of a "- " bullet. Never bold a whole line, a heading, the
  summary, or a date line — the renderer reads those positions structurally and emphasis
  there changes how the line is interpreted.
- Leave the "**{Degree}**" and "**{Label}:**" conventions above exactly as specified.
If you are unsure whether something deserves emphasis, leave it plain.

== THE CANDIDATE'S RESUME ==
"""
${resumeText}
"""

== THE JOB DESCRIPTION ==
"""
${jobDescription}
"""
`;

export const COVER_LETTER_V2_PROMPT = (
  resumeText: string,
  jobDescription: string,
  generatedResume?: string,
) => `
You are an expert Australian cover letter writer. Direct, warm, specific, zero fluff. The letter must read like a sharp human wrote it, not a template.

You will receive the candidate's resume (single source of truth for all facts about the candidate), the job description, and optionally the tailored resume already generated for this application (keep the letter consistent with it).

== HONESTY RULES (override everything else) ==
- Facts about the CANDIDATE come only from the resume. Never invent employers, titles, numbers, locations, or qualifications.
- Facts about the COMPANY come only from the job description itself. Use what the JD says about the organisation, its mission, and the role. Never use outside knowledge about the company, its offices, or its locations. If the JD says little about the company, focus on the role instead.
- Never state years of experience unless the resume's dates clearly support it.

== LETTER RULES ==
- Salutation: "Dear Hiring Manager," unless the job description itself names a specific person or title to address.
- 4 to 5 paragraphs, 400 to 500 words total. A letter under 400 words is too short; write a
  full, substantial letter where every sentence still earns its place.
- The letter always does these jobs, in this order: open by naming the single strongest fit
  between this candidate and this job's core need (never "I am writing to apply for");
  prove it with the candidate's best evidence from the resume, fully developed (what they
  did, how, and why it maps to this job's top requirement); cover the remaining requirements
  the JD emphasises that the resume honestly supports, using different evidence each time,
  never recycling an achievement; close briefly and confidently, inviting a conversation.
- Within that structure, you choose the sentences, the emphasis, and how the evidence is
  woven. Write prose, not filled-in slots.
- The specificity test: no paragraph may be reusable in a letter to a different company.
  Every paragraph must contain at least one detail that only fits THIS job description.
- Decide the one thing about this candidate a hiring manager would repeat to a colleague,
  and build the letter around it.
- Australian English. No em dashes. No clichés ("passionate", "results-driven", "align with your values", "I believe I would be a great fit").
- Sign off:

Yours sincerely,
{Candidate full name exactly as in the resume}

Return ONLY the letter text. No preamble, no code fences, no commentary.

== THE CANDIDATE'S RESUME ==
"""
${resumeText}
"""

== THE JOB DESCRIPTION ==
"""
${jobDescription}
"""
${generatedResume ? `\n== THE TAILORED RESUME ALREADY GENERATED FOR THIS APPLICATION ==\n"""\n${generatedResume}\n"""\n` : ''}
`;
```


## `server/src/lib/styleLint.ts`

**Runtime status: LIVE**

The only automated quality check on the live path. Banned phrases + em dashes + cover letter word count.

```typescript
// Style lint for generated documents — Phase 2
// Checks em dashes, banned phrases, and cover letter word count

export interface StyleViolation {
  type: 'em-dash' | 'banned-phrase' | 'word-count';
  message: string;
}

// Banned phrases from the prompts (clichés to avoid)
const BANNED_PHRASES = [
  // From resume prompt
  'results-driven',
  'passionate',
  'dynamic',
  'proven track record',
  'leverage',
  'spearheaded',
  'synergy',
  // From cover letter prompt
  'align with your values',
  'I believe I would be a great fit',
  // Variants
  'result driven',
  'proven trackrecord',
  'track record',
  'team player',
  'detail-oriented',
  'detail oriented',
];

/**
 * Count em dashes (U+2014) in text.
 * The prompt bans em dashes — use " - " instead.
 */
function countEmDashes(text: string): number {
  const emDashPattern = /[—]/g;
  const matches = text.match(emDashPattern);
  return matches ? matches.length : 0;
}

/**
 * Check for banned phrases (case-insensitive).
 */
function checkBannedPhrases(text: string): StyleViolation[] {
  const violations: StyleViolation[] = [];
  const lowerText = text.toLowerCase();

  for (const phrase of BANNED_PHRASES) {
    // Use word boundaries for multi-word phrases
    const pattern = phrase.includes(' ')
      ? new RegExp(phrase.replace(/\s+/g, '\\s+'), 'gi')
      : new RegExp(`\\b${phrase}\\b`, 'gi');

    const matches = text.match(pattern);
    if (matches) {
      violations.push({
        type: 'banned-phrase',
        message: `Banned phrase "${phrase}" appears ${matches.length} time(s)`,
      });
    }
  }

  return violations;
}

/**
 * Check cover letter word count.
 * Expected: 400-500 words per the prompt.
 */
function checkWordCount(text: string, minWords = 400, maxWords = 500): StyleViolation | null {
  // Count words (split on whitespace)
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  const count = words.length;

  if (count < minWords) {
    return {
      type: 'word-count',
      message: `Word count ${count} is below minimum ${minWords}`,
    };
  }

  if (count > maxWords) {
    return {
      type: 'word-count',
      message: `Word count ${count} exceeds maximum ${maxWords}`,
    };
  }

  return null;
}

export interface StyleCheckResult {
  violations: StyleViolation[];
  emDashCount: number;
  wordCount: number;
}

/**
 * Check document style for violations.
 *
 * @param text The document content to check
 * @param isCoverLetter Whether this is a cover letter (triggers word count check)
 * @returns StyleCheckResult with all violations found
 */
export function checkStyle(
  text: string,
  isCoverLetter = false,
): StyleCheckResult {
  const violations: StyleViolation[] = [];

  // Check em dashes
  const emDashCount = countEmDashes(text);
  if (emDashCount > 0) {
    violations.push({
      type: 'em-dash',
      message: `Contains ${emDashCount} em dash(es) — use " - " instead`,
    });
  }

  // Check banned phrases
  const bannedViolations = checkBannedPhrases(text);
  violations.push(...bannedViolations);

  // Check word count for cover letters
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  if (isCoverLetter) {
    const wordCountViolation = checkWordCount(text);
    if (wordCountViolation) {
      violations.push(wordCountViolation);
    }
  }

  return {
    violations,
    emDashCount,
    wordCount,
  };
}

/**
 * Convert style violations to strings for the retry mechanism.
 * These feed into the same violation comparison as grounding errors.
 */
export function formatStyleViolationsForRetry(violations: StyleViolation[]): string[] {
  return violations.map(v => `[STYLE] ${v.message}`);
}
```


## `server/src/services/prompts/emphasisPass.ts`

**Runtime status: LIVE**

Second pass on the resume only — adds bold to results.

```typescript
/**
 * Emphasis pass — a second look at a finished resume whose only job is to decide
 * what a hiring manager must see.
 *
 * Emphasis chosen while the resume is being written comes out following the
 * numbers rather than the relevance, because the model is busy selecting
 * content, tailoring, and managing length at the same time. The result is a
 * page where a hotel's Google rating carries the same visual weight as five
 * years of the exact experience the job asks for, and where the most relevant
 * line — "reported daily to customer stakeholders" — is never marked at all
 * because it contains no digits.
 *
 * Reading a finished document with one question in mind is a different and far
 * easier task, and it is the only point at which the whole page can be weighed
 * against the job ad at once.
 */
export const EMPHASIS_PASS_PROMPT = (
    resumeMarkdown: string,
    jobDescription: string,
    jobTitle?: string,
): string => `You are preparing a resume for a hiring manager who will look at it for about thirty seconds before deciding whether to read it properly.

Your ONLY job is to decide what their eye should land on, and mark it in bold. You are not rewriting anything.

== THE ROLE THEY ARE HIRING FOR ==
${jobTitle ? `Title: ${jobTitle}\n` : ''}"""
${jobDescription.slice(0, 6000)}
"""

== THE RESUME ==
"""
${resumeMarkdown}
"""

== HOW TO DECIDE ==
Before marking anything, work out what this particular employer is actually buying. Read the job ad for what the role genuinely requires day to day — not the boilerplate. Then ask, of each candidate line: if the hiring manager read only this, would it move them towards an interview?

Mark what answers yes. Rules, in order of importance:

1. RELEVANCE BEATS SIZE. A number is not automatically important. Emphasise the evidence that matches what this employer needs, even when the impressive figure sits somewhere else. A large number in experience unrelated to this role is a distraction — it pulls the eye away from the case you are making.

2. EMPHASIS DOES NOT HAVE TO CONTAIN A NUMBER. If the strongest proof for this job is a capability — working unsupervised in the field, reporting to customer stakeholders, holding a licence or ticket the ad asks for — mark that. This is the single biggest thing a purely numeric rule gets wrong.

3. CONCENTRATE IT WHERE THE JOB IS WON. Emphasis should cluster in the experience that sells this application. A role, project, or section that does not support this application should carry little or no emphasis, however good its numbers are. Spreading marks evenly across the page is the same as marking nothing.

4. SIX TO TEN SPANS ACROSS THE WHOLE DOCUMENT. Never more than twelve. At most ONE span per bullet. Most bullets should end up with none — that is what makes the marked ones work.

5. MARK THE PHRASE, NOT JUST THE FIGURE. Include the words that give it meaning: "cut validation cycle time by **75%, from two days to half a day**" rather than "**75%**". Keep the span inside one sentence and never let it run to the end of a long clause.

6. THE SUMMARY MAY CARRY AT MOST ONE SPAN, and only if the single most relevant thing about this candidate is stated there and nowhere else. Usually it carries none.

== WHAT YOU MAY CHANGE ==
NOTHING except the placement of ** markers.

- Return the ENTIRE document, start to finish, byte for byte identical apart from emphasis.
- Do not reword, reorder, shorten, correct, or improve a single character. Not a typo, not a date, not spacing.
- Do not add or remove lines, headings, bullets, or blank lines.
- Only "- " bullet lines and the professional summary paragraph may gain or lose emphasis.
- Leave every heading, the name line, the role line, the contact line, and every date line EXACTLY as they are — they carry no emphasis and the renderer reads their formatting structurally.
- Leave the existing "**{Degree}**" entries under Education and the "**{Label}:**" rows under Skills exactly as they are. Those are structural, not emphasis. Do not count them towards your span budget.
- You may REMOVE emphasis the previous pass added where it does not earn its place. That is expected.

Return ONLY the finished markdown document. No preamble, no explanation, no code fences.`;
```


# SECTION: LIVE INTAKE PATH  (the fix-it-once step)


## `server/src/services/baselineResume.ts`

**Runtime status: LIVE**

Generates the cleaned "Your Improved Resume" at signup. THE ONLY place resume_rules.md reaches a resume. Output is never fed back into generation.

```typescript
import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { prisma } from '../index';
import fs from 'fs';
import path from 'path';

const RESUME_RULES = fs.readFileSync(
  path.join(__dirname, '..', '..', 'rules', 'resume_rules.md'),
  'utf-8'
);

export async function generateBaselineResume(
  userId: string,
  resumeRawText: string,
  reportMarkdown: string,
): Promise<void> {
  try {
    const existing = await prisma.document.findFirst({
      where: { userId, type: 'BASELINE_RESUME' },
    });
    if (existing) {
      console.log(`[BaselineResume] Already exists for userId=${userId} — skipping`);
      return;
    }

    const prompt = `You are a professional Australian resume writer rewriting a candidate's resume based on a diagnostic report that identified exactly what is wrong with it.

RESUME RULES — follow every rule in this document:
${RESUME_RULES}

DIAGNOSTIC FINDINGS — these identify exactly what needs fixing. Address every issue directly:
${reportMarkdown}

CANDIDATE'S EXISTING RESUME:
${resumeRawText}

TASK:
Rewrite the resume above into a polished, ATS-optimised Australian resume. This is a general-purpose version (no job description) targeting the candidate's stated role.

ADDITIONAL RULES:
- Use only information explicitly present in the candidate's resume above. Do NOT insert placeholder text, bracketed prompts, or fill-in markers of any kind. If a metric is missing, write the bullet without it — clean, factual, action-led.
- Clean up formatting: consistent dates, proper section hierarchy, ATS-safe markdown headings, parallel bullet structure across roles.
- Do NOT fabricate metrics or details not present in the original resume.
- Fix every weakness identified in the diagnostic findings.
- Australian English throughout (organisation, programme, behaviour, recognise, etc.)
- The Professional Summary must be written in FIRST PERSON (e.g. "Seasoned Business Analyst with 15 years of experience…" or "I bring 10 years of…"). Never write the summary in third person — no "he", "she", "they", and never use the candidate's name within the summary itself.
- Contact line: include only the contact channels actually present in the candidate's resume above. If no LinkedIn URL is provided in their resume, OMIT LinkedIn entirely — do NOT write the word "LinkedIn" as a bare label. If a LinkedIn URL is provided, render it as the URL itself (e.g. linkedin.com/in/handle), not the word "LinkedIn".
- Markdown structure: each section header (## Professional Summary, ## Work Experience, ## Education, ## Skills, etc.) MUST be on its own line, with a blank line before and after. Never write a section header on the same line as body text. Use a single blank line between every paragraph and bullet block.
- The output is a polished draft ready for immediate use as-is. Output the complete resume in clean markdown only. No preamble, no meta-commentary, no explanations — just the resume.`;

    const raw = await callLLMWithRetry(prompt, false);
    const content = typeof raw === 'string' ? raw : String(raw ?? '');
    if (!content.trim()) {
      throw new Error('LLM returned empty or non-string response');
    }

    await prisma.document.create({
      data: {
        title: 'Your Improved Resume',
        content,
        type: 'BASELINE_RESUME',
        userId,
      },
    });

    console.log(`[BaselineResume] Generated and saved for userId=${userId}`);
  } catch (err) {
    console.error('[BaselineResume] Generation failed:', err);
    // Never throw — caller is fire-and-forget
  }
}
```


## `server/src/services/prompts/extraction.ts`

**Runtime status: LIVE**

Parses the uploaded resume into structured profile fields.

```typescript
export const STAGE_1_PROMPT = (text: string) => `
You are an expert Career Coach and Data Extraction Engine.
Your goal is 100% data density — extract EVERY piece of information into the structured JSON format below.

FIDELITY (most important rule): Extract only what is explicitly written in the resume. Never invent, infer, or guess a company name, employer, job title, date, qualification, institution, certification, or metric. If a field is not present in the resume, return null or omit it. In particular, if a role lists no employer, set "company" to null. Do not fill it with a plausible-sounding company name. Copy names, employers, and dates verbatim from the resume.

STRUCTURE: Keep each role intact. Do not split one role's bullets into separate entries. A task, assignment, or sub-project performed inside a job stays as a bullet under that job. Only create a PROJECTS entry when the resume itself presents the item under a distinct projects or portfolio heading, or as a clearly standalone project with its own title. When in doubt, keep it as a bullet under the role it belongs to.

Specific Instructions:
1. EXPERIENCE: Paid or unpaid work roles only. Do NOT include academic projects here. For each experience entry set "isCasual": true ONLY when the role is a casual or survival job unrelated to a professional career — retail or sales assistant, kitchen hand, cleaning, food handling, delivery, warehouse temp, hospitality floor or bar work, event patron staff, or similar. Set "isCasual": false for every skilled, technical, managerial, supervisory, research, academic, trade, or professional role, even a restaurant or shift MANAGER, and even when the role is in a different field from the candidate's target. When unsure, set false.
2. PROJECTS: Extract a project only when the resume presents it as a distinct, separately headed project (academic, personal, freelance, open source, capstone). Do not promote a single bullet from a job into a project. Use the institution or organisation name as "org". If genuinely none is stated, use "Personal Project".
3. VOLUNTEERING: Community work, student societies, extracurriculars.
4. CERTIFICATIONS: Professional credentials and short courses only, not degrees.
5. LANGUAGES: All languages and proficiency levels.
6. COACHING ALERTS:
   - RED: Missing mandatory info (e.g., contact email, degree year).
   - ORANGE: Weak content (e.g., bullet without a metric, vague descriptions like "assisted with tasks").

Schema:
{
  "profile": {
    "name": "Full Name",
    "email": "Email Address",
    "phone": "Phone Number",
    "linkedin": "LinkedIn URL",
    "location": "Suburb, State",
    "professionalSummary": "4-6 sentences, 300 to 600 characters total, in first person, present tense. Sentence 1: lead with role + seniority anchored by ONE concrete proof point pulled from their resume (a number, %, $, scale, headcount, or timeframe). Sentences 2-4: core strengths and specific work they have delivered (named outcomes, not vague duties). Final sentence: what they are aiming at next. Never write 'they', 'he', 'she', and never use the candidate's name within the summary itself. Examples: 'I am a Marketing Coordinator with 3 years scaling content programs that grew engagement 40% year on year at a Sydney agency. I specialise in performance marketing and audience segmentation, with hands-on experience running paid campaigns across LinkedIn and Meta. Most recently I led a content rebuild that lifted organic traffic 2.3x in six months. I am now targeting marketing analyst and growth roles where I can pair creative work with measurable outcomes.'. Always speak AS the candidate, not ABOUT them. Plain prose only, no bullets, no headings, no em dashes."
  },
  "skills": {
    "technical": ["Python", "Flask"],
    "industryKnowledge": ["Cybersecurity", "Machine Learning"],
    "softSkills": ["Stakeholder Engagement"]
  },
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or present",
      "isCasual": false,
      "bullets": ["Point 1", "Point 2"],
      "coachingTips": ["Add a metric to bullet 1"]
    }
  ],
  "projects": [
    {
      "org": "University or Organisation Name (or 'Personal Project')",
      "title": "Project Title",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or present",
      "bullets": ["What was built", "What was achieved", "Technologies used"],
      "skills": ["Python", "Machine Learning"],
      "coachingTips": ["Quantify the outcome — e.g. model accuracy achieved"]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Degree Name",
      "field": "Field of Study — copy only if a field of study is explicitly named. If none is stated, return null. Never infer a field from the qualification name (for example, do NOT label 'IGCSE & A Levels' as 'General Education').",
      "startDate": "YYYY",
      "endDate": "YYYY or present",
      "coachingTips": "Missing graduation year? Add it."
    }
  ],
  "volunteering": [{ "org": "", "role": "", "desc": "" }],
  "certifications": [{ "name": "", "issuer": "", "year": "" }],
  "languages": [{ "name": "", "proficiency": "" }],
  "coachingAlerts": [
    { "type": "MISSING_METRIC", "field": "experience[0].bullets[0]", "message": "Add a % or $ result to show impact.", "color": "orange" }
  ]
}

Resume Text:
"""
${text}
"""
`;

export const STAGE_2_PROMPT = (role: string, company: string, bullets: string[]) => `
Review the following resume bullet points for the role of "${role}" at "${company}".
Identify which points represent "Achievements" with measurable impact, leadership, or significant projects.

For each achievement, extract:
1. Title: A short, punchy summary.
2. Description: The full original bullet or a slightly polished version.
3. Metric: Exact numbers, percentages, or scale.
4. Metric Type: Categorize as "Revenue", "Efficiency", "Scale", "Team", "Technical", or "Cost".
5. Industry: Identify the specific industry (e.g., "SaaS", "Construction", "Government", "FinTech").
6. Skills/Tags: Relevant technical and soft skills.

Return a JSON array of objects.

JSON Schema:
{
  "achievements": [
    {
      "title": "Short title",
      "description": "Full bullet content",
      "metric": "Number/Percentage",
      "metricType": "Revenue|Efficiency|Scale|Team|Technical|Cost",
      "industry": "Industry context",
      "skills": ["skill1", "skill2"],
      "tags": ["tag1", "tag2"]
    }
  ]
}

IMPORTANT: Every achievement MUST have a 'title' and 'description'.

Bullets to analyze:
${JSON.stringify(bullets, null, 2)}
`;
```


# SECTION: DOCTRINE  (1,627 lines of Australian-market rules)


## `server/rules/resume_rules.md`

**Runtime status: PARTIALLY LIVE**

Reaches ONLY generateBaselineResume at intake. Never injected into any resume the user generates for a job.

```markdown
# Standard Resume Rules — AI Engine Rule Base
*Scope: Resumes only | Market: Australian | Audience: Australian professionals and skilled migrants in Australia*
*Last Updated: March 2026*

> This document is the primary instruction set the AI Engine reads before generating any resume. Follow every rule in sequence. Do not infer, invent, or fill gaps with placeholder content — if candidate data is missing, flag it explicitly and request it.

---

## SECTION 0 — AI ENGINE BEHAVIOUR RULES

Before generating any output, the AI must:

1. **Read this entire file first.** No exceptions.
2. **Use only data the candidate has provided.** Never fabricate job titles, companies, metrics, or dates.
3. **Flag missing data** rather than filling gaps. Example: `[MISSING: quantified result for this bullet — ask candidate]`
4. **Apply standard English throughout.** See Section 6 for a reference list.
5. **Run an ATS keyword check** — extract the top 10–15 keywords from the provided job description and confirm they appear naturally in the resume before outputting.
6. **No visa status, work rights, nationality, or citizenship** anywhere on the resume. These belong in the cover letter only, and only if strategically necessary.
7. **Output must match the approved template structure exactly** — section order, heading names, and formatting conventions are non-negotiable unless a validated industry exception applies (see Section 7).

---

## SECTION 1 — DOCUMENT STRUCTURE & FORMATTING

### 1.1 Section Order (Fixed)
Generate sections in this exact sequence:
1. Header (Name, Title, Contact)
2. Professional Summary
3. Work Experience
4. Education *(omit entirely if no education data provided — do NOT write a heading or placeholder)*
5. Skills & Competencies
6. Certifications & Professional Development *(omit if empty)*
7. Volunteering & Community Involvement *(omit if empty)*
8. Referees

### 1.2 Length
- **Target: 1-2 pages.** Keep it concise and high-impact.
- Under 5 years experience: aim for a tight 1 page.
- Over 10 years experience: cap at 2 pages — ruthlessly prioritise the last 8–10 years.

### 1.3 Fonts & Visual Formatting
- Fonts: Arial, Calibri, or Roboto. Size 10–11pt for body, 12–14pt for name.
- No tables, text boxes, columns, or graphics — ATS parsers break on these.
- No icons, logos, or decorative elements.
- Consistent date formatting throughout: *Month YYYY — Month YYYY* (e.g., *Jan 2021 — Dec 2023*)
- Margins: 1.5–2cm on all sides.

### 1.4 File Format
- Output as `.docx` for editing, `.pdf` for submission — unless the employer explicitly requests `.docx`.

---

## SECTION 2 — HEADER

> **FORMATTING RULE:** The header block does NOT have a section heading. Do NOT output `## Header` or the word "Header" anywhere. The name/title/contact information appears directly at the top of the document with no label above it.

### 2.1 Required Fields
| Field | Format | Example |
|---|---|---|
| Name | Preferred first name + full last name | *Arjun Sharma* |
| Target Title | Matches the role being applied for | *Marketing Coordinator \| Digital & Content* |
| Email | Professional address | *arjun.sharma@gmail.com* |
| Phone | International/Local format | *+61 412 345 678* |
| LinkedIn | Shortened custom URL | *linkedin.com/in/arjunsharma* |
| Location | Suburb + State only | *Parramatta, NSW, Australia* |

### 2.2 Strictly Excluded
The following must **never** appear in the header or anywhere on the resume:
- Date of birth / age
- Photo
- Marital status / gender / religion
- Nationality, visa type, or work rights status
- Full street address

### 2.3 Name Guidance
If the candidate has a name that is difficult to pronounce in English, they may include a preferred Western name in parentheses — this is their choice, not a requirement. Do not suggest it unprompted.

---

## SECTION 3 — PROFESSIONAL SUMMARY

### 3.1 Structure
- **Length:** 3–4 sentences, 60–80 words. Hard maximum: 80 words. Count before outputting and trim if over.
- **Line 1:** Years of experience + core professional identity + industry/function.
- **Line 2:** One or two signature achievements with a metric if possible.
- **Line 3:** Value proposition — what the candidate brings to an employer in this specific role.
- **Line 4 (optional):** Career direction or the type of opportunity being targeted.

### 3.2 Rules
- Tailor to every job. This section must reflect the target job description's language.
- No clichés: banned phrases include *hardworking, team player, passionate, detail-oriented, results-driven* (unless followed immediately by evidence).
- **VOICE (mandatory) — first person, no name, no third-person pronouns.** Write the summary as the candidate speaking. Acceptable openings: *"I bring 10 years of..."*, *"Seasoned Business Analyst with 15 years..."* (agentless first-person — "I" implied), *"Marketing professional with a track record of..."* (agentless, "I" implied). **NEVER** open with the candidate's name (e.g. *"Kiron brings..."*, *"Jane is a..."*) and **NEVER** use "he", "she", or "they" to refer to the candidate anywhere in the summary. If a sentence needs a subject, use "I" or restructure to agentless first-person — do not reach for the name or a pronoun. This rule applies to the Professional Summary only; bullets in Work Experience follow Section 4.2.
- Must include at least one ATS keyword from the target job description.

### 3.3 Example Framework
*"[Core identity + years of experience] with a track record of [signature achievement with metric]. Brings [key capability] to [type of organisation or role]. Currently seeking [role type] where [value they will add]."*

---

## SECTION 4 — WORK EXPERIENCE

### 4.1 Format Per Role
```
[Job Title] | [Company Name], [Country]          [Start Month YYYY — End Month YYYY]
[City, Country]

• Bullet 1
• Bullet 2
• Bullet 3
```

- List roles in **reverse chronological order** — most recent first.
- Include roles from the last 10 years. For roles older than that, use a brief single-line entry or group them.
- For current roles: use *[Start Date] — Present*

### 4.2 Bullet Point Rules
Every bullet must be **outcome-first**. Structure:

```
[Result/number] + [action verb] + [method or context]
```

Not:
```
[Task description] + [vague result]
```

**Before generating each bullet, run this check:**
- Does it answer "So what?"
- Does it contain a number, percentage, or concrete scale indicator?
- Does it name what the candidate specifically did (not "we" or "the team")?

If any of these is No → rewrite the bullet or do not include it.

- Minimum one metric per bullet (%, $, headcount, timeframe, volume).
- If a metric is genuinely unavailable, use contextual scale: *"...across a team of 12"* or *"...serving 3,000+ customers"*.
- Maximum 3–5 bullets per role. Quality over quantity.
- Start every bullet with a different action verb. No repetition.
- Past tense for previous roles, present tense for current role.

**Banned bullet patterns (automatic rewrite):**
- "Responsible for managing..."
- "Assisted with..."
- "Helped to develop..."
- "Worked closely with the team to..."
- "Demonstrating my ability to..." (AI self-narration — never acceptable)
- "Highlighting my..." (same)
- "Showcasing my..." (same)
- "Ensuring alignment with..." (vague process language)
- Any bullet where "we" or "the team" is the agent of the result — rewrite to "I"

**Approved action verb bank (non-exhaustive):**
Grew, Reduced, Built, Launched, Managed, Increased, Cut, Generated, Led, Delivered, Optimised, Spearheaded, Orchestrated, Drove, Designed, Implemented, Secured, Negotiated, Streamlined, Developed, Trained, Mentored, Analysed, Scaled, Oversaw, Restructured, Coordinated, Produced

### 4.2A Worked Examples — Bullet Before/After

Use these as the quality benchmark. Every bullet in generated output must be at or above the "After" standard.

**Before (fails):**
> Responsible for managing social media accounts and helping to develop content strategies for the team.

**After (passes):**
> Grew Instagram engagement rate from 2.1% to 6.8% in 90 days by redesigning the content calendar around peak-time posting and A/B testing caption formats across 48 posts.

---

**Before (fails):**
> Assisted with onboarding new employees and ensuring they understood company policies.

**After (passes):**
> Cut new-hire time-to-productivity from 6 weeks to 3.5 weeks by redesigning the onboarding programme, consolidating 14 separate induction documents into a single structured 4-day schedule.

---

**Before (fails):**
> Worked closely with the sales team to improve customer satisfaction scores.

**After (passes):**
> Lifted customer satisfaction (NPS) from 41 to 67 over two quarters by implementing a post-call feedback loop and delivering targeted coaching to 8 sales representatives based on call recording analysis.

---

**Diagnostic check before writing each bullet:**
1. Who is the agent? Must be "I" — not "we" or "the team."
2. What is the number? Every bullet needs one — %, $, headcount, volume, or timeframe.
3. What exactly did I do? Name the specific method or decision, not a job description phrase.
4. So what? The result must matter to the employer — connect it to output, efficiency, or revenue.

### 4.3 Overseas Experience
- Do not downplay international experience — it is globally valued.
- Add brief context for companies unknown to the reader: *(Top-10 FMCG company in India, ~8,000 employees)*
- State city and country clearly next to each role.

### 4.4 Employment Gaps
- Do not flag or explain gaps on the resume itself.
- If a gap includes freelance work, volunteer work, or study — list it as a legitimate entry.
- If there is no activity to list, leave the gap silent. It can be addressed in the cover letter or interview if raised.

---

## SECTION 5 — EDUCATION

### 5.1 Format Per Qualification
```
[Degree Name] — [Field of Study]                 [Year of Completion]
[University Name] — [City, Country]
[Optional: Relevant subjects, thesis, or GPA if strong]
```

### 5.2 Rules
- List **most recent qualification first**.
- Include GPA only if it is a Distinction average or above (typically ≥ 6.0/7.0 or ≥ 75%).
- For universities not widely known, add a brief credibility note in italics: *(Ranked Top-5 in [Country] — equivalent to a top-tier international university)*
- Do not list high school unless it is the candidate's only qualification.
- Do not list incomplete qualifications unless currently enrolled — in that case: *Expected [Year]*

---

## SECTION 6 — SKILLS & COMPETENCIES

### 6.1 Structure
Each sub-category is a **single horizontal line** — not a vertical list. This saves space and is ATS-friendly.

Format exactly as:
```
**Technical Skills:** Python • Excel (pivot tables, Power Query) • SQL • Tableau
**Industry Knowledge:** Financial Modelling • Regulatory Compliance • Agile/Scrum
**Languages:** English (Professional) • Hindi (Native) • French (Conversational)
**Soft Skills:** Stakeholder Engagement • Cross-cultural Communication • Data Storytelling
```

Rules:
- Use `•` as the separator between items on each line.
- Omit a sub-category line entirely if the candidate has no data for it.
- **Technical Skills:** Hard, role-specific tools and software (be specific — not *Microsoft Office* but *Excel: pivot tables, VLOOKUP, Power Query*).
- **Industry Knowledge:** Domain expertise relevant to the target role.
- **Languages:** Only include if data exists. List with proficiency level.
- **Soft Skills:** Maximum 3–4. Only list if the candidate can back it up with evidence.

### 6.2 ATS Alignment Rule
Cross-reference this section against the target job description. At least 60% of listed skills must directly mirror language from the job ad. Do not use synonyms where the job ad uses a specific term.

---

## SECTION 7 — ENGLISH SPELLING REFERENCE

Always apply **Australian English** spelling. This is non-negotiable for the Australian market.

| US English (incorrect) | Australian English (correct) |
|---|---|
| organized | organised |
| program | programme *(in academic/govt contexts)* |
| analyze | analyse |
| center | centre |
| labor | labour |
| color | colour |
| license (verb) | licence (noun), license (verb) |
| fulfill | fulfil |
| recognize | recognise |
| behavior | behaviour |
| traveling | travelling |
| skillful | skilful |

**Default is always Australian English.** Do not use US spelling under any circumstance.

---

## SECTION 8 — CERTIFICATIONS & PROFESSIONAL DEVELOPMENT

### 8.1 Format
```
[Certification Name] — [Issuing Body]            [Year]
[Course or Workshop] — [Platform]                [Year]
```

### 8.2 Rules
- Include only if relevant to the target role or demonstrating initiative.
- Recognised credentials: AWS, PMP, CPA, CFA, SHRM, Google (Analytics, Ads), Salesforce, Agile/Scrum certifications.
- Include sector-specific training where possible: industry workshops, professional association memberships.
- If this section is empty, omit it entirely — do not include a blank section.

---

## SECTION 9 — VOLUNTEERING & COMMUNITY INVOLVEMENT

### 9.1 Why This Matters
This section is a strategic asset. Many employers value community contribution and initiative. It also signals local engagement and cultural fit.

### 9.2 Format
```
[Role] — [Organisation], [City]                  [Year — Year]
• One line: what you did and the impact.
```

### 9.3 What Counts
- University student societies or clubs
- Industry mentoring programs
- Charity events or community organisations
- Sports coaching or officiating
- Cultural or religious community leadership (framed professionally)
- Any paid or unpaid work during a study period that isn't listed in Work Experience

If this section is empty, omit it — but flag it to the candidate as a gap worth addressing in real life, not just on paper.

---

## SECTION 10 — REFEREES

### 10.1 Standard Australian Format
- Two professional referees is the standard.
- Do not list referee names and contact details on the resume — write: *"Available upon request. Two professional referees prepared."*
- Encourage the candidate to have diverse referees (university lecturer, internship supervisor, or previous employer).

### 10.2 Coaching Note (Flag to Candidate)
Prompt the candidate to brief their referees on the role before submitting — referees who know the context give stronger, more relevant references.

---

## SECTION 11 — INDUSTRY-SPECIFIC EXCEPTIONS

The rules above apply across most industries. The following are exceptions where some markets may diverge meaningfully:

### 11.1 Academia & Research
- CV format is appropriate (can exceed 2 pages).
- Include: publications, conference presentations, grants, research projects.
- GPA is always relevant regardless of level.

### 11.2 Government & Public Sector
- Selection criteria responses (STAR format) are often mandatory and separate from the resume.
- Resume may need to align with specific public service capability frameworks.
- Include any government security clearance if held.

### 11.3 Healthcare & Allied Health
- Include relevant registration numbers if registered.
- Clinical placements count as work experience — list them.
- Overseas qualifications may require local board assessment.

### 11.4 Trades & Engineering
- Include licences and tickets relevant to the role.
- List relevant standards familiarity where applicable.

### 11.5 Creative Industries (Design, Media, Marketing)
- Portfolio link in the header is appropriate and recommended.
- For roles where creative output is judged, the resume can be slightly more visually formatted — but ATS compliance still applies for digital submissions.

---

## SECTION 11A — QUALITY GATE (run before outputting)

The following phrases must NEVER appear in any resume output. If detected, rewrite that sentence from scratch:

```
"demonstrating my ability to"
"highlighting my"
"showcasing my"
"results-driven" (without an immediately following number)
"team player"
"excellent communication skills"
"responsible for managing"
"assisted with"
"helped to develop"
"worked closely with the team to"
"ensuring alignment with"
"I am a hardworking"
"I am passionate"
```

### Resume Structural Checks (confirm before output)
- [ ] Professional Summary contains at least one number?
- [ ] Professional Summary is in first person (no candidate name, no "he"/"she"/"they")?
- [ ] Every bullet starts with a strong action verb?
- [ ] Every bullet contains a quantified outcome?
- [ ] No bullet contains "we" or "the team" as the agent of the result?
- [ ] No AI self-narration phrases in any bullet?
- [ ] Professional Summary does NOT share any sentence with the cover letter Para 1?
- [ ] Skills section only lists skills named in the job ad OR evidenced in work experience bullets?

---

## SECTION 12 — PRE-OUTPUT CHECKLIST

Before delivering any resume, the AI Engine must confirm:

- [ ] All sections present and in correct order
- [ ] 1-2 page target met
- [ ] No visa/nationality/age/photo included
- [ ] standard English applied throughout
- [ ] Every bullet follows CAR method with at least one metric
- [ ] Professional Summary tailored to the specific job description
- [ ] ATS keywords from job description present naturally in the document
- [ ] No fabricated data — all content sourced from candidate input
- [ ] Missing data flagged clearly with `[MISSING: ...]` tags
- [ ] Referees section reads "Available upon request"
- [ ] Context added for overseas employers and universities where necessary

---

*This file is maintained by the coaching team. Changes to this rule base will affect all future AI-generated resumes. Review quarterly or when Australian market standards shift.*
```


## `server/rules/cover_letter_rules.md`

**Runtime status: DEAD**

Loaded by readRules() in the legacy POST /:type path. The frontend never routes cover letters there. Zero effect on output.

```markdown
# Standard Cover Letter Rules — AI Engine Rule Base
*Scope: Cover Letters only | Market: Australian | Audience: Australian employers and skilled migrants applying in Australia*
*Last Updated: March 2026*

> This document is the primary instruction set the AI Engine reads before generating any cover letter. Every rule applies unless a validated exception in Section 9 overrides it. Do not infer, fabricate, or pad content — if candidate data is missing, flag it explicitly with `[MISSING: ...]` and request it.

---

## SECTION 0 — AI ENGINE BEHAVIOUR RULES

Before generating any cover letter, the AI must:

1. **Read this entire file first.** No exceptions.
2. **Read the provided Job Description in full.** Identify: role title, organisation name, key responsibilities, required skills, stated values, and any explicit criteria.
3. **Cross-reference the candidate's Achievement Bank.** Select the 2–3 most relevant achievements to the specific JD. Do not use generic or weakly matched achievements.
4. **Use only data the candidate has provided.** Never fabricate metrics, company names, or outcomes.
5. **Flag missing data** with `[MISSING: ...]` rather than filling gaps. Example: `[MISSING: company research — ask candidate what they know or admire about this organisation]`
6. **Apply Australian English throughout.** Refer to Section 7 of the Resume Rules file for the spelling reference list. Default is always Australian spelling — never US English.
7. **Visa status placement rule:** Work rights or visa information may be included in the cover letter **only** if strategically necessary for the specific role (e.g., the JD explicitly asks about work rights, or the role is tied to eligibility). If included, place it in a single, confident sentence in the closing paragraph. Never include it in the header, opening, or body paragraphs. Default: omit entirely unless flagged as necessary.
8. **One page. Hard limit.** No exceptions regardless of experience level or role seniority.

---

## SECTION 1 — WHAT A COVER LETTER IS (AND IS NOT)

### 1.1 Purpose
A cover letter is a **targeted pitch**, not a resume summary. Its job is to:
- Connect the candidate's most relevant experience directly to the role's requirements
- Demonstrate genuine knowledge of the organisation
- Show personality and communication quality — hiring managers assess writing skill here
- Explain anything the resume cannot (e.g., a career transition, relocation, or why this specific organisation)

### 1.2 What It Is Not
- A repeat of the resume — do not restate bullet points verbatim
- A list of skills — use narrative, not dot points (unless the JD explicitly asks for criteria responses in the cover letter, in which case see Section 8)
- A generic template with company name swapped in — hiring managers identify these immediately and they damage the application
- A place to express desperation or over-apologise for gaps or background

### 1.3 Professional Cultural Tone
Professional culture rewards: directness, evidence over assertion, a hint of warmth, and demonstrated effort. It penalises: excessive formality, hollow flattery, and generic statements. The letter should feel like it was written by an intelligent, prepared professional — not a template engine.

---

## SECTION 2 — STRUCTURE & FORMAT

### 2.1 Document Structure (Fixed Order)
```
[Candidate Header — matches resume header exactly]
[Date]
[Hiring Manager Name and Title, if known]
[Organisation Name]
[Organisation Address, if known — or City, State]

[Salutation]

[Paragraph 1 — The Hook: Role name + one specific company detail + why this candidate]
[Paragraph 2 — The Evidence: ONE quantified achievement story (Situation → Action → Result)]
[Paragraph 3 — The Connection: Why this company specifically — references something from the ad]
[Paragraph 4 — The Close: Peer-level CTA, confident and brief]

[Sign-off]
[Full Name]
```

### 2.2 Length
- **Exactly 4 paragraphs. One full page maximum.** See Section 9A for the mandatory paragraph-by-paragraph structure.
- Aim for 300–400 words. Under 250 reads as underprepared. Over 450 risks losing the reader.
- Paragraphs should be 2–4 sentences each. Hook paragraph is intentionally shorter (2–3 sentences).

### 2.3 Formatting Rules
- Left-aligned throughout, single line spacing within paragraphs, double spacing between paragraphs.
- Font must match the resume (Arial, Calibri, or Roboto, 10–11pt).
- No bold, italics, or formatting within the body text — the letter should read as clean prose.
- No bullet points in the body unless the application explicitly requires criteria addressed in the cover letter.

### 2.4 Date Format
Use: *14 March 2026* — not 14/03/26 or March 14, 2026.

---

## SECTION 3 — SALUTATION

### 3.1 Priority Order
1. **Named salutation** — always preferred: *Dear Ms. Johnson,* or *Dear Mr. Chen,*
2. If gender is unknown from name: use full name — *Dear Alex Johnson,*
3. If hiring manager name is unavailable: *Dear Hiring Manager,*
4. **Never use:** *To Whom It May Concern* — considered outdated.
5. **Never use:** *Hi [Name],* — too casual for a formal application unless the industry is explicitly startup/creative.

### 3.2 Finding the Hiring Manager Name
If the candidate has not provided a name, flag it: `[MISSING: hiring manager name — candidate should check LinkedIn or call the organisation's main line to ask who is managing this recruitment]`. Do not default to "Hiring Manager" without flagging this as a missed opportunity.

---

## SECTION 4 — PARAGRAPH 1: OPENING

### 4.1 Rules
- State the **exact role title** as it appears in the job ad in the first or second sentence.
- Optional: Mention **where the role was found** if it adds legitimacy or context (Seek, LinkedIn), but prioritize a strong hook.
- Include a **hook** — one sentence that immediately signals why this candidate is a strong fit. This is not a self-description; it is a relevant proof point or connection.
- Do not open with *"I am writing to apply for..."* as the first five words. It is the most overused opening in recruitment.

### 4.2 Strong Opening Frameworks
**Achievement hook:** *"My track record delivering [Metric] at [Company] aligns directly with your goals for the [Role Title] position."*

**Specific connection hook:** *"I have closely followed [Organisation]'s work in [market/initiative]. My [relevant function] experience positions me well to support [Organisation] as [Role Title]."*

**Direct evidence hook:** *"Having driven an [Metric] improvement in [Function] at [Company], I was immediately drawn to the [Role Title] role at [Organisation]."*

### 4.3 What to Avoid
- Avoid robotic, formulaic sentence structures that read like a template.
- Do not open with flattery: *"I have always admired [Organisation] and would be honoured..."*
- Do not open with self-description: *"I am a passionate and dedicated marketing professional..."*
- Do not mention visa status in the opening under any circumstance.

---

## SECTION 5 — PARAGRAPHS 2 & 3: EVIDENCE BLOCKS

### 5.1 Core Rule
Each evidence paragraph must do three things:
1. Reference a **specific requirement from the JD**
2. Provide a **concrete example from the Achievement Bank** that demonstrates it
3. Quantify the **outcome** — percentage, dollar value, volume, timeframe, or team scale

### 5.2 Achievement Bank Integration
Pull the 2–3 highest-relevance ranked achievements from the bank for this JD. Each evidence paragraph builds around one of these. The narrative connects the achievement to the specific language of the JD — do not just paste in the achievement bullet point.

**Transform from bullet to narrative:**
Resume bullet: *"Increased email open rate by 34% through A/B testing subject line strategy."*
Cover letter narrative: *"At [Company], I identified that our email communications were underperforming against industry benchmarks. By implementing a systematic A/B testing programme across subject lines, I drove a 34% increase in open rates over one quarter — directly improving lead quality for the sales team."*

### 5.3 If Achievement Bank Is Sparse
If the candidate has fewer than 3 strong, quantified achievements relevant to this JD:
- Flag the gap: `[MISSING: strong achievement relevant to [JD requirement] — ask candidate for a specific example with a metric]`
- Do not pad with vague claims like *"I have strong experience in stakeholder management"* without evidence
- Use transferable evidence from adjacent experience rather than fabricating relevance

### 5.4 International Experience Framing
Overseas achievements are valid and should be presented with brief contextual anchoring:
*"During my time at [Company] in [Country] — a top-5 [industry] firm serving [scale]..."*
This removes any ambiguity about the significance of the role without over-explaining.

---

## SECTION 6 — PARAGRAPH 4: COMPANY CONNECTION

This is where many applications fail. Generic letters skip or fake this section. A genuine, specific company connection paragraph is the single biggest differentiator between a shortlisted and a discarded application.

### 6.2 What It Must Contain
A specific reference to **one of the following**, tied back to the candidate's own values or experience:
- A recent company initiative, project, or news item
- A stated organisational value from the website or annual report
- A product, service, or approach the candidate has direct experience with or genuine interest in
- A cultural or community programme the organisation runs

### 6.3 Data Collection Rule
If the candidate has not provided this information, flag it: `[MISSING: candidate must research [Organisation] and provide one specific thing they know or admire — check LinkedIn, company website, recent news, or annual report. This paragraph cannot be generated without genuine input.]`

Do not generate a generic placeholder like *"I admire your commitment to innovation"* — this is worse than omitting the paragraph entirely.

### 6.4 Example of a Strong Company Connection
*"Your 2025 partnership with [Regional Body] to expand [initiative] reflects exactly the kind of community-embedded approach I value in marketing — it is the reason I am specifically targeting [Organisation] rather than other roles in this sector."*

---

## SECTION 7 — PARAGRAPH 5: CLOSING

### 7.1 Structure
- Express genuine enthusiasm for the role (one sentence — not gushing)
- Include a confident, proactive call to action — not a passive *"I hope to hear from you"*
- If visa information is required: insert a single confident sentence here (see Section 0, Rule 7)
- Thank the reader for their time
- Do not re-summarise the letter

### 7.2 Strong Closing Frameworks
**Proactive CTA:** *"I would welcome the opportunity to discuss how my background in [function] can contribute to [Organisation]'s [specific goal]. I am available for a conversation at your convenience."*

**Confident visa sentence (if required):** *"I hold a [Visa Type] with full working rights, valid until [date]."* — One sentence. No elaboration.

### 7.3 Sign-Off
Use: *Yours sincerely,* if the hiring manager is named.
Use: *Yours faithfully,* if addressed to *Dear Hiring Manager* (formal convention).
Do not use: *Kind regards,* or *Best,* — too casual for a formal cover letter.

---

Some employers (particularly government, education, and healthcare) ask applicants to address selection criteria **within** the cover letter rather than as a separate document.

If this is required:
- Use a short introductory paragraph (role, hook, where found)
- Then address each criterion with a heading and a condensed STAR response (aim for 150–200 words per criterion)
- Use bullet points only for the criteria headings — body text remains prose
- Close with a single brief paragraph (enthusiasm + CTA)
- This format will likely exceed one page — that is acceptable **only when the employer explicitly requests it**

For full selection criteria rules, see the separate `selection_criteria_rules.md` file.

---

## SECTION 9 — INDUSTRY-SPECIFIC EXCEPTIONS

### 9.1 Government & Public Sector
- More formal tone is appropriate — avoid colloquialisms entirely
- Opening should reference the role's advertised vacancy number if one exists
- Values alignment is essential — explicitly reference the APS Values or relevant state framework values if applying to government
- Selection criteria are almost always addressed separately, not in the cover letter

### 9.2 Startups & Tech
- Slightly warmer, less formal tone is acceptable
- Portfolio or GitHub link in the closing paragraph is appropriate
- Conciseness is rewarded — aim for 3 tight paragraphs, not 5
- Opening can be bolder and more direct

### 9.3 Healthcare & Allied Health
- Emphasise patient outcomes, not just process metrics
- Reference any relevant registration or assessment status clearly in the closing
- Compassion and communication capability should be evidenced with a real example, not stated

### 9.4 Creative Industries
- Voice and personality are assessed through the letter itself — it functions as a writing sample
- A slightly more distinctive opening is acceptable and expected
- Portfolio link must appear in the closing paragraph

---

## SECTION 9A — PARAGRAPH-BY-PARAGRAPH RULES (STRICT — takes precedence over Section 2)

The cover letter is always exactly **4 paragraphs**. One page. No exceptions.

### Paragraph 1 — The Hook
Name the role. Then write ONE sentence that shows specific knowledge of this company — not the industry, this company. Use VOLUME_SIGNALS or TEAM_CONTEXT from the job ad if available. Connect that specific detail to the candidate's background.

**Target length:** 2–3 sentences maximum.

**Banned opens (automatic rewrite):**
- "I am writing to express my interest in..."
- "I am excited to apply for..."
- "I am a passionate and motivated..."
- "With X years of experience..."
- Any sentence that could apply to a different company in the same industry

**Test:** Could this opening apply to a competitor? If yes, rewrite it.

---

### Paragraph 2 — The Evidence
ONE story. Not a list. Structure: Situation (1 sentence) → Action (specific, first person, not "the team") → Result (a number, %, dollar value, time saved, or scale).

Use the strongest quantified achievement from the candidate's bank that directly relates to the role's key requirements.

**Hard rules:**
- Maximum ONE achievement in this paragraph
- The result must be quantified
- The action must name a specific method or decision, not just a responsibility

**Banned patterns:**
- "I have managed X, Y, and Z..." (list format)
- "In addition to this, I also..." (second achievement)
- "My experience includes..." (task summary)
- "I am confident in my ability to..." (claim without proof)

**Test:** Does this paragraph contain more than one achievement? If yes, cut to the strongest one.

---

### Paragraph 3 — The Connection
Show you understand their specific situation — not just that you have relevant skills. Use TEAM_CONTEXT, VOLUME_SIGNALS, or CULTURAL_FLAGS from the ad to write something that could only apply to this company.

**This paragraph must NOT:**
- Repeat what's in Para 2
- List skills ("I am proficient in X, Y, Z")
- Use "great cultural fit" or any equivalent
- Mirror ad language without adding insight

**Test:** If you removed the company name, could this have been written for a competitor? If yes, rewrite with a specific detail from the ad.

---

### Paragraph 4 — The Close
One to two sentences. Confident and peer-level. Ask for the next conversation.

**Approved patterns:**
- "I'd welcome the opportunity to discuss [role] further — happy to connect at a time that works for you."
- "I'd love to explore how my background fits what [Company] is building — feel free to reach out."

**Banned close patterns:**
- "I am available to discuss how my skills and experience align with..."
- "I hope to hear from you"
- "Thank you for your time and consideration"
- "I look forward to discussing my qualifications"
- Any sentence with "I hope", "I wish", or "I would be honoured"

---

## SECTION 10 — BANNED PHRASES & PATTERNS

The following phrases and patterns reduce the quality of any cover letter. Flag and replace them:

| Banned | Replace With |
|---|---|
| "I am a hardworking and dedicated professional" | Specific achievement that proves it |
| "I am passionate about..." | Evidence of sustained action in that area |
| "To whom it may concern" | "Dear Hiring Manager," |
| "I believe I would be a great fit" | Evidence of fit, not assertion of it |
| "I am writing to apply for the position of..." (as opener) | Any of the hook frameworks in Section 4.2 |
| "Please find attached my resume" | "I have attached my resume for your consideration" |
| "I look forward to hearing from you" | Proactive CTA from Section 7.2 |
| "References available upon request" | Remove — does not belong in a cover letter |
| Any mention of salary expectations | Never include unless explicitly asked |

---

## SECTION 10A — QUALITY GATE (run before outputting)

The following phrases must NEVER appear in any output. If detected, rewrite that sentence from scratch before returning the document:

```
"demonstrating my ability to"
"highlighting my"
"showcasing my"
"I am confident in my ability to"
"I believe I would be"
"passionate about contributing"
"I am a highly motivated"
"results-driven"
"team player"
"excellent communication skills"
"great cultural fit"
"I hope to hear from you"
"I look forward to discussing my qualifications"
"I am available to discuss how my skills and experience align"
"as per the job description"
"as mentioned in the job advertisement"
"I am writing to express my interest"
"I am excited to apply"
"in addition to this, I also"
```

### Structural Quality Checks (confirm before output)
- [ ] Exactly 4 paragraphs?
- [ ] Para 1 names the company with a specific, non-generic detail?
- [ ] Para 2 contains exactly ONE achievement story with a quantified result?
- [ ] Para 3 references something specific to this company, not a generic skill?
- [ ] Close uses peer-level language from the approved patterns?
- [ ] No sentence from Para 1 appears in the resume summary?

### Tone Test (apply before finalising)
1. Does it sound like it was written by a person who knows their value?
2. Does it sound like it could have been written by ChatGPT?
3. Does it sound like it's trying too hard to impress?

If the answer to 2 or 3 is yes → rewrite for specificity and directness. Shorter sentences beat longer ones. Concrete beats abstract. Proof beats claims.

---

## SECTION 10B — WORKED EXAMPLE (Reference Standard)

The following is a complete, high-standard cover letter. Use this as the benchmark for tone, structure, specificity, and length. Every letter you generate should be at or above this quality level.

---

**Context:** Graduate applying for a Marketing Coordinator role at a regional bank in Melbourne.

---

Priya Sharma
Marketing Coordinator | Digital & Content
priya.sharma@gmail.com | +61 412 345 678 | linkedin.com/in/priyasharma
South Yarra, VIC, Australia

14 April 2026

Dear Ms. Williams,

ANZ's recent Grow Your Business campaign — which drove a 22% increase in SME account enquiries according to the 2025 Annual Report — reflects exactly the kind of data-backed content strategy I want to help build as Marketing Coordinator.

During my placement at Medibank, I identified that our member newsletters had a 19% open rate against an industry benchmark of 28%. I redesigned the content calendar, introduced A/B testing across three subject line variants, and shifted to behavioural segmentation based on claim history. Within 10 weeks, open rates reached 31% — a 63% relative improvement — and the approach was adopted by the broader digital communications team for all outbound member campaigns.

ANZ's 2025–2027 strategy explicitly prioritises "human + digital" customer experiences, and the Coordinator role sits at that intersection. I'm particularly interested in the bank's work on contextual content delivery through the ANZ Plus platform — my Honours thesis examined how notification timing affects financial product engagement, and I'd welcome the chance to apply that research in a commercial setting.

I'd love to explore how my background fits what ANZ is building in this space — happy to connect at a time that works for you.

Yours sincerely,
Priya Sharma

---

**Why this letter works:**
- Para 1: Names the specific campaign with a real metric. Not generic praise — a specific proof of research.
- Para 2: One achievement, fully quantified, written as Situation (19% open rate) → Action (redesigned, A/B tested, segmented) → Result (31%, adopted by team).
- Para 3: References a specific strategic initiative from the company's own documents. Could not apply to a competitor.
- Para 4: Peer-level, confident, no supplication.
- Word count: 218 words. Tight. Every sentence earns its place.

**What would make this letter fail:**
- "I am excited to apply for the Marketing Coordinator position at ANZ" as the opener → generic, rewrite
- Listing 4 different achievements → breaks the one-story rule, dilutes impact
- "I believe I would be a great cultural fit" → assertion, not evidence → banned
- "I look forward to hearing from you" → passive, supplicant → banned

---

## SECTION 11 — PRE-OUTPUT CHECKLIST

Before delivering any cover letter, the AI Engine must confirm:

- [ ] One page, 300–450 words
- [ ] Named salutation used (or flagged as missing)
- [ ] Opening avoids banned openers and includes hook + role title + source
- [ ] Two evidence paragraphs each contain: JD requirement + specific example + quantified result
- [ ] Company connection paragraph is specific and genuine (not generic — or flagged as missing)
- [ ] Closing includes proactive CTA
- [ ] Visa information: omitted unless flagged as strategically necessary
- [ ] standard English applied throughout
- [ ] No content duplicated verbatim from the resume
- [ ] No fabricated data — all content sourced from candidate input or Achievement Bank
- [ ] All missing data flagged with `[MISSING: ...]` tags
- [ ] Tone is direct, warm, evidence-based — not sycophantic or generic

---

*This file is maintained by the coaching team. Review quarterly or when market standards shift.*
```


## `server/rules/Resume_ATS_Template.md`

**Runtime status: DEAD**

Not referenced by any live path.

```markdown
# RESUME OUTPUT TEMPLATE
# AI Engine: Use this exact structure for all resume generation.
# Replace all [PLACEHOLDER] text with candidate data.
# Do not add sections not in this template.
# Do not remove sections — omit them cleanly if no data exists.

---
{CANDIDATE_NAME}
{TARGET_ROLE_TITLE}
{email} | {phone} | {linkedin} | {city}, {state} {postcode}

---
PROFESSIONAL SUMMARY
{3-4 sentence summary — tailored to JD}

---
WORK EXPERIENCE

{job_title} | {company}, {country}    {start_date} — {end_date}
{city}, {country}
- {achievement_1_CAR_format}
- {achievement_2_CAR_format}
- {achievement_3_CAR_format}

[repeat for each role]

---
EDUCATION

{degree} — {field}                    {year}
{university} — {city}, {country}

---
SKILLS & COMPETENCIES

Technical Skills: {hard_skills}
Industry Knowledge: {domain_skills}
Languages: {languages_with_proficiency}
Soft Skills: {max_4_evidenced_soft_skills}

---
CERTIFICATIONS & PROFESSIONAL DEVELOPMENT
{certification} — {issuing_body}      {year}

---
VOLUNTEERING & COMMUNITY INVOLVEMENT
{role} — {organisation}, {city}       {years}
- {one line impact description}

---
REFEREES
Available upon request.
```


## `server/rules/selection_criteria_rules.md`

**Runtime status: DEAD**

Superseded by SELECTION_CRITERIA_PROMPT on the structured route.

```markdown
# Standard Selection Criteria Rules — AI Engine Rule Base
*Scope: Selection Criteria Responses | Market: General | Audience: Global professionals*
*Last Updated: March 2026*

> This document is the primary instruction set the AI Engine reads before generating any selection criteria response. Selection criteria (or capability statements) are high-stakes, heavily weighted components of applications — particularly in government, education, healthcare, and community sectors. Superficial or generic responses will result in rejection. Every response must be evidence-driven, specific, and structured.

---

## SECTION 0 — AI ENGINE BEHAVIOUR RULES

Before generating any selection criteria response, the AI must:

1. **Read this entire file first.** No exceptions.
2. **Read the full Job Description and all listed criteria carefully.** Identify whether criteria are labelled *Essential* or *Desirable* — Essential criteria require full STAR responses. Desirable criteria may be addressed more briefly.
3. **Check for explicit formatting instructions.** If the JD specifies word limits, page limits, or a specific format (STAR, SAO, pitch), those instructions override the defaults in this file.
4. **Cross-reference the Achievement Bank** for each criterion. Rank achievements by relevance before generating. Pull the strongest, most specific evidence for each criterion — never reuse the same example across multiple criteria.
5. **Never fabricate outcomes, metrics, or contexts.** If evidence is insufficient, flag it: `[MISSING: no strong example found in Achievement Bank for this criterion — ask candidate for a specific instance where they demonstrated X]`
6. **Apply standard English throughout.** See the Resume Rules file for the spelling reference.
7. **Generate each criterion as a standalone response**, clearly headed with the criterion text. Do not blend multiple criteria into one response.

---

## SECTION 1 — WHAT SELECTION CRITERIA ARE

Selection criteria are the specific skills, knowledge, experience, and attributes an employer requires for a role. Applicants are assessed against each criterion individually. In many institutional and public sector roles, the criteria score determines who gets interviewed — the resume is secondary.

- Government (Federal, State, and Local)
- Universities and Education Institutions
- Healthcare and Allied Health
- Not-for-Profit and Community Sector
- Large Corporations and Regulated Industries (often in "Statement of Claims" format)

### 1.3 Common Labels
Criteria may appear under different headings:
- Key Selection Criteria (KSC)
- Essential Criteria
- Capability Requirements
- Statement of Claims (SOC)
- Pitch (replacing traditional criteria in some APS roles post-2019)

The AI must adapt the output format to match what the application specifically calls for.

---

## SECTION 2 — THE STAR METHOD: PRIMARY FRAMEWORK

STAR (Situation, Task, Action, Result) is the globally recognised standard for competency-based recruitment and is the most widely used framework across all sectors. It is the AI Engine's default for all selection criteria responses unless the application specifies otherwise.

### 2.2 STAR Breakdown with Proportions

| Component | What It Covers | Target Word Proportion |
|---|---|---|
| **Situation** | The context — where, when, what organisation, what challenge | 10–15% |
| **Task** | The candidate's specific responsibility in that situation | 10–15% |
| **Action** | The specific steps the candidate personally took | 40–50% |
| **Result** | The quantified or clearly evidenced outcome | 20–25% |

**The Action section carries the most weight.** Panel members are assessing what *the candidate specifically did* — not what the team did, not what the organisation decided, not what happened by circumstance.

### 2.3 Critical Rules for Each Component

**Situation:**
- Provide enough context for a reader unfamiliar with the organisation
- Keep it brief — the situation is the stage, not the performance
- For overseas experience: add one line of scale context if necessary (e.g., *"...at a 2,000-person manufacturing company, equivalent in scale to a mid-sized domestic enterprise"*)

**Task:**
- Be explicit about personal ownership: *"I was responsible for..."* not *"The team was tasked with..."*
- Distinguish the candidate's role from the broader team's role

**Action:**
- Use first person throughout: *"I developed...", "I negotiated...", "I designed..."*
- Detail is what separates strong responses from weak ones — describe the *how*, not just the *what*
- Include the thinking behind decisions where relevant: *"Recognising that [insight], I chose to [approach] rather than [alternative] because [reasoning]..."*
- If multiple actions were taken, sequence them logically

**Result:**
- Quantify wherever possible: percentage improvement, dollar value, time saved, headcount impacted, customer satisfaction score, error rate reduction
- If a metric is genuinely unavailable, use qualitative evidence: senior endorsement, award, policy change adopted, team feedback
- State the result in terms of impact on the organisation, not just personal completion of a task
- Include secondary results where relevant (e.g., *"...which also led to..."*)

---

## SECTION 3 — ADVANCED: BEYOND BASIC STAR

Basic STAR responses demonstrate capability once. Strong responses demonstrate **consistent capability**. Panel members are often more impressed by responses that show a pattern of behaviour across multiple contexts than by a single polished example.

### 3.2 Multi-Example Structure (for broad criteria)
For criteria such as *"Demonstrated ability to work collaboratively"* or *"Strong communication skills"*, a multi-example approach is more persuasive:

**Structure:**
- Opening sentence restates and affirms the criterion
- Example 1: Full mini-STAR (2–3 sentences)
- Example 2: Full mini-STAR (2–3 sentences), different context
- Closing sentence draws a thread connecting both — showing the behaviour is consistent

**Word budget for multi-example:** 300–500 words (aim for the same total as a single full STAR).

**Always open each response by restating the criterion or its key terms.** This signals to the panel that the candidate is addressing their specific criterion — not providing a generic response.

*"I have demonstrated strong written communication skills across several professional contexts..."*
*"My experience in budget management and financial reporting spans three roles..."*
*"Stakeholder engagement has been central to my work in [function]..."*

---

## SECTION 4 — WORD & LENGTH GUIDELINES

### 4.1 Defaults (when no limit is specified)

| Seniority Level | Target Word Count Per Criterion |
|---|---|
| Graduate / Entry-Level | 200–300 words |
| Mid-Level / Coordinator / Analyst | 300–400 words |
| Senior / Management | 400–600 words |
| Executive / Director | 500–800 words |

Follow them exactly. Exceeding a stated word limit is often grounds for automatic disqualification. The AI must:
- Count words per criterion before outputting
- Flag if the response is within 10% above limit: `[WARNING: this response is X words — the limit is Y. Recommend trimming the Situation section first.]`

Some roles ask for a multi-page "pitch" or statement of claims rather than individual criterion responses. In this case:
- Address all criteria but blend them into a coherent narrative
- Use subheadings for each criterion
- Prioritise Essential criteria over Desirable
- See Section 8 for the Pitch format

---

## SECTION 5 — LANGUAGE & TONE

### 5.1 Always First Person
Every action statement must use *I*, not *we* or *the team*. Panel members cannot assess what a team did — they can only score what the individual candidate claims personal responsibility for.

**Correct:** *"I led the stakeholder consultation process, designing the engagement framework and facilitating three workshops..."*
**Incorrect:** *"We developed a stakeholder consultation process that involved workshops..."*

### 5.2 Active Voice Throughout
Passive voice buries the candidate's contribution.

**Active:** *"I redesigned the onboarding programme, reducing training time by 30%."*
**Passive:** *"The onboarding programme was redesigned, resulting in a 30% reduction in training time."*

If the AI identifies that the application is for a role that references a specific capability framework, it must reflect that framework's terminology in the response language.

### 5.4 Tone
- Confident but not arrogant
- Evidence-based — every claim must be supported
- Professional — no colloquialisms, contractions kept minimal
- Avoid self-deprecation: *"Although I don't have direct experience..."* opens a gap the panel will focus on. Instead, lead with what is relevant and bridge confidently.

---

## SECTION 6 — HANDLING GAPS & DIFFICULT CRITERIA

### 6.1 When the Candidate Lacks Direct Experience
Do not fabricate. Instead:
1. Identify the **closest transferable experience** in the Achievement Bank
2. Open the response by acknowledging the transferable context: *"While my direct experience in [specific function] has been developed in [adjacent context], the skills I have applied are directly transferable..."*
3. Use the STAR response to demonstrate the underlying capability, not the specific context
4. Close with a forward-facing sentence: *"I am actively developing this area through [course, project, or volunteer work]."* — only include if true

- Do not apologise for overseas experience — it is a strength in a globalised economy.

### 6.3 Desirable Criteria
If a criterion is labelled *Desirable* (not Essential):
- Still address it if the candidate has relevant experience — this is a differentiator
- If evidence is weak or absent, a shorter response (1–2 sentences) acknowledging the relevance and a commitment to develop it is acceptable
- Never skip a Desirable criterion without noting it: `[NOTE: Desirable criterion — minimal evidence in Achievement Bank. Recommend brief acknowledgement response or flagging to candidate.]`

---

## SECTION 7 — FORMAT & PRESENTATION

### 7.1 Document Structure
```
[Candidate Header — matches resume header]

SELECTION CRITERIA RESPONSES

[Role Title] | [Organisation]

---

## Criterion 1: [Paste full criterion text from JD]

[STAR response — prose, no bullet points unless multi-example]

---

## Criterion 2: [Paste full criterion text from JD]

[STAR response]

---
```

### 7.2 Prose vs Bullet Points
- **Default: prose.** Selection criteria should read as confident, narrative statements — not lists.
- Bullet points within a response are only appropriate when listing sequential actions where a numbered list aids clarity, and even then should be used sparingly.

### 7.3 Headings
- The criterion text must appear as a heading above each response
- Do not label the components (do not write "Situation:", "Task:" etc. as subheadings in the final output — this is amateurish and signals to the panel that the candidate is mechanically filling a template)

---

## SECTION 8 — THE PITCH FORMAT (STATEMENT OF CLAIMS)

Some roles replaced individual selection criteria with a "pitch" — a single document that holistically addresses the candidate's suitability.

### 8.1 Pitch Structure
```
Paragraph 1: Who you are and why this role (2–3 sentences)
Section 1: [Most critical capability] — mini STAR (150–200 words)
Section 2: [Second capability] — mini STAR (150–200 words)
Section 3: [Third capability or values alignment] (100–150 words)
Closing: Why this organisation, what you will bring (2–3 sentences)
```

### 8.2 Pitch Rules
- Strict page limits are often enforced.
- Address the most heavily weighted capabilities first.
- The pitch must feel like a coherent document, not a list of responses.
- Core values and ethics should be woven in naturally.
- Use the language of the capability framework relevant to the level.

---

## SECTION 9 — ACHIEVEMENT BANK INTEGRATION

### 9.1 Matching Logic
Before generating any response, the AI should:
1. Extract the core capability from the criterion (e.g., *"stakeholder engagement"*, *"written communication"*, *"financial management"*)
2. Query the Achievement Bank for achievements tagged to that capability or containing relevant keywords
3. Rank by: relevance score → recency → metric strength
4. Select the top 1–2 achievements per criterion

### 9.2 Avoiding Repetition Across Criteria
If the candidate has a small Achievement Bank, the AI must flag when the same example is being considered for multiple criteria: `[NOTE: This achievement has been used for Criterion 1. Using it again for Criterion 3 will weaken the overall application — recommend asking candidate for a different example demonstrating [capability].]`

### 9.3 Enriching Thin Achievements
If an achievement lacks sufficient detail for a full STAR response:
- Flag specifically what is missing: `[MISSING: Result is unquantified — ask candidate: "What was the measurable outcome? How many people were impacted? What was the timeframe?"]`
- Do not pad with assumed outcomes

---

## SECTION 9A — QUALITY GATE (run before outputting)

The following phrases must NEVER appear in any selection criteria output. If detected, rewrite from scratch:

```
"I am a dedicated and hardworking professional"
"I have a passion for"
"I am a team player"
"I have demonstrated strong communication skills" (assertion without evidence)
"I believe I would be well-suited"
"I am confident that I can"
"As per the criteria"
"With regards to this criterion"
"To address this criterion"
"I have always had an interest in"
"I am committed to"
"Responsible for managing"
"Assisted with"
"Helped to"
"The team and I"
```

### Structural Quality Checks (confirm before output)
- [ ] Each response opens with the criterion restated or its key terms echoed?
- [ ] Action section is the longest component (40–50% of words)?
- [ ] All actions written in first person ("I developed", "I negotiated") — not "we" or "the team"?
- [ ] At least one quantified result per criterion (or gap flagged)?
- [ ] No STAR component labels ("Situation:", "Task:", "Action:", "Result:") in the prose output?
- [ ] No example repeated across multiple criteria?
- [ ] Word count within target range for the candidate's seniority level?

### Tone Test
1. Does the action section describe specific decisions and methods, not just responsibilities?
2. Does the result statement name a measurable impact on the organisation?
3. Could this response have been written by any candidate, or does it clearly reflect this person's specific experience?

If the answer to question 3 is "any candidate" → rewrite with more specificity.

---

## SECTION 9B — WORKED EXAMPLE (Reference Standard)

Use this as the benchmark for a mid-level STAR response. Every response you generate should be at or above this quality level.

**Context:** Mid-level coordinator applying for a Program Coordinator role at a state government department. Criterion: *"Demonstrated experience managing multiple competing priorities in a complex stakeholder environment."*

---

*Managing competing priorities across stakeholder-heavy environments has been a consistent feature of my work as a Project Coordinator at City of Darebin.*

During the delivery of the 2024 Community Infrastructure Grant Programme, I was simultaneously responsible for coordinating deliverables across 11 funded community organisations, managing three internal approval workflows, and reporting quarterly to a Deputy Director and two elected councillors — all within a 14-month fixed-term programme.

To manage this, I designed a master tracker in Excel that mapped each organisation's milestone dates against the council's internal sign-off cycle, surfacing conflicts 3–4 weeks in advance rather than the day before. I established a fortnightly check-in rhythm with each grantee, which I kept to 20 minutes by standardising a one-page progress template each organisation completed in advance. When two major deliverables clashed in August — requiring both council approval and a grantee compliance report within the same week — I restructured the approval sequencing with the Deputy Director, negotiated a 5-day extension with one grantee, and personally completed the compliance report template for two smaller organisations who lacked the capacity to respond in time.

All 11 organisations delivered their funded projects within the programme timeframe, with a combined grant spend of $2.3M fully acquitted. Post-programme feedback rated programme administration 4.7/5.0, and the tracking model I developed was adopted by the grants team for the 2025 round.

---

**Why this response works:**
- Opens by restating the criterion ("competing priorities, stakeholder environment") — signals direct relevance.
- Situation is 2 sentences — enough context to understand scale, no more.
- Action section names the specific tool (Excel tracker), specific decision (fortnightly 20-min check-ins), specific intervention (restructured approval sequencing). Not generic "I managed stakeholders."
- Result quantifies the outcome ($2.3M acquitted, 4.7/5.0 rating, adopted by team) — three distinct proof points.
- No STAR labels in the prose. Reads as a confident professional statement.
- Word count: 290 words — appropriate for a mid-level coordinator role.

---

## SECTION 10 — PRE-OUTPUT CHECKLIST

Before delivering any selection criteria document, the AI Engine must confirm:

- [ ] Every criterion addressed with a separate, headed response
- [ ] Each response opens by restating the criterion or its key terms
- [ ] STAR structure used (Situation, Task, Action, Result) — proportions correct
- [ ] Action section is the longest, written in first person, active voice
- [ ] At least one quantified result per response (or gap flagged)
- [ ] No example reused across multiple criteria (or flagged if unavoidable)
- [ ] Word count within specified limits (or within defaults from Section 4)
- [ ] No component labels (Situation:, Task:, etc.) in the final prose output
- [ ] Capability framework language reflected where relevant (government roles)
- [ ] International experience contextualised appropriately
- [ ] standard English applied throughout
- [ ] No fabricated data — all content sourced from Achievement Bank or candidate input
- [ ] All missing data flagged with `[MISSING: ...]` tags
- [ ] Desirable criteria addressed or explicitly noted

---

The AI must actively avoid these patterns, which are the most common failure modes in selection criteria applications:

| Mistake | Why It Fails | Fix |
|---|---|---|
| Writing about the team, not the individual | Panel cannot score group actions | Rewrite all actions in first person with explicit personal ownership |
| No quantified result | Unsubstantiated claims rank lowest on scoring rubrics | Ask candidate for metric; flag if unavailable |
| One generic example reused across all criteria | Signals limited experience and poor tailoring | Pull distinct examples per criterion; flag gaps |
| Using STAR labels as subheadings | Signals template use; appears amateurish | Remove all labels — integrate into flowing prose |
| Matching length to the easiest criterion | All Essential criteria deserve equal depth | Enforce word count targets per criterion |
| Vague situation with no organisational context | Panel cannot assess relevance or scale | Add employer name, team size, and industry context |
| Closing with no result | Incomplete STAR reads as incomplete capability | Always end each response with a clear outcome statement |
| Addressing desirable criteria with "I don't have experience but..." | Signals weakness before demonstrating strength | Lead with the closest transferable evidence, bridge confidently |

---

*This file is maintained by the coaching team. Review quarterly or when recruitment standards shift. Cross-reference industry-specific capability frameworks annually.*
```


## `server/rules/cold_outreach_rules.md`

**Runtime status: LIVE**

Legacy path is still the live path for this doc type.

```markdown
# Cold Outreach Message Rules

## Purpose
Generate a short, direct cold outreach message to a recruiter or hiring manager for an unadvertised role or speculative approach. Used by Australian job seekers doing proactive outreach via LinkedIn DM, email, or referral.

## Format
- 100–200 words total. No padding.
- Clear sections: subject/opening, value hook, specific ask, sign-off.
- Return TWO versions: a LinkedIn DM (shorter, ≤150 words) and an Email (≤200 words with subject line).
- Australian English spelling.

## Tone
- Direct, confident, peer-to-peer. Not a cover letter. Not a pitch.
- No grovelling ("I hope this message finds you well"), no generic openers ("I am reaching out because...").
- Demonstrate you've done basic research (1 specific company/team detail).
- Be clear about what you want without being demanding.

## Structure

### LinkedIn DM:
1. One-line hook: what you do + why you're contacting this specific person/company
2. Credibility signal: 1 achievement or skill with a metric or concrete outcome
3. The ask: specific, easy to action ("Would you be open to a 15-minute call?")
4. Sign-off: first name only

### Email:
1. Subject line: "Introduction — [Your Role/Speciality] | [Your Name]" or "Exploring opportunities at [Company]"
2. Opening: who you are and why this specific company
3. Value proof: 1-2 sentences with a concrete accomplishment
4. The ask: explicit but easy ("Happy to send my resume if you'd like to take a look")
5. Sign-off: professional (name + title/field)

## What to Avoid
- Do NOT list 5 reasons you want the job — that's a cover letter
- Do NOT ask them to review your resume immediately (build rapport first in DM)
- Do NOT use: "I came across your profile", "I've been following your company"
- Do NOT be vague: "I'd love to connect and learn more" is not an ask
- Do NOT apologise for reaching out

## Context Sensitivity
- **Recruiter outreach**: Focus on your availability and type of role you seek — recruiters need to match candidates quickly
- **Hiring manager outreach**: Focus on the problem you solve, not career goals
- **Speculative application to company**: Address to HR/People team; be clear you're open to any relevant roles
- **Referral introduction**: Open with the mutual contact; context is everything
```


## `server/rules/interview_prep_rules.md`

**Runtime status: LIVE**

Legacy path is still the live path for this doc type.

```markdown
# Interview Preparation Rules

## Purpose
Build a targeted interview preparation guide from the candidate's actual profile and achievements. This is coaching material, not a script, not generic advice. Every section must reference what this specific candidate has actually done.

## Framework: CAR (not STAR)
Interview answers are spoken. STAR wastes 30% of delivery time on setup. Use CAR:
- **C (Context):** One sentence. Sets the scene, establishes stakes.
- **A (Action):** 3-4 specific things the candidate did. First-person. This is 70% of the answer.
- **R (Result):** Quantified where possible. Impact on team, organisation, or customer.

## Output Structure
Follow this exact structure with exact headings. The client parses these headings to build the UI.

---

### Your Edge
**Why You:** [2-3 sentences. Speak to the candidate directly. Name the specific overlap between this candidate's real background and what this role needs. Concrete, not flattering. Drawn from their actual profile, never invented.]
**Your Anchor:** [One short, calming, confidence-building sentence the candidate can carry into the room, grounded in their specific strength. Example shape: "Your years running X are not background experience, they are exactly the capability this team is missing." Personalise to this candidate. One or two sentences maximum.]

---

### 1. Know the Stage

#### Company Intelligence
3-5 bullet facts drawn from what the job ad reveals:
- What the organisation does and who they serve
- Scale or context signals (team size, locations, volume)
- Values or cultural signals from the ad
- What makes this role exist right now

Keep it factual. No padding.

#### What They're Looking For
2-3 sentences on what the interviewer is actually assessing. What does this role exist to do? What kind of person succeeds here? What are the hidden criteria behind the listed requirements?

#### Watch-Outs
2-3 potential gaps between the candidate's profile and this role. Be honest. Give a reframe strategy for each. If the profile is strong, keep this short. Do not invent gaps.

---

### 2. Story Bank

Select 4 achievements from the candidate's profile that best cover the competencies this role requires. Choose the 4 most distinct and relevant. For each, build a CAR story card.

Format each story exactly as follows:

#### Story: [Short descriptive title, 4-6 words]
**Hook:** [One sentence. Action-first. Result-anchored. This is the line the candidate memorises and opens with in the room. Make it specific enough to be real, brief enough to say in one breath.]
**C:** [Context hint, one sentence max. Sets scene without over-explaining.]
**A:** [3-4 action beats as short bullet phrases, what they specifically did]
**R:** [Result, specific, quantified if possible. What changed because of their actions.]
**Covers:** [comma-separated competency list, e.g. stakeholder management, process improvement, leadership]

Write 5-6 story blocks. Prioritise variety across competencies. Draw details from the candidate's actual achievements, do not invent.

---

### 3. Prove It

Generate 3 questions per type. Each question must be genuinely likely for this specific role, not generic. Map each type to the most relevant Story Bank entry.

#### Behavioural
**What these are:** Past behaviour predicts future performance. Expect "Tell me about a time when..."
**Use:** [Story title most relevant to this type]
1. [Question specific to this role]
2. [Question]
3. [Question]

#### Situational
**What these are:** Hypothetical scenarios testing judgment under pressure. Expect "What would you do if..."
**Use:** [Story title]
1. [Question]
2. [Question]
3. [Question]

#### Motivation
**What these are:** Why you, why this role, why this organisation. Expect "What draws you to..." or "Why are you leaving your current role?"
**Use:** [Story title]
1. [Question]
2. [Question]
3. [Question]

#### Role-Specific
**What these are:** Technical and functional fit, drawn directly from JD requirements.
**Use:** [Story title]
1. [Question]
2. [Question]
3. [Question]

---

### 4. Questions to Ask
4-5 intelligent questions the candidate can ask the interviewer. Specific to this role and organisation. They must signal strategic thinking, not just preparation. No generic questions.

---

## Tone and Format Rules
- Second person throughout ("You..." / "Your...")
- Every story Hook must be specific enough to be real, no vague generalisations
- Action beats use short phrases, not full sentences
- Results must name the impact, avoid "successfully improved" with no number or outcome
- Australian English throughout
- Do NOT include generic tips or meta-commentary inside the Know the Stage, Story Bank, Prove It, or Questions to Ask sections
- The ONLY sections you output are: Your Edge, 1. Know the Stage, 2. Story Bank, 3. Prove It, 4. Questions to Ask. Do NOT add any other sections.
- Do NOT use em dashes, use commas, colons, or full stops instead
```


## `server/rules/offer_negotiation_rules.md`

**Runtime status: LIVE**

Legacy path is still the live path for this doc type.

```markdown
# Offer Negotiation Guide Rules

## Purpose
An Offer Negotiation Guide is a personalised action plan for a candidate who has received a job offer. It helps them negotiate confidently — covering salary, conditions, and start date — in the Australian workplace context.

## Format
- 400–600 words. Use markdown with clear sections.
- Direct, action-oriented. No hedging language.
- Written in second person ("You should...", "When they say X, respond with Y").
- Australian English spelling.

## Mandatory Sections

### 1. Your Market Position
- Brief statement of the candidate's leverage (in-demand skills, competing offers if any, timing)
- Benchmark range for this role based on available context

### 2. The Ask
- Recommended counter-offer amount or range (be specific — "ask for $X–$Y" not "negotiate upwards")
- What to say, almost verbatim: "I'm really excited about this role. Based on my research and the skills I bring — particularly [X] — I was hoping we could discuss a package of $Y."
- If salary is already above market, redirect to non-salary conditions

### 3. Non-Salary Conditions to Consider
List any of the following that apply given the role:
- Additional annual leave (Australian standard is 4 weeks — 5 weeks is achievable for senior roles)
- Flexible/remote working arrangements
- Professional development allowance or conference budget
- Performance review timeline (negotiate for 6-month rather than 12-month first review)
- Start date flexibility
- Sign-on bonus if candidate has unvested equity elsewhere

### 4. Conversation Script
A short dialogue showing exactly what to say and how to handle common push-backs:
- "We don't have flexibility on salary" → response
- Silence after making the ask → response (don't fill it)
- "Is that your final answer?" → response

### 5. Red Flags and Walk-Away Points
What conditions would make this offer not worth taking — stated clearly without being preachy.

## Tone and Voice
- Confident but not aggressive. Australian workplace culture values directness without arrogance.
- Practical and specific — no generic "know your worth" platitudes.
- Acknowledge that negotiating is normal and expected, not rude.
- Don't tell the candidate to be grateful or "not to push too hard." That's patronising.

## Context Sensitivity
- **Government roles (APS/QPS/PSC)**: Salary bands are fixed. Redirect to conditions: starting at the top of the band, flexible work, extra leave, allowances.
- **Startup**: Equity negotiation is often more important than base salary. Discuss vesting schedule, cliff, strike price.
- **Contract/casual roles**: Negotiate the day rate, not annual salary. Government contract roles have panel rates — know the ceiling.
- **Senior/executive roles**: Superannuation contributions, car allowance, performance bonus structure, relocation allowance.

## Common Errors to Avoid
- Do NOT say "I'll need to think about it" without a specific counter — it signals weakness.
- Do NOT accept the first offer without at least one ask, even if it's just conditions.
- Do NOT give a figure first — always make them name the number or anchor to your research.
- Do NOT apologise for negotiating.
```


## `server/rules/rejection_response_rules.md`

**Runtime status: LIVE**

Legacy path is still the live path for this doc type.

```markdown
# Rejection Response Email Rules

## Purpose
Generate a graceful, professional response to a job rejection email. The goal is to leave a positive impression, keep the door open, and potentially get useful feedback.

## Format
- 80–120 words. Short. Australian English.
- Plain paragraphs — no bullet points, no headers.
- Include a subject line.

## Structure
1. **Acknowledge and thank**: Brief, genuine acknowledgement — no grovelling, no excessive disappointment
2. **Keep the door open**: Express continued interest in the company for future opportunities — 1 sentence
3. **Request for feedback (optional)**: Light touch — "If you have any feedback I could act on, I'd appreciate hearing it" — only if the rejection was from a recruiter/HR, not an automated system
4. **Close**: Warm but professional sign-off

## Tone
- Gracious, not defeated. Mature, not needy.
- Avoid: "I'm so disappointed", "I really thought I was perfect for this role", "I don't understand why..."
- The tone should read as someone who has other options and isn't desperate — even if they are.
- Short sentences. Nothing overwrought.

## What NOT to Include
- Do NOT argue with the decision
- Do NOT ask "why" directly — frame as requesting feedback instead
- Do NOT mention other applications or competing offers (tacky)
- Do NOT offer to "prove" yourself if given another chance — this reads as desperate
- Do NOT be sycophantic ("You've been so wonderful throughout this process")

## Example structure:
Subject: Re: [Role] Application — [Candidate Name]

[Opening line thanking them for the update]

[Keep door open sentence]

[Optional feedback request sentence]

[Warm close]

[Name]
```


## `server/rules/linkedin_hub_profile_rules.md`

**Runtime status: LIVE**

Used by routes/linkedin.ts.

```markdown
# LinkedIn Hub — Profile Generation Rules

## Purpose
Generate all LinkedIn profile sections plus banner copy as one cohesive output from the candidate's profile data. No job description is used. The output must read as if the same person wrote every section.

## Output JSON Schema (return ONLY this, no other text)

```json
{
  "headline": "string — max 220 characters",
  "about": "string — 1800 to 2200 characters",
  "skills": ["skill1", "skill2", "..."], 
  "experienceBullets": ["bullet1", "bullet2", "bullet3"],
  "openToWork": "string — max 150 characters",
  "bannerCopies": [
    {
      "formula": "value-prop",
      "copy": "string — 5 to 12 words",
      "sublineSuggestion": "string — optional proof element, e.g. '3,000+ helped · Forbes'"
    },
    {
      "formula": "bold-positioning",
      "copy": "string — 5 to 12 words",
      "sublineSuggestion": "string or empty"
    },
    {
      "formula": "credibility-offer",
      "copy": "string — 5 to 12 words",
      "sublineSuggestion": "string or empty"
    }
  ]
}
```

## Section Rules

### Headline (max 220 chars)
- Lead with current title or target role
- Add 2–3 differentiators using pipe separators: Title | Skill | Outcome
- Do NOT use: "Passionate about", "Results-driven", "Hardworking professional"
- Example: Senior Product Manager | B2B SaaS | Delivered $12M ARR pipeline turnaround

### About (1,800–2,200 chars)
- Hook (1–2 sentences): what you do and who you do it for
- Career narrative (2–3 short paragraphs): key expertise, how you work, what you are known for
- Signature achievements: 2–3 bullets with metrics (use • bullet)
- Call to action: what you are open to / what you want to connect about
- Tone: confident, conversational first person. Not a formal bio.

### Skills (exactly 10 items)
- Most role-relevant skills first
- Mix: technical skills + domain expertise + 1–2 leadership/interpersonal
- Do NOT include: "Communication", "Microsoft Office", "Teamwork"

### Experience Bullets (3–4 items)
- Most recent role only
- Start each with a strong past-tense verb
- Include at least 2 metrics or outcomes across the set
- STAR structure compressed to 1–2 sentences each

### Open to Work Signal (max 150 chars)
- "I am actively exploring [role type] opportunities in [industry/location]. [Brief value prop]."

### Banner Copies (exactly 3, one per formula)
**value-prop formula:** "I help [specific audience] [achieve specific outcome]"
**bold-positioning formula:** "Your [role] shortcut to [big result]" or direct declarative
**credibility-offer formula:** "[Achievement or credential] | Now helping [audience] do the same"

Banner rules:
- 5–12 words maximum — people scan on mobile
- No vague slogans ("Passionate entrepreneur", "Driven professional")
- sublineSuggestion should reference a proof element if the profile has one (metric, credential, publication, etc.)

## Tone and Voice
- First person, active voice
- Confident without arrogance
- Avoid: "passionate", "synergy", "leveraging", "thought leader", "guru", "ninja", "rockstar"
- Australian English spelling throughout
- Sound like a senior professional talking to a peer

## Context Sensitivity
- Government/APS: use policy/stakeholder/evidence-based language; emphasise security clearance if present
- Startup/tech: emphasise ship velocity, ownership, cross-functional collaboration
- Academic/research: include publications signal, research impact
- Senior/executive: lead with business outcomes, P&L, team scale
```


## `server/rules/linkedin_outreach_rules.md`

**Runtime status: LIVE**

Used by routes/linkedin.ts.

```markdown
# LinkedIn Outreach Template Generation Rules

## Purpose
Generate four personalised LinkedIn outreach messages by combining the candidate's profile data with the target person's details. Every template must sound like a real person wrote it — specific, warm, never transactional.

## Core Principle
LinkedIn networking is not about asking people for jobs. It is about becoming someone people are glad they know. Every message is a deposit in a relationship account. Withdrawals (asks) only work once the account has a balance. This is relationship building, not career growth — the career growth is a byproduct of strong relationship building.

## Output JSON Schema (return ONLY this, no other text)

```json
{
  "connectionNote": "string — max 300 characters, hard limit",
  "firstMessage": "string — 80 to 120 words",
  "afterConversationFollowUp": "string — 50 to 80 words",
  "directAsk": "string — 60 to 90 words",
  "questionSuggestions": ["question1", "question2", "question3"]
}
```

## Template Rules

### connectionNote (max 300 chars — platform hard limit)
Formula: Reference something real → one sentence about who you are → reason to connect
- Reference their post, company, role, or something you genuinely noticed
- Say one sentence about who you are and what you are working on
- No ask, no pitch, no job request
- Example: "Hi [Name], I came across your post on [topic] and your point about [specific thing] resonated. I am a [background] currently [what you are doing]. I would love to connect."

### firstMessage (after connection accepted)
Formula: Research signal → low-pressure ask → easy to say no
- Show you have done research on them or their company
- Ask one specific, relevant question — not "pick your brain"
- Reference the candidate's situation briefly
- End with "No pressure at all if the timing is not right."
- A specific question about something they actually know is hard to walk away from

### afterConversationFollowUp (send within 24 hours of any real exchange — a chat, a call, or a meaningful message thread)
Formula: Reference something specific they said → offer reciprocity
- Reference a specific point they made (leave [THEIR_POINT] as a placeholder the user will fill in)
- "I am going to act on it" — shows you were listening
- Plant a seed of reciprocity without being transactional
- Keep it warm, brief, genuine

### directAsk — the call ask (self-timed, not fixed to a position in the sequence)
Formula: Context → ask for a short call → make it a video call, not a phone call
- This is an ask for a 15–20 minute call over Zoom or Google Meet — never a phone call, and never ask for a phone number. A video link keeps the ask low-friction and doesn't require either person to share private contact details.
- The candidate should feel free to send this as soon as the conversation has real warmth — that might be the 2nd message, the 3rd, or later. It does not have to be the last message in the sequence, and it should not be saved for message 4 by default. Waiting too long to ask is its own failure mode — a conversation that drifts on for many messages with no ask is a wasted opportunity.
- Do NOT ask for a job on the call
- The message MUST contain an explicit, concrete ask — "Would you be up for a quick 15-minute call over Zoom or Google Meet sometime?" A vague "keep me in mind" is a wasted message.
- Reference that you have been building toward this conversation
- Small ask, high likelihood of yes — but it must actually be asked

### questionSuggestions (3 items)
Generate 3 specific questions the candidate could ask this person based on:
- The target person's company and what they work on
- The candidate's career goals and background
- Questions should be precise and show industry knowledge
- NOT: "What is it like working there?" — too generic
- YES: "What does your team look for when hiring graduates without Australian work experience?" — specific and useful

## Tone
- Human, warm, professional
- Curious and lightly playful — this is focused play and socialising, not a transaction. Genuine curiosity about the person reads as confidence; stiffness reads as desperation.
- Never sycophantic ("Great post!" is invisible)
- Curious, not pushy
- Australian English spelling
- These templates are starting points the candidate will adapt into their own voice. Favour plain, natural phrasing over polished corporate wording — authenticity beats "perfection".
```


# SECTION: ORPHANED ARCHITECTURE  (built, wired, unreachable for resume/cover)


## `server/src/services/prompts/resumeStructuredPrompt.ts`

**Runtime status: DEAD for the resume tab**

The JSON-output + deterministic-renderer design. Only reachable via POST /generate/resume, which nothing calls.

```typescript
import { StrategyBlueprint } from './strategy';
import type { BridgedGap } from '../../lib/bridgedGaps';

// =============================================================================
// STRUCTURED RESUME PROMPT — single capable-model pass, JSON output.
// =============================================================================

/**
 * RESUME_STRUCTURED_PROMPT — single-pass resume tailoring.
 *
 * One capable model receives the candidate's full resume (raw text) plus their
 * structured work history (with ids) and the target job description, and:
 *   1. rewrites the professional summary + per-role bullets, tailored to the job,
 *   2. tags each role `feature` (substantive professional role) vs casual/odd job,
 *      and `australianLocal`, so the renderer can fold or drop survival jobs.
 *
 * The output { summary, experience: [{ id, feature, australianLocal, bullets }] }
 * is consumed by the deterministic renderer (buildTemplateResume) — the document's
 * look never changes, only the words and which roles are featured.
 *
 * Guiding principle: take what is already in the resume, rearrange and sharpen it
 * for this job, and invent nothing.
 *
 * Signature is unchanged from the blueprint-era prompt so the route call sites do
 * not change. `blueprint`, `selectedAchievements`, `companyResearch`, `bridgedGaps`
 * and `precomputedYears` are no longer used by the body.
 */
export const RESUME_STRUCTURED_PROMPT = (
    jd: string,
    profile: any,
    _selectedAchievements: any[],
    _blueprint: StrategyBlueprint,
    analysisContext?: { tone?: string; competencies?: string[]; regenerateFeedback?: string },
    _companyResearch?: { salutation?: string; highlights?: string[]; companySize?: string; hiringManager?: string } | null,
    employerQuestions?: string[],
    _bridgedGaps?: BridgedGap[],
    _precomputedYears?: number | null,
): string => {
    // Structured work history → the output rows. Each entry's id MUST come back so
    // the renderer maps bullets to the right role; keep the same order.
    const experienceBlock = (profile?.experience ?? []).length
        ? (profile.experience as any[]).map((e, i) => {
            const dates = [e.startDate, e.isCurrent ? 'Present' : e.endDate].filter(Boolean).join(' to ');
            const header = `[${i + 1}] id: ${e.id} — ${e.role ?? ''}${e.company ? ` at ${e.company}` : ''}${dates ? ` (${dates})` : ''}`;
            return header;
        }).join('\n\n')
        : '(no structured work history)';

    const rawResume = (profile?.resumeRawText ?? '').trim();

    	    // Normalised skills the model may reorder/trim (never add to). Handles the
	    // JSON-object skills shape ({technical, industryKnowledge, softSkills}) and a
	    // plain string. Falls back to whatever string is stored.
	    const skillsBlock = (() => {
	        const s = profile?.skills;
	        if (!s) return '(no skills listed)';
	        if (typeof s === 'string') {
	            const t = s.trim();
	            if (!t.startsWith('{') && !t.startsWith('[')) return t || '(no skills listed)';
	            try {
	                const parsed = JSON.parse(t);
	                if (Array.isArray(parsed)) return parsed.join(', ');
	                return Object.entries(parsed)
	                    .map(([k, v]) => {
	                        const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
	                        return `${label}: ${Array.isArray(v) ? v.join(', ') : String(v)}`;
	                    })
	                    .join('\n');
	            } catch {
	                return t;
	            }
	        }
	        return '(no skills listed)';
	    })();

	    return `You are an expert Australian resume writer. Rewrite this candidate's resume so it wins an interview for the specific job below.

Your job is simple: take what is already in their resume, rearrange and sharpen it for this role, and tailor the language to the job. Do not invent anything.

==============================================================
WORK HISTORY INDEX (mechanics only — NOT the content source)
Use this ONLY to: (1) know which roles exist and their exact ids, (2) return one output object per id, (3) decide ordering, and (4) set the casual flag. Draw every fact, bullet, and detail from THE CANDIDATE'S RESUME below, never from this index.
==============================================================
${experienceBlock}

==============================================================
THE CANDIDATE'S RESUME — THE SINGLE SOURCE OF TRUTH FOR ALL CONTENT AND FACTS
==============================================================
${rawResume || '(raw resume text unavailable)'}

==============================================================
THEIR SKILLS (reorder and trim for this job — never add a skill not listed here)
==============================================================
${skillsBlock}

==============================================================
THE JOB THEY ARE APPLYING FOR
==============================================================
${jd}

==============================================================
HOW TO WRITE IT
==============================================================
1. SOURCE OF TRUTH. The candidate's resume above is the single source of truth for every fact: every employer, role, date, qualification, tool, achievement, and number. The work history index is only a list of ids and ordering — never draw content from it. Never invent a company, role, date, qualification, tool, or metric that is not in the resume. If the resume does not contain something the job wants, leave it out — do not claim it, and do not write that the candidate lacks it.

2. NUMBERS, HONESTLY. Lead a bullet with a figure ONLY when that exact figure is in the resume. When there is no number, lead with the concrete result, scope, or action instead. Never make up, estimate, or round a number. This is the most important rule.

3. TAILOR TO THE JOB. Surface the most relevant experience first. Mirror the important words and skills from the job description wherever the candidate genuinely has that experience.

4. PROFESSIONAL SUMMARY. Write it in the first person (the candidate speaking). Never use their name or "he", "she", or "they". Open with their years of PROFESSIONAL experience and their professional identity, then their two or three strongest, most relevant strengths. 3 to 4 sentences. When you state years, count only substantive professional roles — do NOT count casual, part-time survival, or odd jobs. Use no bold and no markdown anywhere in the summary — it is already the most-read block on the page, and emphasis there reads as shouting.

5. BULLETS — TIGHT AND OUTCOME-FIRST. Never copy a bullet from the source resume word-for-word. Rewrite each so it leads with the result (what improved, changed, was maintained, or was prevented), even with no number, then the how in a few words. Keep each bullet to ONE sentence of about 15 to 22 words. Do NOT write dense 30-plus-word sentences that pile on three trailing clauses — that is the single most common failure here. Cut adjectives and filler. Example: "Managed daily water quality testing and adjusted nutrient parameters across aquaponics systems" becomes "Held water quality within target range across commercial aquaponics systems, sustaining high yields and healthy fish stock." Active voice, no "I" prefix.

5b. BOLD THE RESULT, NOTHING ELSE. Bold is the only markdown allowed, and it exists for one job: making the result a recruiter is scanning for jump off the page. Wrap it in double asterisks — "Cut invoice processing time by **40%** by redesigning the approvals workflow". Rules, in order of importance: bold AT MOST ONE span per bullet; only bold a bullet that carries a real figure from the resume (a %, a dollar amount, a count, a timeframe); bold the figure plus the couple of words that give it meaning, never the whole sentence; NEVER bold a skill, tool, company, job title, or date — that reads as keyword stuffing and is the fastest way to make a resume look machine-written. Most bullets will carry no bold at all. Across the entire resume aim for 6 to 10 bolded spans and never exceed 12. When in doubt, leave it unbolded.

6. CASUAL JOBS ONLY (set this per entry). Almost every role belongs on the resume. Set "casual": true ONLY for a casual or odd survival job — retail, hospitality filler, kitchen hand, cleaning, delivery, warehouse temp, or similar work unrelated to a professional career. EVERY skilled, technical, managerial, professional, research, engineering, or trade role is NOT casual: set "casual": false — even when the role is in a different field from this job. NEVER mark a real professional role casual just because it does not match this job; relevance is handled by how you write the bullets, not by removing roles. Also set "australianLocal": true if the role was performed in Australia. For a casual role write just ONE short factual bullet (it will be folded into a single line); for every other role write full bullets per the rules above.

7. KEEP IT TO TWO PAGES (hard limit). This MUST fit two pages, so budget the space by relevance to THIS job. Give the 2 to 3 roles most relevant to the job 3 to 4 tight bullets each. Give clearly less-relevant professional roles (for example an unrelated hospitality or retail management role on a technical application) just 1 to 2 bullets, focused only on the one thing this job actually values from it, such as safety, compliance, or stakeholder communication. Across the whole resume aim for roughly 10 to 14 bullets in total, never more. When in doubt, cut.

8. SKILLS, RETARGETED. Output a skills block tailored to this job. Start from THEIR SKILLS above and use only those, never add a skill the candidate does not have. Put the skills this job names first, drop skills with no relevance to this job, and keep the candidate's category labels (for example Technical, Industry Knowledge, Soft Skills). Format as one line per category in the form "Label: item, item, item". If the candidate clearly has a skill the job names under different wording, you may use the job's wording for that same skill, but never introduce a capability the resume does not show.

9. AUSTRALIAN ENGLISH. organised, analysed, recognised, programme, labour, colour, specialised.

10. NO GAPS, NO PLACEHOLDERS. The result must read as finished, signable work. Never output [VERIFY], [ADD], [TBD], or any bracketed placeholder. Every sentence must be complete.${employerQuestions && employerQuestions.length > 0 ? `

11. The job asks the candidate to address these — weave answers naturally into the summary or bullets where the resume supports them:
${employerQuestions.map(q => `   - ${q}`).join('\n')}` : ''}${analysisContext?.regenerateFeedback ? `

The user asked for this specific change — apply it: "${analysisContext.regenerateFeedback}"` : ''}

==============================================================
OUTPUT
==============================================================
Return ONLY this JSON object. No preamble, no explanation, no markdown fences.

{
  "summary": "first-person professional summary, 3-4 sentences, no name, no he/she/they",
  "skills": "one line per category, e.g. 'Technical: SAP, Microsoft Excel, inventory reconciliation\\nIndustry Knowledge: stock control, cycle counting'",
  "targetRoleTitle": "exact job title from the job ad — copy it word for word",
  "pageBudgetWarning": false,
  "experienceOrder": ["id of most relevant role", "id of 2nd most relevant", "...continue for ALL ids"],
  "experience": [
    {
      "id": "the exact id from the work history above",
      "casual": false,
      "australianLocal": true,
      "display": "full",
      "bullets": ["tailored bullet", "tailored bullet"],
      "tips": [
        {
          "bulletIndex": 0,
          "suggestion": "Adding what % or volume figure here would make this achievement significantly stronger — for example, how many tonnes of seed were processed per season, or what yield improvement was achieved."
        }
      ]
    }
  ]
}

FIELD RULES:

targetRoleTitle: Copy the job title exactly from the job ad. This becomes the candidate’s resume headline. Do not invent a title not in the ad.

experienceOrder: List ALL experience IDs from the work history, sorted from most to least relevant to this specific job. Every id must appear exactly once. This is the order they will appear on the resume.

display: Set one value per experience entry.
- "full" — any substantive professional, technical, managerial, academic, or research role. This is the default for almost every role.
- "fold" — a casual or survival job only: retail assistant, kitchen hand, delivery driver, warehouse picker, cleaning staff, or similar work with no professional skill relevance to any career. A restaurant MANAGER is NOT casual — set "full". When in doubt, set "full".
- "omit" — only for a role that is both irrelevant to this job AND was performed entirely outside Australia. Never omit Australian roles.

pageBudgetWarning: Set true only if you estimate the resume content you have written will still exceed 2 pages after all your curation decisions. Be honest — a false alarm is better than silently producing a 3-page resume.

tips (optional, per experience): Add a tip ONLY when a bullet would be significantly stronger with a specific metric that you cannot invent from the resume. Each tip must be one concrete, specific sentence spelling out exactly what the candidate should add — name the type of number (%, $, volume, timeframe, headcount). Do not add a tip for a bullet that is already quantified. Maximum 2 tips per experience entry, 5 tips total across the entire resume. If no bullet needs a tip, omit the tips array entirely.

Return one experience object for EVERY entry in the work history. Every object must carry its exact id. Output nothing except the JSON.`;
};
```


## `server/src/services/quality-gate.ts`

**Runtime status: DEAD for resume/cover**

reviewDocument() is called only at generate.ts:413, inside the legacy path.

```typescript
import { callClaude } from './llm';
import { QUALITY_GATE_PROMPT, QualityGateResult, ProfileSnapshot, StrategyBlueprint } from './prompts';
import { parseLLMJson } from '../utils/parseLLMResponse';
import { computeYearsOfExperience } from '../lib/profileMath';

const CLAUDE_INPUT_COST_PER_M = 3.00;
const CLAUDE_OUTPUT_COST_PER_M = 15.00;

export interface QualityGateOutcome {
    passed: boolean;
    flags: string[];
    profileViolations: string[];
    rewrittenContent: string;
    tokens: { input: number; output: number; cost_usd: number };
}

function extractProfileSnapshot(profile: any): ProfileSnapshot {
    const employers: string[] = (profile?.experience ?? [])
        .map((e: any) => e?.company)
        .filter(Boolean);
    const jobTitles: string[] = (profile?.experience ?? [])
        .map((e: any) => e?.role)
        .filter(Boolean);
    const achievementMetrics: string[] = (profile?.achievements ?? [])
        .map((a: any) => a?.metric)
        .filter(Boolean);
    const candidateName: string | undefined = typeof profile?.name === 'string' && profile.name.trim().length > 0
        ? profile.name.trim()
        : undefined;
    const yearsOfExperience = computeYearsOfExperience(profile?.experience);
    return { employers, jobTitles, achievementMetrics, candidateName, yearsOfExperience };
}

export async function reviewDocument(
    blueprint: StrategyBlueprint,
    generatedContent: string,
    docType: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' | 'INTERVIEW_PREP' = 'COVER_LETTER',
    profile?: any
): Promise<QualityGateOutcome> {
    const snapshot = profile ? extractProfileSnapshot(profile) : null;
    const prompt = QUALITY_GATE_PROMPT(blueprint, generatedContent, docType, snapshot);
    const { content, usage } = await callClaude(prompt, true);

    let result: QualityGateResult;
    try {
        result = parseLLMJson(content) as QualityGateResult;
    } catch (e: any) {
        console.error('[QualityGate] Parse failed — treating as passed. Raw:', content.substring(0, 300));
        return {
            passed: true,
            flags: [],
            profileViolations: [],
            rewrittenContent: generatedContent,
            tokens: { input: usage.promptTokens, output: usage.completionTokens, cost_usd: 0 }
        };
    }

    const cost_usd =
        (usage.promptTokens / 1_000_000) * CLAUDE_INPUT_COST_PER_M +
        (usage.completionTokens / 1_000_000) * CLAUDE_OUTPUT_COST_PER_M;

    console.log(`[QualityGate] passed=${result.passed}, flags=${result.flags?.length ?? 0}, rewrites=${result.rewrites?.length ?? 0}`);

    // Apply surgical rewrites when flagged
    let rewrittenContent = generatedContent;
    if (!result.passed && result.rewrites && result.rewrites.length > 0) {
        for (const rw of result.rewrites) {
            if (rw.original && rw.suggested && rewrittenContent.includes(rw.original)) {
                rewrittenContent = rewrittenContent.replace(rw.original, rw.suggested);
                console.log(`[QualityGate] Applied rewrite in section: ${rw.section}`);
            }
        }
    }

    return {
        passed: result.passed,
        flags: result.flags || [],
        profileViolations: result.profileViolations || [],
        rewrittenContent,
        tokens: { input: usage.promptTokens, output: usage.completionTokens, cost_usd }
    };
}
```


## `server/src/services/prompts/strategy.ts`

**Runtime status: DEAD for resume/cover**

Blueprint stage. generate.ts:205, legacy path only.

```typescript
// =============================================================================
// HYBRID ARCHITECTURE — STAGE 1 (Claude Sonnet strategist)
// =============================================================================

/**
 * StrategyBlueprint is the structured JSON contract between Claude (strategist)
 * and Llama (executor). Every field has a specific downstream use:
 *
 *   openingHook          → Llama writes the opening sentence verbatim from this
 *   positioningStatement → Shapes the professional summary / pitch opening
 *   proofPoints          → Drives framing angle + narrative expansion per achievement
 *   messagingAngles      → Sets the recurring themes threaded across the document
 *   toneBlueprint        → Overrides generic "professional" defaults
 *   structureNotes       → Doc-type-specific layout advice
 *   pitfallFlags         → Inline red-line list Llama checks before output
 *   employerInsight      → Company connection paragraph material (or MISSING flag)
 *   sector               → Gates industry-specific formatting exceptions in Llama
 */
export interface StrategyBlueprint {
    openingHook: string;
    positioningStatement: string;
    proofPoints: Array<{
        achievementId: string;
        framingAngle: string;
        jdConnection: string;
        narrativeNote: string;
    }>;
    messagingAngles: string[];
    toneBlueprint: string;
    structureNotes: string;
    pitfallFlags: string[];
    employerInsight: string;
    sector: 'GOVERNMENT' | 'TECH_STARTUP' | 'CORPORATE' | 'HEALTHCARE' | 'EDUCATION' | 'NFP' | 'GENERAL';
}

/**
 * STRATEGY_BLUEPRINT_PROMPT — for Claude Sonnet (strategist role).
 *
 * Claude's ONLY job here is to produce a JSON blueprint.
 * It must NOT write any document prose. Token budget is kept lean by
 * sending only name, summary, top skills, and achievements with IDs +
 * metrics — no full experience/education blocks.
 *
 * Design rationale:
 * - JD signal extraction is explicit and enumerated so Claude cannot skim
 * - openingHook is constrained to one sentence with a non-transferability test
 * - pitfallFlags are pre-seeded with concrete Llama defaults to defeat; Claude
 *   adds role-specific ones on top
 * - employerInsight uses a hard MISSING flag rather than a hallucinated value
 * - sector classification gates formatting decisions downstream without
 *   requiring Llama to re-infer context
 */
export const STRATEGY_BLUEPRINT_PROMPT = (
    jd: string,
    profile: any,
    selectedAchievements: any[],
    docType: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' | 'INTERVIEW_PREP',
    identityCard?: { label: string; summary: string; tone: string; keyStrengths: string[] } | null,
    // True when the achievements were explicitly ticked by the candidate in the
    // pre-write confirmation step. Confirmed achievements are guaranteed coverage:
    // the strategist may not silently drop one by judging it JD-irrelevant.
    achievementsUserSelected?: boolean,
): string => {
    // Lean candidate snapshot — avoids sending full experience/education JSON
    const candidateSnapshot = {
        name: profile.name,
        summary: profile.professionalSummary,
        topSkills: [
            ...(profile.skills?.technical?.slice(0, 8) ?? []),
            ...(profile.skills?.industryKnowledge?.slice(0, 4) ?? []),
        ],
        identityCard: identityCard ?? null,
    };

    const achievementSummary = selectedAchievements.map(a => ({
        id: a.id,
        title: a.title,
        metric: a.metric ?? null,
        metricType: a.metricType ?? null,
        industry: a.industry ?? null,
        skills: a.skills ?? [],
    }));

    return `You are a senior career strategist. Your sole output is a JSON strategy blueprint that a separate writing model will execute. You do NOT write any document prose.

CANDIDATE SNAPSHOT:
${JSON.stringify(candidateSnapshot, null, 2)}

${identityCard ? `IDENTITY CONTEXT: This candidate's primary professional identity for this role is "${identityCard.label}". Tone: ${identityCard.tone}. Let this shape your toneBlueprint and messagingAngles.` : ''}

AVAILABLE ACHIEVEMENTS (use "id" values in proofPoints.achievementId):
${JSON.stringify(achievementSummary, null, 2)}

DOCUMENT TYPE: ${docType}

JOB DESCRIPTION:
"""
${jd}
"""

---
YOUR TASK — STRATEGIC ANALYSIS IN 4 STEPS:

STEP 1 — JD SIGNAL EXTRACTION (do this before filling any schema field):
Extract and hold in working memory:
a) Company name and any stated company initiatives, strategic priorities, or recent projects
b) The exact language the JD uses for the top 3 required capabilities (copy verbatim, do not paraphrase)
c) Tone indicators: formal/informal markers, sector signals, culture language
d) Any specific problems, challenges, or goals the role is hired to solve
e) One concrete, specific detail about this employer that would NOT appear in a generic job ad for the same role title

STEP 2 — OPENING HOOK TEST:
Draft the openingHook. Apply this test: "Could this exact sentence appear in a cover letter for a different company's identical job title?" If yes, it fails. The hook must reference a specific detail from Step 1e. It must be one sentence. It must not begin with "I am writing", "I am a", or "As a".

STEP 3 — PROOF POINT MAPPING:
${achievementsUserSelected
    ? `The candidate has EXPLICITLY CONFIRMED every achievement in AVAILABLE ACHIEVEMENTS as relevant to this role. You MUST create a proofPoint entry for EVERY one — omit none, drop none, even if the JD connection is indirect. Your job is to find the strongest HONEST framing for each, not to filter them. For each achievement:`
    : `For each achievement in AVAILABLE ACHIEVEMENTS, decide whether it warrants a proofPoint entry. Only include achievements that have a genuine connection to a stated JD requirement. For each included achievement:`}
- framingAngle: the specific lens through which to present it for THIS role (e.g. "Frame as operational efficiency, not just cost saving — JD emphasises 'process improvement'")
- jdConnection: quote the specific JD language this achievement proves (e.g. "proven ability to manage complex stakeholder relationships")
- narrativeNote: how to expand the raw bullet into a story — what context to add, what secondary impact to surface

STEP 4 — PITFALL FLAGS:
Start with these known Llama default patterns that MUST be blocked:
- "I am writing to express my strong interest in"
- "I am a passionate [profession]"
- "I believe I would be a great fit"
- "I am excited about the opportunity to"
- "With my [X] years of experience"
Then add 1-2 role-specific patterns that would be generic for THIS particular JD.

---
OUTPUT SCHEMA — return valid JSON only, no preamble, no markdown fences:

{
  "openingHook": "One sentence. Specific to this JD. Fails the transferability test if it could appear in any other application.",
  "positioningStatement": "2-3 sentences. Why this exact candidate for this exact role. Uses JD language. Does not assert — demonstrates.",
  "proofPoints": [
    {
      "achievementId": "exact id string from AVAILABLE ACHIEVEMENTS",
      "framingAngle": "How to present this achievement for this JD — specific lens, not generic",
      "jdConnection": "Quoted or close-paraphrased JD language this achievement directly proves",
      "narrativeNote": "What context or secondary impact to surface when expanding the raw bullet into prose"
    }
  ],
  "messagingAngles": [
    "Theme 1 — use JD language, 3-5 themes total",
    "Theme 2",
    "Theme 3"
  ],
  "toneBlueprint": "Specific tone signal derived from JD evidence — e.g. 'Direct and results-oriented; JD uses action verbs (deliver, drive, own) and has no mission-statement language — avoid warm or values-heavy framing'",
  "structureNotes": "Structural advice specific to this docType and this JD — e.g. word count guidance for STAR responses, paragraph sequencing for cover letters, section prioritisation for resumes",
  "pitfallFlags": [
    "I am writing to express my strong interest in",
    "I am a passionate [profession]",
    "I believe I would be a great fit",
    "I am excited about the opportunity to",
    "With my [X] years of experience",
    "Role-specific pitfall 1",
    "Role-specific pitfall 2"
  ],
  "employerInsight": "One specific, verifiable detail about this employer that can anchor the company connection paragraph — OR exactly: [MISSING: no employer-specific detail found in JD — candidate must research company website, LinkedIn, or recent news before this field can be populated]",
  "sector": "GOVERNMENT | TECH_STARTUP | CORPORATE | HEALTHCARE | EDUCATION | NFP | GENERAL"
}

CONSTRAINTS:
- Return ONLY valid JSON. No preamble. No explanatory text. No markdown code fences.
- Do NOT fabricate employer details. Use the MISSING flag if the JD does not supply them.
- Do NOT write any document prose in any field. Fields contain strategic instructions, not finished sentences (except openingHook, which is a finished sentence the executor will use directly).
- achievementId values MUST exactly match id strings from AVAILABLE ACHIEVEMENTS. Do not invent IDs.
- messagingAngles: minimum 3, maximum 5. Mirror JD language — do not substitute synonyms.
- pitfallFlags: minimum 5 (the 5 seeded above), maximum 7. The 5 seeded flags must always be present.
`;
};
```


## `server/src/lib/atsKeywords.ts`

**Runtime status: DEAD for resume/cover**

ATS keyword scoring. generate.ts:494, legacy path only.

```typescript
export interface AtsCheckOptions {
    jobDescription: string;
    generatedDocument: string;
    docType: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' | 'INTERVIEW_PREP';
}

export interface AtsCheckResult {
    topKeywords: string[];
    missingFromOutput: string[];
    coverage: number;
    warnings: string[];
}

const STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need',
    'must', 'about', 'into', 'over', 'after', 'before', 'between', 'under',
    'above', 'below', 'up', 'down', 'out', 'off', 'than', 'then', 'also',
    'very', 'just', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'same', 'so',
    'too', 'very', 'this', 'that', 'these', 'those',
    'what', 'you', 'your', 'will', 'our', 'we', 'us', 'its', 'who', 'why',
    'how', 'when', 'where', 'been', 'being', 'doing', 'having', 'using',
    'looking', 'working', 'joining', 'based', 'located', 'including',
    'related', 'required', 'supporting', 'managing', 'across', 'within',
    'without', 'through', 'during', 'while', 'because', 'like', 'well',
    'make', 'take', 'get', 'set', 'new', 'one', 'two', 'able', 'help',
    'best', 'high', 'team', 'role', 'work', 'join', 'staff', 'member',
    'company', 'organisation', 'organization', 'including', 'provide',
    'proven', 'language', 'skills', 'relevant', 'leading', 'strong',
    'level', 'year', 'years', 'plus', 'including', 'preferred', 'nice',
    'across', 'within',  'full', 'part', 'time', 'along', 'manage',
]);

const SECTION_HEADER_WORDS = new Set([
    'requirements', 'responsibilities', 'qualifications', 'description',
    'skills', 'experience', 'education', 'summary', 'about', 'overview',
    'duties', 'accountabilities', 'key', 'essential', 'desirable',
]);

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9'\-]+/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 3 && !STOPWORDS.has(t) && !SECTION_HEADER_WORDS.has(t) && /[a-z]/.test(t));
}

function extractPhrases(text: string): string[] {
    const phrases: string[] = [];
    // Capture multi-word phrases: quoted strings, or sequences of capitalized words
    const quoteRegex = /"([^"]{5,})"/g;
    let m;
    while ((m = quoteRegex.exec(text)) !== null) {
        phrases.push(m[1].toLowerCase().trim());
    }
    // Key: value pairs (e.g., "Employment Type: Full-time")
    const kvRegex = /^[A-Za-z\s]+:\s*(.+)$/gm;
    while ((m = kvRegex.exec(text)) !== null) {
        const val = m[1].trim();
        if (val.length > 3 && val.length < 60) phrases.push(val.toLowerCase());
    }
    return phrases;
}

function extractRoleTitleWords(jd: string): string[] {
    // The first few lines of a JD typically contain the role title
    const lines = jd.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const firstLines = lines.slice(0, Math.min(5, lines.length)).join(' ');
    const words = firstLines
        .toLowerCase()
        .replace(/[^a-z0-9\s'\-&]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !STOPWORDS.has(w) && !SECTION_HEADER_WORDS.has(w) && /[a-z]/.test(w));
    return [...new Set(words)];
}

function scoreKeywords(jd: string): Map<string, number> {
    const scores = new Map<string, number>();
    const tokens = tokenize(jd);

    // Count raw frequency
    for (const t of tokens) {
        scores.set(t, (scores.get(t) || 0) + 1);
    }

    // Boost: capitalized individual words (proper nouns, tools)
    const capWords = jd.match(/\b[A-Z][a-z]{2,}\b/g) || [];
    for (const w of capWords) {
        const lower = w.toLowerCase();
        if (!STOPWORDS.has(lower) && !SECTION_HEADER_WORDS.has(lower) && lower.length >= 3) {
            scores.set(lower, (scores.get(lower) || 0) + 2);
        }
    }

    // Boost: PascalCase words as whole units (TypeScript, PowerBI, etc.)
    const pascalWords = jd.match(/\b[A-Z][a-z]+[A-Z][a-z]+[A-Za-z]*\b/g) || [];
    for (const w of pascalWords) {
        const lower = w.toLowerCase();
        scores.set(lower, (scores.get(lower) || 0) + 3);
    }

    // Boost: role title words — only keep those that also appear elsewhere in JD
    const titleWords = extractRoleTitleWords(jd);
    for (const w of titleWords) {
        // Only boost if the word also appears outside the role title lines (freq > 0)
        if (scores.has(w)) {
            scores.set(w, (scores.get(w) || 0) + 3);
        }
    }

    // Boost: words after "Requirements" / "Qualifications" section headers
    const sectionStarters = [/(?:requirements|qualifications|what you'?ll? (?:need|bring)|about you)\s*:*\s*\n/i];
    for (const pattern of sectionStarters) {
        const match = pattern.exec(jd);
        if (match) {
            const afterSection = jd.slice(match.index + match[0].length);
            const sectionEnd = /\n\s*\n(?:#{1,3}\s|Benefits|What we offer)/i.exec(afterSection);
            const relevantText = sectionEnd
                ? afterSection.slice(0, sectionEnd.index)
                : afterSection.slice(0, 500);
            const reqTokens = tokenize(relevantText);
            for (const t of reqTokens) {
                scores.set(t, (scores.get(t) || 0) + 2);
            }
        }
    }

    return scores;
}

// Build phrase-level keywords (2-3 word combinations from capitalized runs)
function extractPhraseKeywords(jd: string): string[] {
    const phrases: string[] = [];

    // Multi-word capitalized phrases (tools, frameworks, specific terms)
    const capPhrases = jd.match(/(?:[A-Z][a-z]{2,}\s+){1,2}[A-Z][a-z]{2,}/g);
    if (capPhrases) {
        for (const p of capPhrases) {
            const lower = p.toLowerCase().trim();
            const words = lower.split(/\s+/);
            // Skip if ALL words are stopwords or section headers
            const meaningfulWords = words.filter(w => !STOPWORDS.has(w) && !SECTION_HEADER_WORDS.has(w));
            if (meaningfulWords.length === 0) continue;
            if (lower.length >= 5 && lower.length <= 50) {
                phrases.push(lower);
            }
        }
    }

    // Tool names — both explicit list and any PascalCase that could be a tool
    const toolList = /\b(React|Node\.?(?:js)?|TypeScript|JavaScript|Python|AWS|GCP|Azure|SAP|Salesforce|Tableau|PowerBI|Jira|Confluence|Figma|Sketch|Adobe|Hootsuite|Sprout\s+Social|WordPress|Drupal|HubSpot|Marketo|Google\s+Analytics|SQL|PostgreSQL|MongoDB|Docker|Kubernetes|Terraform|GitLab|GitHub|CircleCI|Jenkins)\b/gi;
    let toolMatch;
    while ((toolMatch = toolList.exec(jd)) !== null) {
        phrases.push(toolMatch[0].toLowerCase().trim());
    }

    return [...new Set(phrases)];
}

function isKeywordInDocument(keyword: string, document: string): boolean {
    const doc = document.toLowerCase();
    // Word-boundary check for single words
    if (!keyword.includes(' ')) {
        const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
        return regex.test(document);
    }
    // Phrase check: all words present within a small window
    const words = keyword.split(/\s+/);
    if (words.length <= 2) {
        return doc.includes(keyword);
    }
    // For longer phrases, check if all words appear within 5 words of each other
    const docWords = doc.split(/\s+/);
    const kwWords = words.map(w => w.toLowerCase());
    for (let i = 0; i <= docWords.length - kwWords.length; i++) {
        let match = true;
        for (let j = 0; j < kwWords.length; j++) {
            if (docWords[i + j] !== kwWords[j]) { match = false; break; }
        }
        if (match) return true;
    }
    return false;
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function checkAtsKeywords(opts: AtsCheckOptions): AtsCheckResult {
    const { jobDescription, generatedDocument } = opts;

    // Step 1: Score and rank JD keywords
    const scores = scoreKeywords(jobDescription);
    const phraseKeywords = extractPhraseKeywords(jobDescription);

    // Sort by score descending, take top 15
    const sortedWords = [...scores.entries()]
        .filter(([word]) => word.length >= 3 && !SECTION_HEADER_WORDS.has(word))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([word]) => word);

    // Combine with phrase-level keywords, deduplicate, limit to 15
    const allKeywords = [...new Set([...phraseKeywords, ...sortedWords])].slice(0, 15);

    // Step 2: Check presence in generated document
    const missing: string[] = [];
    const roleTitleWords = extractRoleTitleWords(jobDescription);

    for (const kw of allKeywords) {
        if (!isKeywordInDocument(kw, generatedDocument)) {
            missing.push(kw);
        }
    }

    // Step 3: Compute coverage
    const coverage = allKeywords.length > 0
        ? (allKeywords.length - missing.length) / allKeywords.length
        : 1;

    // Step 4: Generate warnings
    const warnings: string[] = [];
    const criticalMissing = missing.filter(kw =>
        roleTitleWords.some(rw => kw.includes(rw))
    );
    if (criticalMissing.length > 0) {
        warnings.push(
            `CRITICAL: Role title keyword(s) missing from body: ${criticalMissing.join(', ')}. ` +
            `ATS scoring for this role likely filters the resume before a human reads it.`
        );
    }
    if (coverage < 0.5) {
        warnings.push(
            `ATS keyword coverage is ${Math.round(coverage * 100)}%. ` +
            `Consider weaving in the missing keywords naturally from your achievement bank.`
        );
    }

    return { topKeywords: allKeywords, missingFromOutput: missing, coverage, warnings };
}
```


## `server/src/services/prompts/generation.ts`

**Runtime status: DEAD for resume/cover**

DOCUMENT_GENERATION_PROMPT — 668 lines. The original engine. Still live for other doc types.

```typescript
import { StrategyBlueprint } from './strategy';
import { computeYearsOfExperience, todayIso } from '../../lib/profileMath';

// =============================================================================
// HYBRID ARCHITECTURE — STAGE 3 (Claude Sonnet quality gate)
// =============================================================================

/**
 * QualityGateResult is the JSON contract returned by the quality gate.
 * Callers should check passed === true before saving the document.
 * If passed === false, rewrites are surgical replacements — not full regeneration.
 */
export interface QualityGateResult {
    passed: boolean;
    flags: string[];
    profileViolations: string[];
    rewrites: Array<{
        section: string;
        original: string;
        suggested: string;
    }>;
}

/**
 * QUALITY_GATE_PROMPT — for Claude Sonnet (cheap, fast pass).
 *
 * Design rationale:
 * - Deliberately narrow scope: 3 checks only, no nitpicking
 * - Hard cap of 3 rewrites prevents over-correction that breaks Llama's output
 * - "Pass if good" default prevents the gate from blocking acceptable work
 * - Prompt kept under 400 words total to minimise latency and cost
 */
export interface ProfileSnapshot {
    employers: string[];
    jobTitles: string[];
    achievementMetrics: string[];
    candidateName?: string;
    yearsOfExperience?: number | null;
}

export const QUALITY_GATE_PROMPT = (
    blueprint: StrategyBlueprint,
    generatedContent: string,
    docType: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' | 'INTERVIEW_PREP' = 'COVER_LETTER',
    profileSnapshot?: ProfileSnapshot | null
): string => {
    const candidateFirstName = docType === 'RESUME' && profileSnapshot?.candidateName
        ? profileSnapshot.candidateName.trim().split(/\s+/)[0]
        : '';
    const check1 = docType === 'COVER_LETTER'
        ? `CHECK 1 — OPENING HOOK: Does the cover letter open with (or very closely paraphrase) the required hook? A close paraphrase passes. A generic opener that ignores the hook fails.\nHook required: "${blueprint.openingHook}"`
        : docType === 'RESUME'
        ? `CHECK 1 — PROFESSIONAL SUMMARY: Two sub-checks, both must pass.
  1a. STRUCTURE: Does the summary read as a scannable credential block (years of experience + outcomes + capability)? FAIL if it begins with the exact company-specific hook "${blueprint.openingHook}" or any near-verbatim restatement of it.
  1b. VOICE (first person, mandatory): The professional summary MUST be written in first person. FAIL if the summary:
       - Opens with or contains the candidate's name${candidateFirstName ? ` (e.g. "${candidateFirstName} brings...", "${candidateFirstName} is a...", "${candidateFirstName} has achieved...")` : ' (e.g. "Jane brings...", "John is a...")'}, OR
       - Uses "he", "she", "they", "his", "her", or "their" to refer to the candidate anywhere in the summary.
     When flagged, the rewrite MUST convert to first person — use "I" (e.g. "I bring 3 years...", "I have achieved...") or agentless first-person ("Marketing professional with 3 years...", "Brings 3 years of..."). Do not simply remove the name; rewrite the sentence so the candidate is speaking.
     Scope: this check applies to the Professional Summary section ONLY. Work experience bullets are allowed to use "I" or imperative voice and should NOT be flagged under this check.`
        : `CHECK 1 — CRITERION OPENING: Does each criterion response open by directly restating the criterion or echoing its key terms in the first sentence? FAIL if any response opens with: (a) the company-specific hook "${blueprint.openingHook}", (b) a generic opener like "I am a dedicated professional" or "I have always had a passion for", or (c) a sentence with no connection to the criterion being addressed. PASS if each response's first sentence names the capability or echoes the criterion language.`;

    const formatCheck = docType === 'RESUME'
        ? `The document must use bullet points / short statements for experience and skills. FAIL if the professional summary or any experience section contains multi-sentence narrative paragraphs that read like a cover letter pitch. Scannable structure required.`
        : docType === 'COVER_LETTER'
        ? `The document must be written in flowing narrative paragraphs. FAIL if any section opens with a bullet-point list or reads like a resume bullet (e.g. "Led X achieving Y" as a standalone line with no surrounding prose). Cover letters must not replicate resume structure.`
        : `Each selection criterion response must: (1) open on-criterion (first sentence echoes the criterion), (2) include bold STAR labels (**Situation**, **Task**, **Action**, **Result**) as inline section markers before each component, (3) have an Action section that is the longest component and names specific tools/methods/decisions, (4) end with a quantified or qualitatively evidenced result. FAIL if STAR labels are absent or if any response ends with a vague completion statement like "the project was completed successfully".`;

    const profileGroundingBlock = profileSnapshot && (profileSnapshot.employers.length > 0 || profileSnapshot.jobTitles.length > 0)
        ? `
CHECK 4 — PROFILE GROUNDING (hallucination detection):
Verify every factual claim in the document is traceable to the candidate's actual data.

CANDIDATE'S VERIFIED EMPLOYERS: ${profileSnapshot.employers.length > 0 ? profileSnapshot.employers.map(e => `"${e}"`).join(' | ') : '(none on record)'}
CANDIDATE'S VERIFIED JOB TITLES: ${profileSnapshot.jobTitles.length > 0 ? profileSnapshot.jobTitles.map(t => `"${t}"`).join(' | ') : '(none on record)'}
${profileSnapshot.achievementMetrics.length > 0 ? `CANDIDATE'S VERIFIED METRICS (from achievement bank): ${profileSnapshot.achievementMetrics.map(m => `"${m}"`).join(' | ')}` : ''}
${typeof profileSnapshot.yearsOfExperience === 'number' ? `CANDIDATE'S VERIFIED YEARS OF EXPERIENCE (computed from employment dates): ${profileSnapshot.yearsOfExperience}` : ''}

Scan the document for:
a) Any employer or organisation name NOT in VERIFIED EMPLOYERS — flag it.
b) Any job title claimed NOT in VERIFIED JOB TITLES — flag it.
c) Any specific numerical metric (%, $, team size, headcount, dollar value) that does NOT appear in VERIFIED METRICS and is not already annotated [VERIFY:] — flag it.

EXCEPTIONS — DO NOT FLAG these even though they are numbers not in VERIFIED METRICS:
- A "X years of experience" / "X+ years" / "X years in [field]" figure in the Professional Summary, IF it matches CANDIDATE'S VERIFIED YEARS OF EXPERIENCE above (exact or within ±1 year). This is a computed fact, not a fabricated metric.
- Role tenure within a single experience entry (e.g. "over 2 years in role") when the dates of that entry support it.
- Date strings (e.g. "Feb 2021", "2023") that simply restate dates already in the candidate's experience entries.
- Counts that simply restate the number of employers, education entries, or other items already present in the candidate data (e.g. "across 3 roles" when 3 roles are listed).
NEVER rewrite a years-of-experience figure to [VERIFY:]. If the figure is wrong (off by more than 1 year from the verified value), rewrite it to the correct number directly — do NOT use [VERIFY:].

For other violations: add a rewrite that either removes the fabricated claim or replaces the specific number with [VERIFY: describe what the candidate should check] so they can confirm accuracy before sending.

PASS if no violations found, or all inferred numbers are already marked [VERIFY:]. Do NOT flag legitimate paraphrases of verified metrics (e.g. "23% reduction" is a valid paraphrase of a metric "reduced costs by 23%").`
        : '';

    return `You are a quality gate. Check the document below against ${profileGroundingBlock ? '4' : '3'} criteria only. Return JSON.

BLUEPRINT REFERENCE:
Pitfall flags (must be absent): ${blueprint.pitfallFlags.map(f => `"${f}"`).join(' | ')}
Messaging angles that MUST appear in the document: ${blueprint.messagingAngles.map(a => `"${a}"`).join(' | ')}
Document type: ${docType}

GENERATED DOCUMENT:
"""
${generatedContent}
"""

${check1}

CHECK 2 — PITFALL FLAGS: Does the document contain any pitfall flag phrase or a close variant? Scan every sentence. If found, flag it.

CHECK 3 — KEYWORD COVERAGE AND FORMAT: Two sub-checks, both must pass.
  3a. KEYWORD COVERAGE: Do at least 3 of the messaging angles listed above appear (verbatim or as clear paraphrases) in the document? If fewer than 3 are present, fail and identify which angles are missing.
  3b. DOCUMENT FORMAT: ${formatCheck}
${profileGroundingBlock}

DECISION RULE: If all checks pass, set passed: true and return empty arrays. Only flag genuine failures — minor wording variations pass. Do not nitpick style.

REWRITE RULE: Maximum 4 rewrites total across all failing checks. Each rewrite must be surgical — replace only the failing text, leave surrounding content intact.

Return valid JSON only. No preamble. No markdown fences.

{
  "passed": true | false,
  "flags": ["description of each failure — empty array if passed"],
  "profileViolations": ["list of fabricated or unverifiable claims found — empty array if none"],
  "rewrites": [
    {
      "section": "short label e.g. 'opening paragraph'",
      "original": "exact text from the document that fails",
      "suggested": "replacement text that passes the relevant check"
    }
  ]
}`;
};

// =============================================================================
// HYBRID ARCHITECTURE — STAGE 2 (Llama executor with blueprint)
// =============================================================================

/**
 * CriterionAchievementMap maps a single selection criterion to its
 * pre-matched achievement evidence (retrieved via semantic search).
 */
export interface CriterionAchievementMap {
    criterion: string;
    criterionIndex: number;
    achievements: Array<{ id: string; title: string; description: string; metric: string | null; relevanceScore: number }>;
}

function buildPerCriterionBlock(maps: CriterionAchievementMap[]): string {
    if (maps.length === 0) return '';
    return maps.map(cm => {
        const achBlock = cm.achievements.length > 0
            ? cm.achievements.map(a =>
                `    - [${a.relevanceScore}% match] ${a.title}: ${a.description} (Metric: ${a.metric ?? 'none'})`
              ).join('\n')
            : '    - (No strong matches — draw on all available experience)';
        return `Criterion ${cm.criterionIndex}: ${cm.criterion}\n${achBlock}`;
    }).join('\n\n');
}

export const FRAMEWORK_INSTRUCTIONS: Record<string, string> = {
    aps_ils: `FRAMEWORK: Australian Public Service — Integrated Leadership System (ILS).
Use ILS cluster language where appropriate: "Shapes Strategic Thinking", "Achieves Results", "Cultivates Productive Working Relationships", "Exemplifies Personal Drive and Integrity", "Communicates with Influence".
Match language to APS band level evident in the JD (APS 3-6: operational specificity; EL1-2: strategic framing).`,
    qld_lc4q: `FRAMEWORK: Queensland Government — Leadership Competencies for Queensland (LC4Q).
Reference the three domains: Vision (leads strategically, leads change), Results (delivers results, drives accountability), Accountability (fosters healthy and inclusive workplaces, demonstrates sound governance).`,
    nsw_capability: `FRAMEWORK: NSW Public Sector Capability Framework.
Align responses to the five capability groups: Personal Attributes, Relationships, Results, Business Enablers, People Management.`,
    vic_vpsc: `FRAMEWORK: Victorian Public Sector Commission (VPSC) Values and Behaviours framework.
Reference VPSC values: Responsiveness, Integrity, Impartiality, Accountability, Respect, Leadership, Human Rights.`,
    university_academic: `FRAMEWORK: Australian University Academic appointment.
Structure responses against academic criteria: Teaching excellence, Research quality/impact, Community engagement, Leadership/service. Avoid STAR for teaching philosophy — use reflective first-person narrative instead.`,
    university_professional: `FRAMEWORK: Australian University Professional Staff (HEW scale).
Apply HEW level-appropriate language. Focus on operational delivery, service quality, and technical/professional expertise relevant to the HEW band.`,
};

/**
 * DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT — for Llama 3.3 70B (executor role).
 *
 * The blueprint goes at the TOP as a "DIRECTOR'S BRIEF" before the rule base
 * and candidate data. This re-prioritises the instruction hierarchy so Llama
 * treats strategic direction as primary and formatting rules as secondary.
 *
 * Design rationale:
 * - Llama is recency-biased: the last instruction tends to dominate. Placing the
 *   blueprint first means formatting rules are "freshest" at generation time,
 *   but strategic framing has been established before any other context loads.
 *   The DIRECTOR'S BRIEF label signals authority, not just information.
 * - pitfallFlags are repeated as a numbered BLOCK THESE PHRASES list immediately
 *   before the TASK so they are the final constraint Llama sees before writing.
 * - proofPoints are rendered as explicit per-achievement instructions, not left
 *   as implicit signals in the achievement list — Llama needs explicit mapping.
 * - analysisContext tone/competencies are preserved for backward compatibility
 *   but blueprint.toneBlueprint takes precedence when present.
 */
export const DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT = (
    type: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' | 'INTERVIEW_PREP',
    jd: string,
    profile: any,
    selectedAchievements: any[],
    ruleBase: string,
    blueprint: StrategyBlueprint,
    analysisContext?: { tone?: string; competencies?: string[]; regenerateFeedback?: string },
    companyResearch?: { salutation?: string; highlights?: string[]; companySize?: string; hiringManager?: string } | null,
    selectionCriteriaText?: string | null,
    perCriterionAchievements?: CriterionAchievementMap[] | null,
    employerFramework?: string | null,
    routeType?: string | null,
    employerQuestions?: string[]
): string => {
    const isAcademicDoc = routeType === 'teaching-philosophy' || routeType === 'research-statement' || routeType === 'offer-negotiation' || routeType === 'linkedin-profile' || routeType === 'cold-outreach' || routeType === 'rejection-response';
    // Derived facts the LLM cannot compute without help (no current date in prompt,
    // "Present" cannot be resolved). Compute server-side and inject as authoritative
    // data so the LLM never emits [VERIFY:] for these.
    const todayDate = todayIso();
    const yearsOfExperience = computeYearsOfExperience(profile?.experience);
    // Build the proof point lookup for inline rendering
    const proofPointMap = new Map(
        blueprint.proofPoints.map(pp => [pp.achievementId, pp])
    );

    // Render achievements with their blueprint framing instructions inline.
    // Achievements without a proof point entry are still included as raw evidence
    // but without strategic framing — Llama uses them as supporting material only.
    const achievementBlock = selectedAchievements.length > 0
        ? selectedAchievements.map(a => {
            const pp = proofPointMap.get(a.id);
            if (pp) {
                return [
                    `- [ID: ${a.id}] ${a.title}: ${a.description} (Metric: ${a.metric ?? 'none'})`,
                    `  FRAMING ANGLE: ${pp.framingAngle}`,
                    `  JD CONNECTION: ${pp.jdConnection}`,
                    `  NARRATIVE NOTE: ${pp.narrativeNote}`,
                ].join('\n');
            }
            return `- [ID: ${a.id}] ${a.title}: ${a.description} (Metric: ${a.metric ?? 'none'}) [supporting evidence — use as context only]`;
        }).join('\n\n')
        : 'No achievements selected. Draw on candidate experience data only.';

    // Tone: blueprint takes precedence; fall back to analysisContext for
    // backward compatibility with callers that have not yet adopted the blueprint.
    const toneInstruction = blueprint.toneBlueprint
        || (analysisContext?.tone ? `Mirror this style: ${analysisContext.tone}` : 'Professional, direct Australian English.');

    // Competencies: blueprint messagingAngles replace analysisContext competencies
    // when present. Both are surfaced so Llama can cross-reference.
    const focusAreas = blueprint.messagingAngles.length > 0
        ? blueprint.messagingAngles.map(a => `- ${a}`).join('\n')
        : (analysisContext?.competencies?.map(c => `- ${c}`).join('\n') ?? 'Map candidate strengths to JD requirements.');

    return `==============================================================
DIRECTOR'S BRIEF — READ THIS FIRST. IT OVERRIDES ALL DEFAULTS.
==============================================================

You are executing a document strategy designed by a senior career strategist. Your job is to write the ${type} exactly as the strategist has specified. Do not improvise the strategic elements. Apply your formatting and language skills within the strategic frame you are given.

${type === 'COVER_LETTER' ? `OPENING HOOK (use this — or a minimal paraphrase that preserves specificity — as the cover letter's opening sentence):
"${blueprint.openingHook}"` : `PROFESSIONAL SUMMARY DIRECTIVE (resume only — do NOT replicate the cover letter hook):
Write a 3–4 sentence professional summary that leads with years of experience + core professional identity, then top 2–3 quantified outcomes, then a forward-looking capability statement. It must NOT begin with a company-specific hook or mirror the cover letter opening sentence. It must be scannable and role-agnostic enough to work across similar applications.

VOICE — NON-NEGOTIABLE: Write the professional summary in FIRST PERSON. The candidate is speaking, not being described. NEVER open with the candidate's name (e.g. "${profile?.name ?? 'Jane'} brings...", "${profile?.name ?? 'Jane'} is a..."). NEVER use "he", "she", or "they" to refer to the candidate. Use "I" when a subject is needed, or write agentless first-person ("Seasoned Business Analyst with 15 years..." — "I" implied). This applies to the Professional Summary ONLY; work experience bullets follow the bullet rules.${yearsOfExperience !== null ? `

YEARS OF EXPERIENCE — USE EXACTLY THIS NUMBER: ${yearsOfExperience}. This figure has been pre-computed from the candidate's actual employment history (earliest start date to today, ${todayDate}). Write it verbatim — e.g. "I bring ${yearsOfExperience} years of marketing experience..." or "${yearsOfExperience}+ years in...". Do NOT recalculate. Do NOT estimate. Do NOT emit [VERIFY:] for this number — it is a verified fact, not a hedge.` : ''}`}

POSITIONING STATEMENT (shape the professional summary / pitch opening around this):
${blueprint.positioningStatement}

MESSAGING ANGLES (these themes must recur across the document using this exact language):
${focusAreas}

TONE DIRECTIVE:
${toneInstruction}

STRUCTURE NOTES FOR THIS DOCUMENT:
${blueprint.structureNotes}

SECTOR: ${blueprint.sector}
${blueprint.sector === 'GOVERNMENT' ? '→ Apply formal tone, reference APS values language if present in JD, use capability framework terminology.' : ''}
${blueprint.sector === 'TECH_STARTUP' ? '→ Warmer, direct tone acceptable. Conciseness rewarded. Bold opening is appropriate.' : ''}
${blueprint.sector === 'HEALTHCARE' ? '→ Emphasise patient outcomes and care quality alongside operational metrics.' : ''}
${blueprint.sector === 'NFP' ? '→ Values alignment is essential. Community impact must be evidenced, not asserted.' : ''}

EMPLOYER INSIGHT (use in company connection paragraph — if MISSING flag present, omit the company connection paragraph entirely rather than fabricating):
${blueprint.employerInsight}

ACHIEVEMENTS WITH STRATEGIC FRAMING INSTRUCTIONS:
${achievementBlock}

==============================================================
BLOCK THESE PHRASES — THEY MUST NOT APPEAR ANYWHERE IN THE OUTPUT:
==============================================================
${blueprint.pitfallFlags.map((f, i) => `${i + 1}. "${f}"`).join('\n')}

If you find yourself about to write any of the above, stop and rewrite using the evidence from the achievements or the opening hook instead.

==============================================================
FORMATTING RULES FOR ${type}
==============================================================
${ruleBase}

==============================================================
CANDIDATE DATA
==============================================================
IMPORTANT: If a section below is marked "(none — omit this section)" you MUST omit that entire section from the output. Do not write a heading, do not write placeholder text, do not say "Not provided". Simply leave it out.

TODAY'S DATE: ${todayDate}${yearsOfExperience !== null ? `
TOTAL YEARS OF EXPERIENCE (pre-computed from work history — use verbatim, do NOT emit [VERIFY:] for this): ${yearsOfExperience}` : ''}

Name: ${profile.name}
Contact (use | as separator on one line): ${[profile.email, profile.phone, profile.linkedin, profile.location].filter(Boolean).join(' | ')}
Professional Summary: ${profile.professionalSummary}
Skills: ${typeof profile.skills === 'string' ? profile.skills : '(none — omit this section)'}
Experience: ${profile.experience?.length ? JSON.stringify(profile.experience) : '(none — omit this section)'}
Education: ${profile.education?.length ? JSON.stringify(profile.education) : '(none — omit this section)'}
Certifications: ${profile.certifications?.length ? JSON.stringify(profile.certifications) : '(none — omit this section)'}
Volunteering: ${profile.volunteering?.length ? JSON.stringify(profile.volunteering) : '(none — omit this section)'}
Languages: ${profile.languages?.length ? JSON.stringify(profile.languages) : '(none — omit this section)'}
${profile.coverLetterRawText ? `
==============================================================
VOICE REFERENCE
==============================================================
The candidate has uploaded a previous cover letter. Match their vocabulary level, sentence rhythm, and formality register. Preserve their natural writing style — do NOT homogenise into generic AI output.

SAMPLE (first 600 chars):
${profile.coverLetterRawText.slice(0, 600)}
` : ''}
JOB DESCRIPTION:
${jd}

==============================================================
TASK: GENERATE THE ${type}
==============================================================
Write the ${type} as high-impact Markdown.

1. Use Australian English throughout (organised, analysed, recognised, programme, labour, colour).
${type === 'RESUME' ? `
HEADER BLOCK (no "## Header" label — just these 3 lines at the top):
   Line 1: # Candidate full name
   Line 2: *Target Job Title from JD | Industry*
   Line 3: contact details separated by | (e.g. john@email.com | 0400 000 000 | linkedin.com/in/john | Sydney, NSW, Australia)` : ''}

2. MISSING DATA RULE: If a section has no data in CANDIDATE DATA, omit that section entirely.
   - Never insert [MISSING:] placeholders or empty sections into the document.
   - Never write "Available upon request" for sections that do not exist in the candidate's data.
   ${type === 'STAR_RESPONSE' ? '- For selection criteria evidence gaps, flag with [MISSING: description] only inside the relevant criterion response.' : ''}

3. ACHIEVEMENT INTEGRATION: ${type === 'COVER_LETTER'
        ? 'Weave achievements into narrative paragraphs as specific evidence. Use the FRAMING ANGLE and NARRATIVE NOTE from each achievement\'s strategic instructions. Do NOT produce a bullet list of achievements.'
        : type === 'STAR_RESPONSE'
            ? 'Map each achievement to the most relevant selection criterion. Build each STAR response around the achievement evidence and its NARRATIVE NOTE.'
            : 'Map each achievement to the most impactful bullet under the relevant experience entry. Use the FRAMING ANGLE to position each bullet for this specific role.'}

${type === 'COVER_LETTER' ? `METRICS RULE (mandatory): You MUST include at least one specific numerical reference in the cover letter.
   Priority order:
   1. Use exact metrics from the ACHIEVEMENTS WITH STRATEGIC FRAMING INSTRUCTIONS above (percentages, dollar values, team sizes, time savings).
   2. If no achievement has a metric, draw a quantitative detail from the CANDIDATE DATA experience entries: years in role, team size, number of clients/projects/stakeholders managed, budget administered, geographic scope, or similar.
   3. A reference like "led a team of 6" or "managed 3 concurrent projects over 2 years" qualifies.
   4. For early-career or student candidates with no work metrics: reference program duration ("a 3-year Computer Science degree"), number of projects completed ("built 4 automation pipelines"), or academic scale ("served a cohort of 200+ students"). Any factual count or duration from the candidate data counts.
   IMPORTANT: If you use a number NOT found in the selected achievements (i.e., inferred from experience context), immediately follow the sentence with [VERIFY: brief description of what to confirm] so the candidate can check accuracy before sending.
   NEVER write a cover letter with zero numerical references — it reads as unsubstantiated assertion and weakens the application.` : ''}

4. ${isAcademicDoc
        ? 'ACADEMIC DOCUMENT FORMAT: Follow the specific format and structure rules in the FORMATTING RULES section above exactly. Do NOT apply STAR framework. Write as first-person narrative prose as specified.'
        : type === 'STAR_RESPONSE'
        ? routeType === 'cold-outreach'
          ? `COLD OUTREACH FORMAT: Two variants — LinkedIn DM (≤150 words) and Email (≤200 words).
SALUTATION: ${companyResearch?.salutation ?? 'Dear Hiring Manager,'}
COMPANY CONTEXT: ${companyResearch?.highlights?.join(' — ') ?? ''}
Follow the cold outreach rules in the rule base for structure and tone.`
          : 'STAR FORMAT: Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%). Flowing prose. First person active voice. Each component MUST be introduced with its bold label on its own line: **Situation**, **Task**, **Action**, **Result** — written exactly like that, before the prose for each component.'
        : type === 'COVER_LETTER'
            ? `COVER LETTER FORMAT: No headers or subheadings. 3-5 paragraphs separated by a blank line.
   SALUTATION: ${companyResearch?.salutation ?? 'Dear Hiring Manager,'}
   Open with the DIRECTOR'S BRIEF hook immediately after the salutation.
   Evidence paragraphs follow. Company connection paragraph last (omit if employerInsight has MISSING flag). Proactive CTA in closing.
   SIGN-OFF: End with "Yours sincerely," (if named salutation) or "Yours faithfully," (if "Dear Hiring Manager") followed by a blank line and then the candidate's full name: ${profile.name}`
            : 'SPECIALIST POSITIONING: Every bullet demonstrates domain expertise. Cut generic filler. Quality over quantity — 3 sharp bullets beat 6 weak ones.'}

${type === 'RESUME' ? `5. FORMATTING:
   - Use ## for section headers (not the header block at top)
   - Experience bullets MUST use markdown list syntax — each bullet on its own line starting with "- ". Never use • for bullet points.
   - Skills layout: each category on a SEPARATE paragraph (blank line between each). Format exactly:
       **Technical Skills:** Skill A • Skill B • Skill C

       **Industry Knowledge:** Domain A • Domain B

       **Soft Skills:** Skill A • Skill B
   - The bold label (**Technical Skills:**, **Industry Knowledge:**, **Soft Skills:**) always starts flush at the beginning of its line.
   - Omit any skill category entirely if no data exists for it.
   - Omit any section entirely if no candidate data exists for it.
   - Minimise vertical whitespace — target 1-2 pages.` : ''}

${selectionCriteriaText ? `
==============================================================
SELECTION CRITERIA TO ADDRESS
==============================================================
The candidate has pasted their selection criteria below. Read it carefully before generating.

PARSING RULE — CRITICAL:
The pasted text may contain section headings such as "Required Qualifications", "Required Experience", "Required Skills", "Essential Criteria", "Desirable Criteria", or similar. These headings are NOT criteria — they are category labels.
The ACTUAL criteria are the individual bullet points, numbered items, or sentences listed UNDER those headings.
Generate one STAR response per individual criterion item (bullet/numbered point/sentence), NOT per section heading.
If you see "Required Experience" followed by three dot points, generate three separate STAR responses — one for each dot point.
NEVER generate a response where the heading is "Required Qualifications/Certificates" or "Required Experience" — those are not criteria, they are containers.

WORD LIMIT CHECK: Before writing, scan the criteria text and job description for any stated word limit, page limit, or character limit per criterion (e.g. "maximum 300 words", "no more than half a page"). If found, apply it strictly and note it at the top of the document as: [Word limit: X words per criterion — applied per application instructions]. If no limit is stated, use the defaults below.

STAR ALLOCATION: Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%).
Write in flowing prose, first person, active voice.
Target 250-400 words per criterion unless a limit was found above.

STAR LABELS (mandatory): Each STAR component must be introduced with its label in bold on its own line, immediately before the prose for that component. Use exactly this format:
**Situation**
[prose...]

**Task**
[prose...]

**Action**
[prose...]

**Result**
[prose...]

Do NOT use ## for these labels. Each criterion response must look exactly like this structure:

**Situation**
[prose for situation]

**Task**
[prose for task]

**Action**
[prose for action]

**Result**
[prose for result]

This is mandatory. Every single criterion response must have all four labels.

MANDATORY OPENING: Each response MUST open by directly restating the criterion or echoing its key terms in the first sentence. This signals to the assessment panel that you are addressing their specific criterion.
CORRECT: "My experience managing competing stakeholder priorities has developed across three programme delivery roles..."
WRONG: Opening with the cover letter hook, a generic "I am a dedicated professional", or a sentence unrelated to the criterion.

ACTION SECTION STANDARD — this is where applications are won or lost:
- Name the specific tool, system, methodology, or approach you used and WHY you chose it
- Describe the decision-making behind your actions: "Recognising that X, I chose Y rather than Z because..."
- Sequence actions logically — show the candidate directing events, not just responding to them
- Write: "I designed a milestone tracker in Excel that surfaced conflicts 3 weeks in advance" — not "I managed project timelines"
- The Action section MUST be the longest component

MULTI-EXAMPLE OPTION: For broad criteria (communication, collaboration, stakeholder engagement, problem-solving), use TWO mini-STARs showing consistent capability across different contexts rather than a single example. Same total word count applies.

RESULT STANDARD: State organisational impact, not just task completion.
- Quantify wherever possible: %, $, time saved, headcount impacted, error rate reduced, satisfaction score
- If no metric exists, use qualitative evidence: senior endorsement, policy adopted, award, team feedback, process continued after the candidate's involvement
- Do NOT end a response with "The project was completed successfully" — that is not a result

QUALITY BENCHMARK: The worked example in the FORMATTING RULES section is the reference standard. Every response must match or exceed that level of specificity. Ask yourself: "Could this response have been written by any candidate, or does it clearly reflect this specific person's experience?" If the former — rewrite with more detail.

PRE-WRITING STEP — do this silently before drafting each response:
For each criterion, identify:
  a) The core capability being assessed (e.g. "stakeholder management", "financial governance") — often different from the criterion's surface wording
  b) Which achievement from TARGETED EVIDENCE most directly proves that specific capability
  c) The single most specific detail from that achievement — a tool, a decision, a number, a method — that the Action section MUST anchor around
Only then write. If you find yourself writing generically, stop — return to (c) and build the response outward from that concrete detail.

${employerFramework && FRAMEWORK_INSTRUCTIONS[employerFramework] ? `
${FRAMEWORK_INSTRUCTIONS[employerFramework]}
` : ''}

${selectionCriteriaText}

${perCriterionAchievements && perCriterionAchievements.length > 0 ? `
--------------------------------------------------------------
TARGETED EVIDENCE — use these pre-matched achievements first for each criterion.
These were retrieved via semantic search specifically for each criterion above.
--------------------------------------------------------------
${buildPerCriterionBlock(perCriterionAchievements)}
` : ''}

IMPORTANT: Generate ALL criteria listed above. Each response is a separate headed section.
` : ''}

${employerQuestions && employerQuestions.length > 0 && type === 'COVER_LETTER' ? `
EMPLOYER QUESTIONS — the JD asks the candidate to answer these. Address each
proactively in the cover letter body where relevant. Do not include verbatim
questions; weave the answers into the narrative.

${employerQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
` : ''}

CONSTRAINTS:
- Do NOT use bold ** within bullet points unless highlighting a metric.
- Do NOT include any meta-talk or pleasantries (e.g. "Here is your cover letter...").
- Output ONLY the Markdown content. Nothing before it, nothing after it.
- Do NOT fabricate any data not present in CANDIDATE DATA above.
- The DIRECTOR'S BRIEF takes precedence. Where the brief specifies framing, use it. Where it specifies the opening hook, use it. Do not substitute your own interpretation.
${type === 'RESUME' ? `- JD KEYWORD INTEGRATION (mandatory): Identify the most important technical skills, tools, certifications, role titles, and industry terminology from the JD above. Embed these naturally throughout the professional summary, skills section, and experience bullets where the candidate's actual experience supports them. Every term must be contextually accurate — do NOT insert keywords the candidate cannot substantiate. Do NOT stuff the company name into the resume. Goal: a recruiter reading both documents should feel they were built for each other.` : ''}
${analysisContext?.regenerateFeedback ? `
==============================================================
USER IMPROVEMENT REQUEST (HIGHEST PRIORITY — apply this)
==============================================================
The user has requested the following specific changes to this regeneration:
"${analysisContext.regenerateFeedback}"

Apply this feedback directly and deliberately. This overrides default choices where there is a conflict.
==============================================================
` : ''}`;
};

// =============================================================================
// ORIGINAL SINGLE-PASS PROMPT (preserved for A/B comparison and fallback)
// =============================================================================

export const DOCUMENT_GENERATION_PROMPT = (
    type: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' | 'INTERVIEW_PREP',
    jd: string,
    profile: any,
    selectedAchievements: any[],
    ruleBase: string,
    analysisContext?: { tone?: string; competencies?: string[]; regenerateFeedback?: string },
    companyResearch?: { salutation?: string; highlights?: string[]; companySize?: string } | null,
    selectionCriteriaText?: string | null,
    perCriterionAchievements?: CriterionAchievementMap[] | null,
    employerFramework?: string | null,
    routeType?: string | null,
    employerQuestions?: string[]
) => {
    const isAcademicDoc = routeType === 'teaching-philosophy' || routeType === 'research-statement' || routeType === 'offer-negotiation' || routeType === 'linkedin-profile' || routeType === 'cold-outreach' || routeType === 'rejection-response';
    const todayDate = todayIso();
    const yearsOfExperience = computeYearsOfExperience(profile?.experience);
    return `
You are a career coach generating a ${type}.

CRITICAL RULES FOR ${type}:
${ruleBase}

TONAL DIRECTION:
${analysisContext?.tone ? `Mirror this style: ${analysisContext.tone}` : "Professional, direct English."}

CORE FOCUS AREAS (Prioritize these):
${analysisContext?.competencies?.map(c => `- ${c}`).join('\n') || "Map candidate strengths to JD requirements."}

CANDIDATE DATA:
IMPORTANT: If a section below is marked "(none — omit this section)" you MUST omit that entire section from the output. Do not write a heading, do not write placeholder text, do not say "Not provided". Simply leave it out.

TODAY'S DATE: ${todayDate}${yearsOfExperience !== null ? `
TOTAL YEARS OF EXPERIENCE (pre-computed from work history — use verbatim, do NOT emit [VERIFY:] for this): ${yearsOfExperience}` : ''}

Name: ${profile.name}
Contact (use | as separator on one line): ${[profile.email, profile.phone, profile.linkedin, profile.location].filter(Boolean).join(' | ')}
Professional Summary: ${profile.professionalSummary}
Skills: ${typeof profile.skills === 'string' ? profile.skills : '(none — omit this section)'}
Experience: ${profile.experience?.length ? JSON.stringify(profile.experience) : '(none — omit this section)'}
Education: ${profile.education?.length ? JSON.stringify(profile.education) : '(none — omit this section)'}
Certifications: ${profile.certifications?.length ? JSON.stringify(profile.certifications) : '(none — omit this section)'}
Volunteering: ${profile.volunteering?.length ? JSON.stringify(profile.volunteering) : '(none — omit this section)'}
Languages: ${profile.languages?.length ? JSON.stringify(profile.languages) : '(none — omit this section)'}
${profile.coverLetterRawText ? `
VOICE REFERENCE — match vocabulary level, sentence rhythm, and formality register from this sample. Preserve the candidate's natural style:
"${profile.coverLetterRawText.slice(0, 600)}"
` : ''}
SELECTED ACHIEVEMENTS (Use ONLY these for evidence):
${selectedAchievements.length > 0
    ? selectedAchievements.map(a => `- [${a.title}] ${a.description} (Metric: ${a.metric})`).join('\n')
    : "No specific achievements selected. Focus on general skills and background."}

JOB DESCRIPTION:
${jd}

---
TASK:
Generate the ${type} as high-impact Markdown.
1. Use Australian English (organised, analysed, recognised, programme, labour, colour).
   ${type !== 'COVER_LETTER' && type !== 'STAR_RESPONSE' ? `HEADER BLOCK (no "## Header" label — just these 3 lines at the top):
   Line 1: # Candidate full name
   Line 2: *Target Job Title from JD | Industry*
   Line 3: contact details separated by | (e.g. john@email.com | 0400 000 000 | linkedin.com/in/john | Sydney, NSW, Australia)` : ''}

2. MISSING DATA RULE: If a section has no data in CANDIDATE DATA above, OMIT that section entirely.
   - Never insert [MISSING:] placeholders or empty sections into the document.
   - Never write "Available upon request" for sections that simply don't exist in the candidate's data.
   ${type === 'STAR_RESPONSE' ? `- For selection criteria gaps, flag with [MISSING: description] only in the criteria response itself.` : ''}

3. ACHIEVEMENT INTEGRATION: ${type === 'COVER_LETTER'
    ? `Weave the selected achievements directly into the cover letter as specific evidence. Each achievement should be referenced naturally within the narrative paragraphs — not as a bullet list. Show HOW these achievements prove fit for this specific role.`
    : type === 'STAR_RESPONSE'
    ? `Map each selected achievement to the most relevant selection criterion. Build each STAR response around the achievement evidence.`
    : `Map each selected achievement to the most impactful bullet point under the relevant experience entry.`}

4. ${isAcademicDoc
    ? 'ACADEMIC DOCUMENT FORMAT: Follow the specific format and structure rules in the FORMATTING RULES section above exactly. Do NOT apply STAR framework. Write as first-person narrative prose as specified.'
    : type === 'STAR_RESPONSE'
    ? routeType === 'cold-outreach'
      ? `COLD OUTREACH FORMAT: Two variants — LinkedIn DM (≤150 words) and Email (≤200 words).\nSALUTATION: ${companyResearch?.salutation ?? 'Dear Hiring Manager,'}\nCOMPANY CONTEXT: ${companyResearch?.highlights?.join(' — ') ?? ''}\nFollow the cold outreach rules in the rule base for structure and tone.`
      : `STAR FORMAT REQUIRED: Each criterion response must follow Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%). Write in flowing prose, first person, active voice. Each component MUST be introduced with its bold label on its own line (**Situation**, **Task**, **Action**, **Result**) before the prose for that component.`
    : type === 'COVER_LETTER'
    ? `COVER LETTER FORMAT: No headers or subheadings. 3-4 paragraphs separated by a blank line.
   SALUTATION: ${companyResearch?.salutation ?? 'Dear Hiring Manager,'}
   Opening: hook tied to this specific role and company. Body: evidence from achievements. Closing: proactive CTA.
   SIGN-OFF: End with "Yours sincerely," (if named salutation) or "Yours faithfully," followed by a blank line then the candidate's full name: ${profile.name}`
    : `SPECIALIST POSITIONING: Present the candidate as a deep specialist in their field. Cut generic filler. Every bullet must demonstrate domain expertise. Quality over quantity — 3 sharp bullets beat 6 weak ones.`}

5. ${type === 'RESUME' ? `FORMATTING:
   - Use ## for section headers (not the header block at top)
   - Experience bullets MUST use markdown list syntax — each bullet on its own line starting with "- ". Never use • for bullet points.
   - Skills layout: each category on a SEPARATE paragraph (blank line between each). Format exactly:
       **Technical Skills:** Skill A • Skill B • Skill C

       **Industry Knowledge:** Domain A • Domain B

       **Soft Skills:** Skill A • Skill B
   - The bold label (**Technical Skills:**, **Industry Knowledge:**, **Soft Skills:**) always starts flush at the beginning of its line. Never appear mid-line or mid-paragraph.
   - Omit any skill category entirely if no data exists for it
   - Omit any section entirely if no candidate data exists for it
   - Minimise vertical whitespace — target 1–2 pages` : ''}

${selectionCriteriaText ? `
SELECTION CRITERIA TO ADDRESS:
The candidate has provided the following criteria. Generate a separate STAR response for each, headed with the criterion text. Address ALL criteria in the order listed.

STAR ALLOCATION: Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%).
Write in flowing prose, first person, active voice. Target 250-400 words per criterion.

MANDATORY OPENING: Each response MUST open by restating the criterion or echoing its key terms in the first sentence. Do not open with a generic statement or the cover letter hook.

ACTION SECTION: Name the specific tool, system, or method used and WHY. Describe decision-making. Write "I designed X using Y because Z" — not "I managed the project." Action must be the longest component.

MULTI-EXAMPLE: For broad criteria (communication, collaboration, stakeholder engagement), use two mini-STARs from different contexts at the same total word count.

RESULT: State organisational impact with quantified evidence (%, $, time, headcount). If no metric, use qualitative evidence: senior endorsement, policy adopted, feedback score. Never end with "the project was completed successfully."

${employerFramework && FRAMEWORK_INSTRUCTIONS[employerFramework] ? FRAMEWORK_INSTRUCTIONS[employerFramework] + '\n' : ''}

${selectionCriteriaText}

${perCriterionAchievements && perCriterionAchievements.length > 0 ? `
TARGETED EVIDENCE per criterion (semantic search pre-matched):
${buildPerCriterionBlock(perCriterionAchievements)}
` : ''}
` : ''}

${employerQuestions && employerQuestions.length > 0 && type === 'COVER_LETTER' ? `
EMPLOYER QUESTIONS — the JD asks the candidate to answer these. Address each
proactively in the cover letter body where relevant. Do not include verbatim
questions; weave the answers into the narrative.

${employerQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
` : ''}

CONSTRAINTS:
- Do NOT use bold ** within bullet points unless highlighting a metric.
- Do NOT include any meta-talk or pleasantries (e.g., "Here is your resume...").
- Output ONLY the Markdown content.
- Do NOT fabricate any data not present in CANDIDATE DATA above.
${analysisContext?.regenerateFeedback ? `
==============================================================
USER IMPROVEMENT REQUEST (HIGHEST PRIORITY — apply this)
==============================================================
The user has requested the following specific changes to this regeneration:
"${analysisContext.regenerateFeedback}"

Apply this feedback directly and deliberately. This overrides default choices where there is a conflict.
==============================================================
` : ''}`;
};
```


# SECTION: SUPPORTING PROMPTS


## `server/src/services/prompts/identity.ts`

**Runtime status: LIVE**

Suggests target job titles.

```typescript
export interface IdentityCard {
  label: string;
  summary: string;
  keyStrengths: string[];
  tone: string;
  achievementThemes: string[];
  evidenceBasis: 'full' | 'limited';
}

export const IDENTITY_DERIVATION_PROMPT = (
  profile: {
    name: string | null;
    professionalSummary: string | null;
    targetRole: string | null;
    seniority: string | null;
    industry: string | null;
    perceivedBlocker: string | null;
  },
  experiences: Array<{ company: string; role: string; startDate: string; endDate: string | null; type?: string }>,
  achievements: Array<{ title: string; description: string; metric: string | null; skills: string | null }>,
  coverLetterSamples: string[]
): string => `
You are a recruiter and career strategist. Your job is to identify the 2–3 real job titles this candidate should be applying for right now, based strictly on their evidence — not aspiration, not generic patterns.

CANDIDATE PROFILE:
Name: ${profile.name || 'Unknown'}
Professional Summary: ${profile.professionalSummary || 'Not provided'}
Target Role: ${profile.targetRole || 'Not specified'}
Seniority: ${profile.seniority || 'Not specified'}
Industry: ${profile.industry || 'Not specified'}
${profile.perceivedBlocker ? `Perceived Career Blocker: ${profile.perceivedBlocker}` : ''}

WORK & PROJECT HISTORY (most recent first):
${experiences.map(e => `- [${e.type === 'project' ? 'PROJECT' : 'WORK'}] ${e.role} at ${e.company} (${e.startDate}–${e.endDate || 'present'})`).join('\n') || 'Not provided'}

ACHIEVEMENTS (sample):
${achievements.slice(0, 20).map(a => `- ${a.title}: ${a.description}${a.metric ? ` (${a.metric})` : ''}${a.skills ? ` [${a.skills}]` : ''}`).join('\n') || 'No achievements yet'}

${coverLetterSamples.length > 0 ? `COVER LETTER SAMPLES:
${coverLetterSamples.map((cl, i) => `--- Sample ${i + 1} ---\n${cl.slice(0, 800)}`).join('\n\n')}` : ''}

---
TASK:
Identify 2–3 specific, hireable job titles this person should be targeting based on the evidence above.

Rules:
- The label MUST be a real job title that appears in job listings — e.g. "Graduate Cybersecurity Analyst", "AI/ML Engineer", "Junior Penetration Tester", "Product Manager". NOT "Problem Solver", NOT "Technical Leader", NOT any abstract pattern or archetype.
- Weight the target role they declared and their most recent/technical work most heavily. A part-time or unrelated job (e.g. hospitality, retail) should not generate a separate title unless that is their clear primary career track.
- Each title must be distinct — different roles, not synonyms.
- The summary explains in 2 sentences WHY their background is a credible fit for this specific title, citing actual experience or projects.
- keyStrengths are the specific skills from their CV most relevant to THIS title.
- If fewer than 5 achievements exist, return only 1 card and set evidenceBasis to 'limited'. Otherwise set evidenceBasis to 'full'.
- Australian English spelling throughout.
- Do NOT invent experience not evidenced by the data.

Return ONLY valid JSON. No preamble.

{
  "identityCards": [
    {
      "label": "Real job title — e.g. Graduate Cybersecurity Analyst",
      "summary": "2 sentences. Why their background is a credible fit for this title. Cite specific evidence.",
      "keyStrengths": ["skill1", "skill2", "skill3"],
      "tone": "How they naturally write and speak — e.g. 'direct, metric-heavy, systems-thinking'",
      "achievementThemes": ["theme1", "theme2", "theme3"],
      "evidenceBasis": "full | limited"
    }
  ]
}
`;
```


## `server/src/services/prompts/draftCritique.ts`

**Runtime status: LIVE**

Critique of a user-pasted draft.

```typescript
/**
 * Draft critique prompt — reads a generated document back and flags the
 * specific human-readable failure modes that AI generators tend to miss:
 * desperation, overselling, hedging, vagueness, weak openings, narrative
 * incoherence. Returns structured JSON the frontend renders as a quiet
 * review panel.
 *
 * Built around a Strategy-Hub-aligned framing rule: the system does what
 * AI alone can't. Generation produces a draft; critique audits it for
 * trust signals a recruiter actually screens against.
 */

import type { PositioningStatement } from '../positioningStatement';

export function DRAFT_CRITIQUE_PROMPT(params: {
    docType: 'resume' | 'cover-letter' | 'selection-criteria';
    content: string;
    jobDescription?: string | null;
    positioningStatement: PositioningStatement | null;
    resumeText?: string | null;
}): string {
    const { docType, content, jobDescription, positioningStatement, resumeText } = params;

    const docTypeLabel =
        docType === 'cover-letter' ? 'Cover Letter' :
        docType === 'selection-criteria' ? 'Selection Criteria responses' :
        'Resume';

    const positioningBlock = positioningStatement
        ? `CANDIDATE POSITIONING (use this to check coherence — claims in the draft should be consistent with this shape):
  ${positioningStatement.raw}
`
        : 'CANDIDATE POSITIONING: not available — judge coherence against the document itself only.';

    const jdBlock = jobDescription && jobDescription.trim().length > 50
        ? `TARGET JOB DESCRIPTION:
"""
${jobDescription.trim()}
"""
`
        : 'TARGET JOB DESCRIPTION: not provided — critique against general Australian-market recruiter expectations.';

    const resumeBlock = resumeText && resumeText.trim().length > 100
        ? `THE CANDIDATE'S SOURCE RESUME (ground truth for what they have actually done — use it for failure mode 8):
"""
${resumeText.trim()}
"""
`
        : 'SOURCE RESUME: not available — skip failure mode 8 entirely.';

    return `You are a senior career strategist glancing over a candidate's ${docTypeLabel} before they send it. The candidate is an international graduate job-hunting in Australia. Offer at most two suggestions they can take or leave.

DO NOT rewrite the document. DO NOT suggest stylistic polish. DO NOT score or grade it. Pick the two most useful observations from the failure modes below, with concrete quoted snippets, and stop there.

═══ FAILURE MODES TO AUDIT ═══

1. DESPERATION SIGNALS
   Phrases like "any opportunity", "willing to learn anything", "open to relocate anywhere", "I'm passionate about everything", "please give me a chance". Recruiter-trust killers.

2. OVERSELLING WITHOUT EVIDENCE
   Empty superlatives: "world-class", "best-in-class", "rockstar", "ninja", "10x", "results-driven", "passionate professional", "highly motivated". These read as imported jargon, never as proof.

3. HEDGING / LACK OF OWNERSHIP
   "helped with", "assisted in", "involved in", "contributed to", "was part of a team that". The candidate is hiding their actual contribution.

4. VAGUENESS
   "various", "many", "multiple", "a number of", "several", "etc." without specifics. Numbers and named entities replace these.

5. WEAK OPENINGS (cover letters specifically)
   "I am writing to apply for...", "Please find attached...", "My name is...", or any opener that wastes the first sentence on logistics. The first sentence is real estate.

6. NARRATIVE INCOHERENCE
   Claims that don't match the candidate's positioning. Seniority claims with insufficient years. Generic "passionate about [industry]" with no track record in that industry. Career jumps left unexplained.

7. GENERIC POSITIONING
   "I'm a passionate marketing professional who thrives in fast-paced environments." Means nothing. Should be replaced with a specific positioning anchored in role + seniority + domain + proof point.

8. INFLATION BEYOND THE RESUME (highest value — check this one hardest)
   Claims of capability, seniority, or experience that the source resume does not strictly support. This is NOT about fabricated facts (names and numbers are checked elsewhere). It is about honest facts stretched into dishonest capability: "overseeing client engagements is familiar ground" when the resume shows reporting to stakeholders, not overseeing anything; "fluent in how these systems are built" backed by one online course; job-description vocabulary mirrored back as the candidate's own experience. For each: quote the claim, name what the resume actually supports, and give the honest phrasing that survives an interviewer probing it. An interview is where these claims get cross-examined — flag anything the candidate could not defend for two minutes.

═══ INPUTS ═══

${positioningBlock}

${jdBlock}

${resumeBlock}

DOCUMENT (${docTypeLabel}):
"""
${content}
"""

═══ OUTPUT ═══

Return STRICT JSON, no markdown fences, no preamble:

{
  "issues": [
    {
      "category": "desperation" | "overselling" | "hedging" | "vagueness" | "weak_opening" | "incoherence" | "generic_positioning" | "inflation",
      "snippet": "<the exact short phrase from the document, quoted>",
      "why": "<one sentence: why this signal hurts recruiter trust>",
      "fix": "<one sentence: how the candidate could rewrite it. Be specific. No platitudes.>"
    }
  ]
}

═══ RULES ═══

- AT MOST 2 issues. Not 3, not 6. Pick the two that would most change how a
  recruiter reads this document, and say nothing about the rest. A short,
  ignorable note is the point; a long audit is not.
- If the document is genuinely fine, return an empty issues array. An empty
  array is a perfectly good answer. Do NOT invent issues to fill the list.
- Do NOT grade, score, rank, or rate the document. No numbers, no percentages,
  no letter grades, no "out of 10" anywhere in your output. These are
  suggestions the candidate is free to ignore, not an assessment.
- "inflation" outranks every other category — a recruiter forgives a vague
  phrase, an interviewer never forgives a claim that collapses under
  questioning. Reframing, reordering, and tailoring to the job are NOT
  inflation; only flag claims the resume cannot support at all.
- Quote the exact phrase. Single sentence excerpts. Do not paraphrase.
- "fix" must be specific, not generic. "Replace with a number" is bad; "Replace 'helped with marketing campaigns' with 'Led the rollout of X to N audiences, delivering Y%' is good (use placeholders if metrics not visible).
- No em dashes (—) in any output string. Use periods, commas, or colons.
- Australian English in your prose: organisation, programme, behaviour.
- AUSTRALIAN RESUME CONVENTION (absolute): a referees section, or the line "References available on request", is standard and expected on an Australian resume. NEVER advise removing, deleting, shortening, or replacing the referees or references section, and never call it outdated, filler, or unnecessary. This is correct local practice, not a flaw.
- Output ONLY the JSON object. Nothing else.
`;
}
```


## `server/src/services/prompts/achievementDraft.ts`

**Runtime status: LIVE**

```typescript
/**
 * Achievement-draft-from-gap prompt.
 *
 * Takes a Bridgeable Gap (skill + seed suggestion) and the candidate's
 * positioning context, returns a polished draft achievement (title +
 * description + metric placeholder) the user can edit and save.
 *
 * The draft is explicitly marked as "draft / unverified" in the UI — we
 * never auto-save a fabricated achievement. The user reviews, edits the
 * placeholder metric, and clicks save.
 */
import type { PositioningStatement } from '../positioningStatement';

export function ACHIEVEMENT_DRAFT_PROMPT(params: {
    skill: string;
    suggestion: string;
    positioningStatement: PositioningStatement | null;
    jobRole: string;
    jobCompany: string;
}): string {
    const { skill, suggestion, positioningStatement, jobRole, jobCompany } = params;

    const positioningBlock = positioningStatement
        ? `CANDIDATE POSITIONING (use this to ground the draft in their actual experience):
  ${positioningStatement.raw}
`
        : 'CANDIDATE POSITIONING: not available — keep the draft general enough that the user can paste their own context.';

    return `You are helping an Australian job seeker turn a Bridgeable Gap into a real achievement. They likely have this experience based on their role and seniority. Your job is to draft an achievement they can lift verbatim into their profile after light editing.

═══ INPUTS ═══

${positioningBlock}

TARGET ROLE: ${jobRole} at ${jobCompany}

SKILL THE JOB REQUIRES (and the candidate likely has): ${skill}

INITIAL SUGGESTION (from the upstream analysis): "${suggestion}"

═══ OUTPUT ═══

Return STRICT JSON, no preamble, no markdown fences:

{
  "title": "<short achievement title, 4-8 words>",
  "description": "<single first-person sentence describing what the candidate did, in their voice; 18-32 words; do not invent metrics — use a placeholder like '[X%]' or '[N people]' or omit the metric entirely>",
  "metricPlaceholder": "<a one-line hint about what metric would prove this achievement, e.g. '% process time saved' or '# stakeholders coordinated'>"
}

═══ RULES ═══

- First person. "I led", "I drove", "I coordinated" — not "Led" or "The candidate led".
- Action verb at the start of the description.
- Do NOT fabricate specific numbers, dollar amounts, or company names. If a metric belongs, use a placeholder like "[X%]" so the user knows to fill it in.
- Keep it grounded. If the positioning says "Senior Financial Analyst, 7 years in banking", don't suggest a "ran a 50-person team" achievement.
- No em dashes (—) anywhere. Use periods, commas, or colons.
- Match the user's likely register. Australian English: organisation, programme, behaviour, recognise.
- Output only the JSON object.
`;
}
```


## `server/src/services/prompts/analysis.ts`

**Runtime status: LIVE**

Job ad analysis.

```typescript
export const JOB_ANALYSIS_PROMPT = (
  jd: string,
  profile: any,
  topAchievements: string,
  identityCards: Array<{ label: string; summary: string }>
): string => `
Act as an expert Australian recruitment consultant comparing a candidate to a Job Description (JD).

USER PROFILE:
${profile.professionalSummary}
Top Skills: ${profile.skills.technical.join(', ')}

CANDIDATE IDENTITY CARDS:
${identityCards.length > 0
  ? identityCards.map((c, i) => `${i + 1}. ${c.label}: ${c.summary}`).join('\n')
  : 'Not yet derived — assess without identity context.'}

TOP RELEVANT ACHIEVEMENTS (from bank):
${topAchievements}

JOB DESCRIPTION:
${jd}

---
TASK:
1. Extract the company name and job role title from the JD.
2. Extract 10-15 key skills/keywords from the JD.
3. Identify the "Tonal Profile" of the JD (e.g., "Corporate & Formal", "Fast-Paced Tech", "Direct & Service-Oriented", "Academic/Research").
4. Identify 3-5 "Core Competencies" the JD emphasises most.
5. Rank the provided achievements by relevance to this JD.
6. Score each of the 10 dimensions (integer 1–5) and write a one-sentence note explaining the score. Be honest — do not inflate.
7. Identify which identity card label best matches this role, or null if none fit.
8. Detect Australian-specific signals from the JD.
9. Set requiresSelectionCriteria to true ONLY if the JD explicitly contains: "Selection Criteria", "Key Selection Criteria", "KSC", "Statement of Claims", or "Capability Statements".

---
DIMENSION SCORING GUIDE (score 1–5, integer only):
- roleMatch: Does this job function match what the candidate does?
- skillsAlignment: Do the hard skills in the JD match the candidate's proven skills?
- seniorityFit: Does the level match? Map APS1–6, EL1–2, SES bands if applicable.
- compensation: Does the expected AU salary/TRP align with this candidate's market value?
- interviewLikelihood: Probability of callback. Government SC roles: reduce slightly (longer pipeline).
- geographicFit: Does location/remote policy work? Key AU markets: Sydney, Melbourne, Brisbane, Perth, Adelaide, Canberra.
- companyStage: Does company type (startup/sme/enterprise/government/university/nfp) suit this candidate's background?
- marketFit: Is the company/sector growing or declining in the Australian market?
- growthTrajectory: Does this role offer genuine career progression?
- timelineAlignment: Does hiring urgency match candidate availability?

---
CONSTRAINTS:
- Return ONLY valid JSON. No preamble, no markdown fences.
- All dimension scores must be integers 1–5.
- Australian English spelling throughout.

OUTPUT SCHEMA:
{
  "matchScore": number,
  "keywords": string[],
  "analysisTone": string,
  "requiresSelectionCriteria": boolean,
  "coreCompetencies": string[],
  "extractedMetadata": {
    "company": string,
    "role": string
  },
  "rankedAchievements": [
    {
      "id": "achievementId",
      "relevanceScore": number,
      "reason": "1-sentence reason why this achievement proves fit for this JD"
    }
  ],
  "dimensions": {
    "roleMatch":           { "score": number, "note": string },
    "skillsAlignment":     { "score": number, "note": string },
    "seniorityFit":        { "score": number, "note": string },
    "compensation":        { "score": number, "note": string },
    "interviewLikelihood": { "score": number, "note": string },
    "geographicFit":       { "score": number, "note": string },
    "companyStage":        { "score": number, "note": string },
    "marketFit":           { "score": number, "note": string },
    "growthTrajectory":    { "score": number, "note": string },
    "timelineAlignment":   { "score": number, "note": string }
  },
  "matchedIdentityCard": string | null,
  "australianFlags": {
    "apsLevel": string | null,
    "requiresCitizenship": boolean,
    "securityClearanceRequired": "none" | "baseline" | "nv1" | "nv2" | "pv",
    "salaryType": "base" | "trp" | "unknown"
  }
}

You must respond with valid JSON only.
`;
```


## `server/src/services/prompts/selectionCriteriaPrompt.ts`

**Runtime status: LIVE**

```typescript
// =============================================================================
// SELECTION CRITERIA PROMPT — single capable-model pass, markdown output.
// =============================================================================

/**
 * SELECTION_CRITERIA_PROMPT — one Claude pass over the candidate's real resume,
 * the job, and the pasted criteria. Produces labelled STAR responses, one per
 * criterion, as clean markdown. No blueprint, no executor, no rules-file load:
 * the rules live here.
 *
 * Guiding principle: answer each criterion with the candidate's genuine
 * experience, in explicit STAR, within any stated word limit. Invent nothing.
 *
 * Output is markdown (SC responses are flowing prose, not a structured template),
 * rendered directly. The route strips em dashes as a final safety net.
 */
export const SELECTION_CRITERIA_PROMPT = (
    jd: string,
    profile: any,
    criteriaText: string,
): string => {
    const rawResume = (profile?.resumeRawText ?? '').trim();
    const candidateName = profile?.name ?? '';

    return `You are an expert Australian selection-criteria writer. Write the candidate's responses to the selection criteria below, using only their real experience.

==============================================================
THE CANDIDATE'S RESUME (the single source of truth)
==============================================================
${rawResume || `Name: ${candidateName}\nSummary: ${profile?.professionalSummary ?? ''}\nExperience: ${profile?.experience?.length ? JSON.stringify(profile.experience) : '(none)'}`}

==============================================================
THE JOB
==============================================================
${jd}

==============================================================
THE SELECTION CRITERIA TO ADDRESS
==============================================================
${criteriaText}

==============================================================
HOW TO WRITE IT
==============================================================
1. ONE RESPONSE PER CRITERION. Put the exact criterion text as a markdown heading ("## <criterion>"), then the response beneath it. Address every criterion. Never blend two criteria into one response.

2. EXPLICIT, LABELLED STAR. Structure each response as STAR with bold labels, each part on its own line:
   **S:** the situation, brief context (where, when, what organisation).
   **T:** the candidate's specific responsibility in that situation.
   **A:** what the candidate personally did, step by step. This is the longest part by far (about half the response). Use "I", never "we" or "the team".
   **R:** the outcome, quantified when the resume gives a number, otherwise the concrete result in plain words.

3. SOURCE OF TRUTH. Use only what is genuinely in the resume. Never invent an example, a metric, an employer, or a capability. If the candidate has no direct experience for a criterion, give the strongest HONEST transferable example and frame it as transferable, never as something they have not done; do not apologise and do not claim a status (visa, clearance, licence) that is not in the resume.

4. WORD LIMITS. If a criterion or the job states a word or page limit, stay within it; get as close as you sensibly can without padding and without cutting a sentence off. If no limit is stated, be brief and precise: aim for 200 to 350 words per criterion. Brevity and specifics beat length.

5. VOICE. First person, active voice, professional Australian English (organised, specialised, programme, behaviour). No em dashes or en dashes (use commas or full stops). No placeholders of any kind. No filler openers like "To address this criterion" or "I am a dedicated professional".

Output the finished responses as markdown only. No preamble, no closing note.`;
};
```


## `server/src/services/prompts/enrichmentPrompts.ts`

**Runtime status: LIVE**

```typescript
export function buildQuestionPrompt(input: {
  achievementTitle: string;
  achievementText: string;
  jobDescription: string;
}): string {
  return `You are helping a job seeker sharpen one specific achievement on their resume so it lands harder for a specific job description.

The achievement currently lacks a measurable result. Your job is to write ONE short natural-language question that asks the user for the missing numeric / quantitative detail. The question must:
- Be specific to the achievement (not generic "add a metric")
- Ask for a CONCRETE number, scope, or timeframe the user can answer in one sentence
- Be conversational, not clinical
- Be under 25 words
- Never invent or assume a number — only ask

ACHIEVEMENT TITLE: ${input.achievementTitle}
ACHIEVEMENT TEXT: ${input.achievementText}
JOB DESCRIPTION (excerpt): ${input.jobDescription.slice(0, 800)}

Output the question and nothing else. No preamble, no labels.`;
}

export function buildParseAnswerPrompt(input: {
  question: string;
  originalText: string;
  userAnswer: string;
}): string {
  return `A job seeker just answered a question about one of their achievements. Your job is to extract the structured metric from their natural-language answer and rewrite the achievement bullet to include it.

CRITICAL RULES:
- Use ONLY numbers, scopes, and facts the user provided. Never invent.
- If the user did not provide a usable number ("I dunno", "lots", "many"), return metric: null and rewrittenText: the original text unchanged.
- The rewritten bullet must be one line, start with an action verb, and include the user's number.
- Keep the user's voice and the original achievement's intent.

QUESTION ASKED: ${input.question}
ORIGINAL ACHIEVEMENT TEXT: ${input.originalText}
USER'S ANSWER: ${input.userAnswer}

Output ONLY valid JSON in this exact shape:
{
  "metric": "<one-line metric like 'from 4k to 22k in 6 months' or null>",
  "rewrittenText": "<the rewritten bullet>"
}`;
}
```
