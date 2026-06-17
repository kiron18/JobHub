const STATES = ['nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'act', 'nt'];

export function locationKey(location: string | null | undefined): string {
  const norm = (location ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!norm) return '';
  const tokens = norm.split(' ');
  for (const s of STATES) {
    if (tokens.includes(s)) return s;
  }
  return norm;
}
