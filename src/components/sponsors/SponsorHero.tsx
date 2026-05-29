import { colors, type, spacing } from '../landing/tokens';
import { SponsorSearchBar } from './SponsorSearchBar';

interface Props {
  onSearch: (q: string) => void;
  searchValue?: string;
}

export function SponsorHero({ onSearch, searchValue }: Props) {
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
        Search 4,058+ verified sponsors. Find companies actively hiring skilled migrants — no guesswork.
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
