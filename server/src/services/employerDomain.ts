/**
 * Company name in, the employer's own mail domain out.
 *
 * This is the ladder that was measured over the twenty-ad corpus on 2026-09-06
 * and it lives here, in a service, rather than inside the test harness, because
 * a rule that only exists in the harness is a rule the product does not have.
 * The harness and `research.ts` both call this function, so what was measured
 * and what ships are the same code.
 *
 * The order is cheapest first, and every rung is gated on the company's name.
 * The gate is the entire point: each source below has a characteristic way of
 * returning a confident answer about the wrong company.
 *
 *   Hunter's domain finder   ignores geography. NSW Police Force came back as
 *                            police.wa.gov.au on an EXACT name match, and
 *                            Department of Defence as defence.ie.
 *   Google Maps              silently substitutes a similarly named nearby
 *                            business. NSN Electrical came back as "N.V.M.
 *                            Electrical Services".
 *   Organic position         returns pages ABOUT the company. Brisbane Youth
 *                            Service came back as nationalredress.gov.au.
 *
 * None of those looks like a failure at the call site. Only the name check
 * separates them from an answer.
 */
import { pickCompanyDomain, nameMatchStrength, isBlacklisted, type DomainCandidate } from './companyDomain';
import { pickMailableDomain, type MxLookup, mxOverHttps } from './mailDomain';
import { searchGoogle, searchMaps, type GoogleSearch, type MapsResult } from './webSearch';

/** Australian state, as it appears in an ad header or a Maps address. */
export const STATE = /\b(NSW|VIC|QLD|WA|SA|TAS|NT|ACT)\b/;

/**
 * How strongly a Maps result has to bear the employer's name.
 *
 * Higher than the other rungs, and it has to be. `nameMatchStrength` scores 1
 * for "the host contains one of the company's words", and for a trades business
 * that one word is the industry: asked for NSN Electrical, Maps returned
 * "N.V.M. Electrical Services" at nvmelectrical.com, which scores 1 purely on
 * the word `electrical` and would otherwise be accepted. The identity is `nsn`,
 * and it is absent.
 *
 * At 2 the host has to carry two of the company's words, be one of them
 * outright, be the whole name, or be its acronym. Every Maps result that was
 * correct in the corpus scored 4 (prospeedracing, strongpilates) and the one
 * that was wrong scored 1, so the line sits in a wide gap rather than on a
 * knife edge.
 *
 * `MAPS_NAME_STRENGTH_MIN` moves it; 1 restores the old behaviour.
 */
export function mapsNameStrengthMin(): number {
    const v = Number(process.env.MAPS_NAME_STRENGTH_MIN);
    return Number.isFinite(v) && v >= 0 ? v : 2;
}

export type DomainSource = 'KNOWLEDGE_GRAPH' | 'ORGANIC' | 'MAPS' | null;

export interface EmployerDomain {
    domain: string | null;
    source: DomainSource;
    /** Plain words for the evidence record and for debugging a wrong pick. */
    note: string;
    /** True when the top pick receives no mail and a runner-up was used. */
    corrected: boolean;
    /** How many SerpApi searches this call spent. One, or two when Maps ran. */
    searches: number;
}

/**
 * The search calls, injectable so the ladder can be tested without a network
 * and so the corpus harness can hand in its disk cache.
 */
export interface DomainSearchers {
    google: (query: string) => Promise<GoogleSearch>;
    maps: (query: string) => Promise<MapsResult[]>;
    mx: MxLookup;
}

export const liveSearchers: DomainSearchers = {
    google: (q) => searchGoogle(q),
    maps: (q) => searchMaps(q),
    mx: mxOverHttps,
};

function hostOf(url: string | null | undefined): string | null {
    try {
        return new URL(String(url)).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return null;
    }
}

/**
 * Resolve the employer's domain, and confirm it receives mail.
 *
 * Returns `domain: null` rather than a guess. A wrong domain is worse than no
 * domain: it produces a perfectly formatted address at a company the candidate
 * never applied to, and it also spends a directory credit to do it.
 *
 * `state` is optional and only sharpens the Maps rung. Without it, a Maps
 * result is still gated on the name, just not on the address.
 */
