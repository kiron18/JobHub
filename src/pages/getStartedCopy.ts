/**
 * Get-Started modal (account seam) — ALL user-facing copy.
 * Single source of truth. Import and render verbatim. Do NOT reword or inline.
 * {firstName} / {email} / {count} are runtime values supplied via the functions.
 */
export const getStartedCopy = {
  header: (firstName: string): string =>
    firstName ? `One step left, ${firstName}.` : 'One step left.',
  subhead: "Set a password and we'll save your plan, then line up jobs you can actually land.",

  accountLabel: 'Your account',
  emailPrefix: 'Saving to',
  passwordLabel: 'Choose a password',
  passwordPlaceholder: 'At least 8 characters',

  rolesLabel: "Roles we'll search for you",
  rolesHint: 'Up to 3, tap to edit',
  addRole: '+ add a role',
  locationLabel: "Where you're looking",
  locationNudge: 'Local roles get more callbacks. You can search anywhere.',

  submit: 'Take me to my fixes',
  submitting: 'Getting your fixes ready…',
  // Rotating reassurance while the live job scrape runs (a real ~20s wait).
  buildingSteps: [
    'Saving your plan…',
    'Searching live roles you can actually land…',
    'Filtering out the listings that auto-reject overseas experience…',
    'Lining up your matches. Almost there…',
  ],
  consent: "We'll email you job matches and tips. Unsubscribe anytime.",

  errPasswordShort: 'Use at least 8 characters.',
  errSignup: "Couldn't create your account. Try again, or log in if you already have one.",
  errClaim: "Your account is ready, but we hit a snag setting things up. Tap to retry.",
  expiredTitle: 'Your scan timed out.',
  expiredBody: "Re-run your scan and we'll pick up right where you left off.",
} as const;
