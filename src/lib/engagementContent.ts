/* ── Engagement content banks ─────────────────────────────────────────
   The questions that ride along with the post-application popup.

   Two rules learned the hard way:

   1. Every question states WHERE it applies before it asks anything. A
      question floating without a setting ("Which line is better?") makes
      the reader do the work of guessing whether this is about a resume, a
      cover letter or a phone screen. `context` is that setting and it is
      not optional.

   2. There has to be real variety. Somebody working the program properly
      sees this popup five to ten times a day for ninety days — that is
      several hundred showings. The scenarios repeat by necessity, but the
      dressing must not: different roles, different industries, different
      phrasings of the same underlying lesson.

   pickNoRepeat() generalizes the mechanic already proven in
   closeoutLines.ts: a bank, a record of what has been shown, and no
   repeat until the bank cycles.
*/

function readSeen(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeSeen(key: string, next: string[]): void {
  try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* noop */ }
}

/** Pick from `pool` avoiding anything shown recently, per `storageKey`. */
export function pickNoRepeat<T>(storageKey: string, pool: T[], idOf: (item: T) => string): T {
  const seen = readSeen(storageKey);
  const fresh = pool.filter(item => !seen.includes(idOf(item)));
  const from = fresh.length > 0 ? fresh : pool;
  const chosen = from[Math.floor(Math.random() * from.length)];
  // Remember most of the bank, not half: at several hundred showings a
  // short memory is indistinguishable from no memory.
  writeSeen(storageKey, [idOf(chosen), ...seen].slice(0, Math.max(1, pool.length - 4)));
  return chosen;
}

export const TIPS: string[] = [
  'Lead your cover letter with the outcome you would deliver, not your job title.',
  'A tailored first line beats a whole generic paragraph.',
  'Apply within 48 hours of a posting going live — you are competing with fewer people.',
  'Turn "responsible for X" into "did X, which caused Y".',
  'A short follow-up after five business days rarely hurts, and sometimes works.',
  'Mirror two or three exact phrases from the ad in your first paragraph.',
  'One specific number in a bullet does more than three adjectives.',
  'If the ad names a tool you have used once, name it back. Once is experience.',
];

export function pickTip(): string {
  return pickNoRepeat('jobhub_moment_tips_seen_v1', TIPS, t => t);
}

export interface QuizQuestion {
  id: string;
  /** Where this applies — always shown above the question. */
  context: string;
  prompt: string;
  choices: { text: string; correct?: boolean }[];
  explain: string;
}

/* Scenarios repeat; the dressing does not. Roles, industries and phrasing
   are varied on purpose so the twentieth showing of "quantify your
   bullets" does not read as the same card again. */
