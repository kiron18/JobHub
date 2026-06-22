import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, ArrowRight, ArrowUpRight, ScanLine, TrendingUp, Tag, Eye } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { colors, type as typeTokens } from './tokens';
import { scanDiagnosisCopy as C } from './scanDiagnosisCopy';
import { buildGaugeModel, type ScanInput, type GaugeModel } from './scanDiagnosisData';
import AtsScannerVisual from './AtsScannerVisual';

const EASE = [0.25, 1, 0.5, 1] as const;
const BAD = '#C2603F';

type GaugeKey = 'ats' | 'impact' | 'relevance' | 'presentation';
type State = 'good' | 'warn' | 'bad';

// State -> the colour language for the icon chip and accents.
const STATE: Record<State, { fg: string; bg: string }> = {
  good: { fg: colors.success, bg: 'rgba(42,157,111,0.12)' },
  warn: { fg: colors.accentGold, bg: 'rgba(197,160,89,0.18)' },
  bad: { fg: BAD, bg: 'rgba(194,96,63,0.12)' },
};

interface CardConfig {
  key: GaugeKey;
  label: string;
  icon: LucideIcon;
  state: State;
  headline: string;
  sub: string;
}

interface ScanDiagnosisProps {
  result: ScanInput & { scanId: string };
  email: string;
  setEmail: (v: string) => void;
  onSubmitEmail: () => void;
  onClose: () => void;
}

