/**
 * Heading / bullet / paragraph toggling for the markdown draft editor.
 *
 * The companion to `toggleEmphasis`. Emphasis was already a button while the
 * two structural marks — `## ` and `- ` — were left for the user to type, which
 * is why the editor needed a block of instructions above it explaining markdown
 * at all. These make them clickable, so the syntax becomes something you can
 * discover rather than something you have to be told.
 *
 * Two things shape the rules below:
 *
 *   - The Word/PDF exporters parse line by line (`exportDocx.ts:parseLine`), so
 *     a mark only counts at the very start of its own line.
 *   - The on-screen preview is CommonMark via ReactMarkdown, which is stricter:
 *     a plain line directly beneath a bullet is swallowed into that bullet, and
 *     a line indented four spaces becomes a code block. So converting a line
 *     back to body text has to pad it with a blank line, and applying any style
 *     drops leading indentation. Without that the preview and the download
 *     disagree about the same document.
 *
 * Pure, so the fiddly cases are tested rather than clicked through by hand.
 */

import type { Selection } from './toggleEmphasis';

export type LineStyle = 'heading' | 'bullet' | 'body';

/** Sections are h2 — a single hash is the candidate's name at the top. */
const SECTION_MARK = '## ';
const BULLET_MARK = '- ';

const HEADING_RE = /^\s*#{1,6}\s+/;
/** `*` only counts as a bullet with a space after it, so `*italics*` is safe. */
const BULLET_RE = /^\s*[-*•]\s+/;

/** What a line currently is, by its leading mark. */
export function lineStyleOf(line: string): LineStyle {
    if (HEADING_RE.test(line)) return 'heading';
    if (BULLET_RE.test(line)) return 'bullet';
    return 'body';
}

/** The line's words, with any mark and indentation stripped off the front. */
function contentOf(line: string): string {
    const mark = line.match(HEADING_RE) ?? line.match(BULLET_RE);
    return mark ? line.slice(mark[0].length) : line.replace(/^\s+/, '');
}

function withStyle(line: string, style: LineStyle): string {
    const content = contentOf(line);
    if (style === 'heading') return SECTION_MARK + content;
    if (style === 'bullet') return BULLET_MARK + content;
    return content;
}

interface LineSpan {
    start: number;
    end: number;
    text: string;
}

/** Every whole line the range touches, even if it only clips one character. */
function lineSpans(text: string, from: number, to: number): LineSpan[] {
    const first = from <= 0 ? 0 : text.lastIndexOf('\n', from - 1) + 1;
    const trailing = text.indexOf('\n', to);
    const last = trailing === -1 ? text.length : trailing;

    const spans: LineSpan[] = [];
    let cursor = first;
    while (cursor <= last) {
        const newline = text.indexOf('\n', cursor);
        const end = newline === -1 || newline > last ? last : newline;
        spans.push({ start: cursor, end, text: text.slice(cursor, end) });
        cursor = end + 1;
    }
    return spans;
}

/** Text of the line ending at `newlineIndex`, or null when there isn't one. */
function lineBefore(text: string, newlineIndex: number): string | null {
    if (newlineIndex <= 0) return null;
    const start = text.lastIndexOf('\n', newlineIndex - 1) + 1;
    return text.slice(start, newlineIndex);
}

/** Text of the line starting after `newlineIndex`, or null when there isn't one. */
function lineAfter(text: string, newlineIndex: number): string | null {
    if (newlineIndex >= text.length) return null;
    const start = newlineIndex + 1;
    const newline = text.indexOf('\n', start);
    return text.slice(start, newline === -1 ? text.length : newline);
}

/**
 * Apply a line style across the selection, returning the new text and where the
 * caret should sit afterwards. Pressing the style a line already has turns it
 * back into body text, the way B on bold text unbolds it.
 */
