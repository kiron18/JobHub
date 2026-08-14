/**
 * Normalise a person's name for storage.
 *
 * Resume headers are very often typeset in capitals, and the intake extractor
 * stores what it reads, so profiles legitimately ended up holding names like
 * "KIRON KURIAN JOHN". That is a typographic choice on a document, not how
 * anyone writes their own name, and it was reaching employers in email
 * signatures and export filenames in block capitals.
 *
 * Only entirely-uppercase names are touched. A name with any lowercase in it is
 * already the form its owner chose, so "McDonald", "de Silva" and "van der Berg"
 * are left exactly as they are. This is deliberately narrow: the cost of
 * mangling someone's real name is much higher than the cost of leaving one
 * shouty name alone.
 *
 * The frontend keeps its own copy of this in src/lib/outreachFill.ts. That one
 * is a display-time safety net for rows written before this existed and for any
 * name that arrives from somewhere this does not cover; this one is the fix at
 * the point of writing.
 */
export function normalisePersonName(name?: string | null): string | undefined {
    const trimmed = name?.trim();
    if (!trimmed) return undefined;
    if (/[a-z]/.test(trimmed)) return trimmed;

    return trimmed
        .toLowerCase()
        .replace(/(^|[\s'’-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}
