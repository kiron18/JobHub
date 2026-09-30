import { Link } from 'react-router-dom';
import { warm } from '../../lib/theme/warmTokens';
import { prefersReducedMotion } from '../../lib/theme/motion';

/* ── ChallengeTicker ───────────────────────────────────────────────────
   The running banner (Kiron, 2026-10-01): "Start your 90 day challenge
   today", scrolling, at the top and bottom of the public pages. The whole
   strip is one link. Pauses on hover, and sits still for anyone who has
   asked their device to reduce motion.
*/

const TEXT = 'Start your 90 day challenge today';
const CSS = `
@keyframes jh-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.jh-ticker:hover .jh-ticker-track { animation-play-state: paused; }
`;

export function ChallengeTicker({ to, onClick }: { to?: string; onClick?: () => void }) {
  const reduced = prefersReducedMotion();
  const items = Array.from({ length: 8 }, (_, i) => (
    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 22, paddingRight: 22, whiteSpace: 'nowrap' }}>
      {TEXT}
      <span aria-hidden="true" style={{ color: warm.colors.accentGoldBright, fontSize: 13 }}>★</span>
    </span>
  ));
  const strip = (
    <div
      className="jh-ticker"
      style={{
        overflow: 'hidden', background: warm.colors.accentPetrol, color: '#fff',
        fontFamily: warm.type.fontBody, fontSize: 15, fontWeight: 700, letterSpacing: '0.02em',
        padding: '10px 0', cursor: 'pointer', flexShrink: 0,
      }}
    >
      <style>{CSS}</style>
      <div
        className="jh-ticker-track"
        style={{
          display: 'inline-flex', width: 'max-content',
          animation: reduced ? undefined : 'jh-ticker 32s linear infinite',
        }}
      >
        {items}
        <span aria-hidden="true" style={{ display: 'inline-flex' }}>{items}</span>
      </div>
    </div>
  );

  if (to) {
    return <Link to={to} aria-label={TEXT} style={{ textDecoration: 'none', display: 'block' }}>{strip}</Link>;
  }
  return (
    <button type="button" onClick={onClick} aria-label={TEXT} style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none' }}>
      {strip}
    </button>
  );
}
