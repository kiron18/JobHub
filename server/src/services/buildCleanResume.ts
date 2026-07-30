/**
 * Step 2 of the /welcome intake: turn the messy upload plus the candidate's
 * answers into the ONE clean resume that every later generation grounds on.
 *
 * This is the whole point of the intake. `profile.resumeRawText` is what
 * generate.ts reads for every resume and cover letter, so the output of this
 * function is what the client's applications are built from for the life of
 * their account. Getting it clean once is worth more than any per-application
 * prompt tuning.
 *
 * Two things make this safe rather than dangerous:
 *   1. EVIDENCE_RULE — shared with intakeAnalysis, so nothing in the chain can
 *      invent a figure. This exact class of bug shipped once already.
 *   2. assertNoBlanks() — a hard gate. diagnosticReport deliberately emits
 *      "[how many]" blanks because they become the intake questions, and a blank
 *      that leaks into stored resume text would be copied into every future
 *      application. A leak fails the build rather than being saved.
 */
import fs from 'fs';
import path from 'path';
import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { EVIDENCE_RULE } from './intakeEvidenceRule';

const RESUME_RULES = fs.readFileSync(
  path.join(__dirname, '..', '..', 'rules', 'resume_rules.md'),
  'utf-8',
);

export type IntakeAnswerStatus = 'answered' | 'later' | 'unknown';

export interface IntakeAnswer {
  questionId: string;
  /** Denormalised from the question so the prompt reads as a transcript. */
  question: string;
  anchor: string;
  status: IntakeAnswerStatus;
  /** The figure or fact they gave. Empty unless status === 'answered'. */
  value: string;
}

/**
 * Fixes that need no input from the candidate. Applied silently every time —
 * asking permission for these would just add friction to an already long flow.
 */
const SILENT_FIXES = `SILENT FIXES — apply all of these without being asked:
- Remove any photo reference, date of birth, age, marital status, gender, religion, nationality, visa number, or full street address. Australian employers do not expect them and several create discrimination risk.
- Reduce location to suburb and state only (e.g. "Parramatta, NSW").
- Standardise every date to "Mon YYYY" (e.g. "Mar 2019 - May 2023"). Use "Present" for current roles.
- Delete any "Objective" or "Career Objective" block that states what the candidate wants. Replace it with a Professional Summary that states what they deliver.
- Rewrite duty-led bullets so they lead with the outcome or the action, not "Responsible for" / "Duties included" / "Tasked with".
- Australian English throughout (organisation, specialise, programme, behaviour, recognise, centre).
- Consistent section order: Professional Summary, Work Experience, Education, Skills, then anything else.
- Parallel bullet structure and consistent tense across every role.
- Remove skill self-ratings, star bars, percentage bars, and tables. They break the automated screen.`;

const PROMPT = (
  resumeText: string,
  answersBlock: string,
  targetRole: string | null,
): string => `You are a professional Australian resume writer producing the definitive clean version of a candidate's resume. This single document becomes the source every future job application of theirs is built from, so it must be accurate, complete, and free of anything invented.

${EVIDENCE_RULE}

RESUME RULES — follow every rule in this document:
${RESUME_RULES}

${SILENT_FIXES}

${answersBlock}

${targetRole ? `The candidate is targeting: ${targetRole}. Position the summary and ordering for that, using only evidence already in their resume.\n` : ''}
NOTHING IS LOST — this rewrite must never make the resume smaller. Every role, employer, date range, qualification, certification, publication, award, language and skill in the original must survive into the clean version, along with every figure the original already states. You are restructuring and sharpening, never pruning. If a bullet reads poorly, rewrite it — do not delete it. Losing something real the candidate earned is a worse outcome than any formatting flaw you were trying to fix.

OUTPUT FORMAT — absolute requirements:
- NO square-bracket placeholders of any kind. Not "[how many]", not "[X]", not "[insert metric]", not "[Company]". If a figure is missing and the candidate did not supply it, write the bullet cleanly WITHOUT the figure. A bullet with no number is correct. A bracket is a defect that would be copied into every future application.
- No preamble, no meta-commentary, no explanation, no closing note. Output the resume and nothing else.
- Clean markdown. Every section header (## Professional Summary, ## Work Experience, etc.) on its own line with a blank line before and after. Never a header on the same line as body text.
- The Professional Summary must be in FIRST PERSON. Never third person, never the candidate's own name inside the summary.
- Contact line: include only channels actually present in their resume. If there is no LinkedIn URL, omit LinkedIn entirely — never write the bare word "LinkedIn". If there is one, render the URL itself.

CANDIDATE'S ORIGINAL RESUME:
"""
${resumeText}
"""

Write the complete clean resume now.`;

