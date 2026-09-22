/* ── Engagement content banks ─────────────────────────────────────────
   PLACEHOLDER COPY. Kiron reviews all product copy in one batch — every
   string in TIPS and QUIZ_BANK exists to prove the layout and the
   no-repeat mechanic, not as copy to ship. Don't polish the wording here;
   swap the arrays when real copy lands.

   pickNoRepeat() generalizes the pattern already proven in closeoutLines.ts
   (bank of lines, tracks what's been shown in localStorage, refuses to
   repeat until the bank cycles) so splash tips and quiz ordering share
   one mechanic instead of each screen inventing its own.
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

/** Pick an item from `pool` that hasn't been shown recently (per `storageKey`),
 *  falling back to the whole pool once everything's been seen. */
export function pickNoRepeat<T>(storageKey: string, pool: T[], idOf: (item: T) => string): T {
  const seen = readSeen(storageKey);
  const fresh = pool.filter(item => !seen.includes(idOf(item)));
  const from = fresh.length > 0 ? fresh : pool;
  const chosen = from[Math.floor(Math.random() * from.length)];
  writeSeen(storageKey, [idOf(chosen), ...seen].slice(0, Math.max(1, Math.floor(pool.length / 2))));
  return chosen;
}

export const TIPS: string[] = [
  "Placeholder tip: lead your cover letter with the outcome you'd deliver, not your job title.",
  'Placeholder tip: a tailored one-liner beats a generic paragraph every time.',
  'Placeholder tip: apply within 48 hours of a posting going live — you\'re fighting fewer applicants.',
  'Placeholder tip: turn "responsible for X" into "did X, which caused Y" on your resume.',
  'Placeholder tip: a short follow-up message after 5 business days rarely hurts, and sometimes works.',
  'Placeholder tip: match 2-3 keywords from the job ad in your first paragraph — most ATS scans reward it.',
];

export function pickTip(): string {
  return pickNoRepeat('jobhub_moment_tips_seen_v1', TIPS, t => t);
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: { text: string; correct?: boolean }[];
  explain: string;
}

export const QUIZ_BANK: QuizQuestion[] = [
  {
    id: 'task-to-achievement',
    prompt: 'Which line turns a task into an achievement?',
    choices: [
      { text: 'Responsible for customer support tickets' },
      { text: 'Resolved 40+ support tickets/week, cutting response time by 30%', correct: true },
      { text: 'Handled customer support' },
    ],
    explain: 'Placeholder explanation: a number and an outcome make a line read as impact, not a job description.',
  },
  {
    id: 'star-method',
    prompt: '"Tell me about a time you missed a deadline" — what should you lead with?',
    choices: [
      { text: 'The excuse for why it happened' },
      { text: 'The situation, briefly, then what you did about it', correct: true },
      { text: 'A different story where you didn\'t miss one' },
    ],
    explain: 'Placeholder explanation: interviewers are testing how you handle a miss, not whether you\'ve ever had one.',
  },
  {
    id: 'follow-up-timing',
    prompt: 'You applied 5 business days ago, no response. What now?',
    choices: [
      { text: 'Nothing — following up looks desperate' },
      { text: 'Send one short, polite follow-up', correct: true },
      { text: 'Apply again with a different resume' },
    ],
    explain: 'Placeholder explanation: a single short follow-up rarely costs you anything and sometimes surfaces a buried application.',
  },
  {
    id: 'weakness-question',
    prompt: '"What\'s your biggest weakness?" — best answer shape?',
    choices: [
      { text: 'A real one, plus what you\'re doing about it', correct: true },
      { text: '"I\'m a perfectionist"' },
      { text: 'Deflect — ask them a question instead' },
    ],
    explain: 'Placeholder explanation: a real weakness with a fix in progress reads as self-aware; a fake one reads as coached.',
  },
];

export function pickQuizQuestion(excludeId?: string): QuizQuestion {
  const pool = excludeId ? QUIZ_BANK.filter(q => q.id !== excludeId) : QUIZ_BANK;
  return pickNoRepeat('jobhub_quiz_seen_v1', pool.length > 0 ? pool : QUIZ_BANK, q => q.id);
}
