import { Fragment, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ArrowRight } from 'lucide-react';
import api from '../lib/api';
import { scanProfile } from '../lib/scanProfile';
import { parseReportSections, splitProblemFix, parseFixMoves, type ReportSection } from '../lib/parseReport';
import { trackSection5CtaClicked } from '../lib/analytics';
import { warm } from '../lib/theme/warmTokens';
import { PricingTeaser } from './PricingTeaser';

const PETROL = '#2D5A6E';
const GOLD   = '#C5A059';
const SAGE   = '#7DA67D';
const SLATE  = '#A0A4A8';

const SECTION_META: Record<string, { label: string; color: string }> = {
  headline_insight: { label: 'Headline Insight',         color: GOLD },
  targeting:        { label: 'Targeting',                color: SLATE },
  document_audit:   { label: 'Document Audit',           color: SLATE },
  pipeline:         { label: 'Application Pipeline',     color: SLATE },
  honest:           { label: 'Primary Strategic Gap',    color: GOLD },
  fix:              { label: 'Your Next Three Moves',    color: GOLD },
};

const SECTION_ORDER = ['headline_insight', 'targeting', 'document_audit', 'pipeline', 'honest', 'fix', 'what_jobhub_does'];

const SECTION_QUESTIONS: Record<string, string> = {
  targeting:      'Am I going after the right jobs?',
  document_audit: 'Is my resume actually doing its job?',
  pipeline:       'Where am I getting stuck?',
  honest:         "What's really holding me back?",
  fix:            'So how do I actually fix this?',
};

interface DiagnosticPageProps {
  profile?: any;
  onDone: () => void;
}

interface ReportData {
  reportId: string;
  status: string;
  reportMarkdown: string | null;
  createdAt: string | null;
}

