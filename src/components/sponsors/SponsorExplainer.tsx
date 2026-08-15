import { colors, type } from '../landing/tokens';

/**
 * Plain-English context for the directory.
 *
 * Three questions a visitor will otherwise get wrong. What is this list. What does
 * the gold "Accredited" tag mean, since it is the one real ranking signal on the
 * page. And why do some cards show no industry, which would otherwise read as a
 * broken card rather than a gap we are being upfront about.
 */
export function SponsorExplainer() {
  const item: React.CSSProperties = {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.55,
    color: colors.textSecondary,
    fontFamily: type.body,
  };

  const label: React.CSSProperties = {
    fontWeight: 700,
    color: colors.textPrimary,
  };

  return (
    <div
      style={{
        background: colors.bgSurface,
        border: `1px solid ${colors.borderWhisper}`,
        borderRadius: 12,
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 780,
        margin: '0 auto',
      }}
    >
      <p style={item}>
        <span style={label}>Every company here can sponsor a work visa.</span>{' '}
        This is the Australian Government's own list of approved sponsors, from the
        Department of Home Affairs. It is not a jobs board and it is not a guess.
      </p>

      <p style={item}>
        <span style={{ ...label, color: colors.accentPetrol }}>★ Accredited</span>{' '}
        means Home Affairs approved that company at a higher level. It puts their visa
        paperwork ahead of the queue, so the wait is usually shorter. Around 3,900
        companies have it. Everyone else on this list can still sponsor you, they just
        do not get the fast lane.
      </p>

      <p style={item}>
        <span style={label}>Some cards show no industry.</span>{' '}
        The government list gives us a company name and nothing else, so where the name
        does not make the industry obvious we leave it blank rather than guess. Those
        companies sponsor visas just the same. Search by name to find them.
      </p>
    </div>
  );
}
