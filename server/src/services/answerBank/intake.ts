// Story intake: turn a resume into an interview, not into answers.
//
// A resume is an INDEX of stories, never the stories themselves. It records the
// outcome with everything interesting removed: no situation, no obstacle, no
// "what did YOU do as opposed to the team", and above all no failures, because
// nobody lists their mistakes. Generating answers straight off a resume is
// precisely what makes every commercial autofill tool sound templated, since a
// resume is all they have.
//
// So this module does three things and stops:
//   1. mine the resume for candidate MOMENTS (seeds)
//   2. work out which themes those seeds could evidence, and which they cannot
//   3. write an anchored interview script that fills the gaps
//
// It deliberately never writes an answer. A human still has to talk.
//
// No LLM, no network. A model would parse messier resumes better and can be
// layered on later, but the whole thing needs to run offline and be testable,
// and the gap analysis below is the part that actually matters.

import { THEMES, ADDON_THEMES, INDUSTRY_THEMES } from './taxonomy';
import { PROFILE_FIELDS } from './profile';
import { minutesFor, CORE_THEMES } from './coverage';

// ---------------------------------------------------------------------- types

export interface ResumeEntry {
  role: string;
  org: string;
  dates: string;
  bullets: string[];
}

export interface ResumeSection {
  heading: string;
  entries: ResumeEntry[];
}

export interface Seed {
  id: string;
  text: string;
  section: string;
  role: string;
  org: string;
  dates: string;
  score: number;
  reasons: string[];
  themes: string[];
  strong: boolean;
}

export interface GapRow {
  theme: string;
  label: string;
  covered: boolean;
  evidence: string[];
  frequency: number;
  unreachable: boolean;
}

export interface GapReport {
  rows: GapRow[];
  coveredCount: number;
  total: number;
  gaps: GapRow[];
}

export interface Hints {
  reach: string;
  shape: string;
  avoid: string;
}

export interface Question {
  id: string;
  kind: 'seed' | 'gap';
  from?: string;
  themes: string[];
  unreachable?: boolean;
  ask: string;
  probes: string[];
  hints: Hints;
  /**
   * Three ways into the memory, offered as taps. Retrieval keys, never content:
   * they say WHICH occasion to go and get, never anything about what happened
   * in it. See CUES.
   */
  cues: string[];
}

export interface Script {
  anchor: string;
  questions: Question[];
  estimatedMinutes: number;
}

export interface Plan {
  seeds: Seed[];
  gaps: GapReport;
  script: Script;
}

export interface Variants {
  headline: string;
  short: string;
  medium: string;
  full: string;
}

export interface BankStory {
  id: string;
  title: string;
  context: string;
  themes: string[];
  keywords: string[];
  prompt?: string;
  hints?: Hints;
  answers?: string[];
  raw: string;
  variants: Variants;
}

export interface Bank {
  _howToFill?: string;
  profile: Record<string, string | boolean | null>;
  stories: BankStory[];
  statements: BankStory[];
  learned: Record<string, unknown>;
}

interface Theme { id: string; label: string }


// -------------------------------------------------------------- resume shape

const HEADINGS = /^(education|experience|employment|work experience|professional experience|career history|projects?|volunteer(ing)?|community|skills|technical skills|certifications?|licences?|licenses?|achievements?|awards?|summary|profile|objective|referees?|references?|interests|extracurricular)\b/i;

const YEAR = /\b(19|20)\d{2}\b/;
const BULLET = /^\s*[-•*▪●·o]\s+/;

/** Split a resume into sections, entries (role + org + dates) and their bullets. */
export function parseResume(text: string): ResumeSection[] {
  const lines = (text || '').split(/\r?\n/).map((l: string) => l.replace(/\s+$/, ''));
  const sections: ResumeSection[] = [];
  let section: ResumeSection = { heading: 'unlabelled', entries: [] };
  let entry: ResumeEntry | null = null;

  const pushEntry = () => {
    if (entry) {
      if (!entry.org && entry.bullets.length && looksLikeOrgLine(entry.bullets[0])) {
        entry.org = entry.bullets.shift()!.split(',')[0].trim();
      }
      section.entries.push(entry);
    }
    entry = null;
  };
  const pushSection = () => {
    pushEntry();
    if (section.entries.length) sections.push(section);
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const isHeading = HEADINGS.test(line) && line.length < 45 && !BULLET.test(line);
    if (isHeading) {
      pushSection();
      section = { heading: line.replace(/[:.]$/, '').toLowerCase(), entries: [] };
      continue;
    }

    if (BULLET.test(line)) {
      const bullet = line.replace(BULLET, '').trim();
      if (!entry) entry = { role: '', org: '', dates: '', bullets: [] };
      if (bullet) entry.bullets.push(bullet);
      continue;
    }

    // A non-bullet line carrying a year starts a new entry.
    if (YEAR.test(line)) {
      pushEntry();
      entry = { ...splitEntryLine(line), bullets: [] };
      continue;
    }

    // Anything else. Open an implicit entry rather than dropping the line:
    // plenty of resumes list achievements with no bullet marker and no date,
    // and silently discarding them is exactly the kind of quiet data loss that
    // makes a parser look like it works when it does not.
    if (!entry) entry = { role: section.heading, org: '', dates: '', bullets: [] };
    entry.bullets.push(line);
  }
  pushSection();

  return sections;
}

