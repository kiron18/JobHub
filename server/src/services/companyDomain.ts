/**
 * Company name in, the company's own website out.
 *
 * This is the step that decides whether a contact email is real. Feed the wrong
 * domain to an email finder and you get a perfectly formatted address at a
 * company the candidate never applied to, which is worse than no address.
 *
 * The old ranking was `(N - position) * auRank`, where auRank gave `.gov.au`
 * the top weight. That is precisely backwards. Australian government and
 * directory sites are enormous, so they routinely outrank a company's own
 * website when you search the company's name, and the AU bonus then promoted
 * them further. Measured over 30 real applications it produced:
 *
 *   Brisbane Youth Service            -> nationalredress.gov.au
 *   Scania                            -> vehiclerecalls.gov.au
 *   Hudson                            -> finance.gov.au
 *   Royal Australasian College of ... -> healthdirect.gov.au
 *
 * Every one of those is a page that TALKS ABOUT the company. In each case the
 * company's real site had already been retrieved and was sitting in second or
 * third place.
 *
 * So the fix is not better retrieval, it is better choosing: prefer a domain
 * that looks like the company's own name, and stop handing `.gov.au` a bonus
 * unless the employer is actually a government body.
 *
 * The acronym guard exists because the obvious name-match rule gets government
 * departments wrong. "Department of Climate Change, Energy, the Environment and
 * Water" really does live at dcceew.gov.au, which shares no words with its name
 * at all. Without the guard the rule "fixes" that one into energy.gov.au, which
 * is a different agency.
 */

/** Sites that describe companies but are never the company. */
export const DOMAIN_BLACKLIST = [
    'seek.com.au', 'linkedin.com', 'indeed.com', 'glassdoor.com', 'glassdoor.com.au',
    'jora.com', 'adzuna.com.au', 'facebook.com', 'wikipedia.org', 'abr.business.gov.au',
    'youtube.com', 'twitter.com', 'x.com', 'instagram.com', 'crunchbase.com',
    'bloomberg.com', 'zoominfo.com', 'apollo.io', 'rocketreach.co', 'careerone.com.au',
    'ethicaljobs.com.au', 'jobactive.gov.au', 'workforceaustralia.gov.au', 'gumtree.com.au',
    'yellowpages.com.au', 'truelocal.com.au', 'localsearch.com.au', 'jobsearch.gov.au',
    'probonoaustralia.com.au', 'applynow.net.au', 'livehire.com', 'pageuppeople.com',
    'smartrecruiters.com', 'workday.com', 'greenhouse.io', 'lever.co', 'reddit.com',
    // Added after the bake-off: every one of these was picked for a real company.
    'bebee.com', 'talent.com', 'jobilize.com', 'aeroleads.com', 'leadiq.com',
    'builtin.com', 'precisely.com', 'ibisworld.com', 'morningstar.com.au',
    'gradconnection.com.au', 'buy.nsw.gov.au', 'business.gov.au', 'acnc.gov.au',
    'nationalredress.gov.au', 'healthdirect.gov.au', 'vehiclerecalls.gov.au',
    'myagedcare.gov.au', 'id.com.au', 'profile.id.com.au', 'apps.apple.com',
    'afr.com', 'news.com.au', 'hcamag.com', 'developmentaid.org', 'syncgtm.com',
];

/** Words that carry no identity, so they never count as a name match. */
const NOISE = new Set([
    'the', 'and', 'of', 'for', 'pty', 'ltd', 'limited', 'inc', 'incorporated',
    'llc', 'plc', 'co', 'corp', 'corporation', 'holdings', 'group', 'australia',
    'australian', 'aust', 'au', 'nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'nt', 'act',
]);

/** Only these are dropped before building an acronym; the rest all count. */
const ACRONYM_SKIP = new Set(['the', 'and', 'of', 'for', 'a', 'an', 'pty', 'ltd', 'limited', 'inc']);

/** Public-suffix-ish labels, stripped so the host's identity is what remains. */
const TLD_LABELS = new Set(['com', 'net', 'org', 'edu', 'gov', 'au', 'co', 'nz', 'uk', 'io', 'ai']);

