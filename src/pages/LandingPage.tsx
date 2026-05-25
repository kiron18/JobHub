import React, { useEffect, useRef, useState } from 'react';
import posthog from 'posthog-js';
import { getHeroVariant, type HeroVariant } from '../lib/landingVariant';
import { trackLandingViewed, trackLandingSectionViewed } from '../lib/analytics';
import { colors } from '../components/landing/tokens';
import { LandingNav } from '../components/landing/LandingNav';
import { Hero } from '../components/landing/Hero';
import { ThreeTruths } from '../components/landing/ThreeTruths';
import { SocialProof } from '../components/landing/SocialProof';
import { ObjectionHandler } from '../components/landing/ObjectionHandler';
import { ValuePreview } from '../components/landing/ValuePreview';
import { RiskReversal } from '../components/landing/RiskReversal';
import { FinalCTA } from '../components/landing/FinalCTA';
import { LandingFooter } from '../components/landing/LandingFooter';

// ── Section tracking wrapper ───────────────────────────────────

function SectionTracker({
  sectionId,
  variant,
  children,
  style,
}: {
  sectionId: string;
  variant: HeroVariant;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const trackedRef = useRef(false);
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !trackedRef.current) {
          trackedRef.current = true;
          trackLandingSectionViewed(sectionId, variant);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [sectionId, variant]);

  return (
    <div ref={elRef} style={style}>
      {children}
    </div>
  );
}

// ── Loading shell ───────────────────────────────────────────────

function LoadingShell() {
  return (
    <div
      className="landing-page"
      style={{
        height: '100vh',
        overflowY: 'auto',
        background: colors.bgCanvas,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: `3px solid ${colors.borderWhisper}`,
          borderTopColor: colors.accentPetrol,
          animation: 'landingSpinner 0.7s linear infinite',
        }}
      />
      <style>{`
        @keyframes landingSpinner { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Main Landing Page ───────────────────────────────────────────

export function LandingPage() {
  const [variant, setVariant] = useState<HeroVariant | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Run variant assignment outside of render to handle SSR/StrictMode
    const v = getHeroVariant();
    setVariant(v);

    // PostHog registration
    posthog.register({ hero_variant: v });
    try {
      posthog.people.set({ hero_variant_first_seen: v });
    } catch {
      // people.set may fail if PostHog not fully initialised; non-blocking
    }

    trackLandingViewed(v);

    // Page metadata
    document.title = 'JobHub · The Australian Application Engine';
    const meta = document.querySelector('meta[name="description"]');
    const desc =
      'Find the exact gaps in your job application process and what to do about them. Free 3-minute diagnostic. Built for Australian graduates.';
    if (meta) {
      meta.setAttribute('content', desc);
    } else {
      const m = document.createElement('meta');
      m.name = 'description';
      m.content = desc;
      document.head.appendChild(m);
    }

    setReady(true);
  }, []);

  // Handle log in click tracking
  const handleLogInClick = () => {
    // import dynamically to avoid circular dependency
    import('../lib/analytics').then(({ trackLandingLogInClicked }) => {
      if (variant) trackLandingLogInClicked(variant);
    });
  };

  if (!ready || !variant) return <LoadingShell />;

  return (
    <div className="landing-page has-grain" style={{
      height: '100vh',
      overflowY: 'auto',
      background: colors.bgCanvas,
    }}>
      {/* ▸ Paper-noise texture via SVG filter ──────────────── */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id="noise-texture">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" seed="0" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="discrete" tableValues="0 0.11" />
          </feComponentTransfer>
        </filter>
      </svg>
      <div style={{ position: 'fixed', inset: 0, filter: 'url(#noise-texture)', mixBlendMode: 'multiply', pointerEvents: 'none', zIndex: 100 }} />

      <LandingNav onLogInClick={handleLogInClick} />
      <SectionTracker sectionId="hero" variant={variant}>
        <Hero variant={variant} />
      </SectionTracker>
      <SectionTracker sectionId="truths" variant={variant}>
        <ThreeTruths variant={variant} />
      </SectionTracker>
      <SectionTracker sectionId="proof" variant={variant}>
        <SocialProof />
      </SectionTracker>
      <SectionTracker sectionId="objection" variant={variant}>
        <ObjectionHandler />
      </SectionTracker>
      <SectionTracker sectionId="value" variant={variant}>
        <ValuePreview variant={variant} />
      </SectionTracker>
      <SectionTracker sectionId="risk" variant={variant}>
        <RiskReversal />
      </SectionTracker>
      <SectionTracker sectionId="cta" variant={variant}>
        <FinalCTA variant={variant} />
      </SectionTracker>
      <LandingFooter />
    </div>
  );
}