// ── The flip card used inside the Impact modal ───────────────────────────────
function FlipCard({ wrote, instead }: { wrote: string; instead: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped(f => !f)}
      style={{ perspective: 1200, border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', padding: 0 }}
      aria-label="Flip to see the stronger version"
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.55, ease: EASE }}
        style={{ position: 'relative', transformStyle: 'preserve-3d', minHeight: 116 }}
      >
        {/* front */}
        <div style={{ backfaceVisibility: 'hidden', borderRadius: 14, border: `1px solid ${colors.borderDefined}`, background: colors.bgAlt, padding: '16px 18px', textAlign: 'left' }}>
          <span style={{ fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted }}>{C.impact.flipFront}</span>
          <p style={{ fontFamily: typeTokens.body, fontSize: 14.5, lineHeight: 1.5, color: colors.textPrimary, margin: '8px 0 0' }}>"{wrote}"</p>
        </div>
        {/* back */}
        <div style={{ position: 'absolute', inset: 0, transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', borderRadius: 14, border: `1px solid ${colors.success}`, background: 'rgba(42,157,111,0.08)', padding: '16px 18px', textAlign: 'left' }}>
          <span style={{ fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.success }}>{C.impact.flipBack}</span>
          <p style={{ fontFamily: typeTokens.body, fontSize: 14.5, lineHeight: 1.5, color: colors.textPrimary, margin: '8px 0 0' }}>{instead}</p>
        </div>
      </motion.div>
      <p style={{ fontFamily: typeTokens.body, fontSize: 12, color: colors.accentPetrol, fontWeight: 600, margin: '10px 0 0', textAlign: 'center' }}>Tap the card to flip it</p>
    </button>
  );
}

// ── Keyword chips for the Relevance modal (matched green, missing red) ────────
function KeywordChips({ matched, missing }: { matched: string[]; missing: string[] }) {
  const reduce = useReducedMotion();
  const chip = (text: string, kind: 'matched' | 'missing', i: number) => (
    <motion.span
      key={`${kind}-${i}`}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE, delay: reduce ? 0 : i * 0.04 }}
      style={{
        fontFamily: typeTokens.body, fontSize: 13, fontWeight: 500, padding: '7px 13px', borderRadius: 99,
        color: kind === 'matched' ? colors.success : BAD,
        background: kind === 'matched' ? 'rgba(42,157,111,0.10)' : 'rgba(194,96,63,0.08)',
        border: kind === 'matched' ? `1px solid rgba(42,157,111,0.35)` : `1px dashed rgba(194,96,63,0.55)`,
      }}
    >
      {text}
    </motion.span>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {matched.length > 0 && (
        <div>
          <span style={{ fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.success }}>{C.relevance.matchedLabel}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 9 }}>
            {matched.slice(0, 10).map((k, i) => chip(k, 'matched', i))}
          </div>
        </div>
      )}
      {missing.length > 0 && (
        <div>
          <span style={{ fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: BAD }}>{C.relevance.missingLabel}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 9 }}>
            {missing.slice(0, 10).map((k, i) => chip(k, 'missing', matched.length + i))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── The detail modal (pops out, centred, does not push the grid) ─────────────
function DetailModal({ card, m, onClose }: { card: CardConfig; m: GaugeModel; onClose: () => void }) {
  const reduce = useReducedMotion();
  const tone = STATE[card.state];
  const Icon = card.icon;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(26,24,20,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.32, ease: EASE }}
        role="dialog" aria-modal="true" aria-label={card.label}
        style={{ width: '100%', maxWidth: 520, maxHeight: '86vh', overflowY: 'auto', background: colors.bgSurface, borderRadius: 22, border: `1px solid ${colors.borderWhisper}`, boxShadow: '0 24px 70px rgba(26,24,20,0.28)' }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '22px 24px 18px', borderBottom: `1px solid ${colors.borderWhisper}` }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ width: 46, height: 46, borderRadius: 14, background: tone.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={23} color={tone.fg} strokeWidth={2} />
            </span>
            <div>
              <span style={{ fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMuted }}>{card.label}</span>
              <p style={{ fontFamily: typeTokens.body, fontSize: 17, fontWeight: 700, color: colors.textPrimary, margin: '3px 0 0', lineHeight: 1.25 }}>{card.headline}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, padding: 4, flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding: '22px 24px 26px' }}>
          {card.key === 'ats' && (
            <>
              <AtsScannerVisual pass={m.atsPass} />
              <p style={{ fontFamily: typeTokens.body, fontSize: 14, lineHeight: 1.6, color: colors.textSecondary, margin: '16px 0 0' }}>{C.ats.education}</p>
            </>
          )}
          {card.key === 'impact' && (
            m.flipPairs.length > 0 ? (
              <>
                <FlipCard wrote={m.flipPairs[0].wrote} instead={m.flipPairs[0].instead} />
                <p style={{ fontFamily: typeTokens.body, fontSize: 13, color: colors.textMuted, margin: '16px 0 0', textAlign: 'center' }}>{C.impact.caption(m.dutyBullets)}</p>
              </>
            ) : (
              <p style={{ fontFamily: typeTokens.body, fontSize: 14, lineHeight: 1.6, color: colors.textSecondary, margin: 0 }}>{C.impact.caption(m.dutyBullets)}</p>
            )
          )}
          {card.key === 'relevance' && (
            <>
              <KeywordChips matched={m.keywordsMatched} missing={m.keywordsMissing} />
              <p style={{ fontFamily: typeTokens.body, fontSize: 13, lineHeight: 1.55, color: colors.textSecondary, margin: '18px 0 0' }}>{C.relevance.expandLine}</p>
            </>
          )}
          {card.key === 'presentation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {m.presentationItems.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, background: 'rgba(194,96,63,0.12)', color: BAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: typeTokens.body, fontSize: 12, fontWeight: 700, marginTop: 1 }}>{i + 1}</span>
                  <span style={{ fontFamily: typeTokens.body, fontSize: 14.5, lineHeight: 1.5, color: colors.textPrimary }}>{t}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

// ── A single diagnosis card (button). Identical anatomy across all four so the
//    grid aligns perfectly, with a footer cue that signals it opens. ──────────
function DiagnosisCard({ card, index, onOpen }: { card: CardConfig; index: number; onOpen: () => void }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState(false);
  const tone = STATE[card.state];
  const Icon = card.icon;

  return (
    <motion.button
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : 0.06 + index * 0.07 }}
      aria-label={`${card.label}: ${card.headline}. Open the breakdown.`}
      style={{
        display: 'flex', flexDirection: 'column', textAlign: 'left', cursor: 'pointer', width: '100%',
        minHeight: 192, padding: 20, borderRadius: 18, background: colors.bgSurface,
        border: `1px solid ${hover ? colors.accentPetrol : colors.borderWhisper}`,
        boxShadow: hover ? '0 14px 34px rgba(26,24,20,0.12)' : '0 1px 2px rgba(26,24,20,0.04)',
        transform: hover && !reduce ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'border-color 180ms cubic-bezier(0.25,1,0.5,1), box-shadow 180ms cubic-bezier(0.25,1,0.5,1), transform 180ms cubic-bezier(0.25,1,0.5,1)',
        outline: 'none',
      }}
    >
      <span style={{ fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMuted }}>{card.label}</span>

      <div style={{ display: 'flex', gap: 13, marginTop: 14, alignItems: 'flex-start' }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, background: tone.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={22} color={tone.fg} strokeWidth={2} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: typeTokens.body, fontSize: 16.5, fontWeight: 700, lineHeight: 1.3, color: colors.textPrimary, margin: 0 }}>{card.headline}</p>
          <p style={{ fontFamily: typeTokens.body, fontSize: 13, lineHeight: 1.5, color: colors.textSecondary, margin: '6px 0 0' }}>{card.sub}</p>
        </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: `1px solid ${colors.borderWhisper}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: typeTokens.body, fontSize: 12.5, fontWeight: 600, color: colors.accentPetrol }}>{C.expandCue}</span>
        <motion.span
          animate={{ x: hover && !reduce ? 3 : 0, y: hover && !reduce ? -3 : 0 }}
          transition={{ duration: 0.18, ease: EASE }}
          style={{ display: 'inline-flex', color: colors.accentPetrol }}
        >
          <ArrowUpRight size={17} strokeWidth={2.25} />
        </motion.span>
      </div>
    </motion.button>
  );
}

export function ScanDiagnosis({ result, email, setEmail, onSubmitEmail, onClose }: ScanDiagnosisProps) {
  const m: GaugeModel = buildGaugeModel(result);
  const [active, setActive] = useState<GaugeKey | null>(null);
  const [emailHint, setEmailHint] = useState(false);

  const handleSubmit = () => {
    if (!email) { setEmailHint(true); return; }
    setEmailHint(false);
    onSubmitEmail();
  };

  // ── Build the four card configs (single source of truth = perfect alignment) ──
  const outcomeBullets = Math.max(0, m.totalBullets - m.dutyBullets);
  const impactGood = m.dutyBullets === 0 || m.totalBullets === 0;
  const impactState: State = impactGood ? 'good' : m.outcomeFill >= 0.7 ? 'warn' : 'bad';

  const relevanceState: State = m.relevanceBucket === 'strong' ? 'good' : m.relevanceBucket === 'partial' ? 'warn' : 'bad';
  const relevanceLine = m.relevanceBucket === 'strong' ? C.relevance.strong : m.relevanceBucket === 'partial' ? C.relevance.partial : C.relevance.weak;
  const kwExpected = m.keywordsMatched.length + m.keywordsMissing.length;

  const presentationState: State = m.presentationCount === 0 ? 'good' : m.presentationCount <= 2 ? 'warn' : 'bad';

  const cards: CardConfig[] = [
    {
      key: 'ats',
      label: C.labels.ats,
      icon: ScanLine,
      state: m.atsPass ? 'good' : 'bad',
      headline: m.atsPass ? C.ats.passHeadline : C.ats.failHeadline,
      sub: m.atsPass ? C.ats.passSub : C.ats.failSub,
    },
    {
      key: 'impact',
      label: C.labels.impact,
      icon: TrendingUp,
      state: impactState,
      headline: impactGood ? C.impact.allGoodHeadline : C.impact.headline(outcomeBullets, m.totalBullets),
      sub: impactGood ? C.impact.allGoodSub : C.impact.sub(m.dutyBullets),
    },
    {
      key: 'relevance',
      label: C.labels.relevance,
      icon: Tag,
      state: relevanceState,
      headline: kwExpected > 0 ? C.relevance.headline(m.keywordsMatched.length, kwExpected) : 'Keyword match',
      sub: relevanceLine,
    },
    {
      key: 'presentation',
      label: C.labels.presentation,
      icon: Eye,
      state: presentationState,
      headline: m.presentationCount === 0 ? C.presentation.allGoodHeadline : C.presentation.headline(m.presentationCount),
      sub: m.presentationCount === 0 ? C.presentation.allGoodSub : C.presentation.sub,
    },
  ];

  const activeCard = active ? cards.find(c => c.key === active) ?? null : null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: colors.bgCanvas, overflowY: 'auto' }}
    >
      <div style={{ background: `radial-gradient(120% 80% at 50% -10%, ${colors.bgSurface} 0%, ${colors.bgCanvas} 55%)`, minHeight: '100%' }}>
        {/* top bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '20px 24px' }}>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, padding: 6 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 64px' }}>
          {/* header */}
          <h1 style={{ fontFamily: typeTokens.display, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: colors.textPrimary, fontSize: 'clamp(26px, 4.4vw, 40px)', margin: 0 }}>
            {C.header(m.firstName)}
          </h1>
          <p style={{ fontFamily: typeTokens.body, fontSize: 16, lineHeight: 1.6, color: colors.textSecondary, margin: '10px 0 28px' }}>
            {C.subline}
          </p>

          {/* 2x2 gauge grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {cards.map((card, i) => (
              <DiagnosisCard key={card.key} card={card} index={i} onOpen={() => setActive(card.key)} />
            ))}
          </div>

          {/* authority bridge */}
          <h3 style={{ fontFamily: typeTokens.display, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2, color: colors.textPrimary, fontSize: 'clamp(20px, 3vw, 28px)', margin: '40px 0 12px' }}>
            Next Step
          </h3>
          <p style={{ fontFamily: typeTokens.body, fontSize: 16, lineHeight: 1.65, color: colors.textPrimary, margin: 0 }}>
            {C.authorityBridge}
          </p>

          {/* CTA */}
          <div style={{ marginTop: 28, padding: '26px 24px', borderRadius: 20, border: `1px solid ${colors.borderWhisper}`, background: `linear-gradient(180deg, ${colors.bgSurface} 0%, ${colors.bgAlt} 100%)`, boxShadow: '0 1px 2px rgba(26,24,20,0.04)' }}>
            <h2 style={{ fontFamily: typeTokens.display, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.12, color: colors.textPrimary, fontSize: 'clamp(24px, 3.8vw, 34px)', margin: 0 }}>
              {C.cta.headline}<br />{C.cta.headlineLine2}
            </h2>
            <p style={{ fontFamily: typeTokens.body, fontSize: 15.5, lineHeight: 1.6, color: colors.textSecondary, margin: '14px 0 18px' }}>
              {C.cta.body}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="email" value={email}
                onChange={e => { setEmail(e.target.value); if (e.target.value) setEmailHint(false); }}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                placeholder={C.cta.emailPlaceholder}
                style={{ flex: '1 1 240px', fontFamily: typeTokens.body, fontSize: 15, padding: '15px 18px', borderRadius: 14, border: `1px solid ${colors.borderDefined}`, background: colors.bgSurface, color: colors.textPrimary, outline: 'none' }}
              />
              <motion.button
                onClick={handleSubmit}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                animate={{ boxShadow: ['0 0 0 0 rgba(45,90,110,0)', '0 0 0 8px rgba(45,90,110,0.14)', '0 0 0 0 rgba(45,90,110,0)'] }}
                transition={{ boxShadow: { duration: 1.8, ease: EASE, repeat: Infinity, repeatDelay: 0.8 } }}
                style={{ fontFamily: typeTokens.body, fontSize: 16, fontWeight: 700, cursor: 'pointer', padding: '15px 26px', borderRadius: 14, border: 'none', whiteSpace: 'nowrap', background: colors.accentPetrol, color: colors.textOnDeep, display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {C.cta.button} <ArrowRight size={18} />
              </motion.button>
            </div>
            {emailHint && !email && (
              <p style={{ fontFamily: typeTokens.body, fontSize: 12.5, color: colors.accentPetrol, fontWeight: 600, margin: '10px 0 0' }}>{C.cta.emptyNudge}</p>
            )}
            <p style={{ fontFamily: typeTokens.body, fontSize: 11.5, lineHeight: 1.5, color: colors.textMuted, margin: '14px 0 0' }}>{C.cta.honesty}</p>
          </div>
        </div>
      </div>

      {/* detail modal */}
      <AnimatePresence>
        {activeCard && <DetailModal key={activeCard.key} card={activeCard} m={m} onClose={() => setActive(null)} />}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}
