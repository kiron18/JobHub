import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, type as typeTokens } from './tokens';

interface LandingNavProps {
  onLogInClick?: () => void;
}

export function LandingNav({ onLogInClick }: LandingNavProps) {
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const handleScroll = () => {
      const scrollY = nav.closest('.landing-page')?.scrollTop ?? window.scrollY;
      const delta = scrollY - lastScrollYRef.current;
      lastScrollYRef.current = scrollY;

      // Auto-hide: hide on scroll down past threshold, show on scroll up
      if (scrollY > 80 && delta > 0) {
        nav.style.transform = 'translateY(-100%)';
      } else {
        nav.style.transform = 'translateY(0)';
      }

      // Background & border
      if (scrollY > 80) {
        nav.style.background = colors.bgCanvas;
        nav.style.borderBottom = '1px solid rgba(26, 24, 20, 0.08)';
      } else {
        nav.style.background = 'transparent';
        nav.style.borderBottom = '1px solid transparent';
      }
    };

    const scrollContainer = nav.closest('.landing-page');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    } else {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      } else {
        window.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const handleLogIn = () => {
    onLogInClick?.();
    navigate('/auth?intent=signin');
  };

  return (
    <nav
      ref={navRef}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px',
        transition: 'transform 300ms cubic-bezier(0.25, 1, 0.5, 1), background 200ms ease, border-color 200ms ease',
        background: 'transparent',
        borderBottom: '1px solid transparent',
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

      {/* Log in */}
      <button
        onClick={handleLogIn}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: typeTokens.body,
          fontSize: '0.9375rem',
          fontWeight: 500,
          color: colors.textSecondary,
          padding: 0,
          textDecoration: 'none',
          textUnderlineOffset: 4,
          transition: 'color 180ms ease',
          outline: 'none',
          lineHeight: 1,
        }}
        onMouseEnter={e => { e.currentTarget.style.color = colors.accentPetrol; e.currentTarget.style.textDecoration = 'underline'; }}
        onMouseLeave={e => { e.currentTarget.style.color = colors.textSecondary; e.currentTarget.style.textDecoration = 'none'; }}
        onFocus={e => { e.currentTarget.style.outline = `2px solid ${colors.ringFocus}`; e.currentTarget.style.outlineOffset = '4px'; }}
        onBlur={e => { e.currentTarget.style.outline = 'none'; }}
      >
        Log in
      </button>

      {/* Mobile responsive: reduce padding */}
      <style>{`
        @media (max-width: 640px) {
          nav { padding: 16px 20px; }
        }
      `}</style>
    </nav>
  );
}
