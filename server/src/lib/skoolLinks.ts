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
  return `https://www.skool.com/${SKOOL_GROUP_SLUG}/-/search`
    + `?q=${encodeURIComponent(email)}&t=members`;
}
