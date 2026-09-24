import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { warm } from '../../lib/theme/warmTokens';
import { EASE, SPRING, prefersReducedMotion } from '../../lib/theme/motion';

/* ── ApplicationSquares ────────────────────────────────────────────────
   Ten squares under the ritual line. One square, one application.

   Ten is the ceiling on purpose, and the ceiling is a design position
   rather than a limit: applications past the tenth still count and are
   still recorded, they simply stop being celebrated. The eleventh fills
   nothing, bursts nothing, and instead triggers the quality note in
   PostApplicationPopup. A product that keeps cheering someone into their
   fortieth application of an evening is doing them harm — the work gets
   worse and the next nine days get skipped.

   The burst is only ever drawn on the square that just filled, and never
   on first paint, so arriving on the page with six already done is quiet
   and filling the seventh is not.
*/

export const SQUARE_CAP = 10;

export interface ApplicationSquaresProps {
  /** Applications filed today. May exceed SQUARE_CAP; squares just stay full. */
  filed: number;
  size?: number;
}

const PARTICLES = [
  { x: -14, y: -12 }, { x: 0, y: -18 }, { x: 14, y: -12 },
  { x: -14, y: 12 }, { x: 0, y: 18 }, { x: 14, y: 12 },
];

/** The one-off flourish on the square that just filled. */
const Burst: React.FC<{ color: string }> = ({ color }) => (
  <>
    <motion.span
      initial={{ scale: 0.7, opacity: 0.85 }}
      animate={{ scale: 2.4, opacity: 0 }}
      transition={{ duration: 0.62, ease: EASE.out }}
      style={{
        position: 'absolute', inset: -2, borderRadius: 9,
        border: `2px solid ${color}`, pointerEvents: 'none',
      }}
    />
    {PARTICLES.map((p, i) => (
      <motion.span
        key={i}
        initial={{ x: 0, y: 0, scale: 1, opacity: 0.9 }}
        animate={{ x: p.x, y: p.y, scale: 0.2, opacity: 0 }}
        transition={{ duration: 0.55, ease: EASE.out, delay: 0.04 }}
        style={{
          position: 'absolute', left: '50%', top: '50%', width: 5, height: 5,
          marginLeft: -2.5, marginTop: -2.5, borderRadius: '50%',
          background: color, pointerEvents: 'none',
        }}
      />
    ))}
  </>
);

export const ApplicationSquares: React.FC<ApplicationSquaresProps> = ({ filed, size = 26 }) => {
  const reduced = prefersReducedMotion();
  const green = warm.colors.success;

  /* Nothing animates on first paint — arriving with six already done is
     quiet, and only a fill that happens while you are watching bursts.
     This is React's adjust-state-during-render pattern: on the first
     render prev === filed, so burstAt stays null and every square that is
     already full renders flat. */
  const [prevFiled, setPrevFiled] = useState(filed);
  const [burstAt, setBurstAt] = useState<number | null>(null);
  if (prevFiled !== filed) {
    const isNewFill = filed > prevFiled && filed <= SQUARE_CAP;
    setPrevFiled(filed);
    setBurstAt(isNewFill ? filed : null);
  }

  const shown = Math.min(filed, SQUARE_CAP);
  const overCap = filed > SQUARE_CAP;

  return (
    <div
      style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}
      role="img"
      aria-label={`${filed} application${filed === 1 ? '' : 's'} today${overCap ? `, ${SQUARE_CAP} shown` : ''}`}
    >
      {Array.from({ length: SQUARE_CAP }, (_, i) => {
        const isFull = i < shown;
        // Only the square that just landed bursts, and only inside the
        // celebrated ten — the eleventh fills nothing and flashes nothing.
        const isNewest = isFull && burstAt === i + 1 && !overCap && !reduced;
        return (
          <motion.div
            key={i}
            animate={isNewest ? { scale: [1, 1.28, 1] } : { scale: 1 }}
            transition={isNewest ? { duration: 0.42, ease: EASE.out } : { duration: 0 }}
            style={{
              position: 'relative', width: size, height: size, borderRadius: 7,
              border: `1.5px solid ${isFull ? green : warm.colors.borderDefined}`,
              background: warm.colors.bgSurface,
              boxSizing: 'border-box', flexShrink: 0,
            }}
          >
            {isFull && (
              /* The fill itself: a disc that springs out from the middle
                 and overshoots the corners, so the square reads as being
                 flooded rather than switched on. */
              <motion.span
                initial={isNewest ? { scale: 0, opacity: 0.6 } : false}
                animate={{ scale: 1, opacity: 1 }}
                transition={reduced ? { duration: 0 } : SPRING.arrive}
                style={{
                  position: 'absolute', inset: 0, borderRadius: 5.5,
                  background: green, transformOrigin: 'center',
                }}
              />
            )}
            {isNewest && <Burst key={shown} color={green} />}
          </motion.div>
        );
      })}
    </div>
  );
};
