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
import { callLLMWithDocument } from './llm';
import { parseLLMJson } from '../utils/parseLLMResponse';
import { EVIDENCE_RULE } from './intakeEvidenceRule';
import { DocumentSignals, describeSignals } from './documentSignals';
import { DocxStructure, describeDocxStructure } from './docxStructure';
import { MustKeep } from './retentionGate';

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

/**
 * Who has to act. This is the primary grouping in the UI, deliberately chosen
 * over severity: severity ranks pain but says nothing about what happens next,
 * and a list headed "minor" just gets skipped. Grouping by ownership does the
 * reassurance structurally - most items land under "we fix this", so the
 * candidate sees they are not being handed homework.
 */
export type FindingOwner =
  /** Fixable from the document alone. Shown pre-ticked: already handled. */
  | 'we_fix'
  /** Needs a fact only the candidate has. These become the questions. */
  | 'needs_you'
  /** Neither of us can fix quickly - context, not a task. */
  | 'worth_knowing';

/** One defect found in the resume. The brief names the worst few; this is all of them. */
export interface IntakeFinding {
  /** Short label, e.g. "Photo on the resume". */
  title: string;
  /** One sentence on what it costs them. */
  detail: string;
  /** Drives grouping in the checklist. */
  owner: FindingOwner;
  /** Sort key within a group. critical = stops the resume being read at all. */
  severity: 'critical' | 'important' | 'minor';
}

export interface IntakeAnalysis {
  firstName: string;
  currentRole: string;
  brief: string;
  findings: IntakeFinding[];
  /**
   * What the resume already does well. This exists to remove the incentive to
   * fabricate: with problems as the only output slot, a genuinely good resume
   * creates pressure to invent flaws to fill the screen. Given somewhere honest
   * to put praise, the model stops padding.
   */
  strengths: string[];
  /**
   * The inventory the retention gate verifies against. The model only LISTS what
   * must survive; deterministic code does the checking. It never decides whether
   * something may be dropped, so an incomplete list means we check less - it can
   * never cause loss.
   */
  mustKeep: MustKeep;
  questions: IntakeQuestion[];
}

/** Hard ceiling. More than this and people abandon the flow. */
export const MAX_QUESTIONS = 8;

/**
 * This one call returns the prose read, an intentionally uncapped list of every
 * flaw found, AND up to 8 anchored questions. The default 8192 truncated the
 * JSON mid-object the moment the findings list got long, which surfaced as
 * "LLM returned unparseable response".
 */
const ANALYSIS_MAX_TOKENS = 16000;

const PROMPT = (
  resumeText: string,
  signals: string,
  hasDocument: boolean,
  structure: string,
): string => `You are a warm, expert Australian career coach. A new client has just uploaded their resume. Your job is to read it once and return two things: a short honest read on where it stands, and the specific questions you need answered before you can rewrite it properly.

${EVIDENCE_RULE}
${signals ? `\n${signals}\n` : ''}
PART 1 — THE READ

${hasDocument
  ? `You are looking at the candidate's actual resume document, exactly as an Australian recruiter would open it. Judge everything you can see, not only the words: the photo, the layout and column structure, tables and text boxes, colour, fonts, spacing and density, margins, page count, headers and footers, graphics, charts, rating bars, anything that would fail an automated screen or waste the six-second human scan. Then judge the writing.`
  : structure
    ? `You have the candidate's resume as structure, not as a picture. Judge everything the structure shows — tables and what depends on them, heading levels, list structure, emphasis, where images sit — and then judge the writing. Be precise about the limits of what you were given: say nothing about fonts, colours, margins, columns or page count, because you genuinely cannot see them.`
    : `You have the candidate's resume as plain text only, with all structure and appearance stripped out. Judge the writing, the content and the ordering. Say nothing about photos, tables, layout, fonts, colour or page count — you cannot see any of it, and guessing would be worse than staying silent.`}

Do not work from a checklist, and do not limit yourself to problems anyone anticipated. Look at this specific document and say what is actually wrong with it. If the most serious problem is something unusual — three pages of dense grey text, a header the ATS will silently drop, a skills chart that conveys nothing, an obviously wrong date, a job that stops mid-sentence — that is the thing to name.

2 or 3 short paragraphs of flowing prose. Plain sentences. NO bullet points, NO numbered lists, NO headings, NO score, NO percentages.

Name the two or three MOST SERIOUS problems, worst first, ranked by what actually costs this person interviews. Explain each as understanding, not as a verdict. Never imply a character flaw — "duty-led" is fine, "weak" is not.

Rank by impact, and be honest about the ordering. Something visible before a single word is read — a photo, a layout that breaks the screen, three pages where one was needed — outranks any individual bullet's phrasing, because it costs them the resume being read at all. Say plainly what it is, that we will fix it, and why that helps them.

Do NOT sell, pitch, mention price, or congratulate them on joining. Warm and direct, second person. Australian English. No em dashes or en dashes. 90 to 140 words.

End by telling them you need a few facts from them before you rewrite it.

