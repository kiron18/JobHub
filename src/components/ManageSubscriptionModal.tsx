import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAppTheme } from '../contexts/ThemeContext';
import {
  trackManageSubscriptionOpened,
  trackCancellationReasonSelected,
  trackCancellationPortalOpened,
} from '../lib/analytics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  plan: string;
  planStatus: string;
}

type ReasonKey = 'confusing' | 'no_time' | 'no_results' | 'price' | 'other';

interface Reason {
  key: ReasonKey;
  label: string;
}

const REASONS: Reason[] = [
  { key: 'confusing',  label: "Too confusing, I don't know where to start" },
  { key: 'no_time',   label: "Not enough time to use it properly" },
  { key: 'no_results',label: "Not seeing results fast enough" },
  { key: 'price',     label: "Price feels too high right now" },
  { key: 'other',     label: "Something else" },
];

const RESPONSES: Record<ReasonKey, React.ReactNode> = {
  confusing: (
    <>
      <p>The fastest path: go to the dashboard, paste any job description, and hit analyse. One action gets you a ranked match, a skills gap, and a tailored resume draft. Start there, nothing else matters yet.</p>
      <p>A full walkthrough video is coming shortly. If you want a hand now, reply to any email from us.</p>
    </>
  ),
  no_time: (
    <>
      <p>You don't need a dedicated session, you need 15 minutes. Pick one role you actually want, paste the description, generate the resume, apply. That's a complete application cycle.</p>
      <p>Most users who apply once come back because they see how fast it is. Give it one application before you go.</p>
    </>
  ),
  no_results: (
    <>
      <p>Most users get their first interview invite in week 3. Your diagnostic is already done, that's the hard part. What's left is sending applications with documents that are actually matched to the role, not generic ones.</p>
      <p>You're closer than you think. The infrastructure is built, you just need to use it on the next three roles you apply to.</p>
    </>
  ),
  price: (
    <>
      <p>Our most popular plan is around $65 a month. One interview call, let alone an offer, is worth more than a year of that.</p>
      <p>If the current plan isn't the right fit, you can switch without losing anything you've already built. Your profile, achievements, and documents stay exactly where they are.</p>
    </>
  ),
  other: (
    <>
      <p>We'd genuinely like to understand what's not working. Hit reply on any email from us, it goes directly to the team, not a support queue.</p>
    </>
  ),
};

const overlay = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.18 },
};

const card = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 8 },
  transition: { duration: 0.22, ease: [0.25, 1, 0.5, 1] as [number, number, number, number] },
};

const slideDown = {
  initial: { opacity: 0, height: 0, overflow: 'hidden' },
  animate: { opacity: 1, height: 'auto', overflow: 'visible' },
  exit: { opacity: 0, height: 0, overflow: 'hidden' },
  transition: { duration: 0.2, ease: [0.25, 1, 0.5, 1] as [number, number, number, number] },
};

