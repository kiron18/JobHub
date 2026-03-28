import { useState, useEffect, useRef } from 'react';
import { Palette } from 'lucide-react';

const PRESETS = [
  { label: 'Indigo',  hue: 262, color: 'oklch(58% 0.21 262)' },
  { label: 'Violet',  hue: 290, color: 'oklch(58% 0.21 290)' },
  { label: 'Teal',    hue: 185, color: 'oklch(58% 0.18 185)' },
  { label: 'Emerald', hue: 155, color: 'oklch(58% 0.18 155)' },
  { label: 'Amber',   hue: 75,  color: 'oklch(58% 0.18 75)'  },
  { label: 'Rose',    hue: 10,  color: 'oklch(58% 0.21 10)'  },
];

const STORAGE_KEY = 'jobhub_brand_hue';

function applyHue(hue: number) {
  document.documentElement.style.setProperty('--brand-hue', String(hue));
}

export function HuePicker({ isDark }: { isDark: boolean }) {
  const [open, setOpen] = useState(false);
  const [hue, setHue] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : 262;
  });
  const ref = useRef<HTMLDivElement>(null);

  // Apply on mount
  useEffect(() => { applyHue(hue); }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function setAndPersist(h: number) {
    setHue(h);
    applyHue(h);
    localStorage.setItem(STORAGE_KEY, String(h));
  }

  const bgColor = isDark ? 'rgba(15,20,30,0.92)' : 'rgba(255,255,255,0.95)';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const textColor = isDark ? '#9ca3af' : '#6b7280';
  const labelColor = isDark ? '#6b7280' : '#9ca3af';

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
        <Palette size={15} color={textColor} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 48, right: 0,
          width: 200, borderRadius: 16, padding: '16px',
          background: bgColor, border: `1px solid ${borderColor}`,
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          zIndex: 100,
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: labelColor, marginBottom: 12 }}>
            Accent colour
          </p>

          {/* Preset swatches */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 16 }}>
            {PRESETS.map(p => (
              <button
                key={p.hue}
                title={p.label}
                onClick={() => setAndPersist(p.hue)}
                style={{
                  width: '100%', aspectRatio: '1', borderRadius: 8,
                  background: p.color, border: 'none', cursor: 'pointer',
                  outline: hue === p.hue ? `2px solid ${p.color}` : 'none',
                  outlineOffset: 2,
                  transform: hue === p.hue ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 0.15s',
                }}
              />
            ))}
          </div>

          {/* Fine-tune strip */}
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: labelColor, marginBottom: 8 }}>
            Fine-tune
          </p>
          <div style={{ position: 'relative' }}>
            <div style={{
              height: 10, borderRadius: 99,
              background: 'linear-gradient(to right, oklch(58% 0.21 0), oklch(58% 0.21 60), oklch(58% 0.21 120), oklch(58% 0.21 180), oklch(58% 0.21 240), oklch(58% 0.21 300), oklch(58% 0.21 360))',
              marginBottom: 4,
            }} />
            <input
              type="range" min={0} max={360} value={hue}
              onChange={e => setAndPersist(Number(e.target.value))}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%',
                height: 10, opacity: 0, cursor: 'pointer', margin: 0,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
