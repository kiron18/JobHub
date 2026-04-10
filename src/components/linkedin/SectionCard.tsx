import React, { useState } from 'react';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { useAppTheme } from '../../contexts/ThemeContext';

interface Props {
  label: string;
  charLimit?: number;
  charTarget?: string;
  content: string;
  onContentChange: (val: string) => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
  renderContent?: (content: string) => React.ReactNode;
}

export const SectionCard: React.FC<Props> = ({
  label, charLimit, charTarget, content, onContentChange,
  onRegenerate, regenerating, renderContent,
}) => {
  const { T } = useAppTheme();
  const [copied, setCopied] = useState(false);

  const charCount = content.length;
  const overLimit = charLimit ? charCount > charLimit : false;

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.cardBorder}`,
      borderRadius: 16, padding: 24, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textFaint }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(charLimit || charTarget) && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: overLimit ? '#f87171' : T.textFaint,
            }}>
              {charTarget ? `${charCount} / target ${charTarget}` : `${charCount} / ${charLimit}`}
            </span>
          )}
          {onRegenerate && (
            <button
              aria-label={`Regenerate ${label}`}
              onClick={onRegenerate}
              disabled={regenerating}
              title="Regenerate this section"
              style={{
                background: 'none', border: 'none', cursor: regenerating ? 'default' : 'pointer',
                color: T.textFaint, padding: 4, borderRadius: 6, display: 'flex',
              }}
            >
              <RefreshCw size={13} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          )}
          <button
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
              border: `1px solid ${copied ? '#34d399' : T.cardBorder}`,
              background: copied ? 'rgba(52,211,153,0.1)' : 'transparent',
              color: copied ? '#34d399' : T.textMuted, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      {renderContent ? (
        renderContent(content)
      ) : (
        <textarea
          value={content}
          onChange={e => onContentChange(e.target.value)}
          rows={label === 'About' ? 10 : label === 'Experience Bullets (Most Recent Role)' ? 5 : 3}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${overLimit ? '#f87171' : T.cardBorder}`,
            borderRadius: 10, padding: '10px 12px', fontSize: 14,
            color: T.text, resize: 'vertical', lineHeight: 1.6,
            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
};
