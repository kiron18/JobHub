/**
 * Curated, qualitative insights for the Strategy Hub side panel.
 *
 * No fabricated statistics, no LLM. Each insight must be true or directional
 * for the target audience (international graduates job-hunting in Australia).
 * Rotation: a random sample of three on each dashboard mount, sampled without
 * replacement until the pool exhausts and then resets.
 */

export interface StrategicInsight {
  id: string;
  text: string;
  category: 'market' | 'framing' | 'process';
}

export const STRATEGIC_INSIGHTS: StrategicInsight[] = [
  {
    id: 'apac-focus',
    text: "If your story includes another country, lean toward APAC-facing firms. International experience reads as an asset there, not a question mark.",
    category: 'market',
  },
  {
    id: 'asx-recruiters',
    text: "A lot of ASX-listed roles are filled by external recruiters before the company posting moves. If you spot the same job on a recruiter's site, apply there — that's where the shortlist actually lives.",
    category: 'process',
  },
  {
    id: 'group-of-eight',
    text: "If your university isn't well-known here, give the recruiter a hand: one line like \"IIT Delhi (comparable to Group of Eight)\" turns an unknown name into a familiar reference point. It is not bragging, it is translation.",
    category: 'framing',
  },
  {
    id: 'aps-format',
    text: "Government roles are a different beast. Selection-criteria responses aren't a cover letter — they're a separate document, structured, evidence-led. Treating them as a normal application is the most common reason a strong candidate doesn't make the shortlist.",
    category: 'process',
  },
  {
    id: 'cover-letter-length',
    text: "Australian cover letters are shorter than US ones. One page. No flourish. Lead with what you did, not how excited you are. The instinct to fill more space usually weakens the application.",
    category: 'framing',
  },
  {
    id: 'pr-citizenship',
    text: "Some roles will ask for PR or citizenship. Most do not. Before you spend an hour tailoring, scan the requirements for the words \"permanent resident\" or \"citizen\" — skip the ones that block you, focus the time on the ones you can actually win.",
    category: 'market',
  },
  {
    id: 'growing-industries',
    text: "If you are open on industry, these are the ones hiring international graduates in 2026: renewables, aged care, infrastructure, fintech. Not the only path, but a softer landing if your current targeting feels stuck.",
    category: 'market',
  },
  {
    id: 'melbourne-vs-sydney',
    text: "Same role, different city, different tone. Melbourne reads more collegial. Sydney reads more direct. The same cover letter can land warmly in one city and read as overplayed in the other — worth a small tonal pass when you switch.",
    category: 'framing',
  },
  {
    id: 'follow-up-window',
    text: "If a recruiter has gone quiet for a week, a short, specific follow-up usually beats silence. Not a chase — a one-line nudge that references something specific from the role. Most candidates do not do this, which is exactly why it works.",
    category: 'process',
  },
  {
    id: 'avoid-us-jargon',
    text: "\"Rockstar\", \"ninja\", \"10x\" — these read as imported jargon here, and they do not signal what you think they signal. Plain words about what you actually did will land harder every time.",
    category: 'framing',
  },
  {
    id: 'personal-interests',
    text: "An Australian resume can include one short personal-interests line. It is not unprofessional here — and on a dense CV, it gives a recruiter one human thing to ask you about in the screening call. Small lever, often underrated.",
    category: 'framing',
  },
  {
    id: 'visa-transparency',
    text: "If a role has visa constraints, mention your status up front — one line, neutral, factual. Silence reads as something to hide. A clear sentence reads as someone who has done their homework. The honest version almost always plays better.",
    category: 'framing',
  },
];

/**
 * Return three insights for display, rotating through the pool without
 * replacement across mounts. Uses sessionStorage so each refresh shows
 * different insights without exhausting the user across a single session.
 */
export function pickInsights(count = 3): StrategicInsight[] {
  if (typeof window === 'undefined') return STRATEGIC_INSIGHTS.slice(0, count);

  const KEY = 'strategicInsights:seenIds';
  let seen: string[] = [];
  try {
    seen = JSON.parse(sessionStorage.getItem(KEY) || '[]');
  } catch {
    seen = [];
  }

  const allIds = STRATEGIC_INSIGHTS.map((i) => i.id);
  const unseen = allIds.filter((id) => !seen.includes(id));
  const pool = unseen.length >= count ? unseen : allIds;

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(count, shuffled.length));

  const nextSeen = unseen.length >= count ? [...seen, ...picked] : picked;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(nextSeen));
  } catch {
    /* sessionStorage might be unavailable */
  }

  return picked
    .map((id) => STRATEGIC_INSIGHTS.find((i) => i.id === id))
    .filter((i): i is StrategicInsight => i !== undefined);
}
