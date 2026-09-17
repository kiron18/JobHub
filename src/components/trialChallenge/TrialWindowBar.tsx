import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { warm } from '../../lib/theme/warmTokens';
import { TrialDayProgress } from './TrialDayProgress';

const C = warm.colors;

interface Props {
  currentDay: number;
  windowEndsAt: string;
  appliedThisWindow: number;
  minimumRequired: number;
  linkedinUnlocked: boolean;
}

/**
 * The everything-is-already-written reminder: countering the "this feels
 * hard" read of a timed window by pointing at what the app already did.
 * Shown once, briefly, at the start of each day's window (component remounts
 * per window, so this naturally resets day to day without extra state).
 */
function SkimTip() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setVisible(false), 7000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          style={{
            maxWidth: 'calc(100vw - 32px)', background: C.bgSurface, color: C.textPrimary,
            border: `1px solid ${C.borderDefined}`, padding: '10px 16px', borderRadius: 12,
            fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', textAlign: 'center',
          }}
        >
          It's already written for you, just skim it and hit send.
        </motion.div>
      )}
    </AnimatePresence>
  );
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
export function TrialWindowBar({ currentDay, windowEndsAt, appliedThisWindow, minimumRequired, linkedinUnlocked }: Props) {
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
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap',
        padding: '8px 16px', background: C.bgDeep, color: '#fff', fontSize: 13, fontWeight: 700,
      }}>
        <TrialDayProgress currentDay={currentDay} variant="compact" />
        <span>⏱ {remaining}</span>
        {minimumRequired > 0 && (
          <span style={{ color: passed ? '#7ee0b0' : 'inherit' }}>
            {appliedThisWindow} of {minimumRequired} applications
          </span>
        )}
      </div>
      {/* One stack so the two toasts never land on top of each other when
          both are true at once (crossing the minimum inside the first 7
          seconds of a window triggers exactly that). */}
      <div style={{
        position: 'fixed', top: 44, left: '50%', transform: 'translateX(-50%)', zIndex: 4001,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}>
        <AnimatePresence>
          {justUnlocked && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                background: C.success, color: '#fff', padding: '8px 16px', borderRadius: 999,
                fontSize: 13, fontWeight: 700,
              }}
            >
              LinkedIn tools unlocked 🎉
            </motion.div>
          )}
        </AnimatePresence>
        <SkimTip />
      </div>
    </>
  );
}
