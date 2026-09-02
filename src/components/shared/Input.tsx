import React, { useRef, useState, useEffect } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { warm } from '../../lib/theme/warmTokens';
import { t, DUR, EASE, prefersReducedMotion } from '../../lib/theme/motion';

/* ── Input ─────────────────────────────────────────────────────────────
   The one text field. Fixed 40px height so it lines up with a button of
   the same size, a real label and hint slot so forms stop hand-building
   those, and a disabled state that did not exist before.

   When an error arrives the field shakes once. It is 420ms, lateral and
   damped: the deliberate opposite of the success spring, because the two
   must never be confusable out of the corner of your eye.
*/

interface InputProps {
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  autoFocus?: boolean;
  required?: boolean;
  label?: string;
  hint?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  style?: React.CSSProperties;
}

export function Input({
  placeholder, value, onChange, type = 'text', error, autoFocus, required,
  label, hint, disabled, onKeyDown, style,
}: InputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const controls = useAnimationControls();
  const seen = useRef<string | undefined>(undefined);

  // Shake on the transition into an error, not on every render while one stands.
  useEffect(() => {
    if (error && error !== seen.current && !prefersReducedMotion()) {
      controls.start({ x: [0, -7, 6, -4, 2, 0], transition: { duration: 0.42, ease: EASE.inOut } });
    }
    seen.current = error;
  }, [error, controls]);

  return (
    <motion.div animate={controls} style={{ width: '100%' }}>
      {label && (
        <label style={{
          display: 'block', marginBottom: 6,
          fontFamily: warm.type.fontBody, fontSize: 13,
          fontWeight: warm.weight.semibold, color: warm.colors.textPrimary,
        }}>
          {label}
          {required && <span style={{ color: warm.colors.danger, marginLeft: 3 }}>*</span>}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        value={value}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', boxSizing: 'border-box',
          height: 40, padding: '0 12px',
          fontSize: warm.text.body.fontSize,
          fontFamily: warm.type.fontBody,
          color: disabled ? warm.colors.textMuted : warm.colors.textPrimary,
          background: disabled ? warm.colors.bgAlt : warm.colors.bgSurface,
          border: `1px solid ${error ? warm.colors.danger : focused ? warm.colors.accentPetrol : warm.colors.borderDefined}`,
          borderRadius: warm.radius.input,
          outline: 'none',
          boxShadow: focused && !error ? `0 0 0 3px ${warm.colors.ringFocus}` : 'none',
          transition: t(['border-color', 'box-shadow', 'background'], DUR.fast),
          ...style,
        }}
      />
      {(error || hint) && (
        <p style={{
          margin: '6px 0 0', fontFamily: warm.type.fontBody,
          ...warm.text.small,
          color: error ? warm.colors.danger : warm.colors.textMuted,
        }}>
          {error || hint}
        </p>
      )}
    </motion.div>
  );
}
