import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Sun, Moon, Copy, Check, X, Star } from 'lucide-react';
import api from '../lib/api';
import { parseReportSections, splitProblemFix } from '../lib/parseReport';

// ── Color constants ────────────────────────────────────────────────────────────
const INDIGO = '#5850EC';
const TEAL   = '#0F766E';
const RED    = '#ef4444';
const AMBER  = '#f59e0b';

// ── Section metadata (replaces SECTION_ICONS — simplified 2-color palette) ────
const SECTION_META: Record<string, {
  label: string;
  severity: string;
  color: string;
  bg: string;
  isCritical: boolean;
}> = {
  targeting:      { label: 'Targeting',            severity: 'REVIEW',      color: AMBER,   bg: 'rgba(245,158,11,0.08)',  isCritical: false },
  document_audit: { label: 'Document Audit',       severity: 'CRITICAL',    color: RED,     bg: 'rgba(239,68,68,0.08)',   isCritical: true  },
  pipeline:       { label: 'Application Pipeline', severity: 'REVIEW',      color: AMBER,   bg: 'rgba(245,158,11,0.08)',  isCritical: false },
  honest:         { label: 'The Honest Truth',     severity: 'CRITICAL',    color: RED,     bg: 'rgba(239,68,68,0.08)',   isCritical: true  },
  fix:            { label: 'Your 3-Step Fix',      severity: 'ACTION PLAN', color: INDIGO,  bg: 'rgba(88,80,236,0.08)',   isCritical: false },
};

const SECTION_ORDER    = ['targeting', 'document_audit', 'pipeline', 'honest', 'fix', 'what_jobhub_does'];
const CARDS_TO_RENDER  = ['targeting', 'document_audit', 'pipeline', 'honest', 'fix'];

const SECTION_INTROS: Record<string, string> = {
  targeting:      'Whether you\'re targeting the right roles and seniority for your experience.',
  document_audit: 'How your resume and cover letter land with a recruiter in the first 6 seconds.',
  pipeline:       'Where in the process — applications, interviews, offers — things are breaking.',
  honest:         'What your documents reveal versus what you think the problem is.',
  fix:            'Three concrete actions ranked by impact, written for your situation.',
};

const RESPONSE_INTROS: Record<string, string> = {
  mostly_silence:    'Your applications are going out — but nothing is coming back.',
  mostly_rejections: 'You\'re getting responses, but they all end the same way.',
  interviews_stall:  'You\'re getting in the room. The problem is what happens next.',
  no_offers:         'You\'re making it to the final stages. Something is breaking at the close.',
  mix:               'The pattern isn\'t consistent — which usually means the issue is structural.',
};

// ── Theme ──────────────────────────────────────────────────────────────────────
function makeTheme(isDark: boolean) {
  return isDark ? {
    bg:           '#0d1117',
    card:         'rgba(255,255,255,0.03)',
    cardBorder:   'rgba(255,255,255,0.07)',
    heading:      '#f3f4f6',
    sub:          '#6b7280',
    intro:        '#6b7280',
    body:         '#9ca3af',
    divider:      'rgba(255,255,255,0.07)',
    fixBand:      'rgba(255,255,255,0.04)',
    toggleBg:     'rgba(255,255,255,0.08)',
    toggleColor:  '#9ca3af',
    stickyBg:     '#111827',
    stickyBorder: 'rgba(255,255,255,0.08)',
    modalBg:      '#111827',
    inputBg:      'rgba(255,255,255,0.05)',
    inputBorder:  'rgba(255,255,255,0.10)',
    inputText:    '#e5e7eb',
    chipBg:       'rgba(255,255,255,0.07)',
    chipBorder:   'rgba(255,255,255,0.12)',
    chipActive:   INDIGO,
    referralBg:   'rgba(255,255,255,0.025)',
    referralBorder:'rgba(255,255,255,0.07)',
    blobs:        ['rgba(88,80,236,0.05)', 'rgba(15,118,110,0.04)', 'rgba(239,68,68,0.03)'],
  } : {
    bg:           '#f5f4f0',
    card:         'rgba(255,255,255,0.92)',
    cardBorder:   'rgba(0,0,0,0.08)',
    heading:      '#111827',
    sub:          '#6b7280',
    intro:        '#9ca3af',
    body:         '#4b5563',
    divider:      'rgba(0,0,0,0.07)',
    fixBand:      'rgba(0,0,0,0.025)',
    toggleBg:     'rgba(0,0,0,0.07)',
    toggleColor:  '#6b7280',
    stickyBg:     '#ffffff',
    stickyBorder: 'rgba(0,0,0,0.09)',
    modalBg:      '#ffffff',
    inputBg:      'rgba(0,0,0,0.04)',
    inputBorder:  'rgba(0,0,0,0.12)',
    inputText:    '#111827',
    chipBg:       'rgba(0,0,0,0.05)',
    chipBorder:   'rgba(0,0,0,0.10)',
    chipActive:   INDIGO,
    referralBg:   'rgba(248,250,252,0.95)',
    referralBorder:'rgba(0,0,0,0.07)',
    blobs:        ['rgba(88,80,236,0.07)', 'rgba(15,118,110,0.06)', 'rgba(239,68,68,0.04)'],
  };
}

