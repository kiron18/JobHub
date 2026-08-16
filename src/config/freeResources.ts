/* ────────────────────────────────────────────────────────────────────────────
   The free resource pages: /free/:slug

   One page, twelve configurations. Every giveaway shares the same layout, the
   same system map and the same questions; the only thing that changes is which
   asset is handed over and which node lights up.

   ⚠️ Do NOT turn this into twelve copies of the page. The copy below the fold
   gets rewritten often, and twelve duplicates drift apart within a month, at
   which point the funnel is quietly telling twelve different stories.

   Slugs live under /free/ deliberately: `/linkedin`, `/tracker`, `/interview`
   and `/pricing` are already routes in this app, so bare single-word slugs
   would collide. The prefix is collision-proof forever, still typeable by hand,
   and the word does useful work when the URL is read out loud.
   ──────────────────────────────────────────────────────────────────────────── */

export interface SystemStep {
  n: number;
  title: string;
  /** What this stage of the search is actually for, in the reader's terms. */
  blurb: string;
}

/**
 * The five steps of the search, in the order they happen. This is the map every
 * visitor sees, and the reason a single free asset reads as a fragment rather
 * than a complete answer.
 */
export const SYSTEM_STEPS: SystemStep[] = [
  { n: 1, title: 'Understand the market', blurb: 'How hiring here actually works, before you spend a month guessing.' },
  { n: 2, title: 'Fix the resume', blurb: 'The document that decides whether any of the rest of it matters.' },
  { n: 3, title: 'Apply properly', blurb: 'Volume with a system behind it, instead of applications into the dark.' },
  { n: 4, title: 'Get seen by humans', blurb: 'The roles that never reach a job board, and the people who fill them.' },
  { n: 5, title: 'Win the interview', blurb: 'Turning the conversations you earn into an actual offer.' },
];

export interface FreeResource {
  slug: string;
  /** Which of the five steps this asset belongs to. 0 = spans all of them. */
  step: number;
  /** Shown in the stepper under its step, and as the page's headline asset. */
  name: string;
  /** One line on the download card: what it is and why it is worth opening. */
  promise: string;
  /** Files handed over. More than one when the asset is genuinely a pair. */
  files: { label: string; href: string }[];
  /**
   * How many of the twelve this page hands over. Almost always 1, including the
   * resume pair, which is two files but one resource. The bundle sets it to all
   * of them, which is what stops the page promising the rest are still to come.
   */
  covers?: number;
}

/**
 * Every asset, keyed by slug. Adding a thirteenth is one entry here plus the file
 * in /public/free. No new route, no new page.
 */
export const FREE_RESOURCES: FreeResource[] = [
  {
    slug: 'starter',
    step: 1,
    name: 'Starter Kit',
    promise: 'The whole picture on one page: what the Australian market expects, and where most people lose months.',
    files: [{ label: 'Starter Kit (PDF)', href: '/free/starter-kit.pdf' }],
  },
  {
    slug: 'rules',
    step: 1,
    name: 'Market Rules Cheat Sheet',
    promise: 'The unwritten rules nobody tells you, the ones locals absorbed without noticing.',
    files: [{ label: 'Market Rules Cheat Sheet (PDF)', href: '/free/market-rules-cheat-sheet.pdf' }],
  },
  {
    slug: 'resume',
    step: 2,
    name: 'Resume Template + Before and After',
    promise: 'The format Australian recruiters expect, and a real resume shown before and after the rewrite.',
    files: [
      { label: 'Resume Template (DOCX)', href: '/free/resume-template.docx' },
      { label: 'Before and After (PDF)', href: '/free/resume-before-and-after.pdf' },
    ],
  },
  {
    slug: 'cover-letter',
    step: 3,
    name: 'Cover Letter Template',
    promise: 'A cover letter that gets read, with a worked example rather than blanks to fill.',
    files: [{ label: 'Cover Letter Template (DOCX)', href: '/free/cover-letter-template.docx' }],
  },
  {
    slug: 'criteria',
    step: 3,
    name: 'Selection Criteria Worksheet',
    promise: 'How to answer selection criteria in STAR form, which government and big employers score you on.',
    files: [{ label: 'Selection Criteria Worksheet (DOCX)', href: '/free/selection-criteria-worksheet.docx' }],
  },
  {
    slug: 'tracker',
    step: 3,
    name: 'Application Tracker',
    promise: 'Built for 25 applications a week, so follow-ups happen on time instead of from memory.',
    files: [{ label: 'Application Tracker (XLSX)', href: '/free/application-tracker.xlsx' }],
  },
  {
    slug: 'followup',
    step: 3,
    name: 'Follow-up Email Swipe File',
    promise: 'What to send after silence, worded so it moves things along without sounding desperate.',
    files: [{ label: 'Follow-up Swipe File (DOCX)', href: '/free/followup-swipe-file.docx' }],
  },
  {
    slug: 'templates',
    step: 3,
    name: 'System Templates',
    promise: 'The documents behind the routine, so the week runs itself instead of restarting every Monday.',
    files: [{ label: 'System Templates (DOCX)', href: '/free/system-templates.docx' }],
  },
  {
    slug: 'sponsors',
    step: 3,
    name: 'Accredited Visa Sponsor List',
    promise: '3,875 companies the government has approved to sponsor, on the priority processing list, grouped by industry.',
    files: [{ label: 'Accredited Visa Sponsor List (PDF)', href: '/free/accredited-visa-sponsors.pdf' }],
  },
  {
    slug: 'linkedin',
    step: 4,
    name: 'LinkedIn Outreach Templates',
    promise: 'The messages that get replies, including the one that produces referrals weeks later.',
    files: [{ label: 'LinkedIn Outreach Templates (DOCX)', href: '/free/linkedin-outreach-templates.docx' }],
  },
  {
    slug: 'networking',
    step: 4,
    name: 'Networking Pack',
    promise: 'How to reach people who are not advertising, without knowing anyone here yet.',
    files: [{ label: 'Networking Pack (DOCX)', href: '/free/networking-pack.docx' }],
  },
  {
    slug: 'interview',
    step: 5,
    name: 'Interview Scripts and Question Bank',
    promise: 'The questions you will be asked here, and answers that sound like you rather than a script.',
    files: [{ label: 'Interview Scripts and Question Bank (DOCX)', href: '/free/interview-scripts.docx' }],
  },
];

