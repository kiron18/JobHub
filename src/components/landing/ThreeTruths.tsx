import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { colors, type as typeTokens } from './tokens';
import { Eyebrow } from './shared/Eyebrow';
import posthog from 'posthog-js';
import type { HeroVariant } from '../../lib/landingVariant';

const TRUTHS = [
  {
    numeral: '01',
    headline: "The hardest part isn't the work. It's the weight.",
    body: "Most graduates we talk to aren't lazy. They're exhausted. Sending the 87th application that gets ignored isn't a skills issue. It's an emotional one. The job search punishes consistency exactly when consistency matters most.",
    sketchSide: 'left' as const,
    sketchSrc: '/sketches/truth-1.webp',
    sketchAlt: 'Girl drinking tea by a window',
  },
  {
    numeral: '02',
    headline: 'Volume is the lever. Not luck. Not vibes.',
    body: 'Landing a job in Australia is a numbers game played by people who understand the rules. Every application is a lottery ticket, but the winning ones aren\'t random. They\'re consistent, tailored, and sent into the right rooms. The fastest path to an offer is more high-quality applications going out, faster.',
    sketchSide: 'right' as const,
    sketchSrc: '/sketches/truth-2.webp',
    sketchAlt: 'Guy at a desk, focused on work',
  },
  {
    numeral: '03',
    headline: 'The trick isn\'t applying more. It\'s applying *right*, consistently.',
    body: 'Anyone can send 50 generic applications in a weekend and feel productive. Two months later they\'ve burned out and have nothing to show for it. The grads who actually land roles send fewer, better, more consistent applications, every week, without it eating their life. That\'s a system. Not motivation.',
    sketchSide: 'left' as const,
    sketchSrc: '/sketches/truth-3.webp',
    sketchAlt: 'Guy walking past a meeting room',
  },
];

// ── Tooltip content ───────────────────────────────────────────

const TOOLTIP_LABEL = `The math, if you're curious`;

const TOOLTIP_SECTIONS = [
  'Job searching is a probability problem. Most people just treat it like a lottery.',
  'A typical CV has a 3–5% chance of generating a callback on any single application. That sounds brutal until you run the actual equation:',
  {
    label: 'At a 5% callback rate across 50 applications',
    equation: '1 − (0.95)⁵⁰ = 92.3%',
    note: 'chance of at least one interview',
  },
  '50 well-targeted applications give you a 92% chance of an interview.',
  'Reverse-engineer it from the goal:',
  {
    label: 'Applications needed = Target offers ÷ (Interview rate × Offer rate)',
    equation: 'Want 2 offers? 2 ÷ (0.05 × 0.25) = 160 applications',
    note: 'Fix your callback rate from 1% to 5%. The same goal takes 40 applications',
  },
  `The game isn't volume. It's rate.`,
  'Every percentage point of improvement in your callback rate roughly halves the effort required. That\'s why your CV, cover letter, and LinkedIn profile aren\'t admin tasks. They\'re the highest-leverage variables in the entire equation.',
  'This is what JobHub is built on: systems and strategy rooted in math.',
];

function TextColumn({ truth, justifyEnd, customBody }: { truth: typeof TRUTHS[number]; justifyEnd?: boolean; customBody?: React.ReactNode }) {
  return (
    <div style={justifyEnd ? { justifySelf: 'end' } : undefined}>
      <span
        style={{
          fontFamily: typeTokens.display,
          fontSize: '4.5rem',
          fontWeight: 400,
          color: colors.accentGold,
          lineHeight: 1,
          display: 'block',
          fontVariationSettings: "'SOFT' 50, 'WONK' 1",
        }}
      >
        {truth.numeral}
      </span>

      <h3
        style={{
          fontFamily: typeTokens.display,
          fontSize: '1.75rem',
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.01em',
          color: colors.textPrimary,
          margin: '16px 0 0',
          fontVariationSettings: "'SOFT' 50, 'WONK' 1",
        }}
      >
        {truth.headline}
      </h3>

      {customBody ?? (
        <p
          style={{
            fontFamily: typeTokens.body,
            fontSize: '1.125rem',
            lineHeight: 1.65,
            color: colors.textSecondary,
            margin: '20px 0 0',
            maxWidth: 600,
          }}
        >
          {truth.body}
        </p>
      )}
    </div>
  );
}

