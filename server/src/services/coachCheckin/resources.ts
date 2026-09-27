import { PUBLIC_APP_URL } from '../../lib/appUrl';

/**
 * Where a member's answer can be pointed in the Resources section. Keys are
 * the classroom module slugs in src/config/classroom.ts; the label is what
 * the message calls it. Edit here as the Skool material moves in.
 *
 * The wording around a link is always "closest match, worth a look", never a
 * promise that it fixes their problem (see resourceLine).
 */
export const RESOURCE_TOPICS: Record<string, { label: string; matches: string }> = {
  gaps: { label: 'Why you\'re not hearing back', matches: 'no replies, no interviews, not sure what is going wrong' },
  resume: { label: 'The Australian resume', matches: 'resume, CV, formatting, what to include' },
  'cover-letters': { label: 'Cover letters and selection criteria', matches: 'cover letters, selection criteria, government applications' },
  linkedin: { label: 'Setting up LinkedIn', matches: 'LinkedIn profile, being found by recruiters' },
  'find-jobs': { label: 'Where the jobs are', matches: 'where to look, job boards, how to find roles, building a routine' },
  networking: { label: 'Networking that gets replies', matches: 'meeting people, reaching out, coffee chats, connecting, referrals' },
  interview: { label: 'Interview prep', matches: 'interviews, preparing for one, nerves' },
  system: { label: 'Putting it into one system', matches: 'organisation, consistency, keeping momentum, planning the week' },
};

export function isTopic(slug: unknown): slug is string {
  return typeof slug === 'string' && slug in RESOURCE_TOPICS;
}

export function resourceLine(slug: string): string {
  const t = RESOURCE_TOPICS[slug];
  return `Closest match in your Resources is "${t.label}", worth a look: ${PUBLIC_APP_URL}/classroom/${slug}`;
}
