/**
 * The gate between "we found a name" and "we spend money finding their email".
 *
 * Contact discovery has never had trouble producing a name. Measured over 31
 * real applications it produced one every single time. What it produced was
 * often the wrong person, and the step after it, Hunter's email finder, is
 * happy to mint a perfectly formatted address for a wrong person at a domain
 * that accepts all mail. Nothing bounces. Nobody finds out. That is the whole
 * reason this module exists, and it is why it runs BEFORE the paid lookup
 * rather than after: a rejection here costs nothing, a bad send costs the
 * candidate the application.
 *
 * Every rule below was written against a real pick from that bake-off:
 *
 *   Adam Tomison, Director General, WA Department of Justice
 *     ... chosen for a Queensland graduate role. Rejected on state conflict.
 *   Michelle Giles, Professor of Obstetrics and Gynaecology, Monash
 *     ... chosen for a Project Officer role. Rejected on function.
 *   Stephen Crisp, Chief Executive Officer, AUS-MEAT
 *     ... chosen for a JUNIOR Business Analyst role. Rejected on seniority.
 *   "Iva", Northern Beaches Council
 *     ... one word. Hunter returned HTTP 400. Rejected on name shape.
 *
 * The design principle, which is Kiron's and which this module takes
 * literally: a missing contact is better than a confidently wrong one. Every
 * rule here fails closed. When a signal is absent we do not guess in the
 * candidate's favour, we decline to reject on that rule alone and let the
 * others decide.
 *
 * What this module deliberately does NOT do.
 *
 * It does not score. A score invites a ranking, a ranking always has a winner,
 * and a winner gets contacted even when every option was wrong. These are
 * gates. A candidate passes all of them or is dropped, and the caller is
 * allowed to end up with nobody.
 *
 * It does not know company headcount, and that is its sharpest limitation. At
 * a twelve-person firm the COO really is the hiring manager for an IT Support
 * Officer, and this module will reject them for being four rungs up. Rejecting
 * a plausible contact at a small employer is the price of rejecting a CEO at a
 * large one, and it is the right side to err on until we have headcount.
 */

/** Which of the three outreach slots a surviving candidate belongs in. */
export type OutreachRole = 'talent' | 'hiring_manager' | 'team_insider';

export type RejectionCode =
    | 'INCOMPLETE_NAME'
    | 'FORMER_EMPLOYEE'
    | 'DIFFERENT_EMPLOYER'
    | 'STATE_CONFLICT'
    | 'OUTSIDE_AUSTRALIA'
    | 'TOO_SENIOR'
    | 'WRONG_FUNCTION';

export interface ContactCandidate {
    name: string;
    /** Their title as the search snippet reported it. */
    title: string | null;
    /** Free text from the search result. Often carries employer and location. */
    snippet?: string | null;
    /** "[Greater Sydney Area]", "[Canberra]", when the extractor caught one. */
    location?: string | null;
    sourceUrl?: string | null;
}

export interface ContactTarget {
    /** The employer named on the ad. */
    company: string;
    /** The advertised role, which sets the seniority we measure against. */
    role: string;
    /** "QLD", "Queensland", "Brisbane QLD 4000" - anything the ad gave us. */
    location?: string | null;
}

export interface FilterVerdict {
    pass: boolean;
    /** Empty when it passed. Ordered as evaluated, so the first is the reason. */
    rejections: RejectionCode[];
    /** Which slot it fills. Null when it did not pass. */
    outreachRole: OutreachRole | null;
    /** Human-readable, for the evidence record and for debugging a bad drop. */
    notes: string[];
}

// -- seniority ---------------------------------------------------------------
//
// Six rungs, coarse on purpose. The question is never "is this person exactly
// one level up", it is "is this person plausibly close enough to the vacancy to
// care about it". A CEO is not, at any company big enough to have a CEO who is
// not also the hiring manager.
//
// Ordered most senior first so the first match wins: "Senior Project Manager"
// has to read as a manager, not as a senior individual contributor, and
// "Director General" must not be caught by the bare "general" in GM.

