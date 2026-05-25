import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  title?: string;
}

export function Modal({ open, onClose, children, maxWidth = 480, title }: ModalProps) {
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
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(26, 24, 20, 0.36)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            ref={contentRef}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth,
              background: warm.colors.bgSurface,
              borderRadius: warm.radius.card,
              padding: 28,
              boxShadow: warm.shadow.lifted,
              maxHeight: 'calc(100vh - 48px)',
              overflowY: 'auto',
            }}
          >
            {title && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 20,
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: warm.colors.textPrimary,
                  fontFamily: warm.type.fontBody,
                }}>
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close modal"
                  style={{
                    background: 'transparent', border: 'none',
                    cursor: 'pointer', color: warm.colors.textMuted,
                    padding: 4, display: 'flex',
                    borderRadius: 6,
                    transition: 'color 180ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = warm.colors.textPrimary; }}
                  onMouseLeave={e => { e.currentTarget.style.color = warm.colors.textMuted; }}
                >
                  <X size={18} />
                </button>
              </div>
            )}
            {!title && (
              <button
                onClick={onClose}
                aria-label="Close modal"
                style={{
                  position: 'absolute', top: 16, right: 16,
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', color: warm.colors.textMuted,
                  padding: 4, display: 'flex',
                  borderRadius: 6,
                  transition: 'color 180ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = warm.colors.textPrimary; }}
                onMouseLeave={e => { e.currentTarget.style.color = warm.colors.textMuted; }}
              >
                <X size={18} />
              </button>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
