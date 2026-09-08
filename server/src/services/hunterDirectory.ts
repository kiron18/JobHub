/**
 * Ask Hunter who works at a company, instead of guessing at an address.
 *
 * This inverts what contact discovery used to do. The old order was: search
 * LinkedIn for a plausible-sounding name, then ask Hunter to construct an
 * address for that name at a domain we also guessed. Both halves were guesses,
 * and the failure they produced together was an address that looked perfect,
 * was deliverable, and belonged to a Director General in the wrong state.
 *
 * Hunter's domain-search asks a different question: not "what would this
 * person's address be" but "whose addresses have you actually seen here". Every
 * record it returns is an address observed in the wild, and each one arrives
 * carrying a department and a seniority that we would otherwise be inferring
 * from a truncated Google snippet.
 *
 * The measurement that prompted the change, on five domains:
 *
 *   ausmeat.com.au                  10 people, including a Head of People
 *   ac3.com.au                      10 people, including a Head of People and Culture
 *   regent.com.au                    2 people, neither relevant
 *   achgroup.org.au                  0
 *   darwinprivatehospital.com.au     0
 *
 * So this wins outright where Hunter knows the employer, and changes nothing
 * where it does not. That is why it is a first choice with a fallback behind
 * it, rather than a replacement.
 *
 * On `total`. The response reports how many addresses Hunter holds for the
 * domain, which is the closest thing we have ever had to a headcount, and it
 * is what lets the picker relax its seniority rule at a ten-person firm where
 * the founder really is the hiring manager. It is Hunter's coverage and not the
 * company's payroll, so a large employer it barely knows will read as small.
 * The picker treats it as permission to widen, never as proof of anything.
 */
import axios from 'axios';

export interface DirectoryPerson {
    email: string;
    firstName: string | null;
    lastName: string | null;
    /** Free-text job title, e.g. "Head of People". */
    position: string | null;
    /** Hunter's own label: hr, it, finance, executive, management, ... */
    department: string | null;
    /** Hunter's own label: junior, senior, executive, or null. */
    seniority: string | null;
    /** valid, accept_all, invalid, webmail, unknown, or null when unchecked. */
    verification: string | null;
    confidence: number | null;
    /** "personal" for a human, "generic" for info@ / careers@ and friends. */
    type: string | null;
    linkedin: string | null;
}

export interface Directory {
    domain: string;
    /** True when the mail server accepts anything, so nothing can be verified. */
    acceptAll: boolean;
    pattern: string | null;
    /** How many addresses Hunter holds for this domain, not just this page. */
    total: number;
    people: DirectoryPerson[];
}

/** Read at call time so dotenv has had its chance. */
function hunterKey(): string {
    const k = process.env.HUNTER_API_KEY;
    if (!k) console.warn('[hunter] HUNTER_API_KEY not set, directory lookup skipped');
    return k || '';
}

/**
 * The free plan refuses a limit above 10 with a pagination_error, and the error
 * still costs a request. Paid plans allow 100. Kept as a constant so raising
 * the plan is a one-line change rather than a debugging session.
 */
export const DIRECTORY_PAGE_SIZE = 10;

function toPerson(e: any): DirectoryPerson {
    return {
        email: e?.value ?? '',
        firstName: e?.first_name ?? null,
        lastName: e?.last_name ?? null,
        position: e?.position ?? null,
        department: e?.department ?? null,
        seniority: e?.seniority ?? null,
        verification: e?.verification?.status ?? null,
        confidence: typeof e?.confidence === 'number' ? e.confidence : null,
        type: e?.type ?? null,
        linkedin: e?.linkedin ?? null,
    };
}

/**
 * Everyone Hunter knows at this domain.
 *
 * Returns null rather than throwing on any failure, because a missing directory
 * is an ordinary outcome that the caller handles by falling back to search, not
 * an error worth failing a request over. An empty directory returns a Directory
 * with no people, which is a different thing and the caller can tell them apart.
 */
