import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { colors, type as typeTokens } from '../components/landing/tokens';
import { PrimaryCTA } from '../components/landing/shared/PrimaryCTA';

/* ── The last nudge ───────────────────────────────────────────────────────────
   One promise, one button.

   This page is only ever reached by a member who is almost ready to buy: the
   app's "View plans & billing" sends them here, and so does Stripe's cancel
   URL. Strangers are redirected home (config/frontDoor.ts). So it does not
   sell. The eight-section sales page that used to live here (the three ways,
   the belt, the proof wall, the guarantee, the FAQ) was cut on 2026-10-07 on
   Kiron's call: every extra section is one more thing between a person who has
   already decided and the button. It is in git history if it is wanted back.

   The only other words on the page are the price and its terms, because a pay
   button with no number next to it is the one thing that would make a ready
   buyer hesitate.

   THE YEAR OF ACCESS IS NOT AUTOMATIC YET. The webhook ends the subscription
   after three months and `customer.subscription.deleted` drops the account to
   free; the year only exists once accessExpiresAt is written, which today is
   scripts/grant_year_from_first_payment.ts, run by hand. Until that is wired
   into the webhook, the script has to be run for every new buyer or this page
   is promising something the product takes away in month three.

   $250/mo is the `premium` plan, the same price and the same Stripe price id
   the in-app paywall (UpgradeModal.tsx, ApplyPreviewGate.tsx) sells. If it
   moves, all three move in the same change.

   Nothing here mentions a trial or a guarantee, on purpose. Whether checkout
   adds a free week is decided by NO_TRIAL_PLANS in server/src/routes/stripe.ts,
   and Stripe's own page states it when it applies. Saying nothing can never
   advertise something checkout does not do.                                  */

const PRICE = '$250';

/** The plan key checkout is opened with. Must be the plan PRICE describes. */
const PLAN_KEY = 'premium';

/**
 * One label, and it never changes while the Stripe session is being created.
 * The guard against a double click is `busy`, not the words.
 */
const CTA_LABEL = 'I want to commit';

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
        display: 'flex',
        flexDirection: 'column',
        background: colors.bgCanvas,
        color: colors.textPrimary,
        fontFamily: typeTokens.body,
      }}
    >
      <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} style={{ color: colors.accentPetrol }} />
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.04em' }}>Aussie Grad Careers</span>
        </div>
        {/* A way back for somebody who cancelled out of Stripe. A text link, so
            the page still has exactly one button. */}
        <a
          href="/"
          onClick={e => {
            e.preventDefault();
            navigate('/');
          }}
          style={{ fontSize: 13, fontWeight: 600, color: colors.textMuted, textDecoration: 'none' }}
        >
          Back to dashboard
        </a>
      </div>

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '32px 24px 96px',
        }}
      >
        <h1
          style={{
            fontFamily: typeTokens.display,
            fontSize: 'clamp(2rem, 6vw, 3.5rem)',
            fontWeight: 500,
            /* Not tighter than this: the highlighter block sits on top of the
               descenders of the line above at 1.05. */
            lineHeight: 1.16,
            letterSpacing: '-0.025em',
            margin: '0 0 40px',
            maxWidth: 760,
            fontVariationSettings: "'SOFT' 50, 'WONK' 1",
          }}
        >
          Land your dream job in Australia{' '}
          <span
            style={{
              background: colors.highlight,
              boxDecorationBreak: 'clone',
              WebkitBoxDecorationBreak: 'clone',
              padding: '0 clamp(4px, 1.5vw, 6px)',
            }}
          >
            using a systematic, data-backed process.
          </span>
        </h1>

        <PrimaryCTA label={CTA_LABEL} onClick={startCheckout} />

        <p style={{ fontSize: '1.0625rem', fontWeight: 600, color: colors.textPrimary, margin: '22px 0 0' }}>
          {PRICE} per month. Keep full access after 3 payments.
        </p>
        <p
          style={{
            fontSize: '0.8125rem',
            color: colors.textMuted,
            lineHeight: 1.6,
            margin: '8px 0 0',
            maxWidth: 440,
          }}
        >
          You will be charged {PRICE} on a monthly basis for the first three months, after which payment stops but
          you still have access to the platform for a year.
        </p>
      </main>
    </div>
  );
}

export default PricingPage;
