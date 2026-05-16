import { Sparkles } from 'lucide-react';

/**
 * Inline screen-only pill rendered next to bullets that the AI rewrote.
 * Signals to the user that the line is worth a second look before sending.
 * Exporters strip the underlying [AI] token so this badge never appears in
 * the downloaded DOCX or PDF.
 */
export function AIRewriteBadge() {
  return (
    <span
      data-screen-only="true"
      title="This bullet was rewritten by AI from your source achievements. Review before sending — edit out the line marker once you've checked it."
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 9,
        fontWeight: 800,
        color: '#a5b4fc',
        background: 'rgba(99,102,241,0.12)',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: 999,
        padding: '1px 6px',
        marginRight: 6,
        letterSpacing: '0.04em',
        verticalAlign: 'middle',
        textTransform: 'uppercase',
        lineHeight: 1.3,
      }}
    >
      <Sparkles size={9} />
      AI · review
    </span>
  );
}