// Entry lines separate their fields with a pipe, an em/en dash, a hyphen, a tab,
// or simply a run of spaces. Tabs and space-runs matter more than they look:
// resumes written in Word use them almost exclusively, and splitting on the
// pipe alone leaves the whole line sitting in `role` with `org` empty, which
// silently collapses the anchor to "your last job" for every question.
const SEPARATORS = /\s*\|\s*|\t+|\s{2,}|\s+[—–]\s+|\s+-\s+/;

// The date range has to come out BEFORE the line is split, or the separator
// rules cut "07/2023 – 10/2025" in half and the back half becomes the role.
const MONTH = String.raw`(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?`;
const DAY = String.raw`\d{1,2}(?:st|nd|rd|th)?`;
const YR = String.raw`(?:19|20)\d{2}`;
// Longest form first, so "12/02/2024" is never read as the shorter "02/2024".
const ONE_DATE = String.raw`(?:${DAY}[\/.\-]${DAY}[\/.\-]${YR}|${DAY}[\/.\-]${YR}|${MONTH}\s+${DAY},?\s+${YR}|${MONTH}\s+${YR}|${YR})`;
const DATE_CHUNK = new RegExp(
  String.raw`${ONE_DATE}(?:\s*(?:[-–—]|to|until|through)\s*(?:${ONE_DATE}|present|current|now|ongoing|today))?`,
  'i',
);

/** Organisation suffixes, for telling an employer line from a duty line. */
const ORG_SUFFIX = /\b(ltd|limited|pty|plc|inc|llc|corp|corporation|group|holdings|university|college|school|institute|academy|hospital|clinic|health|services|solutions|consulting|partners|associates|foundation|society|council|centre|center|store|supermarkets?|bank)\b/i;

/**
 * Word-processor resumes routinely put the employer on the line BELOW the role,
 * where the parser would otherwise file it as a bullet. Left there it becomes a
 * story seed, which is how a street address ends up asked as an interview
 * question.
 */