// ── Inline markdown renderer ───────────────────────────────────────────────────
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {lines.map((line, i) => {
        const t = line.trim();
        if (t.startsWith('- ') || t.startsWith('• ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color, fontWeight: 800, marginTop: 3, flexShrink: 0, fontSize: 14 }}>·</span>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: 'inherit', fontWeight: 500 }}>
                {renderInline(t.replace(/^[-•]\s/, ''))}
              </p>
            </div>
          );
        }
        if (t.startsWith('###') || t.startsWith('##')) {
          return (
            <p key={i} style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color, opacity: 0.85 }}>
              {t.replace(/^#+\s/, '')}
            </p>
          );
        }
        return (
          <p key={i} style={{ margin: 0, fontSize: 15, lineHeight: 1.8, fontWeight: 450 }}>
            {renderInline(t)}
          </p>
        );
      })}
    </div>
  );
}

// ── Social proof widget ────────────────────────────────────────────────────────
const RATING_CHIPS = ['Spot on', 'Eye-opening', 'Needed to hear this', 'Needs more detail'];

function SocialProofWidget({ isDark, theme }: { isDark: boolean; theme: ReturnType<typeof makeTheme> }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [chips, setChips] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function toggleChip(chip: string) {
    setChips(prev => prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]);
  }

  async function handleSubmit() {
    if (!rating) return;
    setSubmitting(true);
    try {
      await api.post('/onboarding/rating', { rating, chips, comment: comment.trim() || undefined });
      setSubmitted(true);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
      style={{
        background: theme.card,
        border: `1px solid ${theme.cardBorder}`,
        borderRadius: 20,
        padding: '28px 28px 24px',
        backdropFilter: 'blur(24px)',
      }}
    >
      {submitted ? (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: theme.heading, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Thanks for the feedback.</p>
          <p style={{ fontSize: 14, color: theme.sub }}>This helps us improve the diagnosis for everyone.</p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.sub, marginBottom: 8 }}>
            How accurate was your diagnosis?
          </p>
          <h3 style={{ fontSize: 20, fontWeight: 900, color: theme.heading, margin: '0 0 20px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Does this match what you've been experiencing?
          </h3>

          {/* Stars */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
              >
                <Star
                  size={28}
                  fill={(hovered || rating) >= n ? AMBER : 'none'}
                  color={(hovered || rating) >= n ? AMBER : (isDark ? '#374151' : '#d1d5db')}
                  strokeWidth={1.5}
                  style={{ transition: 'all 0.1s' }}
                />
              </button>
            ))}
          </div>

          {/* Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {RATING_CHIPS.map(chip => {
              const active = chips.includes(chip);
              return (
                <button
                  key={chip}
                  onClick={() => toggleChip(chip)}
                  style={{
                    background: active ? `${INDIGO}15` : theme.chipBg,
                    border: `1px solid ${active ? INDIGO + '50' : theme.chipBorder}`,
                    borderRadius: 99, padding: '7px 14px', fontSize: 13, fontWeight: 600,
                    color: active ? INDIGO : theme.sub, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {chip}
                </button>
              );
            })}
          </div>

          {/* Optional comment */}
          <textarea
            placeholder="Anything else? (optional)"
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={2}
            style={{
              width: '100%', background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
              borderRadius: 10, color: theme.inputText, fontSize: 14,
              padding: '10px 14px', outline: 'none', resize: 'none',
              fontFamily: 'inherit', marginBottom: 14, boxSizing: 'border-box',
            }}
          />

          <button
            onClick={handleSubmit}
            disabled={!rating || submitting}
            style={{
              background: rating ? INDIGO : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'),
              color: rating ? 'white' : theme.sub,
              border: 'none', borderRadius: 10, padding: '11px 24px',
              fontSize: 14, fontWeight: 700, cursor: rating ? 'pointer' : 'default',
              transition: 'all 0.2s', boxShadow: rating ? `0 4px 14px ${INDIGO}30` : 'none',
            }}
          >
            {submitting ? 'Saving...' : 'Submit feedback'}
          </button>
        </>
      )}
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface ReportExperienceProps {
  onDone: () => void;
}