export async function fetchDirectory(
    domain: string,
    opts: { department?: string; type?: 'personal' | 'generic' } = {},
): Promise<Directory | null> {
    const key = hunterKey();
    if (!key || !domain) return null;

    try {
        const { data } = await axios.get('https://api.hunter.io/v2/domain-search', {
            params: {
                domain,
                limit: DIRECTORY_PAGE_SIZE,
                ...(opts.department ? { department: opts.department } : {}),
                ...(opts.type ? { type: opts.type } : {}),
                api_key: key,
            },
            timeout: 15000,
        });

        const d = data?.data;
        if (!d) return null;

        return {
            domain: d.domain ?? domain,
            acceptAll: d.accept_all === true,
            pattern: d.pattern ?? null,
            total: typeof data?.meta?.results === 'number' ? data.meta.results : (d.emails?.length ?? 0),
            people: Array.isArray(d.emails) ? d.emails.map(toPerson) : [],
        };
    } catch (err: any) {
        const detail = err?.response?.data?.errors?.[0]?.details ?? err.message;
        console.warn(`[hunter] directory lookup failed for ${domain}: ${detail}`);
        return null;
    }
}

/**
 * Which of Hunter's department buckets are worth asking for, given a vacancy.
 *
 * Hunter's own labels, not ours. Ordered so the caller can stop early.
 */
const ROLE_TO_HUNTER_DEPARTMENT: Array<{ pattern: RegExp; department: string }> = [
    { pattern: /\b(nurs\w*|clinical|midwif\w*|patient|periop\w*|allied\s+health)\b/i, department: 'health' },
    { pattern: /\b(engineer\w*|developer|software|devops|platform|ict|it\s+support|service\s+desk|help\s?desk|systems?\s+analyst|business\s+analyst|data|analytics)\b/i, department: 'it' },
    // `account\w*` swept up "Accountable", so the suffixes are spelled out.
    { pattern: /\b(financ\w*|accountant|accountants|accounting|accounts\s+(payable|receivable)|payroll|treasury|auditor|auditing)\b/i, department: 'finance' },
    { pattern: /\b(marketing|brand|communications?|content|social\s+media)\b/i, department: 'marketing' },
    { pattern: /\b(sales|account\s+executive|business\s+development)\b/i, department: 'sales' },
    { pattern: /\b(legal|counsel|solicitor|paralegal|compliance)\b/i, department: 'legal' },
    { pattern: /\b(design(er)?|ux|ui)\b/i, department: 'design' },
    { pattern: /\b(teach\w*|lectur\w*|academic|curriculum|student)\b/i, department: 'education' },
    { pattern: /\b(operations|logistics|supply\s+chain|warehouse|procurement|facilities)\b/i, department: 'operations' },
    { pattern: /\b(product\s+(manager|owner))\b/i, department: 'product' },
];

/**
 * A standalone upper-case "IT", checked case-sensitively.
 *
 * "IT Graduate Support Officer" is plainly an IT role, but the words IT and
 * Support are not adjacent so no phrase pattern catches it. A bare
 * case-insensitive "it" would match the English pronoun in half the titles in
 * the corpus, so the capitalisation is doing the work: an employer writing an
 * IT role writes IT, every time.
 */
const BARE_IT = /\bIT\b/;

export function hunterDepartmentForRole(role: string): string | null {
    const r = (role ?? '').trim();
    if (!r) return null;
    if (BARE_IT.test(r)) return 'it';
    return ROLE_TO_HUNTER_DEPARTMENT.find(d => d.pattern.test(r))?.department ?? null;
}

/**
 * The directory, asked for by department rather than taken as it comes.
 *
 * The untargeted call returns whichever ten people Hunter happens to list
 * first, and measured across twelve employers that was the binding constraint,
 * not coverage. Monash has 13,251 known addresses and we saw ten of them.
 * Evoenergy has 98 and the ten we got filled no slot at all. Half the empty
 * talent slots were companies that plainly have HR staff who simply were not in
 * the first ten.
 *
 * Asking `department=hr` returns the top ten OF HR, which fixes that on the
 * free plan without paying for a bigger page. Two calls per company instead of
 * one: HR for the talent slot, and the vacancy's own department for the manager
 * and the insider. That is still cheaper than the search path it replaces,
 * which spends three searches and three model calls to do worse.
 *
 * When the role maps to no department we fall back to a single untargeted call
 * rather than skipping it, because some contact beats none.
 */
