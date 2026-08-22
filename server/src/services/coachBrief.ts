/**
 * The two LLM passes behind /admin/workshop.
 *
 * `matchThreadToRoster` turns a pasted Skool thread into (poster, question)
 * pairs tied to registration ids. `generateCoachBrief` turns a resume plus that
 * question into six short lines that get read while the room is live.
 *
 * Six lines, and short ones, is the whole design constraint. This is read at a
 * glance mid-sentence with fifteen people watching, so anything that has to be
 * skimmed for the useful part has already failed. A paragraph here is worse than
 * nothing, because it costs attention at exactly the moment there is none spare.
 *
 * ⚠️ Both prompts inherit the EVIDENCE RULE from `services/diagnosticReport.ts`.
 * A fabricated number said out loud to the person it is about is worse than a
 * fabricated number in a document: they cannot un-hear it, and it tells them the
 * read was generated rather than done.
 */
import { callClaude, PREMIUM_MODEL } from './llm';

// ── Shapes ───────────────────────────────────────────────────────────────────

/** The four gaps the workshop is structured around. */
export const GAPS = {
  1: 'Targeting',
  2: 'Outcomes',
  3: 'Outreach',
  4: 'System',
} as const;

export type GapNumber = keyof typeof GAPS;

export interface CoachBrief {
  /** Degree, field, years, visa if stated. One line. */
  who: string;
  /** Where they are actually stuck, read off the resume rather than off what they said. */
  stuck: string;
  /** Their question in one line, as asked. */
  question: string;
  /** Which gap it lands in, or null when they did not ask anything. */
  gap: GapNumber | null;
  /** One thing worth saying their name next to. */
  nameCallout: string;
  /** A resume line to rewrite live, quoted verbatim so it can be read aloud. */
  resumeLine: string | null;
  temperature: 'Hot' | 'Warm' | 'Cold';
  temperatureReason: string;
}

export interface CoachBriefInput {
  name: string;
  resumeText?: string | null;
  question?: string | null;
  /** Whatever the signup form collected, for rosters taken before it was trimmed. */
  answers?: Record<string, unknown> | null;
}

/** One (poster, question) pair the matcher pulled out of the thread. */
export interface ThreadMatch {
  /** The name as it appeared in the thread, kept so a wrong match is obvious. */
  poster: string;
  question: string;
  /** Null when nobody on the roster is a confident match: a floor question. */
  registrationId: string | null;
  /** Why it matched, or why it did not. Shown next to the dropdown. */
  note: string;
}

export interface RosterEntry {
  id: string;
  name: string;
  email: string;
}

// ── JSON out of a model ──────────────────────────────────────────────────────

/**
 * Pull the JSON body out of a model response.
 *
 * `callClaude` asks for bare JSON and mostly gets it, but a fenced block or a
 * sentence of preamble still slips through often enough that a bare
 * `JSON.parse` would fail a fact sheet on the afternoon it is needed. Taking the
 * outermost braces survives both without a fence-stripping special case.
 */
