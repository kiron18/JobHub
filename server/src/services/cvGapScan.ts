import { callClaude, PREMIUM_MODEL } from './llm';
import type { AtsStructure } from '../lib/atsStructure';

// ── Exported types (frozen — do not change shape) ────────────────────────────

export interface CvGapItem {
  severity: 'critical' | 'warning' | 'good';
  text: string;     // DISPLAYED. Tight verdict, ≤64 chars, one line, no trailing period.
  evidence: string; // HIDDEN. The real resume snippet/element this verdict is based on.
                    // Used for accuracy eval + future expansion. Never rendered in the card.
}

export interface QuickWin {
  heading: string;  // e.g. "Reword your opening bullet"
  description: string; // e.g. "Change 'Responsible for...' to 'Delivered...' — action-oriented openings get read."
}

// ── WOW-reveal narrative layer (additive, optional) ──────────────────────────
// The "calm friend who works in Australian HR" voice rendered by the full-screen
// scan reveal. Understanding + hope, not metrics.

export interface HiringManager {
  name: string;       // friendly persona first name, e.g. "Sarah"
  archetype: string;  // personalised to the candidate, e.g. "a hiring manager at a Melbourne fintech"
  view: string;       // 1–2 sentences: what she actually thinks reading THIS resume. Calm, specific, insider.
}

export interface CulturalTranslation {
  wrote: string;     // a real phrase from THIS resume, e.g. "Responsible for the social media accounts"
  reads: string;     // how an Australian hiring manager actually hears it
  instead: string;   // the reframe that lands here
}

export interface CvGapResult {
  score: number;          // integer 0–100 (kept for internal logic; NOT shown in the reveal)
  firstImpression?: string;   // qualitative verdict replacing the number, ≤48 chars, e.g. "Easy to overlook"
  inferredRole: string;   // e.g. "Data Analyst (mid-level)" — shown for transparency
  firstName: string;      // extracted from resume header — "" if not clearly present
  fullName: string;       // extracted from resume header — "" if not clearly present
  reassurance?: string;                          // the relief beat — calm authority, ≤200 chars
  hiringManager?: HiringManager;                 // the insider-POV beat
  culturalTranslations?: CulturalTranslation[];  // 1–2, grounded in real resume phrases
  items: CvGapItem[];     // 4–5 items, at least 1 'good', ordered most→least severe
  quickWins: QuickWin[];  // 2 immediate, actionable wins
}

// ── LLM response shape ───────────────────────────────────────────────────────

interface LlmResponse {
  inferredRole: string;
  firstName: string;
  fullName: string;
  firstImpression: string;
  reassurance: string;
  hiringManager: { name: string; archetype: string; view: string };
  culturalTranslations: { wrote: string; reads: string; instead: string }[];
  expectedKeywords: string[];
  items: { severity: 'critical' | 'warning' | 'good'; text: string; evidence: string }[];
  quickWins: { heading: string; description: string }[];
}

// ── Step 1 – deterministic signals ───────────────────────────────────────────

const BULLET_STARTS = new Set(['-', '•', '*', '·', '•']);
const QUANT_WORDS = new Set(['reduced', 'increased', 'grew', 'cut', 'saved', 'doubled', 'tripled']);
const DUTY_OPENINGS = [
  'responsible for', 'worked on', 'helped', 'assisted',
  'duties included', 'tasked with', 'participated in',
];

