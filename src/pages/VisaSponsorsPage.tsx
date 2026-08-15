import { useState, useEffect, useCallback } from 'react';
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
  industry: string | null;
  locations: string[];
  hiringProfile: string | null;
  tier: 'accredited' | 'standard';
  state: string | null;
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
  const [accreditedOnly, setAccreditedOnly] = useState(false);

  const [industries, setIndustries] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  const [hasMore, setHasMore] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const pageSize = 20;

  const fetchResults = useCallback(async (q: string, ind: string, loc: string, acc: boolean, p: number, append: boolean, sizeOverride?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (ind) params.set('industry', ind);
      if (loc) params.set('location', loc);
      if (acc) params.set('accreditedOnly', 'true');
      params.set('page', String(p));
      params.set('pageSize', String(sizeOverride ?? pageSize));

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

  // The global stylesheet sets `body { overflow: hidden }` (the dashboard supplies
  // its own scroll container). This public page is rendered outside that shell, so
  // re-enable document scrolling while it's mounted and restore on unmount.
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  // Initial load
  useEffect(() => {
    trackSponsorDirectoryViewed();
    fetchResults('', '', '', false, 1, false);
  }, [fetchResults]);

  function handleSearch(q: string) {
    setQuery(q);
    setPage(1);
    fetchResults(q, industry, location, accreditedOnly, 1, false).then(() => {
      trackSponsorSearchPerformed(q, { industry, location, accreditedOnly: String(accreditedOnly) }, total);
    });
  }

  function handleIndustryChange(ind: string) {
    setIndustry(ind);
    setPage(1);
    fetchResults(query, ind, location, accreditedOnly, 1, false);
  }

  function handleLocationChange(loc: string) {
    setLocation(loc);
    setPage(1);
    fetchResults(query, industry, loc, accreditedOnly, 1, false);
  }

  function handleAccreditedToggle() {
    const next = !accreditedOnly;
    setAccreditedOnly(next);
    setPage(1);
    fetchResults(query, industry, location, next, 1, false);
  }

  function handleLoadMore() {
    fetchResults(query, industry, location, accreditedOnly, page + 1, true);
  }

  function handleLockedClick() {
    trackSponsorEmailGateShown();
    setShowModal(true);
  }

  function handleUnlock() {
    setUnlocked(true);
    // The unlock cookie is already set, so re-running the current search returns the
    // same cards with their contact links filled in. Ask for everything the visitor
    // had scrolled to so the page does not collapse back to the first 20. The server
    // caps pageSize at 100, so clamp here too and re-derive which page we are on;
    // otherwise "Load more" would resume from the wrong offset and skip results.
    const size = Math.min(page * pageSize, 100);
    const resumeFrom = Math.ceil(size / pageSize);
    fetchResults(query, industry, location, accreditedOnly, 1, false, size)
      .then(() => setPage(resumeFrom));
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.bgCanvas }}>
      <SponsorHero onSearch={handleSearch} searchValue={query} total={total} />

      <div style={{ padding: `0 24px ${spacing.sectionDesktop}` }}>
        <div style={{ maxWidth: spacing.containerMax, margin: '0 auto' }}>
          <SponsorFilterBar
            industries={industries}
            locations={locations}
            selectedIndustry={industry}
            selectedLocation={location}
            accreditedOnly={accreditedOnly}
            onIndustryChange={handleIndustryChange}
            onLocationChange={handleLocationChange}
            onAccreditedToggle={handleAccreditedToggle}
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
          total={total}
        />
      )}
    </div>
  );
}
