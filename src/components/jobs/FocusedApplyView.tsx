import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { DailyProgressBar } from './DailyProgressBar';
import type { JobFeedItem } from './JobCard';

function recency(iso: string | null): string | null {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'Posted today' : d === 1 ? 'Posted yesterday' : `Posted ${d}d ago`;
}

export function FocusedApplyView({ jobs: initial }: { jobs: JobFeedItem[] }) {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<JobFeedItem[]>(initial);
  const [expanded, setExpanded] = useState(false);
  const job = queue[0];

  if (!job) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: warm.colors.textSecondary }}>
        <p style={{ fontWeight: 700, color: warm.colors.textPrimary }}>That's your shortlist for today.</p>
        <p style={{ fontSize: 14 }}>Come back tomorrow for fresh matches.</p>
      </div>
    );
  }

  const advance = () => { setExpanded(false); setQueue(q => q.slice(1)); };

  const onPreview = async () => {
    const next = !expanded; setExpanded(next);
    if (next && (job.description?.length ?? 0) < 600) {
      try {
        const { data } = await api.post(`/job-feed/${job.id}/fetch-description`);
        setQueue(q => q.map((j, i) => i === 0 ? { ...j, description: data.description } : j));
      } catch { /* keep teaser */ }
    }
  };

  const onApply = () => {
    localStorage.setItem('jobhub_apply_context', JSON.stringify({
      jobId: job.id, title: job.title, company: job.company, description: job.description,
      sourceUrl: job.sourceUrl, sourcePlatform: job.sourcePlatform,
    }));
    navigate('/apply', { state: {
      jobDescription: job.description, company: job.company, role: job.title,
      feedItemId: job.id, sourceUrl: job.sourceUrl, sourcePlatform: job.sourcePlatform,
    }});
  };

  const onSkip = async () => {
    const skipped = job;
    advance();
    try {
      await api.patch(`/job-feed/${skipped.id}/skip`, { skipped: true });
      toast('Not for you', { action: { label: 'Undo', onClick: async () => {
        try { await api.patch(`/job-feed/${skipped.id}/skip`, { skipped: false }); setQueue(q => [skipped, ...q]); } catch {}
      }}});
    } catch { toast.error('Could not skip'); }
  };

  const chips = [job.sourcePlatform ? `via ${job.sourcePlatform === 'seek' ? 'Seek' : job.sourcePlatform}` : null, recency(job.postedAt)].filter(Boolean) as string[];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AnimatePresence mode="wait">
        <motion.div key={job.id}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22 }}
          style={{ border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 16, background: warm.colors.bgSurface, padding: 22 }}>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 800, color: warm.colors.textPrimary }}>{job.title}</p>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: warm.colors.textSecondary }}>
            {job.company}{job.location ? ` · ${job.location}` : ''}{job.salary ? ` · ${job.salary}` : ''}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0' }}>
            {chips.map(c => (
              <span key={c} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                background: warm.colors.borderWhisper, color: warm.colors.textSecondary }}>{c}</span>
            ))}
          </div>
          {expanded && (
            <div style={{ fontSize: 13, lineHeight: 1.55, color: warm.colors.textSecondary, whiteSpace: 'pre-wrap',
              maxHeight: 320, overflowY: 'auto', margin: '8px 0 16px' }}>{job.description}</div>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
            <button onClick={onApply} style={{ flex: 1, padding: '12px 18px', borderRadius: 12, border: 'none',
              cursor: 'pointer', fontWeight: 800, fontSize: 14.5, background: warm.colors.accentPetrol, color: warm.colors.textOnDeep }}>
              Apply →
            </button>
            <button onClick={onPreview} style={{ padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
              border: `1px solid ${warm.colors.borderWhisper}`, background: 'transparent', color: warm.colors.textSecondary, fontWeight: 700, fontSize: 13 }}>
              {expanded ? 'Hide' : 'Preview'}
            </button>
          </div>
          <button onClick={onSkip} style={{ marginTop: 10, width: '100%', padding: '8px', borderRadius: 10, cursor: 'pointer',
            border: 'none', background: 'transparent', color: warm.colors.textMuted, fontSize: 12.5 }}>
            Not for me
          </button>
        </motion.div>
      </AnimatePresence>
      <DailyProgressBar />
    </div>
  );
}
