import { warm } from '../../lib/theme/warmTokens';
import { useProfile } from '../../hooks/useProfile';

const C = warm.colors;

/**
 * Day 2's outreach nudge. Finding the right JOB is solved with "don't
 * overthink it, apply to the first one." Finding the right PERSON doesn't
 * have that shortcut, so this is copy plus a preloaded search rather than a
 * real discovery tool: tell them exactly what to type into LinkedIn's search
 * bar for their own role, and hand them a button that's already typed it in.
 */
function outreachSearchQuery(role: string): string {
  return `${role} hiring manager OR ${role} recruiter OR talent acquisition ${role}`;
}

export function TrialOutreachPrompt() {
  const { profile } = useProfile();
  const role = (profile?.targetRole || '').trim();
  if (!role) return null;

  const query = outreachSearchQuery(role);
  const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;

  return (
    <div style={{ background: C.bgSurface, border: `1px solid ${C.borderDefined}`, borderRadius: 16, padding: 22, textAlign: 'left', marginBottom: 24 }}>
      <p style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textMuted, margin: '0 0 10px' }}>
        Today, also try reaching out
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.55, color: C.textSecondary }}>
        The question that actually matters isn't "who do I know," it's "who do I search for?"
        For a {role} role, that's the recruiter or hiring manager on the other side, not a stranger cold-add.
      </p>
      <div style={{
        background: C.bgCanvas, border: `1px solid ${C.borderWhisper}`, borderRadius: 10,
        padding: '10px 12px', fontSize: 13, fontFamily: 'monospace', color: C.textPrimary, marginBottom: 12,
        wordBreak: 'break-word',
      }}>
        {query}
      </div>
      <a
        href={searchUrl} target="_blank" rel="noopener noreferrer"
        style={{
          display: 'block', textAlign: 'center', width: '100%', padding: 11, borderRadius: 10,
          background: C.accentPetrol, color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none',
        }}
      >
        Open this search on LinkedIn
      </a>
      <p style={{ margin: '10px 0 0', fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>
        Filter to People, then send a short connection note mentioning the role you applied for.
      </p>
    </div>
  );
}
