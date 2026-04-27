import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

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
}

// ─── Plan definitions ──────────────────────────────────────────────────────────

const PLANS: PlanDef[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '$97 AUD',
    weekly: '≈ $25/week',
    billing: 'per month, billed monthly',
    trial: '7-day free trial',
    cta: 'Start Free Trial',
    features: [
      'Unlimited document generations',
      'Unlimited job analyses',
      'Daily AI job feed',
      'Match scoring',
      'Cancel anytime',
    ],
  },
  {
    id: 'three_month',
    name: '3-Month Bundle',
    price: '$197 AUD',
    weekly: 'Best value for active job seekers',
    billing: 'one payment · 90 days access',
    trial: null,
    cta: 'Get 3-Month Access',
    recommended: true,
    features: [
      'Everything in Monthly',
      'No recurring charge',
      'Pay once, apply for 90 days',
      'Great for structured job hunts',
      'Lifetime access to your documents',
    ],
  },
  {
    id: 'annual',
    name: 'Annual',
    price: '$597 AUD',
    weekly: '≈ $11.50/week',
    billing: 'per year, billed annually',
    trial: '7-day free trial',
    cta: 'Start Free Trial',
    features: [
      'Everything in Monthly',
      'Lowest weekly rate',
      'Best for ongoing career management',
      'Annual billing saves $567 vs monthly',
      'Cancel anytime',
    ],
  },
];

// ─── FAQ data ──────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Monthly and Annual plans can be cancelled any time from your account. You retain access until the end of the billing period. The 3-Month Bundle is a one-time payment — no recurring charge, no cancellation needed.',
  },
  {
    q: 'What happens when I get a job?',
    a: "Congratulations — that's exactly what this is for. You can cancel your subscription immediately and keep all the documents you've created. We don't lock anything away.",
  },
  {
    q: 'Why is there a 3-month option?',
    a: "Most job searches take 6–12 weeks. The 3-Month Bundle is designed to match a focused job hunt — pay once, get full access for 90 days, no ongoing commitment. It's our most popular plan for a reason.",
  },
  {
    q: 'Is my card charged immediately?',
    a: "For the 3-Month Bundle, yes — it's a one-time payment charged immediately. For Monthly and Annual plans, your free trial starts immediately and your card is charged on day 8 unless you cancel first.",
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
        border: `1px solid ${plan.recommended ? 'rgba(45,212,191,0.35)' : 'rgba(255,255,255,0.08)'}`,
        background: plan.recommended
          ? 'linear-gradient(135deg, rgba(15,118,110,0.20), rgba(19,34,68,0.22))'
          : 'rgba(255,255,255,0.03)',
        transition: 'border-color 0.2s',
      }}
    >
      {plan.recommended && (
        <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)' }}>
          <span style={{
            background: 'linear-gradient(135deg, #0F766E, #134E4A)',
            color: 'white',
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            padding: '4px 14px',
            borderRadius: 99,
          }}>
            Recommended
          </span>
        </div>
      )}

      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>{plan.name}</p>
      <p style={{ margin: '0 0 2px', fontSize: 32, fontWeight: 900, color: 'white', lineHeight: 1 }}>{plan.price}</p>
      <p style={{ margin: '0 0 4px', fontSize: 11, color: '#64748b' }}>{plan.billing}</p>
      <p style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 700, color: '#2dd4bf' }}>{plan.weekly}</p>

      {plan.trial && (
        <p style={{ margin: '0 0 16px', fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>{plan.trial} — no charge until day 8</p>
      )}

      <ul style={{ margin: '0 0 24px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plan.features.map(f => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Check size={13} style={{ color: '#2dd4bf', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: '#cbd5e1' }}>{f}</span>
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
          background: plan.recommended
            ? 'linear-gradient(135deg, #0F766E, #134E4A)'
            : 'rgba(255,255,255,0.06)',
          color: plan.recommended ? 'white' : '#9ca3af',
          border: plan.recommended ? 'none' : '1px solid rgba(255,255,255,0.1)',
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
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 20 }}>
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
        <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>{q}</span>
        {open
          ? <ChevronUp size={16} style={{ color: '#64748b', flexShrink: 0 }} />
          : <ChevronDown size={16} style={{ color: '#64748b', flexShrink: 0 }} />}
      </button>
      {open && (
        <p style={{ margin: '12px 0 0', fontSize: 14, color: '#94a3b8', lineHeight: 1.7 }}>{a}</p>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<Plan | null>(null);

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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0d1a2d 0%, #080f1a 100%)', color: 'white' }}>
      {/* Nav bar */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} style={{ color: '#2dd4bf' }} />
          <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.05em', color: 'white' }}>Aussie Grad Careers</span>
        </div>
        <button
          onClick={() => navigate('/auth')}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            color: '#94a3b8',
            cursor: 'pointer',
          }}
        >
          {user ? 'Go to dashboard →' : 'Log in →'}
        </button>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '72px 24px 96px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 99, padding: '6px 14px', marginBottom: 24 }}>
            <Zap size={12} style={{ color: '#2dd4bf' }} />
            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2dd4bf' }}>Simple Pricing</span>
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.1, margin: '0 0 16px', color: 'white' }}>
            Get the job. Stop paying.
          </h1>
          <p style={{ fontSize: 17, color: '#94a3b8', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
            The average Australian graduate earns $1,200+ per week in their first role.
            This is how you get there.
          </p>
        </div>

        {/* Plans */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 80 }}>
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
        <p style={{ textAlign: 'center', fontSize: 13, color: '#475569', marginBottom: 80 }}>
          Not ready? Start free — 5 document generations, 5 job analyses, 1 job feed search included on the free tier.
        </p>

        {/* FAQ */}
        <div style={{ maxWidth: 620, margin: '0 auto' }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8, color: 'white' }}>Questions</h2>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>Everything you need to know before signing up.</p>
          <div>
            {FAQS.map(faq => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{ textAlign: 'center', marginTop: 80 }}>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
            Questions? Reach us at{' '}
            <span style={{ color: '#2dd4bf' }}>support@aussiegradcareers.com</span>
          </p>
          <button
            onClick={() => navigate('/auth')}
            style={{
              background: 'linear-gradient(135deg, #0F766E, #134E4A)',
              color: 'white',
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
      </div>
    </div>
  );
}
