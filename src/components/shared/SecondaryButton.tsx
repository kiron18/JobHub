import { warm } from '../../lib/theme/warmTokens';

interface SecondaryButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  small?: boolean;
  type?: 'button' | 'submit';
}

export function SecondaryButton({ label, onClick, disabled, small, type = 'button' }: SecondaryButtonProps) {
  const padY = small ? '9px' : '13px';
  const padX = small ? '18px' : '26px';
  const fontSize = small ? '0.8125rem' : '0.9375rem';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent',
        color: disabled ? warm.colors.textMuted : warm.colors.textPrimary,
        padding: `${padY} ${padX}`,
        borderRadius: warm.radius.button,
        border: `1px solid ${warm.colors.borderDefined}`,
        fontWeight: 600,
        fontSize,
        fontFamily: warm.type.fontBody,
        cursor: disabled ? 'not-allowed' : 'pointer',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 180ms ease, color 180ms ease',
        outline: 'none',
      }}
      onMouseEnter={e => {
        if (disabled) return;
        e.currentTarget.style.background = warm.colors.bgAlt;
      }}
      onMouseLeave={e => {
        if (disabled) return;
        e.currentTarget.style.background = 'transparent';
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
