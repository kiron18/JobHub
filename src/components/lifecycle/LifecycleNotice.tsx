import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { SPRING, prefersReducedMotion } from '../../lib/theme/motion';
import { useAuth } from '../../contexts/AuthContext';
import { useTrialChallengeState } from '../../lib/trialChallenge';

/** Pages a popup must never cover: signup, checkout, auth, admin and the dev previews. */
const QUIET_PREFIXES = ['/welcome', '/pricing', '/auth', '/set-password', '/admin', '/dev', '/legal'];

/* ── LifecycleNotice ───────────────────────────────────────────────────
   The login popups that sit alongside the client lifecycle emails
   (server/src/services/lifecycle). The server decides which one, if any,
   is due (rules.ts noticeFor) and what it quotes, so the amount and date
   on screen are the ones Stripe will actually charge.

   At most one at a time, once each. The day-3 ask is the exception: it
   comes back once a day until they add a card, because it is the one that
   asks for a decision.

   Also handles /?billing=portal, the link the emails use for "review your
   plan": it opens the person's Stripe billing portal.
*/

export type NoticeKey =
  | 'day3_commit' | 'card_added' | 'pre_first_charge' | 'first_payment'
  | 'pre_second_charge' | 'pre_third_charge' | 'plan_completed';

export interface Notice {
  key: NoticeKey;
  ackKey: string;
  amount: string;
  chargeDate: string | null;
  daysSinceSignup: number;
  includedMonths: number;
}

async function openPortal() {
  try {
    const { data } = await api.post('/stripe/portal');
    if (data?.url) window.location.assign(data.url);
  } catch {
    toast.error('Could not open your billing details. Email kiron@aussiegradcareers.com.au and I will sort it out.');
  }
}

export function LifecycleNotice() {
  const { user } = useAuth();
  const signedIn = !!user && !(user as { is_anonymous?: boolean }).is_anonymous;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const quietPage = QUIET_PREFIXES.some((p) => pathname.startsWith(p));
  // Never on top of a running trial-challenge window: that screen is a timer.
  const { data: trial } = useTrialChallengeState();
  const challengeRunning = trial?.status === 'day_in_progress';
  const [busy, setBusy] = useState(false);

  // Read once at mount. /?lifecycle=<key> is the admin preview of any popup on
  // the owner's own login; /?trial=continue is the day-3 email's button.
  const [params] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const preview = q.get('lifecycle');
    if (preview) return { preview };
    if (q.get('trial') === 'continue') return { want: 'day3_commit' };
    return {};
  });
  const queryKey = ['lifecycle-notice', params];

  const { data } = useQuery({
    queryKey,
    queryFn: async () => (await api.get('/lifecycle/notice', { params })).data as { notice: Notice | null },
    enabled: signedIn,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const notice = data?.notice ?? null;

  // The emails' "review your plan" link.
  const portalOpened = useRef(false);
  useEffect(() => {
    if (!signedIn || portalOpened.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing') !== 'portal') return;
    portalOpened.current = true;
    window.history.replaceState({}, '', '/');
    openPortal();
  }, [signedIn]);

  function ack() {
    if (!notice) return;
    api.post('/lifecycle/notice/ack', { ackKey: notice.ackKey }).catch(() => {});
    qc.setQueryData(queryKey, { notice: null });
  }

  // Acknowledging clears the cached notice, which is what closes the card.
  function dismiss() {
    ack();
  }

  async function startTrial() {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.post('/stripe/checkout', { plan: 'premium' });
      ack();
      window.location.assign(data.url);
    } catch (err: unknown) {
      setBusy(false);
      if (isAxiosError(err) && err.response?.status === 410) {
        toast.error('Card setup is temporarily unavailable. Email kiron@aussiegradcareers.com.au and I will sort you out.');
      } else {
        toast.error('Could not open card setup. Please try again.');
      }
    }
  }

  if (!notice || quietPage || challengeRunning) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="lifecycle-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 5100,
          background: 'rgba(20,16,12,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, overflowY: 'auto',
        }}
      >
        <LifecycleNoticeCard
          notice={notice}
          busy={busy}
          onDismiss={dismiss}
          onStartTrial={startTrial}
          onPortal={openPortal}
          onNavigate={(to) => navigate(to)}
        />
      </motion.div>
    </AnimatePresence>
  );
}

interface CardProps {
  notice: Notice;
  busy?: boolean;
  onDismiss: () => void;
  onStartTrial: () => void;
  onPortal: () => void;
  onNavigate: (to: string) => void;
}

