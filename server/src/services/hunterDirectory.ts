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
    opts: { department?: string } = {},
): Promise<Directory | null> {
    const key = hunterKey();
    if (!key || !domain) return null;

    try {
        const { data } = await axios.get('https://api.hunter.io/v2/domain-search', {
            params: {
                domain,
                limit: DIRECTORY_PAGE_SIZE,
                ...(opts.department ? { department: opts.department } : {}),
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