function extractFirstSentence(md: string, max = 180): string {
  if (!md) return '';
  const clean = md.replace(/^#+\s.*$/gm, '').replace(/^[-•]\s.*$/gm, '').replace(/\*\*/g, '').replace(/\n+/g, ' ').trim();
  const m = clean.match(/^(.+?[.!?])(\s|$)/);
  const s = m ? m[1].trim() : clean;
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function extractPreview(md: string): { headline: string; bullets: string[] } {
  const lines = md.split('\n').map(l => l.trim()).filter(l => l && l !== '---' && !l.startsWith('###'));
  let headline = '';
  const bullets: string[] = [];
  for (const line of lines) {
    if (!line.startsWith('-') && !line.startsWith('•') && !line.startsWith('>') && !headline) {
      headline = line.replace(/[*_`]/g, '');
    } else if ((line.startsWith('- ') || line.startsWith('• ')) && bullets.length < 3) {
      bullets.push(line.replace(/^[-•]\s*/, ''));
    }
    if (headline && bullets.length >= 3) break;
  }
  return { headline, bullets };
}

function renderInline(text: string, headingColor?: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} style={{ fontWeight: 700, color: headingColor ?? warm.colors.textPrimary }}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

function SectionContent({ text, color }: { text: string; color: string }) {
  const lines = text.split('\n').filter(l => { const t = l.trim(); return t && t !== '---'; });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {lines.map((line, i) => {
        const t = line.trim();
        if (t.startsWith('> ')) {
          return (
            <div key={i} style={{ borderLeft: `3px solid ${color}`, padding: '8px 12px 8px 14px', background: `${color}08`, borderRadius: '0 6px 6px 0' }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, fontStyle: 'italic', fontWeight: 450, color: warm.colors.textSecondary }}>{renderInline(t.replace(/^>\s?/, ''))}</p>
            </div>
          );
        }
        if (t.startsWith('- ') || t.startsWith('• ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color, fontWeight: 800, flexShrink: 0, fontSize: 14 }}>·</span>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, fontWeight: 500, color: warm.colors.textSecondary }}>{renderInline(t.replace(/^[-•]\s/, ''))}</p>
            </div>
          );
        }
        if (t.startsWith('##')) {
          return <p key={i} style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color, opacity: 0.85 }}>{t.replace(/^##+\s*/, '')}</p>;
        }
        return <p key={i} style={{ margin: 0, fontSize: 14, lineHeight: 1.8, fontWeight: 450, color: warm.colors.textSecondary }}>{renderInline(t)}</p>;
      })}
    </div>
  );
}

const LOADING_MESSAGES = [
  'Reading how your experience maps to your target role...',
  'Cross-checking against what Australian recruiters look for...',
  'Identifying the gaps that actually matter for your situation...',
  'Building your personalised three-step plan...',
];

// ─── Main component ───────────────────────────────────────────────────
export function DiagnosticPage({ profile, onDone }: DiagnosticPageProps) {
  const firstName = profile?.name ? toTitleCase(String(profile.name).split(' ')[0]) : null;

  const [report, setReport] = useState<ReportData | null>(null);
  const [reportStatus, setReportStatus] = useState<'loading' | 'complete' | 'failed'>('loading');
  const [failureIsNetwork, setFailureIsNetwork] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const sections: ReportSection[] = report?.reportMarkdown ? parseReportSections(report.reportMarkdown) : [];
  // Headline Insight is rendered above the fold as the freight-train opener,
  // not as a card below it — pull it aside so it doesn't double-render.
  const headlineSection = sections.find(s => s.key === 'headline_insight');
  const cardSections = sections
    .filter(s => s.key !== 'headline_insight' && SECTION_ORDER.includes(s.key))
    .sort((a, b) => SECTION_ORDER.indexOf(a.key) - SECTION_ORDER.indexOf(b.key));

  // Pre-scan for the urgency header
  const { issues } = scanProfile(profile);
  const hasIssues = issues.length > 0;

  // Track consecutive poll failures so we don't spin forever on network errors
  const pollErrorCountRef = useRef(0);

  // Poll for diagnostic report
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const { data } = await api.get<ReportData>('/onboarding/report');
        if (cancelled) return;
        pollErrorCountRef.current = 0; // reset on any successful response
        setReport(data);
        if (data.status === 'COMPLETE') {
          setReportStatus('complete');
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        } else if (data.status === 'FAILED') {
          setFailureIsNetwork(false);
          setReportStatus('failed');
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch {
        if (cancelled) return;
        pollErrorCountRef.current += 1;
        if (pollErrorCountRef.current >= 5) {
          setFailureIsNetwork(true);
          setReportStatus('failed');
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      }
    }
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Rotate loading messages
  useEffect(() => {
    const t = setInterval(() => setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const handleRetry = async () => {
    setReportStatus('loading');
    try { await api.post('/onboarding/retry'); }
    catch { /* poll will surface the failure again */ }
  };

  // ── Pull key insight from the diagnostic for the above-fold ──
  // Prefer the dedicated Headline Insight section when present (new reports).
  // Fall back to the first sentence of targeting/audit/honest for older reports
  // generated before the section was added.
  const previewSection = headlineSection
    ? null
    : cardSections.find(s => ['targeting', 'document_audit', 'honest'].includes(s.key));
  const previewContent = previewSection ? extractPreview(
    splitProblemFix(previewSection.content).problem
  ) : null;
  // The prompt caps Headline Insight at 32 words / one sentence, so we don't
  // need a tight char limit here. 600 is a generous safety net against
  // pathological output without ever clipping a valid headline mid-word.
  const headlineInsight = (headlineSection?.content
      ? extractFirstSentence(headlineSection.content.replace(/^[*_`>\s-]+/, ''), 600)
      : null)
    ?? previewContent?.headline
    ?? (hasIssues ? issues[0].detail : 'Your resume is structurally sound, but there are opportunities to sharpen it.');

  const hasDiagnosticContent = cardSections.length > 0;

  return (
    <div style={{ background: warm.colors.bgCanvas, height: '100vh', overflowY: 'auto' }}>
      {/* ── LOADING STATE ── */}
      {reportStatus === 'loading' && (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%', margin: '0 auto 20px',
              border: `2px solid ${warm.colors.borderWhisper}`, borderTopColor: GOLD,
              animation: 'dspin 0.8s linear infinite',
            }} />
            <style>{`@keyframes dspin { to { transform: rotate(360deg); } }`}</style>

            <p style={{ margin: '0 0 20px', fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', color: GOLD, textTransform: 'uppercase' }}>
              Running your diagnostic
            </p>

            <p style={{
              margin: '0 auto', fontSize: 15, color: warm.colors.textSecondary, lineHeight: 1.65,
              fontWeight: 500, minHeight: 50,
            }}>
              {LOADING_MESSAGES[msgIndex]}
            </p>

            <p style={{ margin: '28px 0 0', fontSize: 12, color: warm.colors.textMuted, fontStyle: 'italic' }}>
              We've captured your data — this takes about a minute
            </p>
          </motion.div>
        </div>
      )}

      {/* ── DIAGNOSTIC COMPLETE ── */}
      {reportStatus !== 'loading' && (
        <>
          {/* ── ABOVE THE FOLD: Key insight + prominent CTA ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px 40px' }}>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
              style={{ maxWidth: 560, width: '100%' }}
            >
              {reportStatus === 'failed' ? (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', color: warm.colors.danger, textTransform: 'uppercase' }}>
                    Report incomplete
                  </p>
                  <p style={{ color: warm.colors.textSecondary, fontSize: 15, marginBottom: 8 }}>
                    {failureIsNetwork
                      ? "Can't reach the server — make sure the backend is running."
                      : 'Something went wrong generating your report.'}
                  </p>
                  <p style={{ color: warm.colors.textMuted, fontSize: 13, marginBottom: 28 }}>Your data is saved — try again or proceed to the dashboard.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                    <button onClick={handleRetry} style={{
                      background: PETROL, color: warm.colors.bgCanvas, border: 'none', borderRadius: 14,
                      padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                    }}>
                      Try again
                    </button>
                    <button onClick={onDone} style={{
                      background: 'none', border: 'none', color: warm.colors.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>
                      Go to the dashboard →
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ margin: '0 0 18px', fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', color: GOLD, textTransform: 'uppercase', textAlign: 'center' }}>
                    Your diagnosis is ready
                  </p>

                  <h2 style={{
                    margin: '0 0 28px',
                    fontSize: 'clamp(20px, 3.6vw, 26px)',
                    fontWeight: 700,
                    color: warm.colors.textPrimary,
                    textAlign: 'center',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.3,
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    hyphens: 'auto',
                  }}>
                    {firstName ? `Hey ${firstName}, ` : ''}{renderInline(headlineInsight)}
                  </h2>

                  {/* Issue cards — from pre-scan (shown while report loads) or from diagnostic */}
                  {hasIssues && !hasDiagnosticContent && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                      {issues.slice(0, 3).map((issue, i) => (
                        <div key={issue.key} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12,
                          padding: '14px 16px', background: warm.colors.bgAlt,
                          border: `1px solid ${warm.colors.borderWhisper}`,
                          borderLeft: `3px solid ${i === 0 ? GOLD : i === 1 ? PETROL : SAGE}`,
                          borderRadius: 10,
                        }}>
                          <span style={{
                            flexShrink: 0, marginTop: 1, width: 20, height: 20, borderRadius: 999,
                            background: i === 0 ? `${GOLD}20` : i === 1 ? `${PETROL}20` : `${SAGE}20`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 800,
                            color: i === 0 ? GOLD : i === 1 ? PETROL : SAGE,
                          }}>{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>
                              {issue.label}
                            </p>
                            <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.55, fontWeight: 450 }}>
                              {issue.detail}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <p style={{ margin: 0, textAlign: 'center', fontSize: 12, color: warm.colors.textMuted }}>
                      {hasIssues
                        ? `${issues.length} key areas analysed`
                        : 'Full breakdown with actionable next steps below'}
                    </p>
                    <motion.button
                      onClick={() => document.getElementById('diagnostic-body')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        background: PETROL, color: warm.colors.bgCanvas, border: 'none', borderRadius: 14,
                        padding: '13px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                        letterSpacing: '-0.01em', boxShadow: `0 4px 16px ${PETROL}30`,
                      }}
                    >
                      Walk me through it
                      <ChevronDown size={16} />
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          </div>

          {/* ── FULL DIAGNOSTIC SECTIONS ── */}
          {hasDiagnosticContent && (
            <div id="diagnostic-body" style={{
              maxWidth: 720, margin: '0 auto', padding: '0 24px 160px',
              background: warm.colors.bgSurface,
              borderRadius: '24px 24px 0 0',
              border: `1px solid ${warm.colors.borderWhisper}`,
              position: 'relative', zIndex: 2,
            }}>
              <p style={{
                margin: 0, paddingTop: 32, fontSize: 10, fontWeight: 800,
                letterSpacing: '0.16em', textTransform: 'uppercase', color: GOLD, textAlign: 'center',
              }}>
                Full breakdown
              </p>
              <h2 style={{
                margin: '0 0 28px', fontSize: 'clamp(20px, 3.6vw, 26px)', fontWeight: 700,
                color: warm.colors.textPrimary, textAlign: 'center', letterSpacing: '-0.02em', lineHeight: 1.2,
              }}>
                {firstName ? `${firstName}, here's what we found` : "Here's what we found"}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cardSections.map((section, idx) => {
                  const meta = SECTION_META[section.key];
                  if (!meta) return null;
                  const { problem, fix } = splitProblemFix(section.content);
                  const isOpen = openSection === section.key;
                  const hasDepth = fix && fix.split('\n').some(l => { const t = l.trim(); return t && t !== '---'; });
                  const notLast = idx < cardSections.length - 1;

                  const sectionCard = section.key === 'fix' ? (
                    (() => {
                      const moves = parseFixMoves(section.content);
                      return (
                        <div key={section.key} style={{
                          background: warm.colors.bgSurface,
                          borderRadius: 18,
                          border: `1px solid ${warm.colors.borderWhisper}`,
                          borderLeft: `4px solid ${GOLD}`, padding: '22px 24px',
                        }}>
                          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 900, color: GOLD, opacity: 0.5 }}>05</p>
                          <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: warm.colors.textMuted }}>{meta.label}</p>
                          {SECTION_QUESTIONS.fix && (
                            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600, color: warm.colors.textPrimary, lineHeight: 1.25 }}>{SECTION_QUESTIONS.fix}</h3>
                          )}
                          <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: warm.colors.textPrimary }}>
                            Hey {firstName ?? 'there'},
                          </p>
                          <p style={{ margin: '0 0 20px', fontSize: 14, color: warm.colors.textSecondary, lineHeight: 1.65, fontWeight: 450 }}>
                            Here are three moves you can take today to start closing the gaps above.
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
                            {[moves.targeting, moves.resume, moves.applications].map((move, i) => (
                              <div key={i} style={{
                                background: warm.colors.bgAlt,
                                border: `1px solid ${warm.colors.borderWhisper}`,
                                borderRadius: 14, padding: '16px 20px',
                              }}>
                                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary, lineHeight: 1.5 }}>
                                  {i + 1}. {move.action}
                                </p>
                              </div>
                            ))}
                          </div>
                          </div>
                      );
                    })()
                  ) : (
                    <div
                      key={section.key}
                      id={section.key === 'honest' ? 'gap-anchor' : undefined}
                      style={{
                        background: warm.colors.bgSurface,
                        borderRadius: 18,
                        border: `1px solid ${isOpen ? `${meta.color}30` : warm.colors.borderWhisper}`,
                        borderLeft: `4px solid ${meta.color}`,
                        overflow: 'hidden',
                        scrollMarginTop: 24,
                      }}
                    >
                      <div style={{ padding: '18px 20px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 900, color: meta.color, opacity: 0.5,
                            letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
                          }}>{String(idx + 1).padStart(2, '0')}</span>
                          <p style={{ margin: 0, flex: 1, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: warm.colors.textMuted }}>
                            {meta.label}
                          </p>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, flexShrink: 0, opacity: 0.7 }} />
                        </div>
                        {SECTION_QUESTIONS[section.key] && (
                          <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: warm.colors.textPrimary, lineHeight: 1.4 }}>
                            {SECTION_QUESTIONS[section.key]}
                          </h3>
                        )}
                        <p style={{ margin: 0, fontSize: 14, color: warm.colors.textSecondary, lineHeight: 1.7, fontWeight: 450 }}>
                          {renderInline(extractFirstSentence(problem, 220))}
                        </p>
                      </div>
                      {hasDepth && (
                        <>
                          <button
                            onClick={() => setOpenSection(isOpen ? null : section.key)}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '10px 20px', background: 'none',
                              borderTop: `1px solid ${warm.colors.borderWhisper}`,
                              borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
                              cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                              color: warm.colors.textMuted,
                            }}
                          >
                            <span>{isOpen ? 'Hide detail' : 'Why this matters'}</span>
                            <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: 'flex' }}>
                              <ChevronDown size={14} />
                            </motion.span>
                          </button>
                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                                style={{ overflow: 'hidden' }}
                              >
                                <div style={{ padding: '14px 20px 20px' }}>
                                  <SectionContent text={fix} color={meta.color} />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      )}
                    </div>
                  );

                  return (
                    <Fragment key={section.key}>
                      {section.key === 'honest' && (
                        <>
                        <div style={{
                          background: warm.colors.bgAlt,
                          borderRadius: 18,
                          border: `1px solid ${warm.colors.borderWhisper}`,
                          borderLeft: `4px solid ${SAGE}`,
                          padding: '28px 28px',
                        }}>
                          <h2 style={{
                            fontFamily: warm.type.fontDisplay,
                            fontSize: 'clamp(20px, 3.6vw, 26px)',
                            fontWeight: 700,
                            color: warm.colors.textPrimary,
                            margin: '0 0 16px',
                            lineHeight: 1.2,
                            letterSpacing: '-0.02em',
                          }}>
                            Before you proceed.
                          </h2>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: warm.colors.textSecondary, fontWeight: 450 }}>
                              The next two sections cover the "gaps" in your documents but the good news is, we've already fixed them for you. Hurrah!
                            </p>
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: warm.colors.textSecondary, fontWeight: 450 }}>
                              We're walking you through it anyway because understanding your gaps is what will make you competitive for promotions, better pay and ultimately a better life.
                            </p>
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: warm.colors.textSecondary, fontWeight: 450 }}>
                              We are not gatekeeping any knowledge, understand what was actually breaking underneath and how to bridge the gap. Read the diagnosis. Understand the mechanics. Then go meet the fix.
                            </p>
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: warm.colors.textSecondary, fontWeight: 450 }}>
                              Remember the ATS that filtered you out?
                            </p>
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: warm.colors.textSecondary, fontWeight: 450 }}>
                              The tables have turned, your rebuilt documents are waiting in your own ATS-Application Tracking System 😉, the friendly kind. The one that works for you.
                            </p>
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: warm.colors.textSecondary, fontWeight: 600 }}>
                              You have one now.
                            </p>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
                            <motion.button
                              onClick={() => document.getElementById('gap-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                background: PETROL, color: warm.colors.bgCanvas, border: 'none', borderRadius: 14,
                                padding: '13px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                                letterSpacing: '-0.01em', boxShadow: `0 4px 16px ${PETROL}30`,
                              }}
                            >
                              Show me my biggest gap
                              <ChevronDown size={16} />
                            </motion.button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 0', margin: '2px 0' }}>
                          {[0, 1, 2].map((_, i) => (
                            <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: warm.colors.textMuted, opacity: 0.18 }} />
                          ))}
                        </div>
                      </>
                      )}
                      {sectionCard}
                      {notLast && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 0', margin: '2px 0' }}>
                          {[0, 1, 2].map((_, i) => (
                            <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: warm.colors.textMuted, opacity: 0.18 }} />
                          ))}
                        </div>
                      )}
                    </Fragment>
                  );
                })}

                {/* ── CTA #2 — Final closer ── */}
                <div style={{
                  background: warm.colors.bgAlt,
                  borderRadius: 18,
                  border: `1px solid ${warm.colors.borderWhisper}`,
                  borderLeft: `4px solid ${GOLD}`,
                  padding: '32px 28px',
                  textAlign: 'center',
                }}>
                  <h2 style={{
                    fontFamily: warm.type.fontDisplay,
                    fontSize: 'clamp(20px, 3.6vw, 26px)',
                    fontWeight: 700,
                    color: warm.colors.textPrimary,
                    margin: '0 0 16px',
                    lineHeight: 1.2,
                    letterSpacing: '-0.02em',
                  }}>
                    No long, drawn-out, over priced coaching sessions.
                  </h2>
                  <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.7, color: warm.colors.textSecondary, fontWeight: 450 }}>
                    You now know your gaps and we bridge them on every application you send.
                  </p>
                  <p style={{ margin: '0 0 24px', fontSize: 14, lineHeight: 1.7, color: warm.colors.textSecondary, fontWeight: 600 }}>
                    Get faster, better applications today.
                  </p>
                  <motion.button
                    onClick={() => { trackSection5CtaClicked(); onDone(); }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      background: PETROL, color: warm.colors.bgCanvas, border: 'none', borderRadius: 14,
                      padding: '15px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                      letterSpacing: '-0.01em', boxShadow: `0 6px 24px ${PETROL}40`,
                    }}
                  >
                    Open my ATS
                    <ArrowRight size={16} />
                  </motion.button>
                </div>
              </div>
              <div style={{ marginTop: 32 }}>
                <PricingTeaser source="diagnostic_report" variant="full" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
