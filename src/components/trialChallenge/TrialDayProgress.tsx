import { warm } from '../../lib/theme/warmTokens';
import { LAST_DAY } from '../../lib/trialChallengeRules';

const C = warm.colors;

interface Props {
  currentDay: number;
  /** 'full' for the big screens (intro/pass/end); 'compact' for the countdown bar. */
  variant?: 'full' | 'compact';
}

/**
 * The visual "Day X of 3" indicator Mechanics.txt asked for, replacing a line
 * of text with three segments a glance can read, since a countdown number
 * alone doesn't communicate "you're partway through a 3-part thing" the way a
 * filled-in progress track does.
 */
export function TrialDayProgress({ currentDay, variant = 'full' }: Props) {
  const compact = variant === 'compact';
  const segments = Array.from({ length: LAST_DAY }, (_, i) => i + 1);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 12 }}>
      <span style={{
        fontSize: compact ? 12 : 13, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: compact ? '#fff' : C.textMuted, whiteSpace: 'nowrap',
      }}>
        Day {currentDay} of {LAST_DAY}
      </span>
      <div style={{ display: 'flex', gap: compact ? 4 : 6, flex: compact ? '0 0 auto' : 1 }}>
        {segments.map((day) => {
          const done = day < currentDay;
          const active = day === currentDay;
          return (
            <div
              key={day}
              style={{
                flex: compact ? '0 0 20px' : 1,
                height: compact ? 5 : 8,
                borderRadius: 999,
                background: done || active
                  ? (compact ? '#fff' : C.accentPetrol)
                  : (compact ? 'rgba(255,255,255,0.25)' : C.borderDefined),
                opacity: active && !compact ? 1 : (done ? (compact ? 1 : 0.85) : (compact ? 1 : 0.5)),
                transition: 'background 0.3s ease',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
