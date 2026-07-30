/**
 * Step 1 of the /welcome intake: read the uploaded resume once and produce
 * everything the pre-signup flow needs — the warm prose read, plus the list of
 * questions only the candidate can answer.
 *
 * One LLM call, because the brief and the questions come from the same reading
 * of the resume. Splitting them doubles the cost and lets them disagree.
 *
 * The questions exist because of the split in how a resume gets fixed:
 *   - Things needing no input (photo, DOB, marital status, date formats, section
 *     order, duty-led bullets, AU spelling) are fixed silently in buildCleanResume.
 *   - Things only the candidate knows (the actual numbers, engagement type,
 *     what an unknown overseas employer does) get ASKED. Never guessed.
 */
import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { parseLLMJson } from '../utils/parseLLMResponse';
import { EVIDENCE_RULE } from './intakeEvidenceRule';

export interface IntakeQuestion {
  /** Stable id we key the answer off. */
  id: string;
  /** The exact line from their resume this question is about, quoted verbatim. */
  anchor: string;
  /** The question, in plain spoken English. */
  question: string;
  /** One line on why an Australian employer cares. Shown under the question. */
  why: string;
  /** A concrete example answer, so they know the shape expected. */
  example: string;
  /** 'number' gets the estimate-range helper; 'text' is free text. */
  kind: 'number' | 'text';
  /**
   * Coarse buckets offered when they say they don't know. Far easier to answer
   * than an open number box and still true. Empty for 'text' questions.
   */
  ranges: string[];
  /** Where to look it up, offered when they say they don't know. */
  hint: string;
}

export interface IntakeAnalysis {
  firstName: string;
  currentRole: string;
  brief: string;
  questions: IntakeQuestion[];
}

/** Hard ceiling. More than this and people abandon the flow. */
export const MAX_QUESTIONS = 8;

const PROMPT = (resumeText: string): string => `You are a warm, expert Australian career coach. A new client has just uploaded their resume. Your job is to read it once and return two things: a short honest read on where it stands, and the specific questions you need answered before you can rewrite it properly.

${EVIDENCE_RULE}

PART 1 — THE READ

2 or 3 short paragraphs of flowing prose. Plain sentences. NO bullet points, NO numbered lists, NO headings, NO score, NO percentages.

Name the two or three most important things holding this resume back in the Australian market. Real examples: bullets that describe duties instead of outcomes, missing keywords the automated screen looks for, formatting that breaks the six-second scan, unclear positioning, a photo or date of birth that Australian employers do not expect. Explain each as understanding, not as a verdict. Never imply a character flaw — "duty-led" is fine, "weak" is not.

Do NOT sell, pitch, mention price, or congratulate them on joining. Warm and direct, second person. Australian English. No em dashes or en dashes. 90 to 140 words.

End by telling them you need a few facts from them before you rewrite it.

PART 2 — THE QUESTIONS

Generate AT MOST ${MAX_QUESTIONS} questions. Fewer is better. Rank them by how much the answer would improve the resume, best first.

Ask ONLY for things the candidate alone can tell you:
- the missing number on a bullet that describes real work but has no scale or result
- whether a role was full-time, part-time, casual, contract or an internship, where the resume does not say
- what an employer actually does, when the employer is not known in Australia
- team size, budget, or the scope they were personally responsible for
- what measurably changed because of something they did

Do NOT ask for:
- anything already stated anywhere in the resume
- their opinion, their goals, their target roles, their strengths, or what they want next
- anything you could fix yourself without asking (spelling, tense, date format, ordering, phrasing)
- more than 2 questions about the same job

Each question must:
- quote in "anchor" the EXACT line from their resume it refers to, copied character for character so we can show it to them
- be one sentence a person would actually say out loud, naming the employer where it helps ("At Coles, roughly how many customers did you serve in a normal shift?")
- carry a "why" of at most 15 words on what it changes for an Australian employer
- carry an "example" showing the shape of a good answer, not a real figure from their resume
- carry a "hint" naming where they could look it up (an old payslip, a rostering app, a sent email, the original job ad, a former manager they could text)
- for "kind": use "number" if the answer is a quantity, otherwise "text"
- for "number" questions, give 4 ascending "ranges" as plain labels they could pick instead of an exact figure, e.g. ["under 20", "20 to 50", "50 to 100", "100+"]. Choose buckets that suit that specific question. For "text" questions return an empty array.

Return ONLY this JSON object and nothing else:
{
  "firstName": "their first name, or an empty string if unclear",
  "currentRole": "their current or most recent job title in plain title case, or an empty string if unclear",
  "brief": "the prose read, one string, \\n\\n between paragraphs",
  "questions": [
    { "id": "q1", "anchor": "...", "question": "...", "why": "...", "example": "...", "kind": "number", "ranges": ["...","...","...","..."], "hint": "..." }
  ]
}

RESUME:
"""
${resumeText}
"""`;

/** Coerce whatever the model returned into a safe, bounded question list. */
function normaliseQuestions(raw: unknown): IntakeQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: IntakeQuestion[] = [];
  for (const [i, q] of raw.entries()) {
    if (!q || typeof q !== 'object') continue;
    const question = String((q as any).question ?? '').trim();
    if (!question) continue;
    const kind = (q as any).kind === 'number' ? 'number' : 'text';
    out.push({
      id: String((q as any).id ?? '').trim() || `q${i + 1}`,
      anchor: String((q as any).anchor ?? '').trim(),
      question,
      why: String((q as any).why ?? '').trim(),
      example: String((q as any).example ?? '').trim(),
      kind,
      ranges:
        kind === 'number' && Array.isArray((q as any).ranges)
          ? (q as any).ranges.map((r: unknown) => String(r).trim()).filter(Boolean).slice(0, 4)
          : [],
      hint: String((q as any).hint ?? '').trim(),
    });
    if (out.length >= MAX_QUESTIONS) break;
  }
  return out;
}

export async function analyseIntakeResume(resumeText: string): Promise<IntakeAnalysis> {
  const raw = await callLLMWithRetry(PROMPT(resumeText), true, 3, 0.4);
  const parsed = typeof raw === 'string' ? parseLLMJson(raw) : raw;

  const brief = String(parsed?.brief ?? '').trim();
  if (!brief) throw new Error('intakeAnalysis: model returned no brief');

  return {
    firstName: String(parsed?.firstName ?? '').trim(),
    currentRole: String(parsed?.currentRole ?? '').trim(),
    brief,
    questions: normaliseQuestions(parsed?.questions),
  };
}
