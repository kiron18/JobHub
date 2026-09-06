import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, ChevronUp, Zap, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { colors, type as typeTokens, spacing } from '../components/landing/tokens';
import { Eyebrow } from '../components/landing/shared/Eyebrow';
import { PrimaryCTA } from '../components/landing/shared/PrimaryCTA';
import { HourCalculator } from '../components/landing/pricing/HourCalculator';
import { ProofTicker } from '../components/landing/pricing/ProofTicker';
import { MockWindow, MockFitReport, MockDocuments, MockFollowUp, MockTracker } from '../components/landing/pricing/AppMock';

/* ── The offer ────────────────────────────────────────────────────────────────
   One plan, one price, one promise. The page sells the outcome and the
   guarantee; the tool is only ever named as the mechanism that delivers them.

   $250/mo is the `premium` plan, the same price and the same Stripe price id
   the in-app paywall sells. It was $197 until 3 Sep 2026 and $100 before that,
   and each time it moved, this page and ApplyPreviewGate.tsx moved with it in
   the same change. That is the rule: somebody who meets the offer inside the
   product, clicks "let me see how this works" and lands here must not be shown
   a different number for the same thing.

   THERE IS A SEVEN DAY TRIAL ON THIS PLAN. `premium` is NOT in NO_TRIAL_PLANS
   in server/src/routes/stripe.ts, so checkout creates the subscription with
   trial_period_days and takes $0 today. Every price on this page has to say so
   in the same breath as the number, and say the other half too: the card is
   collected and the $250 lands on day eight unless they cancel. If the trial is
   ever taken off again it is one entry on that set, and this copy moves back in
   the same change, or the page is advertising something checkout does not do.

   The page is ordered promise, then proof, then mechanism, then people, then
   the offer. The price is the last number on the page on purpose: by the time
   it is read, the guarantee above it has already carried the risk.           */

const PRICE = '$250';

/** $250 over about 4.33 weeks is $57.69. Rounded up, never down. */
const PRICE_WEEKLY = '$58';

/** Must match TRIAL_PERIOD_DAYS in server/src/routes/stripe.ts. */
const TRIAL_DAYS = 7;

/** The plan key checkout is opened with. Must be the plan PRICE describes. */
const PLAN_KEY = 'premium';

/**
 * One label, and it never changes.
 *
 * It used to flip to "Opening checkout…" while the Stripe session was being
 * created. That reads as a state change on the thing they just committed to,
 * on the one click that matters, and the redirect usually beats the eye to it
 * anyway. The button says the same thing before and during; the guard against
 * a double click is `busy`, not the words.
 */
const CTA_LABEL = "Let's get started";

/** The name of the offer, which does half the selling before a bullet is read. */
const OFFER_NAME = 'The 30-Day Interview Guarantee';

const GUARANTEE =
  'Run the system for seven straight days: ten applications and five outreach messages a day, which is the hour above. If you do that and have not landed an interview or a callback within 30 days of finishing, you choose the remedy. Every dollar back, or I work for free until you land one.';

/* The three ways, ranked the way the market actually ranks them. The system
   only claims the first two, and says so, which is why the third is on the
   page at all: an honest map is more persuasive than a shorter one. */
const THREE_WAYS = [
  {
    n: 1,
    title: 'Apply directly',
    sub: 'For the roles that are already open.',
    tone: colors.accentPetrol,
    facts: ['Lowest hanging fruit', 'Highest chance of getting hired', 'Most crowded market'],
    covered: true,
  },
  {
    n: 2,
    title: 'Get recommended',
    sub: 'Networking your way to the roles before they close.',
    tone: colors.accentGold,
    facts: ['Less competition', 'More strategic', 'Longer to pay off'],
    covered: true,
  },
  {
    n: 3,
    title: 'Build something',
    sub: 'Projects that make employers come to you.',
    tone: colors.textMuted,
    facts: ['Most challenging', 'Longest to pay off', 'Least attempted', 'Costs the most time, effort and money'],
    covered: false,
  },
] as const;

