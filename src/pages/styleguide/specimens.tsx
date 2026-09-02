import React from 'react';
import { warm } from '../../lib/theme/warmTokens';
import { proposed as P } from './proposed';

/* ── Specimens ─────────────────────────────────────────────────────────
   Two sets of the same parts.

   `Now*`  reproduces what the app renders today, values copied verbatim
           out of src/components/shared/* and out of the inline styles the
           inventory scan found in the pages. They take an explicit `state`
           so every state can be shown pinned, side by side, with no
           hovering. Where a value differs across the app the most common
           one was taken and the variance is called out in the guide.

   `Next*` implements the proposed system from ./proposed.ts.
*/

export type PinState = 'default' | 'hover' | 'pressed' | 'focus' | 'disabled' | 'loading';

/* ═══ NOW: buttons ═══════════════════════════════════════════════════ */

/** Mirrors src/components/shared/PrimaryButton.tsx exactly. */
export function NowPrimary({ state = 'default', small, label = 'Continue' }: { state?: PinState; small?: boolean; label?: string }) {
  const isDisabled = state === 'disabled' || state === 'loading';
  const base = '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)';
  const hover = '0 1px 2px rgba(26,24,20,0.06), 0 8px 24px rgba(45,90,110,0.22)';
  return (
    <button
      disabled={isDisabled}
      style={{
        background: isDisabled ? `${warm.colors.accentPetrol}80`
          : state === 'pressed' ? warm.colors.accentPetrolPressed
          : warm.colors.accentPetrol,
        color: warm.colors.textOnDeep,
        padding: small ? '10px 20px' : '14px 28px',
        borderRadius: warm.radius.button,
        border: 'none',
        fontWeight: 600,
        fontSize: small ? '0.875rem' : '0.9375rem',
        fontFamily: warm.type.fontBody,
        letterSpacing: '-0.005em',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        transform: state === 'hover' ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: isDisabled ? 'none'
          : state === 'focus' ? `0 0 0 3px ${warm.colors.ringFocus}, ${base}`
          : state === 'hover' ? hover
          : base,
        outline: 'none',
      }}
    >
      {state === 'loading' ? 'Loading…' : label}
    </button>
  );
}

/** Mirrors src/components/shared/SecondaryButton.tsx exactly. */
export function NowSecondary({ state = 'default', small, label = 'Not now' }: { state?: PinState; small?: boolean; label?: string }) {
  const disabled = state === 'disabled';
  return (
    <button
      disabled={disabled}
      style={{
        background: state === 'hover' || state === 'pressed' ? warm.colors.bgAlt : 'transparent',
        color: disabled ? warm.colors.textMuted : warm.colors.textPrimary,
        padding: small ? '9px 18px' : '13px 26px',
        borderRadius: warm.radius.button,
        border: `1px solid ${warm.colors.borderDefined}`,
        fontWeight: 600,
        fontSize: small ? '0.8125rem' : '0.9375rem',
        fontFamily: warm.type.fontBody,
        cursor: disabled ? 'not-allowed' : 'pointer',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
        outline: state === 'focus' ? `2px solid ${warm.colors.ringFocus}` : 'none',
        outlineOffset: 2,
      }}
    >
      {state === 'loading' ? 'Loading…' : label}
    </button>
  );
}

/** Mirrors src/components/shared/GhostButton.tsx exactly. */
export function NowGhost({ state = 'default', label = 'Skip' }: { state?: PinState; label?: string }) {
  const disabled = state === 'disabled';
  return (
    <button
      disabled={disabled}
      style={{
        background: 'transparent',
        border: 'none',
        color: disabled ? warm.colors.textMuted
          : state === 'hover' || state === 'pressed' ? warm.colors.textPrimary
          : warm.colors.textSecondary,
        padding: '8px 16px',
        borderRadius: warm.radius.button,
        fontWeight: 600,
        fontSize: '0.9375rem',
        fontFamily: warm.type.fontBody,
        cursor: disabled ? 'not-allowed' : 'pointer',
        lineHeight: 1,
        opacity: disabled ? 0.5 : 1,
        outline: state === 'focus' ? `2px solid ${warm.colors.ringFocus}` : 'none',
        outlineOffset: 2,
      }}
    >
      {label}
    </button>
  );
}

