import React, { useState } from 'react';
import { Copy, Check, Pencil, Camera, Sparkles, RefreshCw } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import type { LinkedInProfileData, BannerConfig } from './types';
import { BannerCanvas } from './BannerCanvas';
import { HeadshotGenerator } from './HeadshotGenerator';

interface Props {
  name: string;
  location?: string;
  headshotUrl?: string | null;
  profileData: LinkedInProfileData | null;
  bannerConfig: BannerConfig;
  bannerEditorOpen: boolean;
  generating: boolean;
  regeneratingSection: string | null;
  onBannerConfigChange: (config: BannerConfig) => void;
  onOpenBannerEditor: () => void;
  onCloseBannerEditor: () => void;
  onHeadshotSaved: (url: string) => void;
  onGenerateAll: () => void;
  onRegenerate: (section: string) => void;
  onHeadlineChange: (val: string) => void;
}

const LINKEDIN_BLUE = '#0A66C2';
const OPEN_TO_WORK_GREEN = '#2A9D6F';

export const ProfileIntroCard: React.FC<Props> = ({
  name,
  location,
  headshotUrl,
  profileData,
  bannerConfig,
  bannerEditorOpen,
  generating,
  regeneratingSection,
  onBannerConfigChange,
  onOpenBannerEditor,
  onCloseBannerEditor,
  onHeadshotSaved,
  onGenerateAll,
  onRegenerate,
  onHeadlineChange,
}) => {
  const [copiedHeadline, setCopiedHeadline] = useState(false);
  const [editingHeadline, setEditingHeadline] = useState(false);
  const [editedHeadline, setEditedHeadline] = useState(profileData?.headline ?? '');
  const [showHeadshotGenerator, setShowHeadshotGenerator] = useState(false);

  const hasGenerated = !!profileData;
  const hasHeadline = !!profileData?.headline;
  const hasOpenToWork = !!profileData?.openToWork;
  const hasBanner = !!bannerConfig.mainMessage;

  async function handleCopyHeadline() {
    if (!profileData?.headline) return;
    await navigator.clipboard.writeText(profileData.headline);
    setCopiedHeadline(true);
    setTimeout(() => setCopiedHeadline(false), 1800);
  }

  function handleSaveHeadline() {
    onHeadlineChange(editedHeadline);
    setEditingHeadline(false);
  }

  // Banner height ~140px scaled to display width
  const BANNER_HEIGHT = 140;

  return (
    <div style={{
      background: warm.colors.bgSurface,
      border: `1px solid ${warm.colors.borderWhisper}`,
      borderRadius: warm.radius.card,
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      {/* Cover / Banner Region */}
      <div style={{
        height: BANNER_HEIGHT,
        background: hasBanner
          ? bannerConfig.bgColor
          : 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 50%, #E8F4F8 100%)',
        position: 'relative',
        borderRadius: `${warm.radius.card}px ${warm.radius.card}px 0 0`,
      }}>
        {/* Faint texture for placeholder state */}
        {!hasBanner && (
          <div style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.4,
            background: `repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(10,102,194,0.03) 20px, rgba(10,102,194,0.03) 40px)`,
          }} />
        )}

        {/* Banner Button (top-right) */}
        {!bannerEditorOpen && (
          <button
            onClick={onOpenBannerEditor}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              border: `1px solid ${hasBanner ? warm.colors.borderWhisper : 'rgba(10,102,194,0.3)'}`,
              background: hasBanner ? 'rgba(255,255,255,0.9)' : 'rgba(10,102,194,0.08)',
              color: LINKEDIN_BLUE,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              zIndex: 2,
            }}
          >
            <Sparkles size={14} />
            {hasBanner ? 'Edit Banner' : '✨ Banner'}
          </button>
        )}

        {/* Banner Editor Inline */}
        {bannerEditorOpen && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: warm.colors.bgDeep,
            padding: 16,
            zIndex: 3,
            overflow: 'auto',
          }}>
            <BannerCanvas
              config={bannerConfig}
              onConfigChange={onBannerConfigChange}
              onClose={onCloseBannerEditor}
            />
          </div>
        )}
      </div>

      {/* Profile Content */}
      <div style={{ padding: '0 24px 24px', position: 'relative' }}>
        {/* Photo - overlapping the banner bottom */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          marginTop: -48,
          marginBottom: 16,
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            {/* Photo Circle */}
            <div style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              overflow: 'hidden',
              border: `4px solid ${warm.colors.bgSurface}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              background: headshotUrl ? 'transparent' : 'linear-gradient(135deg, #0A66C2, #004182)',
              flexShrink: 0,
              position: 'relative',
            }}>
              {headshotUrl ? (
                <img
                  src={headshotUrl}
                  alt="Profile"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 36,
                  fontWeight: 800,
                  color: 'white',
                }}>
                  {name?.[0] ?? '?'}
                </div>
              )}

              {/* Green "Open to Work" ring */}
              {hasOpenToWork && (
                <div style={{
                  position: 'absolute',
                  inset: -3,
                  borderRadius: '50%',
                  border: `3px solid ${OPEN_TO_WORK_GREEN}`,
                  pointerEvents: 'none',
                }} />
              )}

              {/* Camera button on photo */}
              <button
                onClick={() => setShowHeadshotGenerator(v => !v)}
                style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: 'none',
                  background: warm.colors.bgSurface,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 2,
                }}
                title="Generate photo"
              >
                <Camera size={14} color={LINKEDIN_BLUE} />
              </button>
            </div>

            {/* Generate Photo Button (below photo when no headshot) */}
            {!headshotUrl && !showHeadshotGenerator && (
              <button
                onClick={() => setShowHeadshotGenerator(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 20,
                  border: `1px solid ${LINKEDIN_BLUE}`,
                  background: 'transparent',
                  color: LINKEDIN_BLUE,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                <Camera size={14} />
                Generate photo
              </button>
            )}
          </div>

          {/* Action buttons (LinkedIn-style) */}
          {hasGenerated ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {/* Copy Headline button */}
              {hasHeadline && (
                <button
                  onClick={handleCopyHeadline}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 20,
                    border: `1px solid ${copiedHeadline ? '#2A9D6F' : warm.colors.borderWhisper}`,
                    background: copiedHeadline ? 'rgba(42,157,111,0.1)' : LINKEDIN_BLUE,
                    color: copiedHeadline ? '#2A9D6F' : 'white',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {copiedHeadline ? <Check size={16} /> : <Copy size={16} />}
                  {copiedHeadline ? 'Copied' : 'Copy Headline'}
                </button>
              )}
            </div>
          ) : (
            /* Generate Profile Button (shown before generation) */
            <button
              onClick={onGenerateAll}
              disabled={generating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 20,
                border: 'none',
                background: generating ? 'rgba(10,102,194,0.4)' : LINKEDIN_BLUE,
                color: 'white',
                fontSize: 14,
                fontWeight: 700,
                cursor: generating ? 'default' : 'pointer',
                marginBottom: 8,
              }}
            >
              {generating && (
                <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
              )}
              <Sparkles size={16} />
              {generating ? 'Generating…' : 'Generate my profile'}
            </button>
          )}
        </div>

        {/* Headshot Generator (inline expand) */}
        {showHeadshotGenerator && (
          <div style={{ marginBottom: 20 }}>
            <HeadshotGenerator
              initialHeadshotUrl={headshotUrl}
              onSaved={(url) => {
                onHeadshotSaved(url);
                setShowHeadshotGenerator(false);
              }}
            />
          </div>
        )}

        {/* Name Row */}
        <div style={{ marginBottom: 4 }}>
          <h2 style={{
            fontSize: 22,
            fontWeight: 700,
            color: warm.colors.textPrimary,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            {name || 'Your Name'}
            {/* Verified badge (cosmetic) */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.6 }}>
              <circle cx="8" cy="8" r="7" stroke={LINKEDIN_BLUE} strokeWidth="1.5"/>
              <path d="M5 8L7 10L11 6" stroke={LINKEDIN_BLUE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </h2>
        </div>

        {/* Headline */}
        <div style={{ marginBottom: 8, position: 'relative' }}>
          {editingHeadline ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <textarea
                value={editedHeadline}
                onChange={(e) => setEditedHeadline(e.target.value)}
                rows={2}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: `1px solid ${warm.colors.borderWhisper}`,
                  background: 'rgba(255,255,255,0.03)',
                  color: warm.colors.textPrimary,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              <button
                onClick={handleSaveHeadline}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: LINKEDIN_BLUE,
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{
                fontSize: 15,
                color: warm.colors.textSecondary,
                margin: 0,
                lineHeight: 1.4,
                flex: 1,
              }}>
                {profileData?.headline || (
                  <span style={{ color: warm.colors.textMuted, fontStyle: 'italic' }}>
                    Your headline will appear here — generate your profile to fill it in
                  </span>
                )}
              </p>
              {hasHeadline && (
                <button
                  onClick={() => {
                    setEditedHeadline(profileData?.headline ?? '');
                    setEditingHeadline(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    borderRadius: 4,
                    color: warm.colors.textMuted,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Edit headline"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Location + Open to Work */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: warm.colors.textMuted,
          marginBottom: 12,
        }}>
          <span>{location || 'Your Location'}</span>
          <span>·</span>
          <span style={{ color: LINKEDIN_BLUE, cursor: 'pointer' }}>Contact info</span>
          {hasOpenToWork && (
            <>
              <span>·</span>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: OPEN_TO_WORK_GREEN,
                fontWeight: 600,
              }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: OPEN_TO_WORK_GREEN,
                }} />
                Open to work
              </span>
            </>
          )}
        </div>

        {/* Why this matters caption */}
        {hasHeadline && (
          <p style={{
            fontSize: 12,
            color: warm.colors.textMuted,
            margin: '12px 0 0',
            lineHeight: 1.5,
            fontStyle: 'italic',
          }}>
            Your headline rides next to your name everywhere you comment, message, or appear in search.
          </p>
        )}

        {/* Soft-nudge regenerate for headline */}
        {hasHeadline && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${warm.colors.borderWhisper}`,
          }}>
            <button
              onClick={() => onRegenerate('headline')}
              disabled={regeneratingSection === 'headline'}
              style={{
                background: 'none',
                border: 'none',
                color: warm.colors.textMuted,
                fontSize: 12,
                fontWeight: 600,
                cursor: regeneratingSection === 'headline' ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: 0,
              }}
            >
              <RefreshCw size={12} style={{
                animation: regeneratingSection === 'headline' ? 'spin 1s linear infinite' : 'none',
              }} />
              Regenerate headline
            </button>
            <span style={{ fontSize: 11, color: warm.colors.textMuted, fontStyle: 'italic' }}>
              Drafts rarely improve with rerolls — tweak it yourself instead.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
