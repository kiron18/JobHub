import React from 'react';
import { Flame } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { streakTier, type StreakTier } from '../../lib/growthTree';

/* ── StreakNumber ──────────────────────────────────────────────────────
   The streak, as a number.

   The other candidates for showing a streak were all atmosphere — the
   canopy saturating, flowers in the grass, the sky moving from dawn to
   daylight. Each of them says "something is better" without ever saying
   what, and three of them at once said it three times.

   A score is a score. One big rounded numeral reads instantly, survives
   being glanced at, and is the only thing here anybody will screenshot.

   Zero is not shown as "0" — a streak you have just lost is not a score
   to put in 44px type. It becomes an invitation instead.
*/

const TIER_COLOR: Record<StreakTier, string> = {
  none: warm.colors.textMuted,
  bronze: '#B0703A',
  silver: '#7C8A9A',
  gold: warm.colors.accentGoldBright,
};

export interface StreakNumberProps {
  streak: number;
  /** px for the numeral. The label scales with it. */
  size?: number;
}

export const StreakNumber: React.FC<StreakNumberProps> = ({ streak, size = 54 }) => {
  const tier = streakTier(streak);
  const color = TIER_COLOR[tier];

  if (streak <= 0) {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{
          margin: 0, fontFamily: warm.type.fontGame, fontSize: size * 0.42,
          fontWeight: 600, color: warm.colors.textPrimary, letterSpacing: '-0.01em',
        }}>
          Start a streak today
        </p>
        <p style={{ ...warm.text.small, margin: '2px 0 0', color: warm.colors.textMuted }}>
          One day at your target is all it takes
        </p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: size * 0.14 }}>
        <Flame size={size * 0.52} color={color} strokeWidth={2.4} />
        <span style={{
          fontFamily: warm.type.fontGame,
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1,
          color,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
        }}>
          {streak}
        </span>
      </div>
      <p style={{
        margin: '4px 0 0',
        fontFamily: warm.type.fontGame,
        fontSize: size * 0.3,
        fontWeight: 600,
        color: warm.colors.textSecondary,
        letterSpacing: '0.02em',
      }}>
        day{streak === 1 ? '' : 's'} in a row
      </p>
    </div>
  );
};
