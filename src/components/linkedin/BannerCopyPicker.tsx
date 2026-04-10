import React from 'react';
import { useAppTheme } from '../../contexts/ThemeContext';
import type { BannerCopy, BannerConfig } from './types';

const FORMULA_LABELS: Record<BannerCopy['formula'], string> = {
  'value-prop': 'Value Proposition',
  'bold-positioning': 'Bold Positioning',
  'credibility-offer': 'Credibility + Offer',
};

interface Props {
  bannerCopies: BannerCopy[];
  config: BannerConfig;
  onConfigChange: (config: BannerConfig) => void;
  onOpenEditor: () => void;
}

export const BannerCopyPicker: React.FC<Props> = ({
  bannerCopies, config, onConfigChange, onOpenEditor,
}) => {
  const { T } = useAppTheme();
  const wordCount = config.mainMessage.trim().split(/\s+/).filter(Boolean).length;
  const softWarning = wordCount > 12 && wordCount <= 15;
  const hardWarning = wordCount > 15;

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24, marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textFaint, marginBottom: 16 }}>
        Banner Copy
      </p>

      {/* Formula cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {bannerCopies.map((bc) => (
          <button
            key={bc.formula}
            onClick={() => onConfigChange({ ...config, mainMessage: bc.copy, subLine: bc.sublineSuggestion ?? '' })}
            style={{
              textAlign: 'left', padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${config.mainMessage === bc.copy ? '#0A66C2' : T.cardBorder}`,
              background: config.mainMessage === bc.copy ? 'rgba(10,102,194,0.1)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.15s',
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, color: '#0A66C2', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {FORMULA_LABELS[bc.formula]}
            </p>
            <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0 }}>{bc.copy}</p>
            {bc.sublineSuggestion && (
              <p style={{ fontSize: 12, color: T.textMuted, margin: '4px 0 0' }}>{bc.sublineSuggestion}</p>
            )}
          </button>
        ))}
      </div>

      {/* Editable text fields */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.textFaint, display: 'block', marginBottom: 6 }}>
          Main Message{' '}
          {hardWarning && <span style={{ color: '#f87171' }}>({wordCount} words — aim for 5–12)</span>}
          {softWarning && <span style={{ color: '#f59e0b' }}>({wordCount} words — ideal is under 12)</span>}
        </label>
        <input
          value={config.mainMessage}
          onChange={e => onConfigChange({ ...config, mainMessage: e.target.value })}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${hardWarning ? '#f87171' : T.cardBorder}`,
            color: T.text, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.textFaint, display: 'block', marginBottom: 6 }}>
          Sub-line (optional — proof element e.g. "Forbes · 3,000+ helped")
        </label>
        <input
          value={config.subLine}
          onChange={e => onConfigChange({ ...config, subLine: e.target.value })}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.cardBorder}`,
            color: T.text, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      <button
        onClick={onOpenEditor}
        disabled={!config.mainMessage.trim()}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
          background: config.mainMessage.trim() ? '#0A66C2' : 'rgba(10,102,194,0.3)',
          color: 'white', fontWeight: 700, fontSize: 14,
          cursor: config.mainMessage.trim() ? 'pointer' : 'default',
        }}
      >
        Open Banner Editor →
      </button>
    </div>
  );
};
