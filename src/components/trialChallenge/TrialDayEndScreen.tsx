import { useState } from 'react';
import { warm } from '../../lib/theme/warmTokens';
import { UpgradeModal } from '../UpgradeModal';

const C = warm.colors;

type Variant = 'day_failed' | 'forfeited' | 'completed';

interface Props {
  variant: Variant;
  currentDay: number;
  appliedThisWindow: number;
  minimumRequired: number;
}

/** day_failed, forfeited, and completed all end the same way: stats/context, the volume pitch, then the paywall. */
export function TrialDayEndScreen({ variant, currentDay, appliedThisWindow, minimumRequired }: Props) {
  const [showUpgrade, setShowUpgrade] = useState(false);

  const eyebrow = variant === 'day_failed' ? `Day ${currentDay} results`
    : variant === 'forfeited' ? 'Time ran out'
    : 'Trial complete';
  const title = variant === 'day_failed' ? "You didn't hit today's target"
    : variant === 'forfeited' ? 'This trial has ended'
    : "That's the trial";

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: C.bgCanvas, overflowY: 'auto', display: 'flex', padding: '48px 24px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 480, margin: 'auto', textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMuted, margin: '0 0 8px' }}>{eyebrow}</p>
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 28px)', fontWeight: 800, color: C.textPrimary, margin: '0 0 16px' }}>{title}</h1>

          {variant === 'day_failed' && (
            <p style={{ fontSize: 15, color: C.textSecondary, marginBottom: 20 }}>
              You sent {appliedThisWindow} of {minimumRequired} applications in the window.
            </p>
          )}

          <div style={{ background: C.bgSurface, border: `1px solid ${C.borderDefined}`, borderRadius: 14, padding: 20, textAlign: 'left', marginBottom: 24 }}>
            <p style={{ margin: '0 0 8px', fontSize: 14.5, fontWeight: 700, color: C.textPrimary }}>
              It's roughly 100 applications per interview, and 4-5 interviews per offer.
            </p>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: C.textSecondary }}>
              You don't have to think about this part, you just have to execute. It doesn't matter if you're tired,
              or not in the mood — one hour a day, every day, is the whole system.
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
