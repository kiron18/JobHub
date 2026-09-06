/**
 * Google, through SerpApi.
 *
 * Replaces `serper.ts` for anything that needs to find an employer's website.
 * Serper.dev is at zero balance and returns `400 Not enough credits` for every
 * query, which is a silent failure at the call site: `searchSerper` catches it,
 * warns, and returns an empty array, so the domain step simply finds nothing
 * and the whole contact pipeline reports "no domain" for every employer.
 *
 * These are different companies with different endpoints and different response
 * shapes, so this is a new client rather than a changed key.
 *
 * Two fields matter here that `serper.ts` never read, and both are the reason
 * the domain step used to pick the wrong company:
 *
 * `knowledge_graph.website` is Google's own answer for which site belongs to an
 * entity, and it arrives inside an ordinary search response at no extra cost.
 * It beats ranking organic results by position, which is how a youth service
 * resolved to nationalredress.gov.au.
 *
 * `engine=google_maps` returns `website` AND `address` for a local business,
 * and the address carries the state. For a one-location Australian employer
 * that is the strongest signal available, and the state is what catches a
 * Sydney job matched to a Perth business.
 *
 * Costs one search per call, INCLUDING a call that returns nothing, which is
 * the opposite of Hunter. SerpApi caches a query for about an hour and a cached
 * repeat is free and uncounted, so `no_cache` is deliberately never set.
 */
import axios from 'axios';

const ENDPOINT = 'https://serpapi.com/search.json';

/** Read at call time so dotenv has had its chance. */
function serpapiKey(): string {
    const k = process.env.SERPAPI_API_KEY;
    if (!k) console.warn('[serpapi] SERPAPI_API_KEY not set, search skipped');
    return k || '';
}

export interface OrganicResult {
    title: string;
    snippet: string;
    link: string;
}

export interface GoogleSearch {
    /** Google's own answer for the entity's official site, when it shows a panel. */
    knowledgeGraphWebsite: string | null;
    organic: OrganicResult[];
}

export interface MapsResult {
    title: string;
    website: string | null;
    address: string | null;
}

async function call(params: Record<string, string>): Promise<any | null> {
    const key = serpapiKey();
    if (!key) return null;
    try {
        const { data } = await axios.get(ENDPOINT, {
            params: { ...params, api_key: key, hl: 'en', gl: 'au' },
            timeout: 20000,
        });
        return data;
    } catch (err: any) {
        console.warn(`[serpapi] ${params.engine} search failed: ${err.message}`);
        return null;
    }
}

/** An ordinary Google search, with the knowledge panel read alongside the results. */
export async function searchGoogle(query: string, num = 8): Promise<GoogleSearch> {
    const data = await call({ engine: 'google', q: query, num: String(num) });
    return {
        knowledgeGraphWebsite: data?.knowledge_graph?.website ?? null,
        organic: (data?.organic_results ?? []).map((r: any) => ({
            title: r?.title ?? '',
            snippet: r?.snippet ?? '',
            link: r?.link ?? '',
        })).filter((r: OrganicResult) => r.link),
    };
}

/**
 * Google Maps, for a business too small to rank on its own name.
 *
 * Dangerous without a name check: asked for NSN Electrical it returned
 * "N.V.M. Electrical Services" at nvmelectrical.com, and asked for Dig Deep
 * Excavations it returned "Diggin It Excavations". Maps substitutes a similarly
 * named nearby business silently. The caller gates on the title and the state.
 */
export async function searchMaps(query: string): Promise<MapsResult[]> {
    const data = await call({ engine: 'google_maps', q: query, type: 'search' });
    return (data?.local_results ?? []).map((r: any) => ({
        title: r?.title ?? '',
        website: r?.website ?? null,
        address: r?.address ?? null,
    }));
}