export const QUIZ_BANK: QuizQuestion[] = [
  // ── Resume: turning duties into achievements ──────────────────────
  {
    id: 'resume-achievement-support',
    context: 'On your resume',
    prompt: 'Which line turns a duty into an achievement?',
    choices: [
      { text: 'Responsible for customer support tickets' },
      { text: 'Resolved 40+ tickets a week, cutting average response time by 30%', correct: true },
      { text: 'Handled customer support daily' },
    ],
    explain: 'A number and a result make it impact. Without them it is a job description, and the hiring manager already knows what the job is.',
  },
  {
    id: 'resume-achievement-retail',
    context: 'On your resume, describing a retail job',
    prompt: 'Which one would a hiring manager actually remember?',
    choices: [
      { text: 'Worked on the shop floor and helped customers' },
      { text: 'Duties included sales, stock and register' },
      { text: 'Top seller 3 months running in a team of 12, averaging $4k a week', correct: true },
    ],
    explain: 'Rank, scale, money. Casual work counts as real experience the moment you describe it in numbers.',
  },
  {
    id: 'resume-achievement-admin',
    context: 'On your resume, describing admin work',
    prompt: 'Pick the strongest bullet.',
    choices: [
      { text: 'Rebuilt the filing system, cutting document retrieval from 10 minutes to under 1', correct: true },
      { text: 'Responsible for filing and document management' },
      { text: 'Assisted with various administrative tasks as required' },
    ],
    explain: 'Before and after. "10 minutes to under 1" tells a story in six words.',
  },
  {
    id: 'resume-gap',
    context: 'On your resume, covering a six-month gap',
    prompt: 'What is the best way to handle it?',
    choices: [
      { text: 'Leave it out and hope nobody notices' },
      { text: 'Name it in one line with what you did — study, caring, a project', correct: true },
      { text: 'Stretch the previous role\'s end date to cover it' },
    ],
    explain: 'Gaps are normal and stretched dates get caught at reference check. One honest line closes the subject.',
  },
  {
    id: 'resume-length',
    context: 'On your resume, as a recent graduate',
    prompt: 'How long should it be?',
    choices: [
      { text: 'One to two pages', correct: true },
      { text: 'Four or more, to show everything you have done' },
      { text: 'Exactly one page, always' },
    ],
    explain: 'Two pages is fine and normal in Australia. Four means nothing has been prioritised, which is itself a signal.',
  },

  // ── Interview answers ─────────────────────────────────────────────
  {
    id: 'interview-missed-deadline',
    context: 'In an interview, you are asked',
    prompt: '"Tell me about a time you missed a deadline." What do you lead with?',
    choices: [
      { text: 'The reason it was not your fault' },
      { text: 'The situation briefly, then what you did about it', correct: true },
      { text: 'A different story where you did not miss one' },
    ],
    explain: 'They are testing how you handle a miss, not whether you have ever had one. Dodging the question answers it badly.',
  },
  {
    id: 'interview-weakness',
    context: 'In an interview, you are asked',
    prompt: '"What is your biggest weakness?"',
    choices: [
      { text: 'A real one, plus what you are doing about it', correct: true },
      { text: '"I am a perfectionist"' },
      { text: 'Turn it around and ask them a question' },
    ],
    explain: 'A real weakness with a fix in progress reads as self-aware. A humblebrag reads as coached, and they have heard it today already.',
  },
  {
    id: 'interview-why-us',
    context: 'In an interview, you are asked',
    prompt: '"Why do you want to work here?"',
    choices: [
      { text: 'Something specific about their work you can point to', correct: true },
      { text: 'Because it is a great company with great culture' },
      { text: 'Because you are looking for your next opportunity' },
    ],
    explain: 'Specificity proves you researched them. The other two answers apply to every employer in the country.',
  },
  {
    id: 'interview-salary',
    context: 'In a first-round interview, you are asked',
    prompt: '"What are your salary expectations?"',
    choices: [
      { text: 'A researched range, with a note that you are flexible on the right role', correct: true },
      { text: '"Whatever you think is fair"' },
      { text: 'Refuse to answer until they make an offer' },
    ],
    explain: 'A range shows you have done market research. Deferring entirely hands over the anchor and can price you low.',
  },
  {
    id: 'interview-no-experience',
    context: 'In an interview, they mention a tool you have never used',
    prompt: 'Best response?',
    choices: [
      { text: 'Say you have used it, and learn it before you start' },
      { text: 'Say no, then name the closest thing you have learned and how fast', correct: true },
      { text: 'Change the subject to something you do know' },
    ],
    explain: 'Nobody expects every box ticked. Evidence that you pick things up quickly is the thing actually being assessed.',
  },
  {
    id: 'interview-questions-for-them',
    context: 'At the end of an interview',
    prompt: '"Do you have any questions for us?"',
    choices: [
      { text: '"No, I think you covered everything"' },
      { text: 'Two questions about the role or the team, prepared beforehand', correct: true },
      { text: 'Ask about annual leave and working from home' },
    ],
    explain: 'Having none reads as low interest. Save conditions for when there is an offer on the table.',
  },

  // ── Follow-up and outreach ────────────────────────────────────────
  {
    id: 'followup-timing',
    context: 'You applied five business days ago and heard nothing',
    prompt: 'What now?',
    choices: [
      { text: 'Nothing — following up looks desperate' },
      { text: 'One short, polite follow-up', correct: true },
      { text: 'Apply again with a different resume' },
    ],
    explain: 'One short follow-up rarely costs anything and sometimes surfaces an application that was buried. Applying twice just looks disorganised.',
  },
  {
    id: 'outreach-cold-message',
    context: 'Messaging someone at a company you just applied to',
    prompt: 'Which opener gets a reply?',
    choices: [
      { text: '"Hi, I am looking for opportunities. Can you help?"' },
      { text: '"Hi — I applied for the coordinator role. Is the team hiring for X or Y work?"', correct: true },
      { text: '"Please review my resume and let me know."' },
    ],
    explain: 'One specific, answerable question is easy to reply to. A request to be helped in general is work for them, so it gets ignored.',
  },
  {
    id: 'outreach-who',
    context: 'Reaching out about a role',
    prompt: 'Who is most likely to reply?',
    choices: [
      { text: 'The CEO' },
      { text: 'Someone doing the job you applied for, or the hiring manager', correct: true },
      { text: 'The generic careers inbox' },
    ],
    explain: 'People answer about their own work. Executives are the least reachable and the least informed about a junior opening.',
  },
  {
    id: 'outreach-after-rejection',
    context: 'You were rejected after a final interview',
    prompt: 'Worth replying?',
    choices: [
      { text: 'Yes — thank them and ask to be kept in mind', correct: true },
      { text: 'No, it is over, move on' },
      { text: 'Ask them to reconsider the decision' },
    ],
    explain: 'The runner-up gets called when the first choice declines or the next role opens. That only works if you left well.',
  },
  {
    id: 'networking-event',
    context: 'At a networking event',
    prompt: 'What is the goal of a first conversation?',
    choices: [
      { text: 'Hand over as many resumes as you can' },
      { text: 'One real conversation and permission to follow up', correct: true },
      { text: 'Speak to whoever is most senior in the room' },
    ],
    explain: 'Referrals come from people who remember you. Twenty forgettable hellos are worth less than one conversation you can continue on Monday.',
  },

  // ── Cover letters and applications ────────────────────────────────
  {
    id: 'cover-letter-opening',
    context: 'In your cover letter',
    prompt: 'Which opening line works hardest?',
    choices: [
      { text: '"I am writing to apply for the position advertised on Seek."' },
      { text: '"I have three years of coordination experience and a strong interest in your company."' },
      { text: '"Your ad asks for someone who can run events end to end — I ran 40 last year."', correct: true },
    ],
    explain: 'Answer their ad in the first sentence. The other two spend the most valuable line on information they already have.',
  },
  {
    id: 'ats-keywords',
    context: 'Tailoring an application to the ad',
    prompt: 'Why match the ad\'s exact wording?',
    choices: [
      { text: 'It flatters the person who wrote the ad' },
      { text: 'Many employers screen on keywords before a human reads it', correct: true },
      { text: 'It makes the application longer' },
    ],
    explain: 'If the ad says "stakeholder engagement", write that, not "talking to clients". A screen that never surfaces you is the same as a rejection.',
  },
  {
    id: 'application-one-ad',
    context: 'You find one ad that fits you perfectly',
    prompt: 'What is the right amount of effort?',
    choices: [
      { text: 'The same generic resume you send everywhere' },
      { text: 'Tailor it properly, even if it takes 20 minutes', correct: true },
      { text: 'Apply twice, once generic and once tailored' },
    ],
    explain: 'The whole method is fewer, better applications. A perfect-fit ad is exactly where the extra twenty minutes pays.',
  },
  {
    id: 'application-underqualified',
    context: 'An ad asks for 5 years and you have 2',
    prompt: 'Apply or skip?',
    choices: [
      { text: 'Apply, if you meet most of the core requirements', correct: true },
      { text: 'Skip it, you will waste everyone\'s time' },
      { text: 'Apply and say you have 5 years' },
    ],
    explain: 'Years listed are usually a wish, not a filter. Meeting most of the core requirements is enough to be worth reading.',
  },
];

export function pickQuizQuestion(excludeId?: string): QuizQuestion {
  const pool = excludeId ? QUIZ_BANK.filter(q => q.id !== excludeId) : QUIZ_BANK;
  return pickNoRepeat('jobhub_quiz_seen_v1', pool.length > 0 ? pool : QUIZ_BANK, q => q.id);
}
