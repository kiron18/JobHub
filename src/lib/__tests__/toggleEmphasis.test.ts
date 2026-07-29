import { describe, it, expect } from 'vitest';
import { toggleEmphasis } from '../toggleEmphasis';

/**
 * Helper: express the selection inline with pipes so the cases read like what
 * a user would actually have highlighted. "a |bc| d" selects "bc".
 */
function apply(marked: string, marker: '**' | '*' = '**') {
    const start = marked.indexOf('|');
    const end = marked.indexOf('|', start + 1) - 1;
    const text = marked.replace(/\|/g, '');
    const result = toggleEmphasis(text, start, end, marker);
    return {
        text: result.text,
        selected: result.text.slice(result.selectionStart, result.selectionEnd),
    };
}

describe('toggleEmphasis — adding', () => {
    it('bolds the highlighted phrase', () => {
        expect(apply('- Cut processing time by |40%| across three teams').text)
            .toBe('- Cut processing time by **40%** across three teams');
    });

    it('italicises with a single marker', () => {
        expect(apply('- Cut costs by |40%| overall', '*').text)
            .toBe('- Cut costs by *40%* overall');
    });

    it('leaves the selection wrapping the newly bolded text so a second press undoes it', () => {
        const once = apply('- Cut costs by |40%| overall');
        expect(once.selected).toBe('**40%**');
    });

    it('bolds the word under the caret when nothing is highlighted', () => {
        const text = '- Cut costs by 40% overall';
        const caret = text.indexOf('40%') + 1;
        const result = toggleEmphasis(text, caret, caret, '**');
        expect(result.text).toBe('- Cut costs by **40%** overall');
    });

    it('does nothing when the caret sits on empty space', () => {
        const text = '- Cut costs   by 40%';
        const caret = text.indexOf('   ') + 1;
        expect(toggleEmphasis(text, caret, caret, '**').text).toBe(text);
    });
});

describe('toggleEmphasis — structural safety', () => {
    it('never swallows a bullet marker, even when the whole line is selected', () => {
        // A line wrapped end to end in emphasis can be re-read as a date or a
        // skills row by the exporters. The bullet prefix must stay outside.
        expect(apply('|- Cut processing time by 40%|').text)
            .toBe('- **Cut processing time by 40%**');
    });

    it('never swallows a heading marker', () => {
        expect(apply('|## Professional Summary|').text)
            .toBe('## **Professional Summary**');
    });

    it('excludes whitespace that the user dragged past the end of a word', () => {
        expect(apply('- Cut costs by |40%   | overall').text)
            .toBe('- Cut costs by **40%**    overall');
    });

    it('emphasises each line separately across a multi-line selection', () => {
        const result = apply('|- First bullet here\n- Second bullet here|');
        expect(result.text).toBe('- **First bullet here**\n- **Second bullet here**');
    });

    it('skips blank lines inside a multi-line selection', () => {
        const result = apply('|- First bullet\n\n- Second bullet|');
        expect(result.text).toBe('- **First bullet**\n\n- **Second bullet**');
    });
});

describe('toggleEmphasis — removing', () => {
    it('unbolds when the markers are inside the selection', () => {
        expect(apply('- Cut costs by |**40%**| overall').text)
            .toBe('- Cut costs by 40% overall');
    });

    it('unbolds when the markers sit just outside the selection', () => {
        expect(apply('- Cut costs by **|40%|** overall').text)
            .toBe('- Cut costs by 40% overall');
    });

    it('round-trips: bold then unbold returns the original text', () => {
        const original = '- Cut processing time by 40% across three teams';
        const start = original.indexOf('40%');
        const bolded = toggleEmphasis(original, start, start + 3, '**');
        const back = toggleEmphasis(bolded.text, bolded.selectionStart, bolded.selectionEnd, '**');
        expect(back.text).toBe(original);
    });

    it('un-italicises without disturbing a neighbouring bold span', () => {
        expect(apply('- Grew **12%** and cut *|churn|*', '*').text)
            .toBe('- Grew **12%** and cut churn');
    });
});

describe('toggleEmphasis — bold and italic do not collide', () => {
    it('italicising inside a bold span adds italic rather than stripping the bold', () => {
        // The italic marker must not mistake the surrounding "**" for its own.
        expect(apply('- Grew **|12%|** overall', '*').text)
            .toBe('- Grew ***12%*** overall');
    });

    it('bolding an already-italic phrase nests rather than replaces', () => {
        expect(apply('- Grew *|12%|* overall', '**').text)
            .toBe('- Grew ***12%*** overall');
    });
});
