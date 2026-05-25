import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, type as typeTokens } from './tokens';
import { PrimaryCTA } from './shared/PrimaryCTA';
import { Eyebrow } from './shared/Eyebrow';
import { ScrollCue } from './ScrollCue';
import type { HeroVariant } from '../../lib/landingVariant';
import { trackLandingCtaClicked } from '../../lib/analytics';

interface HeroProps {
  variant: HeroVariant;
  onCtaClick?: () => void;
}

// ── Variant content ─────────────────────────────────────────────

const CONTENT: Record<HeroVariant, {
  eyebrow?: string;
  headline: React.ReactNode;
  sub: string;
  ctaLabel: string;
  microcopy: string;
}> = {
  v1_founder: {
    eyebrow: 'FOR AUSTRALIAN GRADUATES',
    headline: (
      <>
        I sent 100 applications.
        <br />
        I got no replies.
        <br />
        <span style={{ color: colors.accentGold }}>There's a reason, and a fix.</span>
      </>
    ),
    sub: "Most Aussie grads aren't unhireable. They're applying without knowing how Australian hiring actually works. JobHub is the system that gets you in front of the right people, with applications that don't get auto-filtered.",
    ctaLabel: "Show me what's broken in my approach →",
    microcopy: 'Free · No card needed · 3-minute diagnosis',
  },
  v2_reframe: {
    eyebrow: 'THE AUSTRALIAN APPLICATION ENGINE',
    headline: (
      <>
        You're not unemployable.
        <br />
        You're{' '}
        <span style={{ color: colors.accentGold }}>invisible to the system.</span>
      </>
    ),
    sub: "Most rejections in Australia aren't about your qualifications. They're about applications that never reach a human, profiles that never get found, and a hiring system most people never learn. JobHub is the layer between you and that system.",
    ctaLabel: 'Run my 3-minute diagnosis →',
    microcopy: 'Free · No card · Built for Aussie grads',
  },
  v3_plain: {
    eyebrow: undefined,
    headline: (
      <>
        Job hunting in Australia is brutal.
        <br />
        <span style={{ color: colors.accentGold }}>Here's the system uni didn't teach you.</span>
      </>
    ),
    sub: "You don't need to apply harder. You need to apply with a system that knows what Australian recruiters actually filter for, who they listen to, and how to get heard. That's the whole product.",
    ctaLabel: 'Start my 3-minute diagnosis →',
    microcopy: 'Free · No card · Cancel anytime',
  },
};

// ── Hero component ──────────────────────────────────────────────