export const ManageSubscriptionModal: React.FC<Props> = ({ isOpen, onClose, plan, planStatus: _planStatus }) => {
  const { isDark } = useAppTheme();
  const [selected, setSelected] = useState<ReasonKey | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (isOpen) trackManageSubscriptionOpened();
  }, [isOpen]);

  const bg        = isDark ? '#0f1117' : '#ffffff';
  const border    = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textMain  = isDark ? '#f3f4f6' : '#111827';
  const textMuted = isDark ? '#9ca3af' : '#6b7280';
  const cardBg    = isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb';
  const reasonHoverBg  = isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6';
  const reasonActiveBg = isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.07)';
  const responseBg     = isDark ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.05)';

  async function handleCancel() {
    trackCancellationPortalOpened();
    setCancelling(true);
    try {
      const { data } = await api.post('/stripe/portal');
      window.location.href = data.url;
    } catch {
      toast.error('Could not open billing portal. Please try again.');
      setCancelling(false);
    }
  }

  async function handleSwitchPlan() {
    setCancelling(true);
    try {
      const { data } = await api.post('/stripe/portal');
      window.location.href = data.url;
    } catch {
      toast.error('Could not open billing portal. Please try again.');
      setCancelling(false);
    }
  }

  const planLabel = plan === 'annual' ? 'annual' : plan === 'three_month' ? '3-month' : 'monthly';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          {...overlay}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <motion.div
            {...card}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: 18,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6366f1', marginBottom: 6 }}>
                  Before you go
                </p>
                <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: textMain, margin: 0, lineHeight: 1.3 }}>
                  Most people see results in weeks&nbsp;2–3.
                </h2>
                <p style={{ fontSize: 13, color: textMuted, marginTop: 6, lineHeight: 1.6 }}>
                  You're closer than you think. What's making you consider leaving?
                </p>
              </div>
              <button
                onClick={onClose}
                style={{ flexShrink: 0, padding: 6, borderRadius: 8, border: 'none', background: 'transparent', color: textMuted, cursor: 'pointer', marginTop: -2 }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Video placeholder, reserved for personalised video */}
            <div style={{ margin: '18px 24px 0', borderRadius: 10, background: cardBg, border: `1px solid ${border}`, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '8px solid #6366f1', marginLeft: 2 }} />
              </div>
              <span style={{ fontSize: 12, color: textMuted }}>Personalised video message, coming soon</span>
            </div>

            {/* Reason selector */}
            <div style={{ padding: '18px 24px 0' }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: textMuted, marginBottom: 8 }}>
                What's going on?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {REASONS.map(({ key, label }) => {
                  const isActive = selected === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        const next = isActive ? null : key;
                        setSelected(next);
                        if (next) trackCancellationReasonSelected(next);
                      }}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: `1px solid ${isActive ? 'rgba(99,102,241,0.4)' : border}`,
                        background: isActive ? reasonActiveBg : 'transparent',
                        color: isActive ? (isDark ? '#c7d2fe' : '#4338ca') : textMain,
                        fontSize: 13, fontWeight: isActive ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.14s ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        minHeight: 44,
                      }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = reasonHoverBg; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    >
                      <span>{label}</span>
                      {isActive && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tailored response */}
            <AnimatePresence>
              {selected && (
                <motion.div {...slideDown}>
                  <div style={{ margin: '14px 24px 0', padding: '14px 16px', borderRadius: 10, background: responseBg, border: `1px solid rgba(99,102,241,0.15)` }}>
                    <div style={{ fontSize: 13, color: textMuted, lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {RESPONSES[selected]}
                    </div>
                    {selected === 'price' && (
                      <button
                        onClick={handleSwitchPlan}
                        disabled={cancelling}
                        style={{
                          marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)',
                          background: 'rgba(99,102,241,0.1)', color: isDark ? '#c7d2fe' : '#4338ca',
                          fontSize: 12, fontWeight: 700, cursor: cancelling ? 'not-allowed' : 'pointer',
                          opacity: cancelling ? 0.5 : 1, transition: 'opacity 0.15s',
                        }}
                      >
                        Switch plan <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer actions */}
            <div style={{ padding: '18px 24px 24px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <div style={{ height: 1, background: border, marginBottom: 2 }} />

              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{
                  width: '100%', padding: '11px 16px',
                  borderRadius: 10, border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.3)'}`,
                  background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)',
                  color: isDark ? '#fca5a5' : '#dc2626',
                  fontSize: 13, fontWeight: 600,
                  cursor: cancelling ? 'not-allowed' : 'pointer',
                  opacity: cancelling ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.15s ease',
                  minHeight: 44,
                }}
              >
                {cancelling
                  ? <><RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Opening billing portal…</>
                  : `Cancel my ${planLabel} subscription`
                }
              </button>

              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: '11px 16px',
                  borderRadius: 10, border: `1px solid ${border}`,
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb',
                  color: textMain,
                  fontSize: 13, fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  minHeight: 44,
                }}
              >
                Keep my account
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
