import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { colors, type as typeTokens } from './tokens';
import { PrimaryCTA } from './shared/PrimaryCTA';
import type { HeroVariant } from '../../lib/landingVariant';
import { trackLandingCtaClicked } from '../../lib/analytics';

interface FinalCTAProps {
  variant: HeroVariant;
}

export function FinalCTA({ variant }: FinalCTAProps) {
  const navigate = useNavigate();

  const handleCta = () => {
    trackLandingCtaClicked('final', variant);
    navigate('/auth?intent=signup');
  };

  return (
    <section id="cta" style={{ background: colors.bgCanvas }}>
      <div
        style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: '120px 24px',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontFamily: typeTokens.display,
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: '-0.015em',
            color: colors.textPrimary,
            margin: 0,
            fontVariationSettings: "'SOFT' 50, 'WONK' 1",
          }}
        >
          You've read this far.
          <br />
          Let's see what's actually
          <br />
          going on with your search.
        </h2>

        <p
          style={{
            fontFamily: typeTokens.body,
            fontSize: '1.125rem',
            lineHeight: 1.6,
            color: colors.textSecondary,
            marginTop: 16,
          }}
        >
          The diagnostic takes 3 minutes and shows you, specifically, what's broken
          in your current approach - and what to do about it. No card, no commitment.
          Just an honest read.
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: 32,
          }}
        >
          <PrimaryCTA label="Run my 3-minute diagnosis →" onClick={handleCta} />
        </div>

        <p
          style={{
            fontFamily: typeTokens.body,
            fontSize: '0.8125rem',
            color: colors.textMuted,
            marginTop: 16,
          }}
        >
          Free · No card needed · Built for Aussie grads
        </p>

        {/* Micro-FAQ */}
        <div
          style={{
            marginTop: 64,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <ChevronRight size={14} color={colors.textMuted} strokeWidth={1.5} />
            <span
              style={{
                fontFamily: typeTokens.body,
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: colors.textPrimary,
              }}
            >
              Is this just for fresh grads?
            </span>
          </div>
          <p
            style={{
              fontFamily: typeTokens.body,
              fontSize: '0.875rem',
              color: colors.textSecondary,
              margin: '8px 0 0',
              maxWidth: 480,
              marginInline: 'auto',
            }}
          >
            No - built with grads in mind, but works for anyone job-hunting in the
            Australian market. Most of what makes Australian hiring weird affects
            everyone in it.
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          section#cta > div { padding: 72px 20px; }
        }
      `}</style>
    </section>
  );
}