function parseJsonBody<T>(raw: string): T {
  const trimmed = String(raw ?? '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error(`Model returned no JSON object. Got: ${trimmed.slice(0, 200)}`);
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as T;
}

/**
 * The rule both prompts sit under, worded for a read that gets spoken aloud.
 * Sent as the cached system prefix so the second and later calls in a
 * "Generate all" run pay for it once.
 */
const EVIDENCE_RULE = `EVIDENCE RULE (absolute, and it overrides every other instruction you are given):

Never state a fact about this person that is not present in the documents and text you have been shown. This applies to numbers above all: hours, headcounts, caseloads, class or group sizes, percentages, durations, dollar amounts, outcomes, success rates, application counts, response rates.

If a detail is not in the source, leave it out. Writing "several years" when the resume does not give a span is correct; writing "four years" because it looks about right is not. If you are quoting their resume, quote it character for character, including its own typos.

Everything you write here is read out loud, by name, to the person it is about, minutes after you write it. A number they never gave is something they will hear as a mistake about their own life.

WRITING RULE: no em dashes and no en dashes anywhere in your output. Use a comma, a full stop, or a colon.`;

// ── Pass 1: the thread ───────────────────────────────────────────────────────

function buildMatchPrompt(thread: string, roster: RosterEntry[]): string {
  const rosterLines = roster
    .map((r) => `- id: ${r.id} | name: ${r.name} | email: ${r.email}`)
    .join('\n');

  return `You are splitting a pasted community thread into individual questions and matching each one to a person on a registration roster.

The thread is a raw copy and paste out of a Skool group. It contains navigation text, timestamps, like and comment counts, reply chains and other interface noise. Ignore all of it. You are looking only for a person's name next to something they wrote that is a question or a request for help.

THE ROSTER (the only ids you may use):
${rosterLines || '(the roster is empty)'}

MATCHING RULES:
1. Match on the name, and be generous about form. "Priya R", "priyadarshini", "Priyadarshini Ramesh" and "P. Ramesh" are all the same person if only one Priyadarshini is on the roster.
2. Never guess between two plausible people. If a first name matches two roster entries and nothing separates them, return null and say so in the note.
3. A poster who is not on the roster gets registrationId null. That is a normal outcome, not a failure. The thread is public and the roster is not.
4. One person may post more than once. If a person asks two separate things, join them into one question with a blank line between, rather than emitting two entries for the same id.
5. Never invent a question for a roster entry that did not post. People with nothing in the thread simply do not appear in your output.

THE QUESTION TEXT:
Copy it VERBATIM. Do not tidy the grammar, do not shorten it, do not turn it into reported speech. Strip only the interface noise around it (the poster's name, timestamps, "2 likes", "Reply"). If they wrote three sentences, all three come through.

Return ONLY this JSON:
{
  "matches": [
    {
      "poster": "the name exactly as it appeared in the thread",
      "question": "their question, verbatim",
      "registrationId": "the roster id, or null",
      "note": "a few words: why this matched, or why it could not"
    }
  ]
}

THE THREAD:
"""
${thread}
"""`;
}

/**
 * Split a pasted thread and tie each question to a person.
 *
 * Deliberately returns a proposal and writes nothing. Name matching is the step
 * most likely to be wrong, and it is wrong in the way that matters most: reading
 * one person's question out under another person's name. So it goes on screen
 * for review first, with a dropdown, and only a human press commits it.
 */
export async function matchThreadToRoster(
  thread: string,
  roster: RosterEntry[],
): Promise<ThreadMatch[]> {
  const { content } = await callClaude(
    buildMatchPrompt(thread, roster),
    true,
    EVIDENCE_RULE,
    PREMIUM_MODEL,
  );

  const parsed = parseJsonBody<{ matches?: unknown }>(content);
  const raw = Array.isArray(parsed.matches) ? parsed.matches : [];
  const validIds = new Set(roster.map((r) => r.id));

  return raw
    .map((m): ThreadMatch => {
      const row = (m ?? {}) as Record<string, unknown>;
      const id = typeof row.registrationId === 'string' ? row.registrationId : null;
      return {
        poster: String(row.poster ?? '').trim() || 'Unknown',
        question: String(row.question ?? '').trim(),
        // A hallucinated id would attach a question to the wrong person, which
        // is the exact failure this whole review step exists to catch. An id
        // that is not on the roster is dropped to null and becomes a floor
        // question, which is recoverable from the dropdown.
        registrationId: id && validIds.has(id) ? id : null,
        note: String(row.note ?? '').trim(),
      };
    })
    .filter((m) => m.question.length > 0);
}

// ── Pass 2: the fact sheet ───────────────────────────────────────────────────

function buildBriefPrompt(input: CoachBriefInput): string {
  const answerLines = Object.entries(input.answers ?? {})
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
    .join('\n');

  return `You are preparing a coach's read on one attendee of a live group workshop for international graduates job hunting in Australia.

This gets glanced at while the coach is mid sentence with fifteen people watching. Every line must land in under two seconds. Short. Concrete. No preamble, no hedging, no coaching voice.

THE FOUR GAPS the workshop is built around:
1 Targeting: applying to roles they were never going to be shortlisted for, or not naming a target at all.
2 Outcomes: a resume that lists duties rather than results, so nothing on the page separates them from anyone else with the same degree.
3 Outreach: applying into a portal and waiting, with no human contacted.
4 System: no volume, no follow up, no tracking. Effort with no process under it.

Return ONLY this JSON, with these exact keys:
{
  "who": "One line. Degree, field, years of experience, visa status, but ONLY the ones actually stated. Max 20 words.",
  "stuck": "One line. Where they are actually stuck, read off the RESUME, not off what they said about themselves. Name the mechanism, not the feeling. Max 25 words.",
  "question": "Their question in one line, as they asked it. If they asked nothing, write exactly: No question asked.",
  "gap": 1,
  "nameCallout": "One line the coach can say with their name attached, that shows he read their document. Something specific enough that it could not be said to anyone else in the room. Max 25 words.",
  "resumeLine": "ONE line lifted from their resume, VERBATIM and character for character, that is worth rewriting live as the example. Pick a duty-shaped line with no result in it. Null if there is no resume.",
  "temperature": "Hot",
  "temperatureReason": "One short clause. What in the source says so."
}

FIELD RULES:
- "gap" is the number 1, 2, 3 or 4 that their QUESTION lands in, or null if they asked nothing. Judge the question, not the resume.
- "resumeLine" is a quote, not a paraphrase. If you cannot reproduce a line exactly, return null instead. A misquote read aloud in front of the person who wrote it is worse than having no example.
- "temperature" is exactly one of "Hot", "Warm", "Cold". Hot means the source shows urgency or an explicit ask for help. Cold means they registered and gave you nothing else. Warm is everything in between.
- Do not repeat the same content across two fields. "stuck" and "nameCallout" must not say the same thing twice.

THE PERSON: ${input.name}

THEIR QUESTION:
"""
${input.question?.trim() || '(they have not asked anything)'}
"""
${answerLines ? `\nWHAT THEY TOLD THE SIGNUP FORM:\n${answerLines}\n` : ''}
THEIR RESUME:
"""
${input.resumeText?.trim() || '(no resume on file)'}
"""`;
}

const TEMPERATURES: CoachBrief['temperature'][] = ['Hot', 'Warm', 'Cold'];

/**
 * One fact sheet. The caller caches it on the row; this never reads or writes.
 */
export async function generateCoachBrief(input: CoachBriefInput): Promise<CoachBrief> {
  const { content } = await callClaude(
    buildBriefPrompt(input),
    true,
    EVIDENCE_RULE,
    PREMIUM_MODEL,
  );

  const raw = parseJsonBody<Record<string, unknown>>(content);

  const gapRaw = Number(raw.gap);
  const gap = ([1, 2, 3, 4] as const).includes(gapRaw as GapNumber) ? (gapRaw as GapNumber) : null;

  const temperature = TEMPERATURES.find(
    (t) => t.toLowerCase() === String(raw.temperature ?? '').trim().toLowerCase(),
  ) ?? 'Warm';

  const line = (v: unknown) => String(v ?? '').trim();

  return {
    who: line(raw.who),
    stuck: line(raw.stuck),
    question: line(raw.question) || 'No question asked.',
    gap,
    nameCallout: line(raw.nameCallout),
    // A resume line is either an exact quote or absent. An empty string
    // rendered as a quote block is a blank example on screen mid-call.
    resumeLine: line(raw.resumeLine) && line(raw.resumeLine).toLowerCase() !== 'null'
      ? line(raw.resumeLine)
      : null,
    temperature,
    temperatureReason: line(raw.temperatureReason),
  };
}

export const buildBriefPromptForTest = buildBriefPrompt;
export const buildMatchPromptForTest = buildMatchPrompt;