const BELT = [
  { n: 1, t: 'Paste the ad', d: 'That is the whole input. No forms, no profile to maintain.' },
  { n: 2, t: 'It reads the ad against your real history', d: 'And tells you whether this one is worth applying for.' },
  { n: 3, t: 'Resume rewritten to that specific ad', d: 'Phrased the way the filter is matching, in about 40 seconds.' },
  {
    n: 4,
    t: 'Selection criteria drafted in STAR',
    d: 'The part government and grad programs actually score, and the part nearly everyone skips.',
  },
  {
    n: 5,
    t: 'Personalised follow-up',
    d: 'Reaching the employer with the right message, five days later, is the single biggest lever on this page.',
  },
  {
    n: 6,
    t: 'Logged, tracked, and chased',
    d: 'It tells you who to follow up and what to send on day five, which is where most applications are quietly lost.',
  },
] as const;

/* ── The follow-up numbers ───────────────────────────────────────────────────
   Our own applications, split by whether a follow-up email went out. Both rows
   are shown, including the sample sizes, because a response rate without a
   denominator is a number nobody should believe and 21 applications is a small
   denominator. Stated plainly it is still the strongest single fact on the
   page; dressed up as a headline percentage with the base hidden, it is the
   kind of claim that gets a business in trouble.                             */
const FOLLOWUP_ROWS = [
  { group: 'Without a follow-up email', applied: 44, responses: 9, rate: '21.34%', emphasis: false },
  { group: 'With a follow-up email', applied: 21, responses: 14, rate: '68.38%', emphasis: true },
] as const;

/* ── The stack ───────────────────────────────────────────────────────────────
   Three outcomes, not seven features. It used to be six lines starting with the
   word "Unlimited", which is a word that stops meaning anything the third time
   it is read, and every line named a mechanism rather than a result. Nobody
   buys an application tracker with day-five follow-up prompts. They buy never
   missing a follow-up again.                                                  */
const STACK = [
  {
    t: 'Never send a generic application again',
    d: 'Resume, cover letter and selection criteria, written against the specific ad, as many times as you need. No cap.',
  },
  {
    t: 'Never miss a follow-up again',
    d: 'The system tells you who to chase and what to send, on the day it matters, and holds every outreach thread with it.',
  },
  {
    t: 'Walk in already prepared',
    d: 'Interview prep built from the ad you actually applied to, plus a daily job feed matched to your visa and your field. Every document stays yours, forever, job or no job.',
  },
] as const;

const FAQS = [
  {
    q: 'What do I pay today?',
    a: `Nothing. The first ${TRIAL_DAYS} days are free, and ${PRICE} is charged on day ${TRIAL_DAYS + 1} unless you cancel before then. Your card is collected at checkout so the subscription can start on its own, but it is not charged during those ${TRIAL_DAYS} days. After that it is ${PRICE} a month, about ${PRICE_WEEKLY} a week, and that is the whole price: no setup fee and no second tier you find out about later.`,
  },
  {
    q: 'Can I cancel?',
    a: `Any time, in one click, from your account. Cancel inside the first ${TRIAL_DAYS} days and you are never charged at all. After that it is a monthly subscription, not a lock-in: if you land a role in week three, you cancel in week three.`,
  },
  {
    q: 'How does the guarantee actually work?',
    a: `${GUARANTEE} The condition is the seven days, because I cannot fix a volume problem you did not have.`,
  },
  {
    q: 'I have applied to hundreds of jobs already and nothing came back.',
    a: 'Almost certainly with one resume, no selection criteria, and no follow-up. That is three separate reasons to be filtered out before a person ever reads your name, and the third one is the reason the numbers above look the way they do.',
  },
  {
    q: 'Will ten applications a day all look the same?',
    a: 'They would if a human wrote them tired at midnight. Each one is built against its own ad, which is precisely the thing that volume normally costs you.',
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

/* ── Proof ───────────────────────────────────────────────────────────────────
   Real people, real messages, nothing typed up by us.

   These are the screenshots themselves, cropped to their own content so the
   message fills the frame instead of floating in a square of white. They are
   laid out as a masonry because they are genuinely different shapes and forcing
   them into a grid meant either letterboxing them or cropping the sentence off.

   The transcribed quote cards that used to sit under them are gone. A quote in
   a nice font is something anyone can write and everybody knows it, so setting
   our own typography next to somebody's screenshot only invited the comparison.

   Names are redacted in the source images and are NOT restored here. Some of
   these are people at their lowest, not their best, and those are in the set on
   purpose: they are the reason the wins are believable, and they are the
   situation the reader is in right now.                                       */
const PROOF_SHOTS = Array.from({ length: 10 }, (_, i) => `/Assets/testimonials/messages/${i + 1}.png`);

/* ── Sub-components ──────────────────────────────────────────────────────── */

function Section({ children, alt, id }: { children: React.ReactNode; alt?: boolean; id?: string }) {
  return (
    <section id={id} style={{ background: alt ? colors.bgAlt : colors.bgSurface }}>
      <div style={{ maxWidth: spacing.containerMax, margin: '0 auto', padding: '88px 24px' }}>{children}</div>
    </section>
  );
}

function H2({ children, center }: { children: React.ReactNode; center?: boolean }) {
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
        textAlign: center ? 'center' : 'left',
        fontVariationSettings: "'SOFT' 50, 'WONK' 1",
      }}
    >
      {children}
    </h2>
  );
}

