import React, { useState } from 'react';
import { colors, type } from '../landing/tokens';

interface Props {
  onSearch: (q: string) => void;
  defaultValue?: string;
}

export function SponsorSearchBar({ onSearch, defaultValue = '' }: Props) {
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch(value);
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 640, margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        gap: 0,
        background: colors.bgSurface,
        border: `1.5px solid ${colors.borderDefined}`,
        borderRadius: 12,
        overflow: 'hidden',
        transition: 'border-color 180ms ease',
      }}
        onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = colors.accentPetrol; }}
        onBlurCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = colors.borderDefined; }}
      >
        <input
          type="text"
          placeholder="Search companies or hiring profiles..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{
            flex: 1,
            padding: '14px 20px',
            border: 'none',
            outline: 'none',
            fontSize: 15,
            fontFamily: type.body,
            background: 'transparent',
            color: colors.textPrimary,
          }}
        />
        <button
          type="submit"
          style={{
            padding: '14px 24px',
            border: 'none',
            background: colors.accentPetrol,
            color: colors.textOnDeep,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: type.body,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Search
        </button>
      </div>
    </form>
  );
}
