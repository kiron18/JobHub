/**
 * Is this a real Australian business, and what is it actually called?
 *
 * The domain picker's remaining failures are not ranking failures. They are
 * cases where the company's own site was never in the search results at all,
 * because the name in the ad is not the name the business trades under:
 *
 *   "BHL"                      an acronym, resolved to ala.org.au
 *   "Bioscience"               a common noun, resolved to buy.nsw.gov.au
 *   "Dispensary on Lygon"      a tiny business, resolved to glassdoor.com.au
 *
 * No amount of re-ranking fixes those, and no deny-list catches them either,
 * because the right answer was never a candidate. What they need is a better
 * search term, or an honest admission that we do not know who this is.
 *
 * The Australian Business Register is the authority on both. It is free, it is
 * the actual companies register rather than a scrape of one, and it covers
 * every entity that can legally employ anyone in this country.
 *
 * What it does NOT return is a website. There is no URL field anywhere in the
 * response, so this is not a shortcut past the domain search. It gives two
 * things the search cannot get for itself: the registered or trading name to
 * search WITH, and the knowledge that the entity exists at all. A name that
 * matches no active ABN is a name we should stop spending money on.
 *
 * Requires ABN_LOOKUP_GUID, free from abr.business.gov.au/Documentation/WebServiceRegistration.
 * Absent, every function here returns null and the caller carries on exactly as
 * it did before, which is the same contract fetchDirectory keeps.
 */
import axios from 'axios';

export interface AbnEntity {
    abn: string;
    /** The name the register holds, which may be legal, main, or trading. */
    name: string;
    /** "Legal Name", "Trading Name", "Business Name", "Main Name". */
    nameType: string;
    /** ABR's own 0-100 confidence in the match. */
    score: number;
    state: string | null;
    postcode: string | null;
    isActive: boolean;
}

function guid(): string {
    const g = process.env.ABN_LOOKUP_GUID;
    if (!g) console.warn('[abn] ABN_LOOKUP_GUID not set, entity lookup skipped');
    return g || '';
}

/**
 * ABR's JSON endpoints are JSONP: the body is `callback({...})` with no
 * content-type to warn you. Unwrapping it is the whole parse.
 */
function unwrapJsonp(body: string): any {
    const open = body.indexOf('(');
    const close = body.lastIndexOf(')');
    if (open < 0 || close <= open) return null;
    try {
        return JSON.parse(body.slice(open + 1, close));
    } catch {
        return null;
    }
}

/**
 * ABR's matcher is deliberately generous, so it answers almost any string with
 * something. Below this it is telling us it found nothing it believes in, and
 * a weak match is worse than no match: it would send the search off after a
 * business that has nothing to do with the ad.
 */
export const MIN_MATCH_SCORE = 95;

/**
 * Every registered name for a company name, best match first.
 *
 * Returns null when the lookup could not run at all (no GUID, network, bad
 * response) and an empty array when it ran and the register knows nothing.
 * The caller must be able to tell those apart: the first means try again
 * later, the second means this employer may not exist under this name.
 */
export async function searchEntities(company: string, maxResults = 10): Promise<AbnEntity[] | null> {
    const g = guid();
    if (!g || !company?.trim()) return null;

    try {
        const { data } = await axios.get('https://abr.business.gov.au/json/MatchingNames.aspx', {
            params: { name: company.trim(), maxResults, guid: g },
            timeout: 10000,
            responseType: 'text',
            transformResponse: [(d) => d],
        });

        const parsed = unwrapJsonp(typeof data === 'string' ? data : String(data));
        if (!parsed) return null;
        if (parsed.Message) {
            console.warn(`[abn] lookup rejected for "${company}": ${parsed.Message}`);
            return null;
        }

        const names = Array.isArray(parsed.Names) ? parsed.Names : [];
        return names
            .map((n: any): AbnEntity => ({
                abn: String(n?.Abn ?? ''),
                name: String(n?.Name ?? '').trim(),
                nameType: String(n?.NameType ?? ''),
                score: typeof n?.Score === 'number' ? n.Score : 0,
                state: n?.State || null,
                postcode: n?.Postcode || null,
                // ABR spells the key with a space, which is easy to miss and
                // silently marks every entity inactive when you do.
                isActive: n?.AbnStatus === 'Active' || n?.['Is Current'] === true,
            }))
            .filter((e: AbnEntity) => e.abn && e.name)
            .sort((a: AbnEntity, b: AbnEntity) => b.score - a.score);
    } catch (err: any) {
        console.warn(`[abn] lookup failed for "${company}": ${err.message}`);
        return null;
    }
}

/** A name is an acronym when it is short, capitalised, and has no real words. */
export function looksLikeAcronym(company: string): boolean {
    const t = (company || '').trim();
    return /^[A-Z0-9&.\- ]{2,8}$/.test(t) && !/\s/.test(t.replace(/[.&-]/g, ''));
}

/**
 * The name worth searching with, and whether the register recognises it.
 *
 * Only overrides the ad's own wording when the ad's wording is the problem: an
 * acronym, or a name so generic the search returned nothing about the company.
 * A full, distinctive company name already searches well, and swapping it for
 * a legal entity name would trade "Bank Australia" for a numbered holding
 * company, which searches worse.
 */
export async function resolveEntityName(
    company: string,
    opts: { force?: boolean } = {},
): Promise<{ name: string; entity: AbnEntity | null; recognised: boolean }> {
    const fallback = { name: company, entity: null, recognised: false };
    if (!company?.trim()) return fallback;

    const results = await searchEntities(company);
    if (results === null) return fallback;          // lookup unavailable, not a verdict
    if (!results.length) return { ...fallback, recognised: false };

    const best = results.find(e => e.isActive && e.score >= MIN_MATCH_SCORE) ?? null;
    if (!best) return fallback;

    const shouldSwap = opts.force || looksLikeAcronym(company);
    return {
        name: shouldSwap ? best.name : company,
        entity: best,
        recognised: true,
    };
}
