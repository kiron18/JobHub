import { ExternalLink } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { jobBlurb } from '../../lib/jobBlurb';
import type { JobFeedItem } from '../jobs/JobCard';

interface JobStreamCardProps {
  job: JobFeedItem;
  onApply: (job: JobFeedItem) => void;
  applying?: boolean;
}

export function JobStreamCard({ job, onApply, applying }: JobStreamCardProps) {
  const source = job.sourcePlatform === 'seek' ? 'via Seek' : `via ${job.sourcePlatform ?? 'the web'}`;
  return (
    <div style={{
      border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 14,
      background: warm.colors.bgSurface, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary }}>{job.title}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: warm.colors.textSecondary }}>
            {job.company}{job.location ? ` · ${job.location}` : ''}
          </p>
        </div>
        <span style={{ fontSize: 11, color: warm.colors.textMuted, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ExternalLink size={11} /> {source}
        </span>
      </div>

      {job.salary ? (
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: warm.colors.textPrimary }}>{job.salary}</p>
      ) : null}

      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: warm.colors.textSecondary }}>
        {jobBlurb(job.description)}
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          onClick={() => onApply(job)}
          disabled={applying}
          style={{
            fontSize: 13.5, fontWeight: 700, padding: '9px 20px', borderRadius: 10,
            border: 'none', cursor: applying ? 'wait' : 'pointer',
            background: warm.colors.accentPetrol, color: warm.colors.textOnDeep,
            opacity: applying ? 0.7 : 1,
          }}
        >
          {applying ? 'Opening...' : 'Apply'}
        </button>
      </div>
    </div>
  );
}
