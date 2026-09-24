import React from 'react';
import { Brain } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { prefersReducedMotion } from '../../lib/theme/motion';
import { streakTier, type StreakTier } from '../../lib/growthTree';

/* ── PulsingBrainIcon ──────────────────────────────────────────────────
   The entry point to BrainPopup. Pulses always (so it reads as "there's
   something to check in here," same instinct as a notification dot) but
   the pulse's color and speed step up with the streak tier — the icon is
   a preview of what the tree inside looks like, not a separate animation
   language from it.
*/

const TIER_COLOR: Partial<Record<StreakTier, string>> = {
  bronze: '#B0703A',
  silver: '#7C8A9A',
  gold: '#C4713A',
};

const TIER_DURATION_S: Record<StreakTier, number> = {
  none: 2.6,
  bronze: 2.2,
  silver: 1.8,
  gold: 1.3,
};

export interface PulsingBrainIconProps {
  streak: number;
  onClick: () => void;
  size?: number;
  /** 'chip' is the standalone circle. 'inline' is the bare glyph that sits
   *  at the end of a heading, as in the reference — no disc, no border,
   *  and the pulse is a soft halo behind the glyph instead of a ring. */
  variant?: 'chip' | 'inline';
}

export const PulsingBrainIcon: React.FC<PulsingBrainIconProps> = ({ streak, onClick, size = 34, variant = 'chip' }) => {
  const tier = streakTier(streak);
  const color = TIER_COLOR[tier] ?? warm.colors.accentPetrol;
  const duration = TIER_DURATION_S[tier];
  const reduced = prefersReducedMotion();
  const inline = variant === 'inline';

  return (
    <button
      onClick={onClick}
      aria-label={`Open your progress — ${streak > 0 ? `${streak}-day streak` : 'no streak yet'}`}
      className="tap-target"
      style={{
        position: 'relative', width: size, height: size, borderRadius: '50%',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: inline ? 'transparent' : `${color}15`,
        border: inline ? 'none' : `1px solid ${color}30`,
        padding: 0, cursor: 'pointer', flexShrink: 0, verticalAlign: 'middle',
      }}
    >
      <span
        style={{
          position: 'absolute', inset: inline ? -2 : 0, borderRadius: '50%', background: color,
          opacity: inline ? 0.22 : 0.35,
          animation: reduced ? 'none' : `brain-pulse-ring ${duration}s ease-out infinite`,
        }}
      />
      <Brain size={Math.round(size * (inline ? 0.86 : 0.5))} color={color} style={{ position: 'relative', zIndex: 1 }} />
      <style>{`
        @keyframes brain-pulse-ring {
          0% { transform: scale(0.85); opacity: 0.45; }
          70% { transform: scale(1.55); opacity: 0; }
          100% { transform: scale(1.55); opacity: 0; }
        }
      `}</style>
    </button>
  );
};
