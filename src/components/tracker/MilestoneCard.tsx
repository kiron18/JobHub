import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, X } from 'lucide-react';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';

/* ── MilestoneCard ─────────────────────────────────────────────────────
   Every hundred sent applications, hand the candidate their own data back
   instead of another silent day of the same form: which of their job-match
   tags are actually converting to interviews.

   Same rule as applause.ts — reflect the real numbers, never invent a
   benchmark or shame a low one. If nothing has enough sample size to rank
   yet, say that plainly instead of forcing a table out of noise.
*/

interface TagBreakdown { tag: string; applied: number; interviewed: number; interviewRate: number; }
interface MilestoneState {
  eligible: boolean;
  milestone: number;
  totalSent: number;
  overall: { interviewed: number; offered: number; interviewRate: number };
  byTag: TagBreakdown[];
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function MilestoneCard() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['tracker-milestone'],
    queryFn: async () => (await api.get('/tracker/milestone')).data as MilestoneState,
    staleTime: 60_000,
  });

  const ackMutation = useMutation({
    mutationFn: async () => (await api.post('/tracker/milestone/ack')).data as MilestoneState,
    onSuccess: updated => queryClient.setQueryData(['tracker-milestone'], updated),
  });

  if (!data?.eligible) return null;

  const topTags = data.byTag.slice(0, 5);
  const leader = topTags[0];

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(196,113,58,0.08), rgba(74,157,111,0.06))',
      border: '1px solid rgba(196,113,58,0.3)',
      borderRadius: 16, padding: '18px 20px', position: 'relative',
    }}>
      <button
        onClick={() => ackMutation.mutate()}
        aria-label="Dismiss"
        style={{
          position: 'absolute', top: 12, right: 12, border: 'none', background: 'transparent',
          cursor: 'pointer', color: warm.colors.textMuted, padding: 4,
        }}
      >
        <X size={14} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Sparkles size={15} style={{ color: '#C4713A' }} />
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C4713A' }}>
          {data.milestone} applications sent
        </span>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.5, color: warm.colors.textPrimary }}>
        {data.overall.interviewed} interview{data.overall.interviewed === 1 ? '' : 's'} out of {data.totalSent} applications
        {' '}— a {pct(data.overall.interviewRate)} interview rate.
        {leader && (
          <> <strong>{leader.tag}</strong> applications are converting best: {leader.interviewed} of {leader.applied} ({pct(leader.interviewRate)}).</>
        )}
      </p>

      {topTags.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {topTags.map(t => (
            <div key={t.tag} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
              <span style={{ color: warm.colors.textPrimary, fontWeight: 600 }}>{t.tag}</span>
              <span style={{ color: warm.colors.textSecondary }}>
                {t.interviewed}/{t.applied} interviews · {pct(t.interviewRate)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: warm.colors.textMuted }}>
          Not enough tagged applications yet to say what's converting best — that view fills in as more of your applications get a job-match tag.
        </p>
      )}

      <button
        onClick={() => ackMutation.mutate()}
        disabled={ackMutation.isPending}
        style={{
          padding: '6px 14px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, border: 'none',
          cursor: 'pointer', background: warm.colors.accentPetrol, color: 'white',
        }}
      >
        Got it
      </button>
    </div>
  );
}
