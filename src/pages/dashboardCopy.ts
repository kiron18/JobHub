/**
 * dashboardCopy.ts — ALL user-facing copy for the streamlined dashboard
 * (Slice B: matched-jobs Apply-now feed, paste-JD safety net, hidden panels).
 *
 * Authored for JobHub's ICP (international grads / skilled migrants in
 * Australia). Voice = calm, momentum-forward, agency-giving. The dashboard has
 * one job: get them applying to the next role.
 *
 * ⚠️ Single source of truth for these strings. Do NOT reword, paraphrase,
 * inline alternatives, or "improve" any of it. Import and render verbatim.
 */

export const dashboardCopy = {
  // Header (replaces the old "paste any JD" headline).
  header: {
    headline: 'Your next Australian role is one click away.',
    subline:
      "These roles match your profile. Pick one — we'll build the tailored resume and cover letter, you just review and send.",
    applicationsLink: 'Your applications',
  },

  // The matched-jobs section.
  matched: {
    label: 'Roles that fit you',
    building: 'Finding roles that fit you…',
    buildingSub: "Hang tight — we're scanning live listings against your profile.",
    empty: "No live matches right now. Paste a specific job below and we'll tailor for it.",
    profileIncomplete: 'Add your target role and city and we’ll match you to live roles.',
    profileIncompleteCta: 'Complete your profile',
    error: "Couldn't load your matches just now. Paste a specific job below to keep moving.",
  },

  // The lean Apply-now card.
  applyCard: {
    cta: 'Apply now',
  },

  // The secondary paste-your-own-JD safety net.
  paste: {
    toggle: 'Have a specific job? Paste it',
    placeholder: 'Paste the full job description here…',
    cta: 'Tailor my application',
  },
} as const;
