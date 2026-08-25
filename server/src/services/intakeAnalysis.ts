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
import { todayBlock } from './promptDate';
import { DocumentSignals, describeSignals } from './documentSignals';
import { DocxStructure, describeDocxStructure } from './docxStructure';
import { MustKeep } from './retentionGate';
import { normalizeEmDashes } from '../lib/styleLint';

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

/** Ceiling, not a target. Ask fewer whenever fewer is honest. */
export const MAX_QUESTIONS = 10;

/**
 * One call returns the prose read, the findings, the retention inventory and the
 * anchored questions. The default 8192 truncated the JSON mid-object once the
 * findings list got long, which surfaced as "LLM returned unparseable response".
 */
const ANALYSIS_MAX_TOKENS = 16000;

/**
 * Deliberately short.
 *
 * This prompt was ~2000 words. It was not designed at that length; it accreted,
 * a rule at a time, each one added the day something went wrong and none ever
 * removed. It ended up contradicting itself ("do not work from a checklist"
 * directly above a twenty-item checklist) and, worse, naming faults it wanted
 * caught. On 25 Aug 2026 an exemplar phrase, "an obviously wrong date", sent the
 * model hunting for a date fault; it found one that was five months in the past
 * and led the client's report with an accusation of carelessness. A quota
 * elsewhere ("if you can see twenty things, list twenty") had it billing one
 * observation twice to reach the number.
 *
 * Rewritten against a live A/B on a real CV: ~330 words of instruction beat the
 * ~2000-word version outright, and caught the biggest problem on the resume that
 * the long one missed twice. Instructions compete with the document for the
 * model's attention, and a rule naming a fault is an instruction to go find it.
 *
 * What survives is only what is load-bearing:
 *   - the JSON shape, which the UI renders and buildCleanResume consumes
 *   - mustKeep, which the retention gate checks the rewrite against
 *   - EVIDENCE_RULE, from the 30 Jul 2026 incident where invented figures
 *     reached a real resume
 *   - the few Australian conventions the model gets wrong unprompted
 *   - what it can and cannot see, so it never invents a comment on layout
 *
 * Before adding anything here, check it is one of those. A rule that merely
 * describes good judgement makes the output worse, not better.
 */
const PROMPT = (
  resumeText: string,
  signals: string,
  hasDocument: boolean,
  structure: string,
): string => `You are an expert Australian career coach. A new client has just sent you their resume. Read it, tell them the truth about it, and ask for the facts you would need before rewriting it.

${todayBlock()}

${EVIDENCE_RULE}
${signals ? `
${signals}
` : ''}
WHAT YOU CAN SEE
${hasDocument
  ? 'The resume document is attached. Judge everything a recruiter opening it would see, the layout, photo, columns, tables, density, page count, fonts and spacing, as well as the writing. The plain text below is the same document flattened, there only so you can copy exact lines into "anchor".'
  : structure
    ? `You have the resume as structure, not as a picture. Judge what the structure shows and judge the writing. Say nothing about fonts, colours, margins, columns or page count, because you cannot see them.

${structure}`
    : 'You have plain text only, with all structure and appearance stripped out. Judge the writing, the content and the ordering. Say nothing about photos, tables, layout, fonts, colour or page count, because you cannot see any of it.'}

HOW TO JUDGE
Work out from the document what job this person is going for, then read it as the person hiring for that job would. Rank everything by what actually costs them interviews. The most serious problem is often not an error but a mismatch between what the document says and what the target job needs.

Say what is actually there. However many findings that is, is the right number. One observation is one finding, never split across employers or bullets to lengthen the list. An invented criticism costs you their trust in everything else you tell them.

Australian English. Never an em dash or en dash. Warm, direct, second person, and never a remark on the person rather than the document. A referees section, or "References available on request", is standard practice here and is never a flaw. Never raise visas or sponsorship. Do not sell or pitch.

Return ONLY this JSON object and nothing else:
{
  "firstName": "their first name, or an empty string if unclear",
  "currentRole": "their current or most recent job title exactly as the resume gives it, or an empty string if unclear",
  "brief": "2 or 3 short paragraphs of flowing prose spoken to them, no bullets or headings or scores. The worst problems first, each explained as understanding rather than verdict. End by telling them you need a few facts before you rewrite it. 90 to 140 words. Use \n\n between paragraphs.",
  "findings": [{
    "title": "short label, at most 6 words",
    "detail": "one plain sentence on what it costs them",
    "owner": "we_fix if you could fix it from the document alone, which is most of them | needs_you if it needs a fact only they have | worth_knowing if neither of you can fix it quickly",
    "severity": "critical if it stops the resume being read or parsed at all | important if it costs interviews | minor if it is polish"
  }],
  "strengths": ["something the resume genuinely does well, specific enough to point at. Say only what is true, and return fewer rather than inventing praise"],
  "mustKeep": {
    "employers": ["every company, organisation, agency, client or place of work named anywhere, including casual jobs, internships and volunteering, copied as written"],
    "qualifications": ["every degree, diploma, certificate, licence, course, publication and award, with the institution, copied as written"],
    "contacts": ["email, phone and LinkedIn URL, exactly as written"]
  },
  "questions": [{
    "id": "q1",
    "anchor": "the line from their resume this is about, wording unchanged, every run of whitespace collapsed to a single space, never a literal tab or line break",
    "question": "one sentence you would actually say out loud, naming the employer where it helps",
    "why": "what the answer changes for an Australian employer, at most 15 words",
    "example": "the shape of a good answer, not a real figure from their resume",
    "kind": "number if the answer is a quantity, otherwise text",
    "ranges": ["for number questions, 4 ascending buckets they could pick instead of an exact figure. Empty array for text questions"],
    "hint": "where they could look it up, such as an old payslip, a rostering app, the original job ad, or a former manager"
  }]
}

At most ${MAX_QUESTIONS} questions, best first, and fewer is better. Ask only what they alone can tell you: a missing number, what an unfamiliar employer does, whether a role was casual or full time, the scope they personally owned. Never ask for something the resume already states, never ask their goals or opinions, and never ask for anything you could fix yourself.

The inventory in mustKeep is a record, not a judgement. Do not filter, rank or merge it: a missing entry means a real part of their history can quietly disappear in the rewrite.

RESUME TEXT:
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
    out.push({
      title: normalizeEmDashes(title),
      detail: normalizeEmDashes(String((f as any).detail ?? '').trim()),
      owner,
      severity,
    });
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
      question: normalizeEmDashes(question),
      why: normalizeEmDashes(String((q as any).why ?? '').trim()),
      example: normalizeEmDashes(String((q as any).example ?? '').trim()),
      kind,
      ranges:
        kind === 'number' && Array.isArray((q as any).ranges)
          ? (q as any).ranges.map((r: unknown) => String(r).trim()).filter(Boolean).slice(0, 4)
          : [],
      hint: normalizeEmDashes(String((q as any).hint ?? '').trim()),
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
    const brief = normalizeEmDashes(String(parsed?.brief ?? '').trim());
    if (!brief) throw new Error('model returned no brief');

    return {
      firstName: String(parsed?.firstName ?? '').trim(),
      currentRole: String(parsed?.currentRole ?? '').trim(),
      brief,
      findings: normaliseFindings(parsed?.findings),
      strengths: Array.isArray(parsed?.strengths)
        ? parsed.strengths.map((x: unknown) => normalizeEmDashes(String(x).trim())).filter(Boolean).slice(0, 5)
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
