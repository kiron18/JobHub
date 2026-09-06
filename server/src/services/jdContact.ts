/**
 * Everything the job ad already told us, before we pay anyone to guess it.
 *
 * This runs FIRST now, and it used to run last. Contact discovery was built as
 * a search problem, so `scanJdForContact` sat as one of three parallel fallback
 * passes that only fired after the domain search and the Hunter directory had
 * already been paid for. That order is backwards on both axes that matter.
 *
 * On accuracy: a contact printed in the ad was chosen BY THE EMPLOYER as the
 * person to contact about this role. Nothing we infer from a directory or a
 * search snippet is more authoritative than that, and the bake-off found one
 * in 30% of ads.
 *
 * On cost: this is regular expressions over text we already have in memory. No
 * search, no model, no credit. A hit here skips the ABN lookup, the domain
 * search and both Hunter calls.
 *
 * The redacted-address rule is the quiet win. Seek masks the local part of an
 * address but leaves the DOMAIN intact, so an ad reading `••••@konnexuscg.com.au`
 * hands us a domain with certainty and for nothing. That matters more than it
 * sounds: the employer in that ad is called "Konnexus", and a name-based search
 * would have been reaching for konnexus.com.au.
 */

/** A full address, e.g. jane.smith@acme.com.au */
const FULL_EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/** Seek-style redaction: the local part is masked, the domain survives. */
const REDACTED = /[•*x·]{2,}\s*@\s*([A-Za-z0-9.-]+\.[A-Za-z]{2,})/gi;

/** A link in the ad body, which is often the employer's own site. */
const URL_HOST = /https?:\/\/([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/**
 * "please contact Jane Smith, Director of Engineering"
 *
 * The trailing clause is captured, not discarded. The old version took only
 * the name, which is how an ad naming its Investment & Economic Development
 * Coordinator produced a contact with no function attached, and a contact with
 * no function cannot be judged against the role.
 */
const NAMED_CONTACT =
    /(?:contact|contacting|enquiries to|enquiries can be directed to|queries to|speak (?:to|with)|reach out to|please call)\s+((?:[A-Z][a-z'’-]+\s+){1,2}[A-Z][a-z'’-]+)\s*(?:,|–|—|-|\bon\b|\bat\b)?\s*([A-Z][A-Za-z&,'’\- ]{3,60})?/g;

/** Local parts that reach a role rather than a named person. */
const GENERIC_LOCAL =
    /^(info|admin|hr|careers|jobs|recruitment|recruiting|enquiries|enquiry|contact|hello|office|support|apply|applications|talent|people|reception|mail|hiring)$/i;

/**
 * Hosts that appear in ads but are never the employer.
 *
 * Deliberately small and separate from the domain picker's list. This one only
 * has to survive the handful of links a Seek ad actually carries: the ATS the
 * employer applies through, Seek's own assets, and the tracking pixels.
 */
const NOISE_HOST =
    /(seek\.com|linkedin|facebook|instagram|twitter|x\.com|youtube|google|gstatic|schema\.org|w3\.org|sentry\.|gravatar|nga\.net\.au|pageuppeople|workday|smartrecruiters|livehire|applynow|expr3ss|jobadder|\.png$|\.jpg$|\.svg$)/i;

export interface JdContact {
    /** A complete address printed in the ad. The best outcome there is. */
    email: string | null;
    /** True when that address reaches a role inbox rather than a person. */
    emailIsGeneric: boolean;
    /** The employer's domain, however we came by it. */
    domain: string | null;
    /** How we came by it, because evidence and inference must not be pooled. */
    domainSource: 'JD_EMAIL' | 'JD_REDACTED' | 'JD_URL' | null;
    /** A person the ad names as the contact. */
    personName: string | null;
    /** Their function, when the ad states it next to the name. */
    personTitle: string | null;
}

const EMPTY: JdContact = {
    email: null, emailIsGeneric: false, domain: null,
    domainSource: null, personName: null, personTitle: null,
};

export function isGenericLocal(email: string): boolean {
    return GENERIC_LOCAL.test((email || '').split('@')[0] ?? '');
}

function usableHost(host: string): boolean {
    const h = host.toLowerCase().replace(/^www\./, '');
    return !!h && !NOISE_HOST.test(h);
}

/**
 * Read the ad. Nothing here calls anything.
 *
 * A personal address outranks a role inbox, and both outrank a domain with no
 * address. Every field is independent: an ad can name a person without giving
 * an address, or give a domain without naming anyone, and both are useful.
 */
export function readJdContact(jdText: string | null | undefined): JdContact {
    const jd = jdText || '';
    if (jd.length < 40) return EMPTY;

    const emails = [...new Set([...jd.matchAll(FULL_EMAIL)].map(m => m[0]))]
        .filter(e => usableHost(e.split('@')[1] ?? ''));

    // A named person is worth more than a shared inbox, so personal addresses
    // are considered first and the role inbox is the fallback, not the winner.
    const personal = emails.find(e => !isGenericLocal(e)) ?? null;
    const generic = emails.find(e => isGenericLocal(e)) ?? null;
    const email = personal ?? generic;

    let domain: string | null = null;
    let domainSource: JdContact['domainSource'] = null;

    if (email) {
        domain = email.split('@')[1].toLowerCase();
        domainSource = 'JD_EMAIL';
    } else {
        const redacted = [...jd.matchAll(REDACTED)].map(m => m[1].toLowerCase()).find(usableHost);
        if (redacted) {
            domain = redacted;
            domainSource = 'JD_REDACTED';
        } else {
            const host = [...jd.matchAll(URL_HOST)]
                .map(m => m[1].toLowerCase().replace(/^www\./, ''))
                .find(usableHost);
            if (host) {
                domain = host;
                domainSource = 'JD_URL';
            }
        }
    }

    const named = [...jd.matchAll(NAMED_CONTACT)][0];
    const personName = named?.[1]?.trim() || null;
    const rawTitle = named?.[2]?.trim().replace(/[,\s]+$/, '') || null;

    return {
        email,
        emailIsGeneric: email ? isGenericLocal(email) : false,
        domain,
        domainSource,
        personName,
        // A "title" that is really the next sentence starting with a capital
        // is worse than no title, so anything without a role-ish word is dropped.
        personTitle: rawTitle && /\b(manager|director|officer|lead|head|coordinator|partner|advisor|adviser|consultant|specialist|analyst|engineer|supervisor|principal|chief|president|recruiter|talent|hr|people)\b/i.test(rawTitle)
            ? rawTitle
            : null,
    };
}

/**
 * Is this enough to skip the paid pipeline entirely?
 *
 * A complete address is, whoever it belongs to: the employer printed it as the
 * way to reach them about this role, which is a stronger claim than anything a
 * directory lookup can make. A domain alone is not, because a domain still
 * needs a person, and that is exactly what the credits buy.
 */
export function isSufficient(c: JdContact): boolean {
    return !!c.email;
}
