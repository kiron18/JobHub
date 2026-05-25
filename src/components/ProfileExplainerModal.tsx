import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, Lock, Pencil } from 'lucide-react';
import { warm } from '../lib/theme/warmTokens';

const LS_SEEN = 'jobhub_profile_explainer_seen';

interface ProfileExplainerModalProps {
  open: boolean;
  onClose: () => void;
}

const sectionRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 14,
  padding: '16px 0',
  borderTop: `1px solid ${warm.colors.borderWhisper}`,
};

const iconBubble: React.CSSProperties = {
  flexShrink: 0,
  width: 32,
  height: 32,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const ProfileExplainerModal: React.FC<ProfileExplainerModalProps> = ({ open, onClose }) => {
  // Mark seen the first time the modal opens. Re-opens via the help button are
  // a no-op for this flag.
  useEffect(() => {
    if (open) localStorage.setItem(LS_SEEN, 'true');
  }, [open]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 90,
            background: 'rgba(26, 24, 20, 0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-explainer-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
            style={{
              background: warm.colors.bgSurface,
              border: `1px solid ${warm.colors.borderWhisper}`,
              borderRadius: 18,
              padding: '28px 28px 24px',
              maxWidth: 520,
              width: '100%',
              boxShadow: '0 24px 64px rgba(26, 24, 20, 0.18)',
              fontFamily: warm.type.fontBody,
              position: 'relative',
            }}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                position: 'absolute', top: 12, right: 12,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: warm.colors.textMuted, padding: 6, borderRadius: 8,
              }}
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ ...iconBubble, width: 36, height: 36, background: `${warm.colors.accentPetrol}15` }}>
                <Brain size={18} color={warm.colors.accentPetrol} />
              </div>
              <h2
                id="profile-explainer-title"
                style={{
                  margin: 0,
                  fontFamily: warm.type.fontDisplay,
                  fontSize: 20,
                  fontWeight: 700,
                  color: warm.colors.textPrimary,
                  letterSpacing: '-0.02em',
                }}
              >
                This is the brain of your applications
              </h2>
            </div>
            <p style={{
              margin: '0 0 4px 48px',
              fontSize: 13,
              lineHeight: 1.55,
              color: warm.colors.textSecondary,
            }}>
              Every resume and cover letter JobHub writes pulls from this page. Edit once, change every future application.
            </p>

            {/* Section: non-editable target roles */}
            <div style={sectionRow}>
              <div style={{ ...iconBubble, background: `${warm.colors.accentGold}18` }}>
                <Lock size={15} color={warm.colors.accentGold} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: '0 0 4px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: warm.colors.textPrimary,
                }}>
                  Roles You Should Target <span style={{ color: warm.colors.textMuted, fontWeight: 600 }}>· read-only</span>
                </p>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: warm.colors.textSecondary }}>
                  AI-mapped from your background. Search these on Seek, LinkedIn, or Indeed — they're the best-fit pipeline for who you are right now. Regenerate when your story changes.
                </p>
              </div>
            </div>

            {/* Section: editable source of truth */}
            <div style={sectionRow}>
              <div style={{ ...iconBubble, background: 'rgba(125, 166, 125, 0.18)' }}>
                <Pencil size={15} color="#5B8F5B" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: '0 0 4px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: warm.colors.textPrimary,
                }}>
                  Everything below is yours to edit
                </p>
                <p style={{ margin: '0 0 8px', fontSize: 12.5, lineHeight: 1.55, color: warm.colors.textSecondary }}>
                  Professional Experience, Work Experience, Education, Skills, Achievements. This is your source of truth — any edit here flows into the next tailored application.
                </p>
                <div style={{
                  background: warm.colors.bgAlt,
                  border: `1px solid ${warm.colors.borderWhisper}`,
                  borderLeft: `3px solid ${warm.colors.accentPetrol}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 12,
                  lineHeight: 1.55,
                  color: warm.colors.textSecondary,
                }}>
                  <strong style={{ color: warm.colors.textPrimary }}>Example:</strong> add a new role to Work Experience tonight → tomorrow's tailored resume already weaves it in.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={onClose}
                style={{
                  background: warm.colors.accentPetrol,
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 12,
                  padding: '10px 22px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '-0.01em',
                }}
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Read whether the explainer has been seen at least once. */
export function hasSeenProfileExplainer(): boolean {
  return localStorage.getItem(LS_SEEN) === 'true';
}
