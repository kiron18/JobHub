export type HeroVariant = 'v1_founder' | 'v2_reframe' | 'v3_plain';

const STORAGE_KEY = 'jobhub_hero_variant';

/**
 * Returns the visitor's assigned hero variant. Stable across visits
 * within the same browser. Random assignment on first visit.
 */
export function getHeroVariant(): HeroVariant {
  if (typeof window === 'undefined') return 'v2_reframe';

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'v1_founder' || stored === 'v2_reframe' || stored === 'v3_plain') {
    return stored;
  }

  const variants: HeroVariant[] = ['v1_founder', 'v2_reframe', 'v3_plain'];
  const chosen = variants[Math.floor(Math.random() * variants.length)];
  localStorage.setItem(STORAGE_KEY, chosen);
  return chosen;
}

/**
 * Reads the assigned variant without writing one — for analytics.
 * Returns null if none assigned yet.
 */
export function readHeroVariant(): HeroVariant | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  return (stored === 'v1_founder' || stored === 'v2_reframe' || stored === 'v3_plain') ? stored : null;
}
