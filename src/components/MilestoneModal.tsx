import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Unlock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MilestoneConfig {
  threshold: 50 | 70;
  headline: string;
  sub: string;
  detail: string;
  color: string;
  ctaLabel: string;
  ctaPath: string;
}

const CONFIGS: Record<50 | 70, MilestoneConfig> = {
  50: {
    threshold: 50,
    headline: 'Halfway there. LinkedIn is your next weapon.',
    sub: 'Your profile just crossed 50. The LinkedIn Optimiser is now unlocked.',
    detail: 'A strong LinkedIn profile multiplies the impact of every application you send — recruiters check it before they call.',
    color: '#0a66c2',
    ctaLabel: 'Open LinkedIn Optimiser →',
    ctaPath: '/linkedin',
  },
  70: {
    threshold: 70,
    headline: "You're ready. Let's get you hired.",
    sub: 'Your profile just crossed 70. The job board and full workspace are open.',
    detail: 'Candidates above 70% have a significantly higher application-to-interview rate. You are in that group now.',
    color: '#6366f1',
    ctaLabel: 'Find my next role →',
    ctaPath: '/jobs',
  },
};

interface Props {
  milestone: 50 | 70 | null;
  onClose: () => void;
  isDark: boolean;
}

export const MilestoneModal: React.FC<Props> = ({ milestone, onClose, isDark }) => {
  const navigate = useNavigate();
  const cfg = milestone ? CONFIGS[milestone] : null;

  const bg = isDark ? '#0d1117' : '#fff';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const text = isDark ? '#f3f4f6' : '#111827';
  const sub = isDark ? '#9ca3af' : '#6b7280';

  return (
    <AnimatePresence>
      {cfg && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: bg, border: `1px solid ${border}`,
              borderRadius: 20, padding: '36px 36px 28px', maxWidth: 400, width: '100%',
              textAlign: 'center', position: 'relative',
            }}
          >
            <button
              onClick={onClose}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: sub, padding: 4 }}
            >
              <X size={16} />
            </button>

            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: '0 auto 18px',
              background: `${cfg.color}18`, border: `1px solid ${cfg.color}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Unlock size={24} style={{ color: cfg.color }} />
            </div>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14,
              padding: '4px 12px', borderRadius: 20,
              background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`,
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: cfg.color }}>
                {cfg.threshold}% Unlocked
              </span>
            </div>

            <h3 style={{ margin: '0 0 10px', fontSize: 21, fontWeight: 900, color: text, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {cfg.headline}
            </h3>
            <p style={{ margin: '0 0 6px', fontSize: 14, color: sub, lineHeight: 1.65 }}>
              {cfg.sub}
            </p>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: sub, lineHeight: 1.6, opacity: 0.7 }}>
              {cfg.detail}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => { navigate(cfg.ctaPath); onClose(); }}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 10,
                  background: cfg.color, border: 'none', color: '#fff',
                  fontSize: 14, fontWeight: 800, cursor: 'pointer',
                }}
              >
                {cfg.ctaLabel}
              </button>
              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 10,
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'}`,
                  color: sub, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Keep building my profile
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