export function toggleLinePrefix(
    text: string,
    selectionStart: number,
    selectionEnd: number,
    style: LineStyle,
): Selection {
    const unchanged: Selection = { text, selectionStart, selectionEnd };

    const spans = lineSpans(text, selectionStart, selectionEnd);
    if (spans.length === 0) return unchanged;

    // Blank lines are skipped when several lines are selected — nobody means to
    // turn the gaps between their paragraphs into empty bullets. A caret alone
    // on a blank line is the opposite case: that is someone starting a point.
    const targets = spans.length === 1 ? spans : spans.filter(s => s.text.trim() !== '');
    if (targets.length === 0) return unchanged;

    const alreadyStyled = style !== 'body' && targets.every(s => lineStyleOf(s.text) === style);
    const next: LineStyle = alreadyStyled ? 'body' : style;

    const targeted = new Set(targets.map(s => s.start));
    const styled = (span: LineSpan) => (targeted.has(span.start) ? withStyle(span.text, next) : span.text);

    const regionStart = spans[0].start;
    const regionEnd = spans[spans.length - 1].end;
    const rebuilt = spans.map(styled).join('\n');
    if (rebuilt === text.slice(regionStart, regionEnd)) return unchanged;

    // Body text needs air around it. Only the edges of the converted block are
    // padded: lines left touching in the middle are one paragraph, which is
    // what "make this a paragraph" should mean for a multi-line selection.
    let block = rebuilt;
    let leadPad = 0;
    if (next === 'body') {
        if (lineBefore(text, regionStart - 1)?.trim()) {
            block = `\n${block}`;
            leadPad = 1;
        }
        if (lineAfter(text, regionEnd)?.trim()) {
            block = `${block}\n`;
        }
    }

    const newText = text.slice(0, regionStart) + block + text.slice(regionEnd);
    const blockStart = regionStart + leadPad;

    // A dragged selection keeps covering what it covered. A plain caret has to
    // be placed precisely, or every click of the button jumps the user's cursor
    // to somewhere they weren't typing.
    if (selectionStart !== selectionEnd) {
        return { text: newText, selectionStart: blockStart, selectionEnd: blockStart + rebuilt.length };
    }

    const span = spans.find(s => selectionStart >= s.start && selectionStart <= s.end) ?? spans[0];
    const newLine = styled(span);
    const offsetInContent = Math.max(0, selectionStart - span.start - (span.text.length - contentOf(span.text).length));
    const lineStart = blockStart + spans
        .slice(0, spans.indexOf(span))
        .reduce((n, s) => n + styled(s).length + 1, 0);
    const caret = lineStart + (newLine.length - contentOf(newLine).length) + offsetInContent;

    return { text: newText, selectionStart: caret, selectionEnd: caret };
}

/**
 * Enter inside a bullet starts the next one; Enter on an empty bullet ends the
 * list. Returns null when the keystroke should do its ordinary thing, which is
 * every case except a caret sitting in the body of a bullet line.
 *
 * This is the part that actually removes the typing: a section's worth of
 * points costs one `- ` instead of one per line.
 */
export function continueList(text: string, selectionStart: number, selectionEnd: number): Selection | null {
    if (selectionStart !== selectionEnd) return null;

    const caret = selectionStart;
    const lineStart = caret <= 0 ? 0 : text.lastIndexOf('\n', caret - 1) + 1;
    const newline = text.indexOf('\n', caret);
    const lineEnd = newline === -1 ? text.length : newline;
    const line = text.slice(lineStart, lineEnd);

    const mark = line.match(BULLET_RE);
    if (!mark) return null;
    // Caret parked before the mark means they are editing the start of the
    // line, not finishing a point.
    if (caret < lineStart + mark[0].length) return null;

    if (line.slice(mark[0].length).trim() === '') {
        return {
            text: text.slice(0, lineStart) + text.slice(lineEnd),
            selectionStart: lineStart,
            selectionEnd: lineStart,
        };
    }

    const inserted = `\n${BULLET_MARK}`;
    return {
        text: text.slice(0, caret) + inserted + text.slice(caret),
        selectionStart: caret + inserted.length,
        selectionEnd: caret + inserted.length,
    };
}
