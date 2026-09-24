import React from 'react';
import { warm } from '../../lib/theme/warmTokens';

/* ── TodaysRitual ──────────────────────────────────────────────────────
   One line. That is the whole component.

   It sits under the header and says what today is for, in the same spot
   Kiron's reference puts it. It deliberately has no button (the paste box
   is directly underneath it), no checkbox, no "1 of N" counter, and no
   week strip of its own — "Today's applications X of 5" and WeekStrip
   already live on this page and already say all of that. This is the
   sentence, nothing else.
*/

export interface TodaysRitualProps {
  /** The one thing today is for, e.g. "Apply to 5 roles matching your profile". */
  line: string;
  /** One clause of context under it. Optional. */
  detail?: string;
}

export const TodaysRitual: React.FC<TodaysRitualProps> = ({ line, detail }) => (
  <div>
    <p style={{ ...warm.text.micro, margin: '0 0 3px', color: warm.colors.accentPetrol }}>
      Today's ritual
    </p>
    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary, letterSpacing: '-0.01em' }}>
      {line}
    </p>
    {detail && (
      <p style={{ margin: '2px 0 0', fontSize: 12.5, lineHeight: 1.45, color: warm.colors.textMuted }}>
        {detail}
      </p>
    )}
  </div>
);
