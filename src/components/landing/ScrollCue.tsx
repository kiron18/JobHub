import { ChevronDown } from 'lucide-react';
import { colors, type as typeTokens } from './tokens';
import type { HeroVariant } from '../../lib/landingVariant';

const CUE_TEXT: Record<HeroVariant, string> = {
  v1_founder: 'See how it works',
  v2_reframe: 'See how it works',
  v3_plain: 'See how it works',
};

interface ScrollCueProps {
  variant: HeroVariant;
  prefersReducedMotion?: boolean;
}

export function ScrollCue({ variant, prefersReducedMotion }: ScrollCueProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        paddingBottom: 16,
      }}
    >
      <ChevronDown
        size={14}
        color={colors.textMuted}
        strokeWidth={1.5}
        style={
          prefersReducedMotion
            ? {}
            : {
                animation: 'scrollCueBob 1.6s ease-in-out infinite',
              }
        }
      />
      <span
        style={{
          fontFamily: typeTokens.body,
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: colors.textMuted,
          letterSpacing: '0.04em',
        }}
      >
        {CUE_TEXT[variant]}
      </span>
      <style>{`
        @keyframes scrollCueBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(4px); }
        }
      `}</style>
    </div>
  );
}
