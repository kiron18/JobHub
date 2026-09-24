import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { warm } from '../../lib/theme/warmTokens';
import { EASE, DUR, SPRING, t, prefersReducedMotion } from '../../lib/theme/motion';
import { TARGET_MAX, pastCeiling } from '../../lib/dailyTarget';

/* ── ApplicationSquares ────────────────────────────────────────────────
   One square, one application, with the count beside it.

   The row grows with you: set seven and file an eighth and an eighth
   square appears rather than the work going unrecorded. It stops growing
   at ten, and that is the whole argument — see PostApplicationPopup for
   why ten is the ceiling. Past ten the applications still count and are
   still logged, they just have nowhere left to land and the count turns
   from green to warning.

   Three colour states and no more: filling (blue), target met (green),
   past the ceiling (warning). The squares themselves never carry the
   warning colour — a wall of red squares would read as ten mistakes,
   when in fact ten is a good day.
*/

export interface ApplicationSquaresProps {
  /** Applications filed today. May exceed the ceiling. */
  filed: number;
  /** Today's target, already passed through effectiveTarget(). */
  target: number;
  size?: number;
}

const PARTICLES = [
  { x: -15, y: -13 }, { x: 0, y: -19 }, { x: 15, y: -13 },
  { x: -15, y: 13 }, { x: 0, y: 19 }, { x: 15, y: 13 },
];

/** The one-off flourish on the square that just filled. */
const Burst: React.FC<{ color: string }> = ({ color }) => (
  <>
    <motion.span
      initial={{ scale: 0.7, opacity: 0.9 }}
      animate={{ scale: 2.5, opacity: 0 }}
      transition={{ duration: DUR.story, ease: EASE.out }}
      style={{
        position: 'absolute', inset: -2, borderRadius: 10,
        border: `2px solid ${color}`, pointerEvents: 'none',
      }}
    />
    {PARTICLES.map((p, i) => (
      <motion.span
        key={i}
        initial={{ x: 0, y: 0, scale: 1, opacity: 0.95 }}
        animate={{ x: p.x, y: p.y, scale: 0.15, opacity: 0 }}
        transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.04 }}
        style={{
          position: 'absolute', left: '50%', top: '50%', width: 5, height: 5,
          marginLeft: -2.5, marginTop: -2.5, borderRadius: '50%',
          background: color, pointerEvents: 'none',
        }}
      />
    ))}
  </>
);

export const ApplicationSquares: React.FC<ApplicationSquaresProps> = ({ filed, target, size = 28 }) => {
  const reduced = prefersReducedMotion();
  const green = warm.colors.success;

  /* Nothing animates on first paint — arriving with six already done is
     quiet, and only a fill that happens while you are watching bursts.
     React's adjust-state-during-render pattern: on the first render
     prev === filed, so burstAt stays null. */
  const [prevFiled, setPrevFiled] = useState(filed);
  const [burstAt, setBurstAt] = useState<number | null>(null);
  if (prevFiled !== filed) {
    const isNewFill = filed > prevFiled && filed <= TARGET_MAX;
    setPrevFiled(filed);
    setBurstAt(isNewFill ? filed : null);
  }

  const filledCount = Math.min(filed, target);
  const overflow = pastCeiling(filed);
  const met = filed >= target;

  const countColor = overflow > 0
    ? warm.colors.danger
    : met ? green : warm.colors.textMuted;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div
        style={{ display: 'flex', gap: 8 }}
        role="img"
        aria-label={`${filed} of ${target} applications today${overflow > 0 ? `, ${overflow} past the ceiling` : ''}`}
      >
        {Array.from({ length: target }, (_, i) => {
          const isFull = i < filledCount;
          // Only the square that just landed bursts. Past the ceiling
          // there is no square left to fill, so nothing flashes.
          const isNewest = isFull && burstAt === i + 1 && !reduced;
          return (
            <motion.div
              key={i}
              /* A square appearing because the row auto-raised slides in
                 rather than popping into existence mid-row. */
              initial={prevFiled === filed ? false : { scale: 0.6, opacity: 0 }}
              animate={isNewest ? { scale: [1, 1.24, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
              transition={isNewest ? { duration: DUR.slow, ease: EASE.out } : { duration: DUR.base, ease: EASE.out }}
              style={{
                position: 'relative', width: size, height: size, borderRadius: 8,
                border: `1.5px solid ${isFull ? green : warm.colors.borderDefined}`,
                background: warm.colors.bgSurface,
                boxSizing: 'border-box', flexShrink: 0,
                transition: t(['border-color'], DUR.fast),
              }}
            >
              {isFull && (
                /* The fill: a disc springing out past the corners, so the
                   square reads as flooded rather than switched on. One
                   overshoot — the motion system's rule for good news. */
                <motion.span
                  initial={isNewest ? { scale: 0, opacity: 0.55 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={reduced ? { duration: 0 } : SPRING.celebrate}
                  style={{
                    position: 'absolute', inset: 0, borderRadius: 6.5,
                    background: green, transformOrigin: 'center',
                  }}
                />
              )}
              {isNewest && <Burst key={filed} color={green} />}
            </motion.div>
          );
        })}
      </div>

      <span style={{
        ...warm.text.small,
        fontWeight: warm.weight.bold,
        color: countColor,
        fontVariantNumeric: 'tabular-nums',
        transition: t(['color'], DUR.base),
        whiteSpace: 'nowrap',
      }}>
        {overflow > 0 ? `${filed} today` : `${filed} of ${target}`}
        {overflow > 0 && (
          <span style={{ ...warm.text.small, fontWeight: warm.weight.medium, color: warm.colors.textMuted }}>
            {' '}· {overflow} past the ceiling
          </span>
        )}
      </span>
    </div>
  );
};
