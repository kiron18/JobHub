import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Leaf, Flower2, CalendarDays, Flame } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { TreeAvatar } from './TreeAvatar';
import { streakTier, type StreakTier } from '../../lib/growthTree';

/* ── BrainPopup ────────────────────────────────────────────────────────
   Opens from the pulsing brain icon. Same modal shell as
   ProfileExplainerModal (centred card, backdrop click + Escape to close)
   so the two popups feel like the same app. This one's job is different:
   it's the single place daily/weekly/long-term progress read together —
   the tree for "does this add up over time," the stat row for "what
   exactly happened."
*/

const TIER_LABEL: Record<StreakTier, string> = {
  none: 'No streak yet',
  bronze: 'Bronze streak',
  silver: 'Silver streak',
  gold: 'Gold streak',
};

const TIER_COLOR: Record<StreakTier, string> = {
  none: '#8A8378',
  bronze: '#B0703A',
  silver: '#7C8A9A',
  gold: '#C4713A',
};

export interface BrainPopupStats {
  applications: number;
  outreach: number;
  daysActive: number;
  streak: number;
}

export interface BrainPopupProps {
  open: boolean;
  onClose: () => void;
  /** Fixes the tree's shape/species/persona — pass a stable per-user value. */
  seed: number;
  /** Calendar day in the 90-day program, 0-90. */
  programDay: number;
  interviews: number;
  absenceDays: number;
  stats: BrainPopupStats;
}

const statCardStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 0', minWidth: 92,
  background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
  borderRadius: 12, padding: '10px 12px',
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number | string; color: string }> = ({ icon, label, value, color }) => (
  <div style={statCardStyle}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color }}>
      {icon}
      <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: warm.colors.textMuted }}>{label}</span>
    </div>
    <span style={{ fontSize: 20, fontWeight: 800, color: warm.colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
  </div>
);

export const BrainPopup: React.FC<BrainPopupProps> = ({ open, onClose, seed, programDay, interviews, absenceDays, stats }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const tier = streakTier(stats.streak);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(26, 24, 20, 0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          role="dialog" aria-modal="true" aria-labelledby="brain-popup-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
            style={{
              background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 20,
              padding: '24px 24px 22px', maxWidth: 420, width: '100%', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 24px 64px rgba(26, 24, 20, 0.18)', fontFamily: warm.type.fontBody, position: 'relative',
            }}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="tap-target"
              style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: warm.colors.textMuted, padding: 6, borderRadius: 8 }}
            >
              <X size={16} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
                fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                background: `${TIER_COLOR[tier]}18`, color: TIER_COLOR[tier],
              }}>
                <Flame size={11} /> {TIER_LABEL[tier]}
              </span>
              <h2 id="brain-popup-title" style={{
                margin: '10px 0 0', fontFamily: warm.type.fontDisplay, fontSize: 19, fontWeight: 700,
                color: warm.colors.textPrimary, letterSpacing: '-0.02em',
              }}>
                {stats.streak > 0 ? `${stats.streak}-day streak` : 'Your growth tree'}
              </h2>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 10px' }}>
              <TreeAvatar
                seed={seed}
                day={programDay}
                applications={stats.applications}
                interviews={interviews}
                outreach={stats.outreach}
                streak={stats.streak}
                absenceDays={absenceDays}
                size={250}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <StatCard icon={<Leaf size={12} />} label="Applications" value={stats.applications} color="#4E8B4A" />
              <StatCard icon={<Flower2 size={12} />} label="Outreach" value={stats.outreach} color="#D98BA4" />
              <StatCard icon={<CalendarDays size={12} />} label="Days active" value={stats.daysActive} color={warm.colors.accentPetrol} />
              <StatCard icon={<Flame size={12} />} label="Streak" value={stats.streak} color={TIER_COLOR[tier]} />
            </div>

            <p style={{ margin: '14px 0 0', fontSize: 11.5, lineHeight: 1.55, color: warm.colors.textMuted, textAlign: 'center' }}>
              Applications are leaves. Outreach is blossom — and blossom is what comes before
              fruit, which is every interview. A streak grows flowers in the grass and keeps the
              canopy bright; go quiet and it fades, but it never dies.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
