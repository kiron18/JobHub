// =============================================================================
// cvScanCopy — locked, product-owner-authored copy for the CV scan reveal.
// Do not reword inline. No em or en dashes anywhere. Australian English.
// =============================================================================

export const cvScanCopy = {
  // Free section — the diagnosis.
  woundKicker: (firstName?: string) =>
    firstName ? `${firstName}, here is what a recruiter sees first` : 'Here is what a recruiter sees first',
  diagnosisHeading: 'What is costing you callbacks',
  insiderHeading: 'What they are not telling you',

  // Stakes — static, honest, no invented numbers about this person.
  stakes:
    'Right now most of these applications end in silence. Not because you are not good enough, but because your resume never makes the case in the six seconds it gets.',

  // The wall — gate the cure, not more problems.
  wall: {
    heading: 'You can see what is wrong. Here is how to fix all of it.',
    sub: 'The full fix list, step by step, plus the Australian hiring rules nobody tells you. Career coaches charge hundreds for this read. Yours is free, I just need an email to send it.',
    placeholder: 'Enter your email',
    button: 'Send me the fixes',
    buttonLoading: 'Building your fixes',
    privacy: 'We email your fix list and job-search tips. No spam, unsubscribe anytime.',
    scanAnother: 'Scan a different CV',
  },

  // Post-email — the cure.
  reassuranceFallback:
    'This is not a talent problem. Your experience is real, it is just written in a way Australian employers do not read. That is learnable, and you are about to.',
  fixesHeading: 'Your fixes, in order',

  // Bridge to the app — gate the machine and the jobs behind signup.
  bridge: {
    heading: 'Fixing this once is the easy part.',
    body: 'The real reason good people stay stuck here is they fix one resume, then send it into a void, to jobs that may not even sponsor a visa. We rewrite your resume for every job automatically, and show you the Australian employers hiring and sponsoring right now.',
    button: 'Set up my job search',
    subtext: 'Free to start. No card needed.',
  },
} as const;
