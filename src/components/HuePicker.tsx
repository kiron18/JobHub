import { useState, useEffect, useRef } from 'react';
import { Palette } from 'lucide-react';
import type { PaletteName } from '../styles/tokens';
import { PALETTES, applyPalette } from '../styles/tokens';

const STORAGE_KEY = 'jobhub_palette';
const LEGACY_KEY  = 'jobhub_brand_hue';

// Best-effort mapping from old hue integers to named palette
const LEGACY_HUE_TO_PALETTE: Partial<Record<number, PaletteName>> = {
  220: 'Ocean',
  158: 'Sage',
  24:  'Ember',
  322: 'Rose',
  262: 'Violet',
};

function getInitialPalette(): PaletteName {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored in PALETTES) return stored as PaletteName;

  // Migrate from legacy hue key
  const legacyRaw = localStorage.getItem(LEGACY_KEY);
  if (legacyRaw) {
    const hue = parseInt(legacyRaw, 10);
    const migrated = LEGACY_HUE_TO_PALETTE[hue] ?? 'Ocean';
    localStorage.setItem(STORAGE_KEY, migrated);
    return migrated;
  }

  return 'Ocean';
}

export function HuePicker({ isDark }: { isDark: boolean }) {
  const [open, setOpen]       = useState(false);
  const [palette, setPalette] = useState<PaletteName>(getInitialPalette);
  const ref = useRef<HTMLDivElement>(null);

  // Apply on mount
  useEffect(() => { applyPalette(palette); }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function setAndPersist(name: PaletteName) {
    setPalette(name);
    applyPalette(name);
    localStorage.setItem(STORAGE_KEY, name);
    setOpen(false);
  }

  const bgColor     = isDark ? 'rgba(15,20,30,0.92)' : 'rgba(255,255,255,0.95)';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const labelColor  = isDark ? '#6b7280' : '#9ca3af';
  const iconColor   = isDark ? '#9ca3af' : '#6b7280';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Change accent colour"
        title="Accent colour"
        style={{
          width: 40, height: 40, borderRadius: 99,
          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', backdropFilter: 'blur(8px)', transition: 'background 0.2s',
        }}
      >
        <Palette size={15} color={iconColor} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 48, right: -100,
          width: 220, borderRadius: 16, padding: '16px',
          background: bgColor, border: `1px solid ${borderColor}`,
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          zIndex: 100,
        }}>
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: labelColor, marginBottom: 12,
            margin: '0 0 12px 0',
          }}>
            Accent colour
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {(Object.entries(PALETTES) as [PaletteName, typeof PALETTES[PaletteName]][]).map(([name, p]) => {
              const isSelected = palette === name;
              return (
                <button
                  key={name}
                  onClick={() => setAndPersist(name)}
                  title={name}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '6px 4px', borderRadius: 8,
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: p.accent,
                    outline: isSelected ? `2px solid ${p.accent}` : 'none',
                    outlineOffset: 2,
                    transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 0.15s',
                  }} />
                  <span style={{
                    fontSize: 9, fontWeight: 600,
                    color: isSelected ? p.accent : labelColor,
                    letterSpacing: '0.03em',
                  }}>
                    {name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
