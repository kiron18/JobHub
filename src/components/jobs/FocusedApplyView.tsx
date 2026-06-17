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

/** Format job description into readable sections */
function formatDescription(text: string): React.ReactNode {
  if (!text) return null;

  // Split into lines and filter empty
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const sections: React.ReactNode[] = [];
  let currentList: string[] = [];
  let currentSection: string | null = null;

  const flushList = () => {
    if (currentList.length > 0) {
      sections.push(
        <ul key={`list-${sections.length}`} style={{ margin: '8px 0 16px', paddingLeft: 20, color: warm.colors.textSecondary }}>
          {currentList.map((item, i) => (
            <li key={i} style={{ margin: '4px 0', lineHeight: 1.5 }}>{item.replace(/^[\s•\-\*]+/, '')}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, idx) => {
    // Detect section headers (short lines, often ending with colon, or ALL CAPS)
    const isHeader = (
      (line.length < 60 && /[:：]$/.test(line)) ||
      (line.length < 50 && line === line.toUpperCase() && /[A-Z]/.test(line)) ||
      /^(about|role|position|responsibilities|requirements|what you'll do|what we need|benefits|perks|skills|experience|qualifications)/i.test(line)
    );

    // Detect bullet points
    const isBullet = /^[\s•\-\*\d]+[.)]?\s/.test(line) || (line.startsWith('- ') || line.startsWith('• '));

    if (isHeader) {
      flushList();
      currentSection = line.replace(/[:：]$/, '');
      sections.push(
        <h4 key={`h-${idx}`} style={{
          margin: '16px 0 8px',
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: warm.colors.textPrimary,
        }}>
          {currentSection}
        </h4>
      );
    } else if (isBullet) {
      currentList.push(line);
    } else {
      flushList();
      sections.push(
        <p key={`p-${idx}`} style={{ margin: '8px 0', lineHeight: 1.6, color: warm.colors.textSecondary }}>
          {line}
        </p>
      );
    }
  });

  flushList();
  return <>{sections}</>;
}

export function FocusedApplyView({ jobs: initial }: { jobs: JobFeedItem[] }) {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<JobFeedItem[]>(initial);
  const [expanded, setExpanded] = useState(false);
  const [hydrating, setHydrating] = useState(false);
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

  const onExpand = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && (job.description?.length ?? 0) < 600 && !hydrating) {
      setHydrating(true);
      try {
        const { data } = await api.post(`/job-feed/${job.id}/fetch-description`);
        setQueue(q => q.map((j, i) => i === 0 ? { ...j, description: data.description } : j));
      } catch { /* keep teaser */ }
      setHydrating(false);
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
      toast('Skipped', { action: { label: 'Undo', onClick: async () => {
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
          onClick={onExpand}
          style={{
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 16,
            background: warm.colors.bgSurface,
            padding: 22,
            cursor: 'pointer',
            transition: 'border-color 200ms, box-shadow 200ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = warm.colors.borderDefined;
            e.currentTarget.style.boxShadow = warm.shadow.soft;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = warm.colors.borderWhisper;
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
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
            <div style={{ margin: '16px 0', paddingTop: 16, borderTop: `1px solid ${warm.colors.borderWhisper}` }}>
              {hydrating ? (
                <div style={{ textAlign: 'center', padding: 24, color: warm.colors.textMuted }}>
                  <div style={{ width: 24, height: 24, border: `2px solid ${warm.colors.accentPetrol}30`, borderTopColor: warm.colors.accentPetrol, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                  Loading full description...
                </div>
              ) : (
                <div style={{ fontSize: 13, maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
                  {formatDescription(job.description)}
                </div>
              )}
            </div>
          )}

          {/* Action buttons - equal size, same neutral color, side by side */}
          <div style={{ display: 'flex', gap: 12, marginTop: expanded ? 20 : 16 }} onClick={(e) => e.stopPropagation()}>
            <button onClick={onSkip} style={{
              flex: 1,
              padding: '12px 18px',
              borderRadius: 12,
              border: `1px solid ${warm.colors.borderDefined}`,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 14,
              background: warm.colors.bgSurface,
              color: warm.colors.textSecondary,
              transition: 'all 150ms',
            }} onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = warm.colors.accentPetrol;
              e.currentTarget.style.color = warm.colors.accentPetrol;
            }} onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = warm.colors.borderDefined;
              e.currentTarget.style.color = warm.colors.textSecondary;
            }}>
              Skip
            </button>
            <button onClick={onApply} style={{
              flex: 1,
              padding: '12px 18px',
              borderRadius: 12,
              border: `1px solid ${warm.colors.borderDefined}`,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 14,
              background: warm.colors.bgSurface,
              color: warm.colors.textSecondary,
              transition: 'all 150ms',
            }} onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = warm.colors.accentPetrol;
              e.currentTarget.style.color = warm.colors.accentPetrol;
            }} onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = warm.colors.borderDefined;
              e.currentTarget.style.color = warm.colors.textSecondary;
            }}>
              Apply
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
      <DailyProgressBar />
    </div>
  );
}
