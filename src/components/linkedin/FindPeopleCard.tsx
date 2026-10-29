import { ExternalLink, Search } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';

/**
 * One tap from "who do I message?" to a LinkedIn search already filled in.
 *
 * Built from their own profile: the role they are aiming at and the city. The
 * three searches are the three kinds of people worth a message for a graduate:
 * someone already doing the job (warm, honest advice), a recruiter who fills it,
 * and the person who would manage them. LinkedIn does the searching; we only
 * write the query, so there is no scraping and nothing to break.
 */
export function FindPeopleCard({ targetRole, targetCity }: { targetRole?: string | null; targetCity?: string | null }) {
  const role = (targetRole ?? '').trim();
  if (!role) return null;
  const city = (targetCity ?? '').trim();
  const where = city ? ` ${city}` : '';
  const search = (q: string) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
  const searches: Array<{ label: string; hint: string; q: string }> = [
    { label: `${role}s${city ? ` in ${city}` : ''}`, hint: 'Already doing the job. The warmest first message.', q: `${role}${where}` },
    { label: `Recruiters for ${role} roles`, hint: 'They fill these jobs every week.', q: `recruiter ${role}${where}` },
    { label: `${role} team leads`, hint: 'The person who would manage you.', q: `${role} manager${where}` },
  ];

  return (
    <div style={{
      marginBottom: 20, padding: '16px 18px', borderRadius: warm.radius.card,
      background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Search size={16} style={{ color: warm.colors.accentPetrol }} /> Find people to message
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.55, color: warm.colors.textSecondary }}>
        Opens LinkedIn with the search already filled in from your profile. Pick five, then write to them below.
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        {searches.map(s => (
          <a
            key={s.q}
            href={search(s.q)}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '11px 14px', borderRadius: 10, textDecoration: 'none',
              background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: warm.colors.accentPetrol }}>{s.label}</span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, color: warm.colors.textMuted }}>{s.hint}</span>
            </span>
            <ExternalLink size={15} style={{ flexShrink: 0, color: warm.colors.textMuted }} />
          </a>
        ))}
      </div>
    </div>
  );
}

