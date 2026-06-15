/**
 * Preferred display name. Long multi-part legal names (e.g. "Pawan Kanthaka
 * Lokugan Hewage") read poorly in a resume header and a letter signoff. Default to
 * first + last token, which is the safest universal shortening across varied name
 * structures. Names of one or two tokens are returned unchanged.
 *
 * NOTE: a user-editable "preferred name" field on the profile is the proper
 * long-term home for this (the profile is the editable proxy for the resume); this
 * helper is the sensible default until that field exists.
 */
export function displayName(fullName: string | null | undefined): string | null {
  if (!fullName || typeof fullName !== 'string') return null;
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length <= 2) return parts.join(' ');
  return `${parts[0]} ${parts[parts.length - 1]}`;
}
