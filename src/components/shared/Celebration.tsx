import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { warm } from '../../lib/theme/warmTokens';
import { EASE, SPRING, prefersReducedMotion } from '../../lib/theme/motion';
import { onCelebrate, haptic, type CelebrationPayload } from '../../lib/feedback';

/* ── Celebration ───────────────────────────────────────────────────────
   Filing an application is worth marking. It is not worth stopping the
   screen for.

   This started as a full-screen moment and that was the wrong instinct:
   the first one is lovely and the tenth one is a toll gate between you
   and the next application. A member who is doing well sees this five
   times a week, so it has to be the kind of thing you can enjoy and walk
   straight past.

   So the news is delivered where the news actually landed. A pill springs
   in beside the tracker link in the sidebar, the link itself pulses, and
   both are gone in two seconds. Nothing is covered, nothing is blocked,
   and the eye is pointed at the place the application now lives rather
   than at a dialog in the middle of the screen.

   If the anchor is not on screen — mobile with the drawer shut, or a page
   outside the dashboard shell — it falls back to the bottom-left corner
   rather than not appearing at all.
*/

const HOLD_MS = 2400;

interface Anchor { top: number; left: number; below: boolean }

export function CelebrationHost() {
  const [payload, setPayload] = useState<CelebrationPayload | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const timers = useRef<number[]>([]);
  const reduced = prefersReducedMotion();

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const close = () => { clearTimers(); setPayload(null); setAnchor(null); };

  useEffect(() => onCelebrate(p => {
    clearTimers();
    haptic('success');

    const target = p.land
      ? document.querySelector<HTMLElement>(`[data-celebration-target="${p.land.target}"]`)
      : null;

    if (target) {
      const r = target.getBoundingClientRect();
      // Beside the link if there is room to its right, otherwise under it.
      const roomRight = window.innerWidth - r.right > 300;
      setAnchor(roomRight
        ? { top: r.top + r.height / 2, left: r.right + 12, below: false }
        : { top: r.bottom + 10, left: Math.max(12, r.left), below: true });

      if (!reduced) {
        // The destination answers. This is the half that says "here".
        target.animate(
          [
            { transform: 'scale(1)', offset: 0 },
            { transform: 'scale(1.05)', offset: 0.4 },
            { transform: 'scale(1)', offset: 1 },
          ],
          { duration: 460, easing: 'cubic-bezier(0.16, 1, 0.30, 1)' },
        );
      }
    } else {
      setAnchor(null);
    }

    setPayload(p);
    timers.current.push(window.setTimeout(close, HOLD_MS));
  }), [reduced]);

  useEffect(() => clearTimers, []);

  const placement: React.CSSProperties = anchor
    ? {
        top: anchor.top,
        left: anchor.left,
        transform: anchor.below ? undefined : 'translateY(-50%)',
      }
    : { bottom: 20, left: 20 };

  return (
    <AnimatePresence>
      {payload && (
        <motion.div
          key="celebration"
          onClick={close}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.86, x: anchor?.below ? 0 : -8 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18, ease: EASE.in } }}
          transition={reduced ? { duration: 0.12 } : SPRING.arrive}
          style={{
            position: 'fixed',
            zIndex: 4000,
            ...placement,
            display: 'flex', alignItems: 'center', gap: 10,
            maxWidth: 280,
            padding: '10px 14px 10px 11px',
            background: warm.colors.bgSurface,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: warm.radius.card,
            boxShadow: warm.shadow.lifted,
            cursor: 'pointer',
            transformOrigin: anchor?.below ? 'top left' : 'left center',
          }}
        >
          {/* The tick. Small, drawn on, one bloom and done. */}
          <span style={{ position: 'relative', width: 26, height: 26, flexShrink: 0 }}>
            {!reduced && (
              <motion.span
                initial={{ scale: 0.9, opacity: 0.5 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.7, ease: EASE.out, delay: 0.1 }}
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: `1.5px solid ${warm.colors.success}`,
                }}
              />
            )}
            <span style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: warm.colors.successSoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg
                width={14} height={14} viewBox="0 0 24 24" fill="none"
                stroke={warm.colors.success} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
              >
                <motion.path
                  d="M20 6 9 17l-5-5"
                  initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.3, ease: EASE.out, delay: 0.1 }}
                />
              </svg>
            </span>
          </span>

          <span style={{ minWidth: 0 }}>
            <span style={{
              display: 'block', fontFamily: warm.type.fontBody,
              fontSize: 13.5, fontWeight: warm.weight.semibold,
              color: warm.colors.textPrimary, lineHeight: 1.35,
            }}>
              {payload.title}
            </span>
            {payload.subtitle && (
              <span style={{
                display: 'block', marginTop: 1,
                fontFamily: warm.type.fontBody, fontSize: 12, lineHeight: 1.4,
                color: warm.colors.textMuted,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {payload.subtitle}
              </span>
            )}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
