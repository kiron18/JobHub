/* ────────────────────────────────────────────────────────────────────────────
   The 90-day challenge intro: the one-time screen a member sees the first
   time they reach the dashboard. Pressing the button makes that day Day 1.

   Kiron's copy, 2026-10-03, replacing the five-step draft: a heading, one
   line under it, the challenge in two short paragraphs, then the walkthrough
   video. Change the words freely; keep the shape.
   ──────────────────────────────────────────────────────────────────────────── */
import { WALKTHROUGH } from './classroom';

export const CHALLENGE_INTRO = {
  title: 'Start the 90 day challenge',

  subtitle: 'See your applications transform into interviews, then offers.',

  challengeHeading: 'Here’s the challenge',

  /** One sentence, with its bolded phrase kept separate so the words stay editable here. */
  challenge: {
    before: 'Spend just 60-90 minutes per day sending out high quality applications and outreach ',
    bold: 'with a few simple clicks',
    after: '.',
  },

  challengeFollow: 'Applying and following up has never been easier.',

  videoHeading: 'See how it’s done',

  /** The Classroom walkthrough: one application, start to finish. */
  videoId: WALKTHROUGH.youtubeId,

  button: 'Start my 90 days',
};
