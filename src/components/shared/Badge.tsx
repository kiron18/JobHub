import React from 'react';
import { motion } from 'framer-motion';
import { warm } from '../../lib/theme/warmTokens';
import { SPRING } from '../../lib/theme/motion';

/* ── Badge ─────────────────────────────────────────────────────────────
   Status is everywhere in this product: application stage, fit verdict,
   sponsor status, document state, plan tier. Before this there were four
   radii, three text sizes and two fill strategies doing that job.

   Soft fill with matching text, never a solid one. A tracker row can hold
   three badges at once and a row of solid fills shouts at the reader.
*/

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const TONES: Record<BadgeTone, [string, string]> = {
  neutral: [warm.colors.bgAlt, warm.colors.textSecondary],
  accent: [warm.colors.accentPetrolSoft, warm.colors.accentPetrol],
  success: [warm.colors.successSoft, warm.colors.success],
  warning: [warm.colors.accentGoldSoft, warm.colors.accentGold],
  danger: [warm.colors.dangerSoft, warm.colors.danger],
};

export function Badge({
  tone = 'neutral', children, icon, /** Springs in on mount. For a status that just changed. */ animate,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  icon?: React.ReactNode;
  animate?: boolean;
}) {
  const [bg, fg] = TONES[tone];
  const Tag = animate ? motion.span : 'span';

  return (
    <Tag
      {...(animate ? { initial: { scale: 0.8, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: SPRING.arrive } : {})}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height: 22, padding: '0 9px',
        background: bg, color: fg,
        borderRadius: warm.radius.input === 10 ? 6 : 6,
        fontFamily: warm.type.fontBody,
        fontSize: 12, fontWeight: warm.weight.semibold,
        lineHeight: 1, whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {children}
    </Tag>
  );
}
