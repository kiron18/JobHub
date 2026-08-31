import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { colors, type as typeTokens, spacing } from '../components/landing/tokens';
import { Eyebrow } from '../components/landing/shared/Eyebrow';
import { PrimaryCTA } from '../components/landing/shared/PrimaryCTA';

/* ── The offer ────────────────────────────────────────────────────────────────
   One plan, one price, one promise. The page sells the outcome and the
   guarantee; the tool is only ever named as the mechanism that delivers them.

   $100/mo maps to the live Stripe price "Job Hub System monthly". The 7 free
   days are configured on the subscription in server/src/routes/stripe.ts, not
   here, so this copy and that trial have to move together.                    */

const PRICE = '$100';
const TRIAL_DAYS = 7;

const CTA_LABEL = 'Start my 5 interviews in 30 days →';

const LEVERS = [
  {
    stat: '150',
    unit: 'applications',
    label: 'Volume',
    body: 'Hiring at graduate level is a numbers game before it is anything else. Most people lose it at the first number.',
  },
  {
    stat: '30',
    unit: 'minutes a day',
    label: 'Speed',
    body: 'You paste a job ad. Everything downstream of that is already written by the time you have read it.',
  },
  {
    stat: '0',
    unit: 'words written',
    label: 'Effort',
    body: 'No cover letters. No selection criteria from scratch. No rewriting the same resume for the ninth time.',
  },
];

const BELT = [
  { n: 1, t: 'Paste the ad', d: 'That is the whole input. No forms, no profile to maintain.' },
  { n: 2, t: 'It reads the ad against your real history', d: 'Not a template. Your actual roles, projects and numbers.' },
  { n: 3, t: 'Resume rewritten to that specific ad', d: 'Phrased the way the filter is matching, in about 40 seconds.' },
  { n: 4, t: 'Selection criteria drafted in STAR', d: 'The part government and grad programs actually score, and the part nearly everyone skips.' },
  { n: 5, t: 'Logged, tracked, and chased', d: 'It tells you who to follow up and what to send on day five, which is where most applications are quietly lost.' },
];

const OBJECTIONS = [
  {
    q: '"I don\'t need coaching. I need volume."',
    a: 'Correct, and that is the point. This is not a coaching program with software attached. Coaches talk to you about applying. This applies.',
  },
  {
    q: '"Won\'t 150 applications all look the same?"',
    a: 'They would if a human wrote them tired at midnight. Each one is built against its own ad, which is precisely the thing volume normally costs you.',
  },
  {
    q: '"I have applied to hundreds of jobs already."',
    a: 'Almost certainly with one resume, no selection criteria, and no follow-up. That is three separate reasons to be filtered out before a person ever reads your name.',
  },
  {
    q: '"What if it does not work for me?"',
    a: 'Then it costs you nothing and it costs me my time. See the guarantee below. That is the whole risk transfer.',
  },
];

const STACK = [
  'Unlimited tailored resumes, one per job ad',
  'Unlimited cover letters and selection criteria in STAR format',
  'Interview prep built from the specific ad you applied to',
  'Application tracker with day-five follow-up prompts',
  'Daily job feed matched to your visa and your field',
  'Every document stays yours, forever, job or no job',
];

const FAQS = [
  {
    q: `Is the first ${TRIAL_DAYS} days really free?`,
    a: `Yes. You start a ${TRIAL_DAYS}-day trial with full access and nothing is charged until it ends. Cancel inside the trial and you pay nothing at all.`,
  },
  {
    q: 'Can I cancel?',
    a: 'Any time, in one click, from your account. It is a monthly subscription, not a lock-in. If you land a role in week three, you cancel in week three.',
  },
  {
    q: 'How does the guarantee actually work?',
    a: 'Run 150 applications through the system inside 30 days. If that does not produce 5 interview callbacks, I personally audit and rewrite your entire profile and run your applications myself, free, until it does. The only condition is the 150, because I cannot fix a volume problem you did not have.',
  },
  {
    q: 'What happens when I get the job?',
    a: 'You cancel, and you keep every document you generated. Nothing gets locked away. That is the intended ending.',
  },
  {
    q: 'Do I have to pay to try it?',
    a: 'No. There is a free tier with 5 document generations and 5 job analyses, no card required. Use that first if you would rather see it work before you decide.',
  },
];

/* ── Sub-components ──────────────────────────────────────────────────────── */

