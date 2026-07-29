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

/**
 * A figure worth emphasising: a percentage, an amount of money, a duration, a
 * multiple, or a bare count. Ordered so the more specific forms win — "USD 800K"
 * must match as one unit before the bare-number branch grabs the "800".
 */
const METRIC = new RegExp(
    [
        // Money with a currency code or symbol: "AUD 1.5M", "$250,000", "£40k"
        String.raw`(?:AUD|USD|NZD|GBP|EUR|SGD|INR)\s?\d[\d,]*(?:\.\d+)?\s?[kKmMbB]?\b`,
        String.raw`[$£€₹]\s?\d[\d,]*(?:\.\d+)?\s?[kKmMbB]?\b`,
        // Percentages: "40%", "3.5 %"
        String.raw`\d[\d,]*(?:\.\d+)?\s?%`,
        // Durations and multiples: "18 months", "3x", "40 hours"
        String.raw`\b\d[\d,]*(?:\.\d+)?\s?(?:x\b|hrs?\b|hours?\b|days?\b|weeks?\b|months?\b|years?\b)`,
        // Percentage points: "3pts", "5 ppt"
        String.raw`\b\d[\d,]*(?:\.\d+)?\s?(?:pts?|ppt)\b`,
        // Bare counts, including "20+". The trailing alternation matters: a word
        // boundary cannot match after a "+", so \+?\b silently drops the plus.
        String.raw`\b\d[\d,]*(?:\.\d+)?(?:\+|\b)`,
    ].join('|'),
    'g',
);

/** A bare four-digit year — a date, not an achievement. */
const YEAR_ONLY = /^(?:19|20)\d{2}$/;

/**
 * Bold the figure in a bullet that has none.
 *
 * Asking the model to do this proved unreliable: resume generation runs on
 * whatever FAST_MODEL points at, and a cheap model reading a formatting rule
 * buried deep in a long prompt will often emit nothing at all. Doing it here
 * makes the behaviour identical on every model, costs nothing, and can be
 * tested — the emphasis is no longer a thing we hope for.
 *
 * The figure alone is bolded, never the surrounding words. Picking out "the
 * couple of words that give it meaning" needs judgement about the sentence, and
 * a rule that guesses will eventually bold something absurd. "Documented **45**
 * process flows" is marginally less pretty than bolding the whole phrase and is
 * never wrong, which is the better trade on someone's resume.
 */
export function boldFirstMetric(line: string): { line: string; bolded: boolean } {
    // Respect a bullet the model already emphasised, and never touch a heading,
    // a skills row, or any other line carrying markdown of its own.
    if (line.includes('**')) return { line, bolded: false };

    METRIC.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = METRIC.exec(line)) !== null) {
        const value = match[0].trim();
        // Skip years: "Joined in 2019" is a date, not a result.
        if (YEAR_ONLY.test(value)) continue;

        const start = match.index + match[0].indexOf(value[0]);
        const end = start + value.length;
        return {
            line: `${line.slice(0, start)}**${value}**${line.slice(end)}`,
            bolded: true,
        };
    }

    return { line, bolded: false };
}

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

/**
 * Emphasise the figures in a finished resume markdown document.
 *
 * This is the version that runs on the live generation path, where the model
 * returns the whole document as markdown rather than a list of bullet strings.
 *
 * Only "- " bullet lines are touched. Headings, the summary paragraph, dates and
 * the "**Label:**" rows in education and skills are left exactly as they are —
 * those already carry markdown of their own, and boldFirstMetric declines any
 * line that does. Because emphasis is only ever added inside a bullet's text and
 * never at the start of a line, it cannot change how the exporters classify a
 * line, which is the failure mode that would scramble someone's layout.
 */
export function boldMetricsInMarkdown(markdown: string, maxTotal = MAX_BOLD_SPANS): string {
    const { lines, budget } = capEmphasisLines(markdown.split('\n'), maxTotal);
    return fillEmphasisLines(lines, budget).join('\n');
}

/**
 * Trim only — hold emphasis to one span per bullet and to the ceiling overall,
 * without adding any.
 *
 * This is what runs behind the emphasis pass. Once a model has read the whole
 * document and chosen deliberately, filling in the bullets it left plain would
 * undo exactly the judgement that was worth paying for: a figure left unmarked
 * is usually a decision, not an oversight.
 */
export function capEmphasisInMarkdown(markdown: string, maxTotal = MAX_BOLD_SPANS): string {
    return capEmphasisLines(markdown.split('\n'), maxTotal).lines.join('\n');
}

/**
 * Hold whatever is already emphasised to one span per bullet and to the ceiling
 * overall, spending the budget top-down. Without this an over-eager model can
 * bold half the page untouched — and a resume where everything is emphasised is
 * worse than one where nothing is.
 */
function capEmphasisLines(lines: string[], maxTotal: number): { lines: string[]; budget: number } {
    let budget = maxTotal;

    const capped = lines.map((line) => {
        if (!line.startsWith('- ') || !line.includes('**')) return line;
        const { line: next, used } = capBoldInLine(line, budget);
        budget -= used;
        return next;
    });

    return { lines: capped, budget };
}

/**
 * Spend the remaining budget on bullets that carry a figure but no emphasis, so
 * a document reaches the page emphasised even when the model returned nothing.
 */
function fillEmphasisLines(lines: string[], budget: number): string[] {
    let remaining = budget;

    return lines.map((line) => {
        if (remaining <= 0 || !line.startsWith('- ')) return line;
        const { line: next, bolded } = boldFirstMetric(line);
        if (bolded) remaining--;
        return next;
    });
}

/**
 * Emphasise the figures across a resume: honour whatever the model bolded,
 * hold it to the ceiling, then fill the remaining budget by bolding the figure
 * in bullets that still have none.
 *
 * Roles arrive most-relevant-first and the budget is spent top-down, so the
 * emphasis lands where a recruiter actually looks and runs out further down the
 * page — which is also where it matters least.
 */
export function applyBoldEmphasis(descriptions: string[], maxTotal = MAX_BOLD_SPANS): string[] {
    const capped = capBoldEmphasis(descriptions, maxTotal);

    let remaining = maxTotal - capped.reduce((sum, d) => sum + countBoldSpans(d || ''), 0);
    if (remaining <= 0) return capped;

    return capped.map((description) => {
        if (!description || remaining <= 0) return description;

        // At this point in the pipeline a role's description is its bullets
        // joined by newlines, with no "- " markers yet — those are added later by
        // the markdown renderer. So every non-empty line here is a bullet.
        const lines = description.split('\n').map((line) => {
            if (remaining <= 0 || !line.trim()) return line;
            const { line: next, bolded } = boldFirstMetric(line);
            if (bolded) remaining--;
            return next;
        });

        return lines.join('\n');
    });
}