const RUNGS: Array<{ rank: number; pattern: RegExp }> = [
    // 5 - runs the company or a whole division.
    { rank: 5, pattern: /\b(ceo|chief\s+\w+\s+officer|coo|cto|cfo|cio|ciso|chief\s+executive|managing\s+director|director[-\s]general|secretary[-\s]general|president|founder|co[-\s]?founder|partner|general\s+manager|executive\s+manager|vice[-\s]president|vp|deputy\s+secretary)\b/i },
    // 4 - runs a department.
    { rank: 4, pattern: /\b(head\s+of|executive\s+director|national\s+manager|group\s+manager|dean|director)\b/i },
    // 3 - runs a team of teams, or one team formally.
    { rank: 3, pattern: /\b(manager|superintendent|nurse\s+unit\s+manager|chief|controller)\b/i },
    // 2 - leads without formally managing.
    { rank: 2, pattern: /\b(lead|team\s+lead(er)?|supervisor|principal|architect|foreman|charge\s+nurse)\b/i },
    // 1 - an established individual contributor. The default for a bare title.
    { rank: 1, pattern: /\b(senior|snr|specialist|consultant|advisor|adviser|engineer|analyst|officer|coordinator|administrator|developer|scientist|professor|lecturer|accountant|nurse|solicitor|designer)\b/i },
    // 0 - the entry rung. Checked first in rankOfTitle via ENTRY_MARKERS.
];

/** A prefix that pins a title to the entry rung whatever else it says. */
const ENTRY_MARKERS =
    /\b(graduate|grad|junior|jnr|trainee|traineeship|intern|internship|cadet|cadetship|apprentice|apprenticeship|entry[-\s]level|assistant|new\s+grad)\b/i;

/**
 * Where a title sits on the ladder, 0 to 5.
 *
 * An entry marker wins outright, which is what separates "Junior Business
 * Analyst" (0) from "Business Analyst" (1). That one distinction is what makes
 * the AUS-MEAT rejection work: a CEO is five rungs above a junior analyst and
 * only four above an analyst, and four is already past the limit, but the
 * junior case is the one we saw and the one that must never pass.
 */
export function rankOfTitle(title: string | null | undefined): number {
    const t = (title ?? '').trim();
    if (!t) return 1;
    if (ENTRY_MARKERS.test(t)) return 0;
    for (const { rank, pattern } of RUNGS) {
        if (pattern.test(t)) return rank;
    }
    return 1;
}

/**
 * How far above the vacancy a contact may sit.
 *
 * Two rungs by default. One rung is the immediate supervisor and is the ideal.
 * Two covers the very common case where the ad is written by the department
 * head at a flatter organisation. Three is where the CEOs and Directors General
 * live, and every one of those in the bake-off was wrong.
 *
 * Four rungs when the contact's title names the vacancy's own discipline, which
 * is the exception the first version of this file got wrong. It rejected three
 * Directors of Nursing chosen for graduate nurse roles, and a Director of
 * Nursing is exactly who hires a graduate nurse. Clinical ladders are flat, and
 * so are trades, and so is most of the public service below SES.
 *
 * What separates the two cases is not how senior the title reads, it is whether
 * the title claims the work. "Director of Nursing" for a nurse names the
 * discipline. "Chief Executive Officer" for a junior analyst names nothing, and
 * "Director, Urban Living" for a functional analyst names something else. Those
 * stay capped at two.
 *
 * The exemption stops short of the executive rung, and that boundary was drawn
 * by a real miss too. "General Manager - Strategy, Planning & Delivery" shares
 * the word "delivery" with "Claims Delivery Analyst", so the discipline test
 * passes on a coincidence and a rank-5 executive at a large insurer walked back
 * in. Nobody at rank 5 is the hiring manager for an entry-level vacancy at an
 * employer big enough to have a rank 5. A shared word is not enough to buy your
 * way out of that.
 */
const MAX_RUNGS_ABOVE = 2;
const MAX_RUNGS_ABOVE_SAME_DISCIPLINE = 4;
/** The rung at which the same-discipline allowance stops applying. */
const EXECUTIVE_RANK = 5;

// -- function / discipline ---------------------------------------------------
//
// Deliberately the same vocabulary research.ts uses to BUILD its searches, so
// that the filter rejects on the same axis the search selected on. If the
// search asked for engineering leaders and returned an obstetrician, that is a
// failure this must be able to name.

