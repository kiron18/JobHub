/**
 * Build a Seek.com.au search URL from a target role + city. Used as a fallback
 * when the job feed is empty or our Seek scrape is unreliable — the user can
 * jump straight to Seek, pick a JD, and bring it back to JobHub.
 *
 * Seek's URL pattern: https://au.seek.com/{role-slug}-jobs/in-{City-Slug}
 * Their router redirects partial matches (e.g. "Sydney" with no state), so we
 * only need the city. Role slug is lower-kebab; city slug keeps its capital.
 *
 * Special-character handling: anything outside [a-z0-9] becomes a hyphen, then
 * we collapse runs of hyphens and trim. Leaves us with safe URL segments and
 * no double-hyphens that some routers reject.
 */

function slugifyRole(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function slugifyCity(input: string): string {
  // Keep the city's first-letter capitalization so the URL reads naturally
  // ("in-Sydney" rather than "in-sydney"). Seek is case-insensitive but the
  // canonical form looks intentional.
  return input
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('-');
}

export function buildSeekSearchUrl(role: string | null | undefined, city: string | null | undefined): string {
  const trimmedRole = (role ?? '').trim();
  const trimmedCity = (city ?? '').trim();

  // No role at all → land on Seek's homepage. Better than 404.
  if (!trimmedRole) {
    return 'https://au.seek.com/';
  }

  const roleSlug = slugifyRole(trimmedRole);
  if (!roleSlug) return 'https://au.seek.com/';

  if (!trimmedCity) {
    return `https://au.seek.com/${roleSlug}-jobs`;
  }

  const citySlug = slugifyCity(trimmedCity);
  if (!citySlug) {
    return `https://au.seek.com/${roleSlug}-jobs`;
  }

  return `https://au.seek.com/${roleSlug}-jobs/in-${citySlug}`;
}
