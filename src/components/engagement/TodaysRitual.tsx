import React from 'react';
import { Minus, Plus, Lock } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';

/* ── TodaysRitual ──────────────────────────────────────────────────────
   One line under the heading, and the one place today's target is set.

   "Apply to [−] 5 [+] roles matching your profile [Set]" — the number is
   the member's own call between five and ten, and the squares below
   follow it. Once Set it locks for the rest of the day: a target you can
   lower at 9pm because you are behind is not a target, it is a comment.

   Five is the floor because that is the program's own floor
   (server/src/services/tracker/goals.ts). Ten is the ceiling for the
   reason PostApplicationPopup explains — past ten in a sitting the
   quality goes and tomorrow becomes the day that gets skipped.
*/

export const TARGET_MIN = 5;
export const TARGET_MAX = 10;

export interface TodaysRitualProps {
  /** Today's target, TARGET_MIN..TARGET_MAX. */
  target: number;
  /** Once set for the day the stepper is replaced by plain text. */
  locked: boolean;
  onTargetChange: (n: number) => void;
  onSet: () => void;
  /** One clause of context under the line. */
  detail?: string;
}

const stepperButton = (enabled: boolean): React.CSSProperties => ({
  width: 24, height: 24, borderRadius: 7, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: `1px solid ${warm.colors.borderDefined}`,
  background: warm.colors.bgSurface,
  color: enabled ? warm.colors.accentPetrol : warm.colors.textMuted,
  cursor: enabled ? 'pointer' : 'not-allowed',
  opacity: enabled ? 1 : 0.45,
  padding: 0,
});

export const TodaysRitual: React.FC<TodaysRitualProps> = ({
  target, locked, onTargetChange, onSet, detail,
}) => {
  const canDown = !locked && target > TARGET_MIN;
  const canUp = !locked && target < TARGET_MAX;

  return (
    <div>
      <p style={{ ...warm.text.micro, margin: '0 0 5px', color: warm.colors.accentPetrol }}>
        Today's ritual
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: warm.colors.textPrimary, letterSpacing: '-0.01em' }}>
          Apply to
        </span>

        {locked ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 14.5, fontWeight: 700, color: warm.colors.textPrimary,
          }}>
            {target}
            <Lock size={11} color={warm.colors.textMuted} />
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => canDown && onTargetChange(target - 1)}
              disabled={!canDown}
              aria-label="One fewer role"
              style={stepperButton(canDown)}
            >
              <Minus size={13} />
            </button>
            <span style={{
              minWidth: 22, textAlign: 'center', fontSize: 17, fontWeight: 800,
              color: warm.colors.textPrimary, fontVariantNumeric: 'tabular-nums',
            }}>
              {target}
            </span>
            <button
              type="button"
              onClick={() => canUp && onTargetChange(target + 1)}
              disabled={!canUp}
              aria-label="One more role"
              style={stepperButton(canUp)}
            >
              <Plus size={13} />
            </button>
          </span>
        )}

        <span style={{ fontSize: 14.5, fontWeight: 700, color: warm.colors.textPrimary, letterSpacing: '-0.01em' }}>
          roles matching your profile
        </span>

        {!locked && (
          <button
            type="button"
            onClick={onSet}
            style={{
              padding: '4px 13px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: warm.colors.accentPetrol, color: '#fff',
              fontSize: 12, fontWeight: 700, letterSpacing: '-0.01em',
            }}
          >
            Set
          </button>
        )}
      </div>

      {detail && (
        <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.45, color: warm.colors.textMuted }}>
          {locked ? detail : `${detail} Set once a day — ${TARGET_MIN} to ${TARGET_MAX}.`}
        </p>
      )}
    </div>
  );
};
