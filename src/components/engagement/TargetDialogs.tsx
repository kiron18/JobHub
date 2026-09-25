import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Handshake, RotateCcw } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { EASE, SPRING, DUR, t, prefersReducedMotion } from '../../lib/theme/motion';
import { TARGET_MIN, TARGET_MAX } from '../../lib/dailyTarget';

/* ── Target dialogs ────────────────────────────────────────────────────
   Two moments around committing to today's number, both of which have to
   be read rather than clicked past — so neither dismisses on a click-away
   or on Escape. The only way out of each is a button.

   The commit explainer is shown ONCE, ever, on the first Set. After that
   Set is instant: a dialog that appears every single morning stops being
   a commitment and becomes a doorway you shove through without reading.

   The tone is the point. This is not the product policing anyone — it is
   the product holding up something the member said they would do. Hence
   "you", not "we", everywhere it matters.
*/

interface ShellProps {
  open: boolean;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel?: string;
  onCancel?: () => void;
}

const Shell: React.FC<ShellProps> = ({
  open, icon, title, children, confirmLabel, onConfirm, cancelLabel, onCancel,
}) => {
  const reduced = prefersReducedMotion();

  // Escape closes only when there is something to close TO. With no
  // cancel, the dialog is a decision and has to be made.
  useEffect(() => {
    if (!open || !onCancel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR.fast }}
          style={{
            position: 'fixed', inset: 0, zIndex: 4600,
            background: 'rgba(20,16,12,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: DUR.fast, ease: EASE.in } }}
            transition={reduced ? { duration: DUR.instant } : SPRING.arrive}
            style={{
              width: '100%', maxWidth: 380, maxHeight: '90dvh', overflowY: 'auto',
              background: warm.colors.bgSurface,
              border: `1px solid ${warm.colors.borderWhisper}`,
              borderRadius: warm.radius.card,
              boxShadow: warm.shadow.lifted,
              padding: '26px 24px 20px',
              fontFamily: warm.type.fontBody,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <span style={{
                width: 46, height: 46, borderRadius: '50%',
                background: warm.colors.accentPetrolSoft,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {icon}
              </span>
            </div>

            <h2 style={{
              ...warm.text.h3, margin: '0 0 12px', textAlign: 'center',
              fontWeight: warm.weight.bold, color: warm.colors.textPrimary,
            }}>
              {title}
            </h2>

            {children}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
              <button
                type="button"
                onClick={onConfirm}
                className="tap-target"
                style={{
                  width: '100%', padding: '12px 20px', borderRadius: 10, border: 'none',
                  background: warm.colors.accentPetrol, color: warm.colors.textOnDeep,
                  ...warm.text.body, fontWeight: warm.weight.bold, cursor: 'pointer',
                  transition: t(['background-color'], DUR.fast),
                }}
              >
                {confirmLabel}
              </button>
              {cancelLabel && onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="tap-target"
                  style={{
                    width: '100%', padding: '10px 20px', borderRadius: 10,
                    border: 'none', background: 'transparent',
                    color: warm.colors.textMuted,
                    ...warm.text.small, fontWeight: warm.weight.semibold, cursor: 'pointer',
                    transition: t(['color'], DUR.fast),
                  }}
                >
                  {cancelLabel}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const para: React.CSSProperties = {
  ...warm.text.small, margin: '0 0 10px', lineHeight: 1.6, color: warm.colors.textSecondary,
};

/** First Set, ever. Explains what setting a number actually means. */
export const TargetCommitDialog: React.FC<{
  open: boolean;
  target: number;
  onConfirm: () => void;
}> = ({ open, target, onConfirm }) => (
  <Shell
    open={open}
    icon={<Handshake size={22} color={warm.colors.accentPetrol} />}
    title="This is a promise to yourself"
    confirmLabel={`Commit to ${target} today`}
    onConfirm={onConfirm}
  >
    <p style={para}>
      Once you set today's number it is fixed for the day. You can always do
      more — the number rises on its own if you go past it — but you cannot
      quietly lower it at 9pm because the day got away from you.
    </p>
    <p style={para}>
      That is the entire point. A target you can move is not a target, it is a
      comment. This one is the thing you told yourself you would do this
      morning, still standing there this evening.
    </p>
    <p style={{
      margin: '0', padding: '11px 13px', borderRadius: 10,
      background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
      ...warm.text.small, lineHeight: 1.55, color: warm.colors.textSecondary,
    }}>
      Mistakes and genuinely bad days happen, so you get <strong style={{ color: warm.colors.textPrimary }}>one
      undo per day</strong>. After that, today's number stands.
    </p>
    <p style={{ ...warm.text.small, margin: '10px 0 0', color: warm.colors.textMuted }}>
      You'll only see this once. From tomorrow, Set is instant.
    </p>
  </Shell>
);

/** Spending the day's single undo. */
export const TargetUndoDialog: React.FC<{
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, onConfirm, onCancel }) => (
  <Shell
    open={open}
    icon={<RotateCcw size={22} color={warm.colors.accentPetrol} />}
    title="Use today's one undo?"
    confirmLabel="Yes, unlock it"
    onConfirm={onConfirm}
    cancelLabel="Leave it as it is"
    onCancel={onCancel}
  >
    <p style={para}>
      This unlocks today's number so you can set it again — and it is the only
      undo you get today. Whatever you set next is final until tomorrow.
    </p>
    <p style={{ ...para, margin: 0 }}>
      Worth asking first: is the number wrong, or is today just hard? Anything
      from {TARGET_MIN} to {TARGET_MAX} is a real day's work, and finishing a
      smaller number beats abandoning a bigger one.
    </p>
  </Shell>
);
