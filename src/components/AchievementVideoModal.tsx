import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

function getPointedQuestions(description: string): string[] {
  const d = description.toLowerCase();
  const questions: string[] = [];

  if (d.match(/team|staff|people|member|direct report|manag/))
    questions.push('How many people were on the team or involved?');
  if (d.match(/customer|client|user|patient|student|stakeholder/))
    questions.push('How many customers, clients, or people were affected?');
  if (d.match(/revenue|sale|cost|budget|saving|spend|profit/))
    questions.push('By how much did the revenue, cost, or budget change?');
  if (d.match(/time|deadline|faster|quicker|hour|day|week|month/))
    questions.push('How much time was saved, or what was the delivery timeline?');
  if (d.match(/improv|increas|reduc|decreas|grow|boost|cut|optimis|streamlin/))
    questions.push('By what percentage or amount did it improve?');
  if (d.match(/project|launch|deliver|implement|deploy|roll/))
    questions.push('What was the scope — budget, timeline, or number of stakeholders?');

  if (questions.length < 2) {
    questions.push('How many people were involved or affected?');
    questions.push('Over what time period did this happen?');
  }

  return questions.slice(0, 3);
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  achievementDescription?: string;
  onMarkQualitative?: () => void;
}

export const AchievementVideoModal: React.FC<Props> = ({
  isOpen, onClose, isDark, achievementDescription = '', onMarkQualitative,
}) => {
  const bg = isDark ? '#0d1117' : '#fff';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const text = isDark ? '#f3f4f6' : '#111827';
  const sub = isDark ? '#9ca3af' : '#6b7280';
  const questions = getPointedQuestions(achievementDescription);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: bg, border: `1px solid ${border}`,
              borderRadius: 20, padding: '24px 28px', maxWidth: 520, width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: text, letterSpacing: '-0.01em' }}>
                  Finding your number
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: sub }}>
                  A metric turns a duty into evidence. Try these questions first.
                </p>
              </div>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: sub, padding: 4, lineHeight: 1, flexShrink: 0 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Pointed questions */}
            <div style={{
              background: isDark ? 'rgba(217,119,6,0.07)' : 'rgba(217,119,6,0.06)',
              border: '1px solid rgba(217,119,6,0.18)',
              borderRadius: 10, padding: '14px 16px', marginBottom: 16,
            }}>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#d97706' }}>
                Ask yourself
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {questions.map((q, i) => (
                  <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#d97706', flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
                    <span style={{ fontSize: 13, color: isDark ? '#e5e7eb' : '#374151', lineHeight: 1.5 }}>{q}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Video */}
            <video
              src="/Achievements_Edit.mp4"
              autoPlay
              loop
              muted
              playsInline
              style={{ width: '100%', borderRadius: 10, display: 'block', marginBottom: 12 }}
            />

            <p style={{ margin: '0 0 14px', fontSize: 12, color: sub, lineHeight: 1.6, textAlign: 'center' }}>
              Even an estimate lands better than nothing — "reduced handling time by roughly 30%" beats a blank field every time.
            </p>

            {/* Qualitative bypass */}
            {onMarkQualitative && (
              <div style={{ textAlign: 'center', paddingTop: 10, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, color: sub }}>
                  Genuinely can't find a number for this one?
                </p>
                <button
                  onClick={() => { onMarkQualitative(); onClose(); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, color: isDark ? '#6b7280' : '#9ca3af',
                    textDecoration: 'underline', textUnderlineOffset: 3, padding: 0,
                  }}
                >
                  Mark as qualitative — skip the metric warning
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
