import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { HeadshotGenerator } from './HeadshotGenerator';
import { BannerCanvas } from './BannerCanvas';
import type { BannerConfig } from './types';

interface Props {
  name: string;
  location?: string;
  headshotUrl?: string | null;
  targetRole: string;
  onTargetRoleChange: (v: string) => void;
  bannerConfig: BannerConfig;
  onBannerConfigChange: (c: BannerConfig) => void;
  onHeadshotSaved: (url: string) => void;
  generating: boolean;
  onGenerate: () => Promise<void>;
}

export const LinkedInOnboardingModal: React.FC<Props> = ({
  name,
  headshotUrl,
  targetRole,
  onTargetRoleChange,
  bannerConfig,
  onBannerConfigChange,
  onHeadshotSaved,
  generating,
  onGenerate,
}) => {
  // Prevent ESC from triggering any browser/dialog close behaviour.
  useEffect(() => {
    const block = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', block, true);
    return () => document.removeEventListener('keydown', block, true);
  }, []);

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-label="LinkedIn profile setup"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(26, 24, 20, 0.72)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        overflowY: 'auto',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px 60px',
      }}
      // No onClick on backdrop — modal is unskippable.
    >
      {/* Card — clicks inside do not bubble to the backdrop */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 620,
          background: warm.colors.bgSurface,
          borderRadius: warm.radius.card,
          boxShadow: warm.shadow.lifted,
          overflow: 'hidden',
        }}
      >
        {/* ── Header / context block ── */}
        <div
          style={{
            background: '#0A66C2',
            padding: '28px 32px 24px',
          }}
        >
          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'white',
              margin: '0 0 10px',
              letterSpacing: '-0.015em',
              lineHeight: 1.25,
            }}
          >
            {name ? `Let's set up your LinkedIn, ${name.split(' ')[0]}` : "Let's set up your LinkedIn profile"}
          </h2>
          <p
            style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.85)',
              margin: 0,
              lineHeight: 1.65,
            }}
          >
            Around 70% of Aussie roles are filled via networking. This is your LinkedIn toolkit: profile rewrite, outreach templates, and headline drafts.
          </p>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '28px 32px 0' }}>
          {/* Start-here callout */}
          <div
            style={{
              background: warm.colors.bgAlt,
              border: `1px solid ${warm.colors.borderWhisper}`,
              borderRadius: warm.radius.card,
              padding: '14px 18px',
              marginBottom: 28,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                fontSize: 15,
                color: '#C5A059',
                lineHeight: 1,
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              ★
            </span>
            <p
              style={{
                fontSize: 13,
                color: warm.colors.textSecondary,
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              Your Photo, Headline and About are what a stranger judges in the first 5 seconds. Nail those first.
            </p>
          </div>

          {/* ── Target Role ── */}
          <div style={{ marginBottom: 28 }}>
            <label
              htmlFor="modal-targetRole"
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: warm.colors.textMuted,
                marginBottom: 8,
              }}
            >
              Target Role{' '}
              <span
                style={{
                  fontWeight: 400,
                  textTransform: 'none',
                  letterSpacing: 0,
                  fontSize: 12,
                }}
              >
                (optional)
              </span>
            </label>
            <input
              id="modal-targetRole"
              type="text"
              value={targetRole}
              onChange={(e) => onTargetRoleChange(e.target.value)}
              placeholder="e.g. Senior Product Manager · B2B SaaS"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: warm.radius.input,
                fontSize: 14,
                background: warm.colors.bgAlt,
                border: `1px solid ${warm.colors.borderDefined}`,
                color: warm.colors.textPrimary,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <p
              style={{
                fontSize: 12,
                color: warm.colors.textMuted,
                margin: '6px 0 0',
                lineHeight: 1.5,
              }}
            >
              Adding a target role sharpens the output. Leave blank for a general profile.
            </p>
          </div>

          {/* ── Profile Photo ── */}
          <div style={{ marginBottom: 28 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: warm.colors.textMuted,
                margin: '0 0 12px',
              }}
            >
              Add a profile photo{' '}
              <span
                style={{
                  fontWeight: 400,
                  textTransform: 'none',
                  letterSpacing: 0,
                  fontSize: 12,
                }}
              >
                (recommended)
              </span>
            </p>
            <HeadshotGenerator
              initialHeadshotUrl={headshotUrl}
              onSaved={onHeadshotSaved}
            />
          </div>

          {/* ── Banner ── */}
          <div style={{ marginBottom: 0 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: warm.colors.textMuted,
                margin: '0 0 12px',
              }}
            >
              Pick a banner style{' '}
              <span
                style={{
                  fontWeight: 400,
                  textTransform: 'none',
                  letterSpacing: 0,
                  fontSize: 12,
                }}
              >
                (optional — banner text fills in after generation)
              </span>
            </p>
            <BannerCanvas
              config={bannerConfig}
              onConfigChange={onBannerConfigChange}
              onClose={() => {}}
            />
          </div>
        </div>

        {/* ── Footer CTA ── */}
        <div style={{ padding: '24px 32px 32px' }}>
          <button
            aria-label={
              generating
                ? 'Generating your profile, please wait'
                : 'Generate my LinkedIn profile'
            }
            disabled={generating}
            onClick={async () => {
              try {
                await onGenerate();
              } catch {
                // Error already surfaced via toast inside onGenerate.
              }
            }}
            style={{
              width: '100%',
              padding: '16px 0',
              borderRadius: warm.radius.button,
              border: 'none',
              background: generating ? 'rgba(10,102,194,0.5)' : '#0A66C2',
              color: 'white',
              fontSize: 15,
              fontWeight: 700,
              cursor: generating ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background 0.15s',
            }}
          >
            {generating && (
              <Loader2
                size={16}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            )}
            {generating
              ? 'Generating your profile…'
              : 'Generate my LinkedIn profile'}
          </button>
        </div>
      </div>
    </div>
  );
};
