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

    // 1. "{FirstName} <verb>" -> "I <verb-first-person>".
    //    Match the name as a whole word, followed by a verb-like token.
    if (firstName) {
        const namePattern = new RegExp(`\\b${escapeRegex(firstName)}\\s+([A-Za-z][A-Za-z'-]*)`, 'g');
        scrubbed = scrubbed.replace(namePattern, (_match, verb: string) => {
            return `I ${conjugateToFirstPerson(verb)}`;
        });
    }

    // 2. "He/She/They <verb>" -> "I <verb-first-person>".
    //    Only at word boundaries so we don't catch "Heading" or "Their" mid-token.
    scrubbed = scrubbed.replace(/\b(He|She|They)\s+([A-Za-z][A-Za-z'-]*)/g, (_m, _pronoun, verb: string) => {
        return `I ${conjugateToFirstPerson(verb)}`;
    });

    // 3. Possessives. "His/Her/Their X" -> "My X".
    //    Note: "Her" is ambiguous (object vs possessive). In a Professional
    //    Summary context, both senses refer to the candidate and "My/Me"
    //    are correct first-person substitutions for both.
    scrubbed = scrubbed.replace(/\b(His|Her|Their)\b/g, (m) => preserveCase(m, 'my'));

    // 4. Object pronouns "Him/Them" -> "Me".
    scrubbed = scrubbed.replace(/\b(Him|Them)\b/g, (m) => preserveCase(m, 'me'));

    // 5. Reflexive "Himself/Herself/Themself/Themselves" -> "Myself".
    scrubbed = scrubbed.replace(/\b(Himself|Herself|Themself|Themselves)\b/g, (m) => preserveCase(m, 'myself'));

    // 6. Years-of-experience number correction.
    //    Only act when we have a server-computed value AND the existing
    //    figure is more than 1 year off. Avoids fighting reasonable rounding.
    if (typeof yearsOfExperience === 'number' && yearsOfExperience > 0) {
        scrubbed = scrubbed.replace(/\b(\d+)(\+?)\s+years?\s+of\s+(experience|hands-on)/gi, (match, num, plus, kind) => {
            const existing = parseInt(num, 10);
            if (!Number.isFinite(existing)) return match;
            if (Math.abs(existing - yearsOfExperience) <= 1) return match;
            return `${yearsOfExperience}${plus} years of ${kind}`;
        });
        // Word-form numbers ("three years of experience")
        const WORD_NUMBERS: Record<string, number> = {
            one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
            eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
            eighteen: 18, nineteen: 19, twenty: 20,
        };
        scrubbed = scrubbed.replace(/\b([A-Za-z]+)\s+years?\s+of\s+(experience|hands-on)/gi, (match, wordNum: string, kind: string) => {
            const existing = WORD_NUMBERS[wordNum.toLowerCase()];
            if (existing === undefined) return match;
            if (Math.abs(existing - yearsOfExperience) <= 1) return match;
            return `${yearsOfExperience} years of ${kind}`;
        });
    }

    // 7. Strip any [VERIFY:] tokens that ask the user to compute years of
    //    experience — we have the answer server-side, no verification needed.
    scrubbed = scrubbed.replace(/\[VERIFY:[^\]]*years?[^\]]*\]/gi, (match) => {
        if (typeof yearsOfExperience === 'number' && yearsOfExperience > 0) {
            return `${yearsOfExperience} years`;
        }
        return match;
    });

    return scrubbed;
}
