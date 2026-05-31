import React, { useState, useEffect, useRef } from 'react';
import { colors, type } from '../landing/tokens';

interface Props {
  onSearch: (q: string) => void;
  defaultValue?: string;
}

export function SponsorSearchBar({ onSearch, defaultValue = '' }: Props) {
  const [value, setValue] = useState(defaultValue);

  // Keep the latest onSearch without making it a deps trigger (it's recreated
  // on every parent render).
  const onSearchRef = useRef(onSearch);
  useEffect(() => { onSearchRef.current = onSearch; });

  // Live search — fire as the user types, debounced so results feel instant
  // without hammering the API. Skip the very first run (initial mount already
  // loads the unfiltered list).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => onSearchRef.current(value), 200);
    return () => clearTimeout(t);
  }, [value]);

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
