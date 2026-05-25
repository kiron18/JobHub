import { warm } from '../../lib/theme/warmTokens';

interface PrimaryButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  type?: 'button' | 'submit';
}

export function PrimaryButton({ label, onClick, disabled, loading, small, type = 'button' }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  const padY = small ? '10px' : '14px';
  const padX = small ? '20px' : '28px';
  const fontSize = small ? '0.875rem' : '0.9375rem';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      style={{
        background: isDisabled ? `${warm.colors.accentPetrol}80` : warm.colors.accentPetrol,
        color: warm.colors.textOnDeep,
        padding: `${padY} ${padX}`,
        borderRadius: warm.radius.button,
        border: 'none',
        fontWeight: 600,
        fontSize,
        fontFamily: warm.type.fontBody,
        letterSpacing: '-0.005em',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        boxShadow: isDisabled
          ? 'none'
          : '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)',
        transition: 'transform 180ms cubic-bezier(0.25,1,0.5,1), box-shadow 180ms cubic-bezier(0.25,1,0.5,1)',
        outline: 'none',
      }}
      onMouseEnter={e => {
        if (isDisabled) return;
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(26,24,20,0.06), 0 8px 24px rgba(45,90,110,0.22)';
      }}
      onMouseLeave={e => {
        if (isDisabled) return;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)';
      }}
      onMouseDown={e => {
        if (isDisabled) return;
        e.currentTarget.style.background = warm.colors.accentPetrolPressed;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      onMouseUp={e => {
        if (isDisabled) return;
        e.currentTarget.style.background = warm.colors.accentPetrol;
      }}
      onFocus={e => {
        e.currentTarget.style.boxShadow = `0 0 0 3px ${warm.colors.ringFocus}, 0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)`;
      }}
      onBlur={e => {
        if (isDisabled) return;
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)';
      }}
    >
      {loading ? 'Loading…' : label}
    </button>
  );
}
