import { callClaude } from './llm';

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

export interface CvGapResult {
  score: number;          // integer 0–100
  inferredRole: string;   // e.g. "Data Analyst (mid-level)" — shown for transparency
  firstName: string;      // extracted from resume header — "" if not clearly present
  fullName: string;       // extracted from resume header — "" if not clearly present
  items: CvGapItem[];     // 4–5 items, at least 1 'good', ordered most→least severe
  quickWins: QuickWin[];  // 2 immediate, actionable wins
}

// ── LLM response shape ───────────────────────────────────────────────────────

interface LlmResponse {
  inferredRole: string;
  firstName: string;
  fullName: string;
  expectedKeywords: string[];
  presentKeywords: string[];
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

function buildPrompt(resumeText: string, signals: DeterministicSignals): string {
  return `You are a senior Australian recruiter doing a fast first-scan of a CV.

THE 6-SECOND RULE: Your reader has 6 seconds and no patience. Every \`text\` is a tight VERDICT of ≤64 characters, one line, no trailing period — a fact about THIS resume they can read at a glance. Not advice. Not a sentence with a recommendation. A verdict.

GOOD \`text\`: \`Opening bullet leads with a duty, not an outcome\` · \`No quantified result in your last 2 roles\` · \`Strong, specific job titles — keep these\`
BAD \`text\`: \`You should add more quantifiable achievements to show impact\` (advice + too long) · \`Your resume could be improved by tailoring it\` (generic)

\`text\` vs \`evidence\`: \`text\` is the short verdict shown to the user. \`evidence\` is the real snippet from THIS resume that proves the verdict — a literal substring of the resume for any non-good item. The user never sees \`evidence\`; it exists so we can prove the verdict is real.

BANNED generic outputs — never produce as \`text\`: 'add quantifiable achievements', 'use strong action verbs', 'tailor your resume to the role', 'improve formatting', or anything that would apply to every resume on earth. If your verdict would be true of most resumes, delete it.

BANNED topics entirely (never mention in items or quickWins): visa status, visa sponsorship, visa anything. That information belongs in the cover letter or interview stage, not the CV or scan results.

Never exceed 64 characters in \`text\`. Count them.

Items: produce 4–5. At least one \`severity:'good'\` that names a real strength from their resume. Order by severity.

\`quickWins\`: produce exactly 2 immediate, actionable wins. Each has a short \`heading\` (≤40 chars, no period) and a \`description\` (a sentence that explains what to do and why, ≤120 chars, no period). One win is a quick CV fix they can do in 5 minutes (e.g., reword an opening bullet, add a quantified result they already have), the other is an Australian hiring strategy insight (e.g., tailoring for the STAR format Aussie gov roles expect).

BANNED from quickWins: never mention visa status, visa sponsorship, or visa anything. That belongs in the cover letter or interview stage, not the CV. If your win would involve visa advice, delete it and pick something else.

\`firstName\` / \`fullName\`: extract from the resume's header/contact block. If a real human name is not clearly present, return "" for both. NEVER guess or invent a name.

\`inferredRole\`: infer the single most likely target role + level from the resume's trajectory; format like "Data Analyst (mid-level)".
\`expectedKeywords\`: 6–10 keywords a typical Australian JD for \`inferredRole\` expects.
\`presentKeywords\`: which of those literally appear in the resume text (case-insensitive).

Computed signals from this resume (for context — align your commentary with these facts):
- Bullet lines found: ${signals.bulletCount}
- Quantification ratio (fraction of bullets with digits/%/$/quant-words): ${signals.quantificationRatio.toFixed(2)}
- Duty-like openings (bullets starting with "responsible for", "worked on", etc.): ${signals.dutyOpeningCount}

Resume text:
${resumeText}

Return ONLY the JSON object. No markdown, no prose:
{
  "inferredRole": string,
  "firstName": string,
  "fullName": string,
  "expectedKeywords": string[],
  "presentKeywords": string[],
  "items": [{ "severity": "critical"|"warning"|"good", "text": string, "evidence": string }],
  "quickWins": [{ "heading": string, "description": string }]
}`;
}

async function callLlmForScan(resumeText: string, signals: DeterministicSignals): Promise<LlmResponse> {
  const prompt = buildPrompt(resumeText, signals);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { content } = await callClaude(prompt, true);
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
      evidence: 'No specific issue found — resume passes structural scan',
    });
  }

  // Order: critical → warning → good
  const order = { critical: 0, warning: 1, good: 2 };
  items.sort((a, b) => order[a.severity] - order[b.severity]);

  // Ensure exactly 2 quick wins, cap heading/description length
  const safeWins = (quickWins || []).slice(0, 2).map(w => ({
    heading: w.heading.substring(0, 40),
    description: w.description.substring(0, 120),
  }));
  while (safeWins.length < 2) {
    safeWins.push({
      heading: 'Review your resume structure',
      description: 'A clean layout with consistent formatting helps recruiters find key information fast',
    });
  }

  return { score, inferredRole, firstName, fullName, items, quickWins: safeWins };
}

// ── §D – Roadmap generation ──────────────────────────────────────────────────

export interface RoadmapStep {
  rank: number;        // 1 = highest leverage
  title: string;       // ≤ 60 chars, imperative — "Rewrite your opening bullet"
  why: string;         // ≤ 140 chars — the concrete payoff
}

function buildRoadmapPrompt(resumeText: string, firstName: string): string {
  return `You are a senior Australian recruiter. Produce a prioritised, specific action plan to fix this resume.

Produce exactly 7 prioritised, specific action steps to fix this resume, ranked 1 (highest leverage) to 7.

Each \`title\` ≤60 characters, imperative mood — "Rewrite your opening bullet", "Add quantified results to your last role". Each \`why\` ≤140 characters — names the concrete payoff (more callbacks, passes ATS, recruiter stops scrolling).

Grounded + specific — reference real elements of THIS resume. Same banned-generic rules and no-visa-talk rule as the base scan prompt.

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
      const { content } = await callClaude(prompt, true);
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
        title: s.title?.substring(0, 60) ?? '',
        why: s.why?.substring(0, 140) ?? '',
      }));
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[cvGapScan] Roadmap LLM call/parse attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  throw lastError || new Error('Roadmap generation failed after 2 attempts');
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function runCvGapScan(resumeText: string): Promise<CvGapResult> {
  const signals = computeSignals(resumeText);
  const llm = await callLlmForScan(resumeText, signals);
  const score = computeScore(signals, llm.expectedKeywords.length, llm.presentKeywords.length);
  return assembleResult(score, llm.inferredRole, llm.firstName ?? '', llm.fullName ?? '', llm.items, llm.expectedKeywords, llm.presentKeywords, llm.quickWins);
}
