import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Sun, Moon, ChevronDown } from 'lucide-react';
import api from '../lib/api';
import { parseReportSections, splitProblemFix } from '../lib/parseReport';
import { SECTION_ICONS } from '../lib/reportIcons';

interface ReportExperienceProps {
  onDone: () => void;
}

interface ReportData {
  reportId: string;
  status: string;
  reportMarkdown: string | null;
}

// What each section actually means — shown collapsed so users understand context before reading
const SECTION_INTROS: Record<string, string> = {
  targeting:        'Whether you\'re aiming at the right roles, seniority, and location for your experience level.',
  document_audit:   'How well your resume and cover letter communicate your value to a recruiter in 6 seconds.',
  pipeline:         'Where in the process — applications, interviews, or offers — things are dropping off and why.',
  honest:           'What your actual documents reveal versus what you think the problem is.',
  fix:              'Three concrete actions ranked by impact, written specifically for your situation.',
  what_jobhub_does: 'How the platform takes what\'s in your bank and turns it into documents that get responses.',
};

function makeTheme(isDark: boolean) {
  return isDark ? {
    bg: '#0d1117',
    eyebrow: '#4b5563',
    heading: '#f3f4f6',
    sub: '#6b7280',
    islandBg: 'rgba(255,255,255,0.03)',
    islandBorder: 'rgba(255,255,255,0.07)',
    islandHover: 'rgba(255,255,255,0.05)',
    introText: '#6b7280',
    hookText: '#e5e7eb',
    bodyText: '#9ca3af',
    divider: 'rgba(255,255,255,0.06)',
    ctaBg: 'rgba(252,211,77,0.04)',
    ctaBorder: 'rgba(252,211,77,0.15)',
    ctaEyebrow: '#FCD34D',
    ctaHeading: '#f3f4f6',
    ctaBody: '#6b7280',
    toggleBg: 'rgba(255,255,255,0.08)',
    toggleColor: '#9ca3af',
    blobs: ['rgba(251,191,36,0.04)', 'rgba(45,212,191,0.03)', 'rgba(167,139,250,0.04)'],
  } : {
    bg: '#f5f4f0',
    eyebrow: '#9ca3af',
    heading: '#111827',
    sub: '#6b7280',
    islandBg: 'rgba(255,255,255,0.85)',
    islandBorder: 'rgba(0,0,0,0.08)',
    islandHover: 'rgba(255,255,255,0.95)',
    introText: '#6b7280',
    hookText: '#1f2937',
    bodyText: '#4b5563',
    divider: 'rgba(0,0,0,0.06)',
    ctaBg: 'rgba(252,211,77,0.10)',
    ctaBorder: 'rgba(252,211,77,0.28)',
    ctaEyebrow: '#b45309',
    ctaHeading: '#111827',
    ctaBody: '#6b7280',
    toggleBg: 'rgba(0,0,0,0.07)',
    toggleColor: '#6b7280',
    blobs: ['rgba(251,191,36,0.10)', 'rgba(45,212,191,0.08)', 'rgba(167,139,250,0.08)'],
  };
}

// Extract the first 1–2 sentences as the "hook" — what we show collapsed
function extractHook(content: string): string {
  const clean = content.replace(/\*\*/g, '').replace(/#+\s/g, '').replace(/\n---\n[\s\S]*/,'').trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.slice(0, 2).join(' ').trim() || clean.slice(0, 180);
}

// Render markdown-ish content as readable paragraphs (no external parser needed)
function RenderContent({ text, color }: { text: string; color: string }) {
  const lines = text.split('\n').filter(l => l.trim());
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color, fontWeight: 700, marginTop: 2, flexShrink: 0 }}>—</span>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'inherit' }}>
                {trimmed.replace(/^[-•]\s/, '')}
              </p>
            </div>
          );
        }
        if (trimmed.startsWith('###')) {
          return <p key={i} style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.5 }}>{trimmed.replace(/^#+\s/, '')}</p>;
        }
        return <p key={i} style={{ margin: 0, fontSize: 14, lineHeight: 1.75 }}>{trimmed}</p>;
      })}
    </div>
  );
}

