import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
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
  /** wa.me link pre-filled with "START <code>" — one tap opens WhatsApp ready to send. */
  whatsappOptInLink?: string;
}

/** Shown for day_passed_waiting — the "you passed, here's tomorrow" screen for days 1 and 2. */
export function TrialDayPassScreen({ passedDay, forfeitureDeadline, onBegin, beginning, whatsappOptInLink }: Props) {
  const nextDay = passedDay + 1;
  const rule = ruleForDay(nextDay);
  const [whatsappDismissed, setWhatsappDismissed] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [hour, setHour] = useState('9');
  const [hourSaved, setHourSaved] = useState(false);
  const optIn = useTrialWhatsappOptIn();

  const deadlineStr = new Date(forfeitureDeadline).toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney', dateStyle: 'full', timeStyle: 'short',
  });

  // Generated client-side from the same link the tap button uses, so there's
  // nothing to type either way — tap on the phone you're already on, or
  // scan with your phone if you're looking at this on a desktop screen.
  useEffect(() => {
    if (!whatsappOptInLink) return;
    QRCode.toDataURL(whatsappOptInLink, { width: 180, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [whatsappOptInLink]);

  const saveHour = () => {
    optIn.mutate({ reminderTimePreferenceHour: Number(hour) }, { onSettled: () => setHourSaved(true) });
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

        {passedDay === 1 && !whatsappDismissed && whatsappOptInLink && (
          <div style={{ background: C.bgSurface, border: `1px solid ${C.borderDefined}`, borderRadius: 14, padding: 18, textAlign: 'left', marginBottom: 20 }}>
            <p style={{ margin: '0 0 6px', fontSize: 13.5, fontWeight: 700, color: C.textPrimary }}>
              Want a reminder so you don't forget? <span style={{ color: C.textMuted, fontWeight: 600 }}>(Beta)</span>
            </p>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
              One tap opens WhatsApp with everything already filled in — just hit send.
              Reminders only start once you do, so this can never turn into spam.
            </p>

            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
              {qrDataUrl && (
                <img
                  src={qrDataUrl} alt="Scan to open WhatsApp with your reminder message ready to send"
                  style={{ width: 88, height: 88, borderRadius: 8, border: `1px solid ${C.borderWhisper}`, flexShrink: 0 }}
                />
              )}
              <p style={{ margin: 0, fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>
                On this phone? Use the button below.<br />On a computer? Scan this with your phone's camera.
              </p>
            </div>

            <a
              href={whatsappOptInLink} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'block', textAlign: 'center', width: '100%', padding: 11, borderRadius: 10,
                background: C.accentPetrol, color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                marginBottom: 8,
              }}
            >
              Open WhatsApp — everything's filled in
            </a>

            {!showHourPicker && !hourSaved && (
              <button
                onClick={() => setShowHourPicker(true)}
                style={{ width: '100%', padding: 6, background: 'transparent', border: 'none', color: C.textMuted, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Prefer a specific time of day for reminders?
              </button>
            )}
            {showHourPicker && !hourSaved && (
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <select
                  value={hour} onChange={e => setHour(e.target.value)}
                  style={{ flex: 1, padding: '9px 10px', borderRadius: 8, border: `1px solid ${C.borderDefined}`, fontSize: 13 }}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{h.toString().padStart(2, '0')}:00 AEST</option>
                  ))}
                </select>
                <button
                  onClick={saveHour} disabled={optIn.isPending}
                  style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: C.accentPetrol, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  {optIn.isPending ? '...' : 'Save'}
                </button>
              </div>
            )}
            {hourSaved && (
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: C.success, textAlign: 'center' }}>Saved.</p>
            )}

            <button
              onClick={() => setWhatsappDismissed(true)}
              style={{ width: '100%', marginTop: 10, padding: 6, borderRadius: 10, border: 'none', background: 'transparent', color: C.textMuted, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}
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
