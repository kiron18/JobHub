import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, X as XIcon } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { pickQuizQuestion, type QuizQuestion } from '../../lib/engagementContent';

/* ── QuickQuiz ─────────────────────────────────────────────────────────
   One question, 2-3 choices, instant feedback. Deliberately tiny — this
   is meant to take under 10 seconds, not to be a lesson. Cadence (how
   often this surfaces, and whether it ramps up over the program) is a
   scheduling decision, not built here; this component just renders one
   question and reports back whether the pick was right via onAnswered.
*/

export interface QuickQuizProps {
  /** Pass a fixed question to control it explicitly (e.g. in a preview
   *  page); omit to pull one from the shared no-repeat bank. */
  question?: QuizQuestion;
  onAnswered?: (correct: boolean) => void;
  compact?: boolean;
}

export const QuickQuiz: React.FC<QuickQuizProps> = ({ question, onAnswered, compact }) => {
  const q = useMemo(() => question ?? pickQuizQuestion(), [question]);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);

  const pick = (i: number) => {
    if (pickedIndex !== null) return;
    setPickedIndex(i);
    onAnswered?.(!!q.choices[i].correct);
  };

  return (
    <div style={{
      background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
      borderRadius: 16, padding: compact ? '14px 16px' : '18px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Sparkles size={13} color={warm.colors.accentGoldBright} />
        <span style={{ ...warm.text.micro, color: warm.colors.accentGoldBright }}>Quick one</span>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: warm.colors.textPrimary, lineHeight: 1.4 }}>
        {q.prompt}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {q.choices.map((choice, i) => {
          const answered = pickedIndex !== null;
          const isPicked = pickedIndex === i;
          const isCorrect = !!choice.correct;
          let border: string = warm.colors.borderWhisper;
          let bg: string = warm.colors.bgAlt;
          let iconEl: React.ReactNode = null;
          if (answered && isCorrect) {
            border = warm.colors.success; bg = warm.colors.successSoft;
            iconEl = <Check size={14} color={warm.colors.success} />;
          } else if (answered && isPicked && !isCorrect) {
            border = warm.colors.danger; bg = warm.colors.dangerSoft;
            iconEl = <XIcon size={14} color={warm.colors.danger} />;
          }
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={answered}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                textAlign: 'left', padding: '9px 12px', borderRadius: 10,
                border: `1.5px solid ${border}`, background: bg,
                cursor: answered ? 'default' : 'pointer', fontSize: 12.5, fontWeight: 600,
                color: warm.colors.textPrimary,
              }}
            >
              <span>{choice.text}</span>
              {iconEl}
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {pickedIndex !== null && (
          <motion.p
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.5, color: warm.colors.textSecondary, overflow: 'hidden' }}
          >
            {q.explain}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};
