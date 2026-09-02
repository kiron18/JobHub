import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { warm } from '../../lib/theme/warmTokens';
import { SPRING, t, DUR } from '../../lib/theme/motion';

/* ── Card ──────────────────────────────────────────────────────────────
   Imported by 43 files, so its defaults are the product's defaults.

   Two things were added and nothing was taken away: optional header and
   footer slots, because most callers were hand-building those, and an
   `interactive` mode for cards that are really buttons. An interactive
   card lifts 2px on hover and presses on tap, which is the only signal a
   card gets that it can be clicked.
*/

interface CardProps {
  children: React.ReactNode;
  padding?: string;
  style?: React.CSSProperties;
  /** Rendered above the body, separated by a hairline. */
  header?: React.ReactNode;
  /** Rendered below the body on the alt fill. Usually an action row. */
  footer?: React.ReactNode;
  /** Makes the whole card a press target: hover lift, tap press, pointer. */
  interactive?: boolean;
  onClick?: () => void;
  /** Raises the card off the page. For overlays and things that float. */
  elevated?: boolean;
}

export function Card({
  children, padding = '20px', style, header, footer, interactive, onClick, elevated,
}: CardProps) {
  const [hover, setHover] = useState(false);
  const lifted = interactive && hover;

  return (
    <motion.div
      onClick={onClick}
      onHoverStart={interactive ? () => setHover(true) : undefined}
      onHoverEnd={interactive ? () => setHover(false) : undefined}
      whileTap={interactive ? { scale: 0.995 } : undefined}
      animate={interactive ? { y: hover ? -2 : 0 } : undefined}
      transition={SPRING.tap}
      style={{
        background: warm.colors.bgSurface,
        border: `1px solid ${lifted ? warm.colors.borderDefined : warm.colors.borderWhisper}`,
        borderRadius: warm.radius.card,
        boxShadow: elevated ? warm.shadow.lifted : lifted ? warm.shadow.lifted : warm.shadow.soft,
        overflow: header || footer ? 'hidden' : undefined,
        cursor: interactive ? 'pointer' : undefined,
        transition: t(['border-color', 'box-shadow'], DUR.base),
        ...(header || footer ? {} : { padding }),
        ...style,
      }}
    >
      {header && (
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${warm.colors.borderWhisper}` }}>
          {header}
        </div>
      )}
      {header || footer ? <div style={{ padding }}>{children}</div> : children}
      {footer && (
        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid ${warm.colors.borderWhisper}`,
          background: warm.colors.bgAlt,
        }}>
          {footer}
        </div>
      )}
    </motion.div>
  );
}
