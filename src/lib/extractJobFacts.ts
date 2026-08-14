/**
 * Reads the role title and employer out of a job ad the candidate pasted in.
 *
 * These two strings travel further than they look. They name the tracker row,
 * they are stamped on the exported PDF filenames, they are handed to the
 * generator as analysis context, and they are written into the follow-up and
 * outreach emails that go to the employer. A wrong value here is not a cosmetic
 * bug, it is an email that says "I applied for the role at venues".
 *
 * That was a real failure: the previous extractor matched /\bat\s+([A-Z]...)/i,
 * and the trailing i flag cancelled the capital-letter guard it depended on, so
 * any "at <word>" anywhere in the ad won. "Experience working at venues" gave a
 * company of "venues".
 *
 * The rule here is that returning nothing beats returning something wrong.
 * Every caller can write around a missing value, and none of them can detect a
 * plausible-looking wrong one. This stays deliberately conservative, and where
 * it gives up the honest answer is undefined.
 */

/** Lines that are page furniture on Seek and LinkedIn rather than the posting. */
const BOILERPLATE = /^(save|apply|share|quick apply|be an early applicant|posted|sign in|home|back to search|job description|about (us|the (role|company|opportunity))|overview|responsibilities|requirements|benefits|what you'?ll do)\b/i;

/** Words that mark a line as a job title rather than a company or a sentence. */
const ROLE_WORDS = /\b(engineer|developer|manager|analyst|designer|director|coordinator|specialist|consultant|administrator|assistant|officer|advisor|adviser|architect|scientist|technician|accountant|nurse|teacher|lead|head of|chief|president|intern|graduate|associate|executive|supervisor|planner|marketer|recruiter|controller|strategist|producer|editor|writer|paralegal|solicitor|therapist|pharmacist|surveyor|estimator)\b/i;

/**
 * Nouns that follow "at" in ordinary prose. Without these, an ad saying "at
 * scale", "at pace" or "at venues" names a company that does not exist.
 */
const NOT_A_COMPANY = new Set([
    'venues', 'venue', 'scale', 'pace', 'times', 'time', 'least', 'most', 'all',
    'home', 'work', 'events', 'sites', 'site', 'schools', 'school', 'hospitals',
    'hospital', 'stores', 'store', 'offices', 'office', 'university', 'level',
    'levels', 'present', 'once', 'least', 'heart', 'risk', 'speed', 'height',
    'depth', 'length', 'best', 'worst', 'first', 'last', 'this', 'that', 'our',
    'their', 'your', 'its', 'both', 'each', 'every', 'any', 'one', 'two',
]);

/** Label lines that state the employer outright, which is the reliable case. */
const COMPANY_LABEL = /^(?:company|employer|organisation|organization|business)\s*[:-]\s*(.+)$/i;

function lines(jd: string): string[] {
    return jd.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
}

/** True when a string reads like a name rather than a sentence or a fragment. */
function looksLikeAName(value: string): boolean {
    if (value.length < 2 || value.length > 70) return false;
    if (/[.!?;:]$/.test(value)) return false;
    // A sentence that happens to start with a capital, rather than a name.
    if (value.split(/\s+/).length > 7) return false;
    return true;
}

/**
 * The role title.
 *
 * On a pasted Seek or LinkedIn ad the title is the first real line far more
 * often than it is anything else, so that is tried first and only accepted when
 * it reads like a title. Failing that, the first line carrying a role word.
 */
export function extractRole(jd: string): string | undefined {
    const candidates = lines(jd).slice(0, 12).filter((l) => !BOILERPLATE.test(l));
    if (candidates.length === 0) return undefined;

    const first = candidates[0];
    if (looksLikeAName(first) && !/^(we|our|the|this|you|as a|about)\b/i.test(first)) {
        return first.slice(0, 90);
    }

    const withRoleWord = candidates.find((l) => ROLE_WORDS.test(l) && looksLikeAName(l));
    return withRoleWord ? withRoleWord.slice(0, 90) : undefined;
}

/**
 * The employer.
 *
 * Only taken from a labelled line, or from an "at Company" match that is
 * genuinely capitalised and is not an ordinary noun. Everything else returns
 * undefined, because a pasted ad frequently does not state the employer in any
 * form a regex can find, and guessing is what produced "venues".
 */
export function extractCompany(jd: string): string | undefined {
    for (const line of lines(jd).slice(0, 12)) {
        const labelled = line.match(COMPANY_LABEL);
        if (labelled) {
            const value = labelled[1].trim();
            if (looksLikeAName(value)) return value;
        }
    }

    // "at X" on its own is far too loose. It catches locations ("based at
    // Sydney Olympic Park"), ordinary prose ("at Being The Very Best...") and
    // anything else capitalised, so the match has to be anchored on a lead-in
    // that only precedes an employer. Note the absent i flag as well: the
    // capital is half the point of the pattern, and the old code's trailing i
    // silently cancelled it.
    const atMatch = jd.match(
        /\b(?:team|role|position|opportunity|vacancy|careers?|job)\s+at\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,3})/,
    );
    if (atMatch) {
        const value = atMatch[1].trim().replace(/[.,]$/, '');
        const head = value.split(/\s+/)[0].toLowerCase();
        if (!NOT_A_COMPANY.has(head) && looksLikeAName(value) && !ROLE_WORDS.test(value)) {
            return value;
        }
    }

    return undefined;
}

export function extractJobFacts(jd: string): { role?: string; company?: string } {
    return { role: extractRole(jd), company: extractCompany(jd) };
}
