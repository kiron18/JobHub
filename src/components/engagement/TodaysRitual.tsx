import React from 'react';
import { Check } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';

/* ── TodaysRitual ──────────────────────────────────────────────────────
   One line, with a circle at the left of it, tucked under the page
   heading — as in the reference.

   It has no button (the paste box is directly underneath it), no "1 of N"
   counter and no week strip of its own: the Day chip and the vertical
   mission rail beside it already carry both of those.
*/

export interface TodaysRitualProps {
  /** The one thing today is for, e.g. "Apply to 5 roles matching your profile". */
  line: string;
  /** One clause of context under it. Optional. */
  detail?: string;
  /** Fills the circle once today's ritual is met. */
  done?: boolean;
}

export const TodaysRitual: React.FC<TodaysRitualProps> = ({ line, detail, done }) => (
  <div>
    <p style={{ ...warm.text.micro, margin: '0 0 4px', color: warm.colors.accentPetrol }}>
      Today's ritual
    </p>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
      <span
        aria-hidden
        style={{
          flexShrink: 0, width: 15, height: 15, borderRadius: '50%', marginTop: 2,
          border: `1.5px solid ${done ? warm.colors.success : warm.colors.accentPetrol}`,
          background: done ? warm.colors.success : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {done && <Check size={10} color="#fff" strokeWidth={3.5} />}
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: warm.colors.textPrimary, letterSpacing: '-0.01em' }}>
          {line}
        </p>
        {detail && (
          <p style={{ margin: '2px 0 0', fontSize: 12, lineHeight: 1.45, color: warm.colors.textMuted }}>
            {detail}
          </p>
        )}
      </div>
    </div>
  </div>
);