export function Hero({ variant, onCtaClick }: HeroProps) {
  const navigate = useNavigate();
  const mqRef = useRef<MediaQueryList | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  const illustrationRef = useRef<HTMLDivElement>(null);
  const [illustrationRevealed, setIllustrationRevealed] = useState(false);

  useEffect(() => {
    mqRef.current = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mqRef.current.addEventListener('change', handler);
    return () => mqRef.current?.removeEventListener('change', handler);
  }, []);

  const content = CONTENT[variant];
  const showEyebrow = variant !== 'v3_plain';

  const handleCta = () => {
    trackLandingCtaClicked('hero', variant);
    onCtaClick?.();
    navigate('/auth?intent=signup');
  };

  const handleLogIn = () => {
    navigate('/auth?intent=signin');
  };

  const handleIllustrationInView = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting) {
        setIllustrationRevealed(true);
      }
    },
    []
  );

  useEffect(() => {
    const el = illustrationRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(handleIllustrationInView, {
      threshold: 0.3,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIllustrationInView]);

  return (
    <section id="hero" style={{ background: colors.bgCanvas }}>
      {/* Above-the-fold band: hard-capped to viewport, ScrollCue absolutely pinned to bottom */}
      <div
        className="hero-fold"
        style={{
          height: 'calc(100vh - 64px)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '0 24px 72px',
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            maxWidth: 720,
            width: '100%',
          }}
        >
          {showEyebrow && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Eyebrow>{content.eyebrow!}</Eyebrow>
            </div>
          )}

          <h1
            className="hero-headline"
            style={{
              fontFamily: typeTokens.display,
              fontSize: 'clamp(2.25rem, 4.4vw, 3.375rem)',
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: colors.textPrimary,
              margin: showEyebrow ? '16px 0 0' : 0,
              fontVariationSettings: "'SOFT' 50, 'WONK' 1",
            }}
          >
            {content.headline}
          </h1>

          <p
            style={{
              fontFamily: typeTokens.body,
              fontSize: '1.0625rem',
              fontWeight: 400,
              lineHeight: 1.55,
              color: colors.textSecondary,
              margin: '18px 0 0',
              maxWidth: 580,
              marginInline: 'auto',
            }}
          >
            {content.sub}
          </p>

          <div
            style={{
              marginTop: 24,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                width: '100%',
                maxWidth: 400,
              }}
            >
              <PrimaryCTA label={content.ctaLabel} onClick={handleCta} />
            </div>
          </div>

          <p
            style={{
              fontFamily: typeTokens.body,
              fontSize: '0.8125rem',
              color: colors.textMuted,
              marginTop: 12,
              marginBottom: 0,
            }}
          >
            {content.microcopy}
          </p>

          <p
            style={{
              fontFamily: typeTokens.body,
              fontSize: '0.8125rem',
              color: colors.textMuted,
              marginTop: 14,
              marginBottom: 0,
            }}
          >
            Already have an account?{' '}
            <button
              onClick={handleLogIn}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: colors.accentPetrol,
                fontWeight: 600,
                fontSize: '0.8125rem',
                padding: 0,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                fontFamily: typeTokens.body,
                outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.outline = `2px solid ${colors.ringFocus}`; e.currentTarget.style.outlineOffset = '3px'; }}
              onBlur={e => { e.currentTarget.style.outline = 'none'; }}
            >
              Log in
            </button>
          </p>
        </div>

        {/* ScrollCue: absolutely pinned to bottom of fold — guaranteed above the fold */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>
            <ScrollCue variant={variant} prefersReducedMotion={prefersReducedMotion} />
          </div>
        </div>
      </div>

      {/* Below-the-fold reveal: hero illustration band */}
      <div
        ref={illustrationRef}
        style={{
          width: '100%',
          maxWidth: 1100,
          marginInline: 'auto',
          marginTop: 16,
          marginBottom: 48,
          padding: '0 24px',
        }}
      >
        <img
          src="/hero-image-t.webp"
          alt="The job search journey, from application to offer"
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            maskImage: prefersReducedMotion
              ? 'none'
              : 'linear-gradient(to right, black 0%, black 50%, transparent 100%)',
            WebkitMaskImage: prefersReducedMotion
              ? 'none'
              : 'linear-gradient(to right, black 0%, black 50%, transparent 100%)',
            maskSize: prefersReducedMotion ? undefined : '200% 100%',
            WebkitMaskSize: prefersReducedMotion ? undefined : '200% 100%',
            maskPosition: prefersReducedMotion || illustrationRevealed ? '0 0' : '100% 0',
            WebkitMaskPosition: prefersReducedMotion || illustrationRevealed ? '0 0' : '100% 0',
            transition: prefersReducedMotion
              ? 'none'
              : 'mask-position 1.4s cubic-bezier(0.25, 1, 0.5, 1), -webkit-mask-position 1.4s cubic-bezier(0.25, 1, 0.5, 1)',
          }}
        />
      </div>

      {/* Mobile adjustments */}
      <style>{`
        @media (max-width: 640px) {
          section#hero > .hero-fold { height: calc(100vh - 56px); padding-top: 16px; padding-bottom: 64px; }
          section#hero .hero-headline { font-size: clamp(1.875rem, 8vw, 2.5rem); }
        }
      `}</style>
    </section>
  );
}
