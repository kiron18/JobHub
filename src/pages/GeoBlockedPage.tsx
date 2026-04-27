import { useEffect } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';

export function GeoBlockedPage() {
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0d1a2d 0%, #080f1a 100%)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Nav */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <MapPin size={16} style={{ color: '#2dd4bf' }} />
        <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.05em', color: 'white' }}>
          Aussie Grad Careers
        </span>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '72px 24px',
        maxWidth: 640,
        margin: '0 auto',
        textAlign: 'center',
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(45,212,191,0.08)',
          border: '1px solid rgba(45,212,191,0.2)',
          borderRadius: 99,
          padding: '6px 16px',
          marginBottom: 32,
        }}>
          <MapPin size={12} style={{ color: '#2dd4bf' }} />
          <span style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#2dd4bf',
          }}>
            Australia only
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 40,
          fontWeight: 900,
          lineHeight: 1.15,
          margin: '0 0 20px',
          color: 'white',
        }}>
          This service is only available in Australia
        </h1>

        {/* Body */}
        <p style={{
          fontSize: 17,
          color: '#94a3b8',
          lineHeight: 1.7,
          margin: '0 0 16px',
        }}>
          Aussie Grad Careers is built specifically for people who are already in Australia
          and eligible to work here. The job market, employer expectations, and application
          process are entirely different outside Australia, and this tool is not designed
          for those circumstances.
        </p>

        <p style={{
          fontSize: 17,
          color: '#94a3b8',
          lineHeight: 1.7,
          margin: '0 0 48px',
        }}>
          If you are planning to move to Australia to work, the right first step is
          sorting out your visa, not your resume. The Australian government has a
          visa finder that will show you exactly what you are eligible for.
        </p>

        {/* CTA */}
        <a
          href="https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-finder"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'linear-gradient(135deg, #0F766E, #134E4A)',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            padding: '14px 28px',
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            textDecoration: 'none',
            marginBottom: 48,
          }}
        >
          Check Australian visa options
          <ExternalLink size={14} />
        </a>

        {/* Divider */}
        <div style={{
          width: 48,
          height: 1,
          background: 'rgba(255,255,255,0.08)',
          marginBottom: 32,
        }} />

        {/* Footer note */}
        <p style={{
          fontSize: 13,
          color: '#475569',
          lineHeight: 1.6,
        }}>
          Already in Australia? Make sure your VPN is turned off and reload the page.
        </p>
      </div>
    </div>
  );
}
