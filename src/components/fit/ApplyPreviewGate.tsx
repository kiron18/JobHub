/**
 * What a free account sees when it asks us to write the application.
 *
 * The sequence is deliberate and it is the whole pitch: they paste a job, we
 * give them a straight answer about it for nothing, and when they say "write it
 * then", the machine runs, a document appears, and it is theirs the moment they
 * pay. Nothing here is a trick played on them: the wait is real work being
 * described honestly (it is what a paid run actually does, in the order it does
 * it), and the page behind the offer is their own resume, not a fabricated one.
 *
 * NOTHING IS GENERATED HERE. No LLM call is made, and no document is written,
 * for an account that cannot have it. The blurred page is the candidate's own
 * baseline resume, which they already own and were emailed, standing in for the
 * tailored version they are being offered. That distinction matters if this is
 * ever changed: showing a real generation and then withholding it would burn
 * both the credits and the trust.
 *
 * A paying account never reaches this component. FitCheckPage sends them to the
 * real workspace instead.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { X, Check, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { type as landingType } from '../landing/tokens';
import { trackUpgradeModalOpened, trackCheckoutStarted, trackFreeLimitHit } from '../../lib/analytics';

const C = warm.colors;
const EASE = [0.25, 1, 0.5, 1] as const;

/**
 * The build sequence, in the order a paid run actually performs it.
 *
 * Keep these honest. The moment a line describes something the paid product
 * does not do, the free user who buys on the strength of it has been sold
 * something else, and they find out on their first real generation.
 */
const BUILD_LINES = [
  'Reading the ad line by line.',
  'Matching it against your experience.',
  'Rewriting your resume for this employer.',
  'Writing the cover letter that answers this ad.',
  'Checking every claim against your own history.',
] as const;

const BUILD_LINE_MS = 1100;

/* ─── The offer ────────────────────────────────────────────────────────────── */

/**
 * All of the offer's wording lives here, in one block, because it is the part
 * that gets rewritten most and it should never require reading JSX to edit.
 *
 * The claims are deliberately about what the product does and what it costs,
 * never about outcomes we cannot measure. No invented success rates, no "3x
 * more interviews", and no countdown, because a fake deadline in front of
 * somebody who has been rejected forty times costs more than it earns. If a
 * real one ever exists (a price rise, a cohort date), it can be said plainly.
 */
const OFFER = {
  /*
   * The headline is the one sentence a competitor cannot copy.
   *
   * Everyone in this market tells a job seeker their resume is the problem. We
   * have just told this person, for free, that a job was not worth their time.
   * Naming that is the whole pitch: what they are buying is the judgement they
   * have already had a demonstration of.
   */
  title: 'We just told you not to apply for a job.',
  subtitle:
    'That is what you are paying for. Your application for this role is already written. Unlock it, and every one after it, for the next 30 days.',

  /*
   * Anchored values, one line each, every one a thing that is actually built.
   * If a line is ever cut from the product, cut it from here the same day: a
   * stack that oversells by one line is a refund request with a receipt.
   */
  stack: [
    { item: 'A resume rewritten for every job you paste', value: '$600' },
    { item: 'A cover letter that answers each ad', value: '$300' },
    { item: 'Selection criteria for government and council roles', value: '$300' },
    { item: 'Interview prep that runs during the call', value: '$250' },
    { item: 'Follow-up emails, written and scheduled', value: '$150' },
    { item: 'Tracker, daily target and the community', value: '$350' },
  ],
  stackTotal: '$1,950',

  priceWas: '$1,950',
  priceNow: '$197 today',
  priceLine: 'One payment. Not a subscription, and nothing to cancel.',
  /* Only true at 30 days: $197 over about 4.3 weeks. If the window ever moves,
     this line moves with it, and PAID_ACCESS_DAYS on the server decides it. */
  anchor: 'Less than $50 per week.',

  /*
   * One sentence, and the conditions one tap away on the terms page.
   *
   * The conditions are real and they are enforced (ten applications and five
   * outreach messages a day, read off their own tracker), but a paragraph of
   * qualifiers inside the box kills the reassurance the guarantee exists to
   * give. What it must never be is undisclosed: a guarantee advertised without
   * its conditions and then refused on them is misleading conduct under
   * Australian Consumer Law, which is why the link is here and not omitted.
   */
  guaranteeName: '7-day money-back guarantee',
  guarantee: 'Use it properly for a week. If it does nothing for you, ask and you get your money back.',
  guaranteeLink: 'What counts as using it',
  guaranteeHref: '/legal/refunds',

  cta: 'Unlock everything · $197',
  ctaSub: 'Afterpay and Zip both work at checkout.',
  decline: 'No thanks, I will keep doing it by hand',
} as const;

