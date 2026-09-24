import React, { useId } from 'react';
import { Brain } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { prefersReducedMotion } from '../../lib/theme/motion';
import { streakTier, type StreakTier } from '../../lib/growthTree';

/* ── PulsingBrainIcon ──────────────────────────────────────────────────
   The entry point to BrainPopup, sitting at the end of the heading.

   The expanding ring it used to throw is gone — a halo snapping outward
   every two seconds beside a heading is a notification badge, and it read
   as one. What is left is the icon itself being alive: the stroke is a
   gradient that flows along the lines, the whole glyph carries a soft
   glow that breathes, and roughly once every five seconds it gives one
   small pulse. The shapes are untouched; only the colour moves.

   Streak tier changes the colours and the tempo, so the icon previews the
   state of the tree behind it rather than speaking its own language.
*/

/* Blue into gold and back, always — the brain is meant to look alive and
   worth pressing, so the palette does not get duller as the streak gets
   better. An earlier pass tied the colours to the tier and a silver
   streak painted the icon grey, which is the opposite of a reward. The
   tier changes the tempo and the brightness instead. */
const FLOW_A = warm.colors.accentPetrol;
const FLOW_B = warm.colors.accentGoldBright;

/** Seconds for one pass of the gradient along the strokes. */
const FLOW_S: Record<StreakTier, number> = { none: 4.5, bronze: 3.8, silver: 3.2, gold: 2.4 };
/** How hard the glow sits under the glyph. */
const GLOW: Record<StreakTier, number> = { none: 0.45, bronze: 0.6, silver: 0.75, gold: 1 };

export interface PulsingBrainIconProps {
  streak: number;
  onClick: () => void;
  size?: number;
  /** 'chip' is the standalone circle. 'inline' is the bare glyph that sits
   *  at the end of a heading — no disc, no border. */
  variant?: 'chip' | 'inline';
}

export const PulsingBrainIcon: React.FC<PulsingBrainIconProps> = ({ streak, onClick, size = 34, variant = 'chip' }) => {
  const tier = streakTier(streak);
  const c1 = FLOW_A, c2 = FLOW_B;
  const flow = FLOW_S[tier];
  const glow = GLOW[tier];
  const reduced = prefersReducedMotion();
  const inline = variant === 'inline';

  // Namespaced so several brains on one page keep their own gradient and
  // their own keyframes (the glow strength differs by tier).
  const animId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradId = `brain-flow-${animId}`;

  return (
    <button
      onClick={onClick}
      aria-label={`Open your progress — ${streak > 0 ? `${streak}-day streak` : 'no streak yet'}`}
      className="tap-target"
      style={{
        position: 'relative', width: size, height: size, borderRadius: '50%',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: inline ? 'transparent' : `${c1}12`,
        border: inline ? 'none' : `1px solid ${c1}28`,
        padding: 0, cursor: 'pointer', flexShrink: 0, verticalAlign: 'middle',
      }}
    >
      {/* The gradient the strokes are painted with. Zero-sized on purpose:
          it exists only to be referenced by url() below. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
        <defs>
          {/* spreadMethod="repeat" tiles the blue-gold-blue ramp, and the
              transform slides it by exactly one tile, so the flow along
              the strokes is seamless and always covers the glyph. An
              earlier version swept x1/x2 across the shape instead, which
              left the icon painted flat for most of the cycle. */}
          <linearGradient
            id={gradId}
            x1="0" y1="0" x2="0.6" y2="0.35"
            spreadMethod="repeat"
            gradientUnits="objectBoundingBox"
          >
            <stop offset="0%" stopColor={c1} />
            <stop offset="50%" stopColor={c2} />
            <stop offset="100%" stopColor={c1} />
            {!reduced && (
              <animateTransform
                attributeName="gradientTransform"
                type="translate"
                from="0 0"
                to="0.6 0"
                dur={`${flow}s`}
                repeatCount="indefinite"
              />
            )}
          </linearGradient>
        </defs>
      </svg>

      <Brain
        size={Math.round(size * (inline ? 0.86 : 0.5))}
        color={`url(#${gradId})`}
        style={{
          position: 'relative', zIndex: 1,
          // The glow breathes, and every fifth second the whole glyph
          // gives one small nod. Both live in the same keyframe so they
          // can never drift apart.
          animation: reduced ? 'none' : `brain-alive-${animId} 5s ease-in-out infinite`,
          filter: `drop-shadow(0 0 4px ${c1}70)`,
        }}
      />

      <style>{`
        @keyframes brain-alive-${animId} {
          0%   { transform: scale(1) translateY(0);          filter: drop-shadow(0 0 ${3 * glow}px ${c1}66); }
          35%  { transform: scale(1.02) translateY(-0.5px);  filter: drop-shadow(0 0 ${7 * glow}px ${c2}88); }
          70%  { transform: scale(1) translateY(0);          filter: drop-shadow(0 0 ${3 * glow}px ${c1}66); }
          84%  { transform: scale(1) translateY(0);          filter: drop-shadow(0 0 ${3 * glow}px ${c1}66); }
          90%  { transform: scale(1.16) translateY(-1px);    filter: drop-shadow(0 0 ${12 * glow}px ${c2}); }
          96%  { transform: scale(0.99) translateY(0);       filter: drop-shadow(0 0 ${5 * glow}px ${c1}88); }
          100% { transform: scale(1) translateY(0);          filter: drop-shadow(0 0 ${3 * glow}px ${c1}66); }
        }
      `}</style>
    </button>
  );
};