function TruthRow({ truth, index, variant }: { truth: typeof TRUTHS[number]; index: number; variant?: HeroVariant }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  const isLeft = truth.sketchSide === 'left';

  // ── Tooltip for Truth #02 ───────────────────────────────────
  const isTruthTwo = index === 1;

  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const analyticsTracked = useRef(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null; }
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 10;
    const tw = Math.min(420, window.innerWidth - 20);

    let style: React.CSSProperties;
    if (window.innerWidth < 640) {
      // Mobile: centre below trigger
      style = {
        position: 'fixed', zIndex: 200,
        top: rect.bottom + gap,
        left: Math.max(10, (window.innerWidth - tw) / 2),
      };
    } else if (rect.top < 250) {
      // Below trigger
      const left = Math.max(10, Math.min(rect.right - tw + 20, window.innerWidth - tw - 10));
      style = { position: 'fixed', zIndex: 200, top: rect.bottom + gap, left };
    } else {
      // Above-right of trigger
      const left = Math.max(10, Math.min(rect.right - tw + 20, window.innerWidth - tw - 10));
      style = { position: 'fixed', zIndex: 200, bottom: window.innerHeight - rect.top + gap, left };
    }
    setTooltipStyle(style);
  }, []);

  const openTooltip = useCallback(() => {
    updatePosition();
    setTooltipOpen(true);
    requestAnimationFrame(() => setTooltipVisible(true));
    if (!analyticsTracked.current) {
      analyticsTracked.current = true;
      posthog.capture('landing_math_tooltip_opened', { variant: variant ?? 'unknown' });
    }
  }, [updatePosition, variant]);

  const closeTooltip = useCallback(() => {
    setTooltipVisible(false);
    setTimeout(() => setTooltipOpen(false), 180);
  }, []);

  const scheduleOpen = useCallback(() => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    openTimerRef.current = setTimeout(openTooltip, 150);
  }, [openTooltip]);

  const scheduleClose = useCallback(() => {
    if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null; }
    closeTimerRef.current = setTimeout(closeTooltip, 100);
  }, [closeTooltip]);

  // Global click outside to close
  useEffect(() => {
    if (!tooltipOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        closeTooltip();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tooltipOpen, closeTooltip]);

  // Esc to close
  useEffect(() => {
    if (!tooltipOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeTooltip(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [tooltipOpen, closeTooltip]);

  // ── Trigger span for "numbers game" ────────────────────

  const numbersGameTrigger = (
    <span
      ref={triggerRef}
      tabIndex={0}
      role="button"
      aria-describedby="math-tooltip"
      onClick={(e) => { e.stopPropagation(); tooltipOpen ? closeTooltip() : openTooltip(); }}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      onFocus={scheduleOpen}
      onBlur={(e) => { if (!tooltipRef.current?.contains(e.relatedTarget as Node)) scheduleClose(); }}
      style={{
        textDecoration: 'underline dotted',
        textUnderlineOffset: 4,
        textDecorationColor: colors.accentGold,
        color: 'inherit',
        cursor: 'help',
      }}
    >
      numbers game
      <sup
        style={{
          color: colors.accentGold,
          fontSize: '0.65em',
          verticalAlign: 'super',
          lineHeight: 1,
          marginLeft: 2,
          display: 'inline-block',
          transition: 'transform 200ms ease',
          transform: tooltipVisible ? 'rotate(15deg)' : 'rotate(0deg)',
        }}
      >
        *
      </sup>
    </span>
  );

  // Build custom body for Truth #02 with the trigger inserted
  const truthTwoBody = isTruthTwo ? (() => {
    const before = 'Landing a job in Australia is a ';
    const after = ' played by people who understand the rules. Every application is a lottery ticket, but the winning ones aren\'t random. They\'re consistent, tailored, and sent into the right rooms. The fastest path to an offer is more high-quality applications going out, faster.';
    return (
      <p
        style={{
          fontFamily: typeTokens.body,
          fontSize: '1.125rem',
          lineHeight: 1.65,
          color: colors.textSecondary,
          margin: '20px 0 0',
          maxWidth: 600,
        }}
      >
        {before}{numbersGameTrigger}{after}
      </p>
    );
  })() : null;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.5,
        delay: index * 0.15,
        ease: [0.25, 1, 0.5, 1],
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: isLeft ? '320px 1fr' : '1fr 320px',
        gap: 64,
        alignItems: 'center',
        marginBottom: index < TRUTHS.length - 1 ? 96 : 0,
        position: 'relative',
      }}
    >
      {/* Sketch + text columns rendered in DOM order matching grid-template-columns */}
      {isLeft ? (
        <>
          <div className="truth-sketch-col">
            <img
              src={truth.sketchSrc}
              alt={truth.sketchAlt}
              style={{ display: 'block', width: 320, height: 'auto' }}
            />
          </div>
          <TextColumn truth={truth} customBody={isTruthTwo ? truthTwoBody : undefined} />
        </>
      ) : (
        <>
          <TextColumn truth={truth} justifyEnd customBody={isTruthTwo ? truthTwoBody : undefined} />
          <div className="truth-sketch-col">
            <img
              src={truth.sketchSrc}
              alt={truth.sketchAlt}
              style={{ display: 'block', width: 320, height: 'auto' }}
            />
          </div>
        </>
      )}

      {/* ── Tooltip card ──────────────────────────────── */}
      <AnimatePresence>
        {tooltipOpen && (
          <motion.div
            ref={tooltipRef}
            id="math-tooltip"
            role="tooltip"
            aria-live="polite"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: tooltipVisible ? 1 : 0, y: tooltipVisible ? 0 : 8 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
            onMouseEnter={() => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }}
            onMouseLeave={scheduleClose}
            style={{
              ...tooltipStyle,
              width: 'clamp(320px, 90vw, 420px)',
              padding: 24,
              background: colors.bgSurface,
              border: `1px solid ${colors.borderDefined}`,
              borderRadius: 4,
              boxShadow: '0 12px 32px -8px rgba(26,24,20,0.18), 0 4px 12px -4px rgba(26,24,20,0.08)',
              pointerEvents: 'auto',
            }}
          >
            {/* Paper grain overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              filter: 'url(#noise-texture)',
              mixBlendMode: 'multiply',
              opacity: 0.4, pointerEvents: 'none', borderRadius: 4,
            }} />

            <p style={{
              fontFamily: typeTokens.display,
              fontStyle: 'italic',
              fontSize: 13,
              color: colors.accentGold,
              margin: '0 0 16px',
            }}>
              {TOOLTIP_LABEL}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {TOOLTIP_SECTIONS.map((section, i) => {
                if (typeof section === 'string') {
                  const isEquationLabel = section.startsWith('At a') || section.startsWith('Applications');
                  const isBold = section.startsWith('The game') || section.startsWith('This is what');
                  const isReverseEngineer = section.startsWith('Reverse-engineer');
                  return (
                    <p key={i} style={{
                      margin: 0,
                      fontSize: isEquationLabel ? 13 : 14,
                      fontWeight: isBold ? 600 : 450,
                      lineHeight: 1.65,
                      color: isBold ? colors.textPrimary : colors.textSecondary,
                      textAlign: isReverseEngineer || isEquationLabel ? 'center' : 'left',
                      fontFamily: isEquationLabel ? typeTokens.display : typeTokens.body,
                      fontStyle: isEquationLabel ? 'italic' : 'normal',
                      borderTop: i === 7 ? `1px solid ${colors.borderWhisper}` : 'none',
                      paddingTop: i === 7 ? 12 : 0,
                      borderBottom: i === 1 || i === 4 ? `1px solid ${colors.borderWhisper}` : 'none',
                      paddingBottom: i === 1 || i === 4 ? 12 : 0,
                    }}>
                      {section}
                    </p>
                  );
                }
                // Equation block
                return (
                  <div key={i} style={{
                    background: colors.bgAlt,
                    borderRadius: 4,
                    padding: '12px 16px',
                    margin: '2px 0',
                  }}>
                    <p style={{
                      margin: '0 0 4px',
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: colors.textSecondary,
                      fontWeight: 500,
                    }}>
                      {section.label}
                    </p>
                    <p style={{
                      margin: '0 0 4px',
                      fontFamily: typeTokens.display,
                      fontSize: 16,
                      fontWeight: 600,
                      textAlign: 'center',
                      color: colors.accentPetrol,
                      lineHeight: 1.4,
                    }}>
                      {section.equation}
                    </p>
                    {section.note && (
                      <p style={{
                        margin: 0,
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: colors.textSecondary,
                        fontStyle: 'italic',
                        textAlign: 'center',
                      }}>
                        {section.note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ThreeTruths({ variant }: { variant?: HeroVariant } = {}) {
  const closingRef = useRef(null);
  const closingInView = useInView(closingRef, { once: true, amount: 0.3 });

  return (
    <section id="truths" style={{ background: colors.bgAlt }}>
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '120px 24px',
        }}
      >
        {/* Eyebrow + heading capped at 720px */}
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Eyebrow>THE TRUTH NOBODY TELLS YOU</Eyebrow>

          <h2
            style={{
              fontFamily: typeTokens.display,
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: '-0.015em',
              color: colors.textPrimary,
              margin: 0,
              fontVariationSettings: "'SOFT' 50, 'WONK' 1",
            }}
          >
            Here's what's actually
            <br />
            happening in your job search.
          </h2>
        </div>

        {/* Truth rows */}
        <div style={{ marginTop: 72 }}>
          {TRUTHS.map((truth, i) => (
            <TruthRow key={truth.numeral} truth={truth} index={i} variant={variant} />
          ))}
        </div>

        <motion.p
          ref={closingRef}
          initial={{ opacity: 0, y: 12 }}
          animate={closingInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
          style={{
            fontFamily: typeTokens.display,
            fontSize: '1.125rem',
            fontWeight: 400,
            fontStyle: 'italic',
            color: colors.textSecondary,
            textAlign: 'center',
            marginTop: 32,
            fontVariationSettings: "'SOFT' 50, 'WONK' 1",
          }}
        >
          <em>That system is what we built.</em>
        </motion.p>
      </div>

      <style>{`
        .truth-sketch-col { display: block; }
        @media (max-width: 767px) {
          .truth-sketch-col { display: none; }
          section#truths > div > div:last-child > div {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          section#truths > div { padding: 72px 20px; }
          section#truths > div > div:last-child > div {
            margin-bottom: 64px !important;
          }
        }
      `}</style>
    </section>
  );
}
