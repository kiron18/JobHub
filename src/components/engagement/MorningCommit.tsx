import { useState } from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus, Flame, Loader2 } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { prefersReducedMotion } from '../../lib/theme/motion';

/* ── MorningCommit ─────────────────────────────────────────────────────
   The first thing on the dashboard each day, and it blocks the dashboard
   until it is answered (Kiron, 2026-09-29). Nothing else on the page is
   worth doing before the day has a number.

   It replaces the first-time commit explainer dialog: the three facts that
   dialog carried (the number is fixed for the day, one undo, and the way
   out when there are no good roles) are said here, every morning, in a
   line each.

   Shown by EngagementStrip whenever today's number is not locked, which
   also covers the morning after an undo: the day goes back to needing a
   number, so this comes back.
*/

export interface MorningCommitProps {
  min: number;
  max: number;
  /** Where the stepper starts: yesterday's habit, or the floor. */
  initial: number;
  /** Already sent today; the number can never go below it. */
  filedToday: number;
  streak: number;
  programDay: number;
  programLength: number;
  busy: boolean;
  onCommit: (n: number) => void;
}

export function MorningCommit({ min, max, initial, filedToday, streak, programDay, programLength, busy, onCommit }: MorningCommitProps) {
  const reduced = prefersReducedMotion();
  const floor = Math.max(min, filedToday);
  const [n, setN] = useState(() => Math.min(max, Math.max(floor, initial)));

  const step = (d: number) => setN(v => Math.min(max, Math.max(floor, v + d)));
  const stepBtn = (disabled: boolean): React.CSSProperties => ({
    width: 52, height: 52, borderRadius: 16, cursor: disabled ? 'default' : 'pointer',
    border: `1.5px solid ${warm.colors.borderDefined}`, background: '#fff',
    color: disabled ? warm.colors.borderDefined : warm.colors.accentPetrol,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Today's commitment"
      style={{
        position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(15,32,56,0.55)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto',
      }}
    >
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28 }}
        style={{
          width: '100%', maxWidth: 480, background: '#fff', borderRadius: 22, padding: '32px 28px 26px',
          boxShadow: warm.shadow.lifted, fontFamily: warm.type.fontBody, textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: warm.colors.accentPetrol }}>
          Day {programDay} of {programLength}
        </p>
        <h1 style={{
          margin: '10px 0 6px', fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500,
          fontSize: 34, lineHeight: 1.15, color: warm.colors.textPrimary,
        }}>
          What's today's number?
        </h1>
        {streak > 0 ? (
          <p style={{ margin: '0 0 22px', fontSize: 16, color: '#C4713A', fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
            <Flame size={17} /> {streak}-day streak. Keep it going.
          </p>
        ) : (
          <p style={{ margin: '0 0 22px', fontSize: 16, color: warm.colors.textSecondary }}>
            Commit to it now, before the day gets loud.
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 19, fontWeight: 600, color: warm.colors.textPrimary }}>I'll apply to</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button aria-label="One fewer" onClick={() => step(-1)} disabled={n <= floor} style={stepBtn(n <= floor)}>
              <Minus size={22} strokeWidth={2.6} />
            </button>
            <span style={{ fontSize: 44, fontWeight: 800, minWidth: 48, color: warm.colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
            <button aria-label="One more" onClick={() => step(1)} disabled={n >= max} style={stepBtn(n >= max)}>
              <Plus size={22} strokeWidth={2.6} />
            </button>
          </div>
          <span style={{ fontSize: 19, fontWeight: 600, color: warm.colors.textPrimary }}>roles today</span>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 14.5, color: warm.colors.textMuted }}>
          Between {floor} and {max}.
        </p>

        <ul style={{
          textAlign: 'left', margin: '22px 0 0', padding: '16px 18px 16px 34px', listStyle: 'disc outside',
          background: warm.colors.bgAlt, borderRadius: 14, display: 'grid', gap: 8,
          fontSize: 15, lineHeight: 1.5, color: warm.colors.textSecondary,
        }}>
          <li>Once you commit, today's number is fixed. Doing more raises it on its own.</li>
          <li>Bad day or a slip of the finger: you get one undo per day.</li>
          <li>Run out of good roles? You can switch the rest to outreach, two messages for each application.</li>
        </ul>

        <button
          onClick={() => onCommit(n)}
          disabled={busy}
          style={{
            marginTop: 22, width: '100%', padding: '16px 20px', borderRadius: 14, border: 'none',
            background: warm.colors.accentPetrol, color: '#fff', cursor: busy ? 'default' : 'pointer',
            fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: busy ? 0.8 : 1,
          }}
        >
          {busy && <Loader2 size={18} className="animate-spin" />}
          Commit to {n} today
        </button>
      </motion.div>
    </div>
  );
}
