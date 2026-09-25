/* ────────────────────────────────────────────────────────────────────────────
   The classroom: /classroom and /classroom/:slug

   The free course, public, one page driven from this list. Same eight modules
   as the Skool classroom (source of truth for the cut and the order:
   E:\Skool\_SKOOL-FINAL-SET\README.md).

   Videos live on YouTube so they double as marketing. `youtubeId` is the bit
   after `v=` in the watch URL. Until it is filled in, the module shows a
   "going up soon" panel instead of a player, so the page is safe to ship
   half-uploaded.

   Downloads point at the /free/:slug pages, NOT the raw files. The email gate
   on those pages is deliberate (see FreeResourcePage) and the classroom must
   not become the way round it.

   Chapters come from the timestamped transcripts. They also belong in the
   YouTube description: paste `youtubeChapters(module)` output there so the
   player and this page agree.
   ──────────────────────────────────────────────────────────────────────────── */

export interface Chapter {
  /** Seconds from the start. */
  at: number;
  label: string;
}

export interface ClassroomModule {
  slug: string;
  /** Shown as "Module n". 0 = the welcome, -1 = bonus. */
  n: number;
  title: string;
  /** One line under the title: why you would press play. */
  hook: string;
  minutes: number;
  youtubeId: string;
  chapters: Chapter[];
  /** Slugs in FREE_RESOURCES. */
  resources: string[];
  /** The one thing to go and do before the next module. */
  doThis: string;
  /** Where the video says something this running order has changed. */
  note?: string;
}

const t = (m: number, s: number) => m * 60 + s;

