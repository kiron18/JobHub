import React from 'react';
import { motion } from 'framer-motion';
import { warm } from '../../lib/theme/warmTokens';
import { rise, stagger } from '../../lib/theme/motion';
import { Button } from './Button';

/* ── EmptyState ────────────────────────────────────────────────────────
   A new client meets these before they meet anything else: no applications,
   no documents, no answers banked. They were the least designed screens in
   the product and they are the first impression of it.

   One shape, and it always ends in an action. An empty state that only
   says "nothing here" is a dead end dressed as information.
*/

export function EmptyState({
  title, body, actionLabel, onAction, secondaryLabel, onSecondary, icon,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <motion.div
      variants={stagger(0.05)}
      initial="hidden"
      animate="show"
      style={{ textAlign: 'center', padding: '34px 16px' }}
    >
      {icon && (
        <motion.div variants={rise} style={{ color: warm.colors.textMuted, marginBottom: 12 }}>
          {icon}
        </motion.div>
      )}
      <motion.h3
        variants={rise}
        style={{ margin: '0 0 6px', fontFamily: warm.type.fontBody, ...warm.text.h3, color: warm.colors.textPrimary }}
      >
        {title}
      </motion.h3>
      {body && (
        <motion.p
          variants={rise}
          style={{
            margin: '0 auto 18px', maxWidth: 340,
            fontFamily: warm.type.fontBody, ...warm.text.small,
            color: warm.colors.textMuted,
          }}
        >
          {body}
        </motion.p>
      )}
      {(actionLabel || secondaryLabel) && (
        <motion.div variants={rise} style={{ display: 'inline-flex', gap: 8 }}>
          {actionLabel && onAction && <Button size="sm" label={actionLabel} onClick={onAction} />}
          {secondaryLabel && onSecondary && (
            <Button size="sm" variant="ghost" label={secondaryLabel} onClick={onSecondary} />
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
