/**
 * ScanReveal — the full-screen "WOW" reveal for the first CV scan.
 *
 * Mac-style genie expand into a full-screen takeover, then a scroll-driven
 * sequence of above-the-fold beats in the voice of a calm friend who works in
 * Australian HR. Understanding + hope, not a score. The arc is ordered for
 * maximum impact:
 *
 *   1. Punch + insider POV  — the hiring manager's 6-second reaction
 *   2. Relief               — "this isn't your fault"
 *   3. Cultural translation — what you wrote vs. what she hears (skipped if none)
 *   4. Hope + CTA           — the fix is close; unlock the roadmap
 *
 * The email/roadmap funnel is owned by the caller (ScanPanel) and passed in,
 * so this component only renders + drives the reveal.
 */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  motion, useScroll, useTransform, useMotionValue, useReducedMotion,
} from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { colors, type as typeTokens } from './tokens';
import { HealingCv } from './HealingCv';
import { beatImage, type ScanBeat } from './scanImages';
import { scanCinematicCopy } from './scanCinematicCopy';

const EASE = [0.25, 1, 0.5, 1] as const;

interface RevealResult {
  firstName: string;
  inferredRole: string;
  firstImpression?: string;
  reassurance?: string;
  hiringManager?: { name: string; archetype: string; view: string };
  culturalTranslations?: { wrote: string; reads: string; instead: string }[];
  items: { severity: 'critical' | 'warning' | 'good'; text: string }[];
  quickWins: { heading: string; description: string }[];
}

interface RoadmapStep { rank: number; title: string; why: string }

export interface ScanRevealProps {
  result: RevealResult;
  email: string;
  setEmail: (v: string) => void;
  emailLoading: boolean;
  onEmailSubmit: () => void;
  roadmap: RoadmapStep[] | null;
  roadmapError: string | null;
  onRetry: () => void;
  onClose: () => void;
  onEnterDashboard: () => void;
}

const display = (size: string): React.CSSProperties => ({
  fontFamily: typeTokens.display,
  fontWeight: 600,
  letterSpacing: '-0.02em',
  lineHeight: 1.15,
  color: colors.textPrimary,
  fontSize: size,
  margin: 0,
  paddingBottom: '0.1em',
});

const eyebrowStyle: React.CSSProperties = {
  fontFamily: typeTokens.body,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: colors.accentGold,
  margin: 0,
};

const bodyStyle: React.CSSProperties = {
  fontFamily: typeTokens.body,
  fontSize: 16,
  lineHeight: 1.6,
  color: colors.textSecondary,
  margin: 0,
};

/** Full-height section wrapper with whileInView entrance + beat image accent. */
function BeatSection({
  imgBeat,
  children,
}: {
  imgBeat?: ScanBeat;
  children: React.ReactNode;
  isFirst?: boolean;
}) {
  const [narrow, setNarrow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Check viewport width on mount and resize — hide beat images below 720px.
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 720);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <section
      ref={ref}
      style={{ display: 'flex', alignItems: 'center', position: 'relative', padding: '48px 24px' }}
    >
      {imgBeat && !narrow && (
        <img
          src={beatImage(imgBeat)}
          alt=""
          aria-hidden
          style={{
            position: 'absolute', right: -8, bottom: 0, width: 180,
            opacity: 0.16, mixBlendMode: 'multiply', pointerEvents: 'none', zIndex: 0,
          }}
        />
      )}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, ease: EASE }}
        style={{ width: '100%', maxWidth: 680, margin: '0 auto', position: 'relative', zIndex: 1 }}
      >
        {children}
      </motion.div>
    </section>
  );
}