function looksLikeOrgLine(text: string): boolean {
  const words = text.split(/\s+/).length;
  if (words > 10 || ACTION_VERBS.test(text) || /[.!?]$/.test(text)) return false;
  if (!/^[A-Z(]/.test(text)) return false;
  return ORG_SUFFIX.test(text) || (text.includes(',') && words <= 10);
}

function splitEntryLine(line: string): Omit<ResumeEntry, 'bullets'> {
  const found = line.match(DATE_CHUNK);
  const dates = found ? found[0].trim() : '';
  const withoutDates = found
    ? `${line.slice(0, found.index!)}\t${line.slice(found.index! + found[0].length)}`
    : line;
  const parts = withoutDates
    .split(SEPARATORS)
    .map((p: string) => p.trim().replace(/^[:,\-–—]+|[:,\-–—]+$/g, '').trim())
    .filter(Boolean);
  return {
    role: parts[0] || line.trim(),
    org: (parts[1] || '').split(',')[0].trim(),
    dates,
  };
}

// --------------------------------------------------------------- seed scoring

const ACTION_VERBS = /^(led|managed|supervis|coordinat|built|created|designed|redesign|rebuilt|develop|implement|launch|introduc|improv|streamlin|automat|reduc|increas|resolv|handled|negotiat|train|mentor|taught|identif|investigat|reconcil|audit|analys|analyz|deliver|organis|organiz|present|pitched|recover|fixed|solved|initiat|propos|establish|migrat|transition)/i;

const SCOPE_WORDS = /\b(team|customer|client|patient|stakeholder|store|project|deadline|supplier|budget|process|system|report|volunteer|student|staff|shift|campaign)/i;

const GENERIC = /\b(responsible for|duties includ|assisted with|as required|day.to.day|various tasks|general (?:admin|customer|office)|ad.hoc|other duties|participated in|involved in|helped with|worked on)\b/i;

const HAS_NUMBER = /(\d[\d,.]*\s*(?:%|percent|k\b|m\b)|\$\s?\d|\b\d{2,}\b|\bby \d)/i;

const SKILLS_LIST = /^(proficient|familiar|experienced|skilled|competent|working knowledge)\b|^[^.]{0,120}(,\s*[A-Za-z+#. ]{2,20}){3,}$/i;

/** A street address: never a story, and its house number scores as a concrete figure. */
const ADDRESS = /\b(?:no\.?\s*)?\d+[a-z]?\s+[A-Z][\w']+(?:\s+[\w']+){0,3}\s+(?:st|street|rd|road|ave|avenue|hwy|highway|mawatha|lane|ln|dr|drive|ct|court|pl|place|blvd|pde|parade|cres|crescent|terrace|tce|way)\b|\b\d{4},?\s*(?:VIC|NSW|QLD|WA|SA|TAS|NT|ACT)\b/i;

/** Phone, email, profile links: never a story, and they carry digits that would otherwise score. */
const CONTACT = /@|\bhttps?:|\b(?:linkedin|github)\.com|\b\d{4}\s?\d{3}\s?\d{3}\b|^\+?\d[\d ]{7,}/i;

/**
 * How much real story is likely to sit behind a bullet.
 * Negative or zero means it is a duty statement, not a moment.
 */
export function scoreSeed(text: string): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (ACTION_VERBS.test(text)) { score += 3; reasons.push('action verb'); }
  if (HAS_NUMBER.test(text)) { score += 2; reasons.push('concrete number'); }

  const scopeHits = (text.match(new RegExp(SCOPE_WORDS.source, 'gi')) || []).length;
  if (scopeHits) { score += Math.min(scopeHits, 2); reasons.push('scope'); }

  if (GENERIC.test(text)) { score -= 4; reasons.push('duty statement'); }
  if (SKILLS_LIST.test(text)) { score -= 4; reasons.push('skills list'); }
  if (CONTACT.test(text)) { score -= 6; reasons.push('contact details'); }
  if (ADDRESS.test(text)) { score -= 6; reasons.push('street address'); }
  if (text.length < 25) { score -= 2; reasons.push('too short'); }

  return { score, reasons };
}

// --------------------------------------------------- resume language -> themes

/**
 * Resume verbs are not question verbs, so the matcher's signals do not fire on
 * them. These are the resume-side equivalents.
 *
 * There is deliberately no entry for failure, conflict or ethics. Those three
 * themes cannot be evidenced by a resume at all, which is the entire reason an
 * interview step has to exist. NEVER_ON_RESUME below asserts it.
 */
// Leading \b only, never trailing: these are PREFIXES, so `reconcil` has to
// catch "Reconciled" and `simultaneous` has to catch "simultaneously". Where a
// prefix would be dangerous the word is pinned explicitly instead, which is why
// `led\b` is anchored (otherwise "supplier ledgers" reads as leadership).
const RESUME_HINTS = {
  leadership: /\b(led\b|leading|managed|supervis|oversaw|coordinat|delegat|trained|training|mentor|captain|president|head of|team of)/i,
  teamwork: /\b(collaborat|cross.functional|team of|worked with|partnered|group (project|assignment)|committee|jointly)/i,
  customer: /\b(customer|client|patient|guest|retail|hospitality|front of house|service|sales|reception|help ?desk|public)/i,
  detail: /\b(reconcil|audit|accura|quality|verif|checked|proofread|data entry|documentation|compliance check|discrepanc)/i,
  initiative: /\b(introduc|creat|launch|initiat|propos|redesign|rebuilt|streamlin|improv|automat|reduc|built)/i,
  learning: /\b(learn|self.taught|taught myself|certif|upskill|trained in|new (system|software|tool|platform))/i,
  pressure: /\b(deadline|peak|high.volume|fast.paced|busy period|time.critical|under pressure|turnaround)/i,
  priorities: /\b(simultaneous|multiple|concurrent|juggl|competing|prioritis|prioritiz|workload)/i,
  change: /\b(transition|migrat|restructur|adapt|new process|rollout|change management)/i,
  safety: /\b(safety|hazard|whs|ohs|incident|risk assessment|first aid|infection control)/i,
  procedure: /\b(procedure|protocol|policy|complian|regulat|guideline|sop|standard operating|governance)/i,
};

/** The three themes a resume structurally cannot evidence. */
export const NEVER_ON_RESUME = ['failure', 'conflict', 'ethics'];

/**
 * How often entry-level forms ask about each theme. This is a considered guess,
 * not data. It only affects the ORDER gaps are asked about, so being wrong is
 * cheap, and the prototype's own captures will correct it.
 */
export const ASK_FREQUENCY = {
  failure: 10, teamwork: 10, pressure: 9, customer: 9, conflict: 8,
  initiative: 7, learning: 7, leadership: 6, priorities: 6, detail: 5,
  change: 4, safety: 6, procedure: 5, ethics: 4,
};

function themesForText(text: string, pool: Theme[]): string[] {
  const hints = RESUME_HINTS as Record<string, RegExp | undefined>;
  return pool.filter((t) => hints[t.id] && hints[t.id]!.test(text)).map((t) => t.id);
}

function themePool(industry: string | null): Theme[] {
  const pool: Theme[] = [...(THEMES as Theme[])];
  const byIndustry = INDUSTRY_THEMES as Record<string, string[] | undefined>;
  for (const t of ADDON_THEMES as Theme[]) {
    if ((byIndustry[industry || ''] || []).includes(t.id) && !pool.some((p) => p.id === t.id)) pool.push(t);
  }
  return pool;
}

// -------------------------------------------------------------------- seeds

/** Mine the resume for candidate moments, strongest first. */
export function extractSeeds(
  resumeText: string,
  { industry = null, minScore = 2 }: { industry?: string | null; minScore?: number } = {},
): Seed[] {
  const pool = themePool(industry);
  const sections = parseResume(resumeText);
  const seeds: Seed[] = [];
  let n = 0;

  for (const section of sections) {
    // `unlabelled` is the contact block above the first heading.
    if (/^(unlabelled|skills|technical skills|interests|referees?|references?|summary|profile|objective)/.test(section.heading)) continue;

    for (const entry of section.entries) {
      for (const bullet of entry.bullets) {
        const { score, reasons } = scoreSeed(bullet);
        seeds.push({
          id: `seed${++n}`,
          text: bullet,
          section: section.heading,
          role: entry.role,
          org: entry.org,
          dates: entry.dates,
          score,
          reasons,
          themes: themesForText(bullet, pool),
          strong: score >= minScore,
        });
      }
    }
  }

  return seeds.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------- gaps

/** Which themes the resume evidences, which it does not, and what to ask about. */
export function analyseGaps(
  seeds: Seed[],
  { industry = null }: { industry?: string | null } = {},
): GapReport {
  const pool = themePool(industry);
  const covered = new Map<string, string[]>();

  for (const seed of seeds) {
    if (!seed.strong) continue;
    for (const theme of seed.themes) {
      if (!covered.has(theme)) covered.set(theme, []);
      covered.get(theme)!.push(seed.id);
    }
  }

  const rows = pool.map((t) => ({
    theme: t.id,
    label: t.label,
    covered: covered.has(t.id),
    evidence: covered.get(t.id) || [],
    frequency: (ASK_FREQUENCY as Record<string, number>)[t.id] ?? 5,
    unreachable: NEVER_ON_RESUME.includes(t.id),
  }));

  return {
    rows,
    coveredCount: rows.filter((r) => r.covered).length,
    total: rows.length,
    gaps: rows.filter((r) => !r.covered).sort((a, b) => b.frequency - a.frequency),
  };
}

// ------------------------------------------------------------------- script

const GAP_PROMPTS = {
  failure: (a: string) => `At ${a}, think of a shift or a week that went badly. What happened?`,
  conflict: (a: string) => `At ${a}, was there someone you found difficult to work with, or a time you disagreed with how something was being done?`,
  ethics: (a: string) => `At ${a}, was there ever a time where the easy thing and the right thing were not the same?`,
  pressure: (a: string) => `What was the busiest or most stressful day you had at ${a}? Talk me through it.`,
  teamwork: (a: string) => `Tell me about a time at ${a} where you had to rely on other people to get something done.`,
  customer: (a: string) => `Tell me about the most difficult customer or client you dealt with at ${a}.`,
  leadership: (a: string) => `Was there ever a point at ${a} where you ended up making the call, or showing someone else how to do something?`,
  initiative: (a: string) => `Was there anything at ${a} you changed or improved that nobody asked you to?`,
  learning: (a: string) => `What was the hardest thing you had to pick up quickly at ${a}?`,
  priorities: (a: string) => `Tell me about a time at ${a} when you had more to do than time to do it. How did you decide what to drop?`,
  detail: (a: string) => `Was there a time at ${a} where you caught something that other people had missed?`,
  change: (a: string) => `Tell me about a time at ${a} when something changed unexpectedly and you had to adjust.`,
  safety: (a: string) => `Was there ever a safety issue at ${a} that you noticed or had to raise?`,
  procedure: (a: string) => `Tell me about a time at ${a} where following the correct process mattered, or where someone was tempted to cut a corner.`,
};

/** The three follow-ups every story needs, because people skip straight to the result. */
export const PROBES = [
  'What did you specifically do? Not the team, you.',
  'What did you decide NOT to do?',
  'How did it end up?',
];

/**
 * What to reach for, and what a good answer to this theme looks like.
 *
 * The probes above are identical for every question because the failure they
 * correct is universal: people narrate the outcome and leave their own part out
 * of it. These are the opposite, and they are what decides whether somebody
 * answering on their own produces usable material. Asked cold, "tell me about a
 * failure" reliably returns a disguised strength. Told first that a disguised
 * strength is the one thing to avoid, most people go and find a real one.
 *
 * `reach` is which memory to go and get. `shape` is how to tell it. `avoid` is
 * the specific wrong turn this theme invites, and it is the load-bearing line.
 */
export const THEME_HINTS = {
  failure: {
    reach: 'Something that genuinely went wrong and was your call. Not bad luck, not someone else.',
    shape: 'Name what you got wrong in one plain sentence, then spend most of the answer on what you changed and the next time it did not happen.',
    avoid: 'Do not pick a disguised strength like "I care too much" or "I work too hard". Every interviewer has heard it and it reads as evasive.',
  },
  conflict: {
    reach: 'Someone you found hard to work with, or a time you thought something was being done the wrong way.',
    shape: 'Be fair to the other person. Say what you did to understand their side before you say what you did about it.',
    avoid: 'Do not say you have never had a disagreement. It reads as untrue, or as someone who never speaks up.',
  },
  ethics: {
    reach: 'A time the easy option and the right option were not the same thing, even in a small way.',
    shape: 'Say what made it tempting. An honest answer admits the easy option was genuinely attractive.',
    avoid: 'Do not make it about catching somebody else out. It should be a choice you made.',
  },
  pressure: {
    reach: 'The busiest or most stressful single day or shift you can actually picture.',
    shape: 'Say what you did first and why that came first. A pressure answer is really about how you triage.',
    avoid: 'Do not just say it was busy and you got through it. Without the ordering there is no answer in it.',
  },
  teamwork: {
    reach: 'Something you could not have finished on your own.',
    shape: 'Keep saying "I" inside the story. Your own part has to stay visible or the answer credits the team instead of you.',
    avoid: 'Do not describe the group and leave yourself out. This is the most common way this answer fails.',
  },
  customer: {
    reach: 'The hardest customer, client, patient or resident you dealt with.',
    shape: 'Show that you stayed level. What you said to them matters more than what you thought of them.',
    avoid: 'Do not make the customer the villain, even if they were. It tells them how you would talk about theirs.',
  },
  leadership: {
    reach: 'A time you made the call, or showed somebody else how something was done. It does not need a title.',
    shape: 'Say why it fell to you. Stepping in because nobody else had is stronger than being told to.',
    avoid: 'Do not skip this because you have never managed anyone. Entry-level leadership is almost never a job title.',
  },
  initiative: {
    reach: 'Something you changed or improved that nobody asked you to.',
    shape: 'Say what was wrong before, and how you knew it was worth fixing.',
    avoid: 'Do not pick something you were assigned. The whole point is that it was unprompted.',
  },
  learning: {
    reach: 'The hardest thing you had to pick up quickly, and how you actually went about it.',
    shape: 'Describe the method, not the fact that you learned it. How you get up to speed is the transferable part.',
    avoid: 'Do not just name a course or a certificate. They want to see how you learn without one.',
  },
  priorities: {
    reach: 'A time you had more to do than time to do it.',
    shape: 'Name what you dropped or delayed, and who you told. The dropped thing is the answer.',
    avoid: 'Do not claim you got everything done. That answers a different question and sounds untrue.',
  },
  detail: {
    reach: 'Something you caught that other people had missed.',
    shape: 'Say what made you check in the first place, and what it would have cost if it had gone through.',
    avoid: 'Do not answer with "I am a detail-oriented person". That is a claim, not a story.',
  },
  change: {
    reach: 'Something that changed unexpectedly and forced you to adjust.',
    shape: 'Say what you did in the first hour or the first day. Adjusting quickly is the thing being tested.',
    avoid: 'Do not describe a change that happened to you with no action of yours in it.',
  },
  safety: {
    reach: 'A safety issue you noticed, or one you had to raise with someone.',
    shape: 'Say who you told and how fast. Escalating is the correct answer and it is what they are checking for.',
    avoid: 'Do not describe fixing something yourself that should have been reported. That reads as a risk.',
  },
  procedure: {
    reach: 'A time following the correct process mattered, or somebody was tempted to cut a corner.',
    shape: 'Show that you know why the process exists, not only that you followed it.',
    avoid: 'Do not make yourself sound rigid. Say what you did when the process and the situation did not fit.',
  },
};

/**
 * The way into the memory.
 *
 * The blank box is where this intake loses people, and the reason is not
 * effort, it is search. "Tell me about a time you showed initiative" asks
 * somebody to scan four years of work against an abstract category, which is
 * a genuinely hard retrieval problem and is why the honest answer is usually
 * a long pause followed by "I can't think of one".
 *
 * A cue collapses the search. "The one you still think about" names a small
 * set to look in, and people find something in it almost immediately.
 *
 * The line these must not cross: a cue says WHICH occasion to fetch, never
 * anything about what happened in it. "The time someone else noticed" is a
 * retrieval key. "The time you stayed back to fix a colleague's error" would
 * be a suggested answer, and it would come back to us as their story. Every
 * cue below is checked against that rule, and `cuesAreSafe` asserts it.
 */
export const CUES = {
  failure: ['The one you still think about', 'The one somebody else had to fix', 'The one you owned up to'],
  conflict: ['The person you dreaded a shift with', 'The decision you thought was wrong', 'The one you let go and regretted'],
  ethics: ['The shortcut nobody would have noticed', 'The thing you were told to leave out', 'The one you raised anyway'],
  pressure: ['The worst day you can still picture', 'The one where you ran out of time', 'The one you were on your own for'],
  teamwork: ['The one you could not have finished alone', 'The one where somebody dropped their part', 'The one you were the new person on'],
  customer: ['The one who was already angry when they arrived', 'The one you could not give what they wanted', 'The one who came back'],
  leadership: ['The time nobody else stepped in', 'The time you showed someone how', 'The time you had to make the call quickly'],
  initiative: ['The thing that always annoyed you', 'The thing you fixed before anyone asked', 'The thing you suggested and got knocked back'],
  learning: ['The system you were thrown into', 'The thing you pretended to know at first', 'The thing you taught yourself at home'],
  priorities: ['The day everything landed at once', 'The thing you had to drop', 'The deadline you had to renegotiate'],
  detail: ['The thing you nearly missed', 'The thing that had already been signed off', 'The one you double-checked on a hunch'],
  change: ['The day the plan changed', 'The time someone left suddenly', 'The new system nobody was ready for'],
  safety: ['The thing you saw and reported', 'The near miss', 'The corner somebody was about to cut'],
  procedure: ['The step people usually skip', 'The time the process did not fit', 'The time you were glad you followed it'],
};

/**
 * For a resume-mined question, where the theme is not the point and the only
 * hard part is picking one occasion out of a duty done a hundred times.
 */
export const SEED_CUES = [
  'The first time you did it',
  'The time it nearly went wrong',
  'The one you remember most clearly',
];

/**
 * A cue must select a memory, never describe one.
 *
 * The interviewer's probes are checked for leading the witness after the model
 * writes them; these are written by hand, so the check runs in the tests
 * instead. Both exist for the same reason: an instruction is a request and a
 * check is a guarantee.
 */
export function cuesAreSafe(cues: string[]): { ok: boolean; problem?: string } {
  for (const cue of cues) {
    if (cue.split(/\s+/).length > 9) return { ok: false, problem: `too long, reads as an answer: "${cue}"` };
    // An outcome verb in a cue tells them how the story ended before they tell it.
    if (/\b(succeeded|failed to|resolved|saved|improved|achieved|won|delivered|so that|which meant|resulting)\b/i.test(cue)) {
      return { ok: false, problem: `carries an outcome: "${cue}"` };
    }
  }
  return { ok: true };
}

/** The cues for a question, by theme, falling back to the resume-mined set. */
export function cuesFor(question: { kind?: string; themes?: string[] }): string[] {
  const theme = (question.themes || [])[0];
  const byTheme = CUES as Record<string, string[] | undefined>;
  if (question.kind === 'gap' && theme && byTheme[theme]) return byTheme[theme]!;
  return SEED_CUES;
}

/** For a question mined from the resume, where the theme is not the point. */
export const SEED_HINTS = {
  reach: 'One specific occasion, not the general duty. A day, a shift, a particular sample or report.',
  shape: 'Set the scene in a sentence, then what you did, then how it ended. Plain words are fine.',
  avoid: 'Do not read the resume line back. It is already on the page. They are asking what sits behind it.',
};

/** The guidance shown with a question before the candidate starts talking. */
export function hintsFor(question: { kind?: string; themes?: string[] }): Hints {
  const theme = (question.themes || [])[0];
  const byTheme = THEME_HINTS as Record<string, Hints | undefined>;
  if (question.kind === 'gap' && theme && byTheme[theme]) return byTheme[theme]!;
  return SEED_HINTS;
}

/**
 * Pick the role the candidate spent most time in, since that is where the
 * unrecorded stories are. Falls back to whichever entry has the most bullets.
 */
export function anchorRole(seeds: Seed[]): string {
  const byOrg = new Map<string, number>();
  for (const seed of seeds) {
    if (!seed.org) continue;
    byOrg.set(seed.org, (byOrg.get(seed.org) || 0) + 1);
  }
  if (!byOrg.size) return 'your last job';
  return [...byOrg.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * The deliverable: a set of anchored questions. Never abstract. "Tell me about
 * a time you failed" gets a blank stare; "think of a shift at Harborline that
 * went badly" gets a story, because it names a time and place to retrieve from.
 */
export function buildScript(
  seeds: Seed[],
  gapReport: GapReport,
  { maxSeedQuestions = 2 }: { maxSeedQuestions?: number } = {},
): Script {
  const anchor = anchorRole(seeds);
  const questions: Question[] = [];

  // 1. The warm-up. Resume seeds are the EASY questions, not the valuable ones:
  //    they name a concrete thing the candidate already did, so they get
  //    somebody talking, but by definition they ask about themes the resume has
  //    already evidenced. Two is enough to warm up on. Six, which is what this
  //    used to take, spent half the intake on ground already covered.
  //
  //    Chosen for theme spread rather than score alone. Straight top-six by
  //    score returned three bullets from one employer covering five themes
  //    between them, three of which repeated.
  const seen = new Set<string>();
  const strong: Seed[] = [];
  for (const seed of seeds) {
    if (!seed.strong || strong.length >= maxSeedQuestions) continue;
    // A seed with no themes still earns a place: it is a real moment we cannot
    // classify, which is different from one we already have covered.
    const fresh = !seed.themes.length || seed.themes.some((t) => !seen.has(t));
    if (!fresh) continue;
    seed.themes.forEach((t) => seen.add(t));
    strong.push(seed);
  }

  for (const seed of strong) {
    const where = seed.org || seed.role || seed.section;
    questions.push({
      id: `q-${seed.id}`,
      kind: 'seed',
      from: seed.id,
      themes: seed.themes,
      ask: `${describeSeed(seed)} at ${where}. Walk me through one specific time that happened. What was actually going on?`,
      probes: PROBES,
      hints: SEED_HINTS,
      cues: SEED_CUES,
    });
  }

  // 2. One question per gap, most-asked first. These are the ones the resume
  //    could never have told us about, and they are the half worth keeping.
  //    Most will never be asked: coverage.ts drops the ones a told story has
  //    already covered, which is usually three or four of them.
  for (const gap of gapReport.gaps) {
    const prompt = (GAP_PROMPTS as Record<string, ((a: string) => string) | undefined>)[gap.theme];
    if (!prompt) continue;
    questions.push({
      id: `q-gap-${gap.theme}`,
      kind: 'gap',
      themes: [gap.theme],
      unreachable: gap.unreachable,
      ask: prompt(anchor),
      probes: PROBES,
      hints: (THEME_HINTS as Record<string, Hints | undefined>)[gap.theme] || SEED_HINTS,
      cues: (CUES as Record<string, string[] | undefined>)[gap.theme] || SEED_CUES,
    });
  }

  // 3. The themes a bank is not usable without.
  //
  //    analyseGaps suppresses a question when the resume already evidences its
  //    theme, which is right for the long tail and wrong for these five. A
  //    resume line reading "handled complaints during peak trading" marks
  //    `pressure` covered and no question is ever asked, so the bank ends up
  //    with no pressure STORY and the first form to ask for one gets nothing.
  //    A resume is an index of stories, never the stories themselves, and for
  //    the themes forms actually ask about the difference matters.
  //
  //    Without this the intake also has no reachable finishing line: coverage
  //    waits for a core theme that nothing in the script can ever supply.
  const asked = new Set(questions.flatMap((q) => q.themes));
  for (const theme of CORE_THEMES) {
    if (asked.has(theme)) continue;
    const prompt = (GAP_PROMPTS as Record<string, ((a: string) => string) | undefined>)[theme];
    if (!prompt) continue;
    questions.push({
      id: `q-gap-${theme}`,
      kind: 'gap',
      themes: [theme],
      ask: prompt(anchor),
      probes: PROBES,
      hints: (THEME_HINTS as Record<string, Hints | undefined>)[theme] || SEED_HINTS,
      cues: (CUES as Record<string, string[] | undefined>)[theme] || SEED_CUES,
    });
  }

  // Warm-ups, then the themes forms actually ask about, then the extras.
  // Order is not only presentation: somebody who stops early stops at whatever
  // is on screen, so the least valuable questions have to be the ones nearest
  // the end. Stable within each band, so the frequency sort above survives.
  const band = (q: Question) => (q.kind === 'seed' ? 0 : CORE_THEMES.some((t) => q.themes.includes(t)) ? 1 : 2);
  const ordered = questions
    .map((q, i) => ({ q, i }))
    .sort((a, b) => band(a.q) - band(b.q) || a.i - b.i)
    .map(({ q }) => q);

  return { anchor, questions: ordered, estimatedMinutes: minutesFor(ordered.length) };
}

/**
 * How to refer to the resume line the question is about.
 *
 * It used to be quoted and hard-cut at 70 characters, which chopped mid-word
 * and handed people questions ending `"...on Meta Ads by 90% through manual"`.
 * A quote that stops mid-sentence reads as a bug in front of the one thing we
 * need them to trust, and it costs the line its meaning at exactly the moment
 * they are trying to remember what sat behind it.
 *
 * So: quote it whole when it is short enough to read, and when it is not, stop
 * describing it as a quote at all. `clamp` cuts on a word boundary either way,
 * the same rule cvGapScan.ts uses on every other candidate-facing string.
 */
export function describeSeed(seed: Seed): string {
  const text = seed.text.trim().replace(/[.;,]$/, '');
  if (text.length <= QUOTE_WHOLE) return `Your resume says "${text}"`;
  return `Your resume mentions ${lowerFirst(clamp(text, QUOTE_WHOLE))}`;
}

/** Past this a quote stops being readable at a glance and becomes a paragraph. */
const QUOTE_WHOLE = 90;

/**
 * Cut on a word boundary, never mid-word.
 *
 * cvGapScan's clampWords, which this follows, keeps the word boundary only
 * when it falls past 60% of the budget and otherwise hard-cuts. That is fine
 * for a heading but not here: at the lengths this runs at, the 60% rule fires
 * on ordinary lines and puts back exactly the mid-word chop the whole function
 * exists to prevent (`"Reduced cost"` out of "cost-per-result"). So the word
 * boundary always wins, and the hard cut is kept only for the one case it is
 * genuinely needed, a single token longer than the whole budget.
 */
export function clamp(s: string, max: number): string {
  const text = (s || '').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const kept = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  // Trailing function words read as a sentence cut off rather than a phrase
  // shortened: "...bid adjustments and…" against "...bid adjustments…".
  const tidied = kept
    .replace(/[,;:]$/, '')
    .replace(/\s+(?:and|or|but|the|a|an|of|to|in|on|at|for|with|from|into|across|by|than|that|which|while|when)$/i, '');
  return `${tidied}…`;
}

/**
 * "Reduced cost-per-result" reads wrong after "mentions", but "NHS" must not
 * become "nHS". Only downcase a word that is ordinary capitalised prose.
 */
function lowerFirst(s: string): string {
  const [first = ''] = s.split(/\s/);
  if (first.length > 1 && first === first.toUpperCase()) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Everything in one call. */
export function planIntake(
  resumeText: string,
  { industry = null }: { industry?: string | null } = {},
): Plan {
  const seeds = extractSeeds(resumeText, { industry });
  const gaps = analyseGaps(seeds, { industry });
  const script = buildScript(seeds, gaps);
  return { seeds, gaps, script };
}

// ------------------------------------------------------------------ scaffold

/** The five statements every entry-level form asks for in some wording. */
const STATEMENT_STUBS = [
  { id: 'st1', title: 'About me', themes: [], answers: ['self_description'],
    keywords: ['about yourself', 'introduce', 'tell us about you', 'describe yourself'] },
  { id: 'st2', title: 'Strengths', themes: [], answers: ['self_description'],
    keywords: ['strength', 'best qualit', 'good at', 'bring to', 'top skill'] },
  { id: 'st3', title: 'Weakness', themes: ['failure', 'learning'], answers: ['self_description'],
    keywords: ['weakness', 'improve', 'development area', 'work on'] },
  { id: 'st4', title: 'Why this field', themes: [], answers: ['motivation'],
    keywords: ['why did you choose', 'career goal', 'this field', 'this industry', 'where do you see yourself'] },
  { id: 'st5', title: 'Why this company and why me', themes: [], answers: ['motivation'],
    keywords: ['why do you want to work', 'why us', 'this company', 'why should we hire',
               'best person', 'best fit', 'what makes you', 'why this role'] },
];

const titleFor = (question: Question): string => {
  if (question.kind === 'gap') return `${question.themes[0]}: (name the story once you have told it)`;
  const quoted = question.ask.match(/"([^"]+)"/);
  return quoted ? clamp(quoted[1], 60) : clamp(question.ask, 60);
};

/**
 * A bank with the right shape and no content: one slot per question the intake
 * asks, waiting for the answers.
 *
 * It will not import into the extension until the slots have text in them, and
 * that is on purpose. An empty bank that loads is a bank that answers forms with
 * nothing and looks like it worked.
 */
export function buildScaffold(
  plan: Plan,
  { profile = {} }: { profile?: Record<string, string | boolean | null> } = {},
): Bank {
  const filledProfile: Record<string, string | boolean | null> = {};
  for (const field of PROFILE_FIELDS) {
    filledProfile[field.key] = profile[field.key] !== undefined
      ? profile[field.key]
      : (field.boolean ? null : '');
  }

  const stories: BankStory[] = plan.script.questions.map((q, i) => ({
    id: `s${i + 1}`,
    title: titleFor(q),
    context: '',
    themes: q.themes || [],
    keywords: [],
    prompt: q.ask,
    hints: hintsFor(q),
    raw: '',
    variants: { headline: '', short: '', medium: '', full: '' },
  }));

  return {
    _howToFill: 'Answer each "prompt" out loud and transcribe it into "raw" in your own words. '
      + 'Then cut raw down into the four variants: headline (~25 words), short (~80), medium (~180), full (as long as it needs). '
      + 'Delete any story you have nothing for. The bank will not load until every entry left in it has text.',
    profile: filledProfile,
    stories,
    statements: STATEMENT_STUBS.map((s) => ({
      ...s,
      context: '',
      raw: '',
      variants: { headline: '', short: '', medium: '', full: '' },
    })),
    learned: {},
  };
}

/** Printable version, for a coaching call or a voice-note prompt list. */
export function formatScript(plan: Plan): string {
  const lines: string[] = [];
  lines.push(`STORY INTAKE  (${plan.script.questions.length} questions, about ${plan.script.estimatedMinutes} min)`);
  lines.push(`Coverage: ${plan.gaps.coveredCount}/${plan.gaps.total} themes evidenced by the resume\n`);

  const hintBlock = (q: Question) => {
    const h = hintsFor(q);
    lines.push(`      REACH FOR   ${h.reach}`);
    lines.push(`      HOW TO SAY  ${h.shape}`);
    lines.push(`      AVOID       ${h.avoid}`);
    lines.push('      then:');
    for (const p of q.probes) lines.push(`      - ${p}`);
  };

  lines.push('FROM THE RESUME');
  for (const q of plan.script.questions.filter((x) => x.kind === 'seed')) {
    lines.push(`\n  ${q.ask}`);
    hintBlock(q);
  }

  lines.push('\n\nNOT ON THE RESUME  (this is where the real material is)');
  for (const q of plan.script.questions.filter((x) => x.kind === 'gap')) {
    lines.push(`\n  [${q.themes[0]}]${q.unreachable ? ' *' : ''} ${q.ask}`);
    hintBlock(q);
  }
  lines.push('\n  * a resume can never evidence this theme, so it is always asked');

  return lines.join('\n');
}
