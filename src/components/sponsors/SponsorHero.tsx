import { colors, type, spacing } from '../landing/tokens';
import { SponsorSearchBar } from './SponsorSearchBar';

interface Props {
  onSearch: (q: string) => void;
  searchValue?: string;
  /** Live row count. 0 until the first search resolves. */
  total?: number;
}

export function SponsorHero({ onSearch, searchValue, total = 0 }: Props) {
  // Round down to a clean thousand so the headline claim stays true between reseeds.
  const count = total > 1000
    ? `${Math.floor(total / 1000).toLocaleString()},000+ businesses`
    : 'every business';
  return (
    <section style={{
      textAlign: 'center',
      padding: `${spacing.sectionDesktop} 24px`,
      background: colors.bgCanvas,
    }}>
      <h1 style={{
        fontFamily: type.display,
        fontSize: 'clamp(2rem, 4vw, 3rem)',
        fontWeight: 700,
        color: colors.textPrimary,
        margin: '0 auto 12px',
        maxWidth: spacing.containerReadable,
        lineHeight: 1.15,
      }}>
        Companies sponsoring visas in Australia
      </h1>
      <p style={{
        fontFamily: type.body,
        fontSize: 17,
        color: colors.textSecondary,
        margin: '0 auto 32px',
        maxWidth: spacing.containerReadable,
        lineHeight: 1.5,
      }}>
        Search {count} the Australian Government has approved to sponsor a work visa. Taken straight from the Department of Home Affairs list.
      </p>
      <SponsorSearchBar onSearch={onSearch} defaultValue={searchValue} />

      <style>{`
        @media (max-width: 640px) {
          section { padding: ${spacing.sectionMobile} 20px !important; }
        }
      `}</style>
    </section>
  );
}