function Body({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <p
      style={{
        fontSize: '1rem',
        color: colors.textSecondary,
        lineHeight: 1.7,
        maxWidth: spacing.containerReadable,
        margin: center ? '0 auto 18px' : '0 0 18px',
        textAlign: center ? 'center' : 'left',
      }}
    >
      {children}
    </p>
  );
}

/** The response-rate table from our own applications, as a grid. */
function FollowUpGrid() {
  const head = ['', 'Applied', 'Responses', 'Response rate'];
  return (
    <div
      style={{
        background: colors.bgSurface,
        border: `1px solid ${colors.borderDefined}`,
        borderRadius: 12,
        overflowX: 'auto',
      }}
    >
      <table style={{ width: '100%', minWidth: 440, borderCollapse: 'collapse', fontFamily: typeTokens.body }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={h || 'group'}
                scope="col"
                style={{
                  textAlign: i === 0 ? 'left' : 'right',
                  padding: '13px 16px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: colors.textMuted,
                  borderBottom: `1px solid ${colors.borderWhisper}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FOLLOWUP_ROWS.map(r => (
            <tr key={r.group} style={{ background: r.emphasis ? 'rgba(45,90,110,0.05)' : 'transparent' }}>
              <th
                scope="row"
                style={{
                  textAlign: 'left',
                  padding: '16px',
                  fontSize: '0.9375rem',
                  fontWeight: r.emphasis ? 700 : 500,
                  color: r.emphasis ? colors.textPrimary : colors.textSecondary,
                }}
              >
                {r.group}
              </th>
              <td style={{ textAlign: 'right', padding: '16px', fontSize: '0.9375rem', color: colors.textSecondary }}>
                {r.applied}
              </td>
              <td style={{ textAlign: 'right', padding: '16px', fontSize: '0.9375rem', color: colors.textSecondary }}>
                {r.responses}
              </td>
              <td
                style={{
                  textAlign: 'right',
                  padding: '16px',
                  fontFamily: typeTokens.display,
                  fontSize: r.emphasis ? 'clamp(1.25rem, 3vw, 1.625rem)' : '1.125rem',
                  fontWeight: 600,
                  color: r.emphasis ? colors.accentPetrol : colors.textMuted,
                  fontVariationSettings: "'SOFT' 50, 'WONK' 1",
                  whiteSpace: 'nowrap',
                }}
              >
                {r.rate}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BeltStep({
  n,
  t,
  d,
  children,
  last,
}: {
  n: number;
  t: string;
  d: string;
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 20, padding: '22px 0', borderBottom: last ? 'none' : `1px solid ${colors.borderWhisper}` }}>
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
        {n}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>{t}</div>
        <p style={{ fontSize: '0.9375rem', color: colors.textSecondary, lineHeight: 1.6, margin: 0 }}>{d}</p>
        {children && <div style={{ marginTop: 18 }}>{children}</div>}
      </div>
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
  /* Guards a double click. Deliberately not wired to the button's label. */
  const busy = useRef(false);

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

  async function startCheckout() {
    if (busy.current) return;
    if (!user) {
      navigate('/auth?next=/pricing');
      return;
    }
    busy.current = true;
    try {
      const { data } = await api.post('/stripe/checkout', { plan: PLAN_KEY });
      window.location.href = data.url;
    } catch (err: any) {
      busy.current = false;
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
        scrollBehavior: 'smooth',
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
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.04em' }}>Aussie Grad Careers</span>
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

      {/* 1 — the promise, and the hour it costs */}
      <section style={{ background: colors.bgCanvas }}>
        <div
          style={{
            maxWidth: spacing.containerMax,
            margin: '0 auto',
            padding: 'clamp(56px, 9vw, 96px) 24px clamp(40px, 6vw, 64px)',
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
                /* Not tighter than this: the highlighter block on the second
                   line sits on top of the descenders of the first at 1.05. */
                lineHeight: 1.16,
                letterSpacing: '-0.025em',
                margin: '0 0 20px',
                fontVariationSettings: "'SOFT' 50, 'WONK' 1",
              }}
            >
              Land an interview in 30 days.
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
                maxWidth: 470,
              }}
            >
              Built for high achievers balancing the demands of casual work and social obligations.
            </p>

            <PrimaryCTA label={CTA_LABEL} onClick={startCheckout} />

            {/*
              The line under the button is a door, not a disclaimer.

              It used to spend itself restating the trial and the price, which
              is the offer's job and is done properly at the bottom of the page.
              Somebody who is not ready to click is not asking about billing:
              they want to keep reading. So this sends them down the page rather
              than trying to close them a second time in smaller type.
            */}
            <p style={{ margin: '18px 0 0' }}>
              <a
                href="#how"
                onClick={e => {
                  /* The page owns its own scroll container, so a native hash
                     jump would scroll the document, which does not move, and
                     would push a hash onto the router for nothing. */
                  e.preventDefault();
                  document.getElementById('how')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: colors.accentPetrol,
                  textDecoration: 'none',
                  borderBottom: `1px solid ${colors.accentPetrol}44`,
                  paddingBottom: 2,
                }}
              >
                I want to find out more
                <ArrowDown size={15} />
              </a>
            </p>
          </div>

          <HourCalculator />
        </div>

        {/* The people the hour worked for, one at a time, under the maths. */}
        <div style={{ maxWidth: spacing.containerMax, margin: '0 auto', padding: '0 24px clamp(56px, 8vw, 88px)' }}>
          <ProofTicker />
        </div>
      </section>

      {/* 2 — the map: three ways, and the two this covers */}
      <Section id="how">
        <Eyebrow>WHY IT WORKS</Eyebrow>
        <H2>There are only three ways to land a job in Australia.</H2>
        <Body>
          Every one of them works. They cost wildly different amounts of time, and only two of them can be turned into a
          process you follow on a Tuesday night.
        </Body>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 20,
            marginTop: 40,
          }}
        >
          {THREE_WAYS.map(w => (
            <div
              key={w.n}
              style={{
                background: w.covered ? colors.bgSurface : colors.bgAlt,
                border: `1px solid ${w.covered ? colors.borderDefined : colors.borderWhisper}`,
                borderTop: `3px solid ${w.tone}`,
                borderRadius: 12,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontFamily: typeTokens.display,
                  fontSize: '2rem',
                  fontWeight: 600,
                  lineHeight: 1,
                  color: w.tone,
                  fontVariationSettings: "'SOFT' 50, 'WONK' 1",
                }}
              >
                {w.n}
              </div>
              <div style={{ fontSize: '1.0625rem', fontWeight: 700, margin: '12px 0 4px', color: colors.textPrimary }}>
                {w.title}
              </div>
              <p style={{ fontSize: '0.9375rem', color: colors.textSecondary, lineHeight: 1.55, margin: '0 0 16px' }}>
                {w.sub}
              </p>

              <ul style={{ listStyle: 'none', margin: '0 0 18px', padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {w.facts.map(f => (
                  <li
                    key={f}
                    style={{
                      fontSize: '0.8125rem',
                      color: colors.textSecondary,
                      paddingLeft: 12,
                      borderLeft: `2px solid ${w.tone}44`,
                      lineHeight: 1.45,
                    }}
                  >
                    {f}
                  </li>
                ))}
              </ul>

              <div
                style={{
                  marginTop: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  alignSelf: 'flex-start',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '5px 10px',
                  borderRadius: 99,
                  color: w.covered ? colors.accentPetrol : colors.textMuted,
                  background: w.covered ? 'rgba(45,90,110,0.09)' : 'transparent',
                  border: w.covered ? 'none' : `1px solid ${colors.borderWhisper}`,
                }}
              >
                {w.covered && <Check size={12} strokeWidth={3} />}
                {w.covered ? 'The system runs this' : 'Yours to build'}
              </div>
            </div>
          ))}
        </div>

        <p
          style={{
            fontSize: '1.0625rem',
            color: colors.textPrimary,
            lineHeight: 1.7,
            maxWidth: spacing.containerReadable,
            margin: '36px 0 0',
          }}
        >
          I built a system that turns the first two into an easy process anyone can execute in an hour.{' '}
          <span style={{ background: colors.highlight, padding: '0 5px' }}>
            That leaves you the rest of your day to work, see your friends, or finally build the third one.
          </span>
        </p>
      </Section>

      {/* 3 — the mechanism, with the screens people actually use */}
      <Section alt>
        <Eyebrow>THE MECHANISM</Eyebrow>
        <H2>This is the page you will be looking at.</H2>
        <Body>
          Every competitor in this market coaches you on how to apply. This does the applying. Paste an ad, and the first
          thing you get back is whether it is worth your hour at all.
        </Body>

        <div style={{ maxWidth: 880, margin: '36px auto 0' }}>
          <MockWindow label="Job fit check" withRail>
            <MockFitReport />
          </MockWindow>
        </div>

        <div style={{ maxWidth: spacing.containerReadable, margin: '64px auto 0' }}>
          <H2>The conveyor belt, start to finish.</H2>

          {BELT.map(s => {
            if (s.n === 4) {
              return (
                <BeltStep key={s.n} n={s.n} t={s.t} d={s.d}>
                  <MockWindow label="Your application">
                    <MockDocuments />
                  </MockWindow>
                </BeltStep>
              );
            }
            if (s.n === 5) {
              return (
                <BeltStep key={s.n} n={s.n} t={s.t} d={s.d}>
                  <MockWindow label="Follow-up">
                    <MockFollowUp />
                  </MockWindow>
                  <div style={{ marginTop: 20 }}>
                    <FollowUpGrid />
                    <p
                      style={{
                        fontSize: '0.9375rem',
                        color: colors.textPrimary,
                        lineHeight: 1.65,
                        margin: '14px 0 0',
                      }}
                    >
                      Our own applications, split by whether a follow-up went out.{' '}
                      <span style={{ background: colors.highlight, padding: '0 5px', fontWeight: 600 }}>
                        Roughly one in five became two in three.
                      </span>{' '}
                      It is a small sample and both denominators are printed above, because a response rate without one
                      is a number nobody should believe.
                    </p>
                  </div>
                </BeltStep>
              );
            }
            if (s.n === 6) {
              return (
                <BeltStep key={s.n} n={s.n} t={s.t} d={s.d} last>
                  <MockWindow label="Your tracker">
                    <MockTracker />
                  </MockWindow>
                </BeltStep>
              );
            }
            return <BeltStep key={s.n} n={s.n} t={s.t} d={s.d} />;
          })}
        </div>
      </Section>

      {/* 4 — proof, in their own handwriting */}
      <Section id="proof">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Eyebrow>WHAT PEOPLE ARE SAYING</Eyebrow>
        </div>
        <H2 center>In their own words.</H2>

        {/*
          A masonry, because these are ten genuinely different shapes: a two
          line message and a full rejection email do not belong in the same
          box. CSS columns give the ragged, pinned-to-a-board look without a
          layout library, and break-inside keeps a screenshot whole.
        */}
        <div className="proof-masonry" style={{ marginTop: 40 }}>
          {PROOF_SHOTS.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`A message a client sent, ${i + 1} of ${PROOF_SHOTS.length}`}
              loading="lazy"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                borderRadius: 10,
                border: `1px solid ${colors.borderDefined}`,
                background: colors.bgSurface,
                boxShadow: '0 1px 2px rgba(26,24,20,0.04), 0 10px 26px -16px rgba(26,24,20,0.35)',
                marginBottom: 16,
                breakInside: 'avoid',
              }}
            />
          ))}
        </div>

        <style>{`
          .proof-masonry { column-count: 1; column-gap: 16px; }
          @media (min-width: 620px) { .proof-masonry { column-count: 2; } }
          @media (min-width: 1000px) { .proof-masonry { column-count: 3; } }
        `}</style>
      </Section>

      {/* 5 — what they are thinking, answered as a person rather than a FAQ */}
      <Section alt>
        <div style={{ maxWidth: spacing.containerReadable, margin: '0 auto' }}>
          <Eyebrow>WHAT YOU ARE PROBABLY THINKING</Eyebrow>
          <H2>Every one of them thought it would not work for them either.</H2>

          <Body>
            Pavit, Denzel, Cho, Rithika, Annie and many more were in the same situation you are in now. Frustrated,
            confused, and not sure what the next step was. Today all of them are working in their nominated occupation
            in Australia, earning between $70,000 and $75,000.
          </Body>
          <Body>
            Just like you, they were not sure they had it in them. They were not sure they could afford it. They were
            not sure they had the time. The common thread I see in most international grads is that this is the first
            time they are making an investment in themselves.
          </Body>
          <Body>
            The system I built has been tuned to cover the gaps a job seeker actually hits in the Australian market: a
            lack of time, a lack of certainty about what to do next, a lack of reliability in AI tools that hallucinate,
            and a lack of direction.
          </Body>
          <p
            style={{
              fontSize: '1.0625rem',
              color: colors.textPrimary,
              lineHeight: 1.7,
              margin: 0,
              fontWeight: 500,
            }}
          >
            Aussie Grad Careers is a process, not a pep talk. It takes the time, the effort and the mental fatigue out
            of finding your first job here.{' '}
            <span style={{ background: colors.highlight, padding: '0 5px' }}>
              Follow the steps, drive the system, get results.
            </span>
          </p>
        </div>
      </Section>

      {/* 6 — who is behind it */}
      <Section id="about">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'clamp(28px, 5vw, 56px)',
            alignItems: 'center',
            maxWidth: 900,
            margin: '0 auto',
          }}
        >
          <img
            src="/Assets/about-me.png"
            alt="Kiron, who runs Aussie Grad Careers, on a Melbourne street"
            loading="lazy"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              borderRadius: 16,
              border: `1px solid ${colors.borderDefined}`,
            }}
          />
          <div>
            <Eyebrow>WHO YOU ARE BUYING FROM</Eyebrow>
            <H2>Hi, I&rsquo;m Kiron.</H2>
            <p style={{ fontSize: '1rem', lineHeight: 1.7, color: colors.textSecondary, margin: '0 0 14px' }}>
              I built this because I watched good people send the same resume three hundred times, get nothing back, and
              conclude the problem was them. It usually is not. It is volume, it is that nobody rewrites for the ad, and
              it is that almost nobody follows up.
            </p>
            <p style={{ fontSize: '1rem', lineHeight: 1.7, color: colors.textSecondary, margin: 0 }}>
              The guarantee below has my name on it, not a company&rsquo;s. If you run the system and the callbacks do
              not come, I audit your profile and run your applications myself until they do. That is the whole reason
              the promise at the top of this page can be a promise.
            </p>
          </div>
        </div>
      </Section>

      {/* 7 — the offer: name, then what you get, then the guarantee, then the price */}
      <Section alt id="offer">
        <div style={{ maxWidth: 620, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Eyebrow>THE OFFER</Eyebrow>
          </div>

          <div
            style={{
              background: colors.bgSurface,
              border: `1px solid ${colors.borderDefined}`,
              borderRadius: 16,
              padding: 'clamp(24px, 5vw, 40px)',
              boxShadow: '0 1px 2px rgba(26,24,20,0.04), 0 16px 40px rgba(26,24,20,0.07)',
            }}
          >
            {/* The name does half the selling before a bullet is read. */}
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
              <div
                style={{
                  fontFamily: typeTokens.display,
                  fontSize: 'clamp(1.625rem, 4.4vw, 2.25rem)',
                  fontWeight: 500,
                  lineHeight: 1.15,
                  letterSpacing: '-0.02em',
                  color: colors.textPrimary,
                  fontVariationSettings: "'SOFT' 50, 'WONK' 1",
                }}
              >
                {OFFER_NAME}
              </div>
              <p style={{ fontSize: '1rem', color: colors.textSecondary, lineHeight: 1.6, margin: '10px 0 0' }}>
                One hour a day, and an interview inside 30 days.
              </p>
            </div>

            {/* What it does for you. Three outcomes, not a feature list. */}
            <div style={{ marginBottom: 30 }}>
              {STACK.map(s => (
                <div key={s.t} style={{ display: 'flex', gap: 13, padding: '12px 0', alignItems: 'flex-start' }}>
                  <Check size={18} style={{ color: colors.success, flexShrink: 0, marginTop: 3 }} />
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: colors.textPrimary, marginBottom: 3 }}>
                      {s.t}
                    </div>
                    <p style={{ fontSize: '0.9375rem', color: colors.textSecondary, lineHeight: 1.55, margin: 0 }}>
                      {s.d}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/*
              The guarantee is bigger than the price, and it comes first.

              People buy certainty. Everything above this made the hour look
              small; this makes being wrong cost nothing; and only then is there
              a number, set quietly underneath, at a size that matches how much
              it should matter by that point in the page.
            */}
            <div
              style={{
                background: colors.highlight,
                borderRadius: 14,
                padding: 'clamp(20px, 4vw, 28px)',
                marginBottom: 26,
              }}
            >
              <div
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: colors.textSecondary,
                  marginBottom: 12,
                }}
              >
                The guarantee
              </div>
              <p
                style={{
                  fontFamily: typeTokens.display,
                  fontSize: 'clamp(1.25rem, 3.2vw, 1.625rem)',
                  fontWeight: 500,
                  lineHeight: 1.25,
                  letterSpacing: '-0.015em',
                  color: colors.textPrimary,
                  margin: '0 0 12px',
                  fontVariationSettings: "'SOFT' 50, 'WONK' 1",
                }}
              >
                Land an interview in 30 days, or I work for free until you do.
              </p>
              <p style={{ fontSize: '0.9375rem', color: colors.textPrimary, lineHeight: 1.6, margin: 0 }}>
                {GUARANTEE}
              </p>
            </div>

            {/* And only now, the number. */}
            <div
              style={{
                textAlign: 'center',
                paddingBottom: 24,
                marginBottom: 24,
                borderBottom: `1px solid ${colors.borderWhisper}`,
              }}
            >
              <div
                style={{
                  fontFamily: typeTokens.display,
                  fontSize: '1.75rem',
                  fontWeight: 600,
                  lineHeight: 1,
                  color: colors.textPrimary,
                  fontVariationSettings: "'SOFT' 50, 'WONK' 1",
                }}
              >
                {PRICE_WEEKLY}
                <span style={{ fontSize: '1rem', color: colors.textMuted, fontWeight: 500 }}> a week</span>
              </div>
              <div style={{ fontSize: '0.875rem', color: colors.textSecondary, marginTop: 8 }}>
                Billed {PRICE} a month. Cancel any time, in one click.
              </div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: colors.success, marginTop: 8 }}>
                Free for your first {TRIAL_DAYS} days
              </div>
              <div style={{ fontSize: '0.8125rem', color: colors.textMuted, marginTop: 4 }}>
                Your card is collected at checkout and nothing is charged until day {TRIAL_DAYS + 1}.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <PrimaryCTA label={CTA_LABEL} onClick={startCheckout} />
            </div>

            <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: colors.textMuted, margin: '16px 0 0' }}>
              Not ready to decide? The free tier gives you 5 documents and 5 job analyses with no card at all.
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
