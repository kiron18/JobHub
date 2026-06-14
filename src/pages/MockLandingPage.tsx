/* ────────────────────────────────────────────────────────────────────────────
   MockLandingPage — outcome-first / low-friction rework (2026-06-02)
   Route: /mock-landing  (non-destructive; live landing untouched)

   Implements the agreed direction:
   - Outcome-first hero with live CV scan panel in the right column
   - "diagnostic" language killed → "scan your CV for gaps"
   - Founder trust block with real photo, name corrected to Kiron
   - 3 features with BUILT mini product-UIs (no gray placeholder boxes)
   - Real conditions section (the activation mechanic behind the guarantee)
   - Low-friction inline CV scan: resume + ONE pill, email deferred to after value
   - Testimonials trimmed to the 5 genuine ones
   Mock notes:
   - Brand wordmark = "Aussie Grad Careers" per the latest doc.
   - Product previews are built UI mockups, not real screenshots.
   ──────────────────────────────────────────────────────────────────────────── */
import { useState, useRef, useEffect, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanReveal } from '../components/landing/ScanReveal';
import { ScanChamber } from '../components/landing/ScanChamber';
import { GetStartedModal } from './GetStartedModal';
import type { ReactNode } from 'react';
import { motion, useInView, animate, AnimatePresence } from 'framer-motion';
import {
  FileSearch, FileText, Sparkles, Linkedin, Check, ArrowRight, Upload,
  ShieldCheck, Quote,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { colors, type as typeTokens } from '../components/landing/tokens';

const EASE = [0.25, 1, 0.5, 1] as const;

// ── Types ────────────────────────────────────────────────────────────────────

interface CvGapItem {
  severity: 'critical' | 'warning' | 'good';
  text: string;
  evidence?: string;
}

interface QuickWin {
  heading: string;
  description: string;
}

interface HiringManager {
  name: string;
  archetype: string;
  view: string;
}

interface CulturalTranslation {
  wrote: string;
  reads: string;
  instead: string;
}

interface CvGapResult {
  scanId: string;
  score: number;
  firstImpression?: string;
  inferredRole: string;
  firstName: string;
  fullName: string;
  reassurance?: string;
  hiringManager?: HiringManager;
  culturalTranslations?: CulturalTranslation[];
  items: CvGapItem[];
  quickWins: QuickWin[];
  lockedGapCount: number;
}

interface RoadmapStep {
  rank: number;
  title: string;
  why: string;
}

// ── tiny helpers ──────────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <span style={{
        fontFamily: typeTokens.body, fontSize: '0.75rem', fontWeight: 600,
        letterSpacing: '0.18em', textTransform: 'uppercase', color: colors.textMuted,
        display: 'block',
      }}>{children}</span>
      <div style={{ width: 24, height: 1, background: colors.accentGoldSoft, marginTop: 4 }} />
    </div>
  );
}

function CTA({ label, onClick, small, disabled }: { label: string; onClick: () => void; small?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? colors.borderDefined : colors.accentPetrol,
        color: disabled ? colors.textMuted : colors.textOnDeep,
        padding: small ? '12px 24px' : '15px 30px', borderRadius: 10, border: 'none',
        fontWeight: 600, fontSize: small ? '0.875rem' : '1rem', fontFamily: typeTokens.body,
        letterSpacing: '-0.005em', cursor: disabled ? 'not-allowed' : 'pointer',
        lineHeight: 1, whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        boxShadow: disabled ? 'none' : '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)',
        transition: 'transform 180ms cubic-bezier(0.25,1,0.5,1), box-shadow 180ms cubic-bezier(0.25,1,0.5,1)',
      }}
      onMouseEnter={e => {
        if (disabled) return;
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(26,24,20,0.06), 0 8px 24px rgba(45,90,110,0.22)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = disabled ? 'none' : '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)';
      }}
    >
      {label} <ArrowRight size={small ? 15 : 17} strokeWidth={2.2} />
    </button>
  );
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 14 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >{children}</motion.div>
  );
}

const display = (extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: typeTokens.display, fontWeight: 500, color: colors.textPrimary,
  fontVariationSettings: "'SOFT' 50, 'WONK' 1", letterSpacing: '-0.015em', ...extra,
});

// Reusable animated reveal wrapper. MUST live at module scope — defining it inside
// a component gives it a new identity on every render, which remounts its subtree
// and steals focus from any input inside it on each keystroke.
function SlideIn({ show, children, delay = 0 }: { show: boolean; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={show ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay, ease: EASE }}
    >{children}</motion.div>
  );
}

// ── Error boundary — prevents one crash from blanking the whole scan panel ──

class PanelErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ fontFamily: typeTokens.body, fontSize: 13, color: '#C2603F', margin: '0 0 12px' }}>Something went wrong rendering the results.</p>
          <button onClick={() => this.setState({ hasError: false })} style={{
            fontFamily: typeTokens.body, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: 'none', border: 'none', color: colors.accentPetrol, textDecoration: 'underline', padding: 0,
          }}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Live "AI reading your CV" scanning state ─────────────────────────────────
// Skeleton of the report with a sweeping scan-line + cycling status — sells that
// real work is happening on THEIR CV, instead of a generic spinner.

