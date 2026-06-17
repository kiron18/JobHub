import React from 'react';
import { Loader2, AlertCircle, Briefcase } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';

export type FeedReadiness = 'partial' | 'complete' | 'error' | 'building' | 'incomplete-profile';

interface FeedStateNoticeProps {
  state: FeedReadiness;
  total?: number;
  targetRole?: string;
  targetCity?: string;
  onRefresh?: () => void;
  onGoToProfile?: () => void;
}

const gc: React.CSSProperties = {
  background: warm.colors.bgSurface,
  borderRadius: 18,
  border: `1px solid ${warm.colors.borderWhisper}`,
  overflow: 'hidden',
};

export const FeedStateNotice: React.FC<FeedStateNoticeProps> = ({
  state,
  total = 0,
  targetRole,
  targetCity,
  onRefresh,
  onGoToProfile,
}) => {
  // Partial: some jobs cached but fewer than 3 roles worth
  if (state === 'partial') {
    return (
      <div style={{ ...gc, padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: `${warm.colors.accentPetrol}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Loader2 size={20} style={{ color: warm.colors.accentPetrol, animation: 'spin 1s linear infinite' }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: warm.colors.textPrimary }}>
            Building your complete feed
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: warm.colors.textSecondary }}>
            {total} roles ready · searching more sources for {targetRole} in {targetCity}
          </p>
        </div>
        <button
          onClick={onRefresh}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 700,
            border: `1px solid ${warm.colors.borderWhisper}`,
            color: warm.colors.textSecondary,
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>
    );
  }

  // Complete: all 3 target roles have cached data
  if (state === 'complete') {
    return (
      <div style={{ ...gc, padding: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: `${warm.colors.accentGreen}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={warm.colors.accentGreen} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: warm.colors.textPrimary }}>
            Feed ready · {total} roles cached
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: warm.colors.textMuted }}>
            Auto-refreshes daily
          </p>
        </div>
      </div>
    );
  }

  // Error: feed generation failed
  if (state === 'error') {
    return (
      <div style={{ ...gc, padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: `${warm.colors.danger}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AlertCircle size={20} style={{ color: warm.colors.danger }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: warm.colors.textPrimary }}>
            Feed temporarily unavailable
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: warm.colors.textSecondary }}>
            Could not fetch fresh listings. Using cached results.
          </p>
        </div>
        <button
          onClick={onRefresh}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 700,
            border: `1px solid ${warm.colors.danger}30`,
            color: warm.colors.danger,
            background: `${warm.colors.danger}10`,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Building: initial scrape in progress - MINIMAL text-only, box sized to content
  if (state === 'building') {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: warm.colors.textSecondary }}>
          Your jobs are loading
        </span>
        <span style={{ fontSize: 13, color: warm.colors.textSecondary, animation: 'pulse 1.5s ease-in-out infinite' }}>
          ...
        </span>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  // Incomplete profile: missing location or role
  if (state === 'incomplete-profile') {
    return (
      <div style={{ ...gc, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <AlertCircle size={32} style={{ color: warm.colors.accentGold }} />
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: warm.colors.textPrimary }}>
            Location required
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: warm.colors.textSecondary }}>
            Add your city to the Location field in Profile &amp; Achievements to enable your job feed.
          </p>
          <button
            onClick={onGoToProfile}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 12,
              background: `${warm.colors.accentPetrol}20`,
              border: `1px solid ${warm.colors.accentPetrol}30`,
              color: warm.colors.accentPetrol,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Go to Profile &amp; Achievements →
          </button>
        </div>
      </div>
    );
  }

  // Empty: no jobs found after search
  return (
    <div style={{ ...gc, padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
      <Briefcase size={36} style={{ color: warm.colors.textMuted }} />
      <div>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: warm.colors.textSecondary }}>
          No listings found today
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: warm.colors.textMuted }}>
          We searched for {targetRole} roles in {targetCity} but found nothing today. Try broadening your target role or check back tomorrow.
        </p>
      </div>
      <button
        onClick={onRefresh}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 700,
          border: `1px solid ${warm.colors.borderWhisper}`,
          color: warm.colors.textSecondary,
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        Search again
      </button>
    </div>
  );
};