// Trim to a word boundary at a generous cap so a heading, title, or description
// is never chopped off mid-word. Shared by the quick wins and the roadmap.
function clampWords(s: string, max: number): string {
  const t = (s || '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

export function splitBulletLines(text: string): string[] {
  const lines = text.split('\n');
  return lines
    .map(l => l.trim())
    .filter(l => l.length > 0 && BULLET_STARTS.has(l[0]));
}

export function quantificationRatio(bullets: string[]): number {
  if (bullets.length === 0) return 0;
  const count = bullets.filter(b => {
    // Has a digit
    if (/\d/.test(b)) return true;
    // Has % or $
    if (/%|\$/.test(b)) return true;
    // Has a quant word (case-insensitive)
    const lower = b.toLowerCase();
    for (const w of QUANT_WORDS) {
      if (lower.includes(w)) return true;
    }
    return false;
  }).length;
  return count / bullets.length;
}

export function dutyOpeningCount(bullets: string[]): number {
  return bullets.filter(b => {
    const lower = b.toLowerCase().trim();
    return DUTY_OPENINGS.some(prefix => lower.startsWith(prefix));
  }).length;
}

export interface DeterministicSignals {
  bulletCount: number;
  quantificationRatio: number;
  dutyOpeningCount: number;
}

function computeSignals(resumeText: string): DeterministicSignals {
  const bullets = splitBulletLines(resumeText);
  return {
    bulletCount: bullets.length,
    quantificationRatio: quantificationRatio(bullets),
    dutyOpeningCount: dutyOpeningCount(bullets),
  };
}

// ── Step 2 – LLM call ────────────────────────────────────────────────────────

// The instruction block is byte-for-byte identical on every scan, so it is sent
// as a cacheable system prefix (see callClaude's `cachedSystem`). Keep it free of
// any per-resume data — the moment a resume leaks in here, the cache stops hitting.
function buildScanInstructions(): string {
  return `You are a senior Australian recruiter doing a fast first-scan of a CV.

PUNCTUATION RULE (absolute): NEVER use an em dash (—) or en dash (–) anywhere in any string you output. They are banned. Use a comma, a full stop, a colon, or the word "and" instead. This applies to every field without exception.

AUSTRALIAN RESUME CONVENTION (absolute): a referees section, or the line "References available on request", is standard and expected on an Australian resume. NEVER flag, criticise, or advise removing the referees or references section, and never call it outdated, filler, or a waste of space. It is correct local practice, not a problem.

THE 6-SECOND RULE: Your reader has 6 seconds and no patience. Every \`text\` is a tight VERDICT of ≤64 characters, one line, no trailing period: a fact about THIS resume they can read at a glance. Not advice. Not a sentence with a recommendation. A verdict.

GOOD \`text\`: \`Opening bullet leads with a duty, not an outcome\` · \`No quantified result in your last 2 roles\` · \`Strong, specific job titles, keep these\`
BAD \`text\`: \`You should add more quantifiable achievements to show impact\` (advice + too long) · \`Your resume could be improved by tailoring it\` (generic)

VOICE — DIRECT AND PLAIN (absolute): State the flaw straight. No clever wordplay, no cute metaphors, no "quotable" one-liners, no fortune-cookie phrasing. You are a blunt expert telling a friend the truth, not a copywriter being clever. "Built in text boxes the ATS cannot read" is right. "Polished design the ATS silently drops" is WRONG, it is trying to sound clever instead of being clear. This applies to every string in every field.

NO HEDGING (absolute): state every verdict as a hard fact, never as a possibility. BANNED words and softeners: "likely", "may", "might", "could", "possibly", "probably", "tends to", "can be", "a bit", "slightly", "somewhat", "often". "The ATS rejects this format" is right. "This format is likely auto-rejected" is WRONG. Say what IS, not what might be. Be brutally honest, never abusive: name the real consequence plainly so the person feels the mistake and wants to fix it, but never insult the person or call their work worthless. The flaw is in the document, not in them.

\`text\` vs \`evidence\`: \`text\` is the short verdict shown to the user. \`evidence\` is the real snippet from THIS resume that proves the verdict, a literal substring of the resume for any non-good item. The user never sees \`evidence\`; it exists so we can prove the verdict is real.

BANNED generic outputs, never produce as \`text\`: 'add quantifiable achievements', 'use strong action verbs', 'tailor your resume to the role', 'improve formatting', or anything that would apply to every resume on earth. If your verdict would be true of most resumes, delete it.

BANNED topics entirely (never mention in items or quickWins): visa status, visa sponsorship, visa anything. That information belongs in the cover letter or interview stage, not the CV or scan results.

Never exceed 64 characters in \`text\`. Count them.

Items: produce 4 to 5. At least one \`severity:'good'\` that names a real strength from their resume. Order by severity.

\`quickWins\`: produce exactly 2 immediate, actionable wins. Each has a short \`heading\` (a complete imperative phrase, ≤70 chars, no period, never cut off mid-word) and a \`description\` (one complete sentence that explains what to do and why, ≤180 chars, no period). One win is a quick CV fix they can do in 5 minutes (e.g., reword an opening bullet, add a quantified result they already have), the other is an Australian hiring strategy insight (e.g., tailoring for the STAR format Aussie gov roles expect). Write each heading and description as a finished thought — never trail off.

── DOCUMENT STRUCTURE / ATS PARSING (this is high priority) ──
The user input includes a "Document structure" note describing how this file parses for an applicant tracking system. When that note lists one or more parsing problems (text boxes, tables, images, layout that does not read top to bottom), this is the MOST important thing to tell them, stated plainly and without sugar-coating: an ATS cannot read this resume, so no human ever sees it, no matter how good the content is. This is the costliest mistake on the page, so hit it hard. You MUST:
- make it the FIRST \`item\`, severity 'critical', \`text\` a hard verdict of the real problem (≤64 chars), e.g. "Built in text boxes the ATS cannot read", "Tables and graphics stop the ATS reading it", or "The ATS auto-rejects this format", with \`evidence\` quoting the structure note;
- set \`firstImpression\` to a hard, unhedged verdict, e.g. "Your resume fails the ATS, no one sees it" (a blunt fact, never "likely", "may", or "probably");
- write \`hiringManager.view\` as the plain mechanics: the ATS scores a resume it cannot parse near zero and filters it out, so the manager never receives it. Name the specific cause (text boxes / tables / images) and say the fix is a simple, consistent single-column format that both the software and a person can read top to bottom. Empathetic, never blame.
- make ONE \`quickWin\` about rebuilding it as a clean single-column, ATS-safe layout (no text boxes, tables, or graphics), naming the payoff plainly: it actually reaches a human.
When the structure note says the file parses cleanly, do NOT invent a format problem.

BANNED from quickWins: never mention visa status, visa sponsorship, or visa anything. That belongs in the cover letter or interview stage, not the CV. If your win would involve visa advice, delete it and pick something else.

── THE INSIDER LAYER (this is what makes the scan feel like a friend in HR, not a tool) ──
Beyond the verdicts, write a short narrative layer in ONE voice: a calm, experienced friend who works in Australian HR and is finally explaining what is really going on behind the glass. Warm, direct, never lecturing or shaming. Specific to THIS resume and this person's likely field and city. The feeling to leave them with is understanding + hope, never a grade. Same banned-generic and absolutely-no-visa rules apply to every field below.

\`firstImpression\`: a blunt, direct read of the resume's 6-second first impression, stated as a hard fact the reader feels in the gut. NOT a number, NOT a grade, NOT a percentage, NOT hedged. Name what it is costing them. ≤48 characters, no trailing period. e.g. "Easy to overlook in a stack of 80", "Competent but forgettable", "Your best work is buried on page two".

\`reassurance\`: the relief line. Land hard that this is NOT about being unqualified; it is about never being taught the local rules. ≤200 characters, calm authority. e.g. "This isn't your fault. Your experience is real, it's just written in a dialect Australian employers don't read. That's fixable, and it's not a talent problem."

\`hiringManager\`: put the reader on the OTHER side of the desk. Infer a plausible Australian hiring manager for this person's field and most likely city (read both from the resume). Give them a common Anglo-Australian first \`name\`, and alternate gender evenly — pick a man's name as readily as a woman's, and do NOT default to a woman. Men's pool: James, Tom, Mark, Andrew, Daniel, Luke, Matt, Scott. Women's pool: Sarah, Emma, Hannah, Lucy, Claire, Kate, Rachel, Megan. Never use a name that signals a specific ethnic background, an \`archetype\` like "a hiring manager at a Melbourne fintech" or "a recruiter for NSW government roles", and a \`view\`: 1 to 2 sentences of exactly what that person thinks in the first few seconds reading THIS resume. Specific, insider, a little uncomfortable, never cruel. Reference something real from the resume.

\`culturalTranslations\`: 1 to 2 entries, the most "insider" part. Take a REAL phrase the candidate actually wrote (\`wrote\`: a literal or near-literal snippet from the resume, especially duty-openings like "responsible for"), explain how an Australian hiring manager actually hears it (\`reads\`: the honest, unflattering subtext), then the reframe that lands here (\`instead\`). Make it feel like access nobody ever gave them. If the resume genuinely contains no such phrase, return an empty array.

\`firstName\` / \`fullName\`: extract from the resume's header/contact block. If a real human name is not clearly present, return "" for both. NEVER guess or invent a name.

\`inferredRole\`: infer the single most likely target role + level from the resume's trajectory; format like "Data Analyst (mid-level)".
\`expectedKeywords\`: 6 to 10 keywords a typical Australian JD for \`inferredRole\` expects.

Return ONLY the JSON object. No markdown, no prose:
{
  "inferredRole": string,
  "firstName": string,
  "fullName": string,
  "firstImpression": string,
  "reassurance": string,
  "hiringManager": { "name": string, "archetype": string, "view": string },
  "culturalTranslations": [{ "wrote": string, "reads": string, "instead": string }],
  "expectedKeywords": string[],
  "items": [{ "severity": "critical"|"warning"|"good", "text": string, "evidence": string }],
  "quickWins": [{ "heading": string, "description": string }]
}`;
}

// The only part that changes between scans — sent as the user message so the
// instruction prefix above stays cacheable.
function buildScanInput(resumeText: string, signals: DeterministicSignals, ats?: AtsStructure): string {
  const structureNote = ats && ats.risk
    ? ats.reasons.map(r => `- ${r}`).join('\n')
    : '- Parses cleanly: standard single-column layout, no text boxes, tables, or graphics blocking the text.';

  return `Computed signals from this resume (for context, align your commentary with these facts):
- Bullet lines found: ${signals.bulletCount}
- Quantification ratio (fraction of bullets with digits/%/$/quant-words): ${signals.quantificationRatio.toFixed(2)}
- Duty-like openings (bullets starting with "responsible for", "worked on", etc.): ${signals.dutyOpeningCount}

Document structure (how this file parses for an ATS):
${structureNote}

Resume text:
${resumeText}`;
}

// Deterministic keyword presence: which expected keywords literally appear in the
// resume (case-insensitive). Replaces asking the LLM to echo this back — it cost
// output tokens on the hot path and the model occasionally returned keywords that
// weren't actually present. Computing it here is faster and provably correct.
export function matchPresentKeywords(resumeText: string, expectedKeywords: string[]): string[] {
  const hay = resumeText.toLowerCase();
  return expectedKeywords.filter(k => {
    const needle = k?.toLowerCase().trim();
    return needle ? hay.includes(needle) : false;
  });
}

async function callLlmForScan(resumeText: string, signals: DeterministicSignals, ats?: AtsStructure): Promise<LlmResponse> {
  const instructions = buildScanInstructions();
  const input = buildScanInput(resumeText, signals, ats);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { content } = await callClaude(input, true, instructions, PREMIUM_MODEL);
      // Strip markdown code fences if the LLM wraps JSON in ```json ... ```
      const cleaned = content.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
      if (!cleaned.startsWith('{')) {
        throw new Error(`LLM response is not JSON: ${cleaned.substring(0, 200)}`);
      }
      const parsed: LlmResponse = JSON.parse(cleaned);
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[cvGapScan] LLM call/parse attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  throw lastError || new Error('LLM call failed after 2 attempts');
}

// ── Step 3 – deterministic scoring rubric ────────────────────────────────────

function computeScore(signals: DeterministicSignals, expectedCount: number, presentCount: number): number {
  let score = 100;

  // Quantification ratio
  if (signals.quantificationRatio < 0.34) {
    score -= 22;
  } else if (signals.quantificationRatio < 0.67) {
    score -= 10;
  }

  // Duty openings
  if (signals.dutyOpeningCount >= 3) {
    score -= 18;
  } else if (signals.dutyOpeningCount >= 1) {
    score -= 8;
  }

  // Missing keywords
  const missing = Math.max(0, expectedCount - presentCount);
  score -= Math.min(missing, 5) * 4;

  // Resume too thin
  if (signals.bulletCount < 6) {
    score -= 8;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ── Step 4 – assemble result ─────────────────────────────────────────────────

function assembleResult(
  score: number,
  inferredRole: string,
  firstName: string,
  fullName: string,
  llmItems: { severity: 'critical' | 'warning' | 'good'; text: string; evidence: string }[],
  expectedKeywords: string[],
  presentKeywords: string[],
  quickWins: { heading: string; description: string }[],
  narrative: {
    firstImpression?: string;
    reassurance?: string;
    hiringManager?: { name: string; archetype: string; view: string };
    culturalTranslations?: { wrote: string; reads: string; instead: string }[];
  },
): CvGapResult {
  let items: CvGapItem[] = llmItems as CvGapItem[];

  // Ensure a keyword item exists if keywords are missing
  const missing = Math.max(0, expectedKeywords.length - presentKeywords.length);
  if (missing > 0) {
    const text = `Missing ${missing} of ${expectedKeywords.length} keywords the ATS usually filters for this role`;
    // text is 42 chars at <10 expectedKeywords — still ≤64
    items.unshift({
      severity: 'warning',
      text,
      evidence: `Expected for ${inferredRole}: ${expectedKeywords.join(', ')}`,
    });
  }

  // Cap to 5 items
  if (items.length > 5) {
    items = items.slice(0, 5);
  }

  // Drop items whose text exceeds 64 chars (truncate-by-dropping)
  items = items.filter(i => i.text.length <= 64);

  // Ensure at least one 'good' item
  if (!items.some(i => i.severity === 'good')) {
    items.push({
      severity: 'good',
      text: 'Clear, well-structured resume format',
      evidence: 'No specific issue found, resume passes structural scan',
    });
  }

  // Order: critical → warning → good
  const order = { critical: 0, warning: 1, good: 2 };
  items.sort((a, b) => order[a.severity] - order[b.severity]);

  // Ensure exactly 2 quick wins. Generous word-safe caps (see clampWords).
  const safeWins = (quickWins || []).slice(0, 2).map(w => ({
    heading: clampWords(w.heading, 80),
    description: clampWords(w.description, 200),
  }));
  while (safeWins.length < 2) {
    safeWins.push({
      heading: 'Review your resume structure',
      description: 'A clean layout with consistent formatting helps recruiters find key information fast',
    });
  }

  // Narrative layer — always populated so the reveal never renders an empty beat.
  const hm = narrative.hiringManager;
  return {
    score,
    inferredRole,
    firstName,
    fullName,
    items,
    quickWins: safeWins,
    firstImpression: (narrative.firstImpression || '').trim().slice(0, 48) || 'Easy to overlook',
    reassurance: (narrative.reassurance || '').trim()
      || "This isn't your fault. Your experience is real, it's just written in a dialect Australian employers don't read yet. That's a fixable problem, not a talent one.",
    hiringManager: hm && hm.view && hm.view.trim()
      ? { name: hm.name || 'Sarah', archetype: hm.archetype || 'an Australian hiring manager', view: hm.view }
      : {
          name: 'Sarah',
          archetype: inferredRole ? `a hiring manager hiring for ${inferredRole}` : 'an Australian hiring manager',
          view: 'She scans the top third in seconds, hunting for a clear, outcome-led story, and right now it takes too long to find what you actually delivered.',
        },
    culturalTranslations: Array.isArray(narrative.culturalTranslations)
      ? narrative.culturalTranslations.filter(t => t && t.wrote && t.instead).slice(0, 2)
      : [],
  };
}

// ── §D – Roadmap generation ──────────────────────────────────────────────────

export interface RoadmapStep {
  rank: number;        // 1 = highest leverage
  title: string;       // ≤ 60 chars, imperative — "Rewrite your opening bullet"
  why: string;         // ≤ 140 chars — the concrete payoff
}

function buildRoadmapPrompt(resumeText: string, firstName: string): string {
  return `You are a senior Australian recruiter. Produce a prioritised, specific action plan to fix this resume.

PUNCTUATION RULE (absolute): NEVER use an em dash (—) or en dash (–) anywhere in any string you output. They are banned. Use a comma, a full stop, a colon, or the word "and" instead.

Produce exactly 7 prioritised, specific action steps to fix this resume, ranked 1 (highest leverage) to 7.

Each \`title\` is a COMPLETE imperative phrase, ≤80 characters, never cut off mid-word, e.g. "Move your Professional Profile to the top", "Add a quantified result to your last role". Each \`why\` is one complete sentence ≤180 characters naming the concrete payoff (more callbacks, passes ATS, recruiter stops scrolling). Write both as finished thoughts — never trail off.

Grounded and specific: reference real elements of THIS resume. Same banned-generic rules and no-visa-talk rule as the base scan prompt.

AUSTRALIAN RESUME CONVENTION (absolute): a referees section, or the line "References available on request", is standard and expected on an Australian resume. NEVER make a step about removing, deleting, or cutting the referees or references section, and never call it outdated, filler, or a waste of space. That advice is wrong for the Australian market.

Sequenced so ${firstName || 'they'} knows exactly what to do first. Accountable tone: numbered, concrete, this-week-able.

Resume text:
${resumeText}

Return ONLY the JSON object. No markdown, no prose:
{
  "roadmap": [{ "rank": number, "title": string, "why": string }]
}`;
}

export async function runRoadmap(resumeText: string, firstName: string): Promise<RoadmapStep[]> {
  const prompt = buildRoadmapPrompt(resumeText, firstName);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { content } = await callClaude(prompt, true, undefined, PREMIUM_MODEL);
      const cleaned = content.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
      if (!cleaned.startsWith('{')) {
        throw new Error(`LLM response is not JSON: ${cleaned.substring(0, 200)}`);
      }
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed.roadmap) || parsed.roadmap.length < 7) {
        throw new Error(`Expected 7 roadmap items, got ${parsed.roadmap?.length ?? 0}`);
      }
      return parsed.roadmap.slice(0, 7).map((s: any) => ({
        rank: s.rank,
        title: clampWords(s.title ?? '', 90),
        why: clampWords(s.why ?? '', 200),
      }));
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[cvGapScan] Roadmap LLM call/parse attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  throw lastError || new Error('Roadmap generation failed after 2 attempts');
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function runCvGapScan(resumeText: string, ats?: AtsStructure): Promise<CvGapResult> {
  const signals = computeSignals(resumeText);
  const llm = await callLlmForScan(resumeText, signals, ats);
  const presentKeywords = matchPresentKeywords(resumeText, llm.expectedKeywords ?? []);
  const score = computeScore(signals, llm.expectedKeywords.length, presentKeywords.length);
  return assembleResult(
    score, llm.inferredRole, llm.firstName ?? '', llm.fullName ?? '', llm.items,
    llm.expectedKeywords, presentKeywords, llm.quickWins,
    {
      firstImpression: llm.firstImpression,
      reassurance: llm.reassurance,
      hiringManager: llm.hiringManager,
      culturalTranslations: llm.culturalTranslations,
    },
  );
}
