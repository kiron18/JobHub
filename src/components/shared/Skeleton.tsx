import React from 'react';
import { warm } from '../../lib/theme/warmTokens';

/* ── Skeleton ──────────────────────────────────────────────────────────
   There was no skeleton anywhere in the app: long waits showed a spinner
   or a blank screen. A skeleton is not decoration, it is a promise about
   the shape of what is coming, so these are sized to the real content
   they stand in for rather than being generic grey bars.

   The shimmer runs left to right in 1.4s. Slower reads as broken, faster
   reads as anxious.
*/

const SHIMMER_KEYFRAMES = `
@keyframes jh-shimmer {
  0%   { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}`;

let injected = false;
function ensureKeyframes() {
  if (injected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = SHIMMER_KEYFRAMES;
  document.head.appendChild(el);
  injected = true;
}

export function Skeleton({
  width = '100%', height = 12, radius = 5, style,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  ensureKeyframes();
  return (
    <span
      aria-hidden
      style={{
        display: 'block', width, height, borderRadius: radius,
        background: `linear-gradient(90deg, ${warm.colors.bgAlt} 25%, #EDF1F6 37%, ${warm.colors.bgAlt} 63%)`,
        backgroundSize: '400% 100%',
        animation: 'jh-shimmer 1.4s ease infinite',
        ...style,
      }}
    />
  );
}

/** A paragraph-shaped skeleton. The last line is short, like real text. */
export function SkeletonText({ lines = 3, style }: { lines?: number; style?: React.CSSProperties }) {
  const widths = ['100%', '94%', '88%', '96%', '72%'];
  return (
    <div style={{ display: 'grid', gap: 8, ...style }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '64%' : widths[i % widths.length]} height={11} />
      ))}
    </div>
  );
}

/** Stands in for a Card while its contents load. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{
      background: warm.colors.bgSurface,
      border: `1px solid ${warm.colors.borderWhisper}`,
      borderRadius: warm.radius.card,
      padding: 20,
    }}>
      <Skeleton width="45%" height={15} style={{ marginBottom: 14 }} />
      <SkeletonText lines={lines} />
    </div>
  );
}

/** Stands in for a tracker or document row. */
export function SkeletonRow() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '13px 12px',
      borderBottom: `1px solid ${warm.colors.borderWhisper}`,
    }}>
      <Skeleton width="30%" height={13} />
      <Skeleton width="22%" height={12} />
      <Skeleton width={72} height={22} radius={6} style={{ marginLeft: 'auto' }} />
    </div>
  );
}
