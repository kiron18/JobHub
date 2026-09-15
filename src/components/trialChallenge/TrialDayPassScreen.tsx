import { useState } from 'react';
import { warm } from '../../lib/theme/warmTokens';
import { useTrialWhatsappOptIn } from '../../lib/trialChallenge';
import { ruleForDay } from '../../lib/trialChallengeRules';
import { Step } from './TrialDayIntro';

const C = warm.colors;

interface Props {
  passedDay: number;
  forfeitureDeadline: string;
  onBegin: () => void;
  beginning: boolean;
}

/** Shown for day_passed_waiting — the "you passed, here's tomorrow" screen for days 1 and 2. */
export function TrialDayPassScreen({ passedDay, forfeitureDeadline, onBegin, beginning }: Props) {
  const nextDay = passedDay + 1;
  const rule = ruleForDay(nextDay);
  const [whatsappSubmitted, setWhatsappSubmitted] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [hour, setHour] = useState('9');
  const optIn = useTrialWhatsappOptIn();

  const deadlineStr = new Date(forfeitureDeadline).toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney', dateStyle: 'full', timeStyle: 'short',
  });

  const submitWhatsapp = () => {
    optIn.mutate(
      { whatsappNumber: whatsapp || undefined, reminderTimePreferenceHour: Number(hour) },
      { onSettled: () => setWhatsappSubmitted(true) },
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: C.bgCanvas, overflowY: 'auto', display: 'flex', padding: '48px 24px', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 480, margin: 'auto', textAlign: 'center' }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.success, margin: '0 0 8px' }}>
          Day {passedDay} passed
        </p>
        <h1 style={{ fontSize: 'clamp(24px, 4vw, 28px)', fontWeight: 800, color: C.textPrimary, margin: '0 0 16px' }}>
          Day {nextDay} is unlocked
        </h1>

        <div style={{ background: 'rgba(200,60,40,0.08)', border: '1px solid rgba(200,60,40,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, textAlign: 'left' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.textPrimary }}>Come back before {deadlineStr} (AEST)</p>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: C.textSecondary }}>Miss it and the rest of the trial is gone for good.</p>
        </div>

        {passedDay === 1 && !whatsappSubmitted && (
          <div style={{ background: C.bgSurface, border: `1px solid ${C.borderDefined}`, borderRadius: 14, padding: 18, textAlign: 'left', marginBottom: 20 }}>
            <p style={{ margin: '0 0 10px', fontSize: 13.5, fontWeight: 700, color: C.textPrimary }}>Want a reminder so you don't forget?</p>
            <input
              type="tel" placeholder="WhatsApp number, e.g. +61412345678" value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.borderDefined}`, fontSize: 14, marginBottom: 8, boxSizing: 'border-box' }}
            />
            <select
              value={hour} onChange={e => setHour(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.borderDefined}`, fontSize: 14, marginBottom: 12 }}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{h.toString().padStart(2, '0')}:00 AEST</option>
              ))}
            </select>
            <button
              onClick={submitWhatsapp} disabled={optIn.isPending || !whatsapp}
              style={{ width: '100%', padding: 11, borderRadius: 10, border: 'none', background: C.accentPetrol, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: !whatsapp ? 0.6 : 1 }}
            >
              {optIn.isPending ? '...' : 'Send me a reminder'}
            </button>
            <button
              onClick={() => setWhatsappSubmitted(true)}
              style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 10, border: 'none', background: 'transparent', color: C.textMuted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
            >
              No thanks
            </button>
          </div>
        )}

        {rule && (
          <div style={{ background: C.bgSurface, border: `1px solid ${C.borderDefined}`, borderRadius: 16, padding: 22, textAlign: 'left', marginBottom: 24 }}>
            <p style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textMuted, margin: '0 0 14px' }}>
              Day {nextDay}
            </p>
            <Step n={1} text={`${rule.windowMinutes} minutes, whenever you're ready.`} />
            {rule.minimum > 0
              ? <Step n={2} text={`Apply to ${rule.minimum} jobs to keep going.`} last />
              : <Step n={2} text="No target today — use the time however you like." last />}
          </div>
        )}

        <button
          onClick={onBegin}
          disabled={beginning}
          style={{
            width: '100%', padding: '15px 24px', borderRadius: 12, border: 'none',
            background: C.accentPetrol, color: '#fff', fontSize: 16, fontWeight: 700,
            cursor: beginning ? 'default' : 'pointer', opacity: beginning ? 0.7 : 1,
          }}
        >
          {beginning ? '...' : `Begin Day ${nextDay}`}
        </button>
      </div>
    </div>
  );
}
