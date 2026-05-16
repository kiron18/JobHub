export type InsightKey =
  | 'diagnostic'
  | 'application-pattern'
  | 'industry-fit-map'
  | 'personal-playbook'
  | 'response-rate';

export interface InsightDef {
  key: InsightKey;
  label: string;
  description: string;
  /** Minimum applications-sent count to unlock. Diagnostic is always 0. */
  unlockThreshold: number;
  /** Whether the insight UI is built yet. Drives the "coming soon" placeholder. */
  implemented: boolean;
}

export const INSIGHT_TRACK: InsightDef[] = [
  { key: 'diagnostic',          label: 'Diagnostic',              description: 'Your starting baseline.',                              unlockThreshold: 0,  implemented: true },
  { key: 'application-pattern', label: 'Application pattern',     description: 'Where you apply vs. where your resume actually fits.', unlockThreshold: 1,  implemented: true },
  { key: 'industry-fit-map',    label: 'Industry fit map',        description: 'Your match strength across industries you target.',    unlockThreshold: 3,  implemented: false },
  { key: 'personal-playbook',   label: 'Personal playbook',       description: 'Your highest-leverage next move, given your history.', unlockThreshold: 5,  implemented: false },
  { key: 'response-rate',       label: 'Response-rate analysis',  description: 'Which application types open at higher rates.',        unlockThreshold: 10, implemented: false },
];

export function isUnlocked(insight: InsightDef, applicationsSent: number): boolean {
  return applicationsSent >= insight.unlockThreshold;
}

export function applicationsUntilUnlock(insight: InsightDef, applicationsSent: number): number {
  return Math.max(0, insight.unlockThreshold - applicationsSent);
}

const SEEN_KEY = 'jobhub_strategic_intel_seen';

/** Returns the set of insight keys the user has already opened in-app. */
export function loadSeenInsights(): Set<InsightKey> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as InsightKey[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function markInsightSeen(key: InsightKey) {
  const seen = loadSeenInsights();
  seen.add(key);
  localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen)));
}

/** Returns the next insight the user will unlock, or null if all are unlocked. */
export function nextLockedInsight(applicationsSent: number): InsightDef | null {
  for (const i of INSIGHT_TRACK) {
    if (!isUnlocked(i, applicationsSent)) return i;
  }
  return null;
}