export function ReportExperience({ onDone }: ReportExperienceProps) {
  const [isDark, setIsDark] = useState(false);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const theme = makeTheme(isDark);

  const [processingMs, setProcessingMs] = useState(0);

  const { data, isLoading, isError, refetch } = useQuery<ReportData>({
    queryKey: ['report'],
    queryFn: async () => {
      const res = await api.get<ReportData>('/onboarding/report');
      return res.data;
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PROCESSING' ? 4000 : false;
    },
  });

  // Track how long we've been in PROCESSING so we can show "Regenerate" if stuck
  useEffect(() => {
    if (data?.status !== 'PROCESSING') { setProcessingMs(0); return; }
    const t = setInterval(() => setProcessingMs(ms => ms + 4000), 4000);
    return () => clearInterval(t);
  }, [data?.status]);

  const sections = parseReportSections(data?.reportMarkdown ?? '');
  const status = data?.status;

  function handleToggle(key: string) {
    setOpenMap(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, overflowY: 'auto',
      background: theme.bg, zIndex: 10, transition: 'background 0.3s',
    }}>
      {/* Ambient blobs */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        {[
          { top: '-15%', left: '-10%', size: 500, color: theme.blobs[0] },
          { top: '50%', right: '-8%', size: 420, color: theme.blobs[1] },
          { bottom: '-10%', left: '30%', size: 380, color: theme.blobs[2] },
        ].map((b, i) => (
          <div key={i} style={{
            position: 'absolute', width: b.size, height: b.size, borderRadius: '50%',
            background: `radial-gradient(circle at 33% 28%, ${b.color} 0%, transparent 70%)`, ...b,
          }} />
        ))}
      </div>

      {/* Theme toggle */}
      <button
        onClick={() => setIsDark(d => !d)}
        aria-label="Toggle dark mode"
        style={{
          position: 'fixed', top: 20, right: 20, zIndex: 20,
          width: 40, height: 40, borderRadius: 99,
          background: theme.toggleBg, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', backdropFilter: 'blur(8px)', transition: 'background 0.2s',
        }}
      >
        {isDark ? <Sun size={16} color={theme.toggleColor} /> : <Moon size={16} color={theme.toggleColor} />}
      </button>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 780, margin: '0 auto', padding: '72px 24px 120px' }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: 56, textAlign: 'center' }}
        >
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.eyebrow, marginBottom: 12 }}>
            Your diagnosis
          </p>
          <h1 style={{ fontSize: 34, fontWeight: 800, color: theme.heading, margin: '0 0 12px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            Here's what's actually going on.
          </h1>
          <p style={{ fontSize: 16, color: theme.sub, lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
            Six areas, ranked by impact. Read the ones that resonate — then unlock your fix.
          </p>
        </motion.div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* Loading / processing state */}
        {(isLoading || status === 'PROCESSING') && sections.length === 0 && processingMs < 60000 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              border: `3px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              borderTopColor: '#FCD34D', margin: '0 auto 20px',
              animation: 'spin 1s linear infinite',
            }} />
            <p style={{ color: theme.sub, fontSize: 14 }}>Your diagnosis is being written…</p>
          </div>
        )}

        {/* Stuck in PROCESSING too long — offer regenerate */}
        {status === 'PROCESSING' && sections.length === 0 && processingMs >= 60000 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: theme.sub, fontSize: 15, marginBottom: 8 }}>This is taking longer than expected.</p>
            <p style={{ color: theme.sub, fontSize: 13, marginBottom: 24 }}>Generation may have timed out — regenerating is safe and only takes a minute.</p>
            <button
              onClick={async () => { await api.post('/onboarding/retry'); setProcessingMs(0); refetch(); }}
              style={{ background: '#FCD34D', color: '#111827', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}
            >
              Regenerate report
            </button>
          </div>
        )}

        {/* API error — report not found or server error */}
        {(isError || (!isLoading && !data)) && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: '#f87171', fontSize: 15, marginBottom: 8 }}>Couldn't load your report.</p>
            <p style={{ color: theme.sub, fontSize: 13, marginBottom: 24 }}>
              This can happen if your session changed. Try regenerating — your intake answers are saved.
            </p>
            <button
              onClick={async () => { await api.post('/onboarding/retry'); refetch(); }}
              style={{ background: '#FCD34D', color: '#111827', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}
            >
              Generate report
            </button>
          </div>
        )}

        {/* FAILED or COMPLETE with empty sections */}
        {!isError && data && (status === 'FAILED' || (status === 'COMPLETE' && sections.length === 0)) && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: '#f87171', fontSize: 15, marginBottom: 8 }}>
              {status === 'FAILED' ? 'Report generation failed.' : 'Your report couldn\'t be parsed.'}
            </p>
            <p style={{ color: theme.sub, fontSize: 13, marginBottom: 24 }}>Please try again — it only takes a minute.</p>
            <button
              onClick={async () => { await api.post('/onboarding/retry'); refetch(); }}
              style={{ background: '#FCD34D', color: '#111827', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}
            >
              Regenerate report
            </button>
          </div>
        )}

        {/* Islands — full-width, stacked vertically */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sections.map((section, idx) => {
            const meta = SECTION_ICONS[section.key];
            if (!meta) return null;
            const { problem, fix } = splitProblemFix(section.content);
            const hook = extractHook(problem);
            const intro = SECTION_INTROS[section.key] || '';
            const isOpen = !!openMap[section.key];

            return (
              <motion.div
                key={section.key}
                id={`report-island-${section.key}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.07, duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                style={{
                  borderRadius: 20,
                  background: theme.islandBg,
                  border: `1px solid ${isOpen ? meta.color + '30' : theme.islandBorder}`,
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  overflow: 'hidden',
                  transition: 'border-color 0.25s, background 0.25s',
                }}
              >
                {/* Collapsed header — always visible */}
                <button
                  onClick={() => handleToggle(section.key)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '24px 28px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}
                >
                  {/* Top row: color dot + label + chevron */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: meta.color, flexShrink: 0,
                        boxShadow: `0 0 8px ${meta.color}60`,
                      }} />
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: meta.color, margin: 0 }}>
                          {meta.label}
                        </p>
                        <p style={{ fontSize: 11, color: theme.introText, margin: '2px 0 0', lineHeight: 1.4 }}>
                          {intro}
                        </p>
                      </div>
                    </div>
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={18} color={theme.eyebrow} />
                    </motion.div>
                  </div>

                  {/* Hook — the key finding, always visible */}
                  {!isOpen && (
                    <p style={{
                      fontSize: 15, fontWeight: 600, color: theme.hookText,
                      lineHeight: 1.55, margin: '0 0 0 42px',
                      borderLeft: `2px solid ${meta.color}40`,
                      paddingLeft: 12,
                    }}>
                      {hook}
                    </p>
                  )}
                  {!isOpen && (
                    <p style={{ fontSize: 12, fontWeight: 700, color: meta.color, margin: '4px 0 0 42px', letterSpacing: '0.04em' }}>
                      Read your full diagnosis →
                    </p>
                  )}
                </button>

                {/* Expanded content */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ padding: '0 28px 28px 28px', color: theme.bodyText }}>
                        <div style={{ height: 1, background: theme.divider, marginBottom: 20 }} />

                        {/* Problem section */}
                        <RenderContent text={problem} color={meta.color} />

                        {/* Fix section */}
                        {fix && (
                          <>
                            <div style={{
                              margin: '24px 0 20px',
                              display: 'flex', alignItems: 'center', gap: 10,
                            }}>
                              <div style={{ flex: 1, height: 1, background: theme.divider }} />
                              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: meta.color, whiteSpace: 'nowrap' }}>
                                Your fix
                              </p>
                              <div style={{ flex: 1, height: 1, background: theme.divider }} />
                            </div>
                            <RenderContent text={fix} color={meta.color} />
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Skool community CTA + embed */}
        {sections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            style={{ marginTop: 48 }}
          >
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #134E4A 0%, #0F766E 60%, #1E1B4B 100%)',
              borderRadius: '24px 24px 0 0',
              padding: '44px 40px 36px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
                width: 320, height: 320, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(153,246,228,0.8)', marginBottom: 14, position: 'relative' }}>
                Free community — Aussie Grad Careers
              </p>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: 'white', lineHeight: 1.2, marginBottom: 14, position: 'relative', letterSpacing: '-0.01em' }}>
                Here's your report.<br />
                <span style={{ color: '#99F6E4', fontStyle: 'italic' }}>Want the 8-step training to fix it?</span>
              </h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, maxWidth: 500, margin: '0 auto', position: 'relative' }}>
                Your report found the problems. The training walks you through fixing each one — with templates, real examples, and weekly group coaching calls.
              </p>
            </div>

            {/* 8 steps grid */}
            <div style={{
              background: isDark ? 'rgba(255,255,255,0.03)' : 'linear-gradient(135deg, #F0FDFA, white)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,118,110,0.13)'}`,
              borderTop: 'none',
              padding: '28px 36px',
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4D7C78', marginBottom: 16 }}>
                What's inside
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  'Fix your CV profile paragraph — stop the credibility gap',
                  'Reframe your background as an asset, not a liability',
                  'Write cover letters that name the employer, not templates',
                  'Contact specialist recruiters — what to say, who to message',
                  'Filter roles by visa-safe employers — stop wasting applications',
                  'Activate your community connections — warm outreach that lands',
                  'Answer "tell me about yourself" — 4 versions for every context',
                  'Weekly group coaching calls — live feedback on your applications',
                ].map((step, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'white',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,118,110,0.10)'}`,
                    borderRadius: 12, padding: '12px 14px',
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #0F766E, #3730A3)',
                      color: 'white', fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>{i + 1}</div>
                    <p style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#1E3A3A', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Skool embed */}
            <div style={{
              background: isDark ? 'rgba(255,255,255,0.02)' : 'white',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,118,110,0.13)'}`,
              borderTop: 'none',
              padding: '28px 36px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 14, color: isDark ? '#6b7280' : '#4D7C78', marginBottom: 20, lineHeight: 1.6 }}>
                Join free below. Takes 30 seconds. <strong style={{ color: isDark ? '#9ca3af' : '#134E4A' }}>No redirect — sign up right here.</strong>
              </p>
              <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,118,110,0.13)'}` }}>
                <iframe
                  src="https://www.skool.com/aussiegradcareers/about"
                  title="Join Aussie Grad Careers on Skool"
                  style={{ display: 'block', width: '100%', minHeight: 480, border: 'none' }}
                  loading="lazy"
                />
              </div>
              {/* Fallback if iframe is blocked */}
              <a
                href="https://www.skool.com/aussiegradcareers/about"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block', marginTop: 16,
                  background: 'linear-gradient(135deg, #0F766E, #134E4A)',
                  color: 'white', border: 'none',
                  borderRadius: 12, padding: '13px 36px',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  textDecoration: 'none',
                  boxShadow: '0 4px 20px rgba(15,118,110,0.25)',
                }}
              >
                Join the free community →
              </a>
              <p style={{ fontSize: 12, color: isDark ? '#374151' : '#9CA3AF', marginTop: 10 }}>
                Free community · No card required
              </p>
            </div>

            {/* Continue to dashboard */}
            <div style={{
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(248,250,252,0.8)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,118,110,0.10)'}`,
              borderTop: 'none',
              borderRadius: '0 0 24px 24px',
              padding: '24px 36px',
              textAlign: 'center',
            }}>
              <button
                onClick={onDone}
                style={{
                  background: 'none', border: 'none',
                  fontSize: 14, fontWeight: 700, color: isDark ? '#6b7280' : '#9CA3AF',
                  cursor: 'pointer', letterSpacing: '0.02em',
                }}
              >
                Skip — take me to the dashboard →
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
