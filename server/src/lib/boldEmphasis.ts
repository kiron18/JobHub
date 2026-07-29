/**
 * Bold emphasis enforcement for generated resumes.
 *
 * The resume prompt asks the model to bold the figure that carries each result,
 * because a recruiter scanning a page for thirty seconds should land on "cut
 * processing time by **40%**" rather than read every bullet in order. Prompts
 * being prompts, a model will sometimes bold half the document — and a resume
 * where everything is emphasised is strictly worse than one where nothing is,
 * since nothing stands out and it reads as machine-written keyword stuffing.
 *
 * These are the deterministic backstop. Whatever the model returns, what ships
 * has at most one bolded span per bullet and a hard ceiling across the resume,
 * with the summary left completely clean.
 *
 * Only ever applied to freshly generated content. A user's own edits are their
 * business — the editor lets them bold and unbold whatever they like.
 */

/**
 * Matches a **bolded** span. Requires a non-asterisk immediately after the
 * opening marker so a bare run of asterisks is not mistaken for emphasis —
 * the same rule the PDF and Word exporters apply when rendering.
 */
const BOLD_SPAN = /\*\*([^*].*?)\*\*/g;

/** Hard ceiling on bolded spans across an entire resume. */
export const MAX_BOLD_SPANS = 12;

/** Remove bold markers from a string, keeping the words themselves. */
export function unwrapBold(text: string): string {
    return text.replace(BOLD_SPAN, '$1');
}

/** How many bolded spans a string contains. */
export function countBoldSpans(text: string): number {
    return text.match(BOLD_SPAN)?.length ?? 0;
}

/**
 * Keep at most one bolded span in a single line, unwrapping any others.
 *
 * The first is kept rather than the "best" one: bullets lead with their result,
 * so the earliest emphasis is the one most likely to be the figure that matters.
 */
export function capBoldInLine(line: string, budget: number): { line: string; used: number } {
    if (budget <= 0) return { line: unwrapBold(line), used: 0 };

    let kept = 0;
    const capped = line.replace(BOLD_SPAN, (match, inner: string) => {
        if (kept === 0) {
            kept = 1;
            return match;
        }
        return inner;
    });

    return { line: capped, used: kept };
}

/**
 * Apply the per-line and whole-resume caps across an ordered list of bullet
 * blocks (one multi-line string per role, in the order they appear).
 *
 * Roles arrive most-relevant-first, so spending the budget top-down keeps the
 * emphasis where a recruiter actually looks and strips it from the tail.
 */
export function capBoldEmphasis(descriptions: string[], maxTotal = MAX_BOLD_SPANS): string[] {
    let remaining = maxTotal;

    return descriptions.map((description) => {
        if (!description || !description.includes('**')) return description;

        const cappedLines = description.split('\n').map((line) => {
            const { line: capped, used } = capBoldInLine(line, remaining);
            remaining -= used;
            return capped;
        });

        return cappedLines.join('\n');
    });
}
