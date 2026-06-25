/* ────────────────────────────────────────────────────────────────────────────
   BookCallPage — pre-framing / trust page for the free strategy call
   Route: /book-a-call  (public, non-destructive)

   Single goal: get an international graduate to click through and book a
   30-minute strategy call. Everything on the page exists to lower the
   perceived risk of that one click.

   Booking link: the CTA opens BOOKING_URL in a new tab. Set BOOKING_URL below
   to the real scheduling link (Calendly / Cal.com / etc) before going live.
   ──────────────────────────────────────────────────────────────────────────── */
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { Check, ArrowRight, Clock, Compass, MessageSquare } from 'lucide-react';
import { colors, type as typeTokens } from '../components/landing/tokens';
import { trackBookCallCtaClicked } from '../lib/analytics';

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

function BookButton({ position, label, small }: { position: 'hero' | 'mid' | 'final'; label: string; small?: boolean }) {
  const handle = () => {
    trackBookCallCtaClicked(position);
    window.open(BOOKING_URL, '_blank', 'noopener,noreferrer');
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

// ── content ───────────────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: Compass,
    title: 'We find what is actually blocking you',
    body: 'We look at your CV, your applications and the response you are getting, then name the real bottleneck. Usually it is not the one you think.',
  },
  {
    icon: MessageSquare,
    title: 'We map the fix',
    body: 'A clear, ordered plan for the next few weeks. The Australian specific moves most internationals never get told about, in the order that moves the needle.',
  },
  {
    icon: Check,
    title: 'You decide what is next',
    body: 'If we can help you further, we will tell you how, once. If you are better off running the plan on your own, we will tell you that too. No pressure either way.',
  },
];

const WALKAWAY = [
  'A straight answer on why your applications are going quiet',
  'The two or three highest-leverage fixes, in priority order',
  'A realistic timeline for someone in your exact situation',
];

const FAQS = [
  {
    q: 'Is it really free?',
    a: 'Yes. No card, no catch. Thirty minutes of our time because the call is genuinely useful and it is how we meet the people we end up working with.',
  },
  {
    q: 'Will you try to sell me something?',
    a: 'If we think we can help beyond the call, we will say so once, near the end. If we cannot, we will say that instead. You leave with the plan regardless.',
  },
  {
    q: 'I am early in my search. Is it too soon?',
    a: 'Earlier is better. Fixing your positioning before you have burned through a hundred applications saves you months. The best time to call is before the silence sets in.',
  },
  {
    q: 'Does my visa situation matter?',
    a: 'Bring it. We factor your visa and work rights into the plan so the roles we point you at are ones you can actually take. We are not migration agents, so for legal advice we will refer you on.',
  },
];

// ── page ────────────────────────────────────────────────────────────────────

export function BookCallPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: colors.bgCanvas, color: colors.textPrimary }}>
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
      <section style={{ padding: '72px 24px 64px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <Eyebrow>Free 30-minute strategy call</Eyebrow>
            <h1 style={display({ fontSize: 'clamp(2.3rem, 5vw, 3.4rem)', lineHeight: 1.05, margin: '18px auto 0', maxWidth: 640 })}>
              Let us map your path to an Australian job. In one call.
            </h1>
            <p style={{
              fontFamily: typeTokens.body, fontSize: '1.1875rem', lineHeight: 1.6,
              color: colors.textSecondary, margin: '20px auto 0', maxWidth: 540,
            }}>
              Thirty minutes, one on one. We work out where your search is really stuck
              and exactly what to do next. You walk away with a plan whether or not we
              ever work together.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
              <BookButton position="hero" label="Book my strategy call" />
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
              <Clock size={14} color={colors.textMuted} strokeWidth={1.8} />
              <span style={{ fontFamily: typeTokens.body, fontSize: '0.8125rem', color: colors.textMuted }}>
                Free · 30 minutes · No pitch fest
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
              A working session, not a sales pitch.
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
              Even if we never speak again.
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
              I came to Australia as a student and learned the hard way that the job hunt
              here is not won on talent, it is won on knowing the local rules. The moment I
              learned them, the silence turned into callbacks and an offer I did not think
              was possible. This call is the shortcut I wish someone had handed me.
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

      {/* Final CTA */}
      <section style={{ background: colors.bgSurface, borderTop: `1px solid ${colors.borderWhisper}`, padding: '96px 24px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <h2 style={display({ fontSize: 'clamp(2rem, 4vw, 2.8rem)', lineHeight: 1.1, margin: 0 })}>
              Stop guessing. Get a plan.
            </h2>
            <p style={{ fontFamily: typeTokens.body, fontSize: '1.125rem', lineHeight: 1.6, color: colors.textSecondary, margin: '16px auto 0', maxWidth: 480 }}>
              Pick a time that suits you. Thirty minutes from now you could know exactly
              what to fix and in what order. No card, no commitment.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
              <BookButton position="final" label="Book my strategy call" />
            </div>
            <p style={{ fontFamily: typeTokens.body, fontSize: '0.8125rem', color: colors.textMuted, marginTop: 16 }}>
              Free · 30 minutes · Built for grads job-hunting in Australia
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
      `}</style>
    </div>
  );
}
