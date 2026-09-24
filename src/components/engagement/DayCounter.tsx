import React from 'react';
import { warm } from '../../lib/theme/warmTokens';

/* ── DayCounter ────────────────────────────────────────────────────────
   "Day 18 / 90" with the week under it — the top-right cluster.

   The week was 6px dots with no labels, which was decoration rather than
   information: you could not tell which dot was which day, or read the
   difference between a light day and a missed one. It is now labelled
   S M T W T F S over dots big enough to carry a colour.

   A day is one of four states rather than filled-or-empty, so a day with
   two applications does not look identical to a day with none:
     none      nothing logged
     partial   something, under the goal
     goal      goal met
     over      past the goal
*/

export type DayState = 'none' | 'partial' | 'goal' | 'over' | 'future';

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const DOT: Record<DayState, { bg: string; border: string }> = {
  none: { bg: 'transparent', border: warm.colors.borderDefined },
  partial: { bg: `${warm.colors.accentPetrol}40`, border: 'transparent' },
  goal: { bg: warm.colors.accentPetrol, border: 'transparent' },
  over: { bg: warm.colors.accentGoldBright, border: 'transparent' },
  future: { bg: 'transparent', border: warm.colors.borderWhisper },
};

export interface DayCounterProps {
  /** Calendar day of the program, 1-based. */
  day: number;
  /** Program length, normally 90. */
  of?: number;
  /** Seven states, Sunday first. */
  week: DayState[];
  /** Index 0-6 of today, for the ring. */
  todayIndex?: number;
}

export const DayCounter: React.FC<DayCounterProps> = ({ day, of = 90, week, todayIndex }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
    <span style={{
      padding: '4px 11px', borderRadius: 7,
      background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
      fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary,
      fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      Day {day} / {of}
    </span>

    <div>
      <p style={{ ...warm.text.micro, margin: '0 0 6px', color: warm.colors.textMuted }}>This week</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {week.map((state, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, lineHeight: 1,
              color: i === todayIndex ? warm.colors.accentPetrol : warm.colors.textMuted,
            }}>
              {LETTERS[i]}
            </span>
            <span
              title={state === 'future' ? 'Not yet' : state}
              style={{
                width: 16, height: 16, borderRadius: '50%',
                background: DOT[state].bg,
                border: i === todayIndex
                  ? `2px solid ${warm.colors.accentPetrol}`
                  : `1.5px solid ${DOT[state].border}`,
                boxSizing: 'border-box',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  </div>
);
