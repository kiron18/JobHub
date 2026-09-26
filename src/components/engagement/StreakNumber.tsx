import React from 'react';
import { Flame } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';


/* ── StreakNumber ──────────────────────────────────────────────────────
   The streak, as a number.

   The other candidates for showing a streak were all atmosphere — the
   canopy saturating, flowers in the grass, the sky moving from dawn to
   daylight. Each says "something is better" without saying what, and
   three at once said it three times while staying unreadable.

   A score is a score. One big rounded numeral reads instantly, survives a
   glance, and is the only part of this anybody will screenshot.

   The numeral is warm gold at EVERY tier. Two earlier passes tied its
   colour to the tier and both times silver came out grey — a five-day
   streak rendered as though it were a disabled control. The tier badge
   sitting directly above already says which tier this is; the number's
   only job is to look like something worth keeping. Same mistake was made
   on the brain icon, and fixed the same way.

   Zero is not rendered as "0" — a streak you have just lost is not a
   score to put in 58px type. It becomes an invitation instead.
*/

/** One warm ramp, used at every tier. Festive is not a reward level. */
const GOLD_LIGHT = '#FFD75E';
const GOLD_DEEP = '#E08A12';

export interface StreakNumberProps {
  streak: number;
  /** px for the numeral. Everything else scales off it. */
  size?: number;
}

export const StreakNumber: React.FC<StreakNumberProps> = ({ streak, size = 58 }) => {
  const light = GOLD_LIGHT, deep = GOLD_DEEP;

  if (streak <= 0) {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{
          margin: 0, fontFamily: warm.type.fontGame, fontSize: size * 0.4,
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: size * 0.1 }}>
        <Flame
          size={size * 0.6}
          color={light}
          fill={deep}
          strokeWidth={1.8}
          style={{ filter: `drop-shadow(0 1px 3px ${deep}55)` }}
        />
        <span style={{
          fontFamily: warm.type.fontGame,
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          /* The ramp fills the numeral itself. Scoped to this one figure
             deliberately — gradient text anywhere else in this app would
             be decoration; here it is the prize. `color` stays set as the
             fallback for anything that cannot clip a background to text. */
          color: deep,
          backgroundImage: `linear-gradient(170deg, ${light} 0%, ${deep} 92%)`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          paddingRight: 2,
        }}>
          {streak}
        </span>
      </div>
      <p style={{
        margin: `${size * 0.06}px 0 0`,
        fontFamily: warm.type.fontGame,
        fontSize: size * 0.27,
        fontWeight: 600,
        color: warm.colors.textSecondary,
        letterSpacing: '0.01em',
      }}>
        day{streak === 1 ? '' : 's'} in a row
      </p>
    </div>
  );
};