const DISCIPLINES: Array<{ tag: string; pattern: RegExp }> = [
    { tag: 'talent', pattern: /\b(talent\s+acquisition|recruit(er|ment)|people\s*(and|&)?\s*culture|people\s+partner|human\s+resources|hr|people\s+operations|chief\s+people)\b/i },
    { tag: 'engineering', pattern: /\b(engineer(ing)?|software|developer|devops|platform|sre|architect)\b/i },
    // "Business Analyst" carries no discipline word of its own, which left the
    // commonest role in the whole corpus matching nothing and every gate that
    // depends on a discipline silently disabled.
    { tag: 'data', pattern: /\b(data|analytics|machine\s+learning|business\s+intelligence|reporting|insights|business\s+analyst|business\s+systems\s+analyst|systems\s+analyst|functional\s+analyst)\b/i },
    { tag: 'it-support', pattern: /\b(service\s+desk|help\s?desk|it\s+support|desktop\s+support|ict|information\s+technology|systems\s+support|technology|business\s+analyst|business\s+systems\s+analyst|systems\s+analyst|functional\s+analyst)\b/i },
    { tag: 'marketing', pattern: /\b(marketing|brand|growth|communications|content)\b/i },
    { tag: 'sales', pattern: /\b(sales|account\s+(executive|manager)|business\s+development|revenue|commercial)\b/i },
    { tag: 'product', pattern: /\b(product\s+(manager|owner|lead))\b/i },
    { tag: 'design', pattern: /\b(design(er)?|ux|ui|creative)\b/i },
    { tag: 'finance', pattern: /\b(financ(e|ial)|account(ant|ing)|controller|treasury|payroll)\b/i },
    { tag: 'legal', pattern: /\b(legal|counsel|solicitor|lawyer|paralegal|compliance)\b/i },
    { tag: 'operations', pattern: /\b(operations|supply\s+chain|logistics|procurement|warehouse|facilities|corporate\s+services|shared\s+services)\b/i },
    // A business analyst genuinely sits across data, delivery and IT, so the
    // title carries all three rather than being forced into one. Tagging it
    // data-only made a PMO manager read as the wrong function for a Business
    // Systems Analyst, which he is not.
    { tag: 'delivery', pattern: /\b(project\w*|program(me)?s?|portfolio|pmo|delivery|transformation|change\s+manage\w*|business\s+analyst|business\s+systems\s+analyst|systems\s+analyst|functional\s+analyst)\b/i },
    // Stems carry a \w* because the boundary otherwise lands mid-word:
    // "obstetric" does not match "Obstetrics", which is how a professor of
    // obstetrics read as education-only and slipped one gate.
    { tag: 'clinical', pattern: /\b(nurs(e|es|ing)|clinical|midwif\w*|medical|obstetric\w*|gynaecolog\w*|gynecolog\w*|surg(eon|eons|ery|ical)|allied\s+health|patient\w*|periop\w*|paediatric\w*|pediatric\w*|oncolog\w*|cardiolog\w*|radiolog\w*|radiograph\w*|physiotherap\w*|pharmac\w*|palliative|aged\s+care|theatre)\b/i },
    { tag: 'education', pattern: /\b(teach(er|ing)|lectur(er|ing)|academic|faculty|curriculum|student|professor|school\s+of)\b/i },
    { tag: 'customer', pattern: /\b(customer\s+(success|experience|service)|client\s+services)\b/i },
];

/** Every discipline a piece of text mentions. A title can honestly hold two. */
export function disciplinesOf(text: string | null | undefined): string[] {
    const t = (text ?? '').trim();
    if (!t) return [];
    return DISCIPLINES.filter((d) => d.pattern.test(t)).map((d) => d.tag);
}

// -- geography ---------------------------------------------------------------
//
// Australian government bodies are state-scoped, and that is precisely the
// signal the Adam Tomison pick threw away. "WA Department of Justice" and
// "Department of Justice" in Queensland share every word of the name; the only
// thing that distinguishes them is the state, sitting in plain text in his own
// LinkedIn snippet.

const STATES: Array<{ code: string; pattern: RegExp }> = [
    { code: 'WA', pattern: /\b(western\s+australia|perth)\b/i },
    { code: 'QLD', pattern: /\b(queensland|brisbane|cairns|townsville|mackay|toowoomba|gold\s+coast|sunshine\s+coast)\b/i },
    { code: 'NSW', pattern: /\b(new\s+south\s+wales|sydney|newcastle|wollongong|parramatta)\b/i },
    { code: 'VIC', pattern: /\b(victoria|melbourne|geelong|ballarat|bendigo)\b/i },
    { code: 'SA', pattern: /\b(south\s+australia|adelaide)\b/i },
    { code: 'TAS', pattern: /\b(tasmania|hobart|launceston)\b/i },
    { code: 'NT', pattern: /\b(northern\s+territory|darwin|alice\s+springs)\b/i },
    { code: 'ACT', pattern: /\b(australian\s+capital\s+territory|canberra)\b/i },
];

