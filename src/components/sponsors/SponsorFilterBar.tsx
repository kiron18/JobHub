import React from 'react';
import { colors, type } from '../landing/tokens';

interface Props {
  industries: string[];
  locations: string[];
  selectedIndustry: string;
  selectedLocation: string;
  highConfidenceOnly: boolean;
  onIndustryChange: (v: string) => void;
  onLocationChange: (v: string) => void;
  onConfidenceToggle: () => void;
}

export function SponsorFilterBar({
  industries, locations,
  selectedIndustry, selectedLocation,
  highConfidenceOnly,
  onIndustryChange, onLocationChange, onConfidenceToggle,
}: Props) {
  const selectStyle: React.CSSProperties = {
    padding: '8px 14px',
    borderRadius: 10,
    border: `1.5px solid ${colors.borderDefined}`,
    background: colors.bgSurface,
    fontSize: 13,
    fontFamily: type.body,
    color: colors.textPrimary,
    outline: 'none',
    cursor: 'pointer',
    minWidth: 150,
  };

  const chipActive: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: 20,
    border: `1.5px solid ${colors.accentPetrol}`,
    background: colors.accentPetrol,
    color: colors.textOnDeep,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: type.body,
    cursor: 'pointer',
    transition: 'all 180ms ease',
  };

  const chipInactive: React.CSSProperties = {
    ...chipActive,
    background: 'transparent',
    color: colors.textSecondary,
    borderColor: colors.borderDefined,
  };

  return (
    <div style={{
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <select
        value={selectedIndustry}
        onChange={(e) => onIndustryChange(e.target.value)}
        style={selectStyle}
      >
        <option value="">All industries</option>
        {(industries || []).map((ind) => (
          <option key={ind} value={ind}>{ind}</option>
        ))}
      </select>

      <select
        value={selectedLocation}
        onChange={(e) => onLocationChange(e.target.value)}
        style={selectStyle}
      >
        <option value="">All locations</option>
        {(locations || []).map((loc) => (
          <option key={loc} value={loc}>{loc}</option>
        ))}
      </select>

      <button
        onClick={onConfidenceToggle}
        style={highConfidenceOnly ? chipActive : chipInactive}
      >
        {highConfidenceOnly ? '✓ High confidence only' : 'High confidence only'}
      </button>
    </div>
  );
}
