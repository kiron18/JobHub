import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import { warm } from '../lib/theme/warmTokens';
import type { BridgedGap } from '../lib/bridgedGaps';
import { applyWorkspaceCopy as C } from '../pages/applyWorkspaceCopy';

interface Props {
  gaps: BridgedGap[];
  onConfirm: (confirmed: BridgedGap[]) => void;
}

/**
 * GapConfirmModal — opens over the apply workspace the instant analysis
 * finishes, before generation. Up to 3 strengths, pre-checked, one-line
 * editable. The user confirms in a single tap; unticked rows are dropped.
 * Copy is sourced verbatim from applyWorkspaceCopy.ts.
 */
export function GapConfirmModal({ gaps, onConfirm }: Props) {
  const [checked, setChecked] = useState<boolean[]>(() => gaps.map(() => true));
  const [statements, setStatements] = useState<string[]>(() => gaps.map(g => g.statement));

  const toggle = (i: number) =>
    setChecked(prev => prev.map((v, idx) => (idx === i ? !v : v)));

  const edit = (i: number, value: string) =>
    setStatements(prev => prev.map((s, idx) => (idx === i ? value : s)));

  const handleConfirm = () => {
    const confirmed: BridgedGap[] = gaps
      .map((g, i) => ({ skill: g.skill, statement: statements[i].trim() }))
      .filter((g, i) => checked[i] && g.statement.length > 0);
    onConfirm(confirmed);
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(26,24,20,0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          style={{
            width: '100%',
            maxWidth: 460,
            maxHeight: '85vh',
            overflowY: 'auto',
            background: warm.colors.bgSurface,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 18,
            padding: 26,
            boxShadow: '0 24px 60px rgba(26,24,20,0.28)',
          }}
        >
          <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: warm.colors.textPrimary, letterSpacing: '-0.01em' }}>
            {C.gapModal.header}
          </h3>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: warm.colors.textMuted, lineHeight: 1.5 }}>
            {C.gapModal.sub}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {gaps.map((g, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '12px 14px',
                  background: checked[i] ? 'rgba(125,166,125,0.10)' : warm.colors.bgAlt,
                  border: `1px solid ${checked[i] ? 'rgba(45,90,110,0.30)' : warm.colors.borderWhisper}`,
                  borderRadius: 12,
                  opacity: checked[i] ? 1 : 0.6,
                  transition: 'background 0.2s, border-color 0.2s, opacity 0.2s',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={() => toggle(i)}
                  aria-label={g.skill}
                  style={{ accentColor: warm.colors.accentPetrol, cursor: 'pointer', width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: warm.colors.textPrimary }}>
                    {g.skill}
                  </p>
                  <textarea
                    value={statements[i]}
                    onChange={e => edit(i, e.target.value)}
                    disabled={!checked[i]}
                    title={C.gapModal.editHint}
                    rows={3}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      // White, bordered field so it reads clearly as an editable input
                      // rather than static text sitting on the card background.
                      border: `1px solid ${checked[i] ? 'rgba(45,90,110,0.30)' : warm.colors.borderWhisper}`,
                      background: checked[i] ? '#FFFFFF' : warm.colors.bgAlt,
                      borderRadius: 8,
                      padding: '8px 10px',
                      outline: 'none',
                      resize: 'vertical',
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: warm.colors.textSecondary,
                      fontFamily: 'inherit',
                      cursor: checked[i] ? 'text' : 'not-allowed',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleConfirm}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '13px 0',
              fontSize: 14,
              fontWeight: 700,
              color: warm.colors.textOnDeep,
              background: warm.colors.accentPetrol,
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              boxShadow: warm.shadow.soft,
            }}
          >
            <Check size={15} />
            {C.gapModal.cta}
            <ArrowRight size={15} />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