interface ReportData {
  reportId: string;
  status: string;
  reportMarkdown: string | null;
  createdAt: string | null;
}

export function ReportExperience({ onDone }: ReportExperienceProps) {
  const [isDark, setIsDark] = useState(true);
  const theme = makeTheme(isDark);
  const [processingMs, setProcessingMs] = useState(0);
  const [showSticky, setShowSticky] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, refetch } = useQuery<ReportData>({
    queryKey: ['report'],
    queryFn: async () => { const res = await api.get<ReportData>('/onboarding/report'); return res.data; },
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: (query) => query.state.data?.status === 'PROCESSING' ? 4000 : false,
  });

  const { data: profile } = useQuery<{ name?: string; targetRole?: string; responsePattern?: string }>({
    queryKey: ['profile'],
    queryFn: async () => { const { data } = await api.get('/profile'); return data; },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (data?.status !== 'PROCESSING') { setProcessingMs(0); return; }
    const t = setInterval(() => setProcessingMs(ms => ms + 4000), 4000);
    return () => clearInterval(t);
  }, [data?.status]);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: '0px 0px -80px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const sections = parseReportSections(data?.reportMarkdown ?? '');
  const status   = data?.status;

  const firstName  = profile?.name?.split(' ')[0] ?? null;
  const targetRole = (profile as any)?.targetRole ?? null;
  const responsePattern = (profile as any)?.responsePattern ?? null;

  const refSlug = (profile?.name ?? '').split(/\s/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'friend';
  const referralLink = `https://aussiegradcareers.com.au?ref=${refSlug}`;
  const shareMsg = `I just found this free tool that analyzed exactly why my applications weren't getting responses. Takes 5 minutes and the report is genuinely useful — ${referralLink}`;

  // Extract what_jobhub_does content for use in CTA section
  const whatJobHubSection = sections.find(s => s.key === 'what_jobhub_does');
  const whatJobHubSnippet = whatJobHubSection
    ? whatJobHubSection.content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).slice(0, 2).join(' ')
    : '';

  const cardSections = sections
    .filter(s => CARDS_TO_RENDER.includes(s.key))
    .sort((a, b) => {
      const ai = SECTION_ORDER.indexOf(a.key);
      const bi = SECTION_ORDER.indexOf(b.key);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  const BLOCKER_PRIORITY = ['document_audit', 'honest', 'targeting', 'pipeline'];
  const BLOCKER_HEADLINES: Record<string, string> = {
    document_audit: 'Your resume isn\'t clearing the 6-second recruiter test.',
    honest:         'Your positioning isn\'t matching what the market wants.',
    targeting:      'Your targeting strategy is working against you.',
    pipeline:       'Your applications aren\'t turning into conversations.',
  };
  const topKey = BLOCKER_PRIORITY.find(k => sections.some(s => s.key === k));
  const stickyHeadline = topKey ? BLOCKER_HEADLINES[topKey] : 'Your job search has a clear blocker.';

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes criticalPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-card { break-inside: avoid; }
        }
      `}</style>

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
          aria-label="Toggle theme"
          className="no-print"
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
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto', padding: '72px 24px 160px' }}>

          {/* ── Personalized header ── */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ marginBottom: 48, textAlign: 'center' }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.sub, marginBottom: 12 }}>
              Your diagnosis
            </p>
            <h1 style={{ fontSize: 'clamp(26px, 5vw, 38px)', fontWeight: 900, color: theme.heading, margin: '0 0 12px', lineHeight: 1.15, letterSpacing: '-0.025em' }}>
              {firstName && targetRole
                ? <>Here's what's holding back<br />your <span style={{ color: INDIGO }}>{targetRole}</span> search, {firstName}.</>
                : firstName
                ? <>Here's what's holding back<br />your search, {firstName}.</>
                : <>Here's what's actually going on.</>
              }
            </h1>
            {responsePattern && RESPONSE_INTROS[responsePattern] && (
              <p style={{ fontSize: 16, color: theme.sub, lineHeight: 1.6, maxWidth: 460, margin: '0 auto 0' }}>
                {RESPONSE_INTROS[responsePattern]}
              </p>
            )}
          </motion.div>

          {/* ── Loading / processing ── */}
          {(isLoading || status === 'PROCESSING') && sections.length === 0 && processingMs < 60000 && (
            <div style={{ padding: '8px 0 40px' }}>
              <div style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
                borderRadius: 20, padding: '36px 32px 32px', marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    border: `3px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    borderTopColor: TEAL, animation: 'spin 0.9s linear infinite',
                  }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: theme.heading, lineHeight: 1.3 }}>
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
                <div style={{ width: '100%', height: 4, borderRadius: 99, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    width: `${Math.min(88, 5 + (processingMs / 60000) * 83)}%`,
                    background: `linear-gradient(90deg, ${TEAL} 0%, #2dd4bf 50%, ${TEAL} 100%)`,
                    backgroundSize: '200% auto', animation: 'shimmer 2s linear infinite',
                    transition: 'width 3.5s ease-out',
                  }} />
                </div>
                <p style={{ fontSize: 12, color: theme.sub, margin: 0 }}>Usually 30–60 seconds — hang tight.</p>
              </div>

              <div style={{
                background: `linear-gradient(135deg, rgba(15,118,110,0.12) 0%, rgba(19,78,74,0.08) 100%)`,
                border: '1px solid rgba(15,118,110,0.25)', borderRadius: 20, padding: '24px 28px',
              }}>
                <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: TEAL }}>
                  While you wait
                </p>
                <p style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: theme.heading, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                  Join the free community while your report generates.
                </p>
                <p style={{ margin: '0 0 16px', fontSize: 14, color: theme.sub, lineHeight: 1.7 }}>
                  The{' '}
                  <a href="https://www.skool.com/aussiegradcareers" target="_blank" rel="noopener noreferrer" style={{ color: '#2dd4bf', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                    Aussie Grad Careers community
                  </a>
                  {' '}has the frameworks, templates, and live coaching calls that map directly to what's in your report.
                </p>
                <a
                  href="https://www.skool.com/aussiegradcareers" target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'inline-block', background: `linear-gradient(135deg, ${TEAL}, #134E4A)`,
                    color: 'white', borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 800,
                    textDecoration: 'none', boxShadow: `0 4px 16px rgba(15,118,110,0.28)`,
                  }}
                >
                  Join free on Skool →
                </a>
              </div>
            </div>
          )}

          {/* ── Stuck in processing ── */}
          {status === 'PROCESSING' && sections.length === 0 && processingMs >= 60000 && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ color: theme.sub, fontSize: 15, marginBottom: 8 }}>This is taking longer than expected.</p>
              <p style={{ color: theme.sub, fontSize: 13, marginBottom: 24 }}>Regenerating is safe and only takes a minute.</p>
              <button
                onClick={async () => { await api.post('/onboarding/retry'); setProcessingMs(0); refetch(); }}
                style={{ background: '#FCD34D', color: '#111827', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}
              >
                Regenerate report
              </button>
            </div>
          )}

          {/* ── API error ── */}
          {(isError || (!isLoading && !data)) && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ color: '#f87171', fontSize: 15, marginBottom: 8 }}>Couldn't load your report.</p>
              <p style={{ color: theme.sub, fontSize: 13, marginBottom: 24 }}>Your intake answers are saved — try regenerating.</p>
              <button
                onClick={async () => { await api.post('/onboarding/retry'); refetch(); }}
                style={{ background: '#FCD34D', color: '#111827', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}
              >
                Generate report
              </button>
            </div>
          )}

          {/* ── FAILED / unparseable ── */}
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

          {/* ── Section cards (always visible) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {cardSections.map((section, idx) => {
              const meta = SECTION_META[section.key];
              if (!meta) return null;
              const { problem, fix } = splitProblemFix(section.content);
              const intro = SECTION_INTROS[section.key] ?? '';
              const sectionNum = String(idx + 1).padStart(2, '0');

              return (
                <div key={section.key}>
                  <motion.div
                    className="print-card"
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ delay: 0, duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
                    whileHover={{ y: -2, transition: { duration: 0.2 } }}
                    style={{
                      background: theme.card,
                      borderRadius: 20,
                      border: `1px solid ${theme.cardBorder}`,
                      borderLeft: `4px solid ${meta.color}`,
                      backdropFilter: 'blur(24px)',
                      WebkitBackdropFilter: 'blur(24px)',
                      overflow: 'hidden',
                      boxShadow: meta.isCritical
                        ? `0 4px 24px ${meta.color}12`
                        : '0 2px 12px rgba(0,0,0,0.06)',
                      transition: 'box-shadow 0.2s',
                    }}
                  >
                    {/* Card header */}
                    <div style={{ padding: '22px 24px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 900, color: meta.color, opacity: 0.4, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {sectionNum}
                          </span>
                          <div>
                            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: theme.heading, letterSpacing: '-0.01em' }}>{meta.label}</p>
                            <p style={{ margin: '3px 0 0', fontSize: 12, color: theme.intro, lineHeight: 1.4 }}>{intro}</p>
                          </div>
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase',
                          color: meta.color, background: meta.bg,
                          borderRadius: 6, padding: '4px 9px', flexShrink: 0,
                          border: `1px solid ${meta.color}25`,
                          ...(meta.isCritical ? { animation: 'criticalPulse 3s ease-in-out infinite' } : {}),
                        }}>
                          {meta.severity}
                        </span>
                      </div>
                      <div style={{ height: 1, background: theme.divider, marginBottom: 18 }} />
                    </div>

                    {/* Problem content */}
                    <div style={{ padding: '0 24px', color: theme.body }}>
                      <RenderContent text={problem} color={meta.color} />
                    </div>

                    {/* Fix band */}
                    {fix && (
                      <div style={{
                        margin: '20px 0 0',
                        padding: '18px 24px 22px',
                        background: isDark ? `${meta.color}08` : meta.bg,
                        borderTop: `1px solid ${meta.color}20`,
                      }}>
                        <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.16em', textTransform: 'uppercase', color: meta.color, margin: '0 0 12px' }}>
                          {section.key === 'fix' ? 'Your 3-Step Plan' : 'Your Fix'}
                        </p>
                        <div style={{ color: theme.body }}>
                          <RenderContent text={fix} color={meta.color} />
                        </div>
                      </div>
                    )}
                  </motion.div>

                  {/* Social proof widget — appears after card 4 (honest truth) */}
                  {section.key === 'honest' && (
                    <div style={{ marginTop: 16 }}>
                      <SocialProofWidget isDark={isDark} theme={theme} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── CTA section ── */}
          {sections.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
              style={{ marginTop: 56 }}
            >
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e80' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#22c55e' }}>
                    Diagnosis complete
                  </span>
                </div>
                <h2 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 900, color: theme.heading, margin: '0 0 12px', lineHeight: 1.15, letterSpacing: '-0.025em' }}>
                  You now know exactly<br />what's holding you back.
                </h2>
                {whatJobHubSnippet ? (
                  <p style={{ fontSize: 15, color: theme.sub, lineHeight: 1.7, maxWidth: 480, margin: '0 auto 0' }}>
                    {whatJobHubSnippet.length > 220 ? whatJobHubSnippet.slice(0, 220).replace(/\s\S+$/, '…') : whatJobHubSnippet}
                  </p>
                ) : (
                  <p style={{ fontSize: 15, color: theme.sub, lineHeight: 1.7, maxWidth: 480, margin: '0 auto 0' }}>
                    Our AI platform addresses each of these blockers directly — resume optimisation,
                    application tracking, and interview prep built from your achievement bank.
                  </p>
                )}
              </div>

              {/* Urgency note */}
              <div style={{
                background: isDark ? 'rgba(251,191,36,0.06)' : 'rgba(254,243,199,0.85)',
                border: `1px solid ${isDark ? 'rgba(251,191,36,0.22)' : 'rgba(251,191,36,0.40)'}`,
                borderRadius: 12, padding: '13px 20px', marginBottom: 20, textAlign: 'center',
              }}>
                <p style={{ margin: 0, fontSize: 14, color: isDark ? '#fcd34d' : '#92400e', lineHeight: 1.65, fontWeight: 500 }}>
                  Every week you spend manually customising applications is a week Australians with local networks pull ahead.
                </p>
              </div>

              {/* Primary CTA */}
              <div ref={ctaRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <motion.button
                  onClick={onDone}
                  animate={{
                    boxShadow: [
                      `0 4px 18px ${INDIGO}35`,
                      `0 6px 32px ${INDIGO}60`,
                      `0 4px 18px ${INDIGO}35`,
                    ],
                  }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    width: '100%', background: `linear-gradient(135deg, ${INDIGO}, #4f46e5)`,
                    color: 'white', borderRadius: 14, padding: '16px 24px',
                    fontSize: 16, fontWeight: 800, border: 'none', cursor: 'pointer',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Rebuild Your Strategy with AI — Free for 7 Days →
                </motion.button>
                <p style={{ margin: 0, fontSize: 12, color: theme.sub, textAlign: 'center' }}>
                  No charge until day 8 · Cancel any time · No credit card upfront
                </p>
                <div style={{ textAlign: 'center' }}>
                  <a
                    href="https://www.skool.com/aussiegradcareers" target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 13, color: isDark ? '#2dd4bf' : TEAL, textDecoration: 'underline', textUnderlineOffset: 3, fontWeight: 600 }}
                  >
                    Or join the free community (Skool) — frameworks, templates & weekly guidance →
                  </a>
                </div>
              </div>

              {/* Referral section */}
              <div style={{
                background: theme.referralBg,
                border: `1px solid ${theme.referralBorder}`,
                borderRadius: 20, padding: '22px 24px', marginBottom: 20,
              }}>
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: isDark ? '#374151' : '#9ca3af', marginBottom: 6 }}>
                  Know someone in the same boat?
                </p>
                <p style={{ fontSize: 18, fontWeight: 800, color: theme.heading, margin: '0 0 5px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  Share this — they get a free diagnosis.
                </p>
                <p style={{ fontSize: 13, color: theme.sub, lineHeight: 1.6, margin: '0 0 14px' }}>
                  Every international grad you refer gets clarity on exactly what's holding their applications back.
                </p>
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                  border: `1px dashed ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
                  borderRadius: 10, padding: '11px 14px', marginBottom: 12,
                  fontSize: 13, color: theme.sub, lineHeight: 1.7, fontStyle: 'italic',
                }}>
                  "I just found this free tool that analyzed exactly why my applications weren't getting responses — takes 5 minutes and the report is genuinely useful —{' '}
                  <span style={{ color: isDark ? '#5eead4' : TEAL, fontStyle: 'normal', fontWeight: 600 }}>{referralLink}</span>"
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
                        background: copied
                          ? (isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.10)')
                          : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                        border: `1px solid ${copied ? 'rgba(34,197,94,0.30)' : (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)')}`,
                        borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700,
                        color: copied ? '#22c55e' : theme.sub,
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
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={onDone}
                  style={{ background: 'none', border: 'none', color: isDark ? '#374151' : '#9ca3af', fontWeight: 500, cursor: 'pointer', fontSize: 13 }}
                >
                  Already have an account? Go to the dashboard →
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
            className="no-print"
            initial={{ y: 88, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 88, opacity: 0 }}
            transition={{ ease: [0.25, 1, 0.5, 1], duration: 0.3 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
              background: theme.stickyBg, borderTop: `1px solid ${theme.stickyBorder}`,
              boxShadow: '0 -8px 32px rgba(0,0,0,0.16)',
              padding: '12px 24px 16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.heading, textAlign: 'center' }}>
              {stickyHeadline}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <a
                href="https://www.skool.com/aussiegradcareers" target="_blank" rel="noopener noreferrer"
                style={{
                  background: isDark ? `rgba(15,118,110,0.12)` : `rgba(15,118,110,0.09)`,
                  border: '1px solid rgba(15,118,110,0.30)',
                  color: isDark ? '#34d399' : TEAL, borderRadius: 10,
                  padding: '10px 18px', fontSize: 13, fontWeight: 700,
                  textDecoration: 'none', whiteSpace: 'nowrap', minHeight: 44,
                  display: 'inline-flex', alignItems: 'center',
                }}
              >
                Free frameworks & weekly guidance (Skool)
              </a>
              <button
                onClick={onDone}
                style={{
                  background: `linear-gradient(135deg, ${INDIGO}, #4f46e5)`, color: 'white',
                  borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 800,
                  border: 'none', cursor: 'pointer', boxShadow: `0 4px 12px ${INDIGO}28`,
                  whiteSpace: 'nowrap', minHeight: 44,
                }}
              >
                Rebuild your strategy with AI (7-Day Free Trial)
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
