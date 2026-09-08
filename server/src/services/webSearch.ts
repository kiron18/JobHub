/**
 * Google, through whichever vendor is configured. One seam, two engines.
 *
 * The employer-domain ladder and the job feed both need "search Google and give
 * me the organic results", and this product has now changed its mind about who
 * provides that twice:
 *
 *   Serper.dev   the original. ~$0.001 a search.
 *   SerpApi      adopted 6 Sep 2026 when Serper hit a zero balance and started
 *                returning `400 Not enough credits` for every query — a silent
 *                failure, because the client caught it and returned an empty
 *                array, so the domain step simply found nothing for everybody.
 *   Serper.dev   again, 8 Sep 2026, topped up. SerpApi's entry plan is $75 for
 *                5,000 searches, about fifteen times Serper's rate, and its
 *                free tier caps at 250 a month.
 *
 * So the vendor is a SWITCH rather than an edit, and neither client is deleted.
 * The reason is the history above: the last time one of these ran dry the fix
 * needed a new client written under time pressure, and a codebase that can only
 * talk to the vendor that is currently broken has no way out. `SEARCH_VENDOR`
 * moves it; the default is Serper because it is the cheap one.
 *
 * ── What the two vendors do NOT share ────────────────────────────────────────
 *
 * SerpApi's /search returns `knowledge_graph.website`, Google's own answer for
 * which site belongs to an entity. Serper's returns no knowledge panel at all —
 * verified against Atlassian, Canva and Telstra, all of which certainly have
 * one. So on Serper the ladder's first rung never fires.
 *
 * That was measured before the default was changed, not assumed. Over the
 * twenty-ad corpus (src/scripts/vendor_bakeoff.ts, 8 Sep 2026) the knowledge
 * panel resolved 7 of 20 employers on SerpApi, and Serper resolved every one of
 * those 7 to THE SAME DOMAIN one rung down, on organic results. Nothing was
 * lost, four more were resolved, and Serper spent fewer searches doing it
 * because it never needed the second Maps call. The rung is not load-bearing.
 */
import * as serpapi from './serpapi';
import * as serper from './serper';

export interface OrganicResult {
    title: string;
    snippet: string;
    link: string;
}

export interface GoogleSearch {
    /**
     * Google's own answer for the entity's official site. Always null on
     * Serper, which does not return a knowledge panel — see the note above for
     * why that turned out not to matter.
     */
    knowledgeGraphWebsite: string | null;
    organic: OrganicResult[];
}

export interface MapsResult {
    title: string;
    website: string | null;
    address: string | null;
}

export type SearchVendor = 'serper' | 'serpapi';

/**
 * Read at call time rather than at import, so a deploy that changes the
 * variable does not need the module graph rebuilt to notice.
 */
export function searchVendor(): SearchVendor {
    return (process.env.SEARCH_VENDOR ?? '').toLowerCase() === 'serpapi' ? 'serpapi' : 'serper';
}

/** An ordinary Google search, with the knowledge panel read alongside it. */
export function searchGoogle(query: string, num = 8): Promise<GoogleSearch> {
    return searchVendor() === 'serpapi'
        ? serpapi.searchGoogle(query, num)
        : serper.searchGoogle(query, num);
}

/**
 * Google Maps, for a business too small to rank on its own name.
 *
 * Dangerous without a name check on either vendor: asked for NSN Electrical it
 * returns "N.V.M. Electrical Services", and asked for Dig Deep Excavations,
 * "Diggin It Excavations". Maps substitutes a similarly named nearby business
 * silently. The caller gates on the title and on the state in the address.
 */
export function searchMaps(query: string): Promise<MapsResult[]> {
    return searchVendor() === 'serpapi'
        ? serpapi.searchMaps(query)
        : serper.searchMaps(query);
}
