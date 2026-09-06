/**
 * The employer's own contact page, read directly, when the directory has nothing.
 *
 * Four of the twenty ads in the corpus resolved to a correct website and then
 * ended with no contact at all, because Hunter holds zero addresses for the
 * domain: Dig Deep Excavations, NSN Electrical, Good Games, and one more. These
 * are one-location Australian businesses. They are not in Hunter and paying
 * Hunter more will not put them there, because Hunter is a record of addresses
 * other people have already found, not a crawler.
 *
 * But every one of them publishes an address on their own contact page. We were
 * not looking. This looks, and it costs nothing at all: no search vendor, no
 * directory vendor, just an HTTPS GET of pages the employer published for
 * exactly this purpose.
 *
 * It is deliberately the LAST resort and not the first. An address here is
 * almost always a shared inbox rather than a named person, which is a weaker
 * contact than anything Hunter returns, so it only runs where the directory
 * came back empty.
 *
 * Every limit below is a named, overridable setting rather than a number baked
 * into the code, because a rule that cannot be changed without a code edit is
 * how a reasonable default becomes a permanent bug.
 */
import axios from 'axios';
import { isGenericLocal } from './jdContact';
import { hostCore } from './companyDomain';

/**
 * The knobs. Every one reads an environment variable and falls back to a
 * default, so any of them can be changed without touching this file.
 */
export interface SiteContactLimits {
    /** Paths tried on the domain, in order. The first hit wins. */
    paths: string[];
    /** How many pages to fetch before giving up. Guards against a slow site. */
    maxPages: number;
    /** Per-request timeout in ms. */
    timeoutMs: number;
    /**
     * Stop reading a page after this many bytes.
     *
     * Generous on purpose. This started at 400KB on the reasoning that a
     * contact address sits near the top of a page, and that reasoning is simply
     * wrong for a modern site: eclipsegames.com.au serves 1.2MB of inlined
     * script and styles before it gets to the footer where its only address
     * lives, so the cap silently threw away the very address the whole module
     * exists to find. The cap is here to bound memory, not to guess where an
     * address will be, so it belongs well above the size of a real page.
     */
    maxBytes: number;
    /**
     * Only keep addresses at the employer's own domain.
     *
     * On by default. A small business site routinely carries its web designer's
     * address, its accountant's, and a Mailchimp sender, and handing a candidate
     * one of those is the exact failure the whole domain gate exists to prevent.
     * Turn it off only if you have decided you want those.
     */
    sameDomainOnly: boolean;
    /**
     * Allow a Gmail or Bigpond address when it is plainly the business's own.
     *
     * On by default, and it exists because `sameDomainOnly` on its own is one
     * of those rules that is right in general and wrong exactly where it
     * matters. Good Games publishes `info.eclipsegames@gmail.com` on their
     * homepage and nothing else: a real small business whose real inbox is a
     * Gmail account. The same-domain rule dropped it and the ad ended with no
     * contact at all.
     *
     * The gate is name resemblance, not a blanket exception: the local part has
     * to carry the site's own name, so `info.eclipsegames@gmail.com` on
     * eclipsegames.com.au is accepted and the owner's personal `johnsmith84@
     * gmail.com` in the page footer is not.
     */
    allowNamedFreeMail: boolean;
}

/** Mailbox providers, where the domain says nothing about who owns the address. */
const FREE_MAIL = new Set([
    'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.com.au', 'outlook.com',
    'outlook.com.au', 'live.com', 'live.com.au', 'yahoo.com', 'yahoo.com.au',
    'icloud.com', 'me.com', 'bigpond.com', 'bigpond.net.au', 'optusnet.com.au',
    'iinet.net.au', 'tpg.com.au', 'internode.on.net', 'aol.com', 'proton.me', 'protonmail.com',
]);

const num = (name: string, fallback: number): number => {
    const v = Number(process.env[name]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
};

export function siteContactLimits(): SiteContactLimits {
    return {
        paths: (process.env.SITE_CONTACT_PATHS ?? '/contact,/contact-us,/,/about,/about-us')
            .split(',').map(s => s.trim()).filter(Boolean),
        maxPages: num('SITE_CONTACT_MAX_PAGES', 4),
        timeoutMs: num('SITE_CONTACT_TIMEOUT_MS', 8000),
        maxBytes: num('SITE_CONTACT_MAX_BYTES', 4_000_000),
        sameDomainOnly: process.env.SITE_CONTACT_SAME_DOMAIN_ONLY !== 'false',
        allowNamedFreeMail: process.env.SITE_CONTACT_ALLOW_FREE_MAIL !== 'false',
    };
}

/**
 * Local parts that belong to somebody else's business, not the employer's.
 *
 * A small business site is built by an agency and mailed through a platform,
 * and both leave addresses in the HTML. None of them will read a message about
 * a job.
 */
const NOT_THE_EMPLOYER =
    /^(no-?reply|do-?not-?reply|postmaster|abuse|webmaster|hostmaster|privacy|dmca|unsubscribe|bounce|mailer-daemon|sentry|wordpress|wp)/i;

/** Addresses that are plainly an asset filename or a tracking pixel, not mail. */
const NOT_AN_ADDRESS = /\.(png|jpe?g|gif|svg|webp|css|js|woff2?)$/i;

/**
 * The lengths are bounds, not decoration.
 *
 * Unbounded `+` on the local part makes this quadratic on a big page: at every
 * one of a million positions the engine consumes a long run of matching
 * characters before failing at the missing `@`. A 900KB page was enough to hang
 * the process outright. RFC 5321 caps a local part at 64 characters and a
 * domain at 255, so the bounds cost nothing real and turn the scan linear.
 */
const EMAIL = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,24}/g;

