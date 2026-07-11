import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import type { BannerConfig } from './types';

const BANNER_W = 1584;
const BANNER_H = 396;
const SCALE = 0.5;
// LinkedIn downsamples uploads; exporting at 2x keeps text edges crisp after their resize.
const EXPORT_SCALE = 2;

const BANNER_FONT = `'Geist Sans', -apple-system, 'Segoe UI', system-ui, sans-serif`;
const PADDING_RIGHT = 80;
const MAX_TEXT_W = BANNER_W * 0.6;
const MAIN_SIZE = 56;
const MAIN_LINE_H = MAIN_SIZE * 1.1;
const SUB_SIZE = 28;
const SUB_LINE_H = SUB_SIZE * 1.6;
const SUB_GAP = 16;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawBanner(ctx: CanvasRenderingContext2D, config: BannerConfig) {
  // Background
  ctx.fillStyle = config.bgColor;
  ctx.fillRect(0, 0, BANNER_W, BANNER_H);

  // Texture
  if (config.texture === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, BANNER_W, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.3)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, BANNER_W, BANNER_H);
  } else if (config.texture === 'grid') {
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let x = 30; x < BANNER_W; x += 31) ctx.fillRect(x, 0, 1, BANNER_H);
    for (let y = 30; y < BANNER_H; y += 31) ctx.fillRect(0, y, BANNER_W, 1);
  }

  const rightEdge = BANNER_W - PADDING_RIGHT;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  // Measure main message lines
  ctx.font = `900 ${MAIN_SIZE}px ${BANNER_FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${MAIN_SIZE * -0.02}px`;
  const mainLines = wrapText(ctx, config.mainMessage || 'Your Message Here', MAX_TEXT_W);

  const sub = config.subLine?.trim();
  const blockH = mainLines.length * MAIN_LINE_H + (sub ? SUB_GAP + SUB_LINE_H : 0);
  let y = (BANNER_H - blockH) / 2;

  // Main message
  ctx.fillStyle = 'white';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;
  for (const line of mainLines) {
    ctx.fillText(line, rightEdge, y + MAIN_LINE_H / 2);
    y += MAIN_LINE_H;
  }

  // Sub line
  if (sub) {
    y += SUB_GAP;
    ctx.font = `600 ${SUB_SIZE}px ${BANNER_FONT}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${SUB_SIZE * 0.02}px`;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(sub, rightEdge, y + SUB_LINE_H / 2);
  }
}

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
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await document.fonts.ready;
      const canvas = document.createElement('canvas');
      canvas.width = BANNER_W * EXPORT_SCALE;
      canvas.height = BANNER_H * EXPORT_SCALE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
      drawBanner(ctx, config);
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
            aria-label="Close banner editor"
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