/**
 * The bare abbreviations, matched case-SENSITIVELY and on purpose.
 *
 * Lower-cased they are all real English words or fragments: "act as the
 * primary contact", "vic" inside a name, "sa" in another language. Matching
 * those would invent a state conflict out of ordinary prose and silently drop
 * a good contact, which is the one failure mode this module must not have. An
 * actual Australian state abbreviation is written upper-case every time.
 */
const STATE_CODES = /\b(WA|QLD|NSW|VIC|SA|TAS|NT|ACT)\b/g;

export function statesIn(text: string | null | undefined): string[] {
    const t = (text ?? '').trim();
    if (!t) return [];
    const found = new Set(STATES.filter((s) => s.pattern.test(t)).map((s) => s.code));
    for (const m of t.matchAll(STATE_CODES)) found.add(m[1]);
    return [...found];
}

/**
 * Places that are definitively not Australia.
 *
 * A denylist rather than an allowlist, because "Greater Sydney Area" and
 * "Brisbane" and "Reid" and a hundred other real AU locations would each need
 * enumerating the other way round, and a missing entry there silently drops a
 * good contact. Here a missing entry merely fails to catch a bad one, which
 * the employer and state rules usually catch anyway.
 */
const NON_AU =
    /\b(united\s+states|usa|united\s+kingdom|london|manchester|india|bengaluru|bangalore|mumbai|delhi|hyderabad|chennai|pune|singapore|malaysia|kuala\s+lumpur|philippines|manila|new\s+zealand|auckland|wellington|canada|toronto|vancouver|ireland|dublin|germany|berlin|france|paris|netherlands|amsterdam|china|shanghai|beijing|hong\s+kong|japan|tokyo|dubai|uae|south\s+africa|johannesburg|new\s+york|san\s+francisco|seattle|chicago|boston|austin|los\s+angeles|texas|california)\b/i;

/** Someone the snippet says has already left. */
const FORMER =
    /\b(former(ly)?|ex[-\s](?:employee|staff)|previously\s+(?:at|with)|retired)\b/i;

// -- the gate ----------------------------------------------------------------

/** Words in a company name that carry no identity, so they never distinguish. */
const COMPANY_NOISE = new Set([
    'the', 'and', 'for', 'pty', 'ltd', 'limited', 'inc', 'group', 'holdings',
    'australia', 'australian', 'services', 'service', 'department', 'dept', 'council',
    'city', 'regional', 'company', 'corporation', 'corp', 'university', 'college',
]);

function identityWords(name: string): string[] {
    return (name || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && !COMPANY_NOISE.has(w));
}

/**
 * Does the candidate's text name an employer that is clearly not the target?
 *
 * Only fires when the text names a DIFFERENT identity-bearing company, so a
 * snippet that simply omits the employer never triggers it. The bar is
 * deliberately high because a search snippet is a truncated, unreliable thing
 * and dropping a good contact on a bad parse is a real cost.
 */
export function namesDifferentEmployer(candidateText: string, company: string): boolean {
    const targetWords = identityWords(company);
    if (!targetWords.length) return false;
    const text = (candidateText || '').toLowerCase();
    if (targetWords.some((w) => text.includes(w))) return false;

    // No overlap at all. Only call it a conflict when the text actually names
    // some other organisation, rather than being a bare title with no employer.
    return /\b(pty|ltd|limited|inc|group|university|council|bank|corporation|department)\b/i.test(candidateText);
}

/**
 * Run every gate. Order matters only for which reason is reported first.
 */
