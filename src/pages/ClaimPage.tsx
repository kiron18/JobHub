/* ────────────────────────────────────────────────────────────────────────────
   ClaimPage — /claim

   The link dropped in the Meet chat partway through the workshop, and the only
   attendance signal in the whole funnel. Nothing else tells us who actually
   turned up: registration proves intent, and the Skool join proves curiosity,
   but only a click on a link that was never posted anywhere else proves someone
   was in the room.

   So it is deliberately the shortest page in the product. One field, already
   answered by anyone who registered, and no explanation of what the report is:
   they were just told, out loud, thirty minutes ago.
   ──────────────────────────────────────────────────────────────────────────── */
import { useState } from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { colors, type as typeTokens, spacing } from '../components/landing/tokens';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

type Stage = 'ask' | 'done';

export default function ClaimPage() {
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState<Stage>('ask');
  const [hasResume, setHasResume] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('That email address does not look right.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/session-signup/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // A typo is recoverable while they are still in the room, so the real
        // reason is shown rather than a generic failure.
        setError(data?.error || 'Something went wrong. Try again in a moment.');
        return;
      }

      setHasResume(data?.hasResume !== false);
      setStage('done');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const page: React.CSSProperties = {
    height: '100vh', overflowY: 'auto',
    background: colors.bgCanvas,
    fontFamily: typeTokens.body,
    padding: '72px 20px 96px',
    boxSizing: 'border-box',
  };
  const shell: React.CSSProperties = { maxWidth: spacing.containerHero, margin: '0 auto' };

  if (stage === 'done') {
    return (
      <div style={page}>
        <div style={{ ...shell, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: colors.success,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          }}>
            <Check size={28} color="#fff" strokeWidth={2.5} />
          </div>
          <h1 style={{
            fontFamily: typeTokens.display, fontWeight: 500, fontSize: '2rem',
            color: colors.textPrimary, letterSpacing: '-0.015em', margin: '0 0 14px',
          }}>
            Claimed.
          </h1>

          {hasResume ? (
            <p style={{ fontSize: '1.0625rem', color: colors.textSecondary, lineHeight: 1.6, margin: 0 }}>
              Your diagnostic is being built from the resume you sent me. It lands in
              your inbox within the hour, and it opens with one of your own lines
              rewritten. Stay in the room, there is more to cover.
            </p>
          ) : (
            // The one case where the promise cannot be kept, said now rather than
            // discovered by them an hour from now when nothing arrives.
            <p style={{
              fontSize: '1.0625rem', color: colors.textPrimary, lineHeight: 1.6, margin: 0,
              background: 'rgba(197,160,89,0.12)', padding: '16px 18px', borderRadius: 12, textAlign: 'left',
            }}>
              You are marked as here. One thing though: I do not have a resume from
              you, and the diagnostic is built entirely from it. Send yours to
              kiron@aussiegradcareers.com.au and I will run it tonight.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={shell}>
        <p style={{
          fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: colors.textMuted, margin: 0,
        }}>
          Workshop attendees
        </p>
        <h1 style={{
          fontFamily: typeTokens.display, fontWeight: 500, fontSize: 'clamp(1.75rem, 6vw, 2.25rem)',
          color: colors.textPrimary, letterSpacing: '-0.015em', margin: '10px 0 14px',
        }}>
          Claim your resume diagnostic.
        </h1>
        <p style={{ fontSize: '1.0625rem', color: colors.textSecondary, lineHeight: 1.6, margin: '0 0 28px' }}>
          The email you registered with. That is all I need to match you to the
          resume you sent.
        </p>

        <input
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
          placeholder="you@email.com"
          type="email"
          autoComplete="email"
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            fontFamily: typeTokens.body, fontSize: '1.0625rem',
            padding: '15px 16px', borderRadius: 10,
            border: `1.5px solid ${error ? '#B4432F' : colors.borderDefined}`,
            background: colors.bgSurface, color: colors.textPrimary,
            marginBottom: 14,
          }}
        />

        {error && (
          <p style={{
            display: 'flex', gap: 9, alignItems: 'flex-start',
            fontSize: '0.9375rem', color: '#B4432F', background: 'rgba(180,67,47,0.07)',
            padding: '12px 14px', borderRadius: 10, margin: '0 0 14px', lineHeight: 1.5,
          }}>
            <AlertCircle size={17} style={{ flex: '0 0 auto', marginTop: 2 }} />
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          style={{
            width: '100%', background: colors.accentPetrol, color: colors.textOnDeep,
            padding: '16px 32px', borderRadius: 10, border: 'none',
            fontWeight: 600, fontSize: '1.0625rem', fontFamily: typeTokens.body,
            cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            boxShadow: '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)',
          }}
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          {submitting ? 'Checking…' : 'Claim my diagnostic'}
        </button>
      </div>
    </div>
  );
}
