import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

interface PatternResponse {
  appliedTo: Array<{ title: string; count: number }>;
  competitiveFor: Array<{ jobTitle: string; company: string; matchScore: number }>;
  applicationsTotal: number;
}

export function ApplicationPatternInsight() {
  const { data, isLoading, error } = useQuery<PatternResponse>({
    queryKey: ['insights', 'application-pattern'],
    queryFn: async () => (await api.get('/insights/application-pattern')).data,
    staleTime: 60 * 1000,
  });

  if (isLoading) return <p style={{ fontSize: 13, color: '#9ca3af' }}>Computing your pattern…</p>;
  if (error || !data) return <p style={{ fontSize: 13, color: '#fca5a5' }}>Could not load this insight.</p>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={{ padding: 18, borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)' }}>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: '#a5b4fc', textTransform: 'uppercase' }}>
          You're applying to
        </p>
        {data.appliedTo.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>No applications yet.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.appliedTo.slice(0, 5).map((b, i) => (
              <li key={i} style={{ fontSize: 13, color: '#e5e7eb' }}>
                <strong>{b.title}</strong>{' '}
                <span style={{ color: '#6b7280' }}>
                  ({b.count} application{b.count === 1 ? '' : 's'})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ padding: 18, borderRadius: 12, background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.18)' }}>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: '#C5A059', textTransform: 'uppercase' }}>
          Your resume is competitive for
        </p>
        {data.competitiveFor.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>Browse the Job Feed for a few days so we can compute this.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.competitiveFor.map((j, i) => (
              <li key={i} style={{ fontSize: 13, color: '#e5e7eb' }}>
                <strong>{j.jobTitle}</strong> · {j.company}{' '}
                <span style={{ color: '#C5A059' }}>{Math.round(j.matchScore)}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
