import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { colors, type as typeTokens } from '../tokens';

/* ── One face at a time ──────────────────────────────────────────────────────
   Eight cards, each a client's photo with the message they sent that day
   sitting on it. They are shown one at a time rather than as a wall, because
   the message is baked into the image at about 250px wide: any grid that fits
   eight of them across makes the sentence unreadable, and an unreadable
   testimonial is decoration.

   The neighbours sit either side at reduced scale and opacity on a wide screen,
   so the thing reads as a stack you are moving through rather than a slideshow
   that replaces itself. On a phone there is only room for the one.

   It advances itself, and it stops advancing the moment anyone touches it:
   hover, focus, or a click on a dot. Someone reading a message should never
   have it slide out from under them.                                          */

const CARDS = Array.from({ length: 8 }, (_, i) => `/Assets/testimonials/card_${i + 1}.jpg`);
const INTERVAL_MS = 4500;

export function ProofTicker() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const timer = useRef<number | null>(null);

  const go = useCallback((next: number) => {
    setIndex(((next % CARDS.length) + CARDS.length) % CARDS.length);
  }, []);

  useEffect(() => {
    if (paused || reduceMotion) return;
    timer.current = window.setTimeout(() => go(index + 1), INTERVAL_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [index, paused, reduceMotion, go]);

  const prev = (index - 1 + CARDS.length) % CARDS.length;
  const next = (index + 1) % CARDS.length;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'clamp(10px, 2vw, 22px)',
          width: '100%',
        }}
        aria-live="polite"
      >
        {/* Neighbours. Decorative, and hidden from assistive tech. */}
        {[prev, next].map((n, side) => (
          <img
            key={`side-${side}`}
            src={CARDS[n]}
            alt=""
            aria-hidden
            loading="lazy"
            className="proof-ticker-side"
            style={{
              width: 150,
              height: 'auto',
              borderRadius: 12,
              opacity: 0.35,
              filter: 'saturate(0.7)',
              display: 'none',
              order: side === 0 ? 0 : 2,
              flexShrink: 0,
            }}
          />
        ))}

        <div style={{ order: 1, width: 'min(258px, 74vw)', flexShrink: 0 }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.img
              key={CARDS[index]}
              src={CARDS[index]}
              alt={`A client's message on the day it happened, ${index + 1} of ${CARDS.length}`}
              loading={index === 0 ? 'eager' : 'lazy'}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.985 }}
              transition={{ duration: 0.42, ease: [0.25, 1, 0.5, 1] }}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                borderRadius: 14,
                border: `1px solid ${colors.borderDefined}`,
                boxShadow: '0 1px 2px rgba(26,24,20,0.05), 0 18px 40px -20px rgba(26,24,20,0.45)',
              }}
            />
          </AnimatePresence>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }} role="tablist" aria-label="Client messages">
        {CARDS.map((src, i) => (
          <button
            key={src}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Message ${i + 1}`}
            onClick={() => go(i)}
            style={{
              width: i === index ? 20 : 7,
              height: 7,
              padding: 0,
              borderRadius: 99,
              border: 'none',
              cursor: 'pointer',
              background: i === index ? colors.accentPetrol : colors.borderDefined,
              transition: 'width 240ms cubic-bezier(0.25,1,0.5,1), background 240ms',
            }}
          />
        ))}
      </div>

      <p
        style={{
          fontFamily: typeTokens.body,
          fontSize: '0.8125rem',
          color: colors.textMuted,
          margin: 0,
          textAlign: 'center',
        }}
      >
        Real clients. Real messages, the day they landed.
      </p>

      <style>{`@media (min-width: 900px) { .proof-ticker-side { display: block !important; } }`}</style>
    </div>
  );
}
