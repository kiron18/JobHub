import React, { useState, useEffect, useCallback } from 'react';
import { colors, spacing } from '../components/landing/tokens';
import { SponsorHero } from '../components/sponsors/SponsorHero';
import { SponsorFilterBar } from '../components/sponsors/SponsorFilterBar';
import { SponsorResultsGrid } from '../components/sponsors/SponsorResultsGrid';
import { SponsorEmailModal } from '../components/sponsors/SponsorEmailModal';
import { LandingFooter } from '../components/landing/LandingFooter';
import api from '../lib/api';
import { trackSponsorDirectoryViewed, trackSponsorSearchPerformed, trackSponsorEmailGateShown } from '../lib/analytics';

interface SponsorData {
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

export function VisaSponsorsPage() {
  const [results, setResults] = useState<SponsorData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [highConfidence, setHighConfidence] = useState(false);

  const [industries, setIndustries] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  const [hasMore, setHasMore] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const pageSize = 20;

  const fetchResults = useCallback(async (q: string, ind: string, loc: string, hc: boolean, p: number, append: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (ind) params.set('industry', ind);
      if (loc) params.set('location', loc);
      if (hc) params.set('highConfidence', 'true');
      params.set('page', String(p));
      params.set('pageSize', String(pageSize));

      const { data } = await api.get(`/sponsors/search?${params.toString()}`);
      if (append) {
        setResults((prev) => [...prev, ...data.results]);
      } else {
        setResults(data.results);
      }
      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);
      setPage(data.page);
      if (data.industries) setIndustries(data.industries);
      if (data.locations) setLocations(data.locations);

      // If server returned full data (unlocked cookie set), mark unlocked
      if (data.results && data.results.length > 0 && data.results[0].website !== null) {
        setUnlocked(true);
      }
    } catch (err) {
      console.error('Sponsor search failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    trackSponsorDirectoryViewed();
    fetchResults('', '', '', false, 1, false);
  }, [fetchResults]);

  function handleSearch(q: string) {
    setQuery(q);
    setPage(1);
    fetchResults(q, industry, location, highConfidence, 1, false).then(() => {
      trackSponsorSearchPerformed(q, { industry, location, highConfidence: String(highConfidence) }, total);
    });
  }

  function handleIndustryChange(ind: string) {
    setIndustry(ind);
    setPage(1);
    fetchResults(query, ind, location, highConfidence, 1, false);
  }

  function handleLocationChange(loc: string) {
    setLocation(loc);
    setPage(1);
    fetchResults(query, industry, loc, highConfidence, 1, false);
  }

  function handleConfidenceToggle() {
    const next = !highConfidence;
    setHighConfidence(next);
    setPage(1);
    fetchResults(query, industry, location, next, 1, false);
  }

  function handleLoadMore() {
    fetchResults(query, industry, location, highConfidence, page + 1, true);
  }

  function handleLockedClick() {
    trackSponsorEmailGateShown();
    setShowModal(true);
  }

  function handleUnlock(unlockedResults: SponsorData[]) {
    setUnlocked(true);
    setResults(unlockedResults.slice(0, page * pageSize));
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.bgCanvas }}>
      <SponsorHero onSearch={handleSearch} searchValue={query} />

      <div style={{ padding: `0 24px ${spacing.sectionDesktop}` }}>
        <div style={{ maxWidth: spacing.containerMax, margin: '0 auto' }}>
          <SponsorFilterBar
            industries={industries}
            locations={locations}
            selectedIndustry={industry}
            selectedLocation={location}
            highConfidenceOnly={highConfidence}
            onIndustryChange={handleIndustryChange}
            onLocationChange={handleLocationChange}
            onConfidenceToggle={handleConfidenceToggle}
          />

          <div style={{ marginTop: 32 }}>
            <SponsorResultsGrid
              results={results}
              total={total}
              hasMore={hasMore}
              unlocked={unlocked}
              loading={loading}
              onLoadMore={handleLoadMore}
              onLockedClick={handleLockedClick}
            />
          </div>
        </div>
      </div>

      <LandingFooter />

      {showModal && (
        <SponsorEmailModal
          onClose={() => setShowModal(false)}
          onUnlock={handleUnlock}
        />
      )}
    </div>
  );
}