const words = (company: string): string[] =>
    (company || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Identity-bearing words. Three letters is allowed because plenty of real
 * employers are initialisms (JBS, AIG, NTI), but a token that short only ever
 * counts as a match when it IS the host rather than merely inside it.
 */
export function nameTokens(company: string): string[] {
    return words(company).filter((w) => w.length >= 3 && !NOISE.has(w));
}

/** "Department of Climate Change, Energy, the Environment and Water" -> "dcceew" */
export function initialsOf(company: string): string {
    return words(company)
        .filter((w) => !ACRONYM_SKIP.has(w))
        .map((w) => w[0])
        .join('');
}

/** The part of a hostname that identifies it: au.hudson.com -> "auhudson" */
export function hostCore(host: string): string {
    return host
        .toLowerCase()
        .replace(/^www\./, '')
        .split('.')
        .filter((l) => !TLD_LABELS.has(l))
        .join('');
}

export function isBlacklisted(host: string): boolean {
    const h = host.toLowerCase().replace(/^www\./, '');
    return DOMAIN_BLACKLIST.some((b) => h === b || h.endsWith('.' + b));
}

/** Is this employer actually a government body, so that .gov.au is a real signal? */
export function looksGovernment(company: string): boolean {
    return /\b(department|dept|council|ministry|authority|commission|agency|bureau|government|shire|municipal)\b/i.test(company)
        || /\b(city|office|department) of\b/i.test(company);
}

export function looksEducation(company: string): boolean {
    return /\b(university|college|tafe|school|institute|academy)\b/i.test(company);
}

/**
 * How strongly a host looks like the company's own name.
 *
 *   5  the host is the company's acronym        dcceew  <- Department of ...
 *   4  the host is the whole name               wesfarmershealth
 *   3  the host IS one of its words             surgeons, scania, hudson
 *   2  the host contains two of its words       westernsydney
 *   1  the host contains one of its words       brisyouth, generalsurgeons
 *   0  nothing in common                        vehiclerecalls
 *
 * The tiers matter as much as the matching. An acronym has to outrank a word,
 * or a department loses its own domain to one naming its portfolio. And "is a
 * word" has to outrank "contains a word", or the College of Surgeons resolves
 * to generalsurgeons.com.au instead of surgeons.org.
 */
export function nameMatchStrength(host: string, company: string): number {
    const core = hostCore(host);
    if (!core) return 0;

    const initials = initialsOf(company);
    if (initials.length >= 3 && (core === initials || core.startsWith(initials))) return 5;

    const tokens = nameTokens(company);
    if (!tokens.length) return 0;

    if (core === tokens.join('')) return 4;
    if (tokens.some((t) => core === t)) return 3;

    // A three-letter token inside a longer host is coincidence more often than
    // not, so only longer words count towards a "contains" match.
    const hits = tokens.filter((t) => t.length >= 4 && core.includes(t)).length;
    return hits >= 2 ? 2 : hits === 1 ? 1 : 0;
}

/**
 * An Australian TLD is only evidence when it fits the employer. A `.gov.au` for
 * a truck manufacturer means a government page mentioned them, not that they
 * run the site.
 */
export function tldBonus(host: string, company: string): number {
    const h = host.toLowerCase();
    if (/\.gov\.au$/.test(h)) return looksGovernment(company) ? 5 : 0;
    if (/\.edu\.au$/.test(h)) return looksEducation(company) ? 5 : 0;
    if (/\.(com|org|net)\.au$/.test(h)) return 3;
    if (/\.au$/.test(h)) return 2;
    return 1;
}

export interface DomainCandidate {
    host: string;
    /** 0-based position in the search results. Earlier is weak evidence. */
    position: number;
}

export interface DomainPick {
    domain: string | null;
    isAu: boolean;
    alternatives: string[];
    /** Why this one won, for the bake-off report and for debugging a bad pick. */
    reason: 'acronym' | 'name-match' | 'position' | 'none';
}

/**
 * Choose the company's own website from what a search returned.
 *
 * A name match dominates everything else, because it is the only signal that
 * actually distinguishes "their site" from "a site about them". Position and
 * TLD only break ties, and only decide it outright when nothing matches the
 * name at all, which keeps the previous behaviour for the cases it got right.
 */
export function pickCompanyDomain(candidates: DomainCandidate[], company: string): DomainPick {
    const seen = new Map<string, { host: string; score: number; strength: number; position: number }>();

    for (const c of candidates) {
        const host = (c.host || '').toLowerCase().replace(/^www\./, '');
        if (!host || isBlacklisted(host)) continue;

        const strength = nameMatchStrength(host, company);
        const score =
            strength * 1000 +
            tldBonus(host, company) * 10 +
            Math.max(0, 20 - c.position);

        const prev = seen.get(host);
        if (!prev || score > prev.score) seen.set(host, { host, score, strength, position: c.position });
    }

    const ranked = [...seen.values()].sort((a, b) =>
        b.score - a.score || a.position - b.position || a.host.length - b.host.length,
    );

    if (!ranked.length) return { domain: null, isAu: false, alternatives: [], reason: 'none' };

    const top = ranked[0];
    return {
        domain: top.host,
        isAu: /\.au$/.test(top.host),
        alternatives: ranked.slice(1, 4).map((r) => r.host),
        reason: top.strength === 5 ? 'acronym' : top.strength > 0 ? 'name-match' : 'position',
    };
}
