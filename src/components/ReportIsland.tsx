import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { type SectionMeta, SECTION_LINKS, SECTION_ICONS } from '../lib/reportIcons';
import api from '../lib/api';

export interface ReportIslandProps {
  sectionKey: string;
  meta: SectionMeta;
  problemText: string;
  fixText: string;
  reportId: string;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: (key: string) => void;
}

type Feedback = 'spot_on' | 'partially' | 'missed';

function extractTeaser(text: string): string {
  const sentence = text.split(/[.!?]/)[0]?.trim() ?? '';
  return sentence.length > 120 ? sentence.slice(0, 117) + '...' : sentence;
}

export function ReportIsland({
  sectionKey, meta, problemText, fixText, reportId,
  isOpen, onToggle, onNavigate,
}: ReportIslandProps) {
  const [showFix, setShowFix] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const Icon = meta.icon;
  const teaser = extractTeaser(problemText);
  const links = SECTION_LINKS[sectionKey] ?? [];

  async function submitFeedback(score: Feedback) {
    if (feedback || feedbackLoading) return;
    setFeedbackLoading(true);
    try {
      await api.post(`/onboarding/report/${reportId}/feedback`, {
        sectionKey,
        relevanceScore: score,
      });
      setFeedback(score);
    } catch {
      // silent — non-critical
    } finally {
      setFeedbackLoading(false);
    }
  }

  const handleToggle = () => {
    if (isOpen) setShowFix(false);
    onToggle();
  };

  return (
    <div
      id={`report-island-${sectionKey}`}
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 16,
      }}
    >
      {/* Header (always visible) */}
      <button
        onClick={handleToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '20px 24px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Icon with pulse when closed */}
        <motion.span
          animate={isOpen ? {} : { scale: [1, 1.12, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40, height: 40,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          <Icon size={18} color="#9ca3af" />
        </motion.span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#f3f4f6', margin: 0 }}>
            {meta.label}
          </p>
          {!isOpen && (
            <p style={{
              fontSize: 13, color: '#6b7280', margin: '3px 0 0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {teaser}
            </p>
          )}
        </div>

        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          style={{ flexShrink: 0, color: '#4b5563' }}
        >
          <ChevronDown size={18} />
        </motion.span>
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0, 0, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 24px 24px' }}>
              {/* Problem text */}
              <p style={{
                fontSize: 15, color: '#d1d5db', lineHeight: 1.7,
                whiteSpace: 'pre-wrap', marginBottom: 20,
              }}>
                {problemText}
              </p>

              {/* Show fix button */}
              {!showFix && (
                <button
                  onClick={() => setShowFix(true)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 12,
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#f3f4f6',
                    cursor: 'pointer',
                    marginBottom: 24,
                  }}
                >
                  Show me the fix →
                </button>
              )}

              {/* Fix reveal */}
              <AnimatePresence>
                {showFix && (
                  <motion.div
                    key="fix"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ duration: 0.25, ease: [0.25, 0, 0, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 14,
                      padding: '18px 20px',
                      marginBottom: 24,
                      boxShadow: '0 0 24px rgba(99,102,241,0.08)',
                    }}>
                      <p style={{
                        fontSize: 12, fontWeight: 700, color: '#6b7280',
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        marginBottom: 10,
                      }}>
                        Your fix
                      </p>
                      <p style={{ fontSize: 15, color: '#d1d5db', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {fixText}
                      </p>
                    </div>

                    {/* Feedback pills */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
                      {(['spot_on', 'partially', 'missed'] as Feedback[]).map(score => {
                        const labels = { spot_on: 'Spot on', partially: 'Partially', missed: 'Missed the mark' };
                        const active = feedback === score;
                        return (
                          <button
                            key={score}
                            onClick={() => submitFeedback(score)}
                            disabled={!!feedback || feedbackLoading}
                            style={{
                              padding: '6px 14px',
                              borderRadius: 99,
                              fontSize: 13,
                              fontWeight: 600,
                              border: `1px solid ${active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                              background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                              color: active ? '#f3f4f6' : '#6b7280',
                              cursor: feedback ? 'default' : 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            {labels[score]}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cross-section CTAs */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {links.map(({ key, why }) => {
                  const dest = SECTION_ICONS[key];
                  if (!dest) return null;
                  const DestIcon = dest.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => onNavigate(key)}
                      style={{
                        flex: 1, minWidth: 200,
                        display: 'flex', flexDirection: 'column', gap: 4,
                        padding: '14px 16px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 14,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <DestIcon size={14} color="#6b7280" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#f3f4f6' }}>
                          {dest.label}
                        </span>
                      </span>
                      <span style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{why}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
