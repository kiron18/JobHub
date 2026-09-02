import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { warm } from '../../lib/theme/warmTokens';
import { EASE, SPRING, prefersReducedMotion } from '../../lib/theme/motion';
import { onCelebrate, haptic, type CelebrationPayload } from '../../lib/feedback';

/* ── Celebration ───────────────────────────────────────────────────────
   The moment. Fired when someone finishes an application, and reserved
   for things at roughly that weight: a real, irreversible step forward.
   If this plays for saving a draft it stops meaning anything.

   How it is built, in order, because the order is the design:

     1. A near-white scrim, not a black one. Black reads as an interruption
        and as a warning. This is good news, so the page brightens.
     2. The disc springs in past its resting size and settles back. The
        overshoot is the whole reason it feels like a reward rather than a
        confirmation dialog.
     3. The ring draws itself around the disc. Drawing takes time and time
        is what makes a moment feel earned.
     4. The tick strokes on. Never faded in: a tick that fades looks like
        it was already there.
     5. A bloom ring expands past the disc and dies. This is the impact.
     6. Copy rises in, staggered, after the visual has landed. Reading
        starts once the eye has stopped moving.
     7. A chip carrying the role name flies out of the badge and into the
        sidebar, where the tracker link pulses as it arrives. This is the
        part that answers "where did my application go".

   The whole thing is 2.6 seconds and a click anywhere ends it early.
   Under prefers-reduced-motion it becomes a still card that holds for
   1.6s: the news still gets delivered, nothing travels.
*/

const FLIGHT_MS = 720;

export function CelebrationHost() {
  const [payload, setPayload] = useState<CelebrationPayload | null>(null);
  const [flight, setFlight] = useState<{ x: number; y: number } | null>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const reduced = prefersReducedMotion();

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const close = () => { clearTimers(); setPayload(null); setFlight(null); };

  useEffect(() => onCelebrate(p => {
    clearTimers();
    setFlight(null);
    setPayload(p);
    haptic('success');

    if (reduced) {
      timers.current.push(window.setTimeout(close, 1600));
      return;
    }

    // Work out where the chip is flying to, once the badge has been placed.
    if (p.land) {
      timers.current.push(window.setTimeout(() => {
        const target = document.querySelector<HTMLElement>(`[data-celebration-target="${p.land!.target}"]`);
        const from = badgeRef.current?.getBoundingClientRect();
        if (!target || !from) return;
        const to = target.getBoundingClientRect();
        setFlight({
          x: (to.left + to.width / 2) - (from.left + from.width / 2),
          y: (to.top + to.height / 2) - (from.top + from.height / 2),
        });
        // Let the destination answer, so the arrival is visible even if the
        // chip is small by the time it lands.
        window.setTimeout(() => {
          target.animate(
            [
              { transform: 'scale(1)', offset: 0 },
              { transform: 'scale(1.06)', offset: 0.45 },
              { transform: 'scale(1)', offset: 1 },
            ],
            { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.30, 1)' },
          );
        }, FLIGHT_MS - 120);
      }, 1250));
    }

    timers.current.push(window.setTimeout(close, p.land ? 2600 : 2100));
  }), [reduced]);

  useEffect(() => clearTimers, []);

  return (
    <AnimatePresence>
      {payload && (
        <motion.div
          key="celebration"
          onClick={close}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.28, ease: EASE.in } }}
          transition={{ duration: 0.24, ease: EASE.out }}
          style={{
            position: 'fixed', inset: 0, zIndex: 4000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            // Light, not dark. Good news brightens the page.
            background: 'rgba(248, 250, 253, 0.86)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            cursor: 'pointer', padding: 24,
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            {/* The badge */}
            <motion.div
              ref={badgeRef}
              animate={flight
                ? { x: flight.x, y: flight.y, scale: 0.18, opacity: 0 }
                : { x: 0, y: 0, scale: 1, opacity: 1 }}
              transition={flight
                ? { duration: FLIGHT_MS / 1000, ease: EASE.inOut }
                : { duration: 0 }}
              style={{
                position: 'relative', width: 104, height: 104,
                margin: '0 auto 22px',
              }}
            >
              {/* Bloom. The impact. Expands past the disc and dies. */}
              {!reduced && (
                <motion.span
                  initial={{ scale: 0.9, opacity: 0.45 }}
                  animate={{ scale: 2.1, opacity: 0 }}
                  transition={{ duration: 0.9, ease: EASE.out, delay: 0.22 }}
                  style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    border: `2px solid ${warm.colors.success}`,
                  }}
                />
              )}

              {/* Disc. Overshoots, then settles. */}
              <motion.span
                initial={reduced ? { scale: 1 } : { scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={reduced ? { duration: 0 } : SPRING.celebrate}
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: warm.colors.successSoft,
                  boxShadow: `0 8px 30px ${warm.colors.success}22`,
                }}
              />

              {/* Ring, drawn rather than shown. */}
              <svg
                width={104} height={104} viewBox="0 0 104 104"
                style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
              >
                <motion.circle
                  cx={52} cy={52} r={49}
                  fill="none" stroke={warm.colors.success} strokeWidth={2.5} strokeLinecap="round"
                  initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.62, ease: EASE.out, delay: 0.08 }}
                />
              </svg>

              {/* Tick, stroked on. */}
              <svg
                width={44} height={44} viewBox="0 0 24 24" fill="none"
                stroke={warm.colors.success} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', top: 30, left: 30 }}
              >
                <motion.path
                  d="M20 6 9 17l-5-5"
                  initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.34, ease: EASE.out, delay: 0.24 }}
                />
              </svg>
            </motion.div>

            {/* Copy, after the eye has stopped moving. */}
            <motion.h2
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduced ? { duration: 0 } : { duration: 0.42, ease: EASE.out, delay: 0.44 }}
              style={{
                margin: '0 0 8px', fontFamily: warm.type.fontBody,
                ...warm.text.h1, color: warm.colors.textPrimary,
              }}
            >
              {payload.title}
            </motion.h2>

            {payload.subtitle && (
              <motion.p
                initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduced ? { duration: 0 } : { duration: 0.42, ease: EASE.out, delay: 0.53 }}
                style={{
                  margin: 0, fontFamily: warm.type.fontBody,
                  ...warm.text.body, color: warm.colors.textSecondary,
                }}
              >
                {payload.subtitle}
              </motion.p>
            )}

            {payload.land && !reduced && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 1.25, ease: EASE.out }}
                style={{
                  margin: '18px 0 0', fontFamily: warm.type.fontBody,
                  ...warm.text.micro, color: warm.colors.textMuted,
                }}
              >
                Filed under {payload.land.label}
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
