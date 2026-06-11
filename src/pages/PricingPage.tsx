import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';

// ─── Types ────────────────────────────────────────────────────────────────────

type Plan = 'monthly' | 'three_month' | 'annual';

interface PlanDef {
  id: Plan;
  name: string;
  price: string;
  weekly: string;
  billing: string;
  trial: string | null;
  cta: string;
  recommended?: boolean;
  features: string[];
  savings?: string;
}

// ─── Plan definitions ──────────────────────────────────────────────────────────

const PLANS: PlanDef[] = [
  {
    id: 'three_month',
    name: '3-Month Access',
    price: '$197 AUD',
    weekly: 'Full access for your job hunt',
    billing: 'one payment · 90 days access',
    trial: null,
    cta: 'Get 3-Month Access',
    recommended: true,
    features: [
      'Unlimited document generations',
      'Unlimited job analyses & match scoring',
      'Daily AI job feed',
      'Pay once, full access for 90 days',
      'Lifetime access to your documents',
    ],
    savings: 'One payment of $197 for three months. That\'s about $65 a month.\nAfterpay and Zip both work at checkout.',
  },
];

// ─── FAQ data ──────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'Is this a subscription?',
    a: "No. It's a single payment of $197 for 90 days of full access. No recurring charge, nothing to cancel.",
  },
  {
    q: 'What happens when I get a job?',
    a: "Congratulations, that's exactly what this is for. You keep every document you've created, and there's no subscription to cancel. We don't lock anything away.",
  },
  {
    q: 'Why 3 months?',
    a: "Most job searches take 6 to 12 weeks. Full access for 90 days is built to match a focused job hunt: pay once, no ongoing commitment.",
  },
  {
    q: 'Is my card charged immediately?',
    a: "Yes. It's a single one-time payment charged at checkout. No trial, no recurring billing.",
  },
  {
    q: 'Can I use Afterpay or Zip?',
    a: 'Yes. Both are supported at checkout. Afterpay splits $197 into four fortnightly payments. No interest, no ongoing commitment.',
  },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function PlanCard({ plan, onSelect, loading }: { plan: PlanDef; onSelect: () => void; loading: boolean }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 20,
        padding: '28px 24px',
        border: `1px solid ${plan.recommended ? `${warm.colors.accentPetrol}50` : warm.colors.borderWhisper}`,
        background: warm.colors.bgSurface,
      }}
    >
      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: warm.colors.textMuted }}>{plan.name}</p>
      <p style={{ margin: '0 0 2px', fontSize: 32, fontWeight: 900, color: warm.colors.textPrimary, lineHeight: 1 }}>{plan.price}</p>
      <p style={{ margin: '0 0 4px', fontSize: 11, color: warm.colors.textMuted }}>{plan.billing}</p>
      <p style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 700, color: warm.colors.accentPetrol }}>{plan.weekly}</p>

      {plan.trial && (
        <p style={{ margin: '0 0 16px', fontSize: 11, color: warm.colors.textMuted, fontStyle: 'italic' }}>{plan.trial} — no charge until day 8</p>
      )}
      {plan.savings && (
        <p style={{ margin: '0 0 16px', fontSize: 11, color: warm.colors.accentPetrol, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{plan.savings}</p>
      )}

      <ul style={{ margin: '0 0 24px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plan.features.map(f => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Check size={13} style={{ color: warm.colors.accentPetrol, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: warm.colors.textSecondary }}>{f}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onSelect}
        disabled={loading}
        style={{
          marginTop: 'auto',
          width: '100%',
          padding: '13px 0',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.6 : 1,
          transition: 'opacity 0.2s',
          background: plan.recommended ? warm.colors.accentPetrol : warm.colors.bgAlt,
          color: plan.recommended ? warm.colors.textOnDeep : warm.colors.textSecondary,
          border: plan.recommended ? 'none' : `1px solid ${warm.colors.borderWhisper}`,
        }}
      >
        {loading ? '...' : plan.cta}
      </button>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${warm.colors.borderWhisper}`, paddingBottom: 20 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          background: 'none',
          border: 'none',
          padding: '20px 0 0',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary }}>{q}</span>
        {open
          ? <ChevronUp size={16} style={{ color: warm.colors.textMuted, flexShrink: 0 }} />
          : <ChevronDown size={16} style={{ color: warm.colors.textMuted, flexShrink: 0 }} />}
      </button>
      {open && (
        <p style={{ margin: '12px 0 0', fontSize: 14, color: warm.colors.textSecondary, lineHeight: 1.7 }}>{a}</p>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<Plan | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  async function handleSelect(plan: Plan) {
    if (!user) {
      navigate('/auth');
      return;
    }
    setLoading(plan);
    try {
      const { data } = await api.post('/stripe/checkout', { plan });
      window.location.href = data.url;
    } catch (err: any) {
      setLoading(null);
      const msg = err?.response?.data?.error ?? '';
      if (msg.toLowerCase().includes('complimentary')) {
        toast.success('Your account already has full access - no payment needed.');
      } else {
        toast.error('Could not start checkout. Please try again.');
      }
    }
  }

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: warm.colors.bgCanvas, color: warm.colors.textPrimary }}>
      {/* Nav bar */}
      <div style={{ borderBottom: `1px solid ${warm.colors.borderWhisper}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} style={{ color: warm.colors.accentPetrol }} />
          <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.05em', color: warm.colors.textPrimary }}>Aussie Grad Careers</span>
        </div>
        <button
          onClick={() => navigate('/auth')}
          style={{
            background: warm.colors.bgAlt,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            color: warm.colors.textSecondary,
            cursor: 'pointer',
          }}
        >
          {user ? 'Go to dashboard →' : 'Log in →'}
        </button>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '72px 24px 96px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${warm.colors.accentPetrol}10`, border: `1px solid ${warm.colors.accentPetrol}28`, borderRadius: 99, padding: '6px 14px', marginBottom: 24 }}>
            <Zap size={12} style={{ color: warm.colors.accentPetrol }} />
            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: warm.colors.accentPetrol }}>Simple Pricing</span>
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 600, lineHeight: 1.1, margin: '0 0 16px', color: warm.colors.textPrimary }}>
            Get the job. Stop paying.
          </h1>
          <p style={{ fontSize: 17, color: warm.colors.textSecondary, maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
            The average Australian graduate earns $1,200+ per week in their first role.
            This is how you get there.
          </p>
        </div>

        {/* Plan */}
        <div style={{ maxWidth: 380, margin: '0 auto 80px' }}>
          {PLANS.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onSelect={() => handleSelect(plan.id)}
              loading={loading === plan.id}
            />
          ))}
        </div>

        {/* Free tier note */}
        <p style={{ textAlign: 'center', fontSize: 13, color: warm.colors.textMuted, marginBottom: 80 }}>
          Not ready? Start free — 5 document generations, 5 job analyses, 1 job feed search included on the free tier.
        </p>

        {/* FAQ */}
        <div style={{ maxWidth: 620, margin: '0 auto' }}>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: warm.colors.textPrimary }}>Questions</h2>
          <p style={{ fontSize: 14, color: warm.colors.textSecondary, marginBottom: 8 }}>Everything you need to know before signing up.</p>
          <div>
            {FAQS.map(faq => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{ textAlign: 'center', marginTop: 80 }}>
          <p style={{ fontSize: 14, color: warm.colors.textSecondary, marginBottom: 20 }}>
            Questions? Reach us at{' '}
            <span style={{ color: warm.colors.accentPetrol }}>support@aussiegradcareers.com.au</span>
          </p>
          <button
            onClick={() => navigate('/auth')}
            style={{
              background: warm.colors.accentPetrol,
              color: warm.colors.textOnDeep,
              border: 'none',
              borderRadius: 12,
              padding: '14px 32px',
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {user ? 'Go to dashboard →' : 'Get started free →'}
          </button>
        </div>

        {/* Legal footer */}
        <div style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: `1px solid ${warm.colors.borderWhisper}`,
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '8px 24px',
        }}>
          {[
            { to: '/legal/terms',        label: 'Terms of Service' },
            { to: '/legal/privacy',      label: 'Privacy Policy' },
            { to: '/legal/refunds',      label: 'Refund Policy' },
            { to: '/legal/cancellation', label: 'Cancellation Policy' },
            { to: '/legal/trial',        label: 'Free Trial Terms' },
            { to: '/legal/disclaimer',   label: 'Disclaimer' },
          ].map(({ to, label }) => (
            <Link key={to} to={to} style={{ fontSize: 12, color: warm.colors.textMuted, textDecoration: 'none' }}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
