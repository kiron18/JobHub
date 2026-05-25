import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { SectionId } from './types';
import { warm } from '../../lib/theme/warmTokens';

const STORAGE_KEY = 'jobhub_section_intros_seen';

interface SectionIntroBannerProps {
  sectionId: SectionId;
  /** Single-line body copy. */
  children: React.ReactNode;
}

export const SectionIntroBanner: React.FC<SectionIntroBannerProps> = ({ sectionId, children }) => {
  const [dismissed, setDismissed] = React.useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      return parsed[sectionId] === true;
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      parsed[sectionId] = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // localStorage unavailable — just hide for this session
    }
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '12px 16px',
            marginBottom: 20,
            background: warm.colors.bgAlt,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: warm.radius.card,
            color: warm.colors.textSecondary,
            fontSize: 13,
            lineHeight: 1.55,
          }}
          role="note"
        >
          <span style={{ flex: 1 }}>{children}</span>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: warm.colors.textMuted,
              padding: 4,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
