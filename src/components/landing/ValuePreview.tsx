import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { colors, type as typeTokens } from './tokens';
import { Eyebrow } from './shared/Eyebrow';
import { PrimaryCTA } from './shared/PrimaryCTA';
import type { HeroVariant } from '../../lib/landingVariant';
import { trackLandingCtaClicked } from '../../lib/analytics';

// ── Bucket data ─────────────────────────────────────────────────

const BUCKETS = [
  {
    name: 'End-to-End Application System',
    outcome: 'High-quality, tailored applications in under 3 minutes.',
    inside: 'JD analysis · Resume generator · Cover letter generator · Application tracker · Follow-up templates · Interview prep',
    placeholderCaption: 'Sample: tailored cover letter generated in 47 seconds',
  },
  {
    name: 'Hidden Job Market Access',
    outcome: 'Get noticed before jobs are posted publicly.',
    inside: 'LinkedIn optimiser · LinkedIn profile generator · Outreach templates',
    placeholderCaption: 'Sample: before/after LinkedIn profile rewrite',
  },
  {
    name: 'Smart Job Matching',
    outcome: 'Apply to jobs you can actually get.',
    inside: 'Matching scores · Gap analysis · Job recommendations',
    placeholderCaption: 'Sample: match-score card with reasons',
  },
];

// ── Spotlight card ──────────────────────────────────────────────

