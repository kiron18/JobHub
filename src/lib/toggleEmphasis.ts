/**
 * Bold / italic toggling for the markdown draft editor.
 *
 * The editor is a plain textarea holding markdown, and the exporters read that
 * markdown structurally — a line wrapped end to end in emphasis can be mistaken
 * for a date, a skills row, or a heading. So this deliberately narrows what the
 * B and I buttons are allowed to produce:
 *
 *   - markers never swallow a line's bullet or heading prefix, so a bulleted
 *     line stays a bulleted line;
 *   - markers never wrap surrounding whitespace, which markdown would not
 *     render as emphasis anyway;
 *   - a selection spanning several lines is emphasised line by line rather than
 *     as one span across newlines, which markdown does not support.
 *
 * Kept as a pure function so the awkward cases can be tested directly rather
 * than clicked through by hand.
 */

export type EmphasisMarker = '**' | '*';

export interface Selection {
    text: string;
    selectionStart: number;
    selectionEnd: number;
}

/** Leading syntax that must stay outside the emphasis markers. */
const LINE_PREFIX = /^(\s*(?:[-*•]\s+|#{1,6}\s+)?)/;

/** Characters that make up a "word" when the caret is sitting inside one. */
const WORD_CHAR = /[\w%$£€.,'’-]/;

/** True when the marker at `index` is part of a longer run of asterisks. */
function isPartOfLongerRun(text: string, index: number, marker: EmphasisMarker): boolean {
    if (marker !== '*') return false;
    return text[index - 1] === '*' || text[index + 1] === '*';
}

/** Expand a collapsed caret to the word it is sitting in. */
function expandToWord(text: string, caret: number): [number, number] {
    let start = caret;
    let end = caret;
    while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
    while (end < text.length && WORD_CHAR.test(text[end])) end++;
    return [start, end];
}

/**
 * Pull a range back so it covers only emphasise-able content: no line prefix,
 * no surrounding whitespace. Returns null when nothing is left worth marking.
 */
function tightenRange(text: string, start: number, end: number): [number, number] | null {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const prefixLength = lineStart + (text.slice(lineStart).match(LINE_PREFIX)?.[1].length ?? 0);
    let s = Math.max(start, prefixLength);
    let e = end;

    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;

    return e > s ? [s, e] : null;
}

/** Is this exact range already wrapped in the marker, inside or outside? */
function wrappingKind(
    text: string,
    start: number,
    end: number,
    marker: EmphasisMarker,
): 'inside' | 'outside' | null {
    const len = marker.length;
    const selected = text.slice(start, end);

    if (
        selected.length > len * 2 &&
        selected.startsWith(marker) &&
        selected.endsWith(marker) &&
        !isPartOfLongerRun(selected, 0, marker) &&
        !isPartOfLongerRun(selected, selected.length - 1, marker)
    ) {
        return 'inside';
    }

    if (
        start >= len &&
        text.slice(start - len, start) === marker &&
        text.slice(end, end + len) === marker &&
        !isPartOfLongerRun(text, start - len, marker) &&
        !isPartOfLongerRun(text, end + len - 1, marker)
    ) {
        return 'outside';
    }

    return null;
}

/** Apply the toggle to a single line's worth of range. */
function toggleRange(
    text: string,
    start: number,
    end: number,
    marker: EmphasisMarker,
): Selection | null {
    const tightened = tightenRange(text, start, end);
    if (!tightened) return null;
    const [s, e] = tightened;

    const wrapping = wrappingKind(text, s, e, marker);
    const len = marker.length;

    if (wrapping === 'inside') {
        const inner = text.slice(s + len, e - len);
        return {
            text: text.slice(0, s) + inner + text.slice(e),
            selectionStart: s,
            selectionEnd: s + inner.length,
        };
    }

    if (wrapping === 'outside') {
        const inner = text.slice(s, e);
        return {
            text: text.slice(0, s - len) + inner + text.slice(e + len),
            selectionStart: s - len,
            selectionEnd: s - len + inner.length,
        };
    }

    const inner = text.slice(s, e);
    return {
        text: text.slice(0, s) + marker + inner + marker + text.slice(e),
        selectionStart: s,
        selectionEnd: e + len * 2,
    };
}

/**
 * Toggle emphasis over the current selection, returning the new text and where
 * the selection should sit afterwards. Returns the input unchanged when there
 * is nothing sensible to mark.
 */
export function toggleEmphasis(
    text: string,
    selectionStart: number,
    selectionEnd: number,
    marker: EmphasisMarker,
): Selection {
    const unchanged: Selection = { text, selectionStart, selectionEnd };

    let start = selectionStart;
    let end = selectionEnd;

    if (start === end) {
        [start, end] = expandToWord(text, start);
        if (start === end) return unchanged;
    }

    const slice = text.slice(start, end);

    // Single line — the common case, and the only one that needs to preserve
    // the caret precisely.
    if (!slice.includes('\n')) {
        return toggleRange(text, start, end, marker) ?? unchanged;
    }

    // Multi-line: emphasise each line's content on its own. Markdown emphasis
    // cannot span a newline, so one span across the whole selection would
    // simply render as literal asterisks.
    let result = text;
    let offset = 0;
    let touched = false;
    let firstStart = start;
    let lastEnd = end;

    for (const line of splitLineRanges(text, start, end)) {
        const toggled = toggleRange(result, line.start + offset, line.end + offset, marker);
        if (!toggled) continue;
        offset += toggled.text.length - result.length;
        result = toggled.text;
        if (!touched) firstStart = toggled.selectionStart;
        lastEnd = toggled.selectionEnd;
        touched = true;
    }

    return touched
        ? { text: result, selectionStart: firstStart, selectionEnd: lastEnd }
        : unchanged;
}

/** Break a selection into one range per line it covers. */
function splitLineRanges(text: string, start: number, end: number): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];
    let cursor = start;

    while (cursor < end) {
        const newline = text.indexOf('\n', cursor);
        const lineEnd = newline === -1 || newline > end ? end : newline;
        if (lineEnd > cursor) ranges.push({ start: cursor, end: lineEnd });
        cursor = lineEnd + 1;
    }

    return ranges;
}
