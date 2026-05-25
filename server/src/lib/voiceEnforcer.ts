/**
 * Deterministic first-person enforcement for resume Professional Summaries.
 *
 * Runs AFTER the LLM and AFTER the quality gate. This is the final safety
 * net — even when both LLM layers ignore the first-person directive, this
 * scrubber catches "{Name} brings...", "He has...", "His track record..."
 * etc. and rewrites them in-place using a known verb-conjugation table.
 *
 * Scope: Professional Summary section ONLY. Work experience bullets and
 * other sections are left untouched.
 */

/**
 * Third-person singular -> first person verb conjugation.
 * Lowercase keys; case is preserved in the output.
 */
const VERB_CONJUGATIONS: Record<string, string> = {
    is: 'am',
    was: 'was',
    has: 'have',
    had: 'had',
    does: 'do',
    did: 'did',
    will: 'will',
    can: 'can',
    could: 'could',
    should: 'should',
    would: 'would',
    might: 'might',
    must: 'must',
    // Irregular -s/-es forms that don't simply strip the trailing s
    goes: 'go',
    knows: 'know',
};

function conjugateToFirstPerson(verb: string): string {
    const lower = verb.toLowerCase();
    const mapped = VERB_CONJUGATIONS[lower];
    if (mapped) {
        return preserveCase(verb, mapped);
    }
    // Default rule for regular third-person singular verbs: strip the trailing s.
    // "brings" -> "bring", "drives" -> "drive", "delivers" -> "deliver".
    // Guards: keep "is/was/has/does" (already mapped above); don't strip
    // double-s ("possess"); don't strip when stripping would leave <2 chars.
    if (lower.length >= 4 && lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us') && !lower.endsWith('is')) {
        // Words ending in -ies revert to -y ("studies" -> "study", "carries" -> "carry")
        if (lower.endsWith('ies') && lower.length >= 5) {
            return preserveCase(verb, verb.slice(0, -3) + 'y');
        }
        // Words ending in -es preceded by sh/ch/x/z/o ("watches" -> "watch", "fixes" -> "fix", "goes" handled above)
        if (lower.endsWith('es') && /(sh|ch|x|z|o)es$/.test(lower)) {
            return preserveCase(verb, verb.slice(0, -2));
        }
        return preserveCase(verb, verb.slice(0, -1));
    }
    return verb;
}

