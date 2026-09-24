import React from 'react';
import { warm } from '../../lib/theme/warmTokens';

/* ── DayCounter ────────────────────────────────────────────────────────
   "Day 18 / 90" with the week underneath it as seven small dots — the
   top-right cluster from the reference.

   The dots are the same seven days WeekStrip shows on the live dashboard,
   at a size that sits under a chip instead of competing with the page.
   A day is one of four states rather than a filled/empty box, which is
   what makes a light day read as a light day instead of a miss:
     none      nothing logged
     partial   something, under the goal
     goal      goal met
     over      past the goal
*/

export type DayState = 'none' | 'partial' | 'goal' | 'over' | 'future';

const DOT_COLOR: Record<DayState, string> = {
  none: warm.colors.borderDefined,
  partial: `${warm.colors.accentPetrol}55`,
  goal: warm.colors.accentPetrol,
  over: warm.colors.accentGoldBright,
  future: 'transparent',
};

export interface DayCounterProps {
  /** Calendar day of the program, 1-based. */
  day: number;
  /** Program length, normally 90. */
  of?: number;
  /** Seven states, Sunday first. */
  week: DayState[];
}

export const DayCounter: React.FC<DayCounterProps> = ({ day, of = 90, week }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
    <span style={{
      padding: '3px 10px', borderRadius: 7,
      background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
      fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary,
      fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      Day {day} / {of}
    </span>
    <div style={{ display: 'flex', gap: 5 }} aria-label="This week">
      {week.map((state, i) => (
        <span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: DOT_COLOR[state],
            border: state === 'future' ? `1px solid ${warm.colors.borderWhisper}` : 'none',
            boxSizing: 'border-box',
          }}
        />
      ))}
    </div>
  </div>
);
