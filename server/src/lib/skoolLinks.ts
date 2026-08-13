/**
 * Links into Skool's admin.
 *
 * Kept apart from services/email so it can be tested without pulling in a mail
 * client that demands an API key at import time. Nothing here talks to Skool:
 * Skool has no API, and these are just addresses a human clicks.
 */

/** The group whose admin these links point into. */
const SKOOL_GROUP_SLUG = process.env.SKOOL_GROUP_SLUG || 'touch-grass-5787';

/**
 * Deep link straight to one buyer in Skool's member search.
 *
 * Skool takes the search query in the URL, so the "now go and find them" step
 * disappears: the link lands on that single member with the row already
 * filtered. Encoding matters more than it looks. A raw @ can break the query
 * string in some mail clients, and a raw + decodes as a space, either of which
 * silently opens an empty search that reads as "this person never joined" and
 * sends someone chasing a problem that does not exist.
 */
export function skoolMemberSearchUrl(email: string): string {
  return skoolMemberSearch(email);
}

/**
 * The same search, by name.
 *
 * A fallback, never the primary. Names are not unique and people join under
 * shortened or different ones, so matching on a name risks upgrading the wrong
 * member. It exists for the one case the email search genuinely cannot solve:
 * someone who paid with one address and joined Skool with another, where
 * searching the address they paid with correctly returns nothing at all.
 */
export function skoolMemberSearchByName(name: string): string | null {
  const trimmed = (name || '').trim();
  if (trimmed.length < 2) return null;
  return skoolMemberSearch(trimmed);
}

function skoolMemberSearch(query: string): string {
  return `https://www.skool.com/${SKOOL_GROUP_SLUG}/-/search`
    + `?q=${encodeURIComponent(query)}&t=members`;
}
