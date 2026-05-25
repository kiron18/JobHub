import React from 'react';
import { warm } from '../../lib/theme/warmTokens';

interface EyebrowProps {
  children: React.ReactNode;
  showAccent?: boolean;
}

export function Eyebrow({ children, showAccent = false }: EyebrowProps) {
  return (
    <div style={{ marginBottom: 20 }}>
      <span
        style={{
          fontFamily: warm.type.fontBody,
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: warm.colors.textMuted,
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
            background: warm.colors.accentGoldSoft,
            marginTop: 4,
          }}
        />
      )}
    </div>
  );
}
