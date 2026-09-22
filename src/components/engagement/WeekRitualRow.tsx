import React from 'react';
import { Star } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { TIER_LABEL, type DayCompletionTier } from '../../lib/dayCompletion';

/* ── WeekRitualRow ─────────────────────────────────────────────────────
   The week as seven marks, each with its own completion level — not just
   a checked/unchecked box. This is the "medium" layer between today's
   single ritual and the 90-day tree: it's what makes a Tuesday miss
   readable as "one soft day in an otherwise strong week" instead of a
   broken streak.
*/

export interface RitualDay {
  label: string; // 'S' 'M' 'T' ...
  tier: DayCompletionTier;
  isToday?: boolean;
  isFuture?: boolean;
}

const TIER_FILL: Record<DayCompletionTier, string> = {
  none: 'transparent',
  started: `${warm.colors.accentPetrol}40`,
  goal: warm.colors.accentPetrol,
  exceeded: warm.colors.accentGoldBright,
};

const Dot: React.FC<{ day: RitualDay }> = ({ day }) => {
  const size = 30;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: warm.colors.textMuted }}>{day.label}</span>
      <div
        title={day.isFuture ? 'Not yet' : TIER_LABEL[day.tier]}
        style={{
          width: size, height: size, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: day.isFuture ? 'transparent' : TIER_FILL[day.tier],
          border: day.isToday
            ? `2px solid ${warm.colors.accentPetrol}`
            : `1.5px solid ${day.isFuture ? warm.colors.borderWhisper : (day.tier === 'none' ? warm.colors.borderDefined : 'transparent')}`,
          boxSizing: 'border-box',
        }}
      >
        {day.tier === 'exceeded' && !day.isFuture && <Star size={12} color="#fff" fill="#fff" />}
      </div>
    </div>
  );
};

export const WeekRitualRow: React.FC<{ days: RitualDay[] }> = ({ days }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
    {days.map((d, i) => <Dot key={i} day={d} />)}
  </div>
);