function SpotlightCard({ variant }: { variant: HeroVariant }) {
  const handleCta = () => {
    trackLandingCtaClicked('spotlight', variant);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
      style={{
        background: colors.bgSurface,
        border: `1px solid ${colors.accentGoldSoft}`,
        borderRadius: 20,
        padding: 40,
        boxShadow:
          '0 1px 3px rgba(26,24,20,0.04), 0 6px 20px rgba(26,24,20,0.06), 0 18px 48px rgba(26,24,20,0.04)',
        marginBottom: 48,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '60% 1fr',
          gap: 48,
          alignItems: 'start',
        }}
      >
        {/* Left: copy */}
        <div>
          {/* Free badge */}
          <span
            style={{
              display: 'inline-block',
              borderRadius: 9999,
              padding: '4px 12px',
              background: colors.accentGoldSoft,
              color: '#8B6E32',
              fontFamily: typeTokens.body,
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            START HERE · IT'S FREE
          </span>

          <h3
            style={{
              fontFamily: typeTokens.display,
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: '-0.015em',
              color: colors.textPrimary,
              margin: '16px 0 0',
              fontVariationSettings: "'SOFT' 50, 'WONK' 1",
            }}
          >
            The diagnostic, on us.
          </h3>

          <p
            style={{
              fontFamily: typeTokens.body,
              fontSize: '1.0625rem',
              lineHeight: 1.65,
              color: colors.textSecondary,
              maxWidth: 480,
              margin: '16px 0 0',
            }}
          >
            Run a 3-minute review and walk away with a personalised report - what's
            broken in your search, why it's happening, and the next move for each
            problem. Yours to keep. No card. No upsell wall.
          </p>

          <p
            style={{
              fontFamily: typeTokens.body,
              fontSize: '0.875rem',
              fontStyle: 'italic',
              color: colors.textMuted,
              maxWidth: 480,
              margin: '20px 0 0',
              lineHeight: 1.5,
            }}
          >
            Career coaches charge $300–$500 for the equivalent in a one-hour Zoom
            call. We give it to you free because we want you to see what we've built
            before you decide anything.
          </p>

          <div style={{ marginTop: 28 }}>
            <PrimaryCTA
              label="Run the diagnostic →"
              onClick={handleCta}
              small
            />
          </div>
        </div>

        {/* Right: report preview placeholder */}
        <div
          style={{
            aspectRatio: '4 / 5',
            background: colors.bgAlt,
            border: `1px solid ${colors.borderWhisper}`,
            borderRadius: 12,
            padding: 20,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* "Your personalised diagnosis" badge */}
          <div
            style={{
              display: 'inline-flex',
              alignSelf: 'flex-start',
              borderRadius: 9999,
              padding: '4px 10px',
              background: colors.bgCanvas,
              border: `1px solid ${colors.borderWhisper}`,
              fontFamily: typeTokens.body,
              fontSize: '0.75rem',
              fontWeight: 600,
              color: colors.textPrimary,
              marginBottom: 16,
            }}
          >
            Your personalised diagnosis
          </div>

          {/* FileText icon */}
          <FileText
            size={32}
            color={colors.accentPetrol}
            strokeWidth={1.5}
            style={{ marginBottom: 16 }}
          />

          {/* Text line placeholders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            {[90, 75, 85, 60, 70, 80, 50].map((widthPct, i) => (
              <div
                key={i}
                style={{
                  height: 4,
                  width: `${widthPct}%`,
                  background: colors.textMuted,
                  opacity: 0.2,
                  borderRadius: 2,
                }}
              />
            ))}
          </div>

          {/* Bottom-right metadata */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 6,
              marginTop: 12,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: colors.accentGold,
              }}
            />
            <span
              style={{
                fontFamily: typeTokens.body,
                fontSize: '0.6875rem',
                color: colors.textMuted,
              }}
            >
              Section 3 of 8
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          section#value > div > div:first-child > div > div { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          section#value > div > div:first-child > div > div { padding: 28px; }
          section#value > div > div:first-child > div > div > div:last-child { order: -1; }
        }
      `}</style>
    </motion.div>
  );
}

// ── Bucket card ─────────────────────────────────────────────────

function BucketCard({ bucket, index }: { bucket: typeof BUCKETS[number]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.25, 1, 0.5, 1],
      }}
      whileHover={{
        y: -2,
        boxShadow:
          '0 1px 3px rgba(26,24,20,0.04), 0 6px 20px rgba(26,24,20,0.06), 0 18px 48px rgba(26,24,20,0.04)',
      }}
      style={{
        background: colors.bgSurface,
        border: `1px solid ${colors.borderWhisper}`,
        borderRadius: 16,
        padding: 32,
        boxShadow:
          '0 1px 2px rgba(26,24,20,0.04), 0 4px 16px rgba(26,24,20,0.04)',
        transition: 'transform 180ms ease, box-shadow 180ms ease',
      }}
    >
      {/* Visual placeholder */}
      <div
        style={{
          aspectRatio: '16 / 9',
          background: colors.bgAlt,
          border: `1px solid ${colors.borderWhisper}`,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: typeTokens.body,
            fontSize: '0.8125rem',
            color: colors.textMuted,
            textAlign: 'center',
            padding: '0 16px',
          }}
        >
          {bucket.placeholderCaption}
        </span>
      </div>

      {/* Bucket name */}
      <h3
        style={{
          fontFamily: typeTokens.display,
          fontSize: '1.5rem',
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.01em',
          color: colors.textPrimary,
          margin: '24px 0 0',
          fontVariationSettings: "'SOFT' 50, 'WONK' 1",
        }}
      >
        {bucket.name}
      </h3>

      {/* Outcome line */}
      <p
        style={{
          fontFamily: typeTokens.body,
          fontSize: '1rem',
          fontWeight: 500,
          color: colors.accentPetrol,
          margin: '8px 0 0',
        }}
      >
        {bucket.outcome}
      </p>

      {/* What's inside */}
      <p
        style={{
          fontFamily: typeTokens.body,
          fontSize: '0.875rem',
          color: colors.textSecondary,
          margin: '16px 0 0',
          lineHeight: 1.55,
        }}
      >
        {bucket.inside}
      </p>
    </motion.div>
  );
}

// ── Section ─────────────────────────────────────────────────────

interface ValuePreviewProps {
  variant: HeroVariant;
}

export function ValuePreview({ variant }: ValuePreviewProps) {
  return (
    <section id="value" style={{ background: colors.bgCanvas }}>
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '120px 24px',
        }}
      >
        <Eyebrow>WHAT'S INSIDE</Eyebrow>

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
          Everything you need
          <br />
          to actually land the job.
        </h2>

        <p
          style={{
            fontFamily: typeTokens.body,
            fontSize: '1.125rem',
            lineHeight: 1.6,
            color: colors.textSecondary,
            maxWidth: 640,
            margin: '16px auto 0',
            textAlign: 'center',
          }}
        >
          Three engines. One system. Built for the way Australian hiring actually
          works.
        </p>

        {/* Spotlight card - appears above the 3-bucket grid */}
        <div style={{ marginTop: 48 }}>
          <SpotlightCard variant={variant} />
        </div>

        {/* 3-bucket grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 24,
          }}
        >
          {BUCKETS.map((bucket, i) => (
            <BucketCard key={i} bucket={bucket} index={i} />
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          section#value > div > div:last-child { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 768px) {
          section#value > div > div:last-child { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          section#value > div { padding: 72px 20px; }
          section#value > div > div:first-child > div { padding: 28px; }
        }
      `}</style>
    </section>
  );
}
