/**
 * Minimal shape of the profile fields parseQuality cares about.
 * Matches what /profile returns. Optional everywhere because a freshly-
 * created profile row may have nothing populated yet.
 */
export interface ParseQualityInput {
  name?: string | null;
  experience?: Array<unknown> | null;
  education?: Array<unknown> | null;
}

/**
 * Returns true when the profile is essentially empty — i.e., the resume
 * parser failed to extract anything usable. Used to route the user to
 * the "from scratch" fallback capture flow instead of dropping them into
 * the dashboard with empty data.
 *
 * Decision rule: name is empty AND no experience entries AND no education entries.
 */
export function isEssentiallyEmptyProfile(profile: ParseQualityInput | null | undefined): boolean {
  if (!profile) return true;
  const hasName = typeof profile.name === 'string' && profile.name.trim().length > 0;
  const hasExperience = Array.isArray(profile.experience) && profile.experience.length > 0;
  const hasEducation = Array.isArray(profile.education) && profile.education.length > 0;
  return !hasName && !hasExperience && !hasEducation;
}
