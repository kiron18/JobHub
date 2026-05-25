import { colors, type as typeTokens } from '../tokens';

interface PrimaryCTAProps {
  label: string;
  onClick: () => void;
  small?: boolean;
}

export function PrimaryCTA({ label, onClick, small }: PrimaryCTAProps) {
  const padY = small ? '12px' : '14px';
  const padX = small ? '24px' : '28px';
  const fontSize = small ? '0.875rem' : '0.9375rem';

  return (
    <button
      onClick={onClick}
      style={{
        background: colors.accentPetrol,
        color: colors.textOnDeep,
        padding: `${padY} ${padX}`,
        borderRadius: 10,
        border: 'none',
        fontWeight: 600,
        fontSize,
        fontFamily: typeTokens.body,
        letterSpacing: '-0.005em',
        cursor: 'pointer',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        boxShadow:
          '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)',
        transition:
          'transform 180ms cubic-bezier(0.25,1,0.5,1), box-shadow 180ms cubic-bezier(0.25,1,0.5,1)',
        outline: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow =
          '0 1px 2px rgba(26,24,20,0.06), 0 8px 24px rgba(45,90,110,0.22)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow =
          '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)';
      }}
      onMouseDown={e => {
        e.currentTarget.style.background = colors.accentPetrolPressed;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      onMouseUp={e => {
        e.currentTarget.style.background = colors.accentPetrol;
      }}
      onFocus={e => {
        e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.ringFocus}, 0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)`;
      }}
      onBlur={e => {
        e.currentTarget.style.boxShadow =
          '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)';
      }}
    >
      {label}
    </button>
  );
}