/** The card on its own, so /dev/lifecycle-preview can show every variant without a login. */
export function LifecycleNoticeCard({ notice: n, busy = false, onDismiss: dismiss, onStartTrial: startTrial, onPortal: openPortal, onNavigate: navigate }: CardProps) {
  const [committed, setCommitted] = useState(false);
  const reduced = prefersReducedMotion();
  const charge = n.chargeDate ? `${n.amount} on ${n.chargeDate}` : n.amount;

  const planLines = [
    n.key === 'card_added' || n.key === 'pre_first_charge'
      ? `First scheduled payment: ${charge}`
      : null,
    `Commitment: three monthly payments of ${n.amount}`,
    `After all three payments: ${n.includedMonths} months of access included at no additional subscription charge`,
  ].filter(Boolean) as string[];

  let eyebrow = '';
  let title = '';
  let body: React.ReactNode = null;
  let primary: { label: string; onClick: () => void; disabled?: boolean } = { label: 'Got it', onClick: dismiss };
  let secondary: { label: string; onClick: () => void } | null = null;

  switch (n.key) {
    case 'day3_commit':
      eyebrow = n.daysSinceSignup <= 3 ? 'Day 3 of your trial' : 'Your initial trial';
      title = n.daysSinceSignup <= 3 ? 'Your initial three days are nearly up' : 'Your initial three days are up';
      body = (
        <>
          <NotCharged
            headline="You will not be charged when you add your card."
            detail={`Adding your card unlocks another seven days, free. Your first payment of ${n.amount} is only scheduled after those seven days, and you will see the exact date before you confirm.`}
          />
          <P>Don't spend the extra time simply exploring features. Use it to complete applications, contact relevant people, and build a job-search routine you can repeat.</P>
          <label style={{
            display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', cursor: 'pointer',
            padding: '12px 14px', borderRadius: warm.radius.input, margin: '0 0 14px',
            border: `1.5px solid ${committed ? warm.colors.accentPetrol : warm.colors.borderDefined}`,
            background: committed ? warm.colors.accentPetrolSoft : warm.colors.bgSurface,
          }}>
            <input
              type="checkbox"
              checked={committed}
              onChange={(e) => setCommitted(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, accentColor: warm.colors.accentPetrol, flexShrink: 0 }}
            />
            <span style={{ fontSize: 15, lineHeight: 1.5, color: warm.colors.textPrimary, fontWeight: 600 }}>
              I'm committing to the next seven days: one complete application a day, and someone relevant contacted for each one.
            </span>
          </label>
          <Small>Plan: three monthly payments of {n.amount}, then {n.includedMonths} months of access included. Cancel before your first payment and you pay nothing.</Small>
        </>
      );
      primary = { label: busy ? 'Opening...' : 'I commit, unlock 7 more days', onClick: startTrial, disabled: !committed || busy };
      secondary = { label: 'Not today', onClick: dismiss };
      break;

    case 'card_added':
      eyebrow = 'Extended trial active';
      title = 'Your extra seven days are unlocked';
      body = (
        <>
          <NotCharged headline="You have not been charged today." detail="You have seven additional days before your first scheduled payment." />
          <List items={planLines} />
          <P>Use these extra days to establish your workflow and see how the system fits into your job search.</P>
        </>
      );
      primary = { label: "Let's go", onClick: dismiss };
      secondary = { label: 'Review plan details', onClick: () => { dismiss(); openPortal(); } };
      break;

    case 'pre_first_charge':
      eyebrow = 'Trial reminder';
      title = 'Your extended trial ends soon';
      body = (
        <>
          <P><strong>Your first payment of {n.amount} is scheduled{n.chargeDate ? ` for ${n.chargeDate}` : ''}.</strong></P>
          <List items={planLines.slice(1)} />
          <P>The aim is to help you build a consistent job-search process, not simply give you another piece of software to use occasionally.</P>
        </>
      );
      secondary = { label: 'Review billing details', onClick: () => { dismiss(); openPortal(); } };
      break;

    case 'first_payment':
      eyebrow = 'Paid plan active';
      title = "Let's make the next 90 days count";
      body = (
        <>
          <P>Build a repeatable routine:</P>
          <List ordered items={[
            'Identify suitable roles.',
            'Tailor your application and complete it properly.',
            'Track the application and identify someone relevant to contact.',
            'Send outreach and follow up when appropriate.',
            "Review what's working and improve your approach.",
          ]} />
          <P>Consistency matters more than one exceptionally productive day followed by a week of inactivity.</P>
        </>
      );
      primary = { label: 'Start my next application', onClick: () => { dismiss(); navigate('/check'); } };
      secondary = { label: 'Later', onClick: dismiss };
      break;

    case 'pre_second_charge':
      eyebrow = 'Month one';
      title = 'Review your progress';
      body = (
        <>
          <P>Look at the applications you've submitted, the people you've contacted, and the responses you've received. Are you targeting appropriate roles? Are you following up? Are you improving your applications based on feedback?</P>
          <P><strong>Your next scheduled payment is {charge}.</strong></P>
          <Small>This plan is three monthly payments of {n.amount}. After all three, you'll receive {n.includedMonths} months of access at no additional subscription charge.</Small>
        </>
      );
      primary = { label: 'Review my tracker', onClick: () => { dismiss(); navigate('/tracker'); } };
      secondary = { label: 'Later', onClick: dismiss };
      break;

    case 'pre_third_charge':
      eyebrow = 'Final payment';
      title = 'Your final scheduled payment is approaching';
      body = (
        <>
          <P><strong>Your next scheduled payment is {charge}.</strong></P>
          <P>Once this third payment is complete, your plan includes a further {n.includedMonths} months of access at no additional subscription charge.</P>
          <P>Don't treat the end of these three months as the end of your job search. The goal is a repeatable system you can keep using.</P>
        </>
      );
      primary = { label: 'Keep moving forward', onClick: dismiss };
      break;

    case 'plan_completed':
      eyebrow = 'Plan complete';
      title = `Your ${n.includedMonths} months of included access are unlocked`;
      body = (
        <>
          <P>You've completed all three monthly payments. Your included {n.includedMonths} months of access are now active.</P>
          <P>The platform helps you run a more consistent job search, but no tool can guarantee a job. What matters is how you use it and how you respond to results.</P>
        </>
      );
      primary = { label: 'Continue my job search', onClick: dismiss };
      break;
  }

  return (
          <motion.div
            key="lifecycle-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lifecycle-title"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={reduced ? { duration: 0.12 } : SPRING.arrive}
            style={{
              width: '100%', maxWidth: 460,
              background: warm.colors.bgSurface,
              border: `1px solid ${warm.colors.borderWhisper}`,
              borderRadius: warm.radius.card,
              boxShadow: warm.shadow.lifted,
              padding: '26px 24px 20px',
              fontFamily: warm.type.fontBody,
            }}
          >
            <div style={{ ...warm.text.micro, color: warm.colors.accentPetrol, marginBottom: 8 }}>{eyebrow}</div>
            <h2 id="lifecycle-title" style={{ ...warm.popup.title, color: warm.colors.textPrimary, margin: '0 0 14px' }}>{title}</h2>
            {body}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
              <button
                onClick={primary.onClick}
                disabled={primary.disabled}
                style={{
                  padding: '12px 18px', borderRadius: warm.radius.button, fontSize: 15.5, fontWeight: 700,
                  border: 'none', cursor: primary.disabled ? 'default' : 'pointer',
                  background: primary.disabled ? warm.colors.borderDefined : warm.colors.accentPetrol,
                  color: '#fff',
                }}
              >
                {primary.label}
              </button>
              {secondary && (
                <button
                  onClick={secondary.onClick}
                  style={{
                    padding: '9px 18px', borderRadius: warm.radius.button, fontSize: 14.5, fontWeight: 600,
                    border: 'none', background: 'transparent', color: warm.colors.textSecondary, cursor: 'pointer',
                  }}
                >
                  {secondary.label}
                </button>
              )}
            </div>
          </motion.div>
  );
}

/** The "you will not be charged" block. Deliberately the loudest thing on the card. */
function NotCharged({ headline, detail }: { headline: string; detail: string }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      background: warm.colors.successSoft, border: `1.5px solid ${warm.colors.success}`,
      borderRadius: warm.radius.input, padding: '14px 14px', margin: '0 0 16px',
    }}>
      <ShieldCheck size={26} color={warm.colors.success} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.3, color: warm.colors.success, marginBottom: 4 }}>{headline}</div>
        <div style={{ fontSize: 15, lineHeight: 1.5, color: warm.colors.textPrimary }}>{detail}</div>
      </div>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ ...warm.popup.body, fontSize: 15.5, color: warm.colors.textSecondary, margin: '0 0 12px' }}>{children}</p>;
}

function Small({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13.5, lineHeight: 1.5, color: warm.colors.textMuted, margin: '0 0 4px' }}>{children}</p>;
}

function List({ items, ordered }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag style={{ margin: '0 0 12px', paddingLeft: 22, listStyle: ordered ? 'decimal' : 'disc', fontSize: 15, lineHeight: 1.55, color: warm.colors.textPrimary }}>
      {items.map((s) => <li key={s} style={{ marginBottom: 4 }}>{s}</li>)}
    </Tag>
  );
}
