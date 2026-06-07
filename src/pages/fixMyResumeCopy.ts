/**
 * Fix-my-Resume → job-selection modal — ALL user-facing copy.
 *
 * Authored deliberately for JobHub's ICP (international grads / skilled migrants in
 * Australia: anxious, repeatedly rejected, visa-pressured, burned by other tools).
 * Voice = honest, momentum-forward, agency-giving; says the quiet part out loud
 * (local experience matters, get-your-foot-in-the-door realism) without lecturing.
 *
 * ⚠️ This file is the single source of truth for these strings. Do NOT reword,
 * paraphrase, inline alternative copy, or "improve" any of it. Import and render
 * verbatim. `{firstName}` / `{count}` are runtime values supplied via the functions.
 */

export const fixMyResumeCopy = {
  // CTA that sits directly under the 7-step roadmap.
  cta: {
    // Bridges the gut-punch report into action. Ties back to the report's framing
    // ("What's costing you callbacks").
    bridge: "You've seen what's costing you callbacks. Now let's fix it, starting with the jobs worth winning.",
    button: 'Fix my Resume',
    eta: 'Takes about a minute. We do the heavy lifting.',
  },

  // The job-selection modal (modal-IS-the-wait: scrape runs while they read/edit).
  modal: {
    // Shown briefly while we infer titles from the resume.
    thinking: 'Reading your resume…',
    // {firstName} may be empty — the function handles both.
    header: (firstName: string): string =>
      firstName
        ? `Hey ${firstName}, while you check these we're already finding your jobs.`
        : "While you check these, we're already finding your jobs.",
    subhead:
      'The roles you can realistically land in Australia right now. Not the dream title, the one that gets your foot in the door.',
    rolesLabel: 'Your best-fit roles',
    rolesHint: 'Up to 3 · tap to edit',
    addRole: '+ add a role',
    locationLabel: 'Where are you looking?',
    locationNudge:
      'Local roles get more callbacks. Recruiters back people they can meet. Search anywhere you like, though.',
    // Button label while the background scrape is still running.
    searching: 'Finding your matches…',
    // Button label once results are ready.
    ctaReady: 'See my jobs',
    // Shown when the scrape errored or returned nothing — still lets them proceed.
    emptyOrError:
      "Couldn't pull live matches for that just now. Try another title or location, or jump in anyway.",
  },

  // Terminal success state for this slice (dashboard handoff comes later).
  success: {
    title: (count: number): string =>
      `Found ${count} ${count === 1 ? 'role' : 'roles'} that fit you.`,
    sub: "We're lining them up into your workspace. This is where it starts turning into interviews.",
  },

  // scanId TTL expired before they finished.
  expired: {
    title: 'Your session timed out.',
    body: "Re-run your scan and we'll pick up right where you left off.",
  },
} as const;
