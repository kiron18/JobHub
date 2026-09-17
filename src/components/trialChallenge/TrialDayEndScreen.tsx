import { useState } from 'react';
import { warm } from '../../lib/theme/warmTokens';
import { UpgradeModal } from '../UpgradeModal';
import { TrialDayProgress } from './TrialDayProgress';

const C = warm.colors;

type Variant = 'day_failed' | 'forfeited' | 'completed';

interface Props {
  variant: Variant;
  currentDay: number;
  appliedThisWindow: number;
  minimumRequired: number;
  resetUsed: boolean;
  onReset: () => void;
  resetting: boolean;
}

/**
 * No pass/fail framing here on purpose (Mechanics.txt's call). Missing a
 * window is never "you failed", it's honest partial progress plus, the first
 * time, a free restart from Day 1. Only once that restart is spent (or the
 * trial is genuinely finished) does this become the volume-pitch + paywall
 * screen.
 */
export function TrialDayEndScreen({ variant, currentDay, appliedThisWindow, minimumRequired, resetUsed, onReset, resetting }: Props) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const missedWindow = variant === 'day_failed' || variant === 'forfeited';
  const offerReset = missedWindow && !resetUsed;

  if (offerReset) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: C.bgCanvas, overflowY: 'auto', display: 'flex', padding: '48px 24px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 480, margin: 'auto', textAlign: 'center' }}>
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
            <TrialDayProgress currentDay={currentDay} />
          </div>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMuted, margin: '0 0 8px' }}>
            Day {currentDay} progress
          </p>
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 28px)', fontWeight: 800, color: C.textPrimary, margin: '0 0 16px' }}>
            {variant === 'forfeited'
              ? "Time got away from you. Let's run it back"
              : `You got ${appliedThisWindow} of ${minimumRequired} out. Let's run it back`}
          </h1>

          <div style={{ background: C.bgSurface, border: `1px solid ${C.borderDefined}`, borderRadius: 14, padding: 20, textAlign: 'left', marginBottom: 24 }}>
            <p style={{ margin: '0 0 8px', fontSize: 14.5, fontWeight: 700, color: C.textPrimary }}>
              This isn't a test. It's a habit.
            </p>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: C.textSecondary }}>
              Everything's already written for you, so a couple of applications in under an hour is genuinely
              easy once you're in the flow. You've got one free restart from Day 1, whenever you're ready to go again.
            </p>
          </div>

          <button
            onClick={onReset}
            disabled={resetting}
            style={{
              width: '100%', padding: '15px 24px', borderRadius: 12, border: 'none',
              background: C.accentPetrol, color: '#fff', fontSize: 16, fontWeight: 700,
              cursor: resetting ? 'default' : 'pointer', opacity: resetting ? 0.7 : 1,
            }}
          >
            {resetting ? '...' : 'Restart from Day 1'}
          </button>
        </div>
      </div>
    );
  }

  const eyebrow = variant === 'completed' ? 'Trial complete' : 'That was your restart';
  const title = "That's the trial";

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: C.bgCanvas, overflowY: 'auto', display: 'flex', padding: '48px 24px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 480, margin: 'auto', textAlign: 'center' }}>
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
            <TrialDayProgress currentDay={currentDay} />
          </div>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMuted, margin: '0 0 8px' }}>{eyebrow}</p>
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 28px)', fontWeight: 800, color: C.textPrimary, margin: '0 0 16px' }}>{title}</h1>

          {missedWindow && (
            <p style={{ fontSize: 15, color: C.textSecondary, marginBottom: 20 }}>
              You sent {appliedThisWindow} of {minimumRequired} applications this round.
            </p>
          )}

          <div style={{ background: C.bgSurface, border: `1px solid ${C.borderDefined}`, borderRadius: 14, padding: 20, textAlign: 'left', marginBottom: 24 }}>
            <p style={{ margin: '0 0 8px', fontSize: 14.5, fontWeight: 700, color: C.textPrimary }}>
              It's roughly 100 applications per interview, and 4-5 interviews per offer.
            </p>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: C.textSecondary }}>
              You don't have to think about this part, you just have to execute. It doesn't matter if you're tired,
              or not in the mood: one hour a day, every day, is the whole system.
            </p>
          </div>

          <button
            onClick={() => setShowUpgrade(true)}
            style={{ width: '100%', padding: '15px 24px', borderRadius: 12, border: 'none', background: C.accentPetrol, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
          >
            See how to keep going
          </button>
        </div>
      </div>
      {showUpgrade && <UpgradeModal trigger="trial_challenge" onClose={() => setShowUpgrade(false)} />}
    </>
  );
}
