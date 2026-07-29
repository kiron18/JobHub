/**
 * Verification for the emphasis pass.
 *
 * The pass hands a finished resume to a model and asks for it back with the
 * emphasis re-decided. That is only an acceptable thing to do to someone's
 * resume if the result cannot differ from the original in any way other than
 * emphasis — models paraphrase, "fix" spelling, and drop blank lines without
 * being asked.
 *
 * So nothing is trusted. The returned document is checked line by line: the
 * text under the markers must be identical, and lines that are not eligible for
 * emphasis must be untouched down to the character. Anything else and the pass
 * is discarded and the original stands, which makes the worst realistic outcome
 * of this feature "no change" rather than "a damaged resume".
 */
import { unwrapBold, countBoldSpans, MAX_BOLD_SPANS } from './boldEmphasis';

export interface EmphasisPassResult {
    accepted: boolean;
    content: string;
    /** Why it was rejected, for the log — never shown to the candidate. */
    reason?: string;
}

/** Lines that may gain or lose emphasis: bullets, and the summary paragraph. */
function eligibility(lines: string[]): boolean[] {
    let inSummary = false;
    return lines.map((line) => {
        if (line.startsWith('## ')) {
            inSummary = /professional summary/i.test(line);
            return false;
        }
        if (line.startsWith('- ')) return true;
        // Prose under the summary heading — one span is permitted there.
        return inSummary && line.trim().length > 0 && !line.startsWith('#');
    });
}

/** Strip code fences a model may have wrapped the document in. */
export function stripFences(raw: string): string {
    let text = raw.trim();
    if (!text.startsWith('```')) return text;
    const lines = text.split('\n');
    if (lines[0].startsWith('```')) lines.shift();
    if (lines[lines.length - 1]?.startsWith('```')) lines.pop();
    return lines.join('\n').trim();
}

/**
 * Accept the re-emphasised document only if it is the original with different
 * emphasis. Returns the original untouched on any doubt whatsoever.
 */
export function verifyEmphasisPass(original: string, returned: string): EmphasisPassResult {
    const reject = (reason: string): EmphasisPassResult => ({ accepted: false, content: original, reason });

    const candidate = stripFences(returned);
    if (!candidate) return reject('empty response');

    const originalLines = original.split('\n');
    const candidateLines = candidate.split('\n');

    if (originalLines.length !== candidateLines.length) {
        return reject(`line count changed: ${originalLines.length} -> ${candidateLines.length}`);
    }

    const eligible = eligibility(originalLines);

    for (let i = 0; i < originalLines.length; i++) {
        const before = originalLines[i];
        const after = candidateLines[i];

        if (before === after) continue;

        if (!eligible[i]) {
            return reject(`line ${i + 1} is not eligible for emphasis but changed`);
        }

        // The words themselves must be untouched — only markers may move.
        if (unwrapBold(before) !== unwrapBold(after)) {
            return reject(`line ${i + 1} changed beyond emphasis`);
        }

        if (countBoldSpans(after) > 1) {
            return reject(`line ${i + 1} carries more than one emphasised span`);
        }
    }

    const total = candidateLines.reduce(
        (sum, line, i) => (eligible[i] ? sum + countBoldSpans(line) : sum),
        0,
    );
    if (total > MAX_BOLD_SPANS) {
        return reject(`${total} emphasised spans exceeds the ceiling of ${MAX_BOLD_SPANS}`);
    }
    if (total === 0) {
        return reject('nothing was emphasised');
    }

    return { accepted: true, content: candidate };
}