export async function resolveEmployerDomain(
    company: string,
    state: string | null = null,
    searchers: DomainSearchers = liveSearchers,
): Promise<EmployerDomain> {
    if (!company?.trim()) {
        return { domain: null, source: null, note: 'no company name', corrected: false, searches: 0 };
    }

    let searches = 0;

    // Rungs 1 and 2 share a single search: the knowledge panel and the organic
    // results arrive in the same response, so reading both costs nothing extra.
    const g = await searchers.google(`${company} Australia`);
    searches++;

    const kg = hostOf(g.knowledgeGraphWebsite);
    if (kg && !isBlacklisted(kg) && nameMatchStrength(kg, company) >= 1) {
        return finish(kg, [], 'KNOWLEDGE_GRAPH', 'Google knowledge panel');
    }

    const candidates: DomainCandidate[] = g.organic
        .map((r, position) => ({ host: hostOf(r.link), position }))
        .filter((c): c is DomainCandidate => Boolean(c.host));

    const organic = pickCompanyDomain(candidates, company);
    // `position` means nothing bore the name and the top result simply won on
    // rank. That is the pick that produced nationalredress.gov.au, so it is
    // never accepted, only reported.
    if (organic.domain && organic.reason !== 'position') {
        return finish(organic.domain, organic.alternatives, 'ORGANIC', organic.reason);
    }

    // Rung 3: Maps. A second search, spent only when the first found nothing
    // bearing the name, which is exactly the small local employer Maps is good
    // at and organic ranking is bad at.
    const local = await searchers.maps(`${company} ${state ?? 'Australia'}`);
    searches++;

    for (const r of local.slice(0, 5)) {
        const host = hostOf(r.website);
        if (!host || isBlacklisted(host)) continue;

        // Either the domain or the listing's own name has to bear the company
        // name, at the higher Maps threshold. Maps returns the right business
        // under a slightly different trading name often enough that requiring
        // BOTH would lose real hits, so it is either, but neither is cheap.
        const min = mapsNameStrengthMin();
        if (nameMatchStrength(host, company) < min && nameMatchStrength(r.title, company) < min) continue;

        // The address is what Maps gives us and nothing else does. A Perth
        // business is not the answer to a Sydney vacancy, however well the name
        // matches. An address with no state in it is not evidence either way.
        const addr = r.address ?? '';
        if (state && STATE.test(addr) && addr.match(STATE)?.[1] !== state) continue;

        return finish(host, [], 'MAPS', `${r.title}${addr ? `, ${addr}` : ''}`);
    }

    return {
        domain: null,
        source: null,
        note: organic.domain
            ? `nothing bore the name; best positional was ${organic.domain}`
            : 'no candidate bore the company name',
        corrected: false,
        searches,
    };

    /**
     * The MX gate, applied to whichever rung won.
     *
     * A website nobody receives mail at is not the employer's. Three of thirty
     * sampled employers resolved to a digital archive, a consultation
     * subdomain and a tourism site, all of which bear the name convincingly and
     * none of which publish an MX record.
     */
    async function finish(
        domain: string,
        alternatives: string[],
        source: DomainSource,
        note: string,
    ): Promise<EmployerDomain> {
        const mailable = await pickMailableDomain([domain, ...alternatives], company, searchers.mx);
        return {
            domain: mailable.domain,
            source: mailable.domain ? source : null,
            note: mailable.domain
                ? (mailable.corrected ? `${note} (${mailable.rejected} receives no mail)` : note)
                : `${domain} receives no mail and no alternative bears the name`,
            corrected: mailable.corrected,
            searches,
        };
    }
}

/** The state named in a job ad's opening, for the Maps rung. Null when absent. */
export function stateOf(jdText: string | null | undefined): string | null {
    return (jdText ?? '').slice(0, 600).match(STATE)?.[1] ?? null;
}
