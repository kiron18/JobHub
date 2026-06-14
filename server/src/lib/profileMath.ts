/**
 * Date math for derived profile facts the LLM should never hedge on.
 *
 * The LLM prompt has no current date and cannot resolve "Present" / null endDate
 * without help. Compute these figures server-side, inject them as facts,
 * and exempt them from the quality gate's "fabricated metric" check.
 */

const MONTH_NAMES: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
};

/**
 * Parse the loose date strings that come out of resume extraction
 * (e.g. "Feb 2021", "February 2021", "2021-02", "2021"). Returns null
 * for empty / "Present" / unparseable input.
 */
export function parseFlexibleDate(s: string | null | undefined): Date | null {
    if (!s || typeof s !== 'string') return null;
    const trimmed = s.trim();
    if (!trimmed) return null;
    if (/^(present|current|now|ongoing)$/i.test(trimmed)) return null;

    // "Feb 2021" / "February 2021" / "Feb. 2021"
    const monthYear = trimmed.match(/^([A-Za-z]+)\.?\s+(\d{4})$/);
    if (monthYear) {
        const month = MONTH_NAMES[monthYear[1].toLowerCase()];
        if (month !== undefined) {
            return new Date(parseInt(monthYear[2], 10), month, 1);
        }
    }

    // "2021-02" / "2021/02" / "02/2021" / "02-2021"
    const numeric = trimmed.match(/^(\d{4})[-/](\d{1,2})$/) || trimmed.match(/^(\d{1,2})[-/](\d{4})$/);
    if (numeric) {
        const isYearFirst = numeric[1].length === 4;
        const year = parseInt(isYearFirst ? numeric[1] : numeric[2], 10);
        const month = parseInt(isYearFirst ? numeric[2] : numeric[1], 10) - 1;
        if (year > 1900 && month >= 0 && month <= 11) {
            return new Date(year, month, 1);
        }
    }

    // Year only: "2021"
    const yearOnly = trimmed.match(/^(\d{4})$/);
    if (yearOnly) {
        return new Date(parseInt(yearOnly[1], 10), 0, 1);
    }

    // Last resort: native Date.parse
    const direct = new Date(trimmed);
    if (!isNaN(direct.getTime())) return direct;

    return null;
}

interface ExperienceEntry {
    type?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    isCurrent?: boolean | null;
    isCasual?: boolean | null;
}

/**
 * Compute total professional experience as the SUM of actual time worked across
 * all work roles, merging overlapping roles so concurrent jobs are never double
 * counted, and EXCLUDING the gaps between roles (study breaks, job searches).
 *
 * This is the honest "how many years have you actually worked" figure a
 * candidate would defend in an interview, not the earliest-start-to-today
 * career span (which silently counts every gap as experience and inflates a
 * recent graduate with one old internship into "7 years").
 *
 * The caller is responsible for passing only the roles that should count —
 * casual or irrelevant roles should already be filtered out (e.g. via
 * selectFeaturedExperience) so they don't pad the figure.
 *
 * Returns a whole number of years (minimum 1), or null when the experience
 * array is empty / unparseable.
 */
export function computeYearsOfExperience(experience: ExperienceEntry[] | null | undefined): number | null {
    if (!Array.isArray(experience) || experience.length === 0) return null;

    const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
    const intervals: Array<[number, number]> = [];

    for (const e of experience) {
        if (e?.type && e.type !== 'work') continue;
        if (e?.isCasual === true) continue; // Exclude casual/survival jobs
        const start = parseFlexibleDate(e?.startDate);
        if (!start) continue;

        const isCurrent = e?.isCurrent || !e?.endDate
            || /^(present|current|now|ongoing)$/i.test(String(e?.endDate ?? '').trim());
        const end = isCurrent ? new Date() : (parseFlexibleDate(e?.endDate) ?? new Date());

        const startMs = start.getTime();
        // A same-month or malformed range still represents a real (short) stint,
        // so floor its length to ~1 month rather than dropping it to zero.
        let endMs = end.getTime();
        if (endMs <= startMs) endMs = startMs + MONTH_MS;
        intervals.push([startMs, endMs]);
    }

    if (intervals.length === 0) return null;

    // Merge overlapping intervals, then sum their lengths (gaps excluded).
    intervals.sort((a, b) => a[0] - b[0]);
    let totalMs = 0;
    let [curStart, curEnd] = intervals[0];
    for (let i = 1; i < intervals.length; i++) {
        const [s, en] = intervals[i];
        if (s <= curEnd) {
            if (en > curEnd) curEnd = en;
        } else {
            totalMs += curEnd - curStart;
            curStart = s;
            curEnd = en;
        }
    }
    totalMs += curEnd - curStart;

    const years = totalMs / (365.25 * 24 * 60 * 60 * 1000);
    return Math.max(1, Math.round(years));
}

/**
 * Pull an explicitly-stated years-of-experience figure from resume text
 * (e.g. "9+ years of experience", "9 years experience"). The candidate's own
 * statement is the source of truth and beats a computed career span, which can't
 * see study/career gaps (e.g. a 2016-2018 MBA between roles). Returns null when
 * no figure is stated. The "of/in + experience" requirement keeps it from matching
 * incidental phrases like "over 3 years" inside a bullet.
 */
export function statedYearsOfExperience(...texts: (string | null | undefined)[]): number | null {
    for (const t of texts) {
        if (!t || typeof t !== 'string') continue;
        const m = t.match(/(\d{1,2})\s*\+?\s*years?(?:\s+of)?\s+(?:experience|exp)\b/i);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n > 0 && n < 60) return n;
        }
    }
    return null;
}

/**
 * Resolve years of experience: prefer the figure the candidate explicitly states
 * in their resume; fall back to the computed career span only when none is stated.
 * Covers both scenarios — a resume that declares "9+ years" and one that doesn't.
 */
export function resolveYearsOfExperience(
    statedSources: (string | null | undefined)[],
    experience: ExperienceEntry[] | null | undefined,
): number | null {
    return statedYearsOfExperience(...statedSources) ?? computeYearsOfExperience(experience);
}

/**
 * Extract the contact email from resume text — the first email-like token, which
 * on a resume is the header contact address. The resume is the source of truth for
 * contact details, so this beats the account/login email stored on the profile.
 */
export function extractContactEmail(text: string | null | undefined): string | null {
    if (!text || typeof text !== 'string') return null;
    const m = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    return m ? m[0] : null;
}

/**
 * ISO yyyy-mm-dd for today, suitable for prompt injection.
 */
export function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}
