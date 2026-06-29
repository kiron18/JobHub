import React, { useState } from 'react';
import { Copy, Check, Pencil, RefreshCw } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';

interface Props {
  label: string;
  why: string;
  howToPaste: string;
  content: React.ReactNode;
  generated: boolean;
  ghostContent?: React.ReactNode;
  onRegenerate?: () => void;
  regenerating?: boolean;
  onContentChange?: (val: string) => void;
  rawContent?: string;
}

const LINKEDIN_BLUE = '#0A66C2';

export const ProfileSectionBlock: React.FC<Props> = ({
  label,
  why,
  howToPaste,
  content,
  generated,
  ghostContent,
  onRegenerate,
  regenerating,
  onContentChange,
  rawContent,
}) => {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(rawContent ?? '');

  async function handleCopy() {
    if (!rawContent) return;
    await navigator.clipboard.writeText(rawContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleSaveEdit() {
    onContentChange?.(editedContent);
    setEditing(false);
  }

  if (!generated) {
    // Ghost state — show realistic example faded
    return (
      <div style={{
        background: warm.colors.bgSurface,
        border: `1px solid ${warm.colors.borderWhisper}`,
        borderRadius: warm.radius.card,
        padding: 20,
        marginBottom: 16,
        opacity: 0.7,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <span style={{
            fontSize: 14,
            fontWeight: 700,
            color: warm.colors.textMuted,
          }}>
            {label}
          </span>
          <span style={{
            fontSize: 11,
            color: warm.colors.textMuted,
            fontStyle: 'italic',
          }}>
            Will be generated
          </span>
        </div>

        <div style={{ color: warm.colors.textMuted }}>
          {ghostContent || (
            <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              This section will be filled with your generated {label.toLowerCase()} content.
            </p>
          )}
        </div>

        <p style={{
          fontSize: 11,
          color: warm.colors.textMuted,
          margin: '12px 0 0',
          fontStyle: 'italic',
        }}>
          {why}
        </p>
      </div>
    );
  }

  // Generated state
  return (
    <div style={{
      background: warm.colors.bgSurface,
      border: `1px solid ${warm.colors.borderWhisper}`,
      borderRadius: warm.radius.card,
      padding: 20,
      marginBottom: 16,
      boxShadow: warm.shadow.soft,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          color: warm.colors.textPrimary,
        }}>
          {label}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {rawContent && (
            <>
              <button
                onClick={handleCopy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${copied ? '#2A9D6F' : warm.colors.borderWhisper}`,
                  background: copied ? 'rgba(42,157,111,0.1)' : 'transparent',
                  color: copied ? '#2A9D6F' : warm.colors.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>

              {onContentChange && (
                <button
                  onClick={() => {
                    setEditedContent(rawContent);
                    setEditing(v => !v);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 6,
                    borderRadius: 6,
                    color: warm.colors.textMuted,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {editing && onContentChange ? (
        <div style={{ marginBottom: 12 }}>
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            rows={6}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${warm.colors.borderWhisper}`,
              background: 'rgba(255,255,255,0.03)',
              color: warm.colors.textPrimary,
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
              lineHeight: 1.6,
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={handleSaveEdit}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: LINKEDIN_BLUE,
                color: 'white',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: `1px solid ${warm.colors.borderWhisper}`,
                background: 'transparent',
                color: warm.colors.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>{content}</div>
      )}

      {/* Why + How to paste */}
      <div style={{
        padding: '12px 16px',
        background: warm.colors.bgAlt,
        borderRadius: 8,
        marginBottom: 12,
      }}>
        <p style={{
          fontSize: 12,
          color: warm.colors.textSecondary,
          margin: '0 0 6px',
          lineHeight: 1.5,
        }}>
          <strong>Why this matters:</strong> {why}
        </p>
        <p style={{
          fontSize: 11,
          color: warm.colors.textMuted,
          margin: 0,
          fontStyle: 'italic',
        }}>
          {howToPaste}
        </p>
      </div>

      {/* Soft-nudge regenerate */}
      {onRegenerate && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingTop: 12,
          borderTop: `1px solid ${warm.colors.borderWhisper}`,
        }}>
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            style={{
              background: 'none',
              border: 'none',
              color: warm.colors.textMuted,
              fontSize: 12,
              fontWeight: 600,
              cursor: regenerating ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: 0,
            }}
          >
            <RefreshCw size={12} style={{
              animation: regenerating ? 'spin 1s linear infinite' : 'none',
            }} />
            Regenerate
          </button>
          <span style={{ fontSize: 11, color: warm.colors.textMuted, fontStyle: 'italic' }}>
            Drafts rarely improve with rerolls — tweak it yourself instead.
          </span>
        </div>
      )}
    </div>
  );
};
