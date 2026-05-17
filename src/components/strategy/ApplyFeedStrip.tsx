import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import api from '../../lib/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import { buildSeekSearchUrl } from '../../lib/seekSearchUrl';
import type { JobFeedItem } from '../jobs/JobCard';

interface ApplyFeedStripProps {
  /** Kept for caller compatibility — currently unused while the feed cards are disabled. */
  onPick: (jobDescription: string, item: JobFeedItem) => void;
}

interface ProfileLite {
  targetRole?: string;
  targetCity?: string;
}

/**
 * TEMPORARILY simplified to a single sleek Seek banner.
 *
 * The job-feed cards were producing low-confidence matches (default 50% for
 * unranked items) and pasting incomplete JDs back into the analyse textarea,
 * which broke user trust. Until the feed scoring and JD hydration are sharper,
 * we always show the Seek shortcut instead — one row, one click, full-quality
 * JD from the actual source.
 *
 * To restore the feed cards: revert this file. The query, sort, and handlePick
 * logic from the previous version is in git history.
 */
export function ApplyFeedStrip(_props: ApplyFeedStripProps) {
  const { T } = useAppTheme();

  const { data: profile } = useQuery<ProfileLite>({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/profile')).data,
    staleTime: 5 * 60 * 1000,
  });

  const seekUrl = buildSeekSearchUrl(profile?.targetRole, profile?.targetCity);
  const roleLabel = profile?.targetRole?.trim() || 'roles';

  return (
    <div style={{ marginBottom: 18 }}>
      <a
        href={seekUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${T.cardBorder}`,
          color: T.text,
          textDecoration: 'none',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = T.accentSecondary;
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = T.cardBorder;
          e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          Browse {roleLabel} on Seek
        </span>
        <ExternalLink size={13} style={{ color: T.textMuted, flexShrink: 0 }} />
      </a>
    </div>
  );
}
