import { useRef } from 'react';
import { warm } from '../../lib/theme/warmTokens';

interface InputProps {
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  autoFocus?: boolean;
  required?: boolean;
}

export function Input({ placeholder, value, onChange, type = 'text', error, autoFocus, required }: InputProps) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div>
      <input
        ref={ref}
        type={type}
        value={value}
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={e => {
          e.currentTarget.style.borderColor = warm.colors.accentPetrol;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${warm.colors.ringFocus}, 0 0 0 1px ${warm.colors.accentPetrol}`;
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = error ? warm.colors.danger : warm.colors.borderDefined;
          e.currentTarget.style.boxShadow = 'none';
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '12px 14px',
          fontSize: 15,
          fontFamily: warm.type.fontBody,
          color: warm.colors.textPrimary,
          background: warm.colors.bgSurface,
          border: `1px solid ${error ? warm.colors.danger : warm.colors.borderDefined}`,
          borderRadius: warm.radius.input,
          outline: 'none',
          transition: 'border-color 200ms, box-shadow 200ms',
        }}
      />
      {error && (
        <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: warm.colors.danger }}>
          {error}
        </p>
      )}
    </div>
  );
}
