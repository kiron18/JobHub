import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCheck, XCircle, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useAppTheme } from '../../contexts/ThemeContext';

interface JobApplicationLite {
  id: string;
  title: string;
  company: string;
  status: 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'REJECTED' | 'OFFER';
  dateApplied: string | null;
}

interface Update { status: JobApplicationLite['status']; }

const STALE_DAYS = 5;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

export function StaleApplicationsCard() {
  const { T } = useAppTheme();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  const { data: jobs } = useQuery<JobApplicationLite[]>({
    queryKey: ['jobs'],
    queryFn: async () => (await api.get('/jobs')).data,
    staleTime: 60 * 1000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, update }: { id: string; update: Update }) =>
      (await api.patch(`/jobs/${id}`, update)).data,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      if (vars.update.status === 'INTERVIEW') {
        toast.success('Interview marked. Interview Prep is now unlocked for this role.');
      } else if (vars.update.status === 'REJECTED') {
        toast('Marked as rejected. Onwards.');
      }
    },
  });

  const stale = (jobs ?? [])
    .filter(j =>
      j.status === 'APPLIED' &&
      !dismissed.has(j.id) &&
      (daysSince(j.dateApplied) ?? 0) >= STALE_DAYS
    )
    .sort((a, b) => (daysSince(b.dateApplied) ?? 0) - (daysSince(a.dateApplied) ?? 0))
    .slice(0, 5);

  if (stale.length === 0) return null;

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: 16,
      padding: 22,
      boxShadow: T.cardShadow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Clock size={13} style={{ color: T.accentSecondary }} />
        <p style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: T.accentSecondary,
          textTransform: 'uppercase',
        }}>
          Quietly waiting on you
        </p>
      </div>
      <p style={{ margin: '0 0 18px', fontSize: 13, color: T.textMuted, lineHeight: 1.55 }}>
        Updating these unlocks Interview Prep and sharpens future application insights.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AnimatePresence initial={false}>
          {stale.map(job => {
            const days = daysSince(job.dateApplied) ?? 0;
            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${T.cardBorder}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 700,
                    color: T.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {job.title}
                  </p>
                  <p style={{
                    margin: '2px 0 0',
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.textMuted,
                  }}>
                    {job.company} · sent {days} day{days === 1 ? '' : 's'} ago
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => updateStatus.mutate({ id: job.id, update: { status: 'INTERVIEW' } })}
                    disabled={updateStatus.isPending}
                    style={pillStyle(T, 'success')}
                    title="Mark as interview — unlocks Interview Prep"
                  >
                    <CheckCheck size={11} /> Interview
                  </button>
                  <button
                    onClick={() => updateStatus.mutate({ id: job.id, update: { status: 'REJECTED' } })}
                    disabled={updateStatus.isPending}
                    style={pillStyle(T, 'neutral')}
                    title="Mark as rejected"
                  >
                    <XCircle size={11} /> Rejected
                  </button>
                  <button
                    onClick={() => setDismissed(prev => new Set(prev).add(job.id))}
                    style={pillStyle(T, 'ghost')}
                    title="Not yet — hide for this session"
                  >
                    <MoreHorizontal size={11} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function pillStyle(
  T: ReturnType<typeof useAppTheme>['T'],
  tone: 'success' | 'neutral' | 'ghost',
): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 10px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    border: `1px solid ${T.cardBorder}`,
    background: 'transparent',
    color: T.textMuted,
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
  };
  if (tone === 'success') {
    return { ...base, color: T.accentSuccess, borderColor: `${T.accentSuccess}55` };
  }
  if (tone === 'ghost') {
    return { ...base, padding: '6px 8px' };
  }
  return base;
}