export const TOTAL_RESOURCES = FREE_RESOURCES.length;

/**
 * /free/all — every resource on one page.
 *
 * This exists because Instagram's RESOURCE gate promises "all 12 free resources
 * in one go" and there was nowhere to send anyone who commented it. It is
 * deliberately NOT a member of FREE_RESOURCES: adding it there would make
 * TOTAL_RESOURCES read 13 and put a "download everything" tile inside one step
 * of the stepper, which is the one place it does not belong.
 */
export const RESOURCE_BUNDLE: FreeResource = {
  slug: 'all',
  step: 0,
  name: 'Every free resource',
  promise: 'All twelve, no email, no account. The whole search covered end to end, in the order you need them.',
  files: FREE_RESOURCES.flatMap((r) => r.files),
  covers: FREE_RESOURCES.length,
};

export function findResource(slug: string | undefined): FreeResource | null {
  if (!slug) return null;
  const wanted = slug.trim().toLowerCase();
  if (wanted === RESOURCE_BUNDLE.slug) return RESOURCE_BUNDLE;
  return FREE_RESOURCES.find((r) => r.slug === wanted) ?? null;
}

export function resourcesForStep(step: number): FreeResource[] {
  return FREE_RESOURCES.filter((r) => r.step === step);
}

// ── The questions ────────────────────────────────────────────────────────────
//
// Four, down from seven. Each one has to earn its place: `challenge` decides
// which step of the system is the reader's real problem, `timeline` is the
// urgency signal, and `location` plus `stage` are the screen. Everything else
// that used to be here told us nothing we acted on, or was so transparently a
// sales question that nobody answered it honestly.

export interface FreeQuestion {
  id: string;
  label: string;
  help?: string;
  options?: string[];
  /** Free text rather than choices. */
  text?: boolean;
  required: boolean;
}

/** Answers that mark a registration as worth a second look before trusting it. */
export const SCREEN_FLAGS: Record<string, string> = {
  location: 'Outside Australia, no move planned yet',
  stage: 'Not currently searching',
};

export const FREE_QUESTIONS: FreeQuestion[] = [
  {
    id: 'location',
    label: 'Where are you right now?',
    options: [
      'In Australia',
      'Arriving in Australia within 6 months',
      'Outside Australia, no move planned yet',
    ],
    required: true,
  },
  {
    id: 'stage',
    label: 'Where are you in the job search?',
    options: [
      'Still studying',
      'Graduated, looking for my first Australian role',
      'Working, but want a better role',
      'Not currently searching',
    ],
    required: true,
  },
  {
    id: 'challenge',
    label: 'What is stopping you most right now?',
    help: 'Whatever you pick, I will cover it on the call.',
    options: [
      "I don't understand how hiring actually works here",
      "My resume isn't getting responses",
      "I'm applying constantly and hearing nothing back",
      "I don't know how to reach real people, only job boards",
      'I get interviews but not offers',
      'All of the above',
    ],
    required: true,
  },
  {
    id: 'timeline',
    label: 'How soon do you need a job?',
    options: ['Within 1 month', 'Within 3 months', 'Within 6 months', 'Just exploring'],
    required: true,
  },
  {
    id: 'one_answer',
    label: 'If you get one thing answered on the call, what is it?',
    help: 'Optional, but this is the one I read out. Ask the real question.',
    text: true,
    required: false,
  },
];

/**
 * Which step a `challenge` answer points at, so the reader is shown the part of
 * the system their own answer just named. "All of the above" maps to every step
 * on purpose: it is the strongest answer, not the vaguest, and the honest
 * response to it is that they are missing the system rather than a file.
 */
export const CHALLENGE_TO_STEPS: Record<string, number[]> = {
  "I don't understand how hiring actually works here": [1],
  "My resume isn't getting responses": [2],
  "I'm applying constantly and hearing nothing back": [3],
  "I don't know how to reach real people, only job boards": [4],
  'I get interviews but not offers': [5],
  'All of the above': [1, 2, 3, 4, 5],
};
