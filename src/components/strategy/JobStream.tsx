import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { JobStreamCard } from './JobStreamCard';
import type { JobFeedItem } from '../jobs/JobCard';

interface JobStreamProps {
  onApply: (job: JobFeedItem) => void;
  applyingId?: string | null;
}

const APPLIED_STATUSES = new Set(['APPLIED', 'INTERVIEW', 'REJECTED', 'OFFER']);

export function JobStream({ onApply, applyingId }: JobStreamProps) {
  const { data } = useQuery<{ jobs?: JobFeedItem[] }>({
    queryKey: ['job-feed', 0],
    queryFn: async () => (await api.get('/job-feed/feed?offset=0')).data,
    staleTime: 5 * 60 * 1000,
  });

  const visible = useMemo(() => {
    const all = data?.jobs ?? [];
    return all.filter(j => !APPLIED_STATUSES.has(String((j as any).applicationStatus ?? ''))).slice(0, 3);
  }, [data]);

  if (visible.length === 0) {
    return (
      <div style={{ border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 14, background: warm.colors.bgSurface, padding: '24px 18px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary }}>That is every fresh match for now.</p>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: warm.colors.textSecondary }}>Paste your own job below, or check back soon for new roles.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {visible.map(job => (
        <JobStreamCard key={job.id} job={job} onApply={onApply} applying={applyingId === job.id} />
      ))}
    </div>
  );
}
