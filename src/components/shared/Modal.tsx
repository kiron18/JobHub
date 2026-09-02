import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { EASE, DUR } from '../../lib/theme/motion';
import { IconButton } from './Button';

/* ── Modal ─────────────────────────────────────────────────────────────
   Imported by 22 files. Three things changed:

   The scrim was rgba(26,24,20,0.36), a leftover from the retired brown
   palette, which tinted every overlay in the product warm on a cool page.
   It is now built from the deep navy.

   It enters slower than it leaves. 440ms in, 180ms out: an overlay that
   dismisses as slowly as it opens makes the whole product feel heavy,
   because by then the user has already decided.

   It gained a footer slot, because all 22 callers were hand-building
   their own button row and none of them agreed on the order. Secondary
   left, primary right, always.
*/

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  title?: string;
  /** Action row, pinned to the bottom on the alt fill. */
  footer?: React.ReactNode;
}

export function Modal({ open, onClose, children, maxWidth = 480, title, footer }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.base, ease: EASE.out }}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(15, 32, 56, 0.42)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
            onClick={onClose}
          />

          <motion.div
            ref={contentRef}
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99, transition: { duration: DUR.fast, ease: EASE.in } }}
            transition={{ duration: DUR.slow, ease: EASE.out }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth,
              background: warm.colors.bgSurface,
              borderRadius: warm.radius.card,
              boxShadow: warm.shadow.lifted,
              maxHeight: 'calc(100vh - 48px)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {title ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '18px 20px 14px',
                borderBottom: `1px solid ${warm.colors.borderWhisper}`,
                flexShrink: 0,
              }}>
                <h2 style={{
                  margin: 0, fontFamily: warm.type.fontBody,
                  ...warm.text.h2, color: warm.colors.textPrimary,
                }}>
                  {title}
                </h2>
                <IconButton label="Close" onClick={onClose}>
                  <X size={18} />
                </IconButton>
              </div>
            ) : (
              <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}>
                <IconButton label="Close" onClick={onClose}>
                  <X size={18} />
                </IconButton>
              </div>
            )}

            <div style={{ padding: title ? '20px' : '28px', overflowY: 'auto', flex: 1 }}>
              {children}
            </div>

            {footer && (
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: 8,
                padding: '12px 20px',
                borderTop: `1px solid ${warm.colors.borderWhisper}`,
                background: warm.colors.bgAlt,
                flexShrink: 0,
              }}>
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
