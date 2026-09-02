import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { warm } from '../../lib/theme/warmTokens';
import { SPRING, t, DUR, EASE } from '../../lib/theme/motion';

/* ── Form controls ─────────────────────────────────────────────────────
   None of these existed as shared components, which is why the onboarding
   intake, the answer bank, the tracker filters and the document editor
   each grew their own. They share the input's height, radius and focus
   ring so a form built from them lines up without anyone measuring.

   The checkbox and the toggle are the only two that move. Both use the
   same spring as a button press, so ticking a box feels like the same
   product as pressing a button.
*/

/* ── Textarea ────────────────────────────────────────────────────────── */

export function Textarea({
  value, onChange, placeholder, label, hint, error, rows = 4, disabled, maxLength, style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  hint?: string;
  error?: string;
  rows?: number;
  disabled?: boolean;
  maxLength?: number;
  style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  const over = maxLength != null && value.length > maxLength;

  return (
    <div style={{ width: '100%' }}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <textarea
        value={value}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '10px 12px', resize: 'vertical',
          fontSize: warm.text.body.fontSize, lineHeight: 1.55,
          fontFamily: warm.type.fontBody,
          color: disabled ? warm.colors.textMuted : warm.colors.textPrimary,
          background: disabled ? warm.colors.bgAlt : warm.colors.bgSurface,
          border: `1px solid ${error || over ? warm.colors.danger : focused ? warm.colors.accentPetrol : warm.colors.borderDefined}`,
          borderRadius: warm.radius.input,
          outline: 'none',
          boxShadow: focused && !error ? `0 0 0 3px ${warm.colors.ringFocus}` : 'none',
          transition: t(['border-color', 'box-shadow'], DUR.fast),
          ...style,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6 }}>
        <span style={{
          fontFamily: warm.type.fontBody, ...warm.text.small,
          color: error ? warm.colors.danger : warm.colors.textMuted,
        }}>
          {error || hint}
        </span>
        {maxLength != null && (
          <span style={{
            fontFamily: warm.type.fontBody, fontSize: 12, flexShrink: 0,
            color: over ? warm.colors.danger : warm.colors.textMuted,
            fontWeight: over ? warm.weight.semibold : warm.weight.regular,
          }}>
            {value.length} / {maxLength}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Select ──────────────────────────────────────────────────────────── */

export function Select({
  value, onChange, options, label, hint, disabled, style,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  label?: string;
  hint?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ width: '100%' }}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <select
        value={value}
        disabled={disabled}
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
          border: `1px solid ${focused ? warm.colors.accentPetrol : warm.colors.borderDefined}`,
          borderRadius: warm.radius.input,
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: focused ? `0 0 0 3px ${warm.colors.ringFocus}` : 'none',
          transition: t(['border-color', 'box-shadow'], DUR.fast),
          ...style,
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p style={{ margin: '6px 0 0', fontFamily: warm.type.fontBody, ...warm.text.small, color: warm.colors.textMuted }}>{hint}</p>}
    </div>
  );
}

/* ── Checkbox ────────────────────────────────────────────────────────── */

export function Checkbox({
  checked, onChange, label, description, disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <motion.label
      whileTap={disabled ? undefined : { scale: 0.99 }}
      transition={SPRING.tap}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      <motion.span
        animate={{
          background: checked ? warm.colors.accentPetrol : warm.colors.bgSurface,
          borderColor: checked ? warm.colors.accentPetrol : warm.colors.borderDefined,
        }}
        transition={{ duration: DUR.fast, ease: EASE.out }}
        style={{
          width: 18, height: 18, flexShrink: 0, marginTop: 1,
          borderRadius: 6, borderWidth: 1, borderStyle: 'solid',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <AnimatePresence>
          {checked && (
            <motion.svg
              key="tick" width={11} height={11} viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE.out }}
            >
              <motion.path d="M20 6 9 17l-5-5" />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.span>
      <span>
        <span style={{ display: 'block', fontFamily: warm.type.fontBody, fontSize: 14, color: warm.colors.textPrimary, lineHeight: 1.45 }}>
          {label}
        </span>
        {description && (
          <span style={{ display: 'block', fontFamily: warm.type.fontBody, ...warm.text.small, color: warm.colors.textMuted, marginTop: 2 }}>
            {description}
          </span>
        )}
      </span>
    </motion.label>
  );
}

/* ── Radio ───────────────────────────────────────────────────────────── */

export function Radio({
  selected, onSelect, label, description, disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  label: React.ReactNode;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <motion.label
      onClick={disabled ? undefined : onSelect}
      whileTap={disabled ? undefined : { scale: 0.99 }}
      transition={SPRING.tap}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <motion.span
        animate={{ borderColor: selected ? warm.colors.accentPetrol : warm.colors.borderDefined }}
        transition={{ duration: DUR.fast, ease: EASE.out }}
        style={{
          width: 18, height: 18, flexShrink: 0, marginTop: 1,
          borderRadius: '50%', borderWidth: 1, borderStyle: 'solid',
          background: warm.colors.bgSurface,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <AnimatePresence>
          {selected && (
            <motion.span
              key="dot"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={SPRING.arrive}
              style={{ width: 9, height: 9, borderRadius: '50%', background: warm.colors.accentPetrol }}
            />
          )}
        </AnimatePresence>
      </motion.span>
      <span>
        <span style={{ display: 'block', fontFamily: warm.type.fontBody, fontSize: 14, color: warm.colors.textPrimary, lineHeight: 1.45 }}>
          {label}
        </span>
        {description && (
          <span style={{ display: 'block', fontFamily: warm.type.fontBody, ...warm.text.small, color: warm.colors.textMuted, marginTop: 2 }}>
            {description}
          </span>
        )}
      </span>
    </motion.label>
  );
}

/* ── Toggle ──────────────────────────────────────────────────────────── */

export function Toggle({
  on, onChange, label, disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    }}>
      <motion.span
        onClick={() => !disabled && onChange(!on)}
        whileTap={disabled ? undefined : { scale: 0.95 }}
        animate={{ background: on ? warm.colors.accentPetrol : '#CBD3DF' }}
        transition={{ duration: DUR.fast, ease: EASE.out }}
        style={{
          width: 40, height: 24, borderRadius: 999, flexShrink: 0,
          padding: 3, boxSizing: 'border-box',
          display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start',
        }}
      >
        <motion.span
          layout
          transition={SPRING.arrive}
          style={{
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            boxShadow: '0 1px 2px rgba(16,24,40,0.20)',
          }}
        />
      </motion.span>
      {label && (
        <span style={{ fontFamily: warm.type.fontBody, fontSize: 14, color: warm.colors.textPrimary }}>{label}</span>
      )}
    </label>
  );
}

/* ── Shared label ────────────────────────────────────────────────────── */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', marginBottom: 6,
      fontFamily: warm.type.fontBody, fontSize: 13,
      fontWeight: warm.weight.semibold, color: warm.colors.textPrimary,
    }}>
      {children}
    </label>
  );
}
