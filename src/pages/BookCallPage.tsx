/* ────────────────────────────────────────────────────────────────────────────
   BookCallPage — pre-framing / trust page for the free strategy call
   Route: /book-a-call  (public, non-destructive)

   Single goal: get an international graduate to click through and book a
   30-minute strategy call. Everything on the page exists to lower the
   perceived risk of that one click.

   Booking link: the CTA opens BOOKING_URL in a new tab. Set BOOKING_URL below
   to the real scheduling link (Calendly / Cal.com / etc) before going live.
   ──────────────────────────────────────────────────────────────────────────── */
import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, Clock, Compass, MessageSquare, X, Upload, Loader2 } from 'lucide-react';
import { colors, type as typeTokens } from '../components/landing/tokens';
import { trackBookCallCtaClicked } from '../lib/analytics';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

// ── Booking destination ───────────────────────────────────────────────────────
// Live Calendly for Aussie Grad Careers (30 min strategy call, weekdays 3-5pm).
const BOOKING_URL = 'https://calendly.com/kiron-aussiegradcareers';

const EASE = [0.25, 1, 0.5, 1] as const;

// ── shared helpers (kept local; mirror the landing page patterns) ─────────────

const display = (extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: typeTokens.display, fontWeight: 500, color: colors.textPrimary,
  fontVariationSettings: "'SOFT' 50, 'WONK' 1", letterSpacing: '-0.015em', ...extra,
});

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: typeTokens.body, fontSize: '0.75rem', fontWeight: 600,
      letterSpacing: '0.18em', textTransform: 'uppercase', color: colors.textMuted,
    }}>{children}</span>
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

function BookButton({ position, label, small, onClick }: { position: 'hero' | 'mid' | 'final'; label: string; small?: boolean; onClick?: () => void }) {
  const handle = () => {
    trackBookCallCtaClicked(position);
    if (onClick) onClick();
    else window.open(BOOKING_URL, '_blank', 'noopener,noreferrer');
  };
  return (
    <button
      onClick={handle}
      style={{
        background: colors.accentPetrol, color: colors.textOnDeep,
        padding: small ? '12px 24px' : '16px 32px', borderRadius: 10, border: 'none',
        fontWeight: 600, fontSize: small ? '0.9375rem' : '1.0625rem', fontFamily: typeTokens.body,
        letterSpacing: '-0.005em', cursor: 'pointer', lineHeight: 1, whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', gap: 9,
        boxShadow: '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)',
        transition: 'transform 180ms cubic-bezier(0.25,1,0.5,1), box-shadow 180ms cubic-bezier(0.25,1,0.5,1)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(26,24,20,0.06), 0 8px 24px rgba(45,90,110,0.22)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)';
      }}
    >
      {label} <ArrowRight size={small ? 16 : 18} strokeWidth={2.2} />
    </button>
  );
}

// ── intake modal ──────────────────────────────────────────────────────────────

const VISA_OPTIONS = ['Student visa (500)', '482 TSS', '485 Graduate', 'TR/Bridging', 'PR', 'Citizen', 'Other'];

const inputStyle: React.CSSProperties = {
  fontFamily: typeTokens.body, fontSize: '0.9375rem', color: colors.textPrimary,
  background: colors.bgCanvas, border: `1px solid ${colors.borderWhisper}`,
  borderRadius: 8, padding: '10px 14px', width: '100%', outline: 'none',
  boxSizing: 'border-box', lineHeight: 1.5,
};

const labelStyle: React.CSSProperties = {
  fontFamily: typeTokens.body, fontSize: '0.8125rem', fontWeight: 600,
  color: colors.textSecondary, display: 'block', marginBottom: 6,
};

function IntakeModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    name: '', email: '', visaStatus: '', biggestChallenge: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const proceed = useCallback(() => {
    window.open(BOOKING_URL, '_blank', 'noopener,noreferrer');
    onClose();
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;

    setStatus('submitting');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    if (file) fd.append('resume', file);

    try {
      await fetch(`${API_BASE}/bookings/intake`, { method: 'POST', body: fd });
    } catch {
      // Non-fatal — still send them to Calendly
    }

    proceed();
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(26,24,20,0.72)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
          onClick={e => e.stopPropagation()}
          style={{
            background: colors.bgCanvas, borderRadius: 16, padding: '32px 28px',
            width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 8px 40px rgba(26,24,20,0.22)',
            border: `1px solid ${colors.borderWhisper}`,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <span style={labelStyle}>One quick step</span>
              <h2 style={{ fontFamily: typeTokens.display, fontSize: '1.4rem', fontWeight: 500, margin: 0, color: colors.textPrimary, letterSpacing: '-0.015em' }}>
                Help me prep for your call
              </h2>
              <p style={{ fontFamily: typeTokens.body, fontSize: '0.875rem', color: colors.textMuted, margin: '6px 0 0', lineHeight: 1.5 }}>
                Takes 60 seconds. The more you share, the more useful the call.
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: colors.textMuted, lineHeight: 0 }}>
              <X size={20} strokeWidth={2} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name + Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Name <span style={{ color: "#c0392b" }}>*</span></label>
                  <input required placeholder="Jane Smith" style={inputStyle} {...field('name')} />
                </div>
                <div>
                  <label style={labelStyle}>Email <span style={{ color: "#c0392b" }}>*</span></label>
                  <input required type="email" placeholder="jane@example.com" style={inputStyle} {...field('email')} />
                </div>
              </div>

              {/* Visa */}
              <div>
                <label style={labelStyle}>Visa status <span style={{ color: colors.textMuted, fontWeight: 400 }}>(optional)</span></label>
                <select style={{ ...inputStyle, appearance: 'none' }} {...field('visaStatus')}>
                  <option value="">Select…</option>
                  {VISA_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              {/* Biggest challenge */}
              <div>
                <label style={labelStyle}>Biggest challenge right now <span style={{ color: colors.textMuted, fontWeight: 400 }}>(optional)</span></label>
                <textarea
                  rows={3}
                  placeholder="e.g. I've sent 80 applications and heard nothing back..."
                  style={{ ...inputStyle, resize: 'vertical' }}
                  {...field('biggestChallenge')}
                />
              </div>

              {/* Resume upload */}
              <div>
                <label style={labelStyle}>Resume <span style={{ color: colors.textMuted, fontWeight: 400 }}>(optional — PDF or DOCX)</span></label>
                <input ref={fileRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }}
                  onChange={e => setFile(e.target.files?.[0] || null)} />
                <button type="button"
                  onClick={() => fileRef.current?.click()}
                  style={{
                    ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                    color: file ? colors.textPrimary : colors.textMuted, textAlign: 'left',
                  }}
                >
                  <Upload size={15} strokeWidth={2} />
                  {file ? file.name : 'Click to upload resume'}
                </button>
              </div>

              {status === 'error' && (
                <p style={{ fontFamily: typeTokens.body, fontSize: '0.875rem', color: "#c0392b", margin: 0 }}>
                  Something went wrong — but you can still book your call below.
                </p>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  style={{
                    flex: 1, background: colors.accentPetrol, color: colors.textOnDeep,
                    padding: '13px 20px', borderRadius: 10, border: 'none', fontWeight: 600,
                    fontSize: '1rem', fontFamily: typeTokens.body, cursor: status === 'submitting' ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: status === 'submitting' ? 0.7 : 1,
                  }}
                >
                  {status === 'submitting'
                    ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                    : <>Book my call <ArrowRight size={16} strokeWidth={2.2} /></>}
                </button>
                <button type="button" onClick={proceed}
                  style={{
                    padding: '13px 16px', borderRadius: 10, border: `1px solid ${colors.borderWhisper}`,
                    background: 'none', fontFamily: typeTokens.body, fontSize: '0.875rem',
                    color: colors.textMuted, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  Skip
                </button>
              </div>
              <p style={{ fontFamily: typeTokens.body, fontSize: '0.75rem', color: colors.textMuted, margin: 0, textAlign: 'center' }}>
                Your info is only ever seen by Kiron. Never shared, never sold.
              </p>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── content ───────────────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: Compass,
    title: 'We diagnose the real blocker',
    body: 'In the first ten minutes, we name it. Not your resume. Not your cover letter. The actual reason your search has stalled — and why it is almost never what candidates think it is.',
  },
  {
    icon: MessageSquare,
    title: 'We build your exact playbook',
    body: 'Australian-specific moves, sequenced for your visa, your background, and your target market. Not a generic list — a plan built in the room, for your situation.',
  },
  {
    icon: Check,
    title: 'You decide what comes next',
    body: 'Some graduates choose to go further with us. Others run the plan themselves and get results. Either way, you leave the call knowing exactly what to do.',
  },
];

const WALKAWAY = [
  'The exact reason your applications are going quiet — named, not guessed',
  'Your 3 highest-leverage moves, prioritised in the order that actually shifts things',
  'A realistic timeline built around your visa, your background, and your market',
  'The Australian-specific moves most international graduates never find out about',
];

const FAQS = [
  {
    q: 'Is it really free?',
    a: 'Yes. The call is free because it is genuinely useful, and it is how we meet the people we end up working with closely. You will get real value from it regardless of what happens after.',
  },
  {
    q: 'Will you try to sell me something?',
    a: 'If there is a clear fit for our program, we will say so once, at the end. Most people find it immediately obvious whether it is right for them or not. We do not need to push — the results speak for themselves.',
  },
  {
    q: 'I have only just started. Is it too soon?',
    a: 'It is never too soon. The earlier you understand the rules, the less damage you do in those first months. The graduates who call us early build momentum fast. The ones who wait spend the first part of the conversation undoing months of the wrong approach.',
  },
  {
    q: 'Does my visa situation matter?',
    a: 'Yes, and we account for it. Every move we recommend is built around what you can actually do on your visa in Australia. We are not migration agents — for legal questions we refer you to the right people — but we know how to work within your situation.',
  },
];

// ── page ────────────────────────────────────────────────────────────────────

export function BookCallPage() {
  const navigate = useNavigate();
  const [showIntake, setShowIntake] = useState(false);
  const openIntake = useCallback(() => setShowIntake(true), []);

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: colors.bgCanvas, color: colors.textPrimary }}>
      {showIntake && <IntakeModal onClose={() => setShowIntake(false)} />}
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '18px 24px', background: colors.bgCanvas,
        borderBottom: `1px solid ${colors.borderWhisper}`,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span style={display({ fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.01em' })}>
            Aussie&nbsp;Grad&nbsp;<span style={{ color: colors.accentGold }}>Careers</span>
          </span>
        </button>
        <button
          onClick={() => navigate('/auth?intent=signin')}
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

      {/* Hero */}
      <section style={{ padding: '80px 24px 72px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <Eyebrow>Free strategy call — limited spots each week</Eyebrow>
            <h1 style={display({ fontSize: 'clamp(2.3rem, 5vw, 3.5rem)', lineHeight: 1.05, margin: '18px auto 0', maxWidth: 660 })}>
              You have been applying. The silence is not random. One call changes that.
            </h1>
            <p style={{
              fontFamily: typeTokens.body, fontSize: '1.1875rem', lineHeight: 1.65,
              color: colors.textSecondary, margin: '22px auto 0', maxWidth: 560,
            }}>
              Most international graduates spend months applying to the wrong roles in the wrong way —
              and are never told the real reason nothing is moving. Thirty minutes with someone
              who has been through it, and helped hundreds do the same, changes the equation.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 36 }}>
              <BookButton position="hero" label="Claim my strategy call" onClick={openIntake} />
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
              <Clock size={14} color={colors.textMuted} strokeWidth={1.8} />
              <span style={{ fontFamily: typeTokens.body, fontSize: '0.8125rem', color: colors.textMuted }}>
                Free · 30 minutes · Built for international graduates in Australia
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* What happens on the call */}
      <section style={{ background: colors.bgSurface, borderTop: `1px solid ${colors.borderWhisper}`, borderBottom: `1px solid ${colors.borderWhisper}`, padding: '72px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Reveal>
            <Eyebrow>What happens on the call</Eyebrow>
            <h2 style={display({ fontSize: 'clamp(1.7rem, 3.2vw, 2.3rem)', lineHeight: 1.1, margin: '14px 0 0', maxWidth: 560 })}>
              In 30 minutes, we do the work most job seekers spend six months guessing at.
            </h2>
          </Reveal>

          <div className="step-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28, marginTop: 44 }}>
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <Reveal key={s.title} delay={i * 0.08}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, background: 'rgba(45,90,110,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={20} color={colors.accentPetrol} strokeWidth={2} />
                    </div>
                    <span style={{ fontFamily: typeTokens.body, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMuted }}>
                      Step {i + 1}
                    </span>
                    <h3 style={display({ fontSize: '1.1875rem', lineHeight: 1.2, margin: 0 })}>{s.title}</h3>
                    <p style={{ fontFamily: typeTokens.body, fontSize: '0.9375rem', lineHeight: 1.6, color: colors.textSecondary, margin: 0 }}>
                      {s.body}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* What you'll walk away with */}
      <section style={{ padding: '72px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Reveal>
            <Eyebrow>What you walk away with</Eyebrow>
            <h2 style={display({ fontSize: 'clamp(1.7rem, 3.2vw, 2.3rem)', lineHeight: 1.1, margin: '14px 0 28px', maxWidth: 560 })}>
              Clarity you have not had since you started.
            </h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {WALKAWAY.map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%', background: 'rgba(42,157,111,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                  }}>
                    <Check size={13} color={colors.success} strokeWidth={2.6} />
                  </span>
                  <span style={{ fontFamily: typeTokens.body, fontSize: '1.0625rem', lineHeight: 1.5, color: colors.textSecondary }}>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Who you'll be talking to */}
      <section style={{ background: colors.bgAlt, padding: '72px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Reveal>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: colors.bgDeep,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={display({ fontSize: '1.5rem', color: colors.accentGold })}>K</span>
              </div>
              <div>
                <Eyebrow>Who you will be talking to</Eyebrow>
                <p style={{ fontFamily: typeTokens.body, fontSize: '1rem', fontWeight: 700, color: colors.textPrimary, margin: '6px 0 0' }}>
                  Kiron, founder of Aussie Grad Careers
                </p>
              </div>
            </div>
            <p style={{ fontFamily: typeTokens.body, fontSize: '1.0625rem', lineHeight: 1.65, color: colors.textSecondary, margin: 0 }}>
              I came to Australia as an international student. I know what it feels like
              to send application after application and hear nothing back — and to have no
              idea why. The moment I understood the actual rules of the Australian job
              market, everything changed. Callbacks, interviews, an offer I did not think
              was possible. I built Aussie Grad Careers to shortcut that learning curve for
              every international graduate who comes after me. This call is that shortcut.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Objection handling */}
      <section style={{ padding: '72px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Reveal>
            <Eyebrow>Before you book</Eyebrow>
            <h2 style={display({ fontSize: 'clamp(1.7rem, 3.2vw, 2.3rem)', lineHeight: 1.1, margin: '14px 0 32px' })}>
              The honest answers.
            </h2>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {FAQS.map((f, i) => (
              <Reveal key={f.q} delay={i * 0.05}>
                <div>
                  <h3 style={{ fontFamily: typeTokens.body, fontSize: '1.0625rem', fontWeight: 700, color: colors.textPrimary, margin: '0 0 6px' }}>
                    {f.q}
                  </h3>
                  <p style={{ fontFamily: typeTokens.body, fontSize: '1rem', lineHeight: 1.65, color: colors.textSecondary, margin: 0 }}>
                    {f.a}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* What happens for graduates who go further — presell */}
      <section style={{ background: colors.bgDeep, padding: '80px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <Reveal>
            <span style={{
              fontFamily: typeTokens.body, fontSize: '0.75rem', fontWeight: 600,
              letterSpacing: '0.18em', textTransform: 'uppercase', color: colors.accentGold,
            }}>For graduates who want to go further</span>
            <h2 style={display({ fontSize: 'clamp(1.7rem, 3.2vw, 2.2rem)', lineHeight: 1.15, margin: '14px 0 20px', color: colors.bgCanvas })}>
              The call is the beginning, not the end.
            </h2>
            <p style={{ fontFamily: typeTokens.body, fontSize: '1.0625rem', lineHeight: 1.7, color: 'rgba(250,247,242,0.72)', margin: 0 }}>
              Most graduates who do this call walk away with more clarity than they have had
              in months. Some of them — the ones who want to move faster, with structure and
              support — choose to work with us more closely. Our program takes you through
              every stage of the Australian job search in a coached environment alongside
              other internationals doing exactly the same thing. If that is the right fit
              for you, we will say so at the end of the call. If it is not, we will tell
              you that too.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ background: colors.bgSurface, borderTop: `1px solid ${colors.borderWhisper}`, padding: '96px 24px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <Eyebrow>There are only a few spots available each week</Eyebrow>
            <h2 style={display({ fontSize: 'clamp(2rem, 4vw, 2.8rem)', lineHeight: 1.1, margin: '14px auto 0', maxWidth: 520 })}>
              Your search does not have to stay stuck.
            </h2>
            <p style={{ fontFamily: typeTokens.body, fontSize: '1.125rem', lineHeight: 1.65, color: colors.textSecondary, margin: '18px auto 0', maxWidth: 480 }}>
              Every week you spend applying without a plan is a week you will not get back.
              Thirty minutes from now, you could know exactly what is in the way —
              and exactly how to move it.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 36 }}>
              <BookButton position="final" label="Claim my strategy call" onClick={openIntake} />
            </div>
            <p style={{ fontFamily: typeTokens.body, fontSize: '0.8125rem', color: colors.textMuted, marginTop: 16 }}>
              Free · 30 minutes · Built for international graduates in Australia
            </p>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${colors.borderWhisper}`, padding: '40px 24px' }}>
        <div style={{
          maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
        }}>
          <span style={display({ fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.01em' })}>
            Aussie&nbsp;Grad&nbsp;<span style={{ color: colors.accentGold }}>Careers</span>
          </span>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { to: '/legal/terms', label: 'Terms' },
              { to: '/legal/privacy', label: 'Privacy' },
            ].map(({ to, label }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: typeTokens.body, fontSize: '0.8125rem', color: colors.textMuted, padding: 0 }}
                onMouseEnter={e => { e.currentTarget.style.color = colors.textSecondary; }}
                onMouseLeave={e => { e.currentTarget.style.color = colors.textMuted; }}
              >
                {label}
              </button>
            ))}
          </div>
          <span style={{ fontFamily: typeTokens.body, fontSize: '0.8125rem', color: colors.textMuted }}>
            &copy; 2026 Aussie Grad Careers · Made in Australia
          </span>
        </div>
      </footer>

      {/* Mobile responsive */}
      <style>{`
        @media (max-width: 760px) {
          .step-grid { grid-template-columns: 1fr; gap: 32px; }
        }
        @media (max-width: 640px) {
          nav { padding: 16px 20px; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
