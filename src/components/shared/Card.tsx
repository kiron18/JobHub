import React from 'react';
import { warm } from '../../lib/theme/warmTokens';

interface CardProps {
  children: React.ReactNode;
  padding?: string;
  style?: React.CSSProperties;
}

export function Card({ children, padding = '24px', style }: CardProps) {
  return (
    <div
      style={{
        background: warm.colors.bgSurface,
        border: `1px solid ${warm.colors.borderWhisper}`,
        borderRadius: warm.radius.card,
        padding,
        boxShadow: warm.shadow.soft,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
