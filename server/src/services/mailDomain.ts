/**
 * Does this domain receive mail, and if not, which of the runners-up does.
 *
 * `pickCompanyDomain` chooses the host that best looks like the employer, and
 * measured over 30 real employers from the corpus it got 27 right. The three it
 * got wrong shared a property that costs nothing to test:
 *
 *   Northern Territory Department of ...  -> territorystories.nt.gov.au
 *   CitiPower, Powercor and United Energy -> engage.unitedenergy.com.au
 *   Capricorn                             -> visitcapricorn.com.au
 *
 * A digital archive, a community-consultation subdomain, and a tourism site.
 * All three name the employer convincingly enough to win on name match, and all
 * three publish no MX record at all, because nobody receives mail there. An
 * employer's own domain always does.
 *
 * So this is a correctness check first and a saved credit second. A directory
 * lookup on a domain with no mailboxes cannot return anything but an empty
 * result, and that empty result then reads as "the vendor does not know this
 * employer" when the truth is that we asked about a website nobody works at.
 *
 * What it deliberately does NOT do is find a mail domain that differs from the
 * website. ACH Group's site is achgroup.org.au and their mail is at ach.org.au,
 * and no DNS record says so: their MX points at Mimecast, which fronts the real
 * domain and reveals nothing. That case needs a vendor that has observed an
 * address in the wild, and it did not occur once in the 30 sampled, so it is
 * not what this module is for.
 */
import axios from 'axios';
import { nameMatchStrength } from './companyDomain';

/** One MX answer, reduced to the exchange host. */
export type MxLookup = (domain: string) => Promise<string[]>;

const cache = new Map<string, string[]>();

/**
 * MX over HTTPS rather than through the system resolver.
 *
 * `dns.resolveMx` talks UDP to port 53, which some environments refuse outright.
 * A run built on it reported every one of 30 employers as having no MX, which is
 * indistinguishable from a real finding until you notice it includes Sportsbet.
 * DNS-over-HTTPS travels the same path as the rest of our outbound calls, so it
 * works wherever the vendor APIs do.
 */
export const mxOverHttps: MxLookup = async (domain: string) => {
    const { data } = await axios.get('https://dns.google/resolve', {
        params: { name: domain, type: 'MX' },
        timeout: 8000,
    });
    if (data?.Status !== 0) return [];
    return (data.Answer ?? [])
        .filter((a: { type?: number }) => a.type === 15)
        .map((a: { data: string }) => String(a.data).split(' ').slice(1).join(' ').toLowerCase().replace(/\.$/, ''))
        .filter(Boolean);
};

/**
 * True when the domain publishes an MX record.
 *
 * Fails OPEN. A DNS call that times out is not evidence that an employer has no
 * mailboxes, and dropping a correct domain because a lookup failed is a worse
 * error than spending one directory credit on a domain that turns out to be
 * empty. This is the same rule `verifySlots` follows for a failed verification.
 */
export async function hasMailExchanger(domain: string, lookup: MxLookup = mxOverHttps): Promise<boolean> {
    if (!domain) return false;
    const hit = cache.get(domain);
    if (hit) return hit.length > 0;
    try {
        const mx = await lookup(domain);
        cache.set(domain, mx);
        return mx.length > 0;
    } catch {
        return true;
    }
}

/** Drops every cached answer. For tests, and for a long-lived process. */
export function clearMxCache(): void {
    cache.clear();
}

export interface MailableChoice {
    domain: string | null;
    /** True when we fell past the top pick because it receives no mail. */
    corrected: boolean;
    /** The pick that was rejected, kept so a bad resolver call stays visible. */
    rejected: string | null;
}

/**
 * The best-ranked domain that can actually receive mail.
 *
 * Walks the ranked list the picker produced. A runner-up is only accepted if it
 * still bears the employer's name: falling through on MX alone would happily
 * land on whatever host sat in fourth place, and a directory read off a stranger
 * is the exact failure this whole path exists to prevent. Better to return null
 * and let the caller skip contact discovery than to hand a candidate an address
 * at a company they never applied to.
 */
export async function pickMailableDomain(
    ranked: string[],
    company: string,
    lookup: MxLookup = mxOverHttps,
): Promise<MailableChoice> {
    const [top, ...rest] = ranked.filter(Boolean);
    if (!top) return { domain: null, corrected: false, rejected: null };

    if (await hasMailExchanger(top, lookup)) {
        return { domain: top, corrected: false, rejected: null };
    }

    for (const alt of rest) {
        if (nameMatchStrength(alt, company) < 1) continue;
        if (await hasMailExchanger(alt, lookup)) {
            return { domain: alt, corrected: true, rejected: top };
        }
    }

    return { domain: null, corrected: true, rejected: top };
}
