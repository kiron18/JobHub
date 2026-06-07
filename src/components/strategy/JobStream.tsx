import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { JobStreamCard } from './JobStreamCard';
import type { JobFeedItem } from '../jobs/JobCard';

interface JobStreamProps {
  onApply: (job: JobFeedItem) => void;
  applyingId?: string | null;
  appliedId?: string | null;
}

const APPLIED_STATUSES = new Set(['APPLIED', 'INTERVIEW', 'REJECTED', 'OFFER']);

export function JobStream({ onApply, applyingId, appliedId }: JobStreamProps) {
  const queryClient = useQueryClient();
  const { data } = useQuery<{ jobs?: JobFeedItem[] }>({
    queryKey: ['job-feed', 0],
    queryFn: async () => (await api.get('/job-feed/feed?offset=0')).data,
    staleTime: 5 * 60 * 1000,
  });

  const allJobs = data?.jobs ?? [];
  const sentCount = useMemo(
    () => allJobs.filter(j => APPLIED_STATUSES.has(String((j as any).applicationStatus ?? ''))).length,
    [allJobs],
  );

  // The card currently playing the "Applied" beat (kept visible briefly before exit).
  const [celebratingId, setCelebratingId] = useState<string | null>(null);

  useEffect(() => {
    if (!appliedId) return;
    setCelebratingId(appliedId);
    const t = setTimeout(() => {
      setCelebratingId(null);
      // Refetch so the applied job (now APPLIED) drops out and the next fills in.
      queryClient.invalidateQueries({ queryKey: ['job-feed'] });
    }, 1200);
    return () => clearTimeout(t);
  }, [appliedId, queryClient]);

  const visible = useMemo(() => {
    const unApplied = allJobs.filter(j => !APPLIED_STATUSES.has(String((j as any).applicationStatus ?? '')));
    // While celebrating, keep the applied card in view so its beat is seen.
    if (celebratingId) {
      const celeb = allJobs.find(j => j.id === celebratingId);
      const rest = unApplied.filter(j => j.id !== celebratingId).slice(0, 2);
      return celeb ? [celeb, ...rest] : unApplied.slice(0, 3);
    }
    return unApplied.slice(0, 3);
  }, [allJobs, celebratingId]);

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
      {sentCount > 0 && (
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: warm.colors.textMuted }}>
          {sentCount} applications sent
        </p>
      )}
      <AnimatePresence mode="popLayout" initial={false}>
        {visible.map(job => (
          <motion.div
            key={job.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
            style={{ position: 'relative' }}
          >
            {celebratingId === job.id ? (
              <div style={{
                border: `1px solid ${warm.colors.success}`, borderRadius: 14,
                background: 'rgba(42,157,111,0.08)', padding: '20px 18px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Check size={18} color={warm.colors.success} />
                <span style={{ fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary }}>Applied</span>
              </div>
            ) : (
              <JobStreamCard job={job} onApply={onApply} applying={applyingId === job.id} />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
