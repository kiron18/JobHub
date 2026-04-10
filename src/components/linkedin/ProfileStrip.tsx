import React from 'react';
import { useAppTheme } from '../../contexts/ThemeContext';

interface Props {
  name: string;
  title: string;
  headshotUrl?: string | null;
}

export const ProfileStrip: React.FC<Props> = ({ name, title, headshotUrl }) => {
  const { T } = useAppTheme();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '20px 24px', borderRadius: 16, marginBottom: 24,
      background: T.card, border: `1px solid ${T.cardBorder}`,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
        background: 'linear-gradient(135deg, #0A66C2, #004182)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {headshotUrl
          ? <img src={headshotUrl} alt="Headshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>{name?.[0] ?? '?'}</span>
        }
      </div>
      <div>
        <p style={{ fontSize: 18, fontWeight: 800, color: T.text, margin: 0 }}>{name || 'Your Name'}</p>
        <p style={{ fontSize: 14, color: T.textMuted, margin: '2px 0 0' }}>{title || 'Your Title'}</p>
      </div>
      <div style={{
        marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#0A66C2',
        background: 'rgba(10,102,194,0.1)', padding: '4px 10px', borderRadius: 20,
        border: '1px solid rgba(10,102,194,0.2)',
      }}>
        LinkedIn Preview
      </div>
    </div>
  );
};