PART 2 - THE CHECKLIST: EVERY FLAW, AND WHO FIXES IT

The read above is short, so it carries only the worst few problems. This part is the complete list and it must be exhaustive.

List EVERY defect you can see, including the ones you already named above. There is no cap: if you can see twenty things, list twenty. Someone reading this should finish it knowing there is nothing you noticed and did not say.

Cover all of it: layout and appearance, tables, photos and graphics, page count and density, section order, headings, contact details, dates and date formats, spelling and grammar, tense, Australian versus overseas conventions, duty-led bullets, missing outcomes, unexplained employers, unexplained qualifications or grading scales, foreign currency figures, gaps, inconsistencies, leftover template or placeholder text, anything that would trip an automated screen, and anything else you noticed.

NEVER INVENT A PROBLEM. This matters more than the list being long. If the resume does something well, that is not a flaw, and you must not manufacture one to make the list look thorough. A short honest list on a strong resume is the correct answer and is not a failure. Padding is far worse than missing something: a candidate who reads an invented criticism stops trusting everything else we tell them.

Every finding needs an "owner", which decides how it is shown to the candidate:

- "we_fix" - anything you could correct using only what is already in the document. Removing a photo, lifting content out of tables, fixing dates, tense, spelling, Australian conventions, section order, headings, stripping template junk, rewriting a duty-led bullet to lead with the action. Use this whenever the fix needs no new information. Most findings should be this.
- "needs_you" - the fix requires a fact only the candidate can supply: a missing number, what an unknown employer actually does, whether a role was casual or full-time, the scope they personally owned. Use this ONLY when you genuinely cannot fix it without asking them.
- "worth_knowing" - neither of us can fix it quickly. A mismatch between their experience and the roles they are targeting, a very short work history, a long unexplained gap. This is context, not a task. Use it sparingly, and never as a disguised criticism of the person.

Also give each finding:
- "title": a short label, at most 6 words ("Photo on the resume")
- "detail": ONE plain sentence on what it actually costs them
- "severity": "critical" if it can stop the resume being read or parsed at all, "important" if it costs interviews, "minor" if it is polish

PART 3 - WHAT ALREADY WORKS

List 2 to 5 things this resume genuinely does well, as short specific sentences. Point at the real thing, not a generic compliment: "Your Storemax role names actual clients and budget ranges, which is exactly what Australian employers look for" - not "good experience".

If the resume is strong overall, this is the section that should be long and the findings list that should be short. Say only what is true: if you cannot find something genuinely good, return fewer items rather than inventing praise.

PART 4 - WHAT MUST NOT BE LOST

Before the questions, list everything in this resume that would be a serious error to leave out when it is rewritten. This is an inventory, not a judgement: you are not deciding what is worth keeping, you are recording what is there.

Be exhaustive and literal. Copy the names as they appear in the resume, so they can be matched against the rewrite:

- "employers": every company, organisation, agency, client or place of work named anywhere, including casual jobs, internships, volunteering and one-off event work. A current role matters most of all. Include every one, even if it looks unimportant or unrelated to their target job.
- "qualifications": every degree, diploma, certificate, licence, course, publication, award and the institution that granted it.
- "contacts": their email address, phone number, and LinkedIn URL if present, exactly as written.

Do not filter, rank, summarise or merge entries. Two similar employers are two entries. If you are unsure whether something counts, include it - a longer list costs nothing and a missing entry means a real part of their history can quietly disappear.

PART 5 - THE QUESTIONS

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
- quote in "anchor" the line from their resume it refers to, wording unchanged, but collapse every run of whitespace to a single space and never include a literal tab or line break inside it (resumes use tabs for alignment, and a raw tab inside a JSON string makes the whole response invalid)
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
  "findings": [
    { "title": "short label, max 6 words", "detail": "one sentence on what it costs them", "owner": "we_fix | needs_you | worth_knowing", "severity": "critical | important | minor" }
  ],
  "strengths": ["short specific sentence on something the resume genuinely does well"],
  "mustKeep": {
    "employers": ["every employer, organisation and client named, exactly as written"],
    "qualifications": ["every degree, certificate, publication and award, with its institution"],
    "contacts": ["email, phone, LinkedIn as written"]
  },
  "questions": [
    { "id": "q1", "anchor": "...", "question": "...", "why": "...", "example": "...", "kind": "number", "ranges": ["...","...","...","..."], "hint": "..." }
  ]
}

${hasDocument
  ? `The resume document is attached to this message — read it directly. The plain text below is the same document with all layout stripped out, provided only so you can copy exact lines into "anchor". Trust the attached document for anything about how the resume looks.`
  : structure
    ? structure
    : `You are working from extracted text only. You therefore CANNOT see layout, tables, photos, colour or formatting — do not guess at them or claim anything about the resume's appearance. Judge only what the text shows.`}

