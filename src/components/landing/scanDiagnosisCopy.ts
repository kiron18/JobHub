// Locked copy for the CV scan diagnosis screen. Static, hand-written.
// Do NOT paraphrase or "improve". No em dashes or en dashes anywhere.

export const scanDiagnosisCopy = {
  header: (firstName: string) =>
    firstName
      ? `${firstName}, here's what a recruiter sees in 6 seconds.`
      : `Here's what a recruiter sees in 6 seconds.`,
  subline: `Four things decide whether your resume gets read. Here's how yours scores.`,

  labels: {
    ats: `ATS readiness`,
    impact: `Impact vs duties`,
    relevance: `Australian market fit`,
    presentation: `Recruiter readability`,
  },

  // Shared affordance shown on every card so it reads as openable, not a flat square.
  expandCue: `See the breakdown`,

  ats: {
    passHeadline: `ATS ready`,
    failHeadline: `At risk`,
    passSub: `No tables, columns or text boxes. Your resume clears the gate.`,
    failSub: `Tables or columns can scramble the scan before a human ever sees it.`,
    education: `Most Australian employers auto-scan every resume before a person looks at it. Text boxes, tables and columns scramble that scan, so a strong resume can score near zero and get filtered out before anyone reads a word.`,
  },

  impact: {
    headline: (outcomes: number, total: number) => `${outcomes} of ${total} bullets show outcomes`,
    sub: (duties: number) => `${duties} describe tasks. Recruiters hire for results, not effort.`,
    allGoodHeadline: `Every bullet shows outcomes`,
    allGoodSub: `Your bullets lead with results. Keep doing this.`,
    flipFront: `What you wrote`,
    flipBack: `What gets read`,
    caption: (duty: number) => `We found ${duty} bullets like this. Here's one.`,
  },

  relevance: {
    headline: (present: number, expected: number) => `${present} of ${expected} keywords matched`,
    strong: `Speaks to most of what local employers scan for.`,
    partial: `Hits some terms local employers scan for, but misses several.`,
    weak: `Misses most of the terms local employers scan for in your field.`,
    matchedLabel: `In your resume`,
    missingLabel: `Missing and expected`,
    expandLine: `Green is already in your resume. Red is missing and expected by local employers.`,
  },

  presentation: {
    headline: (n: number) => `${n} ${n === 1 ? 'issue' : 'issues'} found`,
    sub: `Things that slow a recruiter down on a 6-second skim.`,
    allGoodHeadline: `Clean and skimmable`,
    allGoodSub: `Nothing slowing a recruiter down on a 6-second skim.`,
  },

  authorityBridge: `We have seen this a thousand times, so let's be straight with you. Right now you are about to spend another month tweaking this resume, sending it into the void, and hearing nothing back. That silence is not about your talent. It is about everything a resume on its own can never do.`,

  cta: {
    headline: `You don't need a better resume.`,
    headlineLine2: `A better resume won't get you hired. A system will.`,
    body: `Everything you just saw, we fix automatically, on every job you apply to. Then we show you the Australian employers hiring right now. That is the difference between a better document and an actual job.`,
    emailPlaceholder: `Enter your email`,
    button: `Put it to work`,
    honesty: `Free to start. No card. This takes a few weeks of real effort, not a magic button, and we will show you exactly how.`,
    emptyNudge: `Pop your email in and we'll get you set up.`,
  },
} as const;