interface Props {
  /** The candidate's own baseline resume, blurred behind the offer. */
  resumeMarkdown: string;
  /** For the line that names what was built, when the report knew them. */
  role?: string | null;
  company?: string | null;
  onClose: () => void;
}

export function ApplyPreviewGate({ resumeMarkdown, role, company, onClose }: Props) {
  const [phase, setPhase] = useState<'building' | 'offer'>('building');
  const [line, setLine] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (phase !== 'building') return;
    if (line >= BUILD_LINES.length - 1) {
      const done = window.setTimeout(() => setPhase('offer'), BUILD_LINE_MS);
      return () => window.clearTimeout(done);
    }
    const id = window.setTimeout(() => setLine((n) => n + 1), BUILD_LINE_MS);
    return () => window.clearTimeout(id);
  }, [phase, line]);

  useEffect(() => {
    if (phase !== 'offer') return;
    trackUpgradeModalOpened('generation');
    trackFreeLimitHit('generation');
  }, [phase]);

  async function checkout() {
    trackCheckoutStarted('three_month');
    setLoading(true);
    try {
      const { data } = await api.post('/stripe/checkout', { plan: 'three_month' });
      window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  }

  const forWhat = [role, company].filter(Boolean).join(' at ');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 120,
      background: C.bgCanvas, overflow: 'hidden',
    }}>
      {/*
        Their own resume, unreadable on purpose. aria-hidden and inert: it is
        wallpaper, and a screen reader walking a blurred document is nobody's
        idea of an offer.
      */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, padding: '40px 24px', overflow: 'hidden',
          filter: 'blur(7px)', opacity: 0.55, userSelect: 'none', pointerEvents: 'none',
        }}
      >
        <div style={{
          maxWidth: 680, margin: '0 auto', background: '#fff', borderRadius: 14,
          border: `1px solid ${C.borderWhisper}`, padding: '40px 44px',
          fontFamily: warm.type.fontBody, fontSize: 14.5, lineHeight: 1.65, color: '#1a2230',
        }}>
          <ReactMarkdown>{resumeMarkdown}</ReactMarkdown>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'building' ? (
          <motion.div
            key="building"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24,
            }}
          >
            <Loader2 size={30} className="animate-spin" style={{ color: C.accentPetrol }} />
            <p style={{
              margin: '20px 0 0', fontFamily: landingType.display, fontWeight: 600,
              fontSize: 'clamp(20px, 3.4vw, 26px)', color: C.textPrimary,
            }}>
              {forWhat ? `Writing your application for ${forWhat}` : 'Writing your application'}
            </p>
            <div style={{ minHeight: 26, marginTop: 10 }}>
              <AnimatePresence mode="wait">
                <motion.p
                  key={line}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  style={{ margin: 0, fontSize: 15, color: C.textSecondary }}
                >
                  {BUILD_LINES[line]}
                </motion.p>
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="offer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: 24, overflowY: 'auto',
              background: 'rgba(15,32,56,0.34)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.32, ease: EASE }}
              role="dialog"
              aria-modal="true"
              aria-label="Unlock your application"
              style={{
                position: 'relative', width: '100%', maxWidth: 560, margin: 'auto',
                background: C.bgSurface, border: `1px solid ${C.borderDefined}`,
                borderRadius: 22, padding: 'clamp(26px, 4vw, 34px)',
                boxShadow: warm.shadow.lifted,
              }}
            >
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  position: 'absolute', top: 14, right: 14, background: 'none', border: 'none',
                  color: C.textMuted, cursor: 'pointer', padding: 8, borderRadius: 8,
                  display: 'flex', alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>

              {/* One step from hired: the same track they have seen twice, at its end. */}
              <div style={{
                borderRadius: warm.radius.card, overflow: 'hidden', background: '#fff',
                border: `1px solid ${C.borderWhisper}`, aspectRatio: '1920 / 820',
                maxWidth: 420, margin: '0 auto 20px',
              }}>
                <img
                  src="/Assets/journey/step-5-of-5.png"
                  alt="Your progress: the last step before hired"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 38%', display: 'block' }}
                />
              </div>

              <h2 style={{
                margin: '0 0 8px', fontFamily: landingType.display, fontWeight: 700,
                fontSize: 'clamp(22px, 4.2vw, 28px)', letterSpacing: '-0.02em',
                lineHeight: 1.22, color: C.textPrimary,
              }}>
                {OFFER.title}
              </h2>
              <p style={{ margin: '0 0 18px', fontSize: 15.5, lineHeight: 1.6, color: C.textSecondary }}>
                {OFFER.subtitle}
              </p>

              <ul style={{ listStyle: 'none', margin: '0 0 10px', padding: 0, display: 'grid', gap: 9 }}>
                {OFFER.stack.map(({ item, value }) => (
                  <li key={item} style={{
                    display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: 10, alignItems: 'start',
                  }}>
                    <span style={{ color: C.success, marginTop: 2 }}>
                      <Check size={15} strokeWidth={3} />
                    </span>
                    <span style={{ fontSize: 14.5, lineHeight: 1.5, color: C.textPrimary }}>{item}</span>
                    <span style={{
                      fontSize: 13, color: C.textMuted, whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums', paddingLeft: 8,
                    }}>
                      {value}
                    </span>
                  </li>
                ))}
              </ul>

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
                borderTop: `1px solid ${C.borderDefined}`, paddingTop: 10, marginBottom: 16,
                fontSize: 12.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.textMuted,
              }}>
                <span>Total value</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>{OFFER.stackTotal}</span>
              </div>

              <div style={{
                padding: '14px 16px', marginBottom: 16, borderRadius: 12,
                background: C.bgAlt, border: `1px solid ${C.borderDefined}`,
              }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.textPrimary }}>
                  <span style={{ textDecoration: 'line-through', color: C.textMuted, fontWeight: 600 }}>
                    {OFFER.priceWas}
                  </span>
                  {'  '}{OFFER.priceNow}
                </p>
                <p style={{ margin: '5px 0 0', fontSize: 14, lineHeight: 1.55, color: C.textSecondary }}>
                  {OFFER.priceLine}
                </p>
                <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.55, color: C.textMuted }}>
                  {OFFER.anchor}
                </p>
              </div>

              <div style={{
                padding: '13px 16px', marginBottom: 18, borderRadius: 12,
                background: 'rgba(18,128,92,0.07)', borderLeft: `3px solid ${C.success}`,
              }}>
                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: C.textPrimary }}>
                  {OFFER.guaranteeName}
                </p>
                <p style={{ margin: '5px 0 0', fontSize: 14, lineHeight: 1.55, color: C.textSecondary }}>
                  {OFFER.guarantee}{' '}
                  <a
                    href={OFFER.guaranteeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: C.accentPetrol, fontWeight: 600 }}
                  >
                    {OFFER.guaranteeLink}
                  </a>
                </p>
              </div>

              <button
                type="button"
                onClick={checkout}
                disabled={loading}
                style={{
                  width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  gap: 9, padding: '15px 24px', background: C.accentPetrol, color: C.textOnDeep,
                  border: 'none', borderRadius: warm.radius.button, fontSize: 16, fontWeight: 700,
                  fontFamily: 'inherit', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
                  boxShadow: '0 1px 2px rgba(16,24,40,0.06), 0 6px 18px rgba(18,87,196,0.20)',
                }}
              >
                {loading ? <Loader2 size={17} className="animate-spin" /> : OFFER.cta}
              </button>
              <p style={{ margin: '10px 0 0', fontSize: 13, textAlign: 'center', color: C.textMuted }}>
                {OFFER.ctaSub}
              </p>

              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    fontSize: 13.5, color: C.textMuted, fontFamily: 'inherit', textDecoration: 'underline',
                  }}
                >
                  {OFFER.decline}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