/** apex of a host: mail.digdeepcivil.com.au and digdeepcivil.com.au agree. */
function sameSite(emailDomain: string, siteDomain: string): boolean {
    const a = emailDomain.toLowerCase().replace(/^www\./, '');
    const b = siteDomain.toLowerCase().replace(/^www\./, '');
    return a === b || a.endsWith('.' + b) || b.endsWith('.' + a);
}

/**
 * Does a free-mail address carry the site's own name?
 *
 * `info.eclipsegames@gmail.com` on eclipsegames.com.au: yes, that is the
 * business. `johnsmith84@gmail.com` in the same footer: no, that is a person
 * who happens to appear on the page.
 */
export function looksLikeTheBusiness(local: string, siteDomain: string): boolean {
    const core = hostCore(siteDomain);
    const l = local.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (core.length < 4 || l.length < 3) return false;
    return l.includes(core) || core.includes(l);
}

export interface SiteContact {
    email: string;
    /** True when it is a shared inbox (info@, admin@) rather than a person. */
    generic: boolean;
    /** False for a free-mail address kept because it carries the business name. */
    ownDomain: boolean;
    /** The page it was read from, so a wrong answer can be traced. */
    sourceUrl: string;
}

/** One page fetch, capped and never throwing. */
async function fetchPage(url: string, limits: SiteContactLimits): Promise<string> {
    try {
        const { data } = await axios.get(url, {
            timeout: limits.timeoutMs,
            maxRedirects: 3,
            responseType: 'text',
            transformResponse: [(d: unknown) => String(d ?? '')],
            headers: {
                // Named honestly. A site owner reading their logs should be able
                // to tell who fetched their contact page and why.
                'User-Agent': 'JobHubContactLookup/1.0 (+reads published contact pages)',
                Accept: 'text/html,application/xhtml+xml',
            },
            validateStatus: s => s >= 200 && s < 400,
        });
        return String(data).slice(0, limits.maxBytes);
    } catch {
        return '';
    }
}

/**
 * Every usable address on one page, best first.
 *
 * `mailto:` links are read before the page text, because an address written as
 * a link is one the site intends you to write to, while an address sitting in
 * body text is as often an example or somebody else's.
 */
export function readAddresses(html: string, siteDomain: string, limits = siteContactLimits()): SiteContact[] {
    const found: string[] = [];

    for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) found.push(decodeURIComponent(m[1]));

    // Asset URLs are stripped before the text scan, not filtered after it. A
    // retina image at `logo@2x.acme.com.au/hero.png` matches the address
    // pattern exactly, because the pattern stops at the slash and never sees
    // the `.png` that would have given it away. Removing the attribute is the
    // only place that filename is still recognisable as a filename.
    const text = html.replace(/\b(?:src|srcset|data-src|href|content)\s*=\s*("[^"]*"|'[^']*')/gi, ' ')
        .replace(/url\([^)]*\)/gi, ' ');

    for (const m of text.matchAll(EMAIL)) found.push(m[0]);

    const seen = new Set<string>();
    const out: SiteContact[] = [];

    for (const raw of found) {
        // A `mailto:` href in the wild carries an encoded leading space and a
        // trailing escape slash often enough to matter: eclipsegames.com.au
        // serves `mailto:%20info.eclipsegames@gmail.com\`. Both are stripped.
        const email = raw
            .trim()
            .toLowerCase()
            // `%20` survives the plain-text scan, which does not decode, so
            // without this the same address is reported twice: once clean from
            // the href, once with the escape still attached.
            .replace(/^(?:%20|\+)+/, '')
            .replace(/^[\\\s]+/, '')
            .replace(/[.,;:)\]\\]+$/, '');
        if (seen.has(email)) continue;
        seen.add(email);

        const [local, domain] = email.split('@');
        if (!local || !domain) continue;
        if (NOT_AN_ADDRESS.test(email) || NOT_THE_EMPLOYER.test(local)) continue;
        const ownDomain = sameSite(domain, siteDomain);

        if (limits.sameDomainOnly && !ownDomain) {
            const rescued = limits.allowNamedFreeMail
                && FREE_MAIL.has(domain)
                && looksLikeTheBusiness(local, siteDomain);
            if (!rescued) continue;
        }

        out.push({ email, generic: isGenericLocal(email), ownDomain, sourceUrl: '' });
    }

    // The employer's own domain first, then a named person over a shared inbox.
    //
    // Domain order has to come first. A business that publishes both
    // `sales@eclipsegames.com.au` and the Gmail account it also reads should
    // hand over the one on its own domain, and neither address is "generic"
    // enough for the second rule to separate them.
    return out.sort((a, b) =>
        Number(b.ownDomain) - Number(a.ownDomain) || Number(a.generic) - Number(b.generic));
}

/**
 * The best address the employer publishes on their own site, or null.
 *
 * Returns null rather than throwing on every failure. A business with no
 * website contact page is an ordinary outcome, not an error, and the caller's
 * response to it is the same as its response to an empty directory.
 */
export async function findSiteContact(
    domain: string,
    limits: SiteContactLimits = siteContactLimits(),
): Promise<SiteContact | null> {
    if (!domain) return null;

    let fetched = 0;
    for (const p of limits.paths) {
        if (fetched >= limits.maxPages) break;
        fetched++;

        const url = `https://${domain.replace(/^www\./, '')}${p}`;
        const html = await fetchPage(url, limits);
        if (!html) continue;

        const hit = readAddresses(html, domain, limits)[0];
        if (hit) return { ...hit, sourceUrl: url };
    }

    return null;
}
