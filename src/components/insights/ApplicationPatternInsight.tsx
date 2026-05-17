import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

interface PatternResponse {
  appliedTo: Array<{ title: string; count: number }>;
  competitiveFor: Array<{ jobTitle: string; company: string; matchScore: number }>;
  applicationsTotal: number;
}

interface ProfileForFallback {
  targetRole?: string;
  targetCity?: string;
  positioningStatement?: {
    raw?: string;
    components?: { title?: string; seniority?: string; years?: number; domain?: string };
  } | null;
}

const SENIORITY_LABEL: Record<string, string> = {
  graduate:  'graduate',
  junior:    'junior',
  associate: 'associate',
  mid:       'mid-level',
  senior:    'senior',
  lead:      'lead',
  manager:   'manager',
  principal: 'principal',
  head:      'head-of',
  director:  'director',
};

/**
 * Build a diagnostic-derived "competitive for" statement when the job feed is
 * empty. Pulls from the profile's positioning statement so the user sees what
 * the diagnostic already worked out, instead of being told to "browse the feed
 * for a few days". Returns null if we don't have enough to say anything
 * meaningful — then the panel falls back to the original prompt.
 */
function deriveCompetitiveForFromProfile(profile: ProfileForFallback | undefined): {
  headline: string;
  positioning: string | null;
} | null {
  if (!profile) return null;
  const targetRole = profile.targetRole?.trim();
  const components = profile.positioningStatement?.components ?? {};
  const seniority = components.seniority ? SENIORITY_LABEL[components.seniority.toLowerCase()] : null;
  const domain = components.domain?.trim();
  const city = profile.targetCity?.trim();

  if (!targetRole && !seniority && !domain) return null;

  const parts: string[] = [];
  if (seniority) parts.push(seniority);
  if (targetRole) parts.push(`${targetRole} roles`);
  else if (domain) parts.push(`${domain} roles`);

  const locationSuffix = city ? ` in ${city}` : domain && targetRole ? ` in ${domain}` : '';
  const headline = parts.length > 0
    ? `${parts.join(' ')}${locationSuffix}`.replace(/\s+/g, ' ').trim()
    : 'roles aligned with your background';

  const positioning = profile.positioningStatement?.raw?.trim() || null;
  return { headline, positioning };
}

export function ApplicationPatternInsight() {
  const { data, isLoading, error } = useQuery<PatternResponse>({
    queryKey: ['insights', 'application-pattern'],
    queryFn: async () => (await api.get('/insights/application-pattern')).data,
    staleTime: 60 * 1000,
  });

  // Cached by DashboardLayout; this read piggybacks on the same query.
  const { data: profile } = useQuery<ProfileForFallback>({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/profile')).data,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <p style={{ fontSize: 13, color: '#9ca3af' }}>Computing your pattern…</p>;
  if (error || !data) return <p style={{ fontSize: 13, color: '#fca5a5' }}>Could not load this insight.</p>;

  const fallback = deriveCompetitiveForFromProfile(profile);

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
          fallback ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#C5A059', textTransform: 'uppercase', opacity: 0.8 }}>
                From your diagnostic
              </p>
              <p style={{ margin: 0, fontSize: 14, color: '#e5e7eb', fontWeight: 600, lineHeight: 1.4, textTransform: 'capitalize' }}>
                {fallback.headline}
              </p>
              {fallback.positioning && (
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.55, fontStyle: 'italic' }}>
                  {fallback.positioning}
                </p>
              )}
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280', lineHeight: 1.55 }}>
                Live job matches will appear here once the feed builds up.
              </p>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>Browse the Job Feed for a few days so we can compute this.</p>
          )
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
