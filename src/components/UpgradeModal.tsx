import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap } from 'lucide-react';
import api from '../lib/api';
import { trackUpgradeModalOpened, trackCheckoutStarted, trackFreeLimitHit } from '../lib/analytics';

export type UpgradeTrigger = 'generation' | 'analysis' | 'job_search' | 'match_score';

const TRIGGER_HEADLINES: Record<UpgradeTrigger, string> = {
  generation: "You've used your 5 free document generations",
  analysis: "You've used your 5 free job analyses",
  job_search: "You've used your free job feed search",
  match_score: "You've used your free match score",
};

interface Props {
  trigger: UpgradeTrigger;
  onClose: () => void;
}

interface PlanCardProps {
  name: string;
  price: string;
  weekly: string;
  billing: string;
  trial: string | null;
  cta: string;
  recommended?: boolean;
  savings?: string;
  onSelect: () => void;
  loading: boolean;
}

function PlanCard({ name, price, weekly, billing, trial, cta, recommended, savings, onSelect, loading }: PlanCardProps) {
  return (
    <div
      className="relative flex flex-col rounded-2xl border p-5 transition-all"
      style={{
        background: recommended
          ? 'linear-gradient(135deg, rgba(15,118,110,0.10), rgba(197,160,89,0.08))'
          : '#F4EFE8',
        borderColor: recommended ? 'rgba(15,118,110,0.35)' : 'rgba(26,24,20,0.08)',
      }}
    >
      {recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-brand-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
            Recommended
          </span>
        </div>
      )}

      <p className="text-xs font-black uppercase tracking-wider text-[#5C5750] mb-2">{name}</p>
      <p className="text-2xl font-black text-[#1A1814] mb-0.5">{price}</p>
      <p className="text-[11px] text-[#8B847B] mb-1">{billing}</p>
      <p className="text-xs font-bold text-brand-400 mb-4">{weekly}</p>

      {trial && (
        <p className="text-[10px] text-[#8B847B] mb-3">{trial}</p>
      )}
      {savings && (
        <p className="text-[11px] text-brand-400 mb-3 leading-relaxed whitespace-pre-line">{savings}</p>
      )}

      <button
        onClick={onSelect}
        disabled={loading}
        className="mt-auto w-full rounded-xl py-2.5 text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
        style={{
          background: recommended
            ? 'linear-gradient(135deg, #2D5A6E, #1F4253)'
            : '#FFFFFF',
          color: recommended ? '#FFFFFF' : '#5C5750',
          border: recommended ? 'none' : '1px solid rgba(26,24,20,0.16)',
        }}
      >
        {loading ? '...' : cta}
      </button>
    </div>
  );
}

export const UpgradeModal: React.FC<Props> = ({ trigger, onClose }) => {
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    trackUpgradeModalOpened(trigger);
    trackFreeLimitHit(trigger);
  }, [trigger]);

  const handleCheckout = async (plan: 'monthly' | 'annual' | 'three_month') => {
    trackCheckoutStarted(plan);
    setLoading(plan);
    try {
      const { data } = await api.post('/stripe/checkout', { plan });
      window.location.href = data.url;
    } catch {
      setLoading(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(26,24,20,0.40)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl rounded-2xl border border-[rgba(26,24,20,0.10)] p-6 relative"
          style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,20,0.04), 0 6px 20px rgba(26,24,20,0.06), 0 18px 48px rgba(26,24,20,0.04)' }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#8B847B] hover:text-[#1A1814] transition-colors"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-brand-400" />
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Upgrade</p>
          </div>
          <h2 className="text-xl font-black text-[#1A1814] mb-1">{TRIGGER_HEADLINES[trigger]}</h2>
          <p className="text-sm text-[#5C5750] mb-6">
            Start your 7-day free trial, no charge until day 8, cancel anytime.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <PlanCard
              name="Monthly"
              price="$97 AUD/mo"
              weekly="$25/week"
              billing="Billed monthly"
              trial="7-day free trial"
              cta="Start Free Trial"
              onSelect={() => handleCheckout('monthly')}
              loading={loading === 'monthly'}
            />
            <PlanCard
              name="3-Month Bundle"
              price="$197 AUD"
              weekly="Best value for job seekers"
              billing="One payment, 90 days access"
              trial={null}
              savings={"Three months for $197. That's $65 a month — $94 less than paying monthly.\nAfterpay and Zip both work at checkout."}
              cta="Get 3-Month Access"
              recommended
              onSelect={() => handleCheckout('three_month')}
              loading={loading === 'three_month'}
            />
            <PlanCard
              name="Annual"
              price="$597 AUD/yr"
              weekly="$11.50/week"
              billing="Billed annually"
              trial="7-day free trial"
              cta="Start Free Trial"
              onSelect={() => handleCheckout('annual')}
              loading={loading === 'annual'}
            />
          </div>

          <p className="text-center text-[11px] text-[#8B847B] italic">
            "The average Australian graduate earns $1,200+ per week in their first role. This is how you get there."
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
