import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RotateCcw, ExternalLink, Briefcase } from 'lucide-react';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';

interface SkippedJob {
  id: string;
  sourceUrl: string;
  title: string;
  company: string;
  location: string | null;
  skippedAt: string;
}

export const SkippedJobsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [restoring, setRestoring] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['skipped-jobs'],
    queryFn: async () => {
      const { data } = await api.get('/job-feed/skipped');
      return data.jobs as SkippedJob[];
    },
    staleTime: 60_000,
  });

  const handleRestore = async (job: SkippedJob) => {
    setRestoring(job.id);
    try {
      await api.post('/job-feed/skipped/restore', { sourceUrl: job.sourceUrl });
      toast.success('Job restored to your feed');
      queryClient.invalidateQueries({ queryKey: ['skipped-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-feed'] });
    } catch {
      toast.error('Could not restore job');
    } finally {
      setRestoring(null);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '96px 0' }}>
        <div style={{ width: 32, height: 32, border: `2px solid ${warm.colors.accentPetrol}30`, borderTopColor: warm.colors.accentPetrol, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  const jobs = data ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h2 className="font-display" style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: warm.colors.textPrimary }}>
          Skipped Jobs
        </h2>
        <p style={{ margin: '8px 0 0', color: warm.colors.textSecondary }}>
          Jobs you skipped. Restore any you want to reconsider.
        </p>
      </header>

      {jobs.length === 0 ? (
        <div style={{
          background: warm.colors.bgSurface,
          borderRadius: 18,
          border: `1px solid ${warm.colors.borderWhisper}`,
          padding: 48,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          textAlign: 'center',
        }}>
          <Briefcase size={36} style={{ color: warm.colors.textMuted }} />
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: warm.colors.textSecondary }}>No skipped jobs</p>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: warm.colors.textMuted }}>
              Jobs you skip will appear here so you can restore them later.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {jobs.map((job) => (
            <div
              key={job.id}
              style={{
                background: warm.colors.bgSurface,
                borderRadius: 16,
                border: `1px solid ${warm.colors.borderWhisper}`,
                padding: 20,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: warm.colors.textPrimary }}>
                  {job.title}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: warm.colors.textSecondary }}>
                  {job.company}{job.location ? ` · ${job.location}` : ''}
                </p>
                <p style={{ margin: '8px 0 0', fontSize: 11, color: warm.colors.textMuted }}>
                  Skipped {new Date(job.skippedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <a
                  href={job.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: `1px solid ${warm.colors.borderWhisper}`,
                    background: warm.colors.bgSurface,
                    color: warm.colors.textSecondary,
                  }}
                  title="View original listing"
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  onClick={() => handleRestore(job)}
                  disabled={restoring === job.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: `1px solid ${warm.colors.borderWhisper}`,
                    background: warm.colors.bgSurface,
                    color: warm.colors.accentPetrol,
                    cursor: restoring === job.id ? 'default' : 'pointer',
                    opacity: restoring === job.id ? 0.6 : 1,
                  }}
                  title="Restore to feed"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
