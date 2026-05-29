/**
 * Approved Sponsor List → enriched, searchable dataset.
 *
 * Reads the Dept of Home Affairs FOI "Accredited Sponsors" PDF (just company
 * names), researches each company via Serper (Google), and uses a cheap LLM to
 * structure the search snippet into { industry, website, locations, hiringProfile }.
 * A direct careersUrl is kept ONLY when a real result link lives on the company's
 * own domain; otherwise it is null and a ready-made Google "<company> careers"
 * search (careersSearchUrl) is always provided as the fallback.
 * Output is a JSON file you can inspect, plus optional Pinecone indexing so the
 * site can do "profession + location → matching sponsors" semantic search.
 *
 * The expensive part (search + LLM) runs ONCE at build time. Per-user searches
 * later are just a single embedding lookup against Pinecone — effectively free.
 *
 * Usage (run from the `server/` folder):
 *   # 1. Coverage test — 30 companies, ~5 cents, writes the JSON file:
 *   npx tsx src/scripts/enrich_sponsors.ts --limit 30
 *
 *   # 2. Full run — all ~3,800 companies (~$5-25, resumable if interrupted):
 *   npx tsx src/scripts/enrich_sponsors.ts
 *
 *   # 3. Index the finished JSON into Pinecone for semantic search:
 *   npx tsx src/scripts/enrich_sponsors.ts --index
 *
 *   # 4. Re-clean careers links in an existing JSON (no API cost): drop any
 *   #    off-domain careersUrl and (re)build the Google search fallback:
 *   npx tsx src/scripts/enrich_sponsors.ts --fix-careers
 *
 * Flags:
 *   --pdf <path>    Source PDF (default: the Downloads path below)
 *   --limit <n>     Only enrich the first N not-yet-done companies
 *   --out <path>    Output JSON (default: server/data/sponsors_enriched.json)
 *   --index         Skip enrichment; embed the existing JSON into Pinecone
 *   --fix-careers   Skip enrichment; re-derive careersUrl/careersSearchUrl in place
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import pdf from 'pdf-parse';
import { Pinecone } from '@pinecone-database/pinecone';
import { searchSerper, snippetsToText, scrapeUrl, type SerperResult } from '../services/serper';
import { callLLM, embedText } from '../services/llm';
import { parseLLMJson } from '../utils/parseLLMResponse';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// ── Config ──────────────────────────────────────────────────────────────────
const DEFAULT_PDF =
    'C:\\Users\\Kiron\\Downloads\\AGC-Business\\Resources-Guides\\Approved-Sponsor-List-2025.pdf';
const DEFAULT_OUT = path.join(__dirname, '..', '..', 'data', 'sponsors_enriched.json');
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'jobhub-achievements';
const PINECONE_NAMESPACE = 'sponsors';
const SAVE_EVERY = 10;        // checkpoint to disk every N companies
const DELAY_MS = 250;         // be polite to Serper / OpenRouter between companies

// ── Types ─────────────────────────────────────────────────────────────────-─
interface EnrichedSponsor {
    rawName: string;
    cleanName: string;
    website: string | null;
    careersUrl: string | null;       // trusted direct careers page (on the company's own domain), else null
    careersSearchUrl: string;        // ready-made Google "<company> careers" search — always present
    industry: string;
    locations: string[];
    hiringProfile: string;
    confidence: 'high' | 'medium' | 'low';
}

// ── PDF parsing ───────────────────────────────────────────────────────────-─

// Lines in the FOI PDF that are boilerplate, not company names.
const NOISE = [
    /australian government/i,
    /department of home affairs/i,
    /freedom of information/i,
    /list of accredited/i,
    /r[ae]leased by/i,
    /^notes:?$/i,
    /^caveats:?$/i,
    /^source:/i,
    /responsibility of the area/i,
    /abf act/i,
    /privacy prin/i,
    /this information is provided/i,
    /relevant legislation/i,
    /stakeholders to ensure/i,
];

function isNoise(line: string): boolean {
    if (line.length < 3) return true;
    if (/^\d{1,4}$/.test(line)) return true;     // page numbers (001 … 129)
    if (/^[e•·]\s/.test(line)) return true;       // OCR'd bullet points in the caveats
    return NOISE.some((re) => re.test(line));
}

async function parseCompanyNames(pdfPath: string): Promise<string[]> {
    const buffer = fs.readFileSync(pdfPath);
    const data = await pdf(buffer);
    const seen = new Set<string>();
    const names: string[] = [];
    for (const raw of data.text.split('\n')) {
        const line = raw.trim();
        if (isNoise(line)) continue;
        const key = line.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(line);
    }
    return names;
}

// ── Enrichment ────────────────────────────────────────────────────────────-─

// Australian second-level domains (e.g. example.com.au) need the last 3 labels.
const AU_SLDS = new Set(['com', 'net', 'org', 'edu', 'gov', 'asn', 'id']);

/** Registrable domain, AU-aware: careers.acme.com.au → acme.com.au, www.acme.io → acme.io */
function registrableDomain(input: string): string | null {
    let host: string;
    try {
        host = new URL(input.includes('://') ? input : `https://${input}`).hostname.toLowerCase();
    } catch {
        return null;
    }
    host = host.replace(/^www\./, '');
    const parts = host.split('.');
    if (parts.length < 2) return host || null;
    if (parts[parts.length - 1] === 'au' && parts.length >= 3 && AU_SLDS.has(parts[parts.length - 2])) {
        return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
}

/** True when both URLs sit on the same company domain (subdomains allowed). */
function sameSite(a: string | null, b: string | null): boolean {
    if (!a || !b) return false;
    const da = registrableDomain(a);
    const db = registrableDomain(b);
    return da !== null && da === db;
}

// Path that looks like a careers / jobs page.
const CAREERS_PATH = /\/careers?(\/|$)|(\/|-)(jobs?|join|join-us|work-with-us|vacancies)(\/|$)/i;

/**
 * A careers URL is trusted ONLY when a real result link points at a careers/jobs
 * page on the company's own domain. Anything else (third-party job boards, gov
 * pages, guessed URLs) is rejected — we return null and fall back to a search.
 */
function pickCareersUrl(results: SerperResult[], website: string | null): string | null {
    if (!website) return null;
    for (const r of results) {
        if (r.link && CAREERS_PATH.test(r.link) && sameSite(r.link, website)) return r.link;
    }
    return null;
}

/** Ready-made Google search a job seeker can click when no direct page is trusted. */
function googleCareersSearch(cleanName: string): string {
    return `https://www.google.com/search?q=${encodeURIComponent(`${cleanName} careers Australia`)}`;
}

function buildPrompt(rawName: string, snippets: string): string {
    return `You are building a directory of Australian visa-sponsoring employers for job seekers.

COMPANY NAME (from a government list, may contain OCR errors): "${rawName}"

GOOGLE SEARCH RESULTS:
${snippets || '(no results found)'}

Using ONLY the search results above plus widely-known facts, return a JSON object:
{
  "cleanName": "the corrected official company name",
  "website": "primary domain like example.com, or null if unknown",
  "industry": "short industry label, e.g. 'Healthcare', 'Technology / IT Services', 'Construction'",
  "locations": ["Australian cities/states mentioned, e.g. 'Sydney NSW'; [] if none found"],
  "hiringProfile": "ONE sentence: the sector plus the kinds of roles/professions this employer typically hires, to help a job seeker judge fit",
  "confidence": "high | medium | low — how sure you are this is correct"
}

Rules:
- Do NOT invent locations. If the results don't state an Australian location, return [].
- Only Australian locations.
- If the search results are empty or irrelevant, infer industry/hiringProfile from the name if it is obvious (e.g. a "Secondary College" is Education), set confidence "low", and leave website null and locations [].
- Return ONLY the JSON object.`;
}

/**
 * If the LLM returned no locations but we have a website, scrape it for
 * a Contact / About page and extract Australian locations.
 */
async function scrapeLocations(website: string): Promise<string[]> {
    const contactUrls = [
        website.replace(/\/$/, '') + '/contact',
        website.replace(/\/$/, '') + '/contact-us',
        website.replace(/\/$/, '') + '/about',
        website.replace(/\/$/, '') + '/about-us',
        website.replace(/\/$/, '') + '/locations',
        website.replace(/\/$/, '') + '/office-locations',
    ];
    for (const url of contactUrls) {
        const text = await scrapeUrl(url);
        if (!text) continue;
        // Look for Australian state/territory mentions
        const auPlaces: string[] = [];
        const states = /NSW|New South Wales|Victoria|VIC|Queensland|QLD|Western Australia|WA|South Australia|SA|Tasmania|TAS|Australian Capital Territory|ACT|Northern Territory|NT/i;
        const cities = /Sydney|Melbourne|Brisbane|Perth|Adelaide|Canberra|Hobart|Darwin|Gold Coast|Newcastle|Sunshine Coast|Geelong|Wollongong|Cairns|Townsville/i;
        for (const match of text.matchAll(new RegExp(cities.source, 'gi'))) {
            auPlaces.push(match[0]);
        }
        for (const match of text.matchAll(new RegExp(states.source, 'gi'))) {
            auPlaces.push(match[0]);
        }
        if (auPlaces.length) return [...new Set(auPlaces.map(l => l.replace(/^./, c => c.toUpperCase())))];
        // Check for "Australia" + address patterns nearby
        if (/australia/i.test(text)) {
            const idx = text.toLowerCase().indexOf('australia');
            const chunk = text.slice(Math.max(0, idx - 200), idx + 200);
            const addrMatch = chunk.match(/([A-Z][A-Za-z\s,]+)\s*(?:Australia)/);
            if (addrMatch) {
                // Try to pull a suburb/city name from before "Australia"
                const suburb = chunk.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*[,♥]\s*(?:Australia)/);
                if (suburb) return [suburb[1].trim()];
            }
        }
    }
    return [];
}

