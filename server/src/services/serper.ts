import axios from 'axios';

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_URL = 'https://google.serper.dev/search';

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
    if (!SERPER_API_KEY) {
        console.warn('[serper] SERPER_API_KEY not set — skipping search');
        return [];
    }
    try {
        const { data } = await axios.post(
            SERPER_URL,
            { q: query, num, gl: 'au', hl: 'en' },
            {
                headers: {
                    'X-API-KEY': SERPER_API_KEY,
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
    if (!SERPER_API_KEY) {
        console.warn('[serper] SERPER_API_KEY not set — cannot scrape URL');
        return '';
    }
    try {
        const { data } = await axios.post(
            'https://scraper.serper.dev',
            { url },
            {
                headers: {
                    'X-API-KEY': SERPER_API_KEY,
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
