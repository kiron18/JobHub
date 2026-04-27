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
  createdAt: string | null;
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

/**
 * Returns true if the given ISO date string falls within the current
 * Thursday 19:00 AEST → Thursday 19:00 AEST window.
 * Thursday 19:00 AEST = Thursday 09:00 UTC.
 */
function isInCurrentFridayWindow(createdAtISO: string | null): boolean {
  if (!createdAtISO) return false;
  const created = new Date(createdAtISO).getTime();
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();

  let daysSince = (day - 4 + 7) % 7;
  if (day === 4 && hour < 9) daysSince = 7;

  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - daysSince);
  windowStart.setUTCHours(9, 0, 0, 0);
  windowStart.setUTCMilliseconds(0);

  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 7);

  return created >= windowStart.getTime() && created < windowEnd.getTime();
}

// Render inline markdown — converts **bold** to <strong>
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} style={{ fontWeight: 700, color: 'inherit' }}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

// Render markdown content as readable paragraphs
function RenderContent({ text, color }: { text: string; color: string }) {
  const lines = text.split('\n').filter(l => {
    const t = l.trim();
    return t && t !== '---'; // skip horizontal rules
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color, fontWeight: 800, marginTop: 3, flexShrink: 0, fontSize: 16 }}>·</span>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: 'inherit', fontWeight: 500 }}>
                {renderInline(trimmed.replace(/^[-•]\s/, ''))}
              </p>
            </div>
          );
        }
        if (trimmed.startsWith('###') || trimmed.startsWith('##')) {
          return (
            <p key={i} style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color, opacity: 0.85 }}>
              {trimmed.replace(/^#+\s/, '')}
            </p>
          );
        }
        return (
          <p key={i} style={{ margin: 0, fontSize: 15, lineHeight: 1.8, fontWeight: 450 }}>
            {renderInline(trimmed)}
          </p>
        );
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

          {/* Friday call banner — only shown for reports in the current weekly window */}
          {isInCurrentFridayWindow(data?.createdAt ?? null) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                background: 'rgba(252,211,77,0.06)',
                border: '1px solid rgba(252,211,77,0.20)',
                borderRadius: 14, padding: '14px 20px',
                marginBottom: 32, textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, fontSize: 14, color: '#FCD34D', fontWeight: 600 }}>
                Your report is in this Friday's call batch — come with questions. I'll address it personally.
              </p>
            </motion.div>
          )}

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
            Six areas. Ranked by impact.
          </p>
        </motion.div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes progressShimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
        `}</style>

        {/* Loading / processing state */}
        {(isLoading || status === 'PROCESSING') && sections.length === 0 && processingMs < 60000 && (
          <div style={{ padding: '20px 0 48px' }}>
            {/* Progress block */}
            <div style={{
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
              borderRadius: 20, padding: '36px 32px 32px',
              marginBottom: 20,
            }}>
              {/* Spinner + label row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  border: `3px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  borderTopColor: '#0F766E',
                  animation: 'spin 0.9s linear infinite',
                }} />
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: isDark ? '#f3f4f6' : '#111827', lineHeight: 1.3 }}>
                    Writing your diagnosis…
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 13, color: theme.sub }}>
                    {processingMs < 8000
                      ? 'Reading your intake answers'
                      : processingMs < 20000
                        ? 'Analysing your resume and target role'
                        : processingMs < 36000
                          ? 'Identifying the gaps in your approach'
                          : processingMs < 50000
                            ? 'Writing your personalised diagnosis'
                            : 'Finalising your report'}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{
                width: '100%', height: 6, borderRadius: 99,
                background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
                overflow: 'hidden', marginBottom: 12,
              }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  width: `${Math.min(88, 5 + (processingMs / 60000) * 83)}%`,
                  background: 'linear-gradient(90deg, #0F766E 0%, #2dd4bf 50%, #0F766E 100%)',
                  backgroundSize: '200% auto',
                  animation: 'progressShimmer 2s linear infinite',
                  transition: 'width 3.5s ease-out',
                }} />
              </div>
              <p style={{ fontSize: 12, color: theme.sub, margin: 0 }}>
                Usually takes 30–60 seconds — hang tight.
              </p>
            </div>

            {/* Skool CTA */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(15,118,110,0.12) 0%, rgba(19,78,74,0.08) 100%)',
              border: '1px solid rgba(15,118,110,0.25)',
              borderRadius: 20, padding: '28px 32px',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#0F766E' }}>
                While you wait
              </p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                Join the free community while your report generates.
              </p>
              <p style={{ margin: 0, fontSize: 14, color: theme.sub, lineHeight: 1.7 }}>
                The{' '}
                <a
                  href="https://www.skool.com/aussiegradcareers"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#2dd4bf', textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  Aussie Grad Careers community
                </a>
                {' '}has the frameworks, templates, and live coaching calls that map directly to what's in your report — so you can take action the moment it's ready.
              </p>
              <a
                href="https://www.skool.com/aussiegradcareers"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block', alignSelf: 'flex-start',
                  background: 'linear-gradient(135deg, #0F766E, #134E4A)',
                  color: 'white', borderRadius: 12, padding: '11px 24px',
                  fontSize: 14, fontWeight: 800, textDecoration: 'none',
                  boxShadow: '0 4px 16px rgba(15,118,110,0.28)',
                  marginTop: 4,
                }}
              >
                Join free on Skool →
              </a>
            </div>
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

            const isFix = section.key === 'fix';

            return (
              <motion.div
                key={section.key}
                id={`report-island-${section.key}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.07, duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                style={{
                  borderRadius: 20,
                  background: isFix
                    ? (isDark ? 'rgba(20,83,45,0.25)' : 'rgba(240,253,244,0.95)')
                    : theme.islandBg,
                  border: isFix
                    ? `2px solid ${isOpen ? '#22c55e80' : '#22c55e40'}`
                    : `1px solid ${isOpen ? meta.color + '30' : theme.islandBorder}`,
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  overflow: 'hidden',
                  transition: 'border-color 0.25s, background 0.25s',
                  boxShadow: isFix ? `0 0 0 4px ${isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.10)'}` : undefined,
                }}
              >
                {/* Collapsed header — always visible */}
                <button
                  onClick={() => handleToggle(section.key)}
                  style={{
                    width: '100%', textAlign: 'left', padding: isFix ? '28px 28px 20px' : '24px 28px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}
                >
                  {/* Fix badge — only shown for the fix island */}
                  {isFix && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
                        color: 'white', background: 'linear-gradient(90deg, #16a34a, #15803d)',
                        borderRadius: 6, padding: '3px 10px',
                      }}>
                        Action plan
                      </span>
                      <span style={{ fontSize: 11, color: isDark ? '#4ade80' : '#15803d', fontWeight: 600 }}>
                        Read this last — highest impact
                      </span>
                    </div>
                  )}
                  {/* Top row: color dot + label + chevron */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: isFix ? 14 : 12, height: isFix ? 14 : 12, borderRadius: '50%',
                        background: meta.color, flexShrink: 0,
                        boxShadow: `0 0 ${isFix ? 12 : 8}px ${meta.color}${isFix ? '90' : '60'}`,
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

        {/* Community + premium CTA */}
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
                Free Community — Aussie Grad Careers
              </p>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: 'white', lineHeight: 1.2, marginBottom: 14, position: 'relative', letterSpacing: '-0.01em' }}>
                You're in the community.<br />
                <span style={{ color: '#99F6E4', fontStyle: 'italic' }}>Now make it work for you.</span>
              </h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, maxWidth: 500, margin: '0 auto', position: 'relative' }}>
                Everything in your report maps to a module inside the community. The frameworks, templates, and coaching calls are built for exactly this situation — start with Module 1.
              </p>
            </div>

            {/* 8 modules grid */}
            <div style={{
              background: isDark ? 'rgba(255,255,255,0.03)' : 'linear-gradient(135deg, #F0FDFA, white)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,118,110,0.13)'}`,
              borderTop: 'none',
              padding: '28px 36px',
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4D7C78', marginBottom: 16 }}>
                Your 8 modules
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

            {/* Paid tool CTA — Hormozi value stack */}
            <div style={{
              background: isDark ? 'rgba(255,255,255,0.02)' : 'white',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,118,110,0.13)'}`,
              borderTop: 'none',
              padding: '40px 40px 36px',
            }}>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#0F766E', marginBottom: 14 }}>
                Aussie Grad Careers — Pro Tool
              </p>
              <h3 style={{ fontSize: 26, fontWeight: 900, color: isDark ? '#f3f4f6' : '#111827', marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                One tailored application every 3 minutes.
              </h3>
              <p style={{ fontSize: 15, color: isDark ? '#9ca3af' : '#4b5563', lineHeight: 1.7, marginBottom: 28, maxWidth: 520 }}>
                The average Australian graduate earns $1,200+ per week in their first role.
                Every week you wait costs more than a full year of this tool.
              </p>

              {/* Value stack */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
                {[
                  { emoji: '📄', label: 'Tailored resume', desc: 'Built from your achievements, matched to every JD' },
                  { emoji: '✉️', label: 'Personalised cover letter', desc: 'Names the company, proves the match, passes the filter' },
                  { emoji: '📋', label: 'Selection criteria', desc: 'SAR-structured responses for each criterion' },
                  { emoji: '🎤', label: 'Interview prep', desc: 'Role-specific questions with your actual achievement answers' },
                  { emoji: '🔗', label: 'LinkedIn optimisation', desc: 'Headline, About, bio — and an AI-generated profile photo' },
                  { emoji: '📨', label: 'Outreach templates', desc: 'Cold approach, LinkedIn DM, post-interview follow-up' },
                  { emoji: '🗺️', label: 'Daily job feed', desc: 'Matched roles from Seek and LinkedIn, pulled to you every morning' },
                  { emoji: '🗓️', label: 'Application tracker', desc: 'Reminds you when to follow up and exactly what to say' },
                ].map(({ emoji, label, desc }) => (
                  <div key={label} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,118,110,0.04)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,118,110,0.10)'}`,
                    borderRadius: 12, padding: '12px 14px',
                  }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{emoji}</span>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: isDark ? '#e2e8f0' : '#111827' }}>{label}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: isDark ? '#6b7280' : '#6b7280', lineHeight: 1.5 }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={onDone}
                  style={{
                    display: 'inline-block',
                    background: 'linear-gradient(135deg, #0F766E, #134E4A)',
                    color: 'white', borderRadius: 14, padding: '16px 48px',
                    fontSize: 16, fontWeight: 900, border: 'none',
                    boxShadow: '0 6px 24px rgba(15,118,110,0.35)',
                    letterSpacing: '-0.01em', cursor: 'pointer', marginBottom: 12,
                  }}
                >
                  Start using the tools →
                </button>
                <p style={{ fontSize: 12, color: isDark ? '#4b5563' : '#9ca3af', marginBottom: 16 }}>
                  7-day free trial · No charge until day 8 · Cancel any time
                </p>
                <p style={{ fontSize: 13, color: isDark ? '#4b5563' : '#9ca3af', lineHeight: 1.6 }}>
                  Not ready to commit?{' '}
                  <a
                    href="https://www.skool.com/aussiegradcareers"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#0F766E', textDecoration: 'underline', textUnderlineOffset: 3 }}
                  >
                    Join the free Skool community
                  </a>
                  {' '}— templates, frameworks, and live coaching calls at no cost. A solid starting point if you want to implement the fixes from your report yourself.
                </p>
              </div>
            </div>

            {/* Continue to dashboard */}
            <div style={{
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(248,250,252,0.8)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,118,110,0.10)'}`,
              borderTop: 'none',
              borderRadius: '0 0 24px 24px',
              padding: '20px 36px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 12, color: isDark ? '#374151' : '#9ca3af', margin: 0 }}>
                Already have an account?{' '}
                <button onClick={onDone} style={{ background: 'none', border: 'none', color: '#0F766E', fontWeight: 700, cursor: 'pointer', fontSize: 12, padding: 0 }}>
                  Go straight to the dashboard →
                </button>
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
