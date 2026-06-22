import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { colors, type as typeTokens } from './tokens';
import { scanDiagnosisCopy as C } from './scanDiagnosisCopy';
import { buildGaugeModel, type ScanInput, type GaugeModel } from './scanDiagnosisData';
import AtsScannerVisual from './AtsScannerVisual';

const EASE = [0.25, 1, 0.5, 1] as const;

interface ScanDiagnosisProps {
  result: ScanInput & { scanId: string };
  email: string;
  setEmail: (v: string) => void;
  onSubmitEmail: () => void;
  onClose: () => void;
}

type GaugeKey = 'ats' | 'impact' | 'relevance' | 'presentation';

// A part-full ring used by impact/relevance/presentation. ATS uses a binary badge.
function Ring({ fill, tone }: { fill: number; tone: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke={colors.borderWhisper} strokeWidth="6" />
      <motion.circle
        cx="32" cy="32" r={r} fill="none" stroke={tone} strokeWidth="6" strokeLinecap="round"
        transform="rotate(-90 32 32)"
        initial={{ strokeDasharray: c, strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, fill))) }}
        transition={{ duration: 0.9, ease: EASE }}
      />
    </svg>
  );
}

function FlipCard({ wrote, instead }: { wrote: string; instead: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped(f => !f)}
      style={{ perspective: 1000, border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', padding: 0 }}
      aria-label="Flip to see the stronger version"
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        style={{ position: 'relative', transformStyle: 'preserve-3d', minHeight: 92 }}
      >
        {/* front */}
        <div style={{ backfaceVisibility: 'hidden', borderRadius: 12, border: `1px solid ${colors.borderDefined}`, background: colors.bgSurface, padding: '14px 16px', textAlign: 'left' }}>
          <span style={{ fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted }}>{C.impact.flipFront}</span>
          <p style={{ fontFamily: typeTokens.body, fontSize: 14, color: colors.textPrimary, margin: '6px 0 0' }}>"{wrote}"</p>
        </div>
        {/* back */}
        <div style={{ position: 'absolute', inset: 0, transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', borderRadius: 12, border: `1px solid ${colors.success}`, background: 'rgba(42,157,111,0.06)', padding: '14px 16px', textAlign: 'left' }}>
          <span style={{ fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.success }}>{C.impact.flipBack}</span>
          <p style={{ fontFamily: typeTokens.body, fontSize: 14, color: colors.textPrimary, margin: '6px 0 0' }}>{instead}</p>
        </div>
      </motion.div>
    </button>
  );
}

export function ScanDiagnosis({ result, email, setEmail, onSubmitEmail, onClose }: ScanDiagnosisProps) {
  const m: GaugeModel = buildGaugeModel(result);
  const [open, setOpen] = useState<GaugeKey | null>(null);
  const [emailHint, setEmailHint] = useState(false);

  const toggle = (k: GaugeKey) => setOpen(o => (o === k ? null : k));

  const relevanceLine =
    m.relevanceBucket === 'strong' ? C.relevance.strong :
    m.relevanceBucket === 'partial' ? C.relevance.partial : C.relevance.weak;

  const handleSubmit = () => {
    if (!email) { setEmailHint(true); return; }
    setEmailHint(false);
    onSubmitEmail();
  };

  const tileBase: React.CSSProperties = {
    borderRadius: 16, border: `1px solid ${colors.borderWhisper}`, background: colors.bgSurface,
    padding: 18, textAlign: 'left', cursor: 'pointer', width: '100%',
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: colors.textMuted,
  };
  const verdictStyle: React.CSSProperties = {
    fontFamily: typeTokens.body, fontSize: 14.5, lineHeight: 1.45, color: colors.textPrimary, margin: '10px 0 0',
  };

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

        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px 64px' }}>
          {/* header */}
          <h1 style={{ fontFamily: typeTokens.display, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: colors.textPrimary, fontSize: 'clamp(26px, 4.4vw, 40px)', margin: 0 }}>
            {C.header(m.firstName)}
          </h1>
          <p style={{ fontFamily: typeTokens.body, fontSize: 16, lineHeight: 1.6, color: colors.textSecondary, margin: '10px 0 28px' }}>
            {C.subline}
          </p>

          {/* 2x2 gauge grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {/* ATS tile (binary) */}
            <GaugeTile open={open === 'ats'} onClick={() => toggle('ats')} tileBase={tileBase}>
              <span style={labelStyle}>{C.labels.ats}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: m.atsPass ? 'rgba(42,157,111,0.12)' : 'rgba(194,96,63,0.12)' }}>
                  {m.atsPass ? <Check size={17} color={colors.success} /> : <AlertTriangle size={16} color="#C2603F" />}
                </span>
                <span style={verdictStyle}>{m.atsPass ? C.ats.pass : C.ats.fail}</span>
              </div>
            </GaugeTile>

            {/* Impact tile */}
            <GaugeTile open={open === 'impact'} onClick={() => toggle('impact')} tileBase={tileBase}>
              <span style={labelStyle}>{C.labels.impact}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                <Ring fill={m.outcomeFill} tone={colors.accentPetrol} />
                <span style={verdictStyle}>
                  {m.dutyBullets === 0 ? C.impact.allGood : C.impact.verdict(m.dutyBullets, m.totalBullets)}
                </span>
              </div>
            </GaugeTile>

            {/* Relevance tile */}
            <GaugeTile open={open === 'relevance'} onClick={() => toggle('relevance')} tileBase={tileBase}>
              <span style={labelStyle}>{C.labels.relevance}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                <Ring fill={m.relevanceFill} tone={colors.accentPetrol} />
                <span style={verdictStyle}>{relevanceLine}</span>
              </div>
            </GaugeTile>

            {/* Presentation tile */}
            <GaugeTile open={open === 'presentation'} onClick={() => toggle('presentation')} tileBase={tileBase}>
              <span style={labelStyle}>{C.labels.presentation}</span>
              <span style={verdictStyle}>
                {m.presentationCount === 0 ? C.presentation.allGood : C.presentation.verdict(m.presentationCount)}
              </span>
            </GaugeTile>
          </div>

          {/* expansion area */}
          <AnimatePresence mode="wait">
            {open && (
              <motion.div
                key={open}
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                style={{ overflow: 'hidden', marginTop: 14 }}
              >
                <div style={{ borderRadius: 16, border: `1px solid ${colors.borderWhisper}`, background: colors.bgSurface, padding: 18 }}>
                  {open === 'ats' && (
                    <>
                      <AtsScannerVisual pass={m.atsPass} />
                      <p style={{ fontFamily: typeTokens.body, fontSize: 13.5, lineHeight: 1.55, color: colors.textSecondary, margin: '12px 0 0' }}>{C.ats.education}</p>
                    </>
                  )}
                  {open === 'impact' && (
                    m.flipPairs.length > 0 ? (
                      <>
                        <FlipCard wrote={m.flipPairs[0].wrote} instead={m.flipPairs[0].instead} />
                        <p style={{ fontFamily: typeTokens.body, fontSize: 12.5, color: colors.textMuted, margin: '10px 0 0', textAlign: 'center' }}>{C.impact.caption(m.dutyBullets)}</p>
                      </>
                    ) : (
                      <p style={{ fontFamily: typeTokens.body, fontSize: 13.5, color: colors.textSecondary, margin: 0 }}>{C.impact.caption(m.dutyBullets)}</p>
                    )
                  )}
                  {open === 'relevance' && (
                    <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {m.keywordsMissing.slice(0, 8).map((k, i) => (
                          <span key={i} style={{ fontFamily: typeTokens.body, fontSize: 12.5, padding: '6px 12px', borderRadius: 99, border: `1px dashed ${colors.borderDefined}`, color: colors.textMuted }}>{k}</span>
                        ))}
                      </div>
                      <p style={{ fontFamily: typeTokens.body, fontSize: 13, color: colors.textSecondary, margin: '12px 0 0' }}>{C.relevance.expandLine}</p>
                    </>
                  )}
                  {open === 'presentation' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {m.presentationItems.map((t, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C5A059', marginTop: 7, flexShrink: 0 }} />
                          <span style={{ fontFamily: typeTokens.body, fontSize: 14, color: colors.textPrimary }}>{t}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* authority bridge */}
          <p style={{ fontFamily: typeTokens.body, fontSize: 16, lineHeight: 1.65, color: colors.textPrimary, margin: '36px 0 0' }}>
            {C.authorityBridge}
          </p>

          {/* CTA */}
          <div style={{ marginTop: 28, padding: '24px 22px', borderRadius: 18, border: `1px solid ${colors.borderWhisper}`, background: colors.bgSurface }}>
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
                animate={{ boxShadow: ['0 0 0 0 rgba(45,90,110,0)', '0 0 0 8px rgba(45,90,110,0.14)', '0 0 0 0 rgba(45,90,110,0)'] }}
                transition={{ duration: 1.8, ease: EASE, repeat: Infinity, repeatDelay: 0.8 }}
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
    </motion.div>,
    document.body,
  );
}

// Tile wrapper: a focusable button that visually lifts when open.
function GaugeTile({ open, onClick, tileBase, children }: { open: boolean; onClick: () => void; tileBase: React.CSSProperties; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      style={{ ...tileBase, boxShadow: open ? '0 8px 24px rgba(26,24,20,0.10)' : 'none', borderColor: open ? colors.accentPetrol : colors.borderWhisper, outline: 'none' }}
    >
      {children}
    </button>
  );
}
