import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Loader2, RefreshCw, AlertCircle, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { NavLink } from 'react-router-dom';
import api from '../lib/api';
import { JobCard, type JobFeedItem } from '../components/jobs/JobCard';

export const JobFeedPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [jobs, setJobs] = useState<JobFeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [building, setBuilding] = useState(false);
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

  // Sync query data into local state — runs on both fresh fetch AND cache hit on remount.
  // Guard with offset===0 so paginated results don't get wiped by a background refetch.
  useEffect(() => {
    if (!feedData) return;
    if (offset === 0) {
      setJobs(feedData.jobs ?? []);
      setTotal(feedData.total ?? 0);
      setHasMore(feedData.hasMore ?? false);
      setProfileIncomplete(feedData.profileIncomplete ?? false);
      setBuilding(feedData.building ?? false);
    }
  }, [feedData]);

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

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const next = offset + 10;
      const { data } = await api.get(`/job-feed/feed?offset=${next}`);
      setJobs(prev => [...prev, ...data.jobs]);
      setHasMore(data.hasMore);
      setOffset(next);
    } catch {
      toast.error('Failed to load more jobs');
    } finally {
      setLoadingMore(false);
    }
  };

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

  const handleUpdate = useCallback((updated: Partial<JobFeedItem> & { id: string }) => {
    setJobs(prev => prev.map(j => (j.id === updated.id ? { ...j, ...updated } : j)));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-4xl font-extrabold tracking-tight text-white">Job Feed</h2>
        </div>
        {!profileIncomplete && !building && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-all disabled:opacity-40"
          >
            {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Refresh
          </button>
        )}
      </header>

      {/* Building state */}
      {building && (
        <div className="glass-card p-10 flex flex-col items-center gap-4 text-center">
          <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
          <div>
            <p className="text-base font-bold text-slate-200">Searching live listings for you…</p>
            <p className="text-sm text-slate-500 mt-1">
              Finding <span className="text-slate-300">{profile?.targetRole}</span> roles
              in <span className="text-slate-300">{profile?.targetCity}</span> across Seek, LinkedIn, and Adzuna.
            </p>
            <p className="text-xs text-slate-600 mt-2">
              {pollCount.current >= 8
                ? "Taking longer than usual — try refreshing manually."
                : "This takes 1–2 minutes on first load. Grab a coffee — we'll check back automatically."}
            </p>
          </div>
        </div>
      )}

      {/* Profile incomplete */}
      {profileIncomplete && (
        <div className="glass-card p-8 flex flex-col items-center gap-4 text-center">
          <AlertCircle size={32} className="text-amber-400" />
          <div>
            <p className="text-base font-bold text-slate-200 mb-1">Target role and city required</p>
            <p className="text-sm text-slate-500 mb-4">
              Set your target role and city in Profile &amp; Achievements to enable your job feed.
            </p>
            <NavLink
              to="/workspace"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600/20 border border-brand-600/30 text-brand-400 text-sm font-bold hover:bg-brand-600/30 transition-colors"
            >
              Go to Profile &amp; Achievements →
            </NavLink>
          </div>
        </div>
      )}

      {/* Error */}
      {isError && !profileIncomplete && (
        <div className="glass-card p-8 flex flex-col items-center gap-3 text-center">
          <AlertCircle size={32} className="text-red-400" />
          <p className="text-base font-bold text-slate-200">Couldn't load today's jobs</p>
          <p className="text-sm text-slate-500">Try refreshing in a few minutes.</p>
        </div>
      )}

      {/* Empty (build finished but no results) */}
      {!isLoading && !isError && !profileIncomplete && !building && jobs.length === 0 && (
        <div className="glass-card p-12 flex flex-col items-center gap-4 text-center">
          <Briefcase size={36} className="text-slate-700" />
          <div>
            <p className="text-base font-bold text-slate-400">No listings found today</p>
            <p className="text-sm text-slate-600 mt-1">
              We searched for {profile?.targetRole} roles in {profile?.targetCity} but found nothing today.
              Try broadening your target role in your profile, or check back tomorrow.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-all disabled:opacity-40"
          >
            {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Search again
          </button>
        </div>
      )}

      {/* Job cards */}
      {jobs.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence>
            {jobs.map(job => (
              <JobCard key={job.id} item={job} onUpdate={handleUpdate} />
            ))}
          </AnimatePresence>

          {hasMore && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">Showing {jobs.length} of {total} jobs</p>
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-all disabled:opacity-40"
              >
                {loadingMore ? <Loader2 size={12} className="animate-spin" /> : null}
                {loadingMore ? 'Loading…' : 'Load 10 more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
