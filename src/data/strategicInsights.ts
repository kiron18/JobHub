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
    text: 'Target APAC-focused firms. They value international perspective and often have built-in cultural diversity.',
    category: 'market',
  },
  {
    id: 'asx-recruiters',
    text: 'Many ASX-listed companies hire through external recruiters. Apply via the recruiter URL rather than the company site to land on the right list.',
    category: 'process',
  },
  {
    id: 'group-of-eight',
    text: 'When your university is unfamiliar to AU recruiters, add a one-line equivalence: "IIT Delhi (comparable to Group of Eight)" makes your education legible.',
    category: 'framing',
  },
  {
    id: 'aps-format',
    text: 'Government roles (APS) reward selection-criteria detail. Treat them as a different application format entirely: separate document, structured answers.',
    category: 'process',
  },
  {
    id: 'cover-letter-length',
    text: 'Australian cover letters tend to be shorter and more direct than US ones. One page, no flourish, evidence-led.',
    category: 'framing',
  },
  {
    id: 'pr-citizenship',
    text: 'PR or citizenship requirements are common in government and some private-sector roles. Check this before tailoring. Saves wasted effort.',
    category: 'market',
  },
  {
    id: 'growing-industries',
    text: 'Industries actively growing in Australia for international graduates: renewables, aged care, infrastructure, fintech.',
    category: 'market',
  },
  {
    id: 'melbourne-vs-sydney',
    text: 'Melbourne and Sydney differ on tone. Melbourne reads more collegial; Sydney more direct. Calibrate cover letters accordingly.',
    category: 'framing',
  },
  {
    id: 'follow-up-window',
    text: 'Recruiters in AU often respond to thoughtful follow-ups within a week of application. A short note beats silence.',
    category: 'process',
  },
  {
    id: 'avoid-us-jargon',
    text: 'Avoid US-style superlatives ("rockstar", "ninja", "10x"). They read as imported jargon and tend to harm credibility here.',
    category: 'framing',
  },
  {
    id: 'personal-interests',
    text: 'Australian resumes can include a brief personal-interests line. It is not unprofessional here, and can humanise an otherwise dense CV.',
    category: 'framing',
  },
  {
    id: 'visa-transparency',
    text: 'For roles with PR/citizenship restrictions, mention your visa status proactively. Silence often reads as a flag; honesty resolves it.',
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
