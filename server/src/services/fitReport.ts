/**
 * Fit report — "how well does my resume fit this job?"
 *
 * The free tier's hook. Someone pastes a job ad and gets one honest answer:
 * can you win this today, could you win it with the resume written properly,
 * or is this not your job.
 *
 * Two passes, deliberately small:
 *
 *   PASS 1 (deterministic, free, instant)
 *     Pull the requirement bullets out of the ad, each tagged with the heading
 *     it sits under. Nothing is filtered. "We do not expect:" and "Nice to
 *     have:" are not the same ask as "Requirements:", and an untagged bullet
 *     list marked a candidate down for lacking things the ad said it did not
 *     want. The heading is carried through and the model decides what it means.
 *
 *   PASS 2 (one LLM call)
 *     The full resume plus that requirement list. One call, one JSON object.
 *
 * No Australian-experience or international-graduate logic lives in here. The
 * core evaluator judges resume against ad and nothing else. Anything about
 * local experience, visa, or seniority discounting belongs in a separate layer
 * that reads a finished report.
 *
 * The prompt below is the one measured in src/tests/fitReportEval.ts over six
 * resumes paired with a job each should win and a job each should not. Change
 * the prompt, rerun that eval. The numbers to hold are separation (designed
 * matches ~79 avg, designed mismatches ~8, no overlap) and all three bands in
 * use, because `stretch` is the band the paid upsell hangs off.
 */

import { callClaude } from './llm';
import { normalizeEmDashes } from '../lib/styleLint';
import { scrubInjection } from './scrubInjection';
import { detectWorkRights } from '../lib/workRights';

/** Validated in the eval. Overridable without a deploy, per house rule. */
const FIT_MODEL = process.env.FIT_MODEL || undefined;

/** Guards against a novel-length paste blowing the context or the bill. */
const MAX_RESUME_CHARS = 16_000;
const MAX_JD_CHARS = 12_000;

export type FitBand = 'strong' | 'stretch' | 'mismatch';
export type FitOutcome = 'apply' | 'search';

export interface FitReport {
  /** What the ad is, as the model read it. Null when the ad never says. */
  jobTitle: string | null;
  company: string | null;
  /** Their real odds if they applied today, 0-100. */
  fit: number;
  band: FitBand;
  /** A short paragraph spoken to them, in plain English. */
  verdict: string;
  youHave: string[];
  missing: string[];
  outcome: FitOutcome;
  /** Only populated when outcome is `search`. Roles they could win today. */
  searchRoles: string[];
  /**
   * A plain sentence naming a citizenship, residency, working-rights or
   * clearance requirement the ad states. Deterministic, never from the model,
   * and never part of the score. Null when the ad does not raise it.
   */
  workRights: string | null;
}

export interface FitRequirement {
  /** The ad's own heading, e.g. "What we are looking for", "We do not expect". */
  section: string;
  text: string;
}

export class FitReportError extends Error {
  constructor(
    message: string,
    readonly code: 'NO_RESUME' | 'JD_TOO_SHORT' | 'NO_REQUIREMENTS' | 'BAD_RESPONSE',
  ) {
    super(message);
    this.name = 'FitReportError';
  }
}

// ─── Pass 1: deterministic ────────────────────────────────────────────────────

/**
 * Bullet lines from the ad, each tagged with the heading it sits under.
 *
 * Nothing is dropped on purpose. A heuristic that filters negative sections
 * misfires on ads worded differently, and a silently dropped requirement is
 * invisible in the output.
 */
export function parseRequirements(jd: string): FitRequirement[] {
  const out: FitRequirement[] = [];
  let section = '';

  for (const raw of jd.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    if (/^[-•*]/.test(line)) {
      const text = line.replace(/^[-•*]\s*/, '').trim();
      if (text.length > 12) out.push({ section, text });
      continue;
    }
    // A short line ending in a colon is a section heading.
    if (line.endsWith(':') && line.length < 60) section = line.replace(/:$/, '').trim();
  }
  return out;
}

/**
 * Ads pasted out of Seek and LinkedIn often arrive as prose with no bullet
 * characters at all. Falling back to sentence-ish lines keeps those working
 * rather than returning an empty requirement list and a meaningless report.
 */
function requirementsWithFallback(jd: string): FitRequirement[] {
  const bulleted = parseRequirements(jd);
  if (bulleted.length >= 3) return bulleted;

  const lines = jd
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 30 && !l.endsWith(':'))
    .slice(0, 40)
    .map((text) => ({ section: '', text }));

  return bulleted.length > lines.length ? bulleted : lines;
}

// ─── Pass 2: the prompt under test ────────────────────────────────────────────

/**
 * The ad's opening lines, where the role title and the employer live.
 *
 * The requirement parser keeps only bullets, so without this the model has
 * nothing to read a title off and every saved job came back "Untitled role".
 *
 * Kept to a handful of lines, and labelled in the prompt as identification
 * only. Unlabelled, it became evidence: an ad header naming three cities had
 * the model drop a strong graduate candidate from 72/apply to 45/search
 * because she lives in a fourth one, which is not a call this report gets to
 * make. The requirement list is what the verdict is built from.
 */
export function adHeader(jd: string): string {
  return jd
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^[-•*]/.test(l))
    .slice(0, 6)
    .join('\n')
    .slice(0, 400);
}

