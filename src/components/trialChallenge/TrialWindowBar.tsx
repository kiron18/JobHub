import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { warm } from '../../lib/theme/warmTokens';

const C = warm.colors;

interface Props {
  windowEndsAt: string;
  appliedThisWindow: number;
  minimumRequired: number;
  linkedinUnlocked: boolean;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Server-authoritative countdown: ticks against `windowEndsAt`, never a
 * client-started timer, so a refresh mid-window never resets the clock.
 */
export function TrialWindowBar({ windowEndsAt, appliedThisWindow, minimumRequired, linkedinUnlocked }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [justUnlocked, setJustUnlocked] = useState(false);
  const endsAt = new Date(windowEndsAt).getTime();

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!linkedinUnlocked) return;
    setJustUnlocked(true);
    const id = window.setTimeout(() => setJustUnlocked(false), 4000);
    return () => window.clearTimeout(id);
  }, [linkedinUnlocked]);

  const remaining = formatRemaining(endsAt - now);
  const passed = minimumRequired === 0 || appliedThisWindow >= minimumRequired;

  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 4000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
        padding: '8px 16px', background: C.bgDeep, color: '#fff', fontSize: 13, fontWeight: 700,
      }}>
        <span>⏱ {remaining}</span>
        {minimumRequired > 0 && (
          <span style={{ color: passed ? '#7ee0b0' : 'inherit' }}>
            {appliedThisWindow} of {minimumRequired} applications
          </span>
        )}
      </div>
      <AnimatePresence>
        {justUnlocked && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 44, left: '50%', transform: 'translateX(-50%)', zIndex: 4001,
              background: C.success, color: '#fff', padding: '8px 16px', borderRadius: 999,
              fontSize: 13, fontWeight: 700,
            }}
          >
            LinkedIn tools unlocked 🎉
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
