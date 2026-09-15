import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { motion } from 'framer-motion';
import { warm } from '../../lib/theme/warmTokens';

const C = warm.colors;

interface Props {
  windowMinutes: number;
  minimum: number;
  onBegin: () => void;
  beginning: boolean;
}

/** Day 1 only — the one-time "you've unlocked a free trial" moment, with the lottie. */
export function TrialDayIntro({ windowMinutes, minimum, onBegin, beginning }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 5000, background: C.bgCanvas,
      overflowY: 'auto', display: 'flex', padding: '48px 24px', boxSizing: 'border-box',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={{ width: '100%', maxWidth: 480, margin: 'auto', textAlign: 'center' }}
      >
        <div style={{ width: 200, height: 200, margin: '0 auto -8px' }}>
          <DotLottieReact src="/Assets/trial-challenge/rocket.lottie" loop autoplay />
        </div>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.accentPetrol, margin: '0 0 8px' }}>
          You've unlocked your free trial
        </p>
        <h1 style={{ fontSize: 'clamp(24px, 4vw, 30px)', fontWeight: 800, color: C.textPrimary, margin: '0 0 20px', letterSpacing: '-0.02em' }}>
          Congrats!
        </h1>

        <div style={{
          background: C.bgSurface, border: `1px solid ${C.borderDefined}`, borderRadius: 16,
          padding: 22, textAlign: 'left', marginBottom: 24,
        }}>
          <p style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textMuted, margin: '0 0 14px' }}>
            Here's how to make the most of it
          </p>
          <Step n={1} text={`Make sure you have ${windowMinutes} minutes uninterrupted.`} />
          <Step n={2} text={`Apply to ${minimum} job${minimum === 1 ? '' : 's'} within ${windowMinutes} minutes.`} />
          <Step n={3} text="Your time starts when you press the button below." last />
        </div>

        <button
          onClick={onBegin}
          disabled={beginning}
          style={{
            width: '100%', padding: '15px 24px', borderRadius: 12, border: 'none',
            background: C.accentPetrol, color: '#fff', fontSize: 16, fontWeight: 700,
            cursor: beginning ? 'default' : 'pointer', opacity: beginning ? 0.7 : 1,
          }}
        >
          {beginning ? '...' : 'Begin'}
        </button>
      </motion.div>
    </div>
  );
}

export function Step({ n, text, last }: { n: number; text: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: last ? 0 : 10 }}>
      <span style={{
        flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: C.accentPetrol, color: '#fff',
        fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{n}</span>
      <span style={{ fontSize: 14.5, lineHeight: 1.5, color: C.textPrimary }}>{text}</span>
    </div>
  );
}