function preserveCase(original: string, replacement: string): string {
    if (!original) return replacement;
    if (original[0] === original[0].toUpperCase()) {
        return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface EnforceOptions {
    candidateName?: string | null;
    yearsOfExperience?: number | null;
}

/**
 * Strip third-person voice from the Professional Summary section of a resume.
 * Returns the full markdown with the summary section rewritten in first person.
 * Other sections are returned unchanged.
 */
export function enforceFirstPersonSummary(markdown: string, opts: EnforceOptions): string {
    if (!markdown || typeof markdown !== 'string') return markdown;
    const firstName = (opts.candidateName ?? '').trim().split(/\s+/)[0] ?? '';

    const summaryBlock = extractSummaryBlock(markdown);
    if (!summaryBlock) return markdown;

    const { heading, body, startIndex, endIndex } = summaryBlock;
    const scrubbed = scrubBody(body, firstName, opts.yearsOfExperience);
    if (scrubbed === body) return markdown;

    return markdown.slice(0, startIndex) + heading + scrubbed + markdown.slice(endIndex);
}

/**
 * Locate the Professional Summary section. Tries an explicit heading first
 * (## Professional Summary, ## Summary, ## Profile, ## About). Falls back to
 * the first prose paragraph between the header block and the first ##
 * heading when the LLM omits the heading entirely. Returns the heading text
 * (may be empty), the body text, and the absolute slice indices so the
 * caller can swap the body without disturbing surrounding content.
 */
function extractSummaryBlock(markdown: string): { heading: string; body: string; startIndex: number; endIndex: number } | null {
    // Strategy 1 — explicit heading (## Professional Summary etc.)
    const headingRegex = /(^|\n)(#{1,3}\s*(?:Professional\s+Summary|Summary|Profile|Career\s+Summary|About)\s*\n)/i;
    const m = headingRegex.exec(markdown);
    if (m) {
        const headingStart = m.index + m[1].length;
        const bodyStart = headingStart + m[2].length;
        const rest = markdown.slice(bodyStart);
        const nextHeading = /\n#{1,3}\s+\S/.exec(rest);
        const bodyEnd = nextHeading ? bodyStart + nextHeading.index : markdown.length;
        return {
            heading: m[2],
            body: markdown.slice(bodyStart, bodyEnd),
            startIndex: headingStart,
            endIndex: bodyEnd,
        };
    }

    // Strategy 2 — headingless. The summary is the last prose paragraph
    // BEFORE the first ## heading (Work Experience etc.). Header block is
    // short single-line items (# Name, *Title*, contact line) — the summary
    // is the long multi-sentence paragraph that follows.
    const firstSection = /\n#{1,3}\s+\S/.exec(markdown);
    if (!firstSection) return null;

    const preamble = markdown.slice(0, firstSection.index);
    const paragraphs = preamble.split(/\n\s*\n/);

    // Walk from end of preamble back, find first paragraph that looks like
    // a summary: long enough to be prose, not a heading, not a list, not the
    // contact line (which contains "|" separators or "@" for email).
    for (let i = paragraphs.length - 1; i >= 0; i--) {
        const raw = paragraphs[i];
        const trimmed = raw.trim();
        if (trimmed.length < 80) continue;         // too short
        if (trimmed.startsWith('#')) continue;     // heading
        if (/^[-*]\s/.test(trimmed)) continue;     // bullet list
        if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.includes('\n')) continue; // italic title line
        if (trimmed.includes('|') && trimmed.length < 200) continue; // contact line
        if (/@\S+\.\S+/.test(trimmed) && trimmed.length < 200) continue; // email-bearing line
        // Found the summary paragraph. Compute its absolute slice indices.
        const joinedBefore = paragraphs.slice(0, i).join('\n\n');
        const startIndex = joinedBefore.length + (i > 0 ? 2 : 0); // +2 for the rejoining \n\n
        return {
            heading: '',
            body: raw,
            startIndex,
            endIndex: startIndex + raw.length,
        };
    }

    return null;
}

function scrubBody(body: string, firstName: string, yearsOfExperience?: number | null): string {
    let scrubbed = body;
    const stats: string[] = [];

    // 1. "{FirstName} <verb>" -> "I <verb-first-person>".
    //    Only fire when the following word looks verb-like (in the known map
    //    or ends with -s/-es/-ies). Prevents "Kiron Kurian" -> "I Kurian"
    //    when the LLM uses the candidate's full name.
    if (firstName) {
        const namePattern = new RegExp(`\\b${escapeRegex(firstName)}\\s+([A-Za-z][A-Za-z'-]*)`, 'g');
        scrubbed = scrubbed.replace(namePattern, (match, verb: string) => {
            if (!looksLikeVerb(verb)) return match;
            stats.push(`name+verb: "${match}" -> "I ${conjugateToFirstPerson(verb)}"`);
            return `I ${conjugateToFirstPerson(verb)}`;
        });
    }

    // 2. "he/she/they <verb>" -> "I <verb-first-person>" (CASE-INSENSITIVE).
    //    The previous version only caught capital He/She/They, so lowercase
    //    "he is equipped" / "he brings" / "he adapts" slipped through. This
    //    is the bug behind 90% of third-person leaks in real LLM output —
    //    the model often uses the name in sentence 1 and lowercase pronouns
    //    in sentences 2 and 3.
    scrubbed = scrubbed.replace(/\b(he|she|they)\s+([A-Za-z][A-Za-z'-]*)/gi, (match, _pronoun, verb: string) => {
        stats.push(`pronoun+verb: "${match}" -> "I ${conjugateToFirstPerson(verb)}"`);
        return `I ${conjugateToFirstPerson(verb)}`;
    });

    // 3. Possessives "his/her/their" -> "my" (case-insensitive).
    scrubbed = scrubbed.replace(/\b(his|her|their)\b/gi, (m) => {
        stats.push(`possessive: "${m}" -> "my"`);
        return preserveCase(m, 'my');
    });

    // 4. Object pronouns "him/them" -> "me" (case-insensitive).
    scrubbed = scrubbed.replace(/\b(him|them)\b/gi, (m) => {
        stats.push(`object pronoun: "${m}" -> "me"`);
        return preserveCase(m, 'me');
    });

    // 5. Reflexive pronouns -> "myself" (case-insensitive).
    scrubbed = scrubbed.replace(/\b(himself|herself|themself|themselves)\b/gi, (m) => {
        stats.push(`reflexive: "${m}" -> "myself"`);
        return preserveCase(m, 'myself');
    });

    // 6. Years-of-experience number correction. Matches "X years of <ANY>",
    //    "X+ years in <ANY>" — not just "experience" / "hands-on". Real
    //    output uses phrasings like "X years of performance marketing" or
    //    "X+ years in B2B sales", which the narrow original regex missed.
    //    Only overrides when the existing number is more than 1 year off
    //    the server-computed value (preserves reasonable rounding).
    if (typeof yearsOfExperience === 'number' && yearsOfExperience > 0) {
        scrubbed = scrubbed.replace(/\b(\d+)(\+?)\s+(years?\s+(?:of|in)\b)/gi, (match, num, plus, rest) => {
            const existing = parseInt(num, 10);
            if (!Number.isFinite(existing)) return match;
            if (Math.abs(existing - yearsOfExperience) <= 1) return match;
            stats.push(`years digits: "${num}${plus}" -> "${yearsOfExperience}${plus}"`);
            return `${yearsOfExperience}${plus} ${rest}`;
        });
        // Word-form numbers ("three years of marketing", "five years in delivery").
        const WORD_NUMBERS: Record<string, number> = {
            one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
            eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
            eighteen: 18, nineteen: 19, twenty: 20,
        };
        scrubbed = scrubbed.replace(/\b([A-Za-z]+)\s+(years?\s+(?:of|in)\b)/gi, (match, wordNum: string, rest: string) => {
            const existing = WORD_NUMBERS[wordNum.toLowerCase()];
            if (existing === undefined) return match;
            if (Math.abs(existing - yearsOfExperience) <= 1) return match;
            stats.push(`years word: "${wordNum}" -> "${yearsOfExperience}"`);
            return `${yearsOfExperience} ${rest}`;
        });
    }

    // 7. Strip any [VERIFY:] tokens that ask the user to compute years of
    //    experience — we have the answer server-side, no verification needed.
    scrubbed = scrubbed.replace(/\[VERIFY:[^\]]*years?[^\]]*\]/gi, (match) => {
        if (typeof yearsOfExperience === 'number' && yearsOfExperience > 0) {
            stats.push(`stripped [VERIFY: years] placeholder`);
            return `${yearsOfExperience} years`;
        }
        return match;
    });

    if (stats.length > 0) {
        console.log(`[voiceEnforcer] Applied ${stats.length} fix(es) to professional summary:`);
        stats.forEach((s) => console.log(`  - ${s}`));
    } else if (firstName) {
        console.log(`[voiceEnforcer] Summary section located but no third-person violations found (firstName="${firstName}").`);
    }

    return scrubbed;
}

/**
 * True when the token looks like a third-person singular verb form —
 * either an irregular in our conjugation map (is/has/does/...) or a
 * regular -s/-es/-ies ending. Excludes common false positives like
 * proper nouns and adjectives ending in -ous/-ess/-us/-is.
 */
function looksLikeVerb(token: string): boolean {
    const lower = token.toLowerCase();
    if (VERB_CONJUGATIONS[lower]) return true;
    if (lower.length < 3) return false;
    if (/(ous|ess|us|is)$/.test(lower)) return false;
    return /(ies|es|s)$/.test(lower);
}
