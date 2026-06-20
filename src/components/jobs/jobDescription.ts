// Job descriptions from these boards arrive at ingest as a short search-results
// teaser, not the full posting. They must be hydrated via fetch-description
// before they can drive document generation.
export const TEASER_PLATFORMS = ['seek', 'indeed', 'linkedin', 'jora', 'other'];

// Conservative "already full" check: a hydrated detail-page JD is long markdown
// with line breaks. Teasers (including Adzuna's ~500 char single block) never
// reach this. Used only to skip a redundant re-fetch, never to gate correctness.
export function looksHydrated(description: string): boolean {
  return description.length > 1200 && description.includes('\n');
}

// True when we must fetch the full description before the user can apply.
export function needsHydration(
  platform: string,
  description: string,
  fullDescLoaded: boolean,
): boolean {
  if (fullDescLoaded) return false;
  if (!TEASER_PLATFORMS.includes(platform)) return false;
  return !looksHydrated(description);
}
