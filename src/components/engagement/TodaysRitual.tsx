import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Lock, RotateCcw, Info } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { DUR, EASE, shake, t } from '../../lib/theme/motion';
import { TARGET_MIN, TARGET_MAX } from '../../lib/dailyTarget';

/* ── TodaysRitual ──────────────────────────────────────────────────────
   One line under the heading, and the one place today's target is set.

   "Apply to [−] 5 [+] roles matching your profile [Set]". Five is the
   program floor (server/src/services/tracker/goals.ts); ten is the
   ceiling PostApplicationPopup argues for.

   The committed number is a floor, not a cap. Do more than you planned
   and it raises itself to match — there is no version of this where the
   product tells someone who has done more than they promised that they
   have overshot. It stops raising at ten, and past ten the line changes
   shape entirely: it stops being an instruction and becomes a statement
   of fact in the warning colour, because "Apply to 12 roles" would be
   the product cheering on exactly what it has just asked someone not to
   do.

   Lowering after Set is not offered. That is the whole point of setting
   it: a target you can drop at 9pm because you are behind is not a
   target, it is a comment.
*/

export interface TodaysRitualProps {
  /** Today's target after auto-raising — see effectiveTarget(). */
  target: number;
  /** Applications filed today. Past the ceiling this takes over the line. */
  filed: number;
  /** Once set for the day the stepper is replaced by plain text. */
  locked: boolean;
  /** False once the day's single undo has been spent. */
  undoAvailable: boolean;
  onTargetChange: (n: number) => void;
  onSet: () => void;
  onUndo: () => void;
  /** One clause of context under the line. */
  detail?: string;
}

const StepButton: React.FC<{
  label: string;
  enabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, enabled, onClick, children }) => (
  <button
    type="button"
    onClick={() => enabled && onClick()}
    disabled={!enabled}
    aria-label={label}
    className="tap-target"
    style={{
      width: 26, height: 26, borderRadius: 8, flexShrink: 0, padding: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `1px solid ${enabled ? warm.colors.borderDefined : warm.colors.borderWhisper}`,
      background: warm.colors.bgSurface,
      color: enabled ? warm.colors.accentPetrol : warm.colors.textMuted,
      cursor: enabled ? 'pointer' : 'not-allowed',
      opacity: enabled ? 1 : 0.5,
      transition: t(['background-color', 'border-color', 'color'], DUR.fast),
    }}
  >
    {children}
  </button>
);

/* The ceiling explainer. It only exists once someone has actually pushed
   against the limit — showing it from the start would be answering a
   question nobody has asked yet. Every further press shakes it, because
   the press did something even though the number did not move. */
const CeilingNote: React.FC<{ bumps: number }> = ({ bumps }) => {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <motion.button
        type="button"
        aria-label={`Why ${TARGET_MAX} is the maximum`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(o => !o)}
        /* Remounted on every bump so the shake replays rather than
           playing once and sitting still for later presses. */
        key={bumps}
        variants={shake}
        initial="still"
        animate="shake"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 20, height: 20, padding: 0, borderRadius: '50%',
          border: 'none', background: 'transparent',
          color: warm.colors.accentGold, cursor: 'help', flexShrink: 0,
        }}
      >
        <Info size={16} />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2, transition: { duration: DUR.instant } }}
            transition={{ duration: DUR.fast, ease: EASE.out }}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: -8, zIndex: 20,
              width: 250, padding: '10px 12px', borderRadius: 10,
              background: warm.colors.bgDeep, color: warm.colors.textOnDeep,
              ...warm.text.small, lineHeight: 1.5, fontWeight: warm.weight.regular,
              boxShadow: warm.shadow.lifted, pointerEvents: 'none',
            }}
          >
            Ten is the daily maximum. This program runs on high-quality applications
            sent consistently — not on blasting out a hundred in one day, which is
            how quality drops and momentum dies.
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
};