async function enrichOne(rawName: string): Promise<EnrichedSponsor> {
    const results = await searchSerper(`${rawName} Australia`, 5);
    const raw = await callLLM(buildPrompt(rawName, snippetsToText(results)), true);
    const parsed = parseLLMJson(raw);
    const cleanName = typeof parsed.cleanName === 'string' && parsed.cleanName.trim() ? parsed.cleanName.trim() : rawName;
    const website = typeof parsed.website === 'string' && parsed.website.trim() ? parsed.website.trim() : null;
    let locations: string[] = Array.isArray(parsed.locations)
        ? parsed.locations.filter((l: any) => typeof l === 'string')
        : [];
    // Fallback: scrape website for locations if LLM returned none
    if (!locations.length && website) {
        const scraped = await scrapeLocations(website);
        if (scraped.length) {
            locations = scraped;
        }
    }
    return {
        rawName,
        cleanName,
        website,
        careersUrl: pickCareersUrl(results, website),
        careersSearchUrl: googleCareersSearch(cleanName),
        industry: typeof parsed.industry === 'string' ? parsed.industry.trim() : 'Unknown',
        locations,
        hiringProfile: typeof parsed.hiringProfile === 'string' ? parsed.hiringProfile.trim() : '',
        confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
    };
}

function loadExisting(outPath: string): EnrichedSponsor[] {
    if (!fs.existsSync(outPath)) return [];
    try {
        return JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    } catch {
        console.warn('⚠️  Could not parse existing output file — starting fresh.');
        return [];
    }
}

