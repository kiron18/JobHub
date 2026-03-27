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
  isDark: boolean;
}

type Feedback = 'spot_on' | 'partially' | 'missed';

function extractTeaser(text: string): string {
  const sentence = text.split(/[.!?]/)[0]?.trim() ?? '';
  return sentence.length > 100 ? sentence.slice(0, 97) + '...' : sentence;
}

export function ReportIsland({
  sectionKey, meta, problemText, fixText, reportId,
  isOpen, onToggle, onNavigate, isDark,
}: ReportIslandProps) {
  const [showFix, setShowFix] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const Icon = meta.icon;
  const teaser = extractTeaser(problemText);
  const links = SECTION_LINKS[sectionKey] ?? [];

  // Theme tokens derived from isDark
  const cardBg         = isDark ? '#0d1117'                    : '#ffffff';
  const borderClosed   = isDark ? 'rgba(255,255,255,0.06)'     : 'rgba(0,0,0,0.07)';
  const gradientMid    = isDark ? 'rgba(4,4,8,0.55)'           : 'rgba(245,244,240,0.5)';
  const gradientBottom = isDark ? 'rgba(4,4,8,0.92)'           : 'rgba(245,244,240,0.97)';
  const hintBg         = isDark ? 'rgba(255,255,255,0.12)'     : 'rgba(0,0,0,0.08)';
  const hintColor      = isDark ? 'rgba(255,255,255,0.7)'      : 'rgba(0,0,0,0.45)';
  const teaserColor    = isDark ? 'rgba(255,255,255,0.60)'     : 'rgba(0,0,0,0.45)';
  const problemColor   = isDark ? '#d1d5db'                    : '#374151';
  const fixBodyColor   = isDark ? '#e5e7eb'                    : '#1f2937';
  const pillBorder     = isDark ? 'rgba(255,255,255,0.10)'     : 'rgba(0,0,0,0.10)';
  const pillInactive   = isDark ? '#6b7280'                    : '#9ca3af';
  const ctaItemBg      = isDark ? 'rgba(255,255,255,0.03)'     : 'rgba(0,0,0,0.02)';
  const ctaItemBorder  = isDark ? 'rgba(255,255,255,0.07)'     : 'rgba(0,0,0,0.07)';
  const ctaItemHover   = isDark ? 'rgba(255,255,255,0.07)'     : 'rgba(0,0,0,0.05)';
  const ctaSubColor    = isDark ? '#6b7280'                    : '#9ca3af';

  async function submitFeedback(score: Feedback) {
    if (feedback || feedbackLoading) return;
    setFeedbackLoading(true);
    try {
      await api.post(`/onboarding/report/${reportId}/feedback`, { sectionKey, relevanceScore: score });
      setFeedback(score);
    } catch { /* silent */ }
    finally { setFeedbackLoading(false); }
  }

  const handleToggle = () => {
    if (isOpen) setShowFix(false);
    onToggle();
  };

  return (
    <div
      id={`report-island-${sectionKey}`}
      style={{
        borderRadius: 18,
        overflow: 'hidden',
        background: cardBg,
        border: `1px solid ${isOpen ? meta.color + '28' : borderClosed}`,
        transition: 'border-color 0.3s, background 0.3s',
        boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* ── COLLAPSED: full-bleed scene card ── */}
      <AnimatePresence initial={false}>
        {!isOpen && (
          <motion.button
            key="cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleToggle}
            style={{
              position: 'relative',
              width: '100%',
              height: meta.collapsedHeight,
              display: 'block',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            {/* Scene illustration */}
            <motion.div
              layoutId={`char-${sectionKey}`}
              style={{ position: 'absolute', inset: 0 }}
            >
              <Icon style={{ width: '100%', height: '100%', display: 'block' }} />
            </motion.div>

            {/* Bottom gradient for text legibility */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(to bottom, transparent 35%, ${gradientMid} 62%, ${gradientBottom} 100%)`,
              pointerEvents: 'none',
            }} />

            {/* Expand hint — top right */}
            <div style={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 28,
              height: 28,
              borderRadius: 99,
              background: hintBg,
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <ChevronDown size={14} color={hintColor} />
            </div>

            {/* Text overlay — bottom of card */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '0 20px 18px',
              textAlign: 'left',
            }}>
              <p style={{
                fontSize: 16,
                fontWeight: 800,
                color: meta.color,
                margin: '0 0 5px',
                letterSpacing: '-0.01em',
              }}>
                {meta.label}
              </p>
              {teaser && (
                <p style={{
                  fontSize: 12,
                  color: teaserColor,
                  margin: 0,
                  lineHeight: 1.5,
                }}>
                  {teaser}
                </p>
              )}
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── EXPANDED: small icon header + content ── */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header row */}
            <button
              onClick={handleToggle}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px 20px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {/* Shrunk scene — morphs from full card via layoutId */}
              <motion.div
                layoutId={`char-${sectionKey}`}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <Icon style={{ width: '100%', height: '100%', display: 'block' }} />
              </motion.div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: meta.color,
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}>
                  {meta.label}
                </p>
              </div>

              <motion.span
                animate={{ rotate: 180 }}
                style={{ color: meta.color + 'aa', flexShrink: 0 }}
              >
                <ChevronDown size={16} />
              </motion.span>
            </button>

            {/* Accent rule */}
            <div style={{
              height: 1,
              margin: '0 20px',
              background: `linear-gradient(90deg, ${meta.color}50, transparent)`,
            }} />

            {/* Content */}
            <div style={{ padding: '20px 20px 24px' }}>
              <p style={{
                fontSize: 15,
                color: problemColor,
                lineHeight: 1.78,
                whiteSpace: 'pre-wrap',
                marginBottom: 20,
              }}>
                {problemText}
              </p>

              {/* Show fix */}
              {!showFix && (
                <button
                  onClick={() => setShowFix(true)}
                  style={{
                    background: meta.colorBg,
                    border: `1px solid ${meta.color}38`,
                    borderRadius: 12,
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 700,
                    color: meta.color,
                    cursor: 'pointer',
                    marginBottom: 20,
                  }}
                >
                  Show me the fix →
                </button>
              )}

              <AnimatePresence>
                {showFix && (
                  <motion.div
                    key="fix"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.25, 0, 0, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{
                      background: meta.colorBg,
                      border: `1px solid ${meta.color}28`,
                      borderRadius: 14,
                      padding: '18px 20px',
                      marginBottom: 20,
                    }}>
                      <p style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: meta.color,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        marginBottom: 10,
                      }}>
                        Your fix
                      </p>
                      <p style={{ fontSize: 15, color: fixBodyColor, lineHeight: 1.78, whiteSpace: 'pre-wrap' }}>
                        {fixText}
                      </p>
                    </div>

                    {/* Feedback pills */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
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
                              fontSize: 12,
                              fontWeight: 600,
                              border: `1px solid ${active ? meta.color + '70' : pillBorder}`,
                              background: active ? meta.colorBg : 'transparent',
                              color: active ? meta.color : pillInactive,
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
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {links.map(({ key, why }) => {
                  const dest = SECTION_ICONS[key];
                  if (!dest) return null;
                  return (
                    <button
                      key={key}
                      onClick={() => onNavigate(key)}
                      style={{
                        flex: 1,
                        minWidth: 160,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        padding: '12px 14px',
                        background: ctaItemBg,
                        border: `1px solid ${ctaItemBorder}`,
                        borderRadius: 12,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = ctaItemHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = ctaItemBg)}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: dest.color }}>
                        {dest.label}
                      </span>
                      <span style={{ fontSize: 11, color: ctaSubColor, lineHeight: 1.5 }}>{why}</span>
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