export function buildFitPrompt(requirements: FitRequirement[], resume: string, header = ''): string {
  return `
A job seeker wants to know how well their resume fits this job.

THE AD, so you can name it. Do not judge fit on anything in this block.
${header}

THEIR RESUME
${resume}

WHAT THE AD ASKS FOR

${requirements.map((r, i) => `${i + 1}. [${r.section || 'From the ad'}] ${r.text}`).join('\n')}

A resume does not state work rights, visa status, salary or notice period. Silence on those is not a gap.

Return ONLY valid JSON:

{
  "jobTitle": "the role title as the ad states it, or null if it never says",
  "company": "the hiring employer as the ad states it, or null if it never says",
  "verdict": "a short paragraph in simple English a ten year old would understand, spoken to them as you",
  "fit": 0-100 integer, their real odds if they applied today,
  "band": "strong" if they can win this job today, "stretch" if it is winnable but only once the resume is written properly for this ad, "mismatch" if it is not winnable,
  "youHave": ["2 to 3 things that genuinely count here"],
  "missing": ["up to 3 things the ad wants that they do not show"],
  "outcome": "apply" if this job is worth their time, "search" if it is not,
  "searchRoles": ["when outcome is search, 2 to 3 role titles they could win today. Empty array otherwise."]
}
`.trim();
}

// ─── Response handling ────────────────────────────────────────────────────────

function stripFences(raw: string): string {
  let t = raw.trim();
  if (t.startsWith('```')) {
    const lines = t.split('\n');
    if (lines[0].startsWith('```')) lines.shift();
    if (lines[lines.length - 1]?.startsWith('```')) lines.pop();
    t = lines.join('\n').trim();
  }
  return t;
}

function cleanText(v: unknown): string {
  return typeof v === 'string' ? normalizeEmDashes(v).trim() : '';
}

function cleanList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(cleanText).filter(Boolean).slice(0, max);
}

function optionalText(v: unknown): string | null {
  const s = cleanText(v);
  if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'unknown') return null;
  return s;
}

/**
 * Everything the model returns is coerced into shape here rather than trusted.
 * A band the model invented, a fit of 120, or a missing array of nine items are
 * all things a rendered screen should never have to defend against.
 */
export function normaliseFitReport(raw: unknown): FitReport {
  const r = raw as Record<string, unknown>;

  const fit = Math.max(0, Math.min(100, Math.round(Number(r.fit) || 0)));

  const bandRaw = cleanText(r.band).toLowerCase();
  const band: FitBand =
    bandRaw === 'strong' || bandRaw === 'stretch' || bandRaw === 'mismatch'
      ? bandRaw
      // The model went off-script. Derive the band from the number it gave,
      // which is the one field it is hardest to be creative with.
      : fit >= 75 ? 'strong' : fit >= 45 ? 'stretch' : 'mismatch';

  const outcome: FitOutcome = cleanText(r.outcome).toLowerCase() === 'apply' ? 'apply' : 'search';

  return {
    jobTitle: optionalText(r.jobTitle),
    company: optionalText(r.company),
    fit,
    band,
    verdict: cleanText(r.verdict),
    youHave: cleanList(r.youHave, 3),
    missing: cleanList(r.missing, 3),
    outcome,
    // A search suggestion on an apply verdict is noise, and an empty search
    // verdict is a dead end. Keep the two consistent with each other.
    searchRoles: outcome === 'search' ? cleanList(r.searchRoles, 3) : [],
    // Filled in by runFitReport from the ad itself. Anything the model tried to
    // put here is discarded: this field is a fact about the ad, not a judgement.
    workRights: null,
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export interface FitReportResult {
  report: FitReport;
  /** Pass 1 output, kept so a support question can be answered without a rerun. */
  requirements: FitRequirement[];
  /** Injection patterns stripped out of the pasted ad, if any. */
  flagged: string[];
  ms: number;
}

export async function runFitReport(
  resumeText: string | null | undefined,
  jobText: string,
): Promise<FitReportResult> {
  if (!resumeText || resumeText.trim().length < 200) {
    throw new FitReportError('No resume on file to check against.', 'NO_RESUME');
  }

  const { scrubbed, flagged } = scrubInjection(jobText ?? '');
  const jd = scrubbed.slice(0, MAX_JD_CHARS);

  if (jd.trim().length < 100) {
    throw new FitReportError('That job description is too short to read.', 'JD_TOO_SHORT');
  }

  const requirements = requirementsWithFallback(jd);
  if (requirements.length === 0) {
    throw new FitReportError('We could not find what this job is asking for.', 'NO_REQUIREMENTS');
  }

  const prompt = buildFitPrompt(requirements, resumeText.slice(0, MAX_RESUME_CHARS), adHeader(jd));

  const t0 = Date.now();
  const { content } = await callClaude(prompt, true, undefined, FIT_MODEL);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(content));
  } catch {
    throw new FitReportError('The fit check came back unreadable.', 'BAD_RESPONSE');
  }

  const notice = detectWorkRights(jd);

  return {
    report: { ...normaliseFitReport(parsed), workRights: notice?.sentence ?? null },
    requirements,
    flagged,
    ms: Date.now() - t0,
  };
}