/** One of the 301 shapes found inline. This exact one appears in 3 files. */
export function NowStrayA({ label = 'Copy' }: { label?: string }) {
  return (
    <button style={{
      background: 'transparent', color: warm.colors.textMuted, borderRadius: 6,
      padding: '6px 12px', fontSize: 11, fontWeight: 700,
      border: `1px solid ${warm.colors.borderWhisper}`, fontFamily: warm.type.fontBody,
      cursor: 'pointer', lineHeight: 1,
    }}>{label}</button>
  );
}
/** Another stray: hardcoded indigo, ignores the token file entirely. */
export function NowStrayB({ label = 'Regenerate' }: { label?: string }) {
  return (
    <button style={{
      background: '#6366f1', color: '#fff', borderRadius: 8, padding: '6px 16px',
      fontSize: 12, fontWeight: 700, border: 'none', fontFamily: warm.type.fontBody,
      cursor: 'pointer', lineHeight: 1,
    }}>{label}</button>
  );
}
/** A third: 14px radius, 16px text, a different padding rhythm again. */
export function NowStrayC({ label = 'Start the check' }: { label?: string }) {
  return (
    <button style={{
      background: warm.colors.accentPetrol, color: warm.colors.textOnDeep, borderRadius: 14,
      padding: '15px 26px', fontSize: 16, fontWeight: 700, border: 'none',
      fontFamily: warm.type.fontBody, cursor: 'pointer', lineHeight: 1,
    }}>{label}</button>
  );
}

/* ═══ PROPOSED: one button, four variants, three sizes ═══════════════ */

export type NextVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type NextSize = 'sm' | 'md' | 'lg';

const SIZES: Record<NextSize, { h: number; padX: number; fs: number }> = {
  sm: { h: 32, padX: 12, fs: 13 },
  md: { h: 40, padX: 18, fs: 15 },
  lg: { h: 48, padX: 24, fs: 15 },
};

export function NextButton({
  variant = 'primary', size = 'md', state = 'default', label = 'Continue', icon,
}: {
  variant?: NextVariant; size?: NextSize; state?: PinState; label?: string; icon?: React.ReactNode;
}) {
  const s = SIZES[size];
  const off = state === 'disabled' || state === 'loading';

  const skin = (): React.CSSProperties => {
    if (variant === 'primary') {
      return {
        background: state === 'pressed' ? P.colors.accentPressed
          : state === 'hover' ? P.colors.accentHover
          : P.colors.accent,
        color: P.colors.onDeep,
        border: '1px solid transparent',
        boxShadow: state === 'pressed' ? P.shadow.none : P.shadow.soft,
      };
    }
    if (variant === 'secondary') {
      return {
        background: state === 'pressed' ? '#EDF0F5' : state === 'hover' ? P.colors.subtle : P.colors.surface,
        color: P.colors.ink,
        border: `1px solid ${P.colors.line}`,
        boxShadow: P.shadow.none,
      };
    }
    if (variant === 'danger') {
      return {
        background: state === 'pressed' ? '#8E1E17' : state === 'hover' ? '#9C211A' : P.colors.danger,
        color: P.colors.onDeep,
        border: '1px solid transparent',
        boxShadow: state === 'pressed' ? P.shadow.none : P.shadow.soft,
      };
    }
    return {
      background: state === 'pressed' ? '#EDF0F5' : state === 'hover' ? P.colors.subtle : 'transparent',
      color: state === 'default' ? P.colors.body : P.colors.ink,
      border: '1px solid transparent',
      boxShadow: P.shadow.none,
    };
  };

  return (
    <button
      disabled={off}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        height: s.h, padding: `0 ${s.padX}px`,
        borderRadius: P.radius.md,
        fontFamily: P.font, fontSize: s.fs, fontWeight: P.weight.semibold,
        letterSpacing: '-0.006em', lineHeight: 1, whiteSpace: 'nowrap',
        cursor: off ? 'not-allowed' : 'pointer',
        opacity: state === 'disabled' ? 0.45 : 1,
        outline: state === 'focus' ? `2px solid ${P.colors.ring}` : 'none',
        outlineOffset: 2,
        transition: `background ${P.motion.fast} ${P.motion.ease}, box-shadow ${P.motion.fast} ${P.motion.ease}`,
        ...skin(),
      }}
    >
      {state === 'loading' ? <Spinner size={s.fs} /> : icon}
      {state === 'loading' ? 'Working' : label}
    </button>
  );
}

