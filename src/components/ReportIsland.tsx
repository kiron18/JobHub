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
    <motion.div
      id={`report-island-${sectionKey}`}
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
      style={{
        background: isOpen ? meta.colorBg : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isOpen ? meta.color + '30' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 20,
        overflow: 'hidden',
        transition: 'background 0.3s, border-color 0.3s',
      }}
    >
      {/* Header */}
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
        {/* Origami icon — pulse when closed */}
        <motion.span
          animate={isOpen ? {} : { scale: [1, 1.10, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 12,
            background: isOpen ? meta.colorBg : 'rgba(255,255,255,0.06)',
            flexShrink: 0,
            transition: 'background 0.3s',
          }}
        >
          <Icon size={28} />
        </motion.span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 15,
            fontWeight: 700,
            color: isOpen ? meta.color : '#f3f4f6',
            margin: 0,
            transition: 'color 0.3s',
          }}>
            {meta.label}
          </p>
          {!isOpen && (
            <p style={{
              fontSize: 13,
              color: '#6b7280',
              margin: '3px 0 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {teaser}
            </p>
          )}
        </div>

        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          style={{ flexShrink: 0, color: isOpen ? meta.color : '#4b5563', transition: 'color 0.3s' }}
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
              {/* Accent rule */}
              <div style={{
                height: 2,
                background: `linear-gradient(90deg, ${meta.color}60, transparent)`,
                borderRadius: 99,
                marginBottom: 20,
              }} />

              {/* Problem text */}
              <p style={{
                fontSize: 15,
                color: '#d1d5db',
                lineHeight: 1.75,
                whiteSpace: 'pre-wrap',
                marginBottom: 20,
              }}>
                {problemText}
              </p>

              {/* Show fix button */}
              {!showFix && (
                <button
                  onClick={() => setShowFix(true)}
                  style={{
                    background: meta.colorBg,
                    border: `1px solid ${meta.color}40`,
                    borderRadius: 12,
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 700,
                    color: meta.color,
                    cursor: 'pointer',
                    marginBottom: 24,
                    transition: 'background 0.15s',
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
                      background: meta.colorBg,
                      border: `1px solid ${meta.color}30`,
                      borderRadius: 14,
                      padding: '18px 20px',
                      marginBottom: 24,
                    }}>
                      <p style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: meta.color,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        marginBottom: 10,
                      }}>
                        Your fix
                      </p>
                      <p style={{ fontSize: 15, color: '#e5e7eb', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
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
                              border: `1px solid ${active ? meta.color + '80' : 'rgba(255,255,255,0.1)'}`,
                              background: active ? meta.colorBg : 'transparent',
                              color: active ? meta.color : '#6b7280',
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
                        flex: 1,
                        minWidth: 180,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        padding: '14px 16px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 14,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <DestIcon size={18} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: dest.color }}>
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
    </motion.div>
  );
}
