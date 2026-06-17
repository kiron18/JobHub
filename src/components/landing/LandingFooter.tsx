import { useNavigate } from 'react-router-dom';
import { colors, type as typeTokens } from './tokens';

const LEGAL_LINKS = [
  // PAYMENTS PAUSED: pricing link hidden during pricing rework
  // { label: 'Pricing', path: '/pricing' },
  { label: 'Terms', path: '/legal/terms' },
  { label: 'Privacy', path: '/legal/privacy' },
  { label: 'Refunds', path: '/legal/refunds' },
  { label: 'Cancellation', path: '/legal/cancellation' },
  { label: 'Contact', path: '/contact' },
];

export function LandingFooter() {
  const navigate = useNavigate();

  return (
    <footer style={{ background: colors.bgCanvas }}>
      <div
        style={{
          borderTop: `1px solid ${colors.borderWhisper}`,
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '48px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Wordmark */}
          <span
            style={{
              fontFamily: typeTokens.display,
              fontSize: '1.25rem',
              fontWeight: 600,
              color: colors.textPrimary,
              letterSpacing: '-0.02em',
            }}
          >
            <span style={{ color: colors.accentGold }}>J</span>obHub
          </span>

          {/* Legal links */}
          <div
            style={{
              display: 'flex',
              gap: 24,
            }}
          >
            {LEGAL_LINKS.map(link => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: typeTokens.body,
                  fontSize: '0.8125rem',
                  color: colors.textMuted,
                  padding: 0,
                  textDecoration: 'none',
                  transition: 'color 180ms ease',
                  outline: 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = colors.textSecondary; }}
                onMouseLeave={e => { e.currentTarget.style.color = colors.textMuted; }}
                onFocus={e => { e.currentTarget.style.outline = `2px solid ${colors.ringFocus}`; e.currentTarget.style.outlineOffset = '3px'; }}
                onBlur={e => { e.currentTarget.style.outline = 'none'; }}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Copyright */}
          <span
            style={{
              fontFamily: typeTokens.body,
              fontSize: '0.8125rem',
              color: colors.textMuted,
            }}
          >
            &copy; 2026 JobHub · Made in Australia
          </span>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          footer > div > div { flex-direction: column; gap: 16px; text-align: center; padding: 32px 20px; }
          footer > div > div > div { flex-wrap: wrap; justify-content: center; }
        }
      `}</style>
    </footer>
  );
}
