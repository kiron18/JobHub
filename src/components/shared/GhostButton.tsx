import { warm } from '../../lib/theme/warmTokens';

interface GhostButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  small?: boolean;
  type?: 'button' | 'submit';
}

export function GhostButton({ label, onClick, disabled, small, type = 'button' }: GhostButtonProps) {
  const fontSize = small ? '0.8125rem' : '0.9375rem';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent',
        border: 'none',
        color: disabled ? warm.colors.textMuted : warm.colors.textSecondary,
        padding: '8px 16px',
        borderRadius: warm.radius.button,
        fontWeight: 600,
        fontSize,
        fontFamily: warm.type.fontBody,
        cursor: disabled ? 'not-allowed' : 'pointer',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
        transition: 'color 180ms ease',
        outline: 'none',
      }}
      onMouseEnter={e => {
        if (disabled) return;
        e.currentTarget.style.color = warm.colors.textPrimary;
      }}
      onMouseLeave={e => {
        if (disabled) return;
        e.currentTarget.style.color = warm.colors.textSecondary;
      }}
      onFocus={e => {
        e.currentTarget.style.outline = `2px solid ${warm.colors.ringFocus}`;
        e.currentTarget.style.outlineOffset = '2px';
      }}
      onBlur={e => {
        e.currentTarget.style.outline = 'none';
      }}
    >
      {label}
    </button>
  );
}
