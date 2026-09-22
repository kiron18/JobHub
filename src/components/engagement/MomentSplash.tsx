import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type LucideIcon, Lightbulb } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { EASE, SPRING, prefersReducedMotion } from '../../lib/theme/motion';
import { pickTip } from '../../lib/engagementContent';

/* ── MomentSplash ──────────────────────────────────────────────────────
   Generalizes TrialDayIntro's "Congrats!" screen so any milestone can use
   it — a streak tier-up, a week finished, the tree stage advancing — not
   just trial day 1. Every showing carries one bonus tip, pulled from the
   same no-repeat bank the quiz uses, so two players hitting the same
   milestone don't necessarily see the same tip twice in a row.

   Full-screen like TrialDayIntro (position:fixed, inset:0) since that's
   the established "this is a moment, not a toast" pattern in this app —
   see DailyCloseOut for the smaller, higher-frequency version of the
   same idea.
*/

export interface MomentSplashProps {
  open: boolean;
  onContinue: () => void;
  icon: LucideIcon;
  eyebrow: string; // e.g. "7-DAY STREAK"
  title: string; // e.g. "Gold tier unlocked"
  subtitle?: string;
  ctaLabel?: string;
  /** Pass a fixed tip to control it explicitly; omit to pull one from the
   *  shared no-repeat bank each time the splash opens. */
  tip?: string;
}

export const MomentSplash: React.FC<MomentSplashProps> = ({
  open, onContinue, icon: Icon, eyebrow, title, subtitle, ctaLabel = 'Continue', tip,
}) => {
  const reduced = prefersReducedMotion();
  const shownTip = tip ?? (open ? pickTip() : '');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === 'Escape') onContinue(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onContinue]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 5000, background: warm.colors.bgCanvas,
            overflowY: 'auto', display: 'flex', padding: '48px 24px', boxSizing: 'border-box',
          }}
        >
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15, ease: EASE.in } }}
            transition={reduced ? { duration: 0.12 } : SPRING.arrive}
            style={{ width: '100%', maxWidth: 420, margin: 'auto', textAlign: 'center' }}
          >
            <motion.div
              initial={reduced ? { scale: 1 } : { scale: 0.4, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={reduced ? { duration: 0 } : { ...SPRING.arrive, delay: 0.08 }}
              style={{
                width: 84, height: 84, borderRadius: '50%', margin: '0 auto 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${warm.colors.accentPetrol}12`, border: `2px solid ${warm.colors.accentPetrol}30`,
              }}
            >
              <Icon size={38} color={warm.colors.accentPetrol} />
            </motion.div>

            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: warm.colors.accentPetrol, margin: '0 0 8px' }}>
              {eyebrow}
            </p>
            <h1 style={{ fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 800, color: warm.colors.textPrimary, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: 14, color: warm.colors.textSecondary, margin: '0 0 22px', lineHeight: 1.5 }}>
                {subtitle}
              </p>
            )}

            {shownTip && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left',
                background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
                borderRadius: 14, padding: '14px 16px', marginTop: subtitle ? 0 : 22, marginBottom: 26,
              }}>
                <Lightbulb size={16} color={warm.colors.accentGoldBright} style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: warm.colors.textSecondary }}>
                  {shownTip}
                </p>
              </div>
            )}

            <button
              onClick={onContinue}
              style={{
                width: '100%', padding: '15px 24px', borderRadius: 12, border: 'none',
                background: warm.colors.accentPetrol, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {ctaLabel}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
