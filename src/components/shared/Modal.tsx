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
    /*
      Freeze the page behind the overlay. Without this a drag anywhere outside
      the panel scrolls the page underneath it, which on a phone — where the
      overlay covers nearly everything — reads as the modal itself sliding
      around. Restoring the previous value rather than clearing it matters:
      modals stack, and an inner one closing must not unfreeze the outer one.
    */
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          /* 24px a side costs 48 of a 390px screen. 16 on a phone, 24 from a
             tablet up. The safe-area terms keep the panel clear of the notch
             and the home indicator. */
          padding: 'clamp(16px, 4vw, 24px)',
          paddingTop: 'max(clamp(16px, 4vw, 24px), var(--safe-top))',
          paddingBottom: 'max(clamp(16px, 4vw, 24px), var(--safe-bottom))',
          boxSizing: 'border-box',
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
              /*
                dvh, not vh. 100vh on a phone is measured with the browser
                chrome retracted, so `100vh - 48px` was still taller than the
                visible window and the footer — which holds the primary button —
                sat underneath the address bar with no way to reach it.
              */
              maxHeight: 'calc(100dvh - clamp(32px, 8vw, 48px))',
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

            <div
              data-scroll-pane
              style={{
                padding: title ? 'clamp(16px, 4vw, 20px)' : 'clamp(20px, 5vw, 28px)',
                overflowY: 'auto', flex: 1,
              }}
            >
              {children}
            </div>

            {footer && (
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: 8,
                /* Two full-word buttons ("Cancel" / "Save and continue") do not
                   fit side by side at 320px. Wrapping is the graceful version
                   of that: they stay a row wherever there is room. */
                flexWrap: 'wrap',
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