export async function fetchDirectoryForRole(domain: string, role: string): Promise<Directory | null> {
    const roleDepartment = hunterDepartmentForRole(role);

    const [hr, own] = await Promise.all([
        fetchDirectory(domain, { department: 'hr' }),
        roleDepartment
            ? fetchDirectory(domain, { department: roleDepartment })
            : fetchDirectory(domain),
    ]);

    if (!hr && !own) return null;

    const base = own ?? hr!;
    const seen = new Set<string>();
    const people = [...(own?.people ?? []), ...(hr?.people ?? [])].filter(p => {
        if (!p.email || seen.has(p.email)) return false;
        seen.add(p.email);
        return true;
    });

    return {
        domain: base.domain,
        acceptAll: base.acceptAll,
        pattern: base.pattern,
        // The larger of the two totals is the closest thing to a headcount:
        // a department-filtered call reports that department's count, not the
        // company's, and the small-employer rule must not read "4 people in HR"
        // as "a four-person company".
        total: Math.max(hr?.total ?? 0, own?.total ?? 0),
        people,
    };
}

/**
 * What Hunter holds for a domain, WITHOUT buying it.
 *
 * `/email-count` is free. Measured directly: fifteen calls across the corpus
 * moved neither the search counter nor the verification counter. It reports the
 * total, the personal/generic split, and a full breakdown by department, which
 * is everything a paid directory call would tell us about shape, minus the
 * names.
 *
 * It does require the API key despite being free. Called without one it returns
 * 401, which is how an hour went into debugging "Hunter holds nothing" for
 * every employer in the corpus.
 */
export interface EmailCount {
    total: number;
    personal: number;
    generic: number;
    /** Hunter's own department labels, zero-count buckets removed. */
    departments: Record<string, number>;
}

export async function fetchEmailCount(domain: string): Promise<EmailCount | null> {
    const key = hunterKey();
    if (!key || !domain) return null;
    try {
        const { data } = await axios.get('https://api.hunter.io/v2/email-count', {
            params: { domain, api_key: key },
            timeout: 15000,
        });
        const d = data?.data;
        if (!d) return null;
        return {
            total: d.total ?? 0,
            personal: d.personal_emails ?? 0,
            generic: d.generic_emails ?? 0,
            departments: Object.fromEntries(
                Object.entries(d.department ?? {}).filter(([, v]) => (v as number) > 0),
            ) as Record<string, number>,
        };
    } catch (err: any) {
        console.warn(`[hunter] email-count failed for ${domain}: ${err.message}`);
        return null;
    }
}

/**
 * Which single department is worth buying, given what Hunter says it holds.
 *
 * HR first: whoever handles hiring is the best contact at any seniority, and
 * replying is part of their job. Then the vacancy's own function, for a manager
 * and a peer. Then the largest bucket Hunter has, because at a small employer
 * the only people it knows may be in neither and some contact beats none.
 *
 * Returns null when Hunter reports no departments at all, which the caller
 * turns into a single untargeted call rather than skipping.
 */
export function departmentToBuy(count: EmailCount, role: string): string | null {
    const own = hunterDepartmentForRole(role);
    const has = (d: string | null): boolean => !!d && (count.departments[d] ?? 0) > 0;

    if (has('hr')) return 'hr';
    if (has(own)) return own;

    const biggest = Object.entries(count.departments).sort((a, b) => b[1] - a[1])[0];
    return biggest ? biggest[0] : null;
}

/**
 * Set `HUNTER_TARGETED_DIRECTORY=false` to go back to the two-call version.
 *
 * The old function stays exported and tested rather than deleted. It is the
 * fallback if the free coverage endpoint ever starts lying, and removing code
 * to prevent its reuse only means the next person writes it again worse.
 */
function targetedDirectoryEnabled(): boolean {
    return process.env.HUNTER_TARGETED_DIRECTORY !== 'false';
}

/**
 * The directory, bought once instead of twice.
 *
 * `fetchDirectoryForRole` asks blind: one call for `hr` and one for the
 * vacancy's department, every time, for every employer, whether or not Hunter
 * holds anybody in either. That is 2 credits per company and it is the single
 * largest line in the bill.
 *
 * The free `/email-count` already knows which departments have people in them.
 * So: ask for free, and only then buy the one bucket worth having. Measured
 * over the twenty-ad corpus this filled the same slots for half the credits,
 * and it adds a second saving the blind version cannot have: an employer Hunter
 * has never heard of is now identified for nothing, instead of costing two
 * calls to discover.
 *
 * On the free plan of 50 searches that is the difference between roughly 35
 * job applications a month and roughly 70.
 */
