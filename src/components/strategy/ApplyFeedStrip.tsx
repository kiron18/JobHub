import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Loader2, ExternalLink } from 'lucide-react';
import api from '../../lib/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import type { JobFeedItem } from '../jobs/JobCard';

interface ApplyFeedStripProps {
  /** Called with the (possibly-hydrated) JD text + the feed item that produced it. */
  onPick: (jobDescription: string, item: JobFeedItem) => void;
}

/**
 * Compact horizontal strip of the user's top Job Feed matches, shown above the
 * Analyse hero textarea. Clicking a card hydrates the full JD from the source
 * page (calls /job-feed/:id/fetch-description) and pastes it into the
 * textarea, closing the "I don't have a JD to paste" friction gap.
 *
 * Renders nothing when the feed is empty (graceful degradation for free users
 * or first-visit users whose feed hasn't been built yet).
 */
export function ApplyFeedStrip({ onPick }: ApplyFeedStripProps) {
  const { T } = useAppTheme();
  const [hydratingId, setHydratingId] = useState<string | null>(null);

  const { data: jobs } = useQuery<JobFeedItem[]>({
    queryKey: ['job-feed', 'strip'],
    queryFn: async () => {
      const { data } = await api.get('/job-feed/feed?offset=0');
      return Array.isArray(data?.jobs) ? data.jobs : (Array.isArray(data) ? data : []);
    },
    staleTime: 5 * 60 * 1000,
  });

  const visible = (jobs ?? [])
    .filter(j => !j.isRead || j.applicationStatus === null)
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    .slice(0, 5);

  if (visible.length === 0) return null;

  async function handlePick(item: JobFeedItem) {
    setHydratingId(item.id);
    try {
      // Attempt to hydrate the full JD; fall back to whatever description we have.
      let description = item.description;
      try {
        const { data } = await api.post(`/job-feed/${item.id}/fetch-description`);
        if (typeof data?.description === 'string' && data.description.length > description.length) {
          description = data.description;
        }
      } catch {
        // Hydration failed (premium gate, 4xx, network, etc.) — use whatever we have.
      }
      onPick(description, { ...item, description });
    } finally {
      setHydratingId(null);
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Briefcase size={13} style={{ color: T.textMuted }} />
        <p style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: T.textMuted,
        }}>
          Or start from your feed
        </p>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 10,
      }}>
        <AnimatePresence initial={false}>
          {visible.map(item => {
            const isHydrating = hydratingId === item.id;
            const score = item.matchScore ?? null;
            const scoreColor =
              score == null ? T.textMuted :
              score >= 75 ? T.accentSuccess :
              score >= 50 ? T.accentSecondary : T.textMuted;
            return (
              <motion.button
                key={item.id}
                onClick={() => handlePick(item)}
                disabled={isHydrating}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{
                  textAlign: 'left',
                  padding: 12,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${T.cardBorder}`,
                  color: T.text,
                  cursor: isHydrating ? 'wait' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => {
                  if (isHydrating) return;
                  e.currentTarget.style.borderColor = T.accentSecondary;
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = T.cardBorder;
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <p style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {item.title}
                  </p>
                  {score != null && (
                    <span style={{
                      flexShrink: 0,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.02em',
                      color: scoreColor,
                      padding: '2px 7px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${scoreColor}33`,
                    }}>
                      {Math.round(score)}%
                    </span>
                  )}
                </div>
                <p style={{
                  margin: 0,
                  fontSize: 11,
                  color: T.textMuted,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {item.company}{item.location ? ` · ${item.location}` : ''}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  {isHydrating ? (
                    <>
                      <Loader2 size={11} className="animate-spin" style={{ color: T.textMuted }} />
                      <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}>Loading JD…</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink size={10} style={{ color: T.textMuted }} />
                      <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}>
                        {item.applicationStatus ? `${item.applicationStatus.toLowerCase()} · click to analyse` : 'Use this JD'}
                      </span>
                    </>
                  )}
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
