import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { warm } from '../../lib/theme/warmTokens';
import { SPRING, t, DUR } from '../../lib/theme/motion';

/* ── Button ────────────────────────────────────────────────────────────
   One button. Four variants, three sizes, every state defined here rather
   than at 301 call sites.

   The tactile part is deliberate and small: 0.97 on press, released on a
   stiff spring. It is under 100ms of travel, which is enough for a finger
   or a cursor to register contact and not enough to read as an animation.
   Every pressable thing in the product does the same thing, so pressing
   feels like one product rather than thirty.
*/

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const SIZES: Record<ButtonSize, { h: number; padX: number; fs: number; gap: number }> = {
  sm: { h: 32, padX: 12, fs: 13, gap: 6 },
  md: { h: 40, padX: 18, fs: 15, gap: 7 },
  lg: { h: 48, padX: 24, fs: 15, gap: 8 },
};

export interface ButtonProps {
  children?: React.ReactNode;
  /** Alias for children, so the old PrimaryButton call sites keep working. */
  label?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Text shown while loading. Defaults to the label, so the width does not jump. */
  loadingLabel?: string;
  icon?: React.ReactNode;
  iconAfter?: React.ReactNode;
  full?: boolean;
  type?: 'button' | 'submit';
  title?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
}

export function Button({
  children, label, onClick, variant = 'primary', size = 'md',
  disabled, loading, loadingLabel, icon, iconAfter, full,
  type = 'button', title, ariaLabel, style,
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const s = SIZES[size];
  const off = disabled || loading;

  const skin = ((): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: hover && !off ? warm.colors.accentPetrolHover : warm.colors.accentPetrol,
          color: warm.colors.textOnDeep,
          border: '1px solid transparent',
          boxShadow: off ? 'none' : warm.shadow.soft,
        };
      case 'secondary':
        return {
          background: hover && !off ? warm.colors.bgAlt : warm.colors.bgSurface,
          color: warm.colors.textPrimary,
          border: `1px solid ${warm.colors.borderDefined}`,
          boxShadow: 'none',
        };
      case 'danger':
        return {
          background: hover && !off ? '#9C211A' : warm.colors.danger,
          color: warm.colors.textOnDeep,
          border: '1px solid transparent',
          boxShadow: off ? 'none' : warm.shadow.soft,
        };
      case 'ghost':
      default:
        return {
          background: hover && !off ? warm.colors.bgAlt : 'transparent',
          color: hover && !off ? warm.colors.textPrimary : warm.colors.textSecondary,
          border: '1px solid transparent',
          boxShadow: 'none',
        };
    }
  })();

  const body = loading ? (loadingLabel ?? label ?? children) : (children ?? label);

  return (
    <motion.button
      type={type}
      title={title}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      disabled={off}
      onClick={onClick}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      whileTap={off ? undefined : { scale: size === 'lg' ? 0.985 : 0.97 }}
      transition={SPRING.tap}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: s.gap,
        height: s.h,
        padding: `0 ${s.padX}px`,
        width: full ? '100%' : undefined,
        borderRadius: warm.radius.button,
        fontFamily: warm.type.fontBody,
        fontSize: s.fs,
        fontWeight: warm.weight.semibold,
        letterSpacing: '-0.006em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        cursor: off ? (loading ? 'wait' : 'not-allowed') : 'pointer',
        opacity: disabled && !loading ? 0.45 : 1,
        outline: focus ? `2px solid ${warm.colors.ringFocus}` : 'none',
        outlineOffset: 2,
        transition: t(['background', 'color', 'border-color', 'box-shadow'], DUR.fast),
        ...skin,
        ...style,
      }}
    >
      {loading ? <Spinner size={s.fs} /> : icon}
      {body}
      {!loading && iconAfter}
    </motion.button>
  );
}

/** The one spinner. Sized to sit on a text baseline without shifting it. */
export function Spinner({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <motion.span
      aria-hidden
      animate={{ rotate: 360 }}
      transition={{ duration: 0.7, ease: 'linear', repeat: Infinity }}
      style={{
        width: size, height: size, flexShrink: 0, display: 'inline-block',
        border: `2px solid ${color}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        opacity: 0.9,
      }}
    />
  );
}

/** A square button that holds only an icon. Same press feel, no label. */
export function IconButton({
  children, onClick, label, size = 32, tone = 'muted', disabled, style,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Required: an icon with no accessible name is invisible to a screen reader. */
  label: string;
  size?: number;
  tone?: 'muted' | 'strong' | 'danger';
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const [hover, setHover] = useState(false);
  const colour = tone === 'danger' ? warm.colors.danger
    : tone === 'strong' ? warm.colors.textPrimary
    : hover ? warm.colors.textPrimary : warm.colors.textMuted;

  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={SPRING.tap}
      style={{
        width: size, height: size, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: hover && !disabled ? warm.colors.bgAlt : 'transparent',
        border: 'none',
        borderRadius: warm.radius.input,
        color: colour,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: t(['background', 'color'], DUR.fast),
        ...style,
      }}
    >
      {children}
    </motion.button>
  );
}
