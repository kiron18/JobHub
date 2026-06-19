import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, AlertCircle, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { NavLink } from 'react-router-dom';
import api from '../lib/api';
import type { JobFeedItem } from '../components/jobs/JobCard';
import { FocusedApplyView } from '../components/jobs/FocusedApplyView';
import { warm } from '../lib/theme/warmTokens';
import { SectionIntroBanner } from '../components/processStrip';

const gc: React.CSSProperties = {
  background: warm.colors.bgSurface, borderRadius: 18,
  border: `1px solid ${warm.colors.borderWhisper}`, overflow: 'hidden',
};

export const JobFeedPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [jobs, setJobs] = useState<JobFeedItem[]>([]);
  // TODO: Restore pagination when load-more UI is added
  // const [total, setTotal] = useState(0);
  // const [hasMore, setHasMore] = useState(false);
  // const [offset, setOffset] = useState(0);
  // const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [building, setBuilding] = useState(false);
  // TODO: Restore pagination when load-more UI is added
  const [_offset, setOffset] = useState(0);
  // const [_loadingMore, setLoadingMore] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCount = useRef(0);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => { const { data } = await api.get('/profile'); return data; },
    staleTime: 5 * 60 * 1000,
  });

  const { data: feedData, isLoading, isError } = useQuery({
    queryKey: ['job-feed', 0],
    queryFn: async () => {
      const { data } = await api.get('/job-feed/feed?offset=0');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Sync query data into local state, runs on both fresh fetch AND cache hit on remount.
  // Guard with offset===0 so paginated results don't get wiped by a background refetch.
  useEffect(() => {
    if (!feedData) return;
    if (_offset === 0) {
      setJobs(feedData.jobs ?? []);
      // TODO: Restore when pagination is added
      // setTotal(feedData.total ?? 0);
      // setHasMore(feedData.hasMore ?? false);
      setProfileIncomplete(feedData.profileIncomplete ?? false);
      setBuilding(feedData.building ?? false);
    }
  }, [feedData, _offset]);

  // Poll every 60s while building, up to 8 attempts (~8 minutes total)
  useEffect(() => {
    if (building && !isLoading) {
      if (pollCount.current < 8) {
        pollRef.current = setTimeout(() => {
          pollCount.current += 1;
          queryClient.invalidateQueries({ queryKey: ['job-feed'] });
        }, 60_000);
      }
    } else {
      pollCount.current = 0;
    }
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [building, isLoading]);

  // Poll every 3s while profile is incomplete (claim may be in progress), up to 20 attempts (~1 minute)
  const profilePollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profilePollCount = useRef(0);
  useEffect(() => {
    if (profileIncomplete && !isLoading) {
      if (profilePollCount.current < 20) {
        profilePollRef.current = setTimeout(() => {
          profilePollCount.current += 1;
          queryClient.invalidateQueries({ queryKey: ['job-feed'] });
        }, 3_000);
      }
    } else {
      profilePollCount.current = 0;
    }
    return () => {
      if (profilePollRef.current) clearTimeout(profilePollRef.current);
    };
  }, [profileIncomplete, isLoading]);

  /* TODO: Restore when load-more UI is added
  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const next = _offset + 10;
      const { data } = await api.get(`/job-feed/feed?offset=${next}`);
      setJobs(prev => [...prev, ...data.jobs]);
      // setHasMore(data.hasMore);
      setOffset(next);
    } catch {
      toast.error('Failed to load more jobs');
    } finally {
      setLoadingMore(false);
    }
  };
  */

  const handleRefresh = async () => {
    setRefreshing(true);
    setOffset(0);
    try {
      await api.post('/job-feed/refresh');
      setJobs([]);
      queryClient.invalidateQueries({ queryKey: ['job-feed'] });
      toast.success('Feed refreshed');
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Could not refresh';
      const retry = err?.response?.data?.retryAfter;
      toast.error(retry ? `${msg} Try again in ${Math.ceil(retry / 60)} min.` : msg);
      // Re-fetch existing data so the UI isn't left empty
      queryClient.invalidateQueries({ queryKey: ['job-feed'] });
    } finally {
      setRefreshing(false);
    }
  };

  /* TODO: Restore when job card updates are implemented
  const handleUpdate = useCallback((updated: Partial<JobFeedItem> & { id: string }) => {
    setJobs(prev => {
      // If the item was skipped, remove it from the visible list
      if (updated.skipped === true) {
        return prev.filter(j => j.id !== updated.id);
      }
      return prev.map(j => (j.id === updated.id ? { ...j, ...updated } : j));
    });
  }, []);
  */

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '96px 0' }}>
        <div style={{ width: 32, height: 32, border: `2px solid ${warm.colors.accentPetrol}30`, borderTopColor: warm.colors.accentPetrol, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <SectionIntroBanner sectionId="jobs">
        Curated Australian roles matched against your profile. Skim daily; analyse the ones worth your time.
      </SectionIntroBanner>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 className="font-display" style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: warm.colors.textPrimary }}>
            Job Feed
          </h2>
        </div>
        {!profileIncomplete && !building && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
              borderRadius: 12, fontSize: 11, fontWeight: 900, textTransform: 'uppercase',
              letterSpacing: '0.08em',
              border: `1px solid ${warm.colors.borderWhisper}`,
              color: warm.colors.textSecondary, background: 'transparent',
              cursor: refreshing ? 'default' : 'pointer',
              opacity: refreshing ? 0.4 : 1,
            }}
            onMouseEnter={e => { if (!refreshing) { e.currentTarget.style.borderColor = warm.colors.borderDefined; e.currentTarget.style.color = warm.colors.textPrimary; }}}
            onMouseLeave={e => { if (!refreshing) { e.currentTarget.style.borderColor = warm.colors.borderWhisper; e.currentTarget.style.color = warm.colors.textSecondary; }}}
          >
            {refreshing ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <RefreshCw size={13} />}
            Refresh
          </button>
        )}
      </header>

      {/* Building state */}
      {building && (
        <div style={{ ...gc, padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: `2px solid ${warm.colors.accentPetrol}30`, borderTopColor: warm.colors.accentPetrol, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: warm.colors.textPrimary }}>Searching live listings for you…</p>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: warm.colors.textSecondary }}>
              Finding <span style={{ color: warm.colors.textPrimary }}>{profile?.targetRole}</span> roles
              in <span style={{ color: warm.colors.textPrimary }}>{profile?.targetCity}</span> on Seek.
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: warm.colors.textMuted }}>
              {pollCount.current >= 8
                ? "Taking longer than usual, try refreshing manually."
                : "This takes 1–2 minutes on first load. Grab a coffee, we'll check back automatically."}
            </p>
          </div>
        </div>
      )}

      {/* Profile incomplete */}
      {profileIncomplete && (
        <div style={{ ...gc, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <AlertCircle size={32} style={{ color: warm.colors.accentGold }} />
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: warm.colors.textPrimary }}>Location required</p>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: warm.colors.textSecondary }}>
              Add your city to the Location field in Profile &amp; Achievements to enable your job feed.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['job-feed'] })}
                disabled={isLoading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                  borderRadius: 12, background: 'transparent',
                  border: `1px solid ${warm.colors.borderWhisper}`,
                  color: warm.colors.textSecondary, fontSize: 14, fontWeight: 700,
                  cursor: isLoading ? 'default' : 'pointer',
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                {isLoading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <RefreshCw size={14} />}
                Retry
              </button>
              <NavLink
                to="/workspace"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                  borderRadius: 12, background: `${warm.colors.accentPetrol}20`,
                  border: `1px solid ${warm.colors.accentPetrol}30`,
                  color: warm.colors.accentPetrol, fontSize: 14, fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Go to Profile &amp; Achievements →
              </NavLink>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {isError && !profileIncomplete && (
        <div style={{ ...gc, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <AlertCircle size={32} style={{ color: warm.colors.danger }} />
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: warm.colors.textPrimary }}>Couldn't load today's jobs</p>
          <p style={{ margin: 0, fontSize: 14, color: warm.colors.textSecondary }}>Try refreshing in a few minutes.</p>
        </div>
      )}

      {/* Empty (build finished but no results) */}
      {!isLoading && !isError && !profileIncomplete && !building && jobs.length === 0 && (
        <div style={{ ...gc, padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <Briefcase size={36} style={{ color: warm.colors.textMuted }} />
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: warm.colors.textSecondary }}>No listings found today</p>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: warm.colors.textMuted }}>
              We searched for {profile?.targetRole} roles in {profile?.targetCity} but found nothing today.
              Try broadening your target role in your profile, or check back tomorrow.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: 12, fontSize: 12, fontWeight: 700,
              border: `1px solid ${warm.colors.borderWhisper}`,
              color: warm.colors.textSecondary, background: 'transparent',
              cursor: refreshing ? 'default' : 'pointer',
              opacity: refreshing ? 0.4 : 1,
            }}
            onMouseEnter={e => { if (!refreshing) { e.currentTarget.style.borderColor = warm.colors.borderDefined; e.currentTarget.style.color = warm.colors.textPrimary; }}}
            onMouseLeave={e => { if (!refreshing) { e.currentTarget.style.borderColor = warm.colors.borderWhisper; e.currentTarget.style.color = warm.colors.textSecondary; }}}
          >
            {refreshing ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <RefreshCw size={12} />}
            Search again
          </button>
        </div>
      )}

      {/* Job cards - focused one-at-a-time view */}
      {jobs.length > 0 && <FocusedApplyView jobs={jobs} />}
    </div>
  );
};
