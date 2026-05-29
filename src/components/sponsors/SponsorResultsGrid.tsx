import React from 'react';
import { colors, type } from '../landing/tokens';
import { SponsorCard } from './SponsorCard';

interface SponsorCardData {
  id: string;
  cleanName: string;
  industry: string;
  locations: string[];
  hiringProfile: string;
  confidence: string;
  website: string | null;
  careersUrl: string | null;
  careersSearchUrl: string | null;
}

interface Props {
  results: SponsorCardData[];
  total: number;
  hasMore: boolean;
  unlocked: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onLockedClick: () => void;
}

export function SponsorResultsGrid({ results, total, hasMore, unlocked, loading, onLoadMore, onLockedClick }: Props) {

  return (
    <div>
      {/* Results count */}
      <p style={{
        textAlign: 'center',
        color: colors.textSecondary,
        fontSize: 14,
        fontFamily: type.body,
        margin: '0 0 24px',
      }}>
        {total.toLocaleString()} {total === 1 ? 'sponsor' : 'sponsors'} found
      </p>

      {/* Grid */}
      <div className="sponsor-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 20,
      }}>
        {results.map((sponsor) => (
          <SponsorCard
            key={sponsor.id}
            sponsor={sponsor}
            unlocked={unlocked}
            onLockedClick={onLockedClick}
          />
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <button
            onClick={onLoadMore}
            disabled={loading}
            style={{
              padding: '12px 32px',
              borderRadius: 10,
              border: `1.5px solid ${colors.accentPetrol}`,
              background: 'transparent',
              color: colors.accentPetrol,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: type.body,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? 'Loading...' : 'Load more sponsors'}
          </button>
        </div>
      )}

      {/* Responsive grid: 3→2→1 columns */}
      <style>{`
        @media (max-width: 1024px) {
          .sponsor-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .sponsor-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
