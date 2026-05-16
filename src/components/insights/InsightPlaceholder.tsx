import { Sparkles } from 'lucide-react';

interface InsightPlaceholderProps {
  title: string;
  description: string;
}

export function InsightPlaceholder({ title, description }: InsightPlaceholderProps) {
  return (
    <div style={{
      padding: 24,
      borderRadius: 14,
      background: 'rgba(99,102,241,0.04)',
      border: '1px dashed rgba(99,102,241,0.25)',
      textAlign: 'center',
    }}>
      <Sparkles size={24} style={{ color: '#a5b4fc', marginBottom: 12 }} />
      <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: '#e5e7eb' }}>
        {title}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.55 }}>
        {description}
      </p>
      <p style={{ margin: '14px 0 0', fontSize: 11, fontWeight: 700, color: '#6366f1', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Coming soon — built when ready
      </p>
    </div>
  );
}
