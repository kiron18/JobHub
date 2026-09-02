import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import type { BannerConfig } from './types';
import { warm } from '../../lib/theme/warmTokens';

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


/* -- Colour helpers ----------------------------------------------------
   The banner used to be white text, always, on whatever background you
   picked. That works until you pick a light background, at which point
   the banner is blank. Text colour is now yours, which means the two
   things that were hardcoded around it have to follow it: the drop
   shadow (which only helps light text) and the sub-line's translucency.
*/

const DEFAULT_TEXT = '#FFFFFF';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Perceived brightness, 0 to 1. Decides whether a dark shadow helps. */
function luminance(hex: string): number {
  try {
    const [r, g, b] = hexToRgb(hex);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  } catch {
    return 1;
  }
}

function withAlpha(hex: string, alpha: number): string {
  try {
    const [r, g, b] = hexToRgb(hex);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  } catch {
    return hex;
  }
}

/* Ten pairs that are known to work together, so nobody has to find a
   readable combination using two colour pickers and a guess. Ordered
   dark to light because most people want dark, and the light ones are
   there for the people who do not. */
const PALETTES: Array<{ name: string; bg: string; text: string; texture: BannerConfig['texture'] }> = [
  { name: 'Midnight',   bg: '#0F172A', text: '#FFFFFF', texture: 'gradient' },
  { name: 'Ink & gold', bg: '#12100E', text: '#E8C88A', texture: 'clean' },
  { name: 'Deep sea',   bg: '#0B3A54', text: '#E6F4FA', texture: 'gradient' },
  { name: 'Forest',     bg: '#14342B', text: '#E9F5EC', texture: 'clean' },
  { name: 'Plum',       bg: '#2A1B3D', text: '#EFE6FF', texture: 'gradient' },
  { name: 'Terracotta', bg: '#7A3B2E', text: '#FDF1E7', texture: 'clean' },
  { name: 'Signal',     bg: '#1257C4', text: '#FFFFFF', texture: 'gradient' },
  { name: 'Graphite',   bg: '#1D2125', text: '#C8F169', texture: 'grid' },
  { name: 'Slate',      bg: '#334155', text: '#F1F5F9', texture: 'grid' },
  { name: 'Paper',      bg: '#F4F1EA', text: '#161412', texture: 'clean' },
];

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
  const textColor = config.textColor || DEFAULT_TEXT;
  const lightText = luminance(textColor) > 0.5;
  ctx.fillStyle = textColor;
  // The shadow exists to hold light text off a busy background. Under dark
  // text on a light one it just looks smudged, so it does not run.
  ctx.shadowColor = lightText ? 'rgba(0,0,0,0.4)' : 'transparent';
  ctx.shadowBlur = lightText ? 12 : 0;
  ctx.shadowOffsetY = lightText ? 2 : 0;
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
    ctx.fillStyle = withAlpha(textColor, 0.75);
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
        <span style={{ fontSize: 13, fontWeight: 700, color: warm.colors.textMuted }}>Banner Editor</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: warm.colors.accentPetrol, color: 'white', fontWeight: 700, fontSize: 13,
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

      {/* Palettes. One press sets background, text and texture together. */}
      <div style={{ marginBottom: 14 }}>
        <label style={{
          display: 'block', marginBottom: 8,
          fontSize: 11, fontWeight: 700, color: warm.colors.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Palette
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PALETTES.map(pal => {
            const active = config.bgColor.toUpperCase() === pal.bg
              && (config.textColor || DEFAULT_TEXT).toUpperCase() === pal.text;
            return (
              <button
                key={pal.name}
                type="button"
                title={pal.name}
                aria-label={pal.name}
                onClick={() => onConfigChange({ ...config, bgColor: pal.bg, textColor: pal.text, texture: pal.texture })}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 62, height: 38, borderRadius: 8, cursor: 'pointer',
                  background: pal.bg,
                  border: active ? '2px solid #0A66C2' : '1px solid rgba(15,23,42,0.14)',
                  boxShadow: active ? '0 0 0 3px rgba(10,102,194,0.18)' : 'none',
                  padding: 0,
                }}
              >
                <span style={{ color: pal.text, fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em' }}>Aa</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Colour + texture controls */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
          <label style={{ fontSize: 11, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Text
          </label>
          <input
            type="color"
            aria-label="Text colour"
            value={config.textColor || DEFAULT_TEXT}
            onChange={e => onConfigChange({ ...config, textColor: e.target.value })}
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', padding: 0 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Texture
          </label>
          {(['clean', 'gradient', 'grid'] as const).map(t => (
            <button
              key={t}
              onClick={() => onConfigChange({ ...config, texture: t })}
              style={{
                padding: '5px 12px', borderRadius: 6, border: `1px solid ${config.texture === t ? warm.colors.accentPetrol : 'rgba(255,255,255,0.12)'}`,
                background: config.texture === t ? 'rgba(10,102,194,0.15)' : 'transparent',
                color: config.texture === t ? warm.colors.accentPetrol : warm.colors.textMuted,
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
              fontSize: 56, fontWeight: 900, color: config.textColor || DEFAULT_TEXT,
              margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em',
              textShadow: luminance(config.textColor || DEFAULT_TEXT) > 0.5
                ? '0 2px 12px rgba(0,0,0,0.4)'
                : 'none',
            }}>
              {config.mainMessage || 'Your Message Here'}
            </p>
            {config.subLine && (
              <p style={{
                fontSize: 28, fontWeight: 600, color: withAlpha(config.textColor || DEFAULT_TEXT, 0.75),
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
