import axios from 'axios';

const SERPER_URL = 'https://google.serper.dev/search';

/** Read at call time so dotenv has a chance to load first. */
function serperKey(): string {
    const k = process.env.SERPER_API_KEY;
    if (!k) console.warn('[serper] SERPER_API_KEY not set — skipping search');
    return k || '';
}

export interface SerperResult {
    title: string;
    snippet: string;
    link: string;
}

/**
 * Run a Google search via Serper.dev and return the top organic results.
 * Costs ~$0.001 per call. Use strategically — max 2 calls per generation.
 */
export async function searchSerper(query: string, num = 5): Promise<SerperResult[]> {
    const key = serperKey();
    if (!key) return [];
    try {
        const { data } = await axios.post(
            SERPER_URL,
            { q: query, num, gl: 'au', hl: 'en' },
            {
                headers: {
                    'X-API-KEY': key,
                    'Content-Type': 'application/json',
                },
                timeout: 8000,
            }
        );
        return (data.organic || []).map((r: any) => ({
            title: r.title || '',
            snippet: r.snippet || '',
            link: r.link || '',
        }));
    } catch (err: any) {
        console.warn('[serper] Search failed:', err.message);
        return [];
    }
}

/** Convenience: return just the text snippets joined for prompt injection. */
export function snippetsToText(results: SerperResult[]): string {
    return results.map(r => `- ${r.title}: ${r.snippet}`).join('\n');
}

/**
 * Scrape a URL and return its full text content via Serper Scraper API.
 * Useful for extracting job descriptions from Seek, LinkedIn, company career pages.
 */
export async function scrapeUrl(url: string): Promise<string> {
    const key = serperKey();
    if (!key) return '';
    try {
        const { data } = await axios.post(
            'https://scraper.serper.dev',
            { url },
            {
                headers: {
                    'X-API-KEY': key,
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            }
        );
        // Serper scraper returns { text: "...", ... }
        return (data.text || '').slice(0, 8000); // cap at 8k chars
    } catch (err: any) {
        console.warn('[serper] URL scrape failed:', err.message);
        return '';
    }
}


/* -- The employer-domain searchers ---------------------------------------- */

/**
 * The same two searches `serpapi.ts` provides, against Serper instead.
 *
 * `employerDomain.ts` takes its searches through the `DomainSearchers`
 * interface rather than calling a vendor directly, so swapping the engine under
 * the ladder is a matter of binding these instead of SerpApi's. The shapes are
 * deliberately identical.
 *
 * ONE DIFFERENCE, and it is not cosmetic: Serper's /search response carries no
 * knowledge graph. Asked about Atlassian, Canva and Telstra — three companies
 * that certainly have a Google knowledge panel — it returns organic results and
 * nothing else. `knowledgeGraphWebsite` is therefore always null here, and the
 * ladder's first rung never fires on Serper. Measured against the 20-ad corpus
 * that rung resolved 7 of 20 employers, so read the comparison in
 * docs/hunter-test before assuming the fallback rungs catch them.
 */
export interface GoogleSearch {
    /** Always null on Serper: the API does not return a knowledge panel. */
    knowledgeGraphWebsite: string | null;
    organic: Array<{ title: string; snippet: string; link: string }>;
}

export interface MapsResult {
    title: string;
    website: string | null;
    address: string | null;
}

/** An ordinary Google search. Organic results only — see the note above. */
export async function searchGoogle(query: string, num = 8): Promise<GoogleSearch> {
    const key = serperKey();
    if (!key) return { knowledgeGraphWebsite: null, organic: [] };
    try {
        const { data } = await axios.post(
            SERPER_URL,
            { q: query, num, gl: 'au', hl: 'en' },
            { headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, timeout: 20000 },
        );
        return {
            // Read anyway rather than hardcoded null, so the rung comes back on
            // its own if Serper ever starts returning a panel.
            knowledgeGraphWebsite: data?.knowledgeGraph?.website ?? null,
            organic: (data?.organic ?? [])
                .map((r: any) => ({ title: r?.title ?? '', snippet: r?.snippet ?? '', link: r?.link ?? '' }))
                .filter((r: { link: string }) => r.link),
        };
    } catch (err: any) {
        console.warn(`[serper] google search failed: ${err.message}`);
        return { knowledgeGraphWebsite: null, organic: [] };
    }
}

/**
 * Google Maps, for a business too small to rank on its own name.
 *
 * Dangerous without a name check, exactly as it is on SerpApi: asked for NSN
 * Electrical it returns "N.V.M. Electrical Services", and asked for Dig Deep
 * Excavations, "Diggin It Excavations". Maps substitutes a similarly named
 * nearby business silently. The caller gates on the title and the state, and
 * the state is why the address is carried through.
 */
export async function searchMaps(query: string): Promise<MapsResult[]> {
    const key = serperKey();
    if (!key) return [];
    try {
        const { data } = await axios.post(
            'https://google.serper.dev/maps',
            { q: query, gl: 'au', hl: 'en' },
            { headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, timeout: 20000 },
        );
        return (data?.places ?? []).map((r: any) => ({
            title: r?.title ?? '',
            website: r?.website ?? null,
            address: r?.address ?? null,
        }));
    } catch (err: any) {
        console.warn(`[serper] maps search failed: ${err.message}`);
        return [];
    }
}