export function filterContact(candidate: ContactCandidate, target: ContactTarget): FilterVerdict {
    const rejections: RejectionCode[] = [];
    const notes: string[] = [];

    const title = candidate.title ?? '';
    const blob = [candidate.title, candidate.snippet, candidate.location]
        .filter(Boolean)
        .join(' ');

    // 1. A name Hunter can actually use. "Iva" cost us an HTTP 400.
    const parts = (candidate.name || '').trim().split(/\s+/).filter(Boolean);
    const hasSurname = parts.length >= 2 && parts[1].replace(/\W/g, '').length >= 2;
    if (!hasSurname) {
        rejections.push('INCOMPLETE_NAME');
        notes.push(`"${candidate.name}" has no usable surname`);
    }

    // 2. Already gone.
    if (FORMER.test(blob)) {
        rejections.push('FORMER_EMPLOYEE');
        notes.push('snippet describes them as former or previous');
    }

    // 3. Working somewhere else entirely.
    if (blob && namesDifferentEmployer(blob, target.company)) {
        rejections.push('DIFFERENT_EMPLOYER');
        notes.push(`snippet names an employer other than ${target.company}`);
    }

    // 4. Right department name, wrong jurisdiction. The Tomison rule.
    const targetStates = statesIn(`${target.company} ${target.location ?? ''}`);
    const candidateStates = statesIn(blob);
    if (targetStates.length && candidateStates.length) {
        const shared = candidateStates.some((s) => targetStates.includes(s));
        if (!shared) {
            rejections.push('STATE_CONFLICT');
            notes.push(`they are ${candidateStates.join('/')}, the job is ${targetStates.join('/')}`);
        }
    }

    // 5. Not in the country.
    if (NON_AU.test(blob)) {
        rejections.push('OUTSIDE_AUSTRALIA');
        notes.push('located outside Australia');
    }

    const roleRank = rankOfTitle(target.role);
    const theirRank = rankOfTitle(title);
    const gap = theirRank - roleRank;

    const roleDisciplines = disciplinesOf(target.role);
    const theirDisciplines = disciplinesOf(title);
    const sharesDiscipline =
        roleDisciplines.length > 0 &&
        theirDisciplines.some((d) => roleDisciplines.includes(d));
    const isTalent = theirDisciplines.includes('talent');

    // 6. Too far up the ladder to have any part in this hire. The allowance
    //    widens when the title claims the vacancy's own discipline; see the
    //    constants above for why a Director of Nursing survives and a CEO does
    //    not.
    const ceiling =
        sharesDiscipline && theirRank < EXECUTIVE_RANK
            ? MAX_RUNGS_ABOVE_SAME_DISCIPLINE
            : MAX_RUNGS_ABOVE;
    if (!isTalent && gap > ceiling) {
        rejections.push('TOO_SENIOR');
        notes.push(`${title || 'untitled'} is ${gap} rungs above ${target.role}`);
    }

    // 7. A different part of the organisation. Talent is exempt: recruiting for
    //    a discipline you do not work in is the entire job.
    if (!isTalent && roleDisciplines.length && theirDisciplines.length && !sharesDiscipline) {
        rejections.push('WRONG_FUNCTION');
        notes.push(`${theirDisciplines.join('/')} does not match ${roleDisciplines.join('/')}`);
    }

    if (rejections.length) return { pass: false, rejections, outreachRole: null, notes };

    // Which slot they fill. Talent first, because a recruiter who happens to sit
    // two rungs up is still a recruiter.
    let outreachRole: OutreachRole;
    if (isTalent) outreachRole = 'talent';
    else if (gap >= 1) outreachRole = 'hiring_manager';
    else outreachRole = 'team_insider';

    notes.push(`${title || 'untitled'} sits ${gap} rungs from ${target.role}`);
    return { pass: true, rejections: [], outreachRole, notes };
}

/**
 * Fill the three slots PostApplyOutreach already shows, best candidate each.
 *
 * Returns fewer than three whenever fewer than three survive, and that is the
 * intended outcome, not a degraded one. Nothing here invents a contact to make
 * the card look complete.
 */
export function fillSlots<T extends ContactCandidate>(
    candidates: T[],
    target: ContactTarget,
): Record<OutreachRole, { candidate: T; notes: string[] } | null> {
    const slots: Record<OutreachRole, { candidate: T; notes: string[] } | null> = {
        talent: null,
        hiring_manager: null,
        team_insider: null,
    };

    for (const c of candidates) {
        const verdict = filterContact(c, target);
        if (!verdict.pass || !verdict.outreachRole) continue;
        // First survivor wins the slot: the discovery passes already return
        // candidates in confidence order, so re-ranking here would discard
        // information rather than add any.
        if (!slots[verdict.outreachRole]) {
            slots[verdict.outreachRole] = { candidate: c, notes: verdict.notes };
        }
    }

    return slots;
}
