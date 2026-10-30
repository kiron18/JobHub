/* ────────────────────────────────────────────────────────────────────────────
   The 90-day challenge intro: the one-time screen a member sees the first
   time they reach the dashboard. Pressing the button makes that day Day 1.

   Kiron's copy, 2026-10-30, replacing the 2026-10-03 paragraph: a heading,
   one line under it, how it works as three points, one closing line, then the
   walkthrough video. Change the words freely; keep the shape.
   ──────────────────────────────────────────────────────────────────────────── */
import { WALKTHROUGH } from './classroom';

export const CHALLENGE_INTRO = {
  title: 'Start the 90 day challenge',

  subtitle: 'See your applications turn into interviews, and then offers.',

  challengeHeading: 'Here’s how it works',

  /** Each point leads with its bolded phrase, kept separate so the words stay editable here. */
  points: [
    {
      bold: 'Apply in under 5 minutes.',
      rest: 'Our click-based application workflow finds the job and writes the application, with a personalised follow-up email to the key decision makers included.',
    },
    {
      bold: 'Get referred in under 3 minutes.',
      rest: 'Our click-based outreach workflow finds the people in your industry who can refer you, and writes the message.',
    },
    {
      bold: 'Stay consistent.',
      rest: 'Track every application, and use the visa sponsor list, personalised interview cheat sheets, LinkedIn optimisation and lessons on Aussie work culture.',
    },
  ],

  challengeFollow: 'We’ve built the system for you. Show up for 1 hour a day for 90 days, and get hired.',

  videoHeading: 'See how it’s done',

  /** The Classroom walkthrough: one application, start to finish. */
  videoId: WALKTHROUGH.youtubeId,

  button: 'Start my 90 days',
};
