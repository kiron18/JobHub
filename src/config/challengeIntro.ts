/* ────────────────────────────────────────────────────────────────────────────
   The 90-day challenge intro: the one-time screen a member sees the first
   time they reach the dashboard. Pressing the button makes that day Day 1.

   DRAFT COPY, 2026-09-30, for Kiron to edit. Change the words freely; keep
   the shape (a title, a lead, a handful of steps, a close, a button).
   ──────────────────────────────────────────────────────────────────────────── */

export const CHALLENGE_INTRO = {
  eyebrow: 'Your 90-day challenge',

  title: 'Welcome. Here is how the next 90 days work.',

  lead:
    'Consistency over time beats short bursts of activity. ' +
    'You now have access to a streamlined system and all the resources you need to land a job. ' +
    'For the next 90 days, that is the whole job: send a few high-quality ' +
    'applications, reach a few real people consistently.',

  steps: [
    {
      title: 'Set your daily goal',
      body:
        'Before anything else, choose how many roles you will apply to today, between 5 and 10. Once it is set, ' +
        'it is locked for the day. Doing more raises it on its own, and you get one undo if you can’t make it.',
    },
    {
      title: 'Apply with JobHub',
      body:
        'Paste a job ad and check it is worth your time. Your resume and cover letter are written for that ad. ' +
        'Read them and make small edits with the Edit button so they sound like you.',
    },
    {
      title: 'Reach a real person',
      body:
        'After each application, message someone at the company. And if you run out of good roles, switch the ' +
        'rest of the day to outreach: two messages for each application you could not send.',
    },
    {
      title: 'Learn as you go',
      body:
        'The Classroom under Resources has short videos and free templates for every step: the Australian ' +
        'resume, cover letters, LinkedIn, networking and interviews.',
    },
    {
      title: 'Close out each day',
      body:
        'Before you log off, tap End my day. Tick how it went and what you will do first tomorrow.',
    },
  ],

  close: 'Show up tomorrow, and the day after. Consistency is what compounds.',

  button: 'Start my 90 days',
};