function ScanningState() {
  const phrases = [
    'Reading your experience…',
    'Checking how recruiters read it…',
    'Comparing against live Australian job ads…',
    'Spotting the gaps costing you callbacks…',
    'Writing your verdict…',
  ];
  const [idx, setIdx] = useState(0);
  // Thin progress bar: runs 0 → ~92% over ~120s so the user always sees
  // forward motion even when LlamaParse takes the full minute. Never hits
  // 100% — that waits for the server response.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setProgress(p => Math.min(p + 0.25, 92)), 300);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Dwell long enough that each line reads like a real step finishing, not a
    // flicker. ~2.4s per phrase; advance but hold on the last so it never loops
    // back distractingly while a slower scan finishes.
    const t = setInterval(() => setIdx(i => Math.min(i + 1, phrases.length - 1)), 2400);
    return () => clearInterval(t);
  }, []);

  const shimmerBar = (w: string) => (
    <div style={{ height: 11, borderRadius: 6, width: w, background: colors.bgAlt, position: 'relative', overflow: 'hidden' }}>
      <motion.div
        style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(45,90,110,0.12), transparent)' }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.3, ease: 'linear', repeat: Infinity }}
      />
    </div>
  );

  return (
    <div>
      <span style={{ fontFamily: typeTokens.body, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMuted }}>Scanning your CV…</span>
      {/* Thin progress bar — sits just below the eyebrow, gives the user a
          real-time sense that time is finite and moving. */}
      <div style={{ position: 'relative', marginTop: 12, height: 3, borderRadius: 2, background: colors.bgAlt, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', borderRadius: 2, background: colors.accentPetrol, transformOrigin: 'left' }}
          animate={{ scaleX: progress / 100 }}
          transition={{ duration: 0.3, ease: 'linear' }}
        />
      </div>
      <div style={{ position: 'relative', marginTop: 14, padding: 16, border: `1px solid ${colors.borderWhisper}`, borderRadius: 14, background: colors.bgSurface, overflow: 'hidden' }}>
        {/* faint scan sheen — single slow downward drift that fades in and out (no bobbing) */}
        <motion.div
          style={{ position: 'absolute', left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, rgba(45,90,110,0.4), transparent)`, zIndex: 2 }}
          initial={{ top: '0%', opacity: 0 }}
          animate={{ top: ['0%', '100%'], opacity: [0, 0.45, 0] }}
          transition={{ duration: 3.6, ease: 'linear', repeat: Infinity }}
        />
        {/* skeleton header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          {shimmerBar('45%')}
          <div style={{ width: 34, height: 34, borderRadius: '50%', border: `3px solid ${colors.bgAlt}`, flexShrink: 0 }} />
        </div>
        {/* skeleton rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {['90%', '78%', '85%', '62%'].map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: colors.bgAlt, flexShrink: 0 }} />
              {shimmerBar(w)}
            </div>
          ))}
        </div>
      </div>
      <p style={{ fontFamily: typeTokens.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 14, minHeight: 18 }}>
        <AnimatePresence mode="wait">
          <motion.span key={idx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3, ease: EASE }} style={{ display: 'inline-block' }}>
            {phrases[idx]}
          </motion.span>
        </AnimatePresence>
      </p>
    </div>
  );
}

// ── Score ring with count-up — the number ticks 0 → score, ring fills with it ──

function ScoreRing({ score }: { score: number }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const controls = animate(0, score, { duration: 1.1, ease: EASE, onUpdate: v => setPct(v) });
    return () => controls.stop();
  }, [score]);
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: `conic-gradient(${colors.accentPetrol} 0 ${pct}%, ${colors.bgAlt} ${pct}% 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: colors.bgSurface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: typeTokens.display, fontSize: 11, fontWeight: 600, color: colors.textPrimary }}>{Math.round(pct)}</div>
    </div>
  );
}

// ── Scan panel (lives in hero, also standalone for reuse) ─────────────────────

const PILLS = [
  { v: 'silence', label: 'Mostly silence' },
  { v: 'rejections', label: 'Mostly rejections' },
  { v: 'stall', label: 'Interviews that stall' },
  { v: 'no_offers', label: 'Interviews, no offers' },
  { v: 'mix', label: 'A mix' },
];

function ScanPanel({ onResult, onInteract }: { onResult?: (result: CvGapResult, pill: string | null) => void; onInteract?: () => void }) {
  const [pill, setPill] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<CvGapResult | null>(null);
  const [revealStep, setRevealStep] = useState<'gaps' | 'wins' | 'big_reveal' | 'email'>('gaps');
  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [roadmap, setRoadmap] = useState<RoadmapStep[] | null>(null);
  const [roadmapError, setRoadmapError] = useState<string | null>(null);
  const [showGetStarted, setShowGetStarted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // End-of-roadmap funnel: open the GetStartedModal so the user creates an
  // account and lands on /jobs with matches ready.
  const handleEnterDashboard = () => {
    setShowGetStarted(true);
  };

  // Auto-advance through reveal steps on a timer
  useEffect(() => {
    if (status !== 'done' || !result) return;
    if (revealStep === 'gaps') {
      const t = setTimeout(() => setRevealStep('wins'), 1200);
      return () => clearTimeout(t);
    }
    if (revealStep === 'wins') {
      const t = setTimeout(() => setRevealStep('big_reveal'), 2000);
      return () => clearTimeout(t);
    }
    if (revealStep === 'big_reveal') {
      const t = setTimeout(() => setRevealStep('email'), 1800);
      return () => clearTimeout(t);
    }
  }, [status, result, revealStep]);

  // Reset reveal step when we get a new result
  useEffect(() => {
    if (status === 'done') setRevealStep('gaps');
  }, [status]);

  const severityColor = (sev: string): string => {
    if (sev === 'critical') return '#C2603F';
    if (sev === 'warning') return '#C5A059';
    return colors.success;
  };

  const handleScan = async () => {
    if (!file) {
      inputRef.current?.click();
      return;
    }
    setStatus('scanning');
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await api.post('/cv-scan', formData, {
        // LlamaParse extraction (~30-60s) + the LLM gap scan (~10-40s) routinely
        // run past 30s. Inherit the 120s global default instead of aborting early.
        timeout: 120000,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      setStatus('done');
      onResult?.(res.data, pill);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Scan failed, please try again.';
      toast.error(msg);
      setStatus('error');
    }
  };

  const handleRetry = () => {
    setStatus('idle');
    setResult(null);
    setFile(null);
    setPill(null);
    setRevealStep('gaps');
    setEmail('');
    setRoadmap(null);
    setRoadmapError(null);
  };

  const handleEmailSubmit = async () => {
    if (!result?.scanId || !email) return;
    setEmailLoading(true);
    setRoadmapError(null);
    try {
      const res = await api.post('/cv-scan/lead', { scanId: result.scanId, email }, { timeout: 120000 });
      setRoadmap(res.data.roadmap);
      toast.success('Roadmap also sent to your inbox');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Could not build your roadmap, please try again.';
      setRoadmapError(msg);
      toast.error(msg);
    } finally {
      setEmailLoading(false);
    }
  };

  // Legacy inline reveal — superseded by <ScanReveal/>. Typed-false flag keeps it
  // compiling (preserves null-narrowing) until the dead block is removed post-verify.
  const SHOW_LEGACY_REVEAL = false as boolean;

  return (
    <div
      onPointerDown={() => onInteract?.()}
      style={{
      background: colors.bgSurface, border: `1px solid ${colors.borderWhisper}`,
      borderRadius: 20, padding: 24, textAlign: 'left',
      boxShadow: '0 1px 3px rgba(26,24,20,0.04), 0 12px 36px rgba(26,24,20,0.07)',
    }}>
      {status === 'scanning' && <ScanChamber />}

      {status === 'done' && result && (
        <ScanReveal
          result={result}
          email={email}
          setEmail={setEmail}
          emailLoading={emailLoading}
          onEmailSubmit={handleEmailSubmit}
          roadmap={roadmap}
          roadmapError={roadmapError}
          onRetry={handleRetry}
          onClose={handleRetry}
          onEnterDashboard={handleEnterDashboard}
        />
      )}
      {showGetStarted && result && (
        <GetStartedModal
          scanId={result.scanId}
          firstName={result.firstName}
          email={email}
          onClose={() => setShowGetStarted(false)}
        />
      )}
      {SHOW_LEGACY_REVEAL && status === 'done' && result && (
        <PanelErrorBoundary>
        <>
          {/* ── Score card (always visible) ── */}
          <div style={{
            background: colors.bgSurface, border: `1px solid ${colors.borderWhisper}`,
            borderRadius: 16, padding: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontFamily: typeTokens.body, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMuted }}>{result.firstName ? `${result.firstName}, here's where your resume is letting you down` : "Here's where your resume is letting you down"}</span>
              <ScoreRing score={result.score} />
            </div>
            {result.inferredRole && (
              <div style={{ fontFamily: typeTokens.body, fontSize: 11, color: colors.textMuted, marginBottom: 14, fontStyle: 'italic' }}>
                Scanned as: {result.inferredRole}
              </div>
            )}
            {result.firstName && (
              <p style={{ fontFamily: typeTokens.body, fontSize: 12, color: colors.textMuted, margin: '0 0 12px', lineHeight: 1.4 }}>
                {result.firstName}, these are the fixes that'll get you seen.
              </p>
            )}

            {/* ── 1. Pain points (gaps) — stagger in like the AI is writing them live ── */}
            <motion.div
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } } }}
              initial="hidden"
              animate="show"
            >
              {result.items.map((g, i) => (
                <motion.div
                  key={i}
                  variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
                  transition={{ duration: 0.4, ease: EASE }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
                >
                  <motion.span
                    variants={{ hidden: { scale: 0 }, show: { scale: 1 } }}
                    transition={{ duration: 0.3, ease: EASE }}
                    style={{ width: 7, height: 7, borderRadius: '50%', background: severityColor(g.severity), marginTop: 5, flexShrink: 0 }}
                  />
                  <span style={{ fontFamily: typeTokens.body, fontSize: 13, lineHeight: 1.45, color: colors.textSecondary }}>{g.text}</span>
                </motion.div>
              ))}
            </motion.div>

            {pill && (
              <SlideIn show={true} delay={0.1}>
                <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(197,160,89,0.08)', borderRadius: 10, border: '1px solid rgba(197,160,89,0.2)' }}>
                  <span style={{ fontFamily: typeTokens.body, fontSize: 12, fontWeight: 600, color: '#C5A059' }}>You reported: {PILLS.find(p => p.v === pill)?.label}</span>
                  <p style={{ fontFamily: typeTokens.body, fontSize: 12, color: colors.textMuted, margin: '4px 0 0', lineHeight: 1.4 }}>
                    {pill === 'silence' && 'Your scan reflects that no response at all means your application likely isnt getting past the ATS filter.'}
                    {pill === 'rejections' && 'Rejections suggest the recruiter spot gaps before they reach the interview stage.'}
                    {pill === 'stall' && 'Interviews that stall often means strong recent experience but gaps in how you frame your earlier roles.'}
                    {pill === 'no_offers' && 'If interviews are not converting, the issue might be how your resume positions you against the job requirements.'}
                    {pill === 'mix' && 'A mixed response pattern means targeted fixes across multiple areas could move the needle.'}
                  </p>
                </div>
              </SlideIn>
            )}
          </div>

          {/* ── 2. Quick wins ── */}
          <SlideIn show={revealStep === 'wins' || revealStep === 'big_reveal' || revealStep === 'email'}>
            {revealStep !== 'gaps' && (
              <div style={{ marginTop: 18, padding: 16, background: 'rgba(42,157,111,0.06)', borderRadius: 14, border: '1px solid rgba(42,157,111,0.18)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Sparkles size={16} color={colors.success} strokeWidth={2} />
                  <span style={{ fontFamily: typeTokens.body, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.success }}>2 quick wins you can do right now</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(result.quickWins || []).map((w, i) => (
                    <div key={i} style={{
                      background: colors.bgSurface, borderRadius: 10, padding: '12px 14px',
                      border: '1px solid rgba(42,157,111,0.12)',
                    }}>
                      <span style={{ fontFamily: typeTokens.body, fontSize: 12, fontWeight: 700, color: colors.textPrimary }}>{w.heading}</span>
                      <p style={{ fontFamily: typeTokens.body, fontSize: 12, color: colors.textSecondary, margin: '4px 0 0', lineHeight: 1.45 }}>{w.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SlideIn>

          {/* ── 3. Big reveal ── */}
          <SlideIn show={revealStep === 'big_reveal' || revealStep === 'email'}>
            {revealStep !== 'gaps' && revealStep !== 'wins' && (
              <motion.div
                initial={{ scale: 0.96 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, ease: EASE }}
                style={{
                  marginTop: 18, padding: 14, background: 'rgba(197,160,89,0.06)',
                  borderRadius: 12, border: '1px solid rgba(197,160,89,0.2)',
                }}>
                <p style={{ fontFamily: typeTokens.body, fontSize: 13, lineHeight: 1.55, color: colors.textPrimary, margin: 0 }}>
                  <strong>These 2 fixes will help, but there are 7 other gaps</strong> that take most internationals 6+ months to figure out on their own.
                </p>
              </motion.div>
            )}
          </SlideIn>

          {/* ── 4. Email capture + roadmap ── */}
          <SlideIn show={revealStep === 'email'}>
            {revealStep === 'email' && !roadmap && (
              <div style={{ marginTop: 18, padding: '14px 0 0', borderTop: `1px solid ${colors.borderWhisper}`, textAlign: 'center' }}>
                <p style={{ fontFamily: typeTokens.body, fontSize: 13, color: colors.textSecondary, margin: '0 0 8px' }}>
                  Get the <strong style={{ color: colors.accentPetrol }}>complete roadmap to fix all 9 issues</strong> (plus the Australian hiring secrets recruiters do not tell you)
                </p>
                <div style={{ display: 'flex', gap: 8, maxWidth: 400, margin: '0 auto' }}>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email"
                    style={{
                      flex: 1, fontFamily: typeTokens.body, fontSize: 13, padding: '11px 14px', borderRadius: 10,
                      border: `1px solid ${colors.borderDefined}`, background: colors.bgAlt, color: colors.textPrimary,
                      outline: 'none',
                    }} />
                  <motion.button onClick={handleEmailSubmit} disabled={emailLoading || !email}
                    initial={{ boxShadow: '0 0 0 0 rgba(45,90,110,0)' }}
                    animate={emailLoading || !email ? {} : { boxShadow: ['0 0 0 0 rgba(45,90,110,0)', '0 0 0 6px rgba(45,90,110,0.12)', '0 0 0 0 rgba(45,90,110,0)'] }}
                    transition={{ duration: 1.6, ease: EASE, repeat: Infinity, repeatDelay: 1.2 }}
                    style={{
                      fontFamily: typeTokens.body, fontSize: 12, fontWeight: 700, cursor: emailLoading || !email ? 'not-allowed' : 'pointer',
                      padding: '11px 18px', borderRadius: 10, border: 'none', whiteSpace: 'nowrap',
                      background: emailLoading || !email ? colors.borderDefined : colors.accentPetrol,
                      color: emailLoading || !email ? colors.textMuted : colors.textOnDeep,
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                    {emailLoading ? 'Building...' : 'Unlock my roadmap →'}
                  </motion.button>
                </div>
                {roadmapError && (
                  <p style={{ fontFamily: typeTokens.body, fontSize: 11, color: '#C2603F', margin: '8px 0 0' }}>{roadmapError}</p>
                )}
                <p style={{ fontFamily: typeTokens.body, fontSize: 10.5, color: colors.textMuted, margin: '8px 0 0' }}>
                  We will email your roadmap and job-search tips. No spam, unsubscribe anytime.{' '}
                  <a href="/legal/privacy" target="_blank" style={{ color: colors.accentPetrol }}>Privacy</a>
                </p>
                <div style={{ marginTop: 12 }}>
                  <button onClick={handleRetry}
                    style={{
                      fontFamily: typeTokens.body, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      background: 'none', border: 'none', color: colors.accentPetrol, textDecoration: 'underline', padding: 0,
                    }}>
                    Scan a different CV
                  </button>
                </div>
              </div>
            )}
            {roadmap && (
              <div style={{ marginTop: 18, padding: 16, background: 'rgba(45,90,110,0.05)', borderRadius: 14, border: '1px solid rgba(45,90,110,0.14)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <FileSearch size={16} color={colors.accentPetrol} strokeWidth={2} />
                  <span style={{ fontFamily: typeTokens.body, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.accentPetrol }}>Your 7-step roadmap</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {roadmap.map((s) => (
                    <div key={s.rank} style={{
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                      background: colors.bgSurface, borderRadius: 10, padding: '12px 14px',
                      border: `1px solid ${colors.borderWhisper}`,
                    }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%', background: colors.accentPetrol,
                        color: colors.textOnDeep, fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        marginTop: 1,
                      }}>{s.rank}</span>
                      <div>
                        <span style={{ fontFamily: typeTokens.body, fontSize: 12, fontWeight: 700, color: colors.textPrimary }}>{s.title}</span>
                        <p style={{ fontFamily: typeTokens.body, fontSize: 11.5, color: colors.textSecondary, margin: '3px 0 0', lineHeight: 1.4 }}>{s.why}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14 }}>
                  <button onClick={handleRetry}
                    style={{
                      fontFamily: typeTokens.body, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      background: 'none', border: 'none', color: colors.accentPetrol, textDecoration: 'underline', padding: 0,
                    }}>
                    Scan a different CV
                  </button>
                </div>
              </div>
            )}
          </SlideIn>
        </>
        </PanelErrorBoundary>
      )}

      {status === 'error' && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ fontFamily: typeTokens.body, fontSize: 14, color: '#C2603F', margin: '0 0 16px' }}>Scan failed. Please try again.</p>
          <CTA label="Try again" onClick={handleRetry} small />
        </div>
      )}

      {status === 'idle' && (
        <>
          <span style={{ fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.textMuted }}>Your resume</span>
          <div
            onClick={() => inputRef.current?.click()}
            style={{
              marginTop: 8, border: `2px dashed ${file ? colors.accentPetrol + '66' : colors.borderDefined}`,
              borderRadius: 14, padding: '20px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
              background: file ? 'rgba(45,90,110,0.05)' : colors.bgAlt, transition: 'all 0.2s',
            }}>
            <input ref={inputRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={e => { setFile(e.target.files?.[0] ?? null); setStatus('idle'); }} />
            <Upload size={20} color={file ? colors.accentPetrol : colors.textMuted} />
            <div>
              <p style={{ fontFamily: typeTokens.body, fontSize: 14, fontWeight: 600, color: file ? colors.textPrimary : colors.textSecondary, margin: 0 }}>{file ? file.name : 'Drop your CV or click to upload'}</p>
              <p style={{ fontFamily: typeTokens.body, fontSize: 12, color: colors.textMuted, margin: '2px 0 0' }}>PDF or Word. Everything else we infer for you.</p>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <span style={{ fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.textMuted }}>What are you getting back? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional. sharpens the scan)</span></span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {PILLS.map(p => {
                const active = pill === p.v;
                return (
                  <button key={p.v} onClick={() => setPill(active ? null : p.v)}
                    style={{
                      fontFamily: typeTokens.body, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                      padding: '7px 13px', borderRadius: 99,
                      border: `1px solid ${active ? colors.accentPetrol : colors.borderDefined}`,
                      background: active ? 'rgba(45,90,110,0.08)' : colors.bgSurface,
                      color: active ? colors.accentPetrol : colors.textSecondary, transition: 'all 0.15s',
                    }}>{p.label}</button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <CTA label={file ? 'Scan my CV for gaps' : 'Show me the gaps in my CV'} onClick={handleScan} />
          </div>
        </>
      )}
    </div>
  );
}

// ── BUILT product previews ────────────────────────────────────────────────────

// ── Step 2 demo: job description → generate → three tailored docs, on a loop ──
// A "camera" pans/zooms across a world of cards. Snappy beats, focal words popped
// while context stays legible in the periphery. Loops only while in view.

const GEN_PHASES = ['intro', 'generate', 'branch', 'doc0', 'doc1', 'doc2', 'outcome', 'loopzoom'] as const;
type GenPhase = typeof GEN_PHASES[number];

// Dwell per beat (ms) — reading-time-guided, kept tight.
const GEN_MS: Record<GenPhase, number> = {
  intro: 1080, generate: 810, branch: 1000, doc0: 1890, doc1: 1890, doc2: 1890, outcome: 1710, loopzoom: 630,
};

const GEN_DOCS = [
  {
    key: 'doc0' as const, title: 'Resume', fy: 0.17,
    lines: ['Sped up monthly reporting from 8 days to 5', 'Found $120k of misspent budget in my first quarter', 'Reconciled 12 cost centres with zero errors'],
    labels: ['ATS-friendly', 'Australian English', '7/7 keywords matched'],
  },
  {
    key: 'doc1' as const, title: 'Cover letter', fy: 0.5,
    lines: ['Dear Hiring Manager,', 'I sped up monthly reporting from 8 days to 5', 'I’d bring that same rigour to your finance team.'],
    labels: ['Tailored to this role', 'Hiring-manager tone', 'Australian English'],
  },
  {
    key: 'doc2' as const, title: 'Selection criteria', fy: 0.83,
    lines: ['Attention to detail — ✓ 7/7', 'Works to deadlines — ✓ 5/5', 'STAR examples, evidence-backed'],
    labels: ['STAR structure', 'Every criterion addressed', 'Gov-ready'],
  },
];

// Camera transform per phase. transformOrigin is 0,0 so: screen = translate + scale·point.
// To centre a world point (fx,fy) at scale s: x = (0.5 − s·fx), y = (0.5 − s·fy) (as % of stage).
const genFocus = (fx: number, fy: number, s: number) => ({ scale: s, x: `${(0.5 - s * fx) * 100}%`, y: `${(0.5 - s * fy) * 100}%` });
const GEN_CAMERA: Record<GenPhase, { scale: number; x: string; y: string }> = {
  intro: { scale: 1, x: '0%', y: '0%' },
  generate: { scale: 1, x: '0%', y: '0%' },
  branch: { scale: 1, x: '0%', y: '0%' },
  doc0: genFocus(0.74, 0.17, 2.05),
  doc1: genFocus(0.74, 0.5, 2.05),
  doc2: genFocus(0.74, 0.83, 2.05),
  outcome: { scale: 1, x: '0%', y: '0%' },
  loopzoom: genFocus(0.24, 0.5, 1.9),
};

const CAM_EASE = [0.65, 0, 0.35, 1] as const; // ease-in-out for camera moves

// Types the doc's lines on screen when its card is on main stage; shows full text otherwise.
function Typewriter({ lines, play, speed = 13 }: { lines: string[]; play: boolean; speed?: number }) {
  const full = lines.join('\n');
  const [n, setN] = useState(play ? 0 : full.length);
  useEffect(() => {
    if (!play) { setN(full.length); return; }
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= full.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [play, full, speed]);
  const rows = full.slice(0, n).split('\n');
  return (
    <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 38 }}>
      {rows.map((ln, j) => (
        <span key={j} style={{ fontFamily: typeTokens.body, fontSize: 8.5, lineHeight: 1.35, color: colors.textSecondary }}>
          {ln}
          {play && n < full.length && j === rows.length - 1 && <span style={{ color: colors.accentPetrol }}>▍</span>}
        </span>
      ))}
    </div>
  );
}

function GeneratorPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [reduce] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  );
  const [phase, setPhase] = useState<GenPhase>(reduce ? 'outcome' : 'intro');
  const [loopKey, setLoopKey] = useState(0);

  // Phase machine — advances only while in view; freezes off-screen, static when reduced-motion.
  useEffect(() => {
    if (!inView || reduce) return;
    const t = setTimeout(() => {
      const i = GEN_PHASES.indexOf(phase);
      if (i >= GEN_PHASES.length - 1) { setLoopKey(k => k + 1); setPhase('intro'); }
      else setPhase(GEN_PHASES[i + 1]);
    }, GEN_MS[phase]);
    return () => clearTimeout(t);
  }, [phase, inView, reduce]);

  const idx = GEN_PHASES.indexOf(phase);
  const docsShown = reduce || idx >= GEN_PHASES.indexOf('branch');
  const showLines = phase === 'branch' || phase === 'outcome';
  const jobBig = phase === 'intro' || phase === 'generate';

  return (
    <div ref={ref} style={{
      position: 'relative', width: '100%', maxWidth: 460, height: 410, margin: '0 auto',
      background: colors.bgSurface, border: `1px solid ${colors.borderWhisper}`, borderRadius: 16,
      overflow: 'hidden', boxShadow: '0 1px 3px rgba(26,24,20,0.04), 0 12px 36px rgba(26,24,20,0.07)',
    }}>
      {/* ── Camera: pans/zooms the whole world ── */}
      <motion.div
        style={{ position: 'absolute', inset: 0, transformOrigin: '0 0' }}
        animate={GEN_CAMERA[phase]}
        transition={{ duration: 0.63, ease: CAM_EASE }}
      >
        {/* n8n connectors — behind the cards, pinned to the world, fade out during zoom */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
          {GEN_DOCS.map((d, i) => (
            <motion.path key={d.key}
              d={`M44,50 C 48,50 48,${d.fy * 100} 52,${d.fy * 100}`}
              fill="none" stroke={colors.accentPetrol} strokeWidth={1} strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              animate={{ opacity: showLines ? 0.4 : 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: showLines ? 0.45 + i * 0.08 : 0 }}
            />
          ))}
        </svg>

        {/* Job description card (centre+large → minimises left) */}
        <motion.div
          style={{ position: 'absolute', top: 0, bottom: 0, display: 'flex', alignItems: 'center' }}
          animate={jobBig ? { left: '15%', width: '70%' } : { left: '4%', width: '40%' }}
          transition={{ duration: 0.5, ease: CAM_EASE }}
        >
          <div style={{ width: '100%', background: colors.bgSurface, border: `1px solid ${colors.borderWhisper}`, borderRadius: 12, padding: 12, boxShadow: '0 6px 18px rgba(26,24,20,0.08)' }}>
            <p style={display({ fontSize: 13, margin: 0 })}>Job Description</p>
            <p style={{ fontFamily: typeTokens.body, fontSize: 9.5, color: colors.textMuted, margin: '1px 0 0' }}>KPMG · Melbourne</p>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['Month-end close & reconciliations', 'Stakeholder reporting'].map(r => (
                <div key={r} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: colors.accentGold, flexShrink: 0 }} />
                  <span style={{ fontFamily: typeTokens.body, fontSize: 9, color: colors.textSecondary }}>{r}</span>
                </div>
              ))}
            </div>
            <div style={{ position: 'relative', marginTop: 10 }}>
              <motion.div
                animate={phase === 'generate' ? { scale: [1, 0.95, 1] } : { scale: 1 }}
                transition={{ duration: 0.4, ease: EASE }}
                style={{ background: colors.accentPetrol, color: colors.textOnDeep, borderRadius: 8, padding: '7px 10px', textAlign: 'center', fontFamily: typeTokens.body, fontSize: 10, fontWeight: 700, letterSpacing: '-0.005em' }}
              >
                Generate documents →
              </motion.div>
              {jobBig && (
                <motion.div
                  initial={{ opacity: 0, x: 24, y: 16 }}
                  animate={phase === 'generate' ? { opacity: 1, x: 4, y: 2 } : { opacity: 0.85, x: 16, y: 11 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  style={{ position: 'absolute', right: 10, bottom: -8, pointerEvents: 'none' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={colors.textPrimary} stroke={colors.bgSurface} strokeWidth="1.5">
                    <path d="M4 2 L20 12 L13 13 L17 21 L13 22 L9 14 L4 18 Z" />
                  </svg>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Document cards */}
        {GEN_DOCS.map((d, i) => {
          const filled = reduce || phase === 'outcome' || idx >= GEN_PHASES.indexOf(d.key);
          const active = phase === d.key;
          return (
            <motion.div
              key={d.key}
              style={{ position: 'absolute', left: '52%', width: '44%', top: `${[2, 35, 68][i]}%`, height: '31%' }}
              animate={docsShown ? { opacity: 1, x: 0 } : { opacity: 0, x: 24 }}
              transition={{ duration: 0.45, ease: EASE, delay: docsShown ? 0.42 + i * 0.12 : 0 }}
            >
              <div style={{
                height: '100%', background: colors.bgSurface, borderRadius: 10, padding: '8px 10px', overflow: 'hidden',
                border: `1px solid ${active ? colors.accentPetrol + '88' : colors.borderWhisper}`,
                boxShadow: active ? '0 8px 22px rgba(45,90,110,0.16)' : '0 4px 12px rgba(26,24,20,0.05)',
              }}>
                <motion.span
                  animate={{ scale: active ? 1.05 : 1 }} transition={{ duration: 0.4, ease: EASE }}
                  style={{ display: 'block', transformOrigin: 'left center', fontFamily: typeTokens.body, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: active ? colors.accentPetrol : colors.textMuted }}
                >{d.title}</motion.span>

                {/* Body: crisp + writing-in while focused, blurred texture once the camera moves on */}
                {filled && (
                  <motion.div
                    animate={{ filter: active ? 'blur(0px)' : 'blur(2px)', opacity: active ? 1 : 0.4 }}
                    transition={{ duration: 0.4, ease: EASE }}
                  >
                    <Typewriter key={`${d.key}-tw-${loopKey}`} lines={d.lines} play={active} />
                    <motion.div
                      key={`${d.key}-labels-${loopKey}`}
                      style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}
                      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 1.4 } } }}
                      initial="hidden" animate="show"
                    >
                      {d.labels.map(lb => (
                        <motion.span key={lb}
                          variants={{ hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1 } }}
                          transition={{ duration: 0.25, ease: EASE }}
                          style={{ fontFamily: typeTokens.body, fontSize: 6, fontWeight: 600, color: colors.success, background: 'rgba(42,157,111,0.12)', padding: '2px 5px', borderRadius: 99 }}
                        >✓ {lb}</motion.span>
                      ))}
                    </motion.div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

    </div>
  );
}

// ── Step 3 demo: the LinkedIn glow-up — amateur → optimised, on a loop ──

const LI_PEOPLE = [
  {
    name: 'Arjun Mehta',
    beforeImg: '/Assets/li-before-male.png', beforePos: 'center 25%',
    afterImg: '/Untitled design (11).png', afterPos: 'center 30%',
    beforeHeadline: 'Recent graduate · looking for opportunities',
    afterHeadline: 'Software Engineer · React & TypeScript · Sydney',
  },
  {
    name: 'Ananya Nair',
    beforeImg: '/Assets/li-before-female.jpg', beforePos: '50% 22%',
    afterImg: '/headshot.png', afterPos: 'center 18%',
    beforeHeadline: 'Recent graduate · seeking work',
    afterHeadline: 'Registered Nurse · acute & emergency care · Melbourne',
  },
];

const LI_TEMPLATES = [
  { heading: 'Follow-up after applying', accent: colors.accentPetrol, body: 'Hi Sarah — I just applied for the Graduate RN role and wanted to flag how keen I am. Happy to share more on my placements?' },
  { heading: 'Recruiter intro', accent: colors.accentGold, body: 'Hi James, I noticed you recruit engineering teams in Sydney. Recent CS grad shipping production React — open to a chat?' },
  { heading: 'Cold referral request', accent: colors.success, body: 'Hi Priya, we met at the UTS careers night. Would you be open to referring me for the opening on your team?' },
];

// One LinkedIn profile that transforms amateur → optimised in place.
function LiProfileCard({ p, after }: { p: typeof LI_PEOPLE[number]; after: boolean }) {
  const fade = { duration: 0.5, ease: EASE };
  return (
    <div style={{ position: 'relative', background: colors.bgSurface, border: `1px solid ${colors.borderWhisper}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(26,24,20,0.04), 0 8px 24px rgba(26,24,20,0.06)' }}>
      <div style={{ position: 'relative', height: 64, overflow: 'hidden' }}>
        <motion.div animate={{ opacity: after ? 0 : 1 }} transition={fade} style={{ position: 'absolute', inset: 0, background: colors.bgAlt }} />
        <motion.div animate={{ opacity: after ? 1 : 0 }} transition={fade}
          style={{ position: 'absolute', inset: 0, background: colors.bgDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', textAlign: 'center' }}>
          <span style={display({ fontSize: 10.5, color: '#FFFFFF', lineHeight: 1.08 })}>LAND YOUR FIRST JOB IN AUSTRALIA</span>
        </motion.div>
      </div>
      <div style={{ padding: '0 12px 12px', marginTop: -22 }}>
        <div style={{ position: 'relative', width: 50, height: 50 }}>
          <img src={p.beforeImg} alt="" style={{ position: 'absolute', inset: 3, width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', objectPosition: p.beforePos, border: `2.5px solid ${colors.bgSurface}`, background: colors.bgAlt, opacity: after ? 0 : 1, transition: 'opacity 0.5s' }} />
          <img src={p.afterImg} alt="" style={{ position: 'absolute', inset: 3, width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', objectPosition: p.afterPos, border: `2.5px solid ${colors.bgSurface}`, background: colors.bgAlt, opacity: after ? 1 : 0, transition: 'opacity 0.5s' }} />
          <motion.img src="/Assets/open-to-work-ring.png" alt="" animate={{ opacity: after ? 1 : 0, scale: after ? 1 : 0.85 }} transition={{ duration: 0.4, ease: EASE, delay: after ? 0.25 : 0 }} style={{ position: 'absolute', inset: 0, width: 50, height: 50, pointerEvents: 'none' }} />
        </div>
        <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: typeTokens.body, fontSize: 12, fontWeight: 700, color: colors.textPrimary }}>{p.name}</span>
          <AnimatePresence>
            {after && (
              <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE, delay: 0.35 }}
                style={{ fontFamily: typeTokens.body, fontSize: 7, fontWeight: 700, letterSpacing: '0.02em', color: colors.success, background: 'rgba(42,157,111,0.12)', padding: '1.5px 5px', borderRadius: 99 }}>OPEN TO WORK</motion.span>
            )}
          </AnimatePresence>
        </div>
        <div style={{ marginTop: 2, minHeight: 28 }}>
          <AnimatePresence mode="wait">
            <motion.p key={after ? 'a' : 'b'}
              initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.35, ease: EASE }}
              style={{ fontFamily: typeTokens.body, fontSize: 10, color: after ? colors.textSecondary : colors.textMuted, margin: 0, lineHeight: 1.35 }}>
              {after ? p.afterHeadline : p.beforeHeadline}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
      {after && (
        <motion.div key="sweep" initial={{ x: '-120%' }} animate={{ x: '120%' }} transition={{ duration: 0.7, ease: EASE }}
          style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, transparent 42%, rgba(255,255,255,0.3) 50%, transparent 58%)', pointerEvents: 'none' }} />
      )}
    </div>
  );
}

function LinkedInPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const [reduce] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  );
  const [after, setAfter] = useState(reduce);

  useEffect(() => {
    if (!inView || reduce) return;
    const t = setTimeout(() => setAfter(a => !a), after ? 3000 : 2100);
    return () => clearTimeout(t);
  }, [after, inView, reduce]);

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Man + woman, side by side, transforming together */}
      <div className="li-cards" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <LiProfileCard p={LI_PEOPLE[0]} after={after} />
        <LiProfileCard p={LI_PEOPLE[1]} after={after} />
      </div>

      {/* Outreach templates animate in below */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, ease: EASE, delay: 0.2 }}
        style={{ background: colors.bgSurface, border: `1px solid ${colors.borderWhisper}`, borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(26,24,20,0.04), 0 8px 24px rgba(26,24,20,0.06)' }}
      >
        <span style={{ fontFamily: typeTokens.body, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted, display: 'block' }}>Outreach templates</span>
        <motion.div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.15, delayChildren: 0.35 } } }}
          initial="hidden" animate={inView ? 'show' : 'hidden'}
        >
          {LI_TEMPLATES.map((t, i) => (
            <motion.div key={i} variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }} transition={{ duration: 0.4, ease: EASE }}
              style={{ background: colors.bgAlt, borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${t.accent}` }}>
              <span style={{ fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, color: colors.textPrimary }}>{t.heading}</span>
              <p style={{ fontFamily: typeTokens.body, fontSize: 10.5, lineHeight: 1.45, color: colors.textSecondary, margin: '4px 0 0' }}>{t.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <style>{`@media (max-width: 520px){ .li-cards{ grid-template-columns: 1fr; } }`}</style>
    </div>
  );
}

// ── Step 1 demo: the audit walkthrough — upload panel → scan → report, on a loop ──

const AUDIT_PHASES = ['upload', 'scanning', 'report'] as const;
type AuditPhase = typeof AUDIT_PHASES[number];
const AUDIT_MS: Record<AuditPhase, number> = { upload: 2600, scanning: 1200, report: 3600 };
const AUDIT_PILLS = ['Mostly silence', 'Mostly rejections', 'Interviews that stall', 'A mix'];
const AUDIT_ITEMS = [
  { sev: '#C2603F', text: 'Opening bullet leads with a duty, not an outcome' },
  { sev: '#C5A059', text: 'Missing 4 of 7 keywords the ATS filters on' },
  { sev: '#C5A059', text: 'No quantified result in your last 2 roles' },
  { sev: colors.success, text: 'Strong, specific job titles — keep these' },
];

// The upload panel with a scripted cursor: drops a resume → picks a pill → clicks Generate.
// Cursor targets are measured from the real elements so it lands dead-centre on each.
function AuditUpload() {
  const [ustep, setUstep] = useState(0);
  const [cursorPos, setCursorPos] = useState({ left: 300, top: 230 });
  const dropRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ts = [
      setTimeout(() => setUstep(1), 700),
      setTimeout(() => setUstep(2), 1350),
      setTimeout(() => setUstep(3), 2050),
    ];
    return () => ts.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const el = ustep === 0 ? dropRef.current : ustep === 1 ? pillRef.current : btnRef.current;
    if (el) setCursorPos({ left: el.offsetLeft + el.offsetWidth / 2, top: el.offsetTop + el.offsetHeight / 2 });
  }, [ustep]);

  const uploaded = ustep >= 1;
  const pillOn = ustep >= 2;
  const clicked = ustep >= 3;
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.textMuted }}>Your resume</span>
      <div ref={dropRef} style={{ marginTop: 8, border: `2px dashed ${uploaded ? colors.accentPetrol + '66' : colors.borderDefined}`, borderRadius: 14, padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 12, background: uploaded ? 'rgba(45,90,110,0.06)' : colors.bgAlt, transition: 'all 0.3s' }}>
        {uploaded ? <FileText size={20} color={colors.accentPetrol} /> : <Upload size={20} color={colors.textMuted} />}
        <div>
          <p style={{ fontFamily: typeTokens.body, fontSize: 14, fontWeight: 600, color: uploaded ? colors.textPrimary : colors.textSecondary, margin: 0 }}>{uploaded ? 'Rohan_Kapoor_Resume.pdf' : 'Drop your CV or click to upload'}</p>
          <p style={{ fontFamily: typeTokens.body, fontSize: 12, color: colors.textMuted, margin: '2px 0 0' }}>{uploaded ? 'Uploaded · ready to scan' : 'PDF or Word. Everything else we infer for you.'}</p>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <span style={{ fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.textMuted }}>What are you getting back?</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {AUDIT_PILLS.map(pl => {
            const on = pillOn && pl === 'Mostly silence';
            return (
              <span key={pl} ref={pl === 'Mostly silence' ? pillRef : undefined} style={{ fontFamily: typeTokens.body, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 99, border: `1px solid ${on ? colors.accentPetrol : colors.borderDefined}`, color: on ? colors.accentPetrol : colors.textSecondary, background: on ? 'rgba(45,90,110,0.08)' : colors.bgSurface, transition: 'all 0.2s' }}>{pl}</span>
            );
          })}
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        <motion.div
          ref={btnRef}
          animate={clicked ? { scale: [1, 0.95, 1] } : { scale: 1 }}
          transition={{ duration: 0.35, ease: EASE }}
          style={{ background: colors.accentPetrol, color: colors.textOnDeep, borderRadius: 10, padding: '13px 18px', textAlign: 'center', fontFamily: typeTokens.body, fontSize: 14, fontWeight: 700 }}
        >Show me the gaps in my CV →</motion.div>
      </div>
      <motion.div
        initial={{ left: 300, top: 230, opacity: 0 }}
        animate={{ left: cursorPos.left - 4, top: cursorPos.top - 3, opacity: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
        style={{ position: 'absolute', pointerEvents: 'none', zIndex: 5 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={colors.textPrimary} stroke="#fff" strokeWidth="1.5"><path d="M4 2 L20 12 L13 13 L17 21 L13 22 L9 14 L4 18 Z" /></svg>
      </motion.div>
    </div>
  );
}

function GapReportSample() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [reduce] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  );
  const [phase, setPhase] = useState<AuditPhase>(reduce ? 'report' : 'upload');
  const [loopKey, setLoopKey] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const t = setTimeout(() => {
      const i = AUDIT_PHASES.indexOf(phase);
      if (i >= AUDIT_PHASES.length - 1) { setLoopKey(k => k + 1); setPhase('upload'); }
      else setPhase(AUDIT_PHASES[i + 1]);
    }, AUDIT_MS[phase]);
    return () => clearTimeout(t);
  }, [phase, inView, reduce]);

  return (
    <div ref={ref} style={{
      position: 'relative', width: '100%', maxWidth: 460, minHeight: 320, margin: '0 auto',
      background: colors.bgSurface, border: `1px solid ${colors.borderWhisper}`, borderRadius: 16,
      padding: 22, overflow: 'hidden', boxShadow: '0 1px 3px rgba(26,24,20,0.04), 0 12px 36px rgba(26,24,20,0.07)',
    }}>
      <AnimatePresence mode="wait">
        {phase === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
            <AuditUpload />
          </motion.div>
        )}

        {phase === 'scanning' && (
          <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
            <ScanningState />
          </motion.div>
        )}

        {phase === 'report' && (
          <motion.div key={`report-${loopKey}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontFamily: typeTokens.body, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMuted }}>Here's where your resume is letting you down</span>
              <ScoreRing score={62} />
            </div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.2 }}
              style={{ fontFamily: typeTokens.body, fontSize: 11, color: colors.textMuted, marginBottom: 14, fontStyle: 'italic' }}>
              Scanned as: Data Analyst (mid-level)
            </motion.div>
            <motion.div
              style={{ display: 'flex', flexDirection: 'column', gap: 11 }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.38, delayChildren: 0.5 } } }}
              initial="hidden" animate="show"
            >
              {AUDIT_ITEMS.map((g, i) => (
                <motion.div key={i} variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }} transition={{ duration: 0.45, ease: EASE }} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <motion.span variants={{ hidden: { scale: 0 }, show: { scale: 1 } }} transition={{ duration: 0.3, ease: EASE }} style={{ width: 7, height: 7, borderRadius: '50%', background: g.sev, marginTop: 5, flexShrink: 0 }} />
                  <span style={{ fontFamily: typeTokens.body, fontSize: 13, lineHeight: 1.45, color: colors.textSecondary }}>{g.text}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── sections ────────────────────────────────────────────────────────────────

function Nav() {
  const navigate = useNavigate();
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '18px 24px', background: colors.bgCanvas,
      borderBottom: `1px solid ${colors.borderWhisper}`,
    }}>
      <span style={display({ fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.01em' })}>
        Aussie&nbsp;Grad&nbsp;<span style={{ color: colors.accentGold }}>Careers</span>
      </span>
      <button
        onClick={() => navigate('/auth')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: typeTokens.body, fontSize: '0.9375rem', fontWeight: 600,
          color: colors.accentPetrol, padding: '6px 4px', letterSpacing: '-0.005em',
        }}
        onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.textUnderlineOffset = '3px'; }}
        onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
      >
        Log in
      </button>
    </nav>
  );
}

function Hero({ scrollToScan, onScanResult }: { scrollToScan: () => void; onScanResult?: (result: CvGapResult, pill: string | null) => void }) {
  // Stop the attention buzz the instant the user touches the panel.
  const [engaged, setEngaged] = useState(false);
  return (
    <section style={{ background: colors.bgCanvas, padding: '64px 24px 60px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 48, alignItems: 'start' }} className="hero-grid">
        <div>
          <span style={{ fontFamily: typeTokens.body, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: colors.textMuted }}>For graduates job-hunting in Australia</span>
          <h1 style={display({ fontSize: 'clamp(2.4rem, 4.6vw, 3.6rem)', lineHeight: 1.04, margin: '14px 0 0' })}>
            Get your first Australian job in 90 days.{' '}
            <span style={{ color: colors.accentGold }}>
              Guaranteed
              <button onClick={scrollToScan} title="See the conditions" style={{ background: 'none', border: 'none', color: colors.accentGold, cursor: 'pointer', fontSize: '0.5em', verticalAlign: 'super', padding: 0, fontFamily: typeTokens.display }}>*</button>
            </span>
          </h1>
          <p style={{ fontFamily: typeTokens.body, fontSize: '1.125rem', lineHeight: 1.6, color: colors.textSecondary, margin: '20px 0 0', maxWidth: 520 }}>
            Drop your CV and we will show you the exact gaps a recruiter spots in their six-second scan.
          </p>
          <div style={{ marginTop: 28, maxWidth: 520 }}>
            <p style={{ fontFamily: typeTokens.body, fontSize: '0.875rem', fontWeight: 600, color: colors.textSecondary, margin: '0 0 12px' }}>
              Join <span style={{ color: colors.accentGold, fontWeight: 700 }}>1,000+</span> graduates who landed their dream roles
            </p>
            <div className="testimonial-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                <div key={num} className="testimonial-card">
                  <img
                    src={`/Assets/testimonials/card_${num}.jpg`}
                    alt="Graduate success testimonial"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14 }}>
              <span style={{ fontFamily: typeTokens.body, fontSize: '0.8125rem', fontWeight: 600, color: colors.textSecondary }}>
                <span style={{ fontWeight: 700, color: colors.textPrimary }}>4.9/5</span> average rating from 350+ students
              </span>
              <div style={{ display: 'flex', gap: 2 }}>
                {[...Array(5)].map((_, i) => (
                  <span key={i} style={{ color: colors.accentGold, fontSize: '0.9rem' }}>★</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            {/* Periodic phone-buzz: tiny amplitude, high oscillation frequency — stops on engage */}
            <motion.div
              animate={engaged ? { x: 0 } : { x: [0, -1.5, 1.5, -1.5, 1.5, -1.3, 1.3, -1, 1, -0.6, 0.6, 0] }}
              transition={engaged
                ? { duration: 0.2, ease: EASE }
                : { duration: 0.45, ease: 'linear', repeat: Infinity, repeatDelay: 4.5 }}
              style={{ transformOrigin: 'center' }}
            >
              <ScanPanel onResult={onScanResult} onInteract={() => setEngaged(true)} />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Founder() {
  return (
    <section style={{ background: colors.bgAlt, padding: '96px 24px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 56, alignItems: 'center' }} className="founder-grid">
        <div className="founder-portrait" style={{ width: 280, marginInline: 'auto', flexShrink: 0 }}>
          <img src="/Assets/about-me.png" alt="Kiron, founder"
            style={{ width: '100%', height: 340, objectFit: 'cover', objectPosition: 'center 35%', borderRadius: 20, display: 'block', border: `1px solid ${colors.borderWhisper}`, boxShadow: '0 1px 3px rgba(26,24,20,0.05), 0 16px 40px rgba(26,24,20,0.12)' }} />
        </div>
        <div style={{ maxWidth: 480 }}>
          <Eyebrow>ABOUT ME</Eyebrow>
          <p style={display({ fontSize: '1.5rem', lineHeight: 1.35, fontStyle: 'italic', margin: 0 })}>
            "Coming to Australia as a student, I learned the job hunt here is not won on talent, it is won on knowing the local rules. The moment I learned them, the silence turned into callbacks and an offer I did not think was possible. I built this so you reach that moment in weeks, not the years it took me."
          </p>
          <p style={{ fontFamily: typeTokens.body, fontSize: '1.0625rem', lineHeight: 1.65, color: colors.textSecondary, margin: '18px 0 0' }}>
            I figured out that landing a high-paying role is not luck. It is a system: clarity, speed, measurable feedback, and support through the grind. That system took me from ghosted to a $150K government-adjacent role. I built Aussie Grad Careers so you do not have to figure it out the hard way.
          </p>
          <div style={{ margin: '22px 0 0' }}>
            <p style={display({ fontSize: '1.2rem', fontWeight: 600, margin: 0 })}>Kiron</p>
            <p style={{ fontFamily: typeTokens.body, fontSize: '0.9375rem', fontStyle: 'italic', color: colors.textMuted, margin: '3px 0 0', lineHeight: 1.4 }}>
              The guy who will make sure you land your dream job in Australia
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const TESTIMONIALS = [
  { q: "I have got a job as a Technical BA with TAC. Thank you for your support and assistance in helping me with the process.", a: 'Jebby Joseph · Technical BA · TAC' },
  { q: "I believe the whole of your report really helped throughout my resume editing. It actually counselled, not just mentioned the format, that gave a lot of insight as to why it needed to be done a certain way. This gave me confidence.", a: 'Nithya · Data Analyst · Melbourne' },
  { q: "This is really awesome and helps me to stay focussed. The tracker feature helps me with follow-up templates which was very convenient.", a: 'Diluk Chandrashekar · Project Coordinator · Brisbane' },
  { q: "I used it in the morning to send out applications and within 2 months landed a new role, finally a job I am proud of. Thank you.", a: 'Krisheela Bhatia · Administration Officer · Perth' },
  { q: "The feedback really helped with a more structured application process and the right keywords. I have managed to land a fulltime gig.", a: 'Kunal · Marketing Coordinator · Sydney' },
];

function Testimonials() {
  const cards = [...TESTIMONIALS, ...TESTIMONIALS];
  return (
    <section style={{ background: colors.bgCanvas, padding: '88px 0' }}>
      <div style={{ textAlign: 'center', padding: '0 24px', marginBottom: 40 }}>
        <h2 style={display({ fontSize: 'clamp(1.8rem, 3.4vw, 2.5rem)', lineHeight: 1.1 })}>Real Aussie grads. Real offers.</h2>
      </div>
      <div style={{ overflow: 'hidden', maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}>
        <motion.div style={{ display: 'flex', gap: 18, width: 'fit-content' }}
          animate={{ x: ['0%', '-50%'] }} transition={{ duration: 70, ease: 'linear', repeat: Infinity }}>
          {cards.map((c, i) => (
            <div key={i} style={{ flex: '0 0 420px', background: colors.bgAlt, borderRadius: 16, padding: 30, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <Quote size={22} color={colors.accentGold} style={{ marginBottom: 10 }} />
                <p style={display({ fontSize: '1.0625rem', fontStyle: 'italic', lineHeight: 1.5, fontWeight: 500 })}>{c.q}</p>
              </div>
              <p style={{ fontFamily: typeTokens.body, fontSize: '0.8125rem', fontWeight: 600, color: colors.textPrimary, margin: '22px 0 0' }}>{c.a}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: FileSearch,
    eyebrow: 'STEP 1 · AUDIT',
    title: 'See the gaps a recruiter spots in six seconds.',
    body: 'We read your CV and cover letter the way a hiring manager does on a fast first scan. We show you the exact lines that make them move on, with a clear fix for each one. No jargon, no scores you cannot act on.',
    preview: <GapReportSample />,
    side: 'right' as const,
  },
  {
    icon: Sparkles,
    eyebrow: 'STEP 2 · APPLY',
    title: 'Send a high-quality application in under 5 minutes.',
    body: 'Our AI is trained on proprietary data. Interviews with real hiring managers and thousands of successful resume scans. You get ATS-friendly, well-formatted documents in clean Australian English that recruiters actually enjoy reading, with the right keywords matched to each role.',
    preview: <GeneratorPreview />,
    side: 'left' as const,
  },
  {
    icon: Linkedin,
    eyebrow: 'STEP 3 · GET FOUND',
    title: 'Unlock the hidden job market.',
    body: 'Everyone talks about the hidden job market. We hand you the tools to actually reach it. LinkedIn profile and banner generators, a sharper About section, and proven outreach templates for every situation you will hit in your career.',
    preview: <LinkedInPreview />,
    side: 'right' as const,
  },
];

function Features() {
  return (
    <section style={{ background: colors.bgAlt, padding: '100px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <h2 style={display({ fontSize: 'clamp(1.9rem, 3.6vw, 2.6rem)', lineHeight: 1.1 })}>Three wins. One system.</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 88 }}>
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            const textCol = (
              <div>
                <span style={{ fontFamily: typeTokens.body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: colors.accentGold }}>{f.eyebrow}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 0' }}>
                  <Icon size={22} color={colors.accentPetrol} strokeWidth={1.6} />
                  <h3 style={display({ fontSize: '1.6rem', lineHeight: 1.2 })}>{f.title}</h3>
                </div>
                <p style={{ fontFamily: typeTokens.body, fontSize: '1.0625rem', lineHeight: 1.65, color: colors.textSecondary, margin: '16px 0 0', maxWidth: 460 }}>{f.body}</p>
              </div>
            );
            return (
              <Reveal key={i}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }} className="feature-grid">
                  {f.side === 'left' ? <>{f.preview}{textCol}</> : <>{textCol}{f.preview}</>}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Guarantee() {
  const conditions = [
    'Complete your CV + cover letter fixes from the gap report',
    'Optimise your LinkedIn with our generator',
    'Send the recommended tailored applications each week',
    'Run our proven outreach templates and log your follow-ups',
  ];
  return (
    <section style={{ background: colors.bgCanvas, padding: '100px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{
          background: colors.bgSurface, border: `1px solid ${colors.accentGoldSoft}`, borderRadius: 20,
          padding: 40, boxShadow: '0 1px 3px rgba(26,24,20,0.04), 0 12px 36px rgba(26,24,20,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <ShieldCheck size={22} color={colors.accentPetrol} strokeWidth={1.6} />
            <h2 style={display({ fontSize: '1.6rem' })}>The 90-day guarantee and the deal</h2>
          </div>
          <p style={{ fontFamily: typeTokens.body, fontSize: '1.0625rem', lineHeight: 1.65, color: colors.textSecondary, margin: 0 }}>
            Do the work with us for 90 days and you will land interviews. Or we will keep working with you free until you do. The catch is not hidden: the guarantee holds when you actually run the system, because the system is what gets you hired.
          </p>
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {conditions.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Check size={18} color={colors.success} strokeWidth={2.4} style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontFamily: typeTokens.body, fontSize: '0.9375rem', lineHeight: 1.5, color: colors.textPrimary }}>{c}</span>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: typeTokens.body, fontSize: '0.8125rem', fontStyle: 'italic', color: colors.textMuted, margin: '20px 0 0' }}>
            Demanding, but every condition is a step that genuinely moves you toward an offer, not a hoop. (Final terms to be set with you.)
          </p>
        </div>
      </div>
    </section>
  );
}

// ── page ────────────────────────────────────────────────────────────────────

export function MockLandingPage() {
  const scanRef = useRef<HTMLDivElement>(null);
  // "Show me the gaps" CTA now triggers the file upload in the hero scan panel
  const scrollToScan = () => {
    const panel = document.querySelector('.hero-grid');
    panel?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { document.title = 'Mock · Aussie Grad Careers'; }, []);

  return (
    <div ref={scanRef} style={{ background: colors.bgCanvas, height: '100vh', overflowY: 'auto' }}>
      <Nav />
      <Hero scrollToScan={scrollToScan} />
      <Founder />
      <Testimonials />
      <Features />
      <Guarantee />
      <Footer />

      <style>{`
        .testimonial-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        .testimonial-card {
          width: 100%;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(26,24,20,0.04), 0 4px 12px rgba(26,24,20,0.05);
          border: 1px solid rgba(26,24,20,0.06);
          transition: transform 0.25s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.25s ease;
        }
        .testimonial-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 1px 3px rgba(26,24,20,0.04), 0 12px 24px rgba(26,24,20,0.12);
        }
        @media (max-width: 860px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .founder-grid { grid-template-columns: 1fr !important; }
          .feature-grid { grid-template-columns: 1fr !important; }
          .feature-grid > *:first-child { order: 2; }
        }
        @media (max-width: 560px) {
          .testimonial-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}

export default MockLandingPage;

// ── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ background: colors.bgDeep, padding: '40px 24px', textAlign: 'center' }}>
      <span style={display({ fontSize: '1rem', color: colors.textOnDeep })}>Aussie Grad Careers</span>
      <p style={{ fontFamily: typeTokens.body, fontSize: 12, color: 'rgba(250,247,242,0.5)', margin: '8px 0 0' }}>Built for grads job-hunting in Australia. Mock landing /mock-landing</p>
    </footer>
  );
}