export async function fetchDirectoryTargeted(domain: string, role: string): Promise<Directory | null> {
    if (!targetedDirectoryEnabled()) return fetchDirectoryForRole(domain, role);
    if (!domain) return null;

    const count = await fetchEmailCount(domain);

    // A null count is Hunter being unreachable, not a verdict about the
    // employer, so we fall through and let the paid call decide. A count of
    // zero IS a verdict, and it cost nothing to get.
    if (count && count.total === 0) {
        return { domain, acceptAll: false, pattern: null, total: 0, people: [] };
    }

    const department = count ? departmentToBuy(count, role) : hunterDepartmentForRole(role);
    const directory = await fetchDirectory(domain, department ? { department } : {});
    if (!directory) return null;

    // A department-filtered call reports THAT DEPARTMENT's count, not the
    // company's, so the small-employer rule would read "4 people in HR" as a
    // four-person company. The free count knows the real total, so use it.
    return count ? { ...directory, total: Math.max(count.total, directory.total) } : directory;
}

/**
 * Shared inboxes, best first.
 *
 * `recruit@` beats `info@` beats `boxoffice@`, and the order is a list rather
 * than a score because every one of these is a judgement about who reads the
 * mailbox, not a measurement. A recruitment inbox is read by the people who
 * decide; a general enquiries one is read by somebody who can forward it; the
 * rest are read by a department with no interest in an application.
 */
const INBOX_PREFERENCE = [
    /^(recruit|recruitment|careers?|jobs|hiring|hr|people|talent)/i,
    /^(info|hello|contact|enquir|inquir|admin|reception|office|mail)/i,
];

/**
 * The best shared inbox at a domain, or null.
 *
 * Why this exists: the directory hunts for a PERSON, and when it finds none the
 * card used to say "no address" while the same domain had a staffed
 * recruitment inbox on it. Real case, 8 Sep 2026 — Brisbane Convention and
 * Exhibition Centre. Hunter held thirteen addresses at bcec.com.au and nobody
 * in HR or marketing, so every slot came back empty, and one call away sat
 * `recruit@bcec.com.au`.
 *
 * A shared inbox is a worse contact than a named person and a far better one
 * than nothing. `confidenceNote('generic')` in the frontend says so plainly
 * rather than dressing it up: certain to be monitored, less likely to be
 * answered personally.
 *
 * Costs one search. It is spent only where the alternative is showing the
 * candidate a dead end, and `HUNTER_GENERIC_FALLBACK=false` turns it off.
 */
export async function fetchSharedInbox(domain: string): Promise<DirectoryPerson | null> {
    if (process.env.HUNTER_GENERIC_FALLBACK === 'false') return null;

    const directory = await fetchDirectory(domain, { type: 'generic' });
    if (!directory?.people.length) return null;

    const usable = directory.people.filter(
        (p) => p.email && p.verification !== 'invalid',
    );
    if (!usable.length) return null;

    for (const tier of INBOX_PREFERENCE) {
        const hit = usable.find((p) => tier.test(p.email.split('@')[0] ?? ''));
        if (hit) return hit;
    }
    // Nothing recognisable. A department mailbox is still a mailbox, but only
    // when Hunter is reasonably sure of it: a low-confidence guess at a shared
    // address is the kind of thing that bounces in front of an employer.
    return usable.find((p) => (p.confidence ?? 0) >= 70) ?? null;
}

/**
 * Confirm a mailbox actually exists.
 *
 * Separate from the directory call and on a separate quota, which matters
 * because the best pick at AUS-MEAT, the Head of People, came back with no
 * verification status at all. Hunter had her address but had never checked it.
 */
export async function verifyEmail(email: string): Promise<string | null> {
    const key = hunterKey();
    if (!key || !email) return null;
    try {
        const { data } = await axios.get('https://api.hunter.io/v2/email-verifier', {
            params: { email, api_key: key },
            timeout: 15000,
        });
        return data?.data?.status ?? null;
    } catch (err: any) {
        console.warn(`[hunter] verify failed for ${email}: ${err.message}`);
        return null;
    }
}
