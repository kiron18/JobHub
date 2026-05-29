import React, { useState } from 'react';
import { toast } from 'sonner';
import { colors, type } from '../landing/tokens';
import api from '../../lib/api';
import { trackSponsorEmailCaptured, trackSponsorLinksUnlocked } from '../../lib/analytics';

interface Props {
  onClose: () => void;
  onUnlock: (unlockedResults: any[]) => void;
}

export function SponsorEmailModal({ onClose, onUnlock }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/sponsors/unlock', { email });
      if (data.success) {
        setSuccess(true);
        trackSponsorEmailCaptured();
        trackSponsorLinksUnlocked();
        toast.success("Unlocked. Every sponsor's links are live now — happy hunting.");
        // Brief pause so user sees confirmation, then close + unlock
        setTimeout(() => {
          onUnlock(data.unlockedResults);
          onClose();
        }, 800);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(26, 24, 20, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: colors.bgSurface,
        borderRadius: 16,
        padding: '40px 36px',
        maxWidth: 420,
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        textAlign: 'center',
      }}>
        {success ? (
          <>
            <h3 style={{ fontFamily: type.display, color: colors.success, margin: '0 0 8px' }}>
              ✓ Unlocked
            </h3>
            <p style={{ color: colors.textSecondary, fontSize: 14, margin: 0, lineHeight: 1.5 }}>
              Every sponsor's links are live now — happy hunting.
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3 style={{
              fontFamily: type.display,
              fontSize: 22,
              color: colors.textPrimary,
              margin: '0 0 6px',
            }}>
              See the full list — free.
            </h3>
            <p style={{
              color: colors.textSecondary,
              fontSize: 14,
              margin: '0 0 24px',
              lineHeight: 1.5,
            }}>
              Drop your email and every sponsor's contact links unlock instantly. No trial, no card — just the directory.
            </p>

            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 10,
                border: `1.5px solid ${error ? '#dc2626' : colors.borderDefined}`,
                fontSize: 15,
                fontFamily: type.body,
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: error ? 6 : 16,
              }}
            />
            {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '0 0 12px', textAlign: 'left' }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 10,
                border: 'none',
                background: colors.accentPetrol,
                color: colors.textOnDeep,
                fontSize: 15,
                fontWeight: 700,
                fontFamily: type.body,
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Unlocking...' : 'Unlock all 4,058 sponsors →'}
            </button>

            <p style={{
              color: colors.textMuted,
              fontSize: 12,
              margin: '16px 0 0',
              lineHeight: 1.4,
            }}>
              One email. No spam. We'll only reach out if there's something genuinely useful for your job hunt.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
