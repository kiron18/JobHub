import React from 'react';
import { colors, type as typeTokens } from '../tokens';

interface EyebrowProps {
  children: React.ReactNode;
  showAccent?: boolean;
}

export function Eyebrow({ children, showAccent = true }: EyebrowProps) {
  return (
    <div style={{ marginBottom: 20 }}>
      <span
        style={{
          fontFamily: typeTokens.body,
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: colors.textMuted,
          display: 'block',
        }}
      >
        {children}
      </span>
      {showAccent && (
        <div
          style={{
            width: 24,
            height: 1,
            background: colors.accentGoldSoft,
            marginTop: 4,
          }}
        />
      )}
    </div>
  );
}