export function ScanReveal({
  result,
  email,
  setEmail,
  emailLoading,
  onEmailSubmit,
  roadmap,
  roadmapError,
  onClose,
  onEnterDashboard,
}: ScanRevealProps) {
  const reduce = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const roadmapRef = useRef<HTMLDivElement>(null);

  // Scroll-driven progress for the healing CV and scroll cue
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const staticProgress = useMotionValue(1); // for reduced motion

  const hm = result.hiringManager;
  const translations = (result.culturalTranslations ?? []).slice(0, 2);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const [emailHint, setEmailHint] = useState(false);

  // The CTA stays visually live and inviting even before an email is typed; if
  // clicked empty it nudges the field instead of sitting there greyed out.
  const handlePlanClick = () => {
    if (emailLoading) return;
    if (!email) {
      setEmailHint(true);
      emailInputRef.current?.focus();
      return;
    }
    setEmailHint(false);
    onEmailSubmit();
  };

  // First-impression verdict is variable length (the LLM writes it, capped ~48
  // chars). Scale the display size by length so it settles on ~2 lines instead
  // of an ugly 3-line break for the longer verdicts.
  const fiText = (result.firstImpression || 'Easy to overlook').trim();
  const fiSize =
    fiText.length > 38 ? 'clamp(24px, 3.6vw, 38px)' :
    fiText.length > 26 ? 'clamp(28px, 4.6vw, 46px)' :
    'clamp(34px, 6vw, 58px)';

  const sharpItems = result.items
    .filter(i => i.severity !== 'good')
    .slice(0, 2);

  const scrollCueOpacity = useTransform(scrollYProgress, [0, 0.05], [1, 0]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      ref={scrollRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: colors.bgCanvas,
        overflowY: 'auto',
      }}
    >
      {/* genie / rise-and-open container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        style={{
          // soft warm top-light, no glassmorphism
          background: `radial-gradient(120% 80% at 50% -10%, ${colors.bgSurface} 0%, ${colors.bgCanvas} 55%)`,
        }}
      >
        {/* top bar: progress bar + close */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: colors.bgCanvas }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px' }}>
            {/* thin scroll-progress bar */}
            <motion.div
              style={{ position: 'absolute', top: 0, left: 0, height: 3, background: colors.accentPetrol, transformOrigin: 'left', scaleX: scrollYProgress as any }}
            />
            <div />
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, padding: 6 }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Sticky HealingCv companion — sits behind the text on the right */}
        <div style={{
          position: 'sticky', top: '50%', zIndex: 0, pointerEvents: 'none',
          width: '100%', height: 0, display: 'flex', justifyContent: 'flex-end',
        }}>
          <div style={{ marginTop: -115, marginRight: 16, opacity: 0.5 }}>
            <HealingCv progress={reduce ? staticProgress : scrollYProgress} />
          </div>
        </div>

        {/* ── BEAT 1: Punch (wound) ── */}
        <BeatSection imgBeat="wound">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p style={eyebrowStyle}>
              {result.firstName ? `Hey ${result.firstName}` : 'The 6-second test'}
            </p>
            {/* Verdict leads — the visual slap. Moved BEFORE the framing paragraph. */}
            <h1 style={display(fiSize)}>
              "{fiText}."
            </h1>
            <p style={{ ...bodyStyle, fontSize: 18, color: colors.textPrimary }}>
              Hiring managers spend about 6 seconds on each of the hundreds of resumes they see every day. Here is what comes to mind when they glance at yours:
            </p>
            {hm && (
              <p style={bodyStyle}>
                That's the impression {hm.name}, {hm.archetype}, forms before they reach your best work. {hm.view}
              </p>
            )}
            {sharpItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                <p style={{ ...bodyStyle, fontSize: 13, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  What catches their eye first
                </p>
                {sharpItems.map((it, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#C2603F', marginTop: 8, flexShrink: 0 }} />
                    <span style={{ ...bodyStyle, fontSize: 15 }}>{it.text}</span>
                  </div>
                ))}
              </div>
            )}
            <p style={{ ...bodyStyle, fontSize: 15, color: colors.textPrimary, marginTop: 4 }}>
              Most resumes with these gaps never get a reply. Not a rejection, just silence, because they are filtered or skimmed past before anyone reads the detail.
            </p>
            {/* Stakes image accent in the punch section */}
            <img src={beatImage('stakes')} alt="" aria-hidden
              style={{ position: 'absolute', right: -8, bottom: 40, width: 180, opacity: 0.12, mixBlendMode: 'multiply', pointerEvents: 'none', zIndex: 0 }} />
          </div>
        </BeatSection>

        {/* ── BEAT 2: Relief ── */}
        <BeatSection imgBeat="relief">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p style={eyebrowStyle}>The part nobody tells you</p>
            <h1 style={display('clamp(30px, 5vw, 50px)')}>
              This isn't a talent problem.
            </h1>
            <p style={{ ...bodyStyle, fontSize: 18, color: colors.textPrimary }}>
              {result.reassurance || "This isn't your fault. You were never taught the local rules. Your experience is real, it's just written in a way Australian employers don't read yet."}
            </p>
            <p style={bodyStyle}>
              {result.firstName ? `${result.firstName}, you're` : "You're"} not competing on talent here. {result.inferredRole ? `Your experience as a ${result.inferredRole} is real, and it counts. ` : ''}You're competing on translation, and that's a far easier gap to close.
            </p>
          </div>
        </BeatSection>

        {/* ── BEAT 3: Cultural translation ── */}
        {translations.length > 0 && (
          <BeatSection>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <p style={eyebrowStyle}>What you wrote vs. what they hear</p>
              <h1 style={display('clamp(26px, 4vw, 40px)')}>
                The same line, read two completely different ways.
              </h1>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
                {translations.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      border: `1px solid ${colors.borderWhisper}`,
                      borderRadius: 16,
                      background: colors.bgSurface,
                      padding: '18px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div>
                      <span style={{ ...eyebrowStyle, color: colors.textMuted, fontSize: 10.5 }}>You wrote</span>
                      <p style={{ ...bodyStyle, fontSize: 15, color: colors.textPrimary, marginTop: 4 }}>"{t.wrote}"</p>
                    </div>
                    <div style={{ borderLeft: `2px solid #C2603F`, paddingLeft: 14 }}>
                      <span style={{ ...eyebrowStyle, color: '#C2603F', fontSize: 10.5 }}>They hear</span>
                      <p style={{ ...bodyStyle, fontSize: 15, fontStyle: 'italic', marginTop: 4 }}>{t.reads}</p>
                      <p style={{ ...bodyStyle, fontSize: 12.5, color: colors.textMuted, marginTop: 6 }}>This is a weak signal. It says nothing about your contribution or capacity.</p>
                    </div>
                    <div style={{ borderLeft: `2px solid ${colors.success}`, paddingLeft: 14 }}>
                      <span style={{ ...eyebrowStyle, color: colors.success, fontSize: 10.5 }}>Write this instead</span>
                      <p style={{ ...bodyStyle, fontSize: 15, color: colors.textPrimary, marginTop: 4 }}>{t.instead}</p>
                      <p style={{ ...bodyStyle, fontSize: 12.5, color: colors.textMuted, marginTop: 6 }}>This is how a candidate who gets hired speaks.</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </BeatSection>
        )}

        {/* ── BEAT 4: Hope / email gate ── */}
        <BeatSection imgBeat="wall">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {!roadmap ? (
              <>
                <p style={eyebrowStyle}>The good news</p>
                <h1 style={display('clamp(30px, 5vw, 50px)')}>
                  This is fixable, and faster than you think.
                </h1>
                <p style={bodyStyle}>
                  There are a handful of specific changes between your CV and the callback pile. Here are two you can make in the next five minutes:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(result.quickWins || []).slice(0, 2).map((w, i) => (
                    <div
                      key={i}
                      style={{
                        background: 'rgba(42,157,111,0.06)',
                        border: '1px solid rgba(42,157,111,0.18)',
                        borderRadius: 12,
                        padding: '12px 16px',
                      }}
                    >
                      <span style={{ fontFamily: typeTokens.body, fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{w.heading}</span>
                      <p style={{ ...bodyStyle, fontSize: 14, marginTop: 3 }}>{w.description}</p>
                    </div>
                  ))}
                </div>

                {/* prominent CTA — the obvious next step */}
                <div style={{ marginTop: 8 }}>
                  <p style={{ ...bodyStyle, fontSize: 15, color: colors.textPrimary, marginBottom: 12 }}>
                    Want the rest? I'll send your full fix list, step by step, plus the Australian hiring rules recruiters never say out loud. Career coaches charge hundreds for this read. Yours is free, I just need an email to send it.
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input
                      ref={emailInputRef}
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); if (e.target.value) setEmailHint(false); }}
                      placeholder="Enter your email"
                      onKeyDown={e => { if (e.key === 'Enter') handlePlanClick(); }}
                      style={{
                        flex: '1 1 240px',
                        fontFamily: typeTokens.body,
                        fontSize: 15,
                        padding: '15px 18px',
                        borderRadius: 14,
                        border: `1px solid ${colors.borderDefined}`,
                        background: colors.bgSurface,
                        color: colors.textPrimary,
                        outline: 'none',
                      }}
                    />
                    <motion.button
                      onClick={handlePlanClick}
                      disabled={emailLoading}
                      animate={emailLoading ? {} : { boxShadow: ['0 0 0 0 rgba(45,90,110,0)', '0 0 0 8px rgba(45,90,110,0.14)', '0 0 0 0 rgba(45,90,110,0)'] }}
                      transition={{ duration: 1.8, ease: EASE, repeat: Infinity, repeatDelay: 0.8 }}
                      style={{
                        fontFamily: typeTokens.body,
                        fontSize: 16,
                        fontWeight: 700,
                        cursor: emailLoading ? 'wait' : 'pointer',
                        padding: '15px 26px',
                        borderRadius: 14,
                        border: 'none',
                        whiteSpace: 'nowrap',
                        background: colors.accentPetrol,
                        color: colors.textOnDeep,
                        opacity: emailLoading ? 0.7 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      {emailLoading ? 'Building your plan...' : 'Show me the plan'}
                      {!emailLoading && <ArrowRight size={18} />}
                    </motion.button>
                  </div>
                  {emailHint && !email && (
                    <p style={{ fontFamily: typeTokens.body, fontSize: 12.5, color: colors.accentPetrol, fontWeight: 600, margin: '10px 0 0' }}>
                      Pop your email in and I'll build your plan.
                    </p>
                  )}
                  {roadmapError && (
                    <p style={{ fontFamily: typeTokens.body, fontSize: 12, color: '#C2603F', margin: '10px 0 0' }}>{roadmapError}</p>
                  )}
                  <p style={{ fontFamily: typeTokens.body, fontSize: 11.5, color: colors.textMuted, margin: '12px 0 0' }}>
                    No spam, unsubscribe anytime.{' '}
                    <a href="/legal/privacy" target="_blank" rel="noreferrer" style={{ color: colors.accentPetrol }}>Privacy</a>
                  </p>
                </div>
              </>
            ) : (
              <div ref={roadmapRef}>
                <p style={eyebrowStyle}>Your plan is ready</p>
                <h1 style={display('clamp(28px, 4.4vw, 44px)')}>
                  {result.firstName ? `${result.firstName}, this is what gets you the callback.` : 'This is what gets you the callback.'}
                </h1>
                <p style={bodyStyle}>
                  Each step below closes one gap between your resume and a recruiter saying yes. Do them with me now, in one sitting, and walk out with a resume built for how Australia actually hires.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '46vh', overflowY: 'auto', paddingRight: 4 }}>
                  {roadmap.map(s => (
                    <div
                      key={s.rank}
                      style={{
                        display: 'flex',
                        gap: 14,
                        alignItems: 'flex-start',
                        background: colors.bgSurface,
                        borderRadius: 12,
                        padding: '14px 16px',
                        border: `1px solid ${colors.borderWhisper}`,
                      }}
                    >
                      <span style={{
                        width: 26, height: 26, borderRadius: '50%', background: colors.accentPetrol,
                        color: colors.textOnDeep, fontFamily: typeTokens.body, fontSize: 12, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                      }}>{s.rank}</span>
                      <div>
                        <span style={{ fontFamily: typeTokens.body, fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{s.title}</span>
                        <p style={{ ...bodyStyle, fontSize: 13.5, marginTop: 3 }}>{s.why}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 4, padding: '16px 18px', border: `1px solid ${colors.borderWhisper}`, borderRadius: 14, background: colors.bgSurface, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={eyebrowStyle}>Fixing it once is the easy part</p>
                  <p style={{ ...bodyStyle, fontSize: 15, color: colors.textPrimary }}>
                    The real reason good people stay stuck is they fix one resume, then send it into a void, to jobs that may not even sponsor a visa. We rewrite your resume for every job automatically, and show you the Australian employers hiring and sponsoring right now.
                  </p>
                  <p style={{ ...bodyStyle, fontSize: 12.5, color: colors.textMuted }}>Free to start. No card needed.</p>
                </div>
              </div>
            )}
          </div>
        </BeatSection>

        {/* Cure section — shows after roadmap + bridge */}
        {roadmap && (
          <BeatSection imgBeat="cure">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
              <p style={{ ...bodyStyle, fontSize: 14, color: colors.textSecondary }}>
                Now that you know what to fix, let's build the resume that gets you the callbacks.
              </p>
              <motion.button
                onClick={onEnterDashboard}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                animate={{ boxShadow: ['0 8px 24px rgba(45,90,110,0.22)', '0 8px 30px rgba(45,90,110,0.34)', '0 8px 24px rgba(45,90,110,0.22)'] }}
                transition={{ duration: 2.2, ease: EASE, repeat: Infinity }}
                style={{
                  fontFamily: typeTokens.body,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '15px 30px',
                  borderRadius: 14,
                  border: 'none',
                  background: colors.accentPetrol,
                  color: colors.textOnDeep,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                Fix my resume
                <ArrowRight size={18} />
              </motion.button>
            </div>
          </BeatSection>
        )}

        {/* Scroll cue — fixed-bottom-centre on the first section */}
        <motion.div
          style={{
            position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 5,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            pointerEvents: 'none', opacity: scrollCueOpacity,
          }}
        >
          <span style={{ fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: colors.textMuted }}>
            {scanCinematicCopy.scrollCue}
          </span>
          {!reduce && (
            <motion.svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.2, ease: 'easeInOut', repeat: Infinity }}
            >
              <polyline points="6 9 12 15 18 9" />
            </motion.svg>
          )}
        </motion.div>

      </motion.div>
    </motion.div>,
    document.body,
  );
}
