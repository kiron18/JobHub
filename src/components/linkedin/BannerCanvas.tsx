import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, X } from 'lucide-react';
import type { BannerConfig } from './types';

const BANNER_W = 1584;
const BANNER_H = 396;
const SCALE = 0.5;

const TEXTURES: Record<BannerConfig['texture'], string> = {
  clean: '',
  gradient: 'linear-gradient(90deg, rgba(0,0,0,0.3) 0%, transparent 60%)',
  grid: `repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(255,255,255,0.04) 30px, rgba(255,255,255,0.04) 31px),
         repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(255,255,255,0.04) 30px, rgba(255,255,255,0.04) 31px)`,
};

interface Props {
  config: BannerConfig;
  onConfigChange: (c: BannerConfig) => void;
  onClose: () => void;
}

export const BannerCanvas: React.FC<Props> = ({ config, onConfigChange, onClose }) => {
  const bannerRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!bannerRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(bannerRef.current, {
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

  const textureStyle = TEXTURES[config.texture];

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>Banner Editor</span>
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
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 6 }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Colour + texture controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Background
          </label>
          <input
            type="color"
            value={config.bgColor}
            onChange={e => onConfigChange({ ...config, bgColor: e.target.value })}
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', padding: 0 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Texture
          </label>
          {(['clean', 'gradient', 'grid'] as const).map(t => (
            <button
              key={t}
              onClick={() => onConfigChange({ ...config, texture: t })}
              style={{
                padding: '5px 12px', borderRadius: 6, border: `1px solid ${config.texture === t ? '#0A66C2' : 'rgba(255,255,255,0.12)'}`,
                background: config.texture === t ? 'rgba(10,102,194,0.15)' : 'transparent',
                color: config.texture === t ? '#60a5fa' : '#64748b',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Preview wrapper */}
      <div style={{
        width: BANNER_W * SCALE,
        height: BANNER_H * SCALE,
        overflow: 'hidden',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div
          ref={bannerRef}
          style={{
            width: BANNER_W,
            height: BANNER_H,
            transform: `scale(${SCALE})`,
            transformOrigin: 'top left',
            backgroundColor: config.bgColor,
            backgroundImage: textureStyle || undefined,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 80,
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          <div style={{ textAlign: 'right', maxWidth: '60%' }}>
            <p style={{
              fontSize: 56, fontWeight: 900, color: 'white',
              margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em',
              textShadow: '0 2px 12px rgba(0,0,0,0.4)',
            }}>
              {config.mainMessage || 'Your Message Here'}
            </p>
            {config.subLine && (
              <p style={{
                fontSize: 28, fontWeight: 600, color: 'rgba(255,255,255,0.75)',
                margin: '16px 0 0', letterSpacing: '0.02em',
              }}>
                {config.subLine}
              </p>
            )}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>
        Text is locked to the right half — keeps clear of your profile photo on mobile.
      </p>
    </div>
  );
};
