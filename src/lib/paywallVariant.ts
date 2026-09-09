export type PaywallVariant = 'a_value' | 'b_trial';

const STORAGE_KEY = 'jobhub_paywall_variant';

/**
 * Which paywall copy a visitor sees: the value-stack lead (`a_value`, the
 * original) or the trial lead (`b_trial`, "try it free for 7 days" as the
 * headline instead of the $250/mo price). Stable across visits within the
 * same browser, same pattern as getHeroVariant in landingVariant.ts.
 */
export function getPaywallVariant(): PaywallVariant {
  if (typeof window === 'undefined') return 'a_value';

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'a_value' || stored === 'b_trial') return stored;

  const chosen: PaywallVariant = Math.random() < 0.5 ? 'a_value' : 'b_trial';
  localStorage.setItem(STORAGE_KEY, chosen);
  return chosen;
}

/** Reads the assigned variant without writing one — for analytics. */
export function readPaywallVariant(): PaywallVariant | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  return (stored === 'a_value' || stored === 'b_trial') ? stored : null;
}