export const TodaysRitual: React.FC<TodaysRitualProps> = ({
  target, filed, locked, undoAvailable, onTargetChange, onSet, onUndo, detail,
}) => {
  const overCeiling = filed > TARGET_MAX;
  /* Counts presses of + that had nowhere to go. Drives the shake, and its
     first increment is what reveals the note at all. */
  const [bumps, setBumps] = useState(0);
  const atCeiling = target >= TARGET_MAX;
  // You cannot un-apply, so the floor of the stepper rises with the work
  // already done.
  const floor = Math.max(TARGET_MIN, Math.min(filed, TARGET_MAX));
  const canDown = !locked && target > floor;
  // Pressable at the ceiling on purpose: a dead button teaches nothing,
  // so the press bumps the note instead of moving the number.
  const canUp = !locked;

  return (
    <div>
      <p style={{ ...warm.text.micro, margin: '0 0 6px', color: warm.colors.accentPetrol }}>
        Today's ritual
      </p>

      {overCeiling ? (
        /* Past the ceiling the sentence stops giving an instruction. */
        <p style={{ ...warm.text.body, fontWeight: warm.weight.semibold, margin: 0, color: warm.colors.textPrimary }}>
          <span style={{
            ...warm.text.h3, fontWeight: warm.weight.bold,
            color: warm.colors.danger,
            fontVariantNumeric: 'tabular-nums',
            transition: t(['color'], DUR.base),
          }}>
            {filed}
          </span>{' '}
          applications today — past the ten-a-day ceiling
        </p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {atCeiling && bumps > 0 && <CeilingNote bumps={bumps} />}
          <span style={{ ...warm.text.body, fontWeight: warm.weight.semibold, color: warm.colors.textPrimary }}>Apply to</span>

          {locked ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              ...warm.text.h3, fontWeight: warm.weight.bold,
              color: warm.colors.textPrimary, fontVariantNumeric: 'tabular-nums',
            }}>
              {target}
              {!undoAvailable && <Lock size={12} color={warm.colors.textMuted} aria-label="Set for today" />}
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <StepButton label="One fewer role" enabled={canDown} onClick={() => onTargetChange(target - 1)}>
                <Minus size={13} />
              </StepButton>
              <span style={{
                minWidth: 24, textAlign: 'center',
                ...warm.text.h3, fontWeight: warm.weight.bold,
                color: warm.colors.textPrimary, fontVariantNumeric: 'tabular-nums',
              }}>
                {target}
              </span>
              <StepButton
                label={atCeiling ? `${TARGET_MAX} is the daily maximum` : 'One more role'}
                enabled={canUp}
                onClick={() => (atCeiling ? setBumps(b => b + 1) : onTargetChange(target + 1))}
              >
                <Plus size={13} />
              </StepButton>
            </span>
          )}

          <span style={{ ...warm.text.body, fontWeight: warm.weight.semibold, color: warm.colors.textPrimary }}>
            roles matching your profile
          </span>

          {!locked ? (
            <button
              type="button"
              onClick={onSet}
              className="tap-target"
              style={{
                padding: '5px 15px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: warm.colors.accentPetrol, color: warm.colors.textOnDeep,
                ...warm.text.small, fontWeight: warm.weight.bold,
                transition: t(['background-color'], DUR.fast),
              }}
            >
              Set
            </button>
          ) : undoAvailable && (
            /* The day's one undo. It is deliberately quiet — an outlined
               button, not a filled one — because it is an exception, not
               the thing to reach for. */
            <button
              type="button"
              onClick={onUndo}
              className="tap-target"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 12px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${warm.colors.borderDefined}`, background: 'transparent',
                color: warm.colors.textMuted,
                ...warm.text.small, fontWeight: warm.weight.semibold,
                transition: t(['color', 'border-color'], DUR.fast),
              }}
            >
              <RotateCcw size={12} /> Undo
            </button>
          )}
        </div>
      )}

      {detail && (
        <p style={{ ...warm.text.small, margin: '6px 0 0', color: warm.colors.textMuted }}>
          {overCeiling
            ? 'They all count. The ceiling is about what the next one is worth.'
            : locked
              ? (undoAvailable ? `${detail} Locked in for today.` : `${detail} Locked in — today's undo is used.`)
              : `${detail} Set once a day — ${TARGET_MIN} to ${TARGET_MAX}.`}
        </p>
      )}
    </div>
  );
};
