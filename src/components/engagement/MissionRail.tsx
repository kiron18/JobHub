import React from 'react';
import { warm } from '../../lib/theme/warmTokens';

/* ── MissionRail ───────────────────────────────────────────────────────
   "Today's Mission (N of 5)" over a tall vertical track, on the right of
   the page — the rail from the reference.

   It is the same number the live dashboard's DailyProgressBar shows
   ("Today's applications X of 5", /tracker/goal), stood upright and moved
   out of the middle of the page so the eye going down the column lands on
   the paste box rather than on a meter. It fills from the bottom, so
   progress rises.
*/

export interface MissionRailProps {
  /** Applications filed today. */
  done: number;
  /** Today's goal, normally 5. */
  goal: number;
  /** Track height in px. */
  height?: number;
}

export const MissionRail: React.FC<MissionRailProps> = ({ done, goal, height = 250 }) => {
  const pct = Math.min(done / Math.max(goal, 1), 1) * 100;
  const met = done >= goal;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0, width: 96 }}>
      <p style={{
        margin: 0, textAlign: 'center', fontSize: 13, fontWeight: 700, lineHeight: 1.3,
        color: warm.colors.textPrimary, letterSpacing: '-0.01em',
      }}>
        Today&rsquo;s<br />Mission
        <span style={{ display: 'block', fontWeight: 600, color: warm.colors.textMuted, fontVariantNumeric: 'tabular-nums' }}>
          ({done} of {goal})
        </span>
      </p>
      <div
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-label={`Today's mission, ${done} of ${goal}`}
        style={{
          position: 'relative', width: 14, height,
          borderRadius: 999, background: warm.colors.bgAlt,
          border: `1px solid ${warm.colors.borderWhisper}`, overflow: 'hidden',
        }}
      >
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: `${pct}%`,
          borderRadius: 999,
          background: met ? warm.colors.success : warm.colors.accentPetrol,
          transition: 'height 0.45s cubic-bezier(0.16, 1, 0.30, 1)',
        }} />
      </div>
    </div>
  );
};
