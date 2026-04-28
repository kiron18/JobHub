import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Sun, Moon, ChevronDown, Copy, Check, X } from 'lucide-react';
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

const SECTION_INTROS: Record<string, string> = {
  targeting:        'Whether you\'re aiming at the right roles, seniority, and location for your experience level.',
  document_audit:   'How well your resume and cover letter communicate your value to a recruiter in 6 seconds.',
  pipeline:         'Where in the process — applications, interviews, or offers — things are dropping off and why.',
  honest:           'What your actual documents reveal versus what you think the problem is.',
  fix:              'Three concrete actions ranked by impact, written specifically for your situation.',
  what_jobhub_does: 'How the platform takes what\'s in your bank and turns it into documents that get responses.',
};

const SECTION_SEVERITY: Record<string, { label: string; color: string; bg: string }> = {
  document_audit:   { label: 'CRITICAL',    color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
  honest:           { label: 'CRITICAL',    color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
  targeting:        { label: 'REVIEW',      color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  pipeline:         { label: 'REVIEW',      color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  fix:              { label: 'ACTION PLAN', color: '#22c55e', bg: 'rgba(34,197,94,0.10)' },
  what_jobhub_does: { label: 'INSIGHT',     color: '#6366f1', bg: 'rgba(99,102,241,0.10)' },
};

const SECTION_ORDER = ['targeting', 'document_audit', 'pipeline', 'honest', 'fix', 'what_jobhub_does'];

function makeTheme(isDark: boolean) {
  return isDark ? {
    bg: '#0d1117',
    eyebrow: '#4b5563',
    heading: '#f3f4f6',
    sub: '#6b7280',
    islandBg: 'rgba(255,255,255,0.03)',
    islandBorder: 'rgba(255,255,255,0.07)',
    introText: '#6b7280',
    hookText: '#e5e7eb',
    bodyText: '#9ca3af',
    divider: 'rgba(255,255,255,0.06)',
    toggleBg: 'rgba(255,255,255,0.08)',
    toggleColor: '#9ca3af',
    blobs: ['rgba(251,191,36,0.04)', 'rgba(45,212,191,0.03)', 'rgba(167,139,250,0.04)'],
    modalBg: '#111827',
    stickyBg: '#111827',
    stickyBorder: 'rgba(255,255,255,0.08)',
  } : {
    bg: '#f5f4f0',
    eyebrow: '#9ca3af',
    heading: '#111827',
    sub: '#6b7280',
    islandBg: 'rgba(255,255,255,0.85)',
    islandBorder: 'rgba(0,0,0,0.08)',
    introText: '#6b7280',
    hookText: '#1f2937',
    bodyText: '#4b5563',
    divider: 'rgba(0,0,0,0.06)',
    toggleBg: 'rgba(0,0,0,0.07)',
    toggleColor: '#6b7280',
    blobs: ['rgba(251,191,36,0.10)', 'rgba(45,212,191,0.08)', 'rgba(167,139,250,0.08)'],
    modalBg: '#ffffff',
    stickyBg: '#ffffff',
    stickyBorder: 'rgba(0,0,0,0.08)',
  };
}

function extractHook(content: string): string {
  const clean = content.replace(/\*\*/g, '').replace(/#+\s/g, '').replace(/\n---\n[\s\S]*/, '').trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.slice(0, 2).join(' ').trim() || clean.slice(0, 180);
}

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

function RenderContent({ text, color }: { text: string; color: string }) {
  const lines = text.split('\n').filter(l => { const t = l.trim(); return t && t !== '---'; });
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

const SKOOL_MODULES = [
  'Fix your CV profile paragraph — stop the credibility gap',
  'Reframe your background as an asset, not a liability',
  'Write cover letters that name the employer, not templates',
  'Contact specialist recruiters — what to say, who to message',
  'Filter roles by visa-safe employers — stop wasting applications',
  'Activate your community connections — warm outreach that lands',
  'Answer "tell me about yourself" — 4 versions for every context',
  'Weekly group coaching calls — live feedback on your applications',
];

const PRO_FEATURES = [
  { emoji: '📄', label: 'Tailored resume',         desc: 'Built from your achievements, matched to every JD' },
  { emoji: '✉️', label: 'Cover letter',             desc: 'Names the company, proves the match, passes the filter' },
  { emoji: '📋', label: 'Selection criteria',       desc: 'SAR-structured responses for each criterion' },
  { emoji: '🎤', label: 'Interview prep',            desc: 'Role-specific questions with your actual achievement answers' },
  { emoji: '🔗', label: 'LinkedIn optimisation',    desc: 'Headline, About, bio — and an AI-generated profile photo' },
  { emoji: '📨', label: 'Outreach templates',       desc: 'Cold approach, LinkedIn DM, post-interview follow-up' },
  { emoji: '🗺️', label: 'Daily job feed',           desc: 'Matched roles from Seek and LinkedIn, pulled every morning' },
  { emoji: '🗓️', label: 'Application tracker',      desc: 'Reminds you when to follow up and what to say' },
];

export function ReportExperience({ onDone }: ReportExperienceProps) {
  const [isDark, setIsDark] = useState(false);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const theme = makeTheme(isDark);
  const [processingMs, setProcessingMs] = useState(0);

  const { data, isLoading, isError, refetch } = useQuery<ReportData>({
    queryKey: ['report'],
    queryFn: async () => { const res = await api.get<ReportData>('/onboarding/report'); return res.data; },
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PROCESSING' ? 4000 : false;
    },
  });

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

  const [optionModal, setOptionModal] = useState<1 | 2 | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useQuery<{ name?: string }>({
    queryKey: ['profile'],
    queryFn: async () => { const { data } = await api.get('/profile'); return data; },
    staleTime: 5 * 60 * 1000,
  });

  const refSlug = ((profile as any)?.name ?? '').split(/\s/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'friend';
  const referralLink = `https://aussiegradcareers.com.au?ref=${refSlug}`;
  const shareMsg = `I just found this free tool that analyzed exactly why my applications weren't getting responses. Takes 5 minutes and the report is actually useful - ${referralLink}`;

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: '0px 0px -80px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [sections.length]);

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: theme.bg, zIndex: 10, transition: 'background 0.3s' }}>

        {/* Ambient blobs */}
        <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
          {[
            { top: '-15%', left: '-10%', size: 500, color: theme.blobs[0] },
            { top: '50%',  right: '-8%', size: 420, color: theme.blobs[1] },
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
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 780, margin: '0 auto', padding: '72px 24px 140px' }}>

          {/* Friday call banner */}
          {isInCurrentFridayWindow(data?.createdAt ?? null) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                background: 'rgba(252,211,77,0.06)', border: '1px solid rgba(252,211,77,0.20)',
                borderRadius: 14, padding: '14px 20px', marginBottom: 32, textAlign: 'center',
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
              Six areas. Open each one. The severity badge tells you where to focus first.
            </p>
          </motion.div>

          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes progressShimmer {
              0% { background-position: -200% center; }
              100% { background-position: 200% center; }
            }
          `}</style>

          {/* Loading / processing */}
          {(isLoading || status === 'PROCESSING') && sections.length === 0 && processingMs < 60000 && (
            <div style={{ padding: '20px 0 48px' }}>
              <div style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
                borderRadius: 20, padding: '36px 32px 32px', marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    border: `3px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    borderTopColor: '#0F766E', animation: 'spin 0.9s linear infinite',
                  }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: isDark ? '#f3f4f6' : '#111827', lineHeight: 1.3 }}>
                      Writing your diagnosis…
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 13, color: theme.sub }}>
                      {processingMs < 8000  ? 'Reading your intake answers'
                      : processingMs < 20000 ? 'Analysing your resume and target role'
                      : processingMs < 36000 ? 'Identifying the gaps in your approach'
                      : processingMs < 50000 ? 'Writing your personalised diagnosis'
                      : 'Finalising your report'}
                    </p>
                  </div>
                </div>
                <div style={{ width: '100%', height: 6, borderRadius: 99, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    width: `${Math.min(88, 5 + (processingMs / 60000) * 83)}%`,
                    background: 'linear-gradient(90deg, #0F766E 0%, #2dd4bf 50%, #0F766E 100%)',
                    backgroundSize: '200% auto', animation: 'progressShimmer 2s linear infinite',
                    transition: 'width 3.5s ease-out',
                  }} />
                </div>
                <p style={{ fontSize: 12, color: theme.sub, margin: 0 }}>Usually takes 30–60 seconds — hang tight.</p>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, rgba(15,118,110,0.12) 0%, rgba(19,78,74,0.08) 100%)',
                border: '1px solid rgba(15,118,110,0.25)', borderRadius: 20, padding: '28px 32px',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#0F766E' }}>While you wait</p>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                  Join the free community while your report generates.
                </p>
                <p style={{ margin: 0, fontSize: 14, color: theme.sub, lineHeight: 1.7 }}>
                  The{' '}
                  <a href="https://www.skool.com/aussiegradcareers" target="_blank" rel="noopener noreferrer" style={{ color: '#2dd4bf', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                    Aussie Grad Careers community
                  </a>
                  {' '}has the frameworks, templates, and live coaching calls that map directly to what's in your report — so you can take action the moment it's ready.
                </p>
                <a
                  href="https://www.skool.com/aussiegradcareers" target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'inline-block', alignSelf: 'flex-start',
                    background: 'linear-gradient(135deg, #0F766E, #134E4A)', color: 'white',
                    borderRadius: 12, padding: '11px 24px', fontSize: 14, fontWeight: 800,
                    textDecoration: 'none', boxShadow: '0 4px 16px rgba(15,118,110,0.28)', marginTop: 4,
                  }}
                >
                  Join free on Skool →
                </a>
              </div>
            </div>
          )}

          {/* Stuck in processing */}
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

          {/* API error */}
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

          {/* FAILED or empty */}
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

          {/* Report sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sections
              .sort((a, b) => {
                const ai = SECTION_ORDER.indexOf(a.key);
                const bi = SECTION_ORDER.indexOf(b.key);
                return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
              })
              .map((section, idx) => {
                const meta = SECTION_ICONS[section.key];
                if (!meta) return null;
                const severity = SECTION_SEVERITY[section.key];
                const { problem, fix } = splitProblemFix(section.content);
                const hook = extractHook(problem);
                const intro = SECTION_INTROS[section.key] || '';
                const isOpen = !!openMap[section.key];
                const sectionNum = String(idx + 1).padStart(2, '0');
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
                      background: isFix ? (isDark ? 'rgba(20,83,45,0.25)' : 'rgba(240,253,244,0.95)') : theme.islandBg,
                      border: isFix
                        ? `2px solid ${isOpen ? '#22c55e80' : '#22c55e40'}`
                        : `1px solid ${isOpen ? meta.color + '30' : theme.islandBorder}`,
                      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                      overflow: 'hidden', transition: 'border-color 0.25s, background 0.25s',
                      boxShadow: isFix ? `0 0 0 4px ${isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.10)'}` : undefined,
                    }}
                  >
                    <button
                      onClick={() => handleToggle(section.key)}
                      style={{ width: '100%', textAlign: 'left', padding: '22px 24px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 11, fontWeight: 900, color: meta.color, opacity: 0.5, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {sectionNum}
                          </span>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, flexShrink: 0, boxShadow: `0 0 8px ${meta.color}60` }} />
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: meta.color, margin: 0 }}>{meta.label}</p>
                            <p style={{ fontSize: 11, color: theme.introText, margin: '2px 0 0', lineHeight: 1.4 }}>{intro}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          {severity && (
                            <span style={{
                              fontSize: 9, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase',
                              color: severity.color, background: severity.bg,
                              borderRadius: 6, padding: '3px 8px', border: `1px solid ${severity.color}30`,
                            }}>
                              {severity.label}
                            </span>
                          )}
                          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                            <ChevronDown size={18} color={theme.eyebrow} />
                          </motion.div>
                        </div>
                      </div>

                      {!isOpen && (
                        <p style={{ fontSize: 17, fontWeight: 700, color: theme.hookText, lineHeight: 1.5, margin: '0 0 0 34px', borderLeft: `3px solid ${meta.color}50`, paddingLeft: 14 }}>
                          {hook}
                        </p>
                      )}
                      {!isOpen && (
                        <p style={{ fontSize: 11, fontWeight: 700, color: meta.color, margin: '2px 0 0 34px', letterSpacing: '0.05em' }}>
                          Open to read full diagnosis →
                        </p>
                      )}
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{ padding: '0 24px 24px 24px', color: theme.bodyText }}>
                            <div style={{ height: 1, background: theme.divider, marginBottom: 20 }} />
                            <RenderContent text={problem} color={meta.color} />
                            {fix && (
                              <div style={{
                                margin: '24px -24px 0', padding: '20px 24px',
                                background: isDark ? `rgba(${meta.color === '#5EEAD4' ? '94,234,212' : '255,255,255'},0.04)` : `${meta.color}08`,
                                borderTop: `1px solid ${meta.color}25`, borderBottom: `1px solid ${meta.color}25`,
                              }}>
                                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: meta.color, margin: '0 0 14px' }}>
                                  Your fix
                                </p>
                                <RenderContent text={fix} color={meta.color} />
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
          </div>

          {/* ── What now section ── */}
          {sections.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
              style={{ marginTop: 64 }}
            >
              {/* Section header */}
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e80' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#22c55e' }}>
                    Diagnosis complete
                  </span>
                </div>
                <h2 style={{ fontSize: 30, fontWeight: 900, color: theme.heading, margin: '0 0 10px', lineHeight: 1.15, letterSpacing: '-0.025em' }}>
                  You now know exactly what's holding back your applications.
                </h2>
                <p style={{ fontSize: 16, color: theme.sub, lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>
                  You have two options to fix these gaps:
                </p>
              </div>

              {/* Urgency bar */}
              <div style={{
                background: isDark ? 'rgba(251,191,36,0.06)' : 'rgba(254,243,199,0.85)',
                border: `1px solid ${isDark ? 'rgba(251,191,36,0.22)' : 'rgba(251,191,36,0.40)'}`,
                borderRadius: 14, padding: '14px 22px', marginBottom: 18, textAlign: 'center',
              }}>
                <p style={{ margin: 0, fontSize: 14, color: isDark ? '#fcd34d' : '#92400e', lineHeight: 1.65, fontWeight: 500 }}>
                  Every week you spend manually customising applications is a week you're competing with Australians who have local networks and no visa concerns.
                </p>
              </div>

              {/* Two options */}
              <div ref={ctaRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>

                {/* Option 1: Free */}
                <div style={{
                  background: isDark ? 'rgba(6,78,59,0.15)' : 'rgba(240,253,244,0.95)',
                  border: `1px solid ${isDark ? 'rgba(16,185,129,0.22)' : 'rgba(16,185,129,0.28)'}`,
                  borderRadius: 20, padding: '24px 20px 20px',
                  display: 'flex', flexDirection: 'column', gap: 14,
                }}>
                  <div>
                    <span style={{
                      display: 'inline-block', fontSize: 9, fontWeight: 900, letterSpacing: '0.16em',
                      textTransform: 'uppercase', background: isDark ? 'rgba(16,185,129,0.16)' : 'rgba(16,185,129,0.12)',
                      color: isDark ? '#34d399' : '#065f46', borderRadius: 6, padding: '3px 8px', marginBottom: 12,
                    }}>
                      Option 1 · Free
                    </span>
                    <h3 style={{ fontSize: 19, fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827', margin: '0 0 8px', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                      Master the system yourself
                    </h3>
                    <p style={{ fontSize: 13.5, color: isDark ? '#9ca3af' : '#4b5563', lineHeight: 1.7, margin: 0 }}>
                      Templates, training videos, and weekly group calls. Build your applications yourself with our proven frameworks.
                    </p>
                  </div>

                  {/* Testimonial */}
                  <div style={{
                    background: isDark ? 'rgba(16,185,129,0.10)' : 'rgba(16,185,129,0.07)',
                    borderLeft: '3px solid #10b981',
                    borderRadius: '0 10px 10px 0', padding: '12px 14px',
                  }}>
                    <p style={{ margin: '0 0 6px', fontSize: 13, color: isDark ? '#a7f3d0' : '#065f46', lineHeight: 1.65, fontStyle: 'italic' }}>
                      "The templates and training calls gave me the confidence to optimize my own applications. Got 2 interviews in my first month."
                    </p>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: isDark ? '#6ee7b7' : '#059669' }}>— David, Software Engineer</p>
                  </div>

                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      onClick={() => setOptionModal(1)}
                      style={{
                        background: 'none', border: `1px solid ${isDark ? 'rgba(16,185,129,0.28)' : 'rgba(16,185,129,0.35)'}`,
                        borderRadius: 10, padding: '9px 14px', fontSize: 12, fontWeight: 700,
                        color: isDark ? '#34d399' : '#059669', cursor: 'pointer', textAlign: 'center', minHeight: 44,
                      }}
                    >
                      See what's included →
                    </button>
                    <a
                      href="https://www.skool.com/aussiegradcareers" target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                        background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
                        borderRadius: 12, padding: '13px 18px', fontSize: 14, fontWeight: 800,
                        textDecoration: 'none', boxShadow: '0 4px 14px rgba(16,185,129,0.28)', letterSpacing: '-0.01em',
                        minHeight: 44,
                      } as React.CSSProperties}
                    >
                      Join Free Community
                    </a>
                  </div>
                </div>

                {/* Option 2: Paid */}
                <div style={{
                  background: isDark ? 'rgba(79,70,229,0.12)' : 'rgba(238,242,255,0.95)',
                  border: `2px solid ${isDark ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.30)'}`,
                  borderRadius: 20, padding: '24px 20px 20px',
                  display: 'flex', flexDirection: 'column', gap: 14,
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', top: 13, right: -28,
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: 'white', fontSize: 8, fontWeight: 900, letterSpacing: '0.12em',
                    textTransform: 'uppercase', padding: '4px 36px', transform: 'rotate(45deg)',
                    pointerEvents: 'none',
                  }}>
                    FASTEST
                  </div>

                  <div>
                    <span style={{
                      display: 'inline-block', fontSize: 9, fontWeight: 900, letterSpacing: '0.16em',
                      textTransform: 'uppercase', background: isDark ? 'rgba(99,102,241,0.16)' : 'rgba(99,102,241,0.12)',
                      color: isDark ? '#a5b4fc' : '#4338ca', borderRadius: 6, padding: '3px 8px', marginBottom: 12,
                    }}>
                      Option 2 · $97/month
                    </span>
                    <h3 style={{ fontSize: 19, fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827', margin: '0 0 8px', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                      Let AI master it for you
                    </h3>
                    <p style={{ fontSize: 13.5, color: isDark ? '#9ca3af' : '#4b5563', lineHeight: 1.7, margin: 0 }}>
                      What took you 3 hours of manual work now takes 3 minutes with AI. That's 20x faster application creation.
                    </p>
                  </div>

                  {/* Speed stat */}
                  <div style={{
                    background: isDark ? 'rgba(99,102,241,0.10)' : 'rgba(99,102,241,0.07)',
                    border: `1px solid ${isDark ? 'rgba(99,102,241,0.20)' : 'rgba(99,102,241,0.16)'}`,
                    borderRadius: 12, padding: '14px 16px',
                    display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8,
                    alignItems: 'center', textAlign: 'center',
                  }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: isDark ? '#a5b4fc' : '#4338ca', letterSpacing: '-0.03em', lineHeight: 1 }}>3 min</p>
                      <p style={{ margin: '3px 0 0', fontSize: 11, color: isDark ? '#6b7280' : '#9ca3af', fontWeight: 600 }}>with AI</p>
                    </div>
                    <span style={{ fontSize: 13, color: isDark ? '#374151' : '#d1d5db' }}>vs</span>
                    <div>
                      <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: isDark ? '#374151' : '#d1d5db', letterSpacing: '-0.03em', lineHeight: 1, textDecoration: 'line-through' }}>3 hrs</p>
                      <p style={{ margin: '3px 0 0', fontSize: 11, color: isDark ? '#6b7280' : '#9ca3af', fontWeight: 600 }}>manually</p>
                    </div>
                  </div>

                  {/* Sarah testimonial — moved from left */}
                  <div style={{
                    background: isDark ? 'rgba(99,102,241,0.10)' : 'rgba(99,102,241,0.07)',
                    borderLeft: '3px solid #6366f1',
                    borderRadius: '0 10px 10px 0', padding: '12px 14px',
                  }}>
                    <p style={{ margin: '0 0 6px', fontSize: 13, color: isDark ? '#c7d2fe' : '#3730a3', lineHeight: 1.65, fontStyle: 'italic' }}>
                      "With 2 other international grads, I'll personally review your LinkedIn profile and send you my exact outreach templates that got Sarah 8 interviews in 3 weeks."
                    </p>
                  </div>

                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      onClick={() => setOptionModal(2)}
                      style={{
                        background: 'none', border: `1px solid ${isDark ? 'rgba(99,102,241,0.32)' : 'rgba(99,102,241,0.35)'}`,
                        borderRadius: 10, padding: '9px 14px', fontSize: 12, fontWeight: 700,
                        color: isDark ? '#a5b4fc' : '#4338ca', cursor: 'pointer', textAlign: 'center', minHeight: 44,
                      }}
                    >
                      See all features →
                    </button>
                    <button
                      onClick={onDone}
                      style={{
                        width: '100%', background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        color: 'white', borderRadius: 12, padding: '13px 18px',
                        fontSize: 14, fontWeight: 800, border: 'none',
                        boxShadow: '0 4px 16px rgba(99,102,241,0.32)', cursor: 'pointer',
                        letterSpacing: '-0.01em', minHeight: 44,
                      }}
                    >
                      Get Instant Access — Free for 7 Days →
                    </button>
                    <p style={{ margin: 0, fontSize: 11, color: isDark ? '#4b5563' : '#9ca3af', textAlign: 'center' }}>
                      See how fast this really is · No charge until day 8
                    </p>
                  </div>
                </div>
              </div>

              {/* Referral / share section */}
              <div style={{
                background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(248,250,252,0.92)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
                borderRadius: 20, padding: '24px 24px 20px', marginBottom: 20,
              }}>
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: isDark ? '#374151' : '#9ca3af', marginBottom: 8 }}>
                  Know someone in the same boat?
                </p>
                <p style={{ fontSize: 18, fontWeight: 800, color: theme.heading, margin: '0 0 6px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  Share this with them. They get a free diagnostic.
                </p>
                <p style={{ fontSize: 13, color: theme.sub, lineHeight: 1.6, margin: '0 0 16px' }}>
                  Every international grad you refer gets clarity on exactly what's holding their applications back.
                </p>

                {/* Message preview */}
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                  border: `1px dashed ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
                  borderRadius: 12, padding: '13px 15px', marginBottom: 13,
                  fontSize: 13, color: isDark ? '#6b7280' : '#6b7280', lineHeight: 1.7, fontStyle: 'italic',
                }}>
                  "I just found this free tool that analyzed exactly why my applications weren't getting responses. Takes 5 minutes and the report is actually useful —{' '}
                  <span style={{ color: isDark ? '#5eead4' : '#0F766E', fontStyle: 'normal', fontWeight: 600 }}>
                    {referralLink}
                  </span>"
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Copy message', copied: msgCopied, onClick: () => { navigator.clipboard.writeText(shareMsg); setMsgCopied(true); setTimeout(() => setMsgCopied(false), 2500); } },
                    { label: 'Copy link',    copied: linkCopied, onClick: () => { navigator.clipboard.writeText(referralLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); } },
                  ].map(({ label, copied, onClick }) => (
                    <button
                      key={label}
                      onClick={onClick}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        background: copied ? (isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.10)') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                        border: `1px solid ${copied ? 'rgba(34,197,94,0.30)' : (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)')}`,
                        borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700,
                        color: copied ? '#22c55e' : (isDark ? '#9ca3af' : '#4b5563'),
                        cursor: 'pointer', transition: 'all 0.18s', minHeight: 44,
                      }}
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? 'Copied!' : label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dashboard skip */}
              <div style={{ textAlign: 'center', paddingBottom: 8 }}>
                <button
                  onClick={onDone}
                  style={{ background: 'none', border: 'none', color: isDark ? '#374151' : '#9ca3af', fontWeight: 500, cursor: 'pointer', fontSize: 13, padding: '8px 0' }}
                >
                  Already have an account? Go straight to the dashboard →
                </button>
              </div>
            </motion.div>
          )}

        </div>
      </div>

      {/* ── Sticky bar ── */}
      <AnimatePresence>
        {showSticky && sections.length > 0 && (
          <motion.div
            initial={{ y: 88, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 88, opacity: 0 }}
            transition={{ ease: [0.25, 1, 0.5, 1], duration: 0.3 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
              background: theme.stickyBg, borderTop: `1px solid ${theme.stickyBorder}`,
              boxShadow: '0 -8px 32px rgba(0,0,0,0.16)',
              padding: '14px 24px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap',
            }}
          >
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: theme.heading, marginRight: 4, whiteSpace: 'nowrap' }}>
              Ready to speed up your job search?
            </p>
            <a
              href="https://www.skool.com/aussiegradcareers" target="_blank" rel="noopener noreferrer"
              style={{
                background: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.09)',
                border: '1px solid rgba(16,185,129,0.30)',
                color: isDark ? '#34d399' : '#059669', borderRadius: 10,
                padding: '10px 18px', fontSize: 13, fontWeight: 700,
                textDecoration: 'none', whiteSpace: 'nowrap', minHeight: 44,
                display: 'inline-flex', alignItems: 'center',
              }}
            >
              Join Free Community
            </a>
            <button
              onClick={onDone}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white',
                borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 800,
                border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.28)',
                whiteSpace: 'nowrap', minHeight: 44,
              }}
            >
              Get Instant Access — Free for 7 Days →
            </button>
            <button
              onClick={() => setShowSticky(false)}
              aria-label="Dismiss"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: isDark ? '#4b5563' : '#9ca3af', padding: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44,
              }}
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Option modals ── */}
      <AnimatePresence>
        {optionModal !== null && (
          <motion.div
            key="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOptionModal(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            }}
          >
            <motion.div
              key={optionModal}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ ease: [0.25, 1, 0.5, 1], duration: 0.32 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: theme.modalBg,
                border: `1px solid ${optionModal === 1
                  ? (isDark ? 'rgba(16,185,129,0.28)' : 'rgba(16,185,129,0.18)')
                  : (isDark ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.18)')}`,
                borderRadius: 24, padding: '36px 36px 32px',
                maxWidth: 560, width: '100%', maxHeight: '88vh', overflowY: 'auto',
                position: 'relative',
              }}
            >
              <button
                onClick={() => setOptionModal(null)}
                style={{
                  position: 'absolute', top: 16, right: 16,
                  background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                  border: 'none', borderRadius: 10, width: 34, height: 34,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: isDark ? '#6b7280' : '#9ca3af',
                }}
              >
                <X size={14} />
              </button>

              {optionModal === 1 ? (
                <>
                  <span style={{
                    display: 'inline-block', fontSize: 9, fontWeight: 900, letterSpacing: '0.16em',
                    textTransform: 'uppercase', background: isDark ? 'rgba(16,185,129,0.16)' : 'rgba(16,185,129,0.10)',
                    color: isDark ? '#34d399' : '#065f46', borderRadius: 6, padding: '3px 8px', marginBottom: 14,
                  }}>
                    Free Community
                  </span>
                  <h2 style={{ fontSize: 24, fontWeight: 900, color: isDark ? '#f3f4f6' : '#111827', margin: '0 0 10px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                    Master the system yourself
                  </h2>
                  <p style={{ fontSize: 14, color: theme.sub, lineHeight: 1.7, margin: '0 0 22px' }}>
                    Templates, training videos, and weekly group calls. Build your applications yourself with our proven frameworks.
                  </p>

                  <div style={{
                    background: isDark ? 'rgba(16,185,129,0.10)' : 'rgba(240,253,244,0.95)',
                    border: `1px solid ${isDark ? 'rgba(16,185,129,0.22)' : 'rgba(16,185,129,0.20)'}`,
                    borderLeft: '3px solid #10b981', borderRadius: '0 12px 12px 0',
                    padding: '14px 16px', marginBottom: 24,
                  }}>
                    <p style={{ margin: '0 0 6px', fontSize: 14, color: isDark ? '#a7f3d0' : '#065f46', lineHeight: 1.7, fontStyle: 'italic' }}>
                      "The templates and training calls gave me the confidence to optimize my own applications. Got 2 interviews in my first month."
                    </p>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: isDark ? '#6ee7b7' : '#059669' }}>— David, Software Engineer</p>
                  </div>

                  <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: isDark ? '#4b5563' : '#9ca3af', marginBottom: 12 }}>
                    8 modules included
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
                    {SKOOL_MODULES.map((item, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '10px 12px',
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
                        borderRadius: 10,
                      }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #10b981, #047857)',
                          color: 'white', fontSize: 11, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>{i + 1}</span>
                        <p style={{ margin: 0, fontSize: 13, color: isDark ? '#9ca3af' : '#374151', lineHeight: 1.5 }}>{item}</p>
                      </div>
                    ))}
                  </div>
                  <a
                    href="https://www.skool.com/aussiegradcareers" target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'block', textAlign: 'center',
                      background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
                      borderRadius: 14, padding: '14px 24px', fontSize: 15, fontWeight: 800,
                      textDecoration: 'none', boxShadow: '0 6px 20px rgba(16,185,129,0.28)', letterSpacing: '-0.01em',
                    }}
                  >
                    Join Free Community →
                  </a>
                </>
              ) : (
                <>
                  <span style={{
                    display: 'inline-block', fontSize: 9, fontWeight: 900, letterSpacing: '0.16em',
                    textTransform: 'uppercase', background: isDark ? 'rgba(99,102,241,0.16)' : 'rgba(99,102,241,0.10)',
                    color: isDark ? '#a5b4fc' : '#4338ca', borderRadius: 6, padding: '3px 8px', marginBottom: 14,
                  }}>
                    Pro Tool · $97/month
                  </span>
                  <h2 style={{ fontSize: 24, fontWeight: 900, color: isDark ? '#f3f4f6' : '#111827', margin: '0 0 10px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                    Let AI master it for you
                  </h2>
                  <p style={{ fontSize: 14, color: theme.sub, lineHeight: 1.7, margin: '0 0 6px' }}>
                    One tailored application every 3 minutes — resume, cover letter, and LinkedIn optimisation built from your achievement bank.
                  </p>
                  <p style={{ fontSize: 14, color: isDark ? '#fbbf24' : '#92400e', lineHeight: 1.65, margin: '0 0 22px', fontWeight: 500 }}>
                    The average Australian graduate earns $1,200+ per week. Every week you wait costs more than a full year of this tool.
                  </p>

                  <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: isDark ? '#4b5563' : '#9ca3af', marginBottom: 12 }}>
                    Everything included
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 28 }}>
                    {PRO_FEATURES.map(({ emoji, label, desc }) => (
                      <div key={label} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                        background: isDark ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.04)',
                        border: `1px solid ${isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.10)'}`,
                        borderRadius: 10,
                      }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{emoji}</span>
                        <div>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: isDark ? '#e2e8f0' : '#111827' }}>{label}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: isDark ? '#6b7280' : '#6b7280', lineHeight: 1.5 }}>{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => { setOptionModal(null); onDone(); }}
                    style={{
                      display: 'block', width: '100%',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white',
                      borderRadius: 14, padding: '14px 24px', fontSize: 15, fontWeight: 800,
                      border: 'none', boxShadow: '0 6px 20px rgba(99,102,241,0.32)',
                      cursor: 'pointer', letterSpacing: '-0.01em', marginBottom: 10,
                    }}
                  >
                    Get Instant Access — Free for 7 Days →
                  </button>
                  <p style={{ textAlign: 'center', fontSize: 12, color: isDark ? '#4b5563' : '#9ca3af', margin: 0 }}>
                    No charge until day 8 · Cancel any time
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