function save(outPath: string, records: EnrichedSponsor[]) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(records, null, 2));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runEnrichment(pdfPath: string, outPath: string, limit: number | null) {
    if (!fs.existsSync(pdfPath)) {
        console.error(`❌ PDF not found at: ${pdfPath}\n   Pass the correct path with --pdf "<path>".`);
        process.exit(1);
    }

    console.log(`📄 Parsing ${pdfPath} ...`);
    const names = await parseCompanyNames(pdfPath);
    console.log(`   Found ${names.length} unique company names.`);

    const records = loadExisting(outPath);
    const done = new Set(records.map((r) => r.rawName));
    const todo = names.filter((n) => !done.has(n));
    const batch = limit ? todo.slice(0, limit) : todo;

    console.log(`   ${done.size} already enriched, ${batch.length} to process this run.\n`);

    let processed = 0;
    for (const name of batch) {
        processed++;
        try {
            const rec = await enrichOne(name);
            records.push(rec);
            const loc = rec.locations.length ? rec.locations.join(', ') : 'no location';
            const careers = rec.careersUrl ? ` | careers: ${rec.careersUrl}` : ' | careers: search';
            console.log(`[${processed}/${batch.length}] ${rec.cleanName} → ${rec.industry} | ${loc} (${rec.confidence})${careers}`);
        } catch (err: any) {
            console.warn(`[${processed}/${batch.length}] ⚠️  ${name} — failed: ${err.message}`);
        }
        if (processed % SAVE_EVERY === 0) save(outPath, records);
        await sleep(DELAY_MS);
    }

    save(outPath, records);
    const withLoc = records.filter((r) => r.locations.length).length;
    const withCareers = records.filter((r) => r.careersUrl).length;
    console.log(`\n✅ Done. ${records.length} total enriched → ${outPath}`);
    console.log(`   Location coverage: ${withLoc}/${records.length} (${Math.round((withLoc / Math.max(records.length, 1)) * 100)}%)`);
    console.log(`   Direct careers pages: ${withCareers}/${records.length} (the rest use a Google search fallback)`);
}