function Section({
  children,
  alt,
  id,
}: {
  children: React.ReactNode;
  alt?: boolean;
  id?: string;
}) {
  return (
    <section id={id} style={{ background: alt ? colors.bgAlt : colors.bgSurface }}>
      <div style={{ maxWidth: spacing.containerMax, margin: '0 auto', padding: '88px 24px' }}>
        {children}
      </div>
    </section>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: typeTokens.display,
        fontSize: 'clamp(1.5rem, 3.4vw, 2rem)',
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: '-0.015em',
        color: colors.textPrimary,
        margin: '0 0 16px',
        fontVariationSettings: "'SOFT' 50, 'WONK' 1",
      }}
    >
      {children}
    </h2>
  );
}

/* The hero's proof. Not a product screenshot and not a testimonial, because
   there are no case studies yet to show honestly. It shows the one number the
   offer turns on: same three hours, two very different amounts of work. */
function ThreeHours() {
  const rows = [
    { label: 'Writing them by hand', n: 12, pct: 8, tone: colors.textMuted },
    { label: 'Through the belt', n: 150, pct: 100, tone: colors.accentPetrol },
  ];
  return (
    <div
      style={{
        background: colors.bgSurface,
        border: `1px solid ${colors.borderDefined}`,
        borderRadius: 14,
        padding: 'clamp(20px, 4vw, 32px)',
        boxShadow: '0 1px 2px rgba(26,24,20,0.04), 0 12px 32px rgba(26,24,20,0.06)',
      }}
    >
      <div
        style={{
          fontFamily: typeTokens.body,
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: colors.textMuted,
          marginBottom: 24,
        }}
      >
        Three hours on a Sunday
      </div>

      {rows.map(r => (
        <div key={r.label} style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 8,
              gap: 12,
            }}
          >
            <span
              style={{
                fontFamily: typeTokens.body,
                fontSize: '0.9375rem',
                color: colors.textSecondary,
              }}
            >
              {r.label}
            </span>
            <span
              style={{
                fontFamily: typeTokens.display,
                fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                fontWeight: 600,
                color: r.tone,
                lineHeight: 1,
                fontVariationSettings: "'SOFT' 50, 'WONK' 1",
              }}
            >
              {r.n}
            </span>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 99,
              background: colors.bgAlt,
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${r.pct}%` }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.9, ease: [0.25, 1, 0.5, 1] }}
              style={{
                height: '100%',
                borderRadius: 99,
                background: r.tone === colors.accentPetrol ? colors.accentPetrol : colors.borderDefined,
              }}
            />
          </div>
        </div>
      ))}

      <p
        style={{
          fontFamily: typeTokens.body,
          fontSize: '0.875rem',
          color: colors.textSecondary,
          margin: '20px 0 0',
          lineHeight: 1.6,
        }}
      >
        Same three hours. The difference is not effort, and it was never talent.
        It is that one of these is a conveyor belt and the other is a craft
        project.
      </p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${colors.borderWhisper}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '20px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: typeTokens.body,
          fontSize: '1rem',
          fontWeight: 600,
          color: colors.textPrimary,
        }}
        aria-expanded={open}
      >
        {q}
        {open ? (
          <ChevronUp size={18} style={{ color: colors.textMuted, flexShrink: 0 }} />
        ) : (
          <ChevronDown size={18} style={{ color: colors.textMuted, flexShrink: 0 }} />
        )}
      </button>
      {open && (
        <p
          style={{
            fontFamily: typeTokens.body,
            fontSize: '0.9375rem',
            color: colors.textSecondary,
            lineHeight: 1.65,
            margin: '0 0 20px',
            maxWidth: spacing.containerReadable,
          }}
        >
          {a}
        </p>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export function PricingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Body is overflow:hidden app-wide, so a full-page public view has to own its
  // own scroll container or it simply cannot be scrolled.
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  async function startTrial() {
    if (!user) {
      navigate('/auth?next=/pricing');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/stripe/checkout', { plan: 'monthly' });
      window.location.href = data.url;
    } catch (err: any) {
      setLoading(false);
      const msg = String(err?.response?.data?.error ?? '');
      if (msg.toLowerCase().includes('complimentary')) {
        toast.success('This account already has full access, nothing to pay.');
      } else if (err?.response?.status === 410) {
        toast.error('Checkout is temporarily unavailable. Email kiron@aussiegradcareers.com.au and I will sort you out.');
      } else {
        toast.error('Could not start checkout. Please try again.');
      }
    }
  }

  return (
    <div
      style={{
        height: '100dvh',
        overflowY: 'auto',
        background: colors.bgCanvas,
        color: colors.textPrimary,
        fontFamily: typeTokens.body,
      }}
    >
      {/* Nav */}
      <div
        style={{
          borderBottom: `1px solid ${colors.borderWhisper}`,
          background: colors.bgCanvas,
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} style={{ color: colors.accentPetrol }} />
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.04em' }}>
            Aussie Grad Careers
          </span>
        </div>
        <button
          onClick={() => navigate('/auth')}
          style={{
            background: 'transparent',
            border: `1px solid ${colors.borderDefined}`,
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            color: colors.textSecondary,
            cursor: 'pointer',
            fontFamily: typeTokens.body,
          }}
        >
          {user ? 'Go to dashboard →' : 'Log in →'}
        </button>
      </div>

      {/* 1 + 2 + 3 — headline, sub-headline, proof */}
      <section style={{ background: colors.bgCanvas }}>
        <div
          style={{
            maxWidth: spacing.containerMax,
            margin: '0 auto',
            padding: 'clamp(56px, 9vw, 96px) 24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'clamp(32px, 6vw, 64px)',
            alignItems: 'center',
          }}
        >
          <div>
            <Eyebrow>FOR INTERNATIONAL GRADS IN AUSTRALIA</Eyebrow>

            <h1
              style={{
                fontFamily: typeTokens.display,
                fontSize: 'clamp(2.1rem, 5.4vw, 3.25rem)',
                fontWeight: 500,
                lineHeight: 1.05,
                letterSpacing: '-0.025em',
                margin: '0 0 20px',
                fontVariationSettings: "'SOFT' 50, 'WONK' 1",
              }}
            >
              Get 5 interviews in 30 days.
              <br />
              <span
                style={{
                  background: colors.highlight,
                  boxDecorationBreak: 'clone',
                  WebkitBoxDecorationBreak: 'clone',
                  padding: '0 6px',
                }}
              >
                Or I work for free until you do.
              </span>
            </h1>

            <p
              style={{
                fontSize: 'clamp(1.0625rem, 2vw, 1.1875rem)',
                color: colors.textSecondary,
                lineHeight: 1.6,
                margin: '0 0 32px',
                maxWidth: 460,
              }}
            >
              Send 150 optimised applications in the time it takes to write 5 by
              hand.
            </p>

            <PrimaryCTA label={loading ? 'Opening checkout…' : CTA_LABEL} onClick={startTrial} />

            <p style={{ fontSize: '0.875rem', color: colors.textMuted, margin: '16px 0 0' }}>
              {TRIAL_DAYS} days free, then {PRICE}/month. Cancel any time, in one click.
            </p>
          </div>

          <ThreeHours />
        </div>
      </section>

      {/* 4a — the value levers */}
      <Section>
        <Eyebrow>WHY IT WORKS</Eyebrow>
        <H2>Three levers, and only one of them is effort.</H2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 24,
            marginTop: 40,
          }}
        >
          {LEVERS.map(l => (
            <div
              key={l.label}
              style={{
                background: colors.bgAlt,
                border: `1px solid ${colors.borderWhisper}`,
                borderRadius: 12,
                padding: 24,
              }}
            >
              <div
                style={{
                  fontFamily: typeTokens.display,
                  fontSize: '2.5rem',
                  fontWeight: 600,
                  lineHeight: 1,
                  color: colors.accentPetrol,
                  fontVariationSettings: "'SOFT' 50, 'WONK' 1",
                }}
              >
                {l.stat}
              </div>
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: colors.textMuted,
                  margin: '6px 0 14px',
                }}
              >
                {l.unit}
              </div>
              <p style={{ fontSize: '0.9375rem', color: colors.textSecondary, lineHeight: 1.6, margin: 0 }}>
                {l.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* 4b — the mechanism */}
      <Section alt>
        <Eyebrow>THE MECHANISM</Eyebrow>
        <H2>The conveyor belt, start to finish.</H2>
        <p
          style={{
            fontSize: '1rem',
            color: colors.textSecondary,
            lineHeight: 1.65,
            maxWidth: spacing.containerReadable,
            margin: '0 0 40px',
          }}
        >
          Every competitor in this market coaches you on how to apply. This does
          the applying. That is the entire difference, and it is why the number
          at the top of this page can be a promise instead of a hope.
        </p>

        <div style={{ maxWidth: spacing.containerReadable }}>
          {BELT.map(s => (
            <div
              key={s.n}
              style={{
                display: 'flex',
                gap: 20,
                padding: '20px 0',
                borderBottom: `1px solid ${colors.borderWhisper}`,
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: 99,
                  background: colors.accentPetrol,
                  color: colors.textOnDeep,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                }}
              >
                {s.n}
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>{s.t}</div>
                <p style={{ fontSize: '0.9375rem', color: colors.textSecondary, lineHeight: 1.6, margin: 0 }}>
                  {s.d}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 4c — objections */}
      <Section>
        <Eyebrow>WHAT YOU ARE PROBABLY THINKING</Eyebrow>
        <H2>The four objections, answered plainly.</H2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 24,
            marginTop: 40,
          }}
        >
          {OBJECTIONS.map(o => (
            <div key={o.q}>
              <div
                style={{
                  fontFamily: typeTokens.display,
                  fontSize: '1.125rem',
                  fontWeight: 500,
                  color: colors.textPrimary,
                  marginBottom: 10,
                  fontVariationSettings: "'SOFT' 50, 'WONK' 1",
                }}
              >
                {o.q}
              </div>
              <p style={{ fontSize: '0.9375rem', color: colors.textSecondary, lineHeight: 1.65, margin: 0 }}>
                {o.a}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* 6 — the offer stack and the guarantee */}
      <Section alt id="offer">
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Eyebrow>THE OFFER</Eyebrow>
          </div>

          <div
            style={{
              background: colors.bgSurface,
              border: `1px solid ${colors.borderDefined}`,
              borderRadius: 16,
              padding: 'clamp(24px, 5vw, 36px)',
              boxShadow: '0 1px 2px rgba(26,24,20,0.04), 0 16px 40px rgba(26,24,20,0.07)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div
                style={{
                  fontFamily: typeTokens.display,
                  fontSize: '3rem',
                  fontWeight: 600,
                  lineHeight: 1,
                  fontVariationSettings: "'SOFT' 50, 'WONK' 1",
                }}
              >
                {PRICE}
                <span style={{ fontSize: '1.125rem', color: colors.textMuted, fontWeight: 500 }}>
                  {' '}
                  /month
                </span>
              </div>
              <div style={{ fontSize: '0.875rem', color: colors.textMuted, marginTop: 8 }}>
                First {TRIAL_DAYS} days free. Cancel any time.
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              {STACK.map(s => (
                <div key={s} style={{ display: 'flex', gap: 12, padding: '9px 0', alignItems: 'flex-start' }}>
                  <Check size={17} style={{ color: colors.success, flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: '0.9375rem', color: colors.textSecondary, lineHeight: 1.5 }}>
                    {s}
                  </span>
                </div>
              ))}
            </div>

            {/* The guarantee is the conversion lever, so it is the loudest thing
                in the card, not a footnote under the price. */}
            <div
              style={{
                background: colors.highlight,
                borderRadius: 12,
                padding: 20,
                marginBottom: 28,
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: colors.textPrimary,
                  marginBottom: 10,
                }}
              >
                The guarantee
              </div>
              <p
                style={{
                  fontSize: '1rem',
                  color: colors.textPrimary,
                  lineHeight: 1.6,
                  margin: 0,
                  fontWeight: 500,
                }}
              >
                Run 150 applications in your first 30 days. If that does not
                produce 5 interview callbacks, I personally audit and rewrite
                your entire profile and run your applications myself, free,
                until it does.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <PrimaryCTA label={loading ? 'Opening checkout…' : CTA_LABEL} onClick={startTrial} />
            </div>

            <p
              style={{
                textAlign: 'center',
                fontSize: '0.8125rem',
                color: colors.textMuted,
                margin: '16px 0 0',
              }}
            >
              Not ready to decide? The free tier gives you 5 documents and 5 job
              analyses with no card at all.
            </p>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section>
        <div style={{ maxWidth: spacing.containerReadable, margin: '0 auto' }}>
          <H2>Questions</H2>
          <div style={{ marginTop: 24 }}>
            {FAQS.map(f => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </Section>

      {/* Footer */}
      <div
        style={{
          borderTop: `1px solid ${colors.borderWhisper}`,
          padding: '32px 24px 48px',
          textAlign: 'center',
          background: colors.bgCanvas,
        }}
      >
        <p style={{ fontSize: '0.875rem', color: colors.textMuted, margin: 0 }}>
          Questions before you start? kiron@aussiegradcareers.com.au
        </p>
      </div>
    </div>
  );
}

export default PricingPage;