/** Renders the Q&A into a transcript the model can act on. */
function buildAnswersBlock(answers: IntakeAnswer[]): string {
  const answered = answers.filter((a) => a.status === 'answered' && a.value.trim());
  const withheld = answers.filter((a) => a.status !== 'answered');

  const parts: string[] = [];

  if (answered.length) {
    parts.push(
      `FACTS THE CANDIDATE HAS CONFIRMED — these are new information, verified by them. Work each one into the relevant bullet naturally. Do not round, inflate, or extrapolate beyond what they said. If they gave a range or an approximation, keep it hedged ("around 80 a week"), never sharpen it into a precise figure:\n` +
        answered
          .map(
            (a) =>
              `- Asked: ${a.question}\n  They answered: "${a.value.trim()}"${a.anchor ? `\n  Applies to this line: "${a.anchor}"` : ''}`,
          )
          .join('\n'),
    );
  }

  if (withheld.length) {
    parts.push(
      `NOT AVAILABLE — the candidate could not supply these. For each one, keep the underlying bullet and everything the original resume already says about it, INCLUDING any figure already written there. Simply do not add the detail that is missing: no invented number, no placeholder, no remark about the gap.\n\n` +
        `An unanswered question is never a reason to delete anything. Several of these questions ask the candidate to CLARIFY a figure their resume already contains — if they could not clarify it, the existing figure stays exactly as written. Dropping a bullet or stripping a real number because a question went unanswered makes the resume worse than the one they uploaded, which is a failure.\n\n` +
        withheld.map((a) => `- ${a.question}`).join('\n'),
    );
  }

  if (!parts.length) {
    parts.push(
      'The candidate supplied no additional facts. Clean and restructure the resume using only what it already contains.',
    );
  }

  return parts.join('\n\n');
}

/**
 * Square-bracket blanks are legitimate output for diagnosticReport (they become
 * the intake questions) and a defect here. Anything of the form [...] with word
 * characters inside is treated as a leak.
 */
const BLANK_PATTERN = /\[[^\]\n]*[A-Za-z][^\]\n]*\]/g;

export function findBlanks(content: string): string[] {
  return [...new Set(content.match(BLANK_PATTERN) ?? [])];
}

export class BlankLeakError extends Error {
  constructor(public readonly blanks: string[]) {
    super(`Clean resume contained ${blanks.length} placeholder blank(s): ${blanks.slice(0, 5).join(', ')}`);
    this.name = 'BlankLeakError';
  }
}

export interface BuildCleanResumeInput {
  resumeText: string;
  answers: IntakeAnswer[];
  targetRole?: string | null;
}

/**
 * Returns the clean resume markdown. Throws rather than returning something
 * defective — the caller must not persist a resume that failed the gate,
 * because it would silently poison every later generation.
 */
export async function buildCleanResume({
  resumeText,
  answers,
  targetRole = null,
}: BuildCleanResumeInput): Promise<string> {
  if (!resumeText || resumeText.trim().length < 200) {
    throw new Error('buildCleanResume: resume text too short to rebuild');
  }

  const prompt = PROMPT(resumeText, buildAnswersBlock(answers), targetRole);

  // One corrective retry: a stray bracket is usually a formatting slip the model
  // will fix when told exactly which strings were wrong. A second failure is
  // real and must not be persisted.
  let lastBlanks: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const instruction =
      attempt === 1
        ? prompt
        : `${prompt}\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED. It contained these forbidden square-bracket placeholders: ${lastBlanks.join(', ')}. Rewrite the resume with those lines carrying no figure and no brackets at all.`;

    const raw = await callLLMWithRetry(instruction, false);
    const content = (typeof raw === 'string' ? raw : String(raw ?? '')).trim();
    if (!content) throw new Error('buildCleanResume: model returned empty content');

    lastBlanks = findBlanks(content);
    if (lastBlanks.length === 0) return content;

    console.warn(
      `[buildCleanResume] attempt ${attempt} rejected, ${lastBlanks.length} blank(s): ${lastBlanks.slice(0, 5).join(', ')}`,
    );
  }

  throw new BlankLeakError(lastBlanks);
}
