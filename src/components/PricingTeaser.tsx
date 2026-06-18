// PAYMENTS PAUSED: component disabled during pricing rework
// Component temporarily returns null to hide all pricing teasers
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function PricingTeaser(_props: { source?: string; variant?: 'full' | 'compact' | 'inline' }) {
  return null;
}

/* ORIGINAL CODE - restore when payments resume
import posthog from 'posthog-js';
import { useNavigate } from 'react-router-dom';
import { warm } from '../lib/theme/warmTokens';

type Variant = 'full' | 'compact' | 'inline';

interface Props {
  source: string;
  variant?: Variant;
}

const FULL = `Your diagnostic is yours to keep, free. If you want to act on what it found, three months of full access is $197 — Afterpay splits that into four payments.`;
const COMPACT = `Tailored documents for this role unlock with 3-Month Access. $65 a month.`;
const INLINE = `3-Month Access — $65 a month`;
const AFTERPAY_INLINE = `Afterpay available`;

const LINES: Record<Variant, { body: string; afterpay?: string }> = {
  full: { body: FULL },
  compact: { body: COMPACT },
  inline: { body: INLINE, afterpay: AFTERPAY_INLINE },
};

export function PricingTeaser({ source, variant = 'full' }: Props) {
  const navigate = useNavigate();
  const line = LINES[variant];

  function handleClick() {
    posthog.capture('pricing_teaser_click', { source, variant });
    navigate('/pricing');
  }

  if (variant === 'inline') {
    return (
      <button
        onClick={handleClick}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: 13,
          fontWeight: 700,
          color: warm.colors.accentPetrol,
          lineHeight: 1.5,
        }}
      >
        {line.body}
        {line.afterpay && (
          <span style={{ fontWeight: 400, color: warm.colors.textMuted }}> &middot; {line.afterpay}</span>
        )}
      </button>
    );
  }

  return (
    <div
      style={{
        padding: variant === 'full' ? '20px 24px' : '14px 18px',
        borderRadius: 12,
        background: `${warm.colors.accentPetrol}0D`,
        border: `1px solid ${warm.colors.accentPetrol}28`,
      }}
    >
      <button
        onClick={handleClick}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: variant === 'full' ? 14 : 13,
          fontWeight: 400,
          color: warm.colors.textSecondary,
          lineHeight: 1.6,
        }}
      >
        {line.body}
        {' '}
        <span style={{ fontWeight: 700, color: warm.colors.accentPetrol, whiteSpace: 'nowrap' }}>
          See plans &rarr;
        </span>
      </button>
      {variant === 'full' && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: warm.colors.textMuted }}>
          Afterpay and Zip are supported at checkout.
        </p>
      )}
    </div>
  );
}
*/