export const CLASSROOM: ClassroomModule[] = [
  {
    slug: 'welcome',
    n: 0,
    title: 'Start here: what this is, and what it isn\'t',
    hook: 'No secrets, no fear tactics. What you are getting into before you watch a single lesson.',
    minutes: 3,
    youtubeId: '',
    chapters: [
      { at: 0, label: 'Burnt before you got here' },
      { at: t(0, 54), label: 'There are no secrets' },
      { at: t(1, 47), label: 'Learning the rules is not selling out' },
    ],
    resources: [],
    doThis: 'Write down the one thing you most want out of this course. Keep it where you will see it.',
  },
  {
    slug: 'gaps',
    n: 1,
    title: 'Why you\'re not hearing back, and 3 steps to fix it',
    hook: 'The biggest gaps people hit in the Australian market, and three things you can start today.',
    minutes: 12,
    youtubeId: '',
    chapters: [
      { at: 0, label: 'Months of applying, no replies' },
      { at: t(1, 25), label: 'A degree does not equal a job' },
      { at: t(2, 36), label: 'Passion without a plan' },
      { at: t(4, 17), label: 'Ownership' },
      { at: t(6, 46), label: 'Step 1: fix your resume' },
      { at: t(7, 40), label: 'Step 2: use a system' },
      { at: t(9, 9), label: 'Step 3: accountability' },
    ],
    resources: ['starter', 'tracker'],
    doThis: 'Rewrite one bullet on your resume from a task into an achievement with a result.',
  },
  {
    slug: 'resume',
    n: 2,
    title: 'The Australian resume, line by line',
    hook: 'What the market expects, the five biggest gaps, and a real rewrite on screen.',
    minutes: 16,
    youtubeId: '',
    chapters: [
      { at: 0, label: 'Why your resume matters' },
      { at: t(1, 36), label: 'Where ChatGPT and Claude fall over' },
      { at: t(2, 26), label: 'What a resume is actually for' },
      { at: t(4, 3), label: 'What not to include' },
      { at: t(4, 48), label: 'Achievements, not duties' },
      { at: t(5, 50), label: 'A worked example' },
      { at: t(7, 52), label: 'Keywords and Australian tone' },
      { at: t(8, 55), label: 'The five biggest mistakes' },
      { at: t(14, 2), label: 'Your free template' },
    ],
    resources: ['resume'],
    doThis: 'Rewrite your top three bullets as achievements, using the before and after as your guide.',
  },
  {
    slug: 'cover-letters',
    n: 3,
    title: 'Cover letters and selection criteria',
    hook: 'The document most people get wrong, and the one most international grads have never heard of.',
    minutes: 20,
    youtubeId: '',
    chapters: [
      { at: 0, label: 'What this covers' },
      { at: t(2, 12), label: 'Resume vs cover letter vs criteria' },
      { at: t(3, 48), label: 'The STAR framework' },
      { at: t(7, 16), label: 'Plan before you write' },
      { at: t(8, 23), label: 'Writing the cover letter' },
      { at: t(10, 25), label: 'Writing selection criteria' },
      { at: t(11, 55), label: 'The Australian tone' },
      { at: t(14, 8), label: 'Five mistakes that cost the job' },
      { at: t(17, 31), label: 'Doing it faster' },
    ],
    resources: ['cover-letter', 'criteria'],
    doThis: 'Write one STAR story from your own work. You will use it in cover letters and interviews.',
    note: 'The video ends by pointing to interviews. In this course LinkedIn and job sources come first; interviews are Module 7.',
  },
  {
    slug: 'linkedin',
    n: 4,
    title: 'Set up LinkedIn so recruiters can find you',
    hook: 'What a recruiter actually does at 9am on a Monday. If you\'re not in those results, you don\'t exist.',
    minutes: 7,
    youtubeId: '',
    chapters: [
      { at: 0, label: 'What the recruiter sees' },
      { at: t(1, 43), label: 'Your headline' },
      { at: t(2, 27), label: 'The About section' },
      { at: t(2, 48), label: 'Open to Work' },
      { at: t(3, 49), label: 'Skills and photo' },
      { at: t(4, 30), label: 'A worked example' },
      { at: t(6, 16), label: 'Stay active every week' },
    ],
    resources: ['linkedin'],
    doThis: 'Change your headline to the job title you want, then turn on Open to Work.',
    note: 'The video says connection notes are capped at 300 words. It is 300 characters.',
  },
  {
    slug: 'find-jobs',
    n: 5,
    title: 'Where the jobs are, and the system to work them',
    hook: 'Seek is the visible 20%. A real multi-channel strategy, and the tracker that makes it work.',
    minutes: 8,
    youtubeId: '',
    chapters: [
      { at: 0, label: 'Seek is not the job market' },
      { at: t(1, 26), label: 'The platforms worth using' },
      { at: t(2, 29), label: 'The 50/30/20 rule' },
      { at: t(2, 57), label: 'Specialist recruiters' },
      { at: t(3, 31), label: 'Build the tracker, live' },
      { at: t(4, 0), label: 'Make roles come to you' },
      { at: t(4, 45), label: 'Your target company list' },
      { at: t(5, 13), label: 'Follow up after 10 days' },
    ],
    resources: ['tracker', 'followup'],
    doThis: 'List 20 companies you genuinely want to work for and set a Seek alert for your role.',
    note: 'The video ends by pointing to "video seven" for outreach. That is Module 6, Networking, next.',
  },
  {
    slug: 'networking',
    n: 6,
    title: 'Networking that gets replies, without feeling fake',
    hook: 'Networking isn\'t asking for a job. It\'s making friends, and there\'s a method to it.',
    minutes: 16,
    youtubeId: '',
    chapters: [
      { at: 0, label: 'The mistake almost everyone makes' },
      { at: t(2, 27), label: 'Junior vs senior contacts' },
      { at: t(5, 40), label: 'Build your list' },
      { at: t(7, 45), label: 'What never to say first' },
      { at: t(10, 0), label: 'Opening the conversation' },
      { at: t(12, 5), label: 'The third message' },
      { at: t(13, 1), label: 'Moving to a call' },
      { at: t(14, 50), label: 'Why it compounds' },
    ],
    resources: ['networking'],
    doThis: 'Pick five people at your target companies and send one of them a first message today.',
  },
  {
    slug: 'interview',
    n: 7,
    title: 'Walk into an Australian interview and perform',
    hook: 'The questions you\'ll actually get, how to handle the unexpected ones, and the visa question.',
    minutes: 13,
    youtubeId: '',
    chapters: [
      { at: 0, label: 'What an interview really is' },
      { at: t(1, 32), label: 'Cultural expectations' },
      { at: t(2, 46), label: 'Tell me about yourself' },
      { at: t(3, 38), label: 'What value will you bring?' },
      { at: t(3, 59), label: 'Strengths and weaknesses' },
      { at: t(5, 11), label: 'Behavioural questions' },
      { at: t(8, 22), label: 'The cultural test' },
      { at: t(9, 52), label: 'On the day' },
      { at: t(10, 9), label: 'The visa question' },
      { at: t(11, 36), label: 'Scripts and follow-up' },
    ],
    resources: ['interview', 'sponsors'],
    doThis: 'Say your "tell me about yourself" answer out loud and record it. Present, past, future.',
  },
  {
    slug: 'system',
    n: 8,
    title: 'Put it together into one system',
    hook: 'The parts are done. This is how they combine into something you can run every week.',
    minutes: 13,
    youtubeId: '',
    chapters: [
      { at: 0, label: 'Do you have a system?' },
      { at: t(1, 41), label: 'Targeting' },
      { at: t(4, 26), label: 'Tailor every application' },
      { at: t(6, 25), label: 'Track everything' },
      { at: t(8, 2), label: 'Rejection is not about you' },
      { at: t(9, 3), label: 'Set a target and meet it' },
      { at: t(11, 6), label: 'Networking inside the system' },
    ],
    resources: ['templates'],
    doThis: 'Set a weekly application target you know you can hit, and put it where you will see it.',
  },
  {
    slug: 'primer',
    n: -1,
    title: 'Bonus: how the Australian market actually works',
    hook: 'Optional background. The cultural rules underneath everything else in the course.',
    minutes: 9,
    youtubeId: '',
    chapters: [],
    resources: ['rules'],
    doThis: 'Read the cheat sheet once, then keep it open while you write your next application.',
  },
];

export function findModule(slug: string | undefined): ClassroomModule | null {
  return CLASSROOM.find((m) => m.slug === slug) ?? null;
}

export function formatTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** The chapter block for the YouTube description. YouTube needs the first at 0:00. */
export function youtubeChapters(m: ClassroomModule): string {
  return m.chapters.map((c) => `${formatTime(c.at)} ${c.label}`).join('\n');
}