export function Spinner({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, flexShrink: 0,
        border: `2px solid ${color}`, borderTopColor: 'transparent',
        borderRadius: '50%', display: 'inline-block',
        animation: 'sg-spin 700ms linear infinite',
      }}
    />
  );
}

/* ═══ Inputs ═════════════════════════════════════════════════════════ */

/** Mirrors src/components/shared/Input.tsx. */
export function NowInput({ state = 'default', value = '', placeholder = 'you@example.com' }: {
  state?: PinState | 'error' | 'filled'; value?: string; placeholder?: string;
}) {
  const error = state === 'error';
  const focused = state === 'focus';
  return (
    <div style={{ width: '100%' }}>
      <input
        readOnly
        value={state === 'filled' ? 'kiron@aussiegradcareers.com.au' : value}
        placeholder={placeholder}
        disabled={state === 'disabled'}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 15,
          fontFamily: warm.type.fontBody, color: warm.colors.textPrimary,
          background: warm.colors.bgSurface,
          border: `1px solid ${error ? warm.colors.danger : focused ? warm.colors.accentPetrol : warm.colors.borderDefined}`,
          borderRadius: warm.radius.input, outline: 'none',
          boxShadow: focused ? `0 0 0 3px ${warm.colors.ringFocus}, 0 0 0 1px ${warm.colors.accentPetrol}` : 'none',
        }}
      />
      {error && (
        <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: warm.colors.danger }}>
          Enter a valid email address
        </p>
      )}
    </div>
  );
}

export function NextInput({ state = 'default', label, placeholder = 'you@example.com', hint }: {
  state?: PinState | 'error' | 'filled'; label?: string; placeholder?: string; hint?: string;
}) {
  const error = state === 'error';
  const focused = state === 'focus';
  const off = state === 'disabled';
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label style={{
          display: 'block', marginBottom: 6, fontFamily: P.font, fontSize: 13,
          fontWeight: P.weight.semibold, color: P.colors.ink,
        }}>{label}</label>
      )}
      <input
        readOnly
        disabled={off}
        value={state === 'filled' ? 'kiron@aussiegradcareers.com.au' : ''}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box', height: 40, padding: '0 12px',
          fontFamily: P.font, fontSize: P.text.body.fontSize, fontWeight: P.weight.regular,
          color: off ? P.colors.muted : P.colors.ink,
          background: off ? P.colors.subtle : P.colors.surface,
          border: `1px solid ${error ? P.colors.danger : focused ? P.colors.accent : P.colors.line}`,
          borderRadius: P.radius.md, outline: 'none',
          boxShadow: focused ? `0 0 0 3px ${P.colors.ring}` : 'none',
          transition: `border-color ${P.motion.fast} ${P.motion.ease}, box-shadow ${P.motion.fast} ${P.motion.ease}`,
        }}
      />
      {(hint || error) && (
        <p style={{
          margin: '6px 0 0', fontFamily: P.font, fontSize: P.text.small.fontSize, lineHeight: 1.45,
          color: error ? P.colors.danger : P.colors.muted,
        }}>
          {error ? 'Enter a valid email address' : hint}
        </p>
      )}
    </div>
  );
}
