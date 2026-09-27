import React, { useId } from 'react';
import { warm } from '../../lib/theme/warmTokens';
import { prefersReducedMotion } from '../../lib/theme/motion';
import { streakTier, type StreakTier } from '../../lib/growthTree';

/* ── PulsingBrainIcon ──────────────────────────────────────────────────
   The entry point to BrainPopup, sitting at the end of the heading.

   The expanding ring it used to throw is gone — a halo snapping outward
   every two seconds beside a heading is a notification badge and read as
   one. What is left is the icon being alive: a blue-into-gold gradient
   flowing along the strokes, a soft glow that breathes, and one small
   pulse roughly every five seconds. The shapes are lucide's Brain,
   untouched; only the colour moves.

   Why this draws its own <svg> instead of using <Brain> from lucide:
   lucide's Icon renders `children` AFTER the icon's paths, so a <defs>
   passed as a child lands below the paths that reference it, and the
   gradient would not resolve — the icon came out flat grey three times
   running. Owning the <svg> puts <defs> first, where a paint server has
   to be. The paths below are lucide's brain iconNode verbatim, so the
   glyph is identical to every other icon in the app.
*/

const FLOW_A = warm.colors.accentPetrol;
const FLOW_B = warm.colors.accentGoldBright;

/** Seconds for one pass of the gradient along the strokes. */
const FLOW_S: Record<StreakTier, number> = { none: 4.5, bronze: 3.8, silver: 3.2, gold: 2.4 };
/** How hard the glow sits under the glyph. */
const GLOW: Record<StreakTier, number> = { none: 0.45, bronze: 0.6, silver: 0.75, gold: 1 };

/** lucide `brain` iconNode, verbatim. */
const BRAIN_PATHS = [
  'M12 18V5',
  'M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4',
  'M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5',
  'M17.997 5.125a4 4 0 0 1 2.526 5.77',
  'M18 18a4 4 0 0 0 2-7.464',
  'M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517',
  'M6 18a4 4 0 0 1-2-7.464',
  'M6.003 5.125a4 4 0 0 0-2.526 5.77',
];

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

  const animId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradId = `brain-flow-${animId}`;
  const glyph = Math.round(size * (inline ? 0.86 : 0.5));

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
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        focusable="false"
        style={{
          position: 'relative', zIndex: 1, flexShrink: 0, display: 'block',
          animation: reduced ? 'none' : `brain-alive-${animId} 5s ease-in-out infinite`,
        }}
      >
        <defs>
          {/* spreadMethod="repeat" tiles the blue-gold-blue ramp and the
              transform slides it by exactly one tile, so the flow is
              seamless and the glyph is never left unpainted. */}
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
        {/* Solid colour named after the url(), so a paint server that fails
            to resolve leaves a blue brain rather than an invisible or
            inherited-grey one. */}
        <g stroke={`url(#${gradId}) ${c1}`}>
          {BRAIN_PATHS.map(d => <path key={d} d={d} />)}
        </g>
      </svg>

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