// ── Pinecone indexing ─────────────────────────────────────────────────────-─

async function runIndex(outPath: string) {
    if (!process.env.PINECONE_API_KEY) {
        console.error('❌ PINECONE_API_KEY is not set.');
        process.exit(1);
    }
    const records = loadExisting(outPath);
    if (!records.length) {
        console.error(`❌ No enriched data at ${outPath}. Run enrichment first.`);
        process.exit(1);
    }

    const index = new Pinecone({ apiKey: process.env.PINECONE_API_KEY }).index(PINECONE_INDEX_NAME);
    console.log(`🔌 Indexing ${records.length} sponsors into "${PINECONE_INDEX_NAME}" (namespace: ${PINECONE_NAMESPACE}) ...`);

    let n = 0;
    for (const r of records) {
        const text = `${r.cleanName}. Industry: ${r.industry}. Hiring: ${r.hiringProfile}. Locations: ${r.locations.join(', ') || 'unknown'}.`;
        try {
            const vector = await embedText(text);
            await index.namespace(PINECONE_NAMESPACE).upsert({
                records: [
                    {
                        id: r.rawName,
                        values: vector,
                        metadata: {
                            name: r.cleanName,
                            website: r.website ?? '',
                            careersUrl: r.careersUrl ?? '',
                            careersSearchUrl: r.careersSearchUrl ?? googleCareersSearch(r.cleanName),
                            industry: r.industry,
                            locations: r.locations,
                            hiringProfile: r.hiringProfile,
                            type: 'sponsor',
                        },
                    },
                ],
            } as any);
            n++;
            if (n % 50 === 0) console.log(`   indexed ${n}/${records.length}`);
        } catch (err: any) {
            console.warn(`   ⚠️  ${r.cleanName} — index failed: ${err.message}`);
        }
        await sleep(50);
    }
    console.log(`\n✅ Indexed ${n}/${records.length} sponsors into Pinecone.`);
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function arg(flag: string): string | undefined {
    const i = process.argv.indexOf(flag);
    return i !== -1 ? process.argv[i + 1] : undefined;
}

/**
 * Re-derive careers links in an existing JSON without spending any API budget.
 * Drops any careersUrl that is not on the company's own domain (the common
 * failure mode: a guessed or third-party link), and (re)builds the Google
 * search fallback for every record. Note: it verifies the *domain*, not that an
 * on-domain page resolves — re-run full enrichment for that level of certainty.
 */
function fixCareers(outPath: string) {
    const records = loadExisting(outPath);
    if (!records.length) {
        console.error(`❌ No data at ${outPath}. Nothing to fix.`);
        process.exit(1);
    }
    let kept = 0;
    let dropped = 0;
    for (const r of records) {
        const trusted = sameSite(r.careersUrl, r.website) ? r.careersUrl : null;
        if (r.careersUrl && !trusted) dropped++;
        if (trusted) kept++;
        r.careersUrl = trusted;
        r.careersSearchUrl = googleCareersSearch(r.cleanName);
    }
    save(outPath, records);
    console.log(`✅ Fixed careers links in ${records.length} records → ${outPath}`);
    console.log(`   Kept ${kept} on-domain careers pages, dropped ${dropped} off-domain/guessed; search fallback added to all.`);
}

async function main() {
    const outPath = arg('--out') || DEFAULT_OUT;
    if (process.argv.includes('--index')) {
        await runIndex(outPath);
        return;
    }
    if (process.argv.includes('--fix-careers')) {
        fixCareers(outPath);
        return;
    }
    const pdfPath = arg('--pdf') || DEFAULT_PDF;
    const limitArg = arg('--limit');
    const limit = limitArg ? parseInt(limitArg, 10) : null;
    await runEnrichment(pdfPath, outPath, limit);
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
