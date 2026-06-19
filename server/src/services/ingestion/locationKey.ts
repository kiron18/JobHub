export function locationKey(location: string | null | undefined): string {
  // City-level cache key. We deliberately keep the full normalised "city state"
  // string (e.g. "newcastle nsw") instead of collapsing to the state code, so a
  // search in one city is NEVER served jobs that were cached for a different city
  // in the same state. The search location is always the user's normalised
  // targetCity, so this key stays stable per user/day.
  return (location ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