RESUME TEXT${structure && !hasDocument ? ' (the same document flattened — use it to copy exact lines into "anchor")' : ''}:
"""
${resumeText}
"""`;

/** Coerce the findings list into safe values. Deliberately NOT capped — the whole
 *  point is that nothing found goes unreported. */
function normaliseFindings(raw: unknown): IntakeFinding[] {
  if (!Array.isArray(raw)) return [];
  const rank = { critical: 0, important: 1, minor: 2 } as const;
  const out: IntakeFinding[] = [];
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue;
    const title = String((f as any).title ?? '').trim();
    if (!title) continue;
    const severity = (['critical', 'important', 'minor'] as const)
      .find((s) => s === (f as any).severity) ?? 'important';
    // Default to we_fix: if the model is unsure, assuming we handle it is both
    // the commoner case and the kinder one - it never hands out false homework.
    const owner = (['we_fix', 'needs_you', 'worth_knowing'] as const)
      .find((o) => o === (f as any).owner) ?? 'we_fix';
    out.push({ title, detail: String((f as any).detail ?? '').trim(), owner, severity });
  }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Coerce the inventory into clean string lists. Deliberately uncapped - a
 *  truncated inventory silently reduces what the retention gate can protect. */
function normaliseMustKeep(raw: unknown): MustKeep {
  const list = (v: unknown): string[] =>
    Array.isArray(v)
      ? [...new Set(v.map((x) => String(x ?? '').trim()).filter((x) => x.length > 1))]
      : [];
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    employers: list(o.employers),
    qualifications: list(o.qualifications),
    contacts: list(o.contacts),
  };
}

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

/**
 * `document` is the original upload. When it is a PDF we send the FILE ITSELF, so
 * the model sees the rendered pages — photo, layout, tables, density, page count —
 * instead of a text dump with all of that stripped out. Everything visual about a
 * resume is invisible in extracted text, which is why enumerating conditions in the
 * prompt could never work. Falls back to text-only for DOCX and on any failure.
 */
export async function analyseIntakeResume(
  resumeText: string,
  signals?: DocumentSignals,
  document?: { buffer: Buffer; filename: string; isPdf: boolean },
  docxStructure?: DocxStructure | null,
): Promise<IntakeAnalysis> {
  const signalBlock = signals ? describeSignals(signals) : '';
  const canAttach = !!document?.isPdf;
  // DOCX has no native path, so give the model the document's structure instead
  // of a flattened text dump — otherwise tables are invisible to it.
  const structureBlock = !canAttach && docxStructure ? describeDocxStructure(docxStructure) : '';

  // Parsing has to sit INSIDE the attempt, not after it. A malformed or truncated
  // JSON response from the document call is exactly the case the text fallback
  // exists for, and leaving the parse outside meant a bad response threw a 502 at
  // the user instead of quietly falling back.
  const attempt = async (useDocument: boolean): Promise<IntakeAnalysis> => {
    const raw = useDocument
      ? await callLLMWithDocument(
          PROMPT(resumeText, signalBlock, true, ''),
          { buffer: document!.buffer, filename: document!.filename },
          true,
          0.4,
          ANALYSIS_MAX_TOKENS,
        )
      : await callLLMWithRetry(
          PROMPT(resumeText, signalBlock, false, structureBlock),
          true,
          3,
          0.4,
          ANALYSIS_MAX_TOKENS,
        );

    const parsed = typeof raw === 'string' ? parseLLMJson(raw) : raw;
    const brief = String(parsed?.brief ?? '').trim();
    if (!brief) throw new Error('model returned no brief');

    return {
      firstName: String(parsed?.firstName ?? '').trim(),
      currentRole: String(parsed?.currentRole ?? '').trim(),
      brief,
      findings: normaliseFindings(parsed?.findings),
      strengths: Array.isArray(parsed?.strengths)
        ? parsed.strengths.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 5)
        : [],
      mustKeep: normaliseMustKeep(parsed?.mustKeep),
      questions: normaliseQuestions(parsed?.questions),
    };
  };

  if (canAttach) {
    // Two shots at the document read before giving up the visual information —
    // it is worth far more than the text-only read, so don't abandon it on one
    // bad JSON response.
    for (let i = 1; i <= 2; i++) {
      try {
        return await attempt(true);
      } catch (err) {
        console.warn(`[intakeAnalysis] document read attempt ${i} failed:`, (err as Error).message);
      }
    }
    console.warn('[intakeAnalysis] falling back to text-only read (no layout or photo visibility)');
  }

  // The text/structure path needs its own retries. callLLMWithRetry only retries
  // transport errors, so a malformed JSON body used to fail the whole upload on
  // the first try — which is why Word uploads failed intermittently while the
  // same file succeeded when run directly. This response is long and generated
  // at temperature 0.4, so an occasional bad body is expected, not exceptional.
  let lastErr: unknown;
  for (let i = 1; i <= 3; i++) {
    try {
      return await attempt(false);
    } catch (err) {
      lastErr = err;
      console.warn(`[intakeAnalysis] text read attempt ${i} failed:`, (err as Error).message);
    }
  }
  throw lastErr;
}
