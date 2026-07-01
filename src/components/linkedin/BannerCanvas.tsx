import React, { useRef, useState, useLayoutEffect } from 'react';
import html2canvas from 'html2canvas';
import { Download, X } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import type { BannerConfig } from './types';

const BANNER_W = 1584;
const BANNER_H = 396;
const BRAND_DOMAIN = 'aussiegradcareers.com.au';

interface Props {
  config: BannerConfig;
  onConfigChange: (c: BannerConfig) => void;
  onClose: () => void;
  /** In embedded mode (inside the onboarding modal) we hide the header,
   *  the Download and Close buttons — the single page CTA drives everything. */
  embedded?: boolean;
}

/** Headline shrinks as it gets longer so it never clips the canvas. */
function titleFontSize(text: string): number {
  const n = (text || '').length;
  if (n <= 16) return 96;
  if (n <= 26) return 78;
  if (n <= 40) return 62;
  if (n <= 56) return 50;
  return 42;
}

/**
 * The artwork itself, always rendered at the true LinkedIn banner size
 * (1584×396). It is the SINGLE source of truth used for both the scaled-down
 * preview and the off-screen full-resolution export node — so what you see is
 * exactly what downloads.
 */
const BannerArt: React.FC<{ config: BannerConfig }> = ({ config }) => {
  const title = config.mainMessage || 'Your headline appears here';
  const showGrid = config.texture === 'grid';
  const showSheen = config.texture !== 'clean';
  return (
    <div
      style={{
        width: BANNER_W,
        height: BANNER_H,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: config.bgColor,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Purple glow bottom-left — sits behind where the profile photo overlaps */}
      <div
        style={{
          position: 'absolute',
          left: -140,
          bottom: -180,
          width: 640,
          height: 640,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(139,92,246,0.55) 0%, rgba(139,92,246,0.18) 42%, transparent 70%)',
        }}
      />
      {/* Depth wash */}
      {showSheen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, rgba(0,0,0,0.38) 0%, transparent 44%, transparent 72%, rgba(0,0,0,0.20) 100%)',
          }}
        />
      )}
      {/* Optional grid texture */}
      {showGrid && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.5,
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 44px, rgba(255,255,255,0.05) 44px, rgba(255,255,255,0.05) 45px), repeating-linear-gradient(90deg, transparent, transparent 44px, rgba(255,255,255,0.05) 44px, rgba(255,255,255,0.05) 45px)',
          }}
        />
      )}

      {/* Text block — centred in the area to the RIGHT of the photo zone */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: 430,
          paddingRight: 96,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 1000 }}>
          <div
            style={{
              fontSize: titleFontSize(title),
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              wordBreak: 'break-word',
              textShadow: '0 2px 18px rgba(0,0,0,0.35)',
            }}
          >
            {title}
          </div>

          {config.subLine && (
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.78)',
                marginTop: 20,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                lineHeight: 1.3,
              }}
            >
              {config.subLine}
            </div>
          )}

          <div
            style={{
              display: 'inline-block',
              marginTop: 26,
              background: '#ffffff',
              color: '#0F172A',
              fontSize: 22,
              fontWeight: 700,
              padding: '8px 20px',
              borderRadius: 8,
              letterSpacing: '0.01em',
            }}
          >
            {BRAND_DOMAIN}
          </div>
        </div>
      </div>
    </div>
  );
};

export const BannerCanvas: React.FC<Props> = ({ config, onConfigChange, onClose, embedded }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.35);
  const [exporting, setExporting] = useState(false);

  // Scale the preview to whatever width the container gives us — no crop.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / BANNER_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  async function handleExport() {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      // Capture the OFF-SCREEN full-size node (no transform) → crisp 1584×396.
      const canvas = await html2canvas(exportRef.current, {
        width: BANNER_W,
        height: BANNER_H,
        scale: 1,
        useCORS: true,
        backgroundColor: config.bgColor,
      });
      const link = document.createElement('a');
      link.download = 'linkedin-banner.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setExporting(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: warm.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  };

  return (
    <div style={{ padding: 0 }}>
      {/* Header (Download / Close) — hidden inside the onboarding modal */}
      {!embedded && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: warm.colors.textSecondary }}>Banner Editor</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8, border: 'none',
                background: '#0A66C2', color: 'white', fontWeight: 700, fontSize: 13,
                cursor: exporting ? 'default' : 'pointer',
              }}
            >
              <Download size={13} />
              {exporting ? 'Exporting…' : 'Download PNG'}
            </button>
            <button
              aria-label="Close banner editor"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: warm.colors.textMuted, cursor: 'pointer', padding: 6 }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Colour + texture controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={labelStyle}>Background</label>
          <input
            type="color"
            value={config.bgColor}
            onChange={e => onConfigChange({ ...config, bgColor: e.target.value })}
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', padding: 0 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={labelStyle}>Texture</label>
          {(['clean', 'gradient', 'grid'] as const).map(t => {
            const active = config.texture === t;
            return (
              <button
                key={t}
                onClick={() => onConfigChange({ ...config, texture: t })}
                style={{
                  padding: '5px 12px', borderRadius: 6,
                  border: `1px solid ${active ? '#0A66C2' : warm.colors.borderDefined}`,
                  background: active ? 'rgba(10,102,194,0.12)' : 'transparent',
                  color: active ? '#0A66C2' : warm.colors.textMuted,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Responsive preview — scales to the container, never clips */}
      <div
        ref={wrapRef}
        style={{
          width: '100%',
          height: BANNER_H * scale,
          overflow: 'hidden',
          borderRadius: 10,
          border: `1px solid ${warm.colors.borderWhisper}`,
        }}
      >
        <div style={{ width: BANNER_W, height: BANNER_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <BannerArt config={config} />
        </div>
      </div>

      <p style={{ fontSize: 11, color: warm.colors.textMuted, marginTop: 8, lineHeight: 1.5 }}>
        Sized for LinkedIn (1584 × 396). Text stays clear of the bottom-left where your profile photo sits.
      </p>

      {/* Off-screen full-resolution node used only for export */}
      <div style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none' }} aria-hidden="true">
        <div ref={exportRef}>
          <BannerArt config={config} />
        </div>
      </div>
    </div>
  );
};
