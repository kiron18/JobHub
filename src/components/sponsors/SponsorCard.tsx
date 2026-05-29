import React from 'react';
import { colors, type, spacing } from '../landing/tokens';

interface SponsorCardData {
  id: string;
  cleanName: string;
  industry: string;
  locations: string[];
  hiringProfile: string;
  confidence: string;
  website: string | null;
  careersUrl: string | null;
  careersSearchUrl: string | null;
}

interface Props {
  sponsor: SponsorCardData;
  unlocked: boolean;
  onLockedClick: () => void;
}

export function SponsorCard({ sponsor, unlocked, onLockedClick }: Props) {
  const careersTarget = sponsor.careersUrl || sponsor.careersSearchUrl;

  const linkStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: colors.accentPetrol,
    textDecoration: 'none',
    padding: '6px 14px',
    borderRadius: 20,
    border: `1.5px solid ${colors.accentGold}`,
    background: 'transparent',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: type.body,
  };

  const lockedLinkStyle: React.CSSProperties = {
    ...linkStyle,
    color: colors.textMuted,
    borderColor: colors.borderDefined,
    cursor: 'pointer',
  };

  return (
    <div style={{
      background: colors.bgSurface,
      border: `1px solid ${colors.borderWhisper}`,
      borderRadius: 12,
      padding: spacing.cardPaddingDesktop,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      transition: 'box-shadow 180ms ease',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Company name */}
      <h3 style={{
        margin: 0,
        fontFamily: type.display,
        fontSize: 17,
        fontWeight: 700,
        color: colors.textPrimary,
        lineHeight: 1.3,
      }}>
        {sponsor.cleanName}
      </h3>

      {/* Industry tag */}
      <span style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 600,
        color: colors.accentPetrol,
        background: 'rgba(45, 90, 110, 0.08)',
        padding: '2px 10px',
        borderRadius: 10,
        width: 'fit-content',
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
      }}>
        {sponsor.industry}
      </span>

      {/* Locations */}
      <p style={{
        margin: 0,
        fontSize: 13,
        color: colors.textSecondary,
        fontFamily: type.body,
      }}>
        {sponsor.locations.join(', ')}
      </p>

      {/* Hiring profile */}
      <p style={{
        margin: 0,
        fontSize: 14,
        color: colors.textMuted,
        fontFamily: type.body,
        lineHeight: 1.4,
      }}>
        {sponsor.hiringProfile}
      </p>

      {/* Action links */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginTop: 'auto',
        paddingTop: 8,
        flexWrap: 'wrap',
      }}>
        {unlocked ? (
          <>
            {sponsor.website && (
              <a href={sponsor.website} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                Website →
              </a>
            )}
            {careersTarget && (
              <a href={careersTarget} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                Careers →
              </a>
            )}
          </>
        ) : (
          <button onClick={onLockedClick} style={lockedLinkStyle}>
            🔒 Contact links — unlock free
          </button>
        )}
      </div>
    </div>
  );
}
