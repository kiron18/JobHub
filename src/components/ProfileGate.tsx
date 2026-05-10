import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

interface Props {
  children: React.ReactNode;
}

export const ProfileGate: React.FC<Props> = ({ children }) => {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => { const { data } = await api.get('/profile'); return data; },
    staleTime: 60_000,
  });

  const isReady = profile?.completion?.isReady ?? true;
  const score = profile?.completion?.score ?? 0;
  const pointsAway = Math.max(0, 70 - score);

  // Don't flash the gate while profile loads
  if (isLoading || !profile) return <>{children}</>;
  if (isReady) return <>{children}</>;

  return (
    <div style={{ position: 'relative', minHeight: '100%' }}>
      {/* Content behind gate — rendered so it looks real through the blur */}
      <div style={{ pointerEvents: 'none', userSelect: 'none', filter: 'blur(4px)', opacity: 0.4 }}>
        {children}
      </div>

      {/* Overlay */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(9,11,17,0.7)',
        backdropFilter: 'blur(2px)',
      }}>
        <div style={{
          background: '#0d1117',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: '36px 40px',
          maxWidth: 440,
          width: '100%',
          textAlign: 'center',
        }}>
          {/* Score ring */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={72} height={72} style={{ transform: 'rotate(-90deg)' }}>
                <circle stroke="rgba(255,255,255,0.08)" fill="transparent" strokeWidth={7} r={29} cx={36} cy={36} />
                <circle
                  stroke="#d97706"
                  fill="transparent"
                  strokeWidth={7}
                  strokeDasharray={`${29 * 2 * Math.PI} ${29 * 2 * Math.PI}`}
                  style={{ strokeDashoffset: 29 * 2 * Math.PI - (score / 100) * 29 * 2 * Math.PI, transition: 'stroke-dashoffset 1s ease' }}
                  strokeLinecap="round"
                  r={29} cx={36} cy={36}
                />
              </svg>
              <span style={{ position: 'absolute', fontSize: 16, fontWeight: 800, color: '#d97706', fontVariantNumeric: 'tabular-nums' }}>
                {score}
              </span>
            </div>
          </div>

          <h3 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 900, color: '#f3f4f6', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Your profile isn't ready yet.
          </h3>
          <p style={{ margin: '0 0 6px', fontSize: 14, color: '#9ca3af', lineHeight: 1.65 }}>
            Documents generated from an incomplete profile won't reflect your real ability — and they won't get you interviews.
          </p>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
            {pointsAway > 0
              ? `You're ${pointsAway} point${pointsAway !== 1 ? 's' : ''} away from unlocking everything. It takes about 10 minutes.`
              : 'Complete your profile to unlock the full platform.'}
          </p>

          <button
            onClick={() => navigate('/workspace')}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 12,
              background: '#6366f1',
              border: 'none',
              color: '#fff',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            Complete my profile →
          </button>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#4b5563' }}>
            Your profile is the engine. Everything else runs on it.
          </p>
        </div>
      </div>
    </div>
  );
};
