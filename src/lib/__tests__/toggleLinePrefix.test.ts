import { describe, it, expect } from 'vitest';
import { toggleLinePrefix, continueList, lineStyleOf } from '../toggleLinePrefix';

/**
 * Helper: mark the caret with `|`, or a selection with a pair of them, so the
 * cases read like what the user actually had in the editor.
 */
function at(marked: string) {
    const start = marked.indexOf('|');
    const second = marked.indexOf('|', start + 1);
    const end = second === -1 ? start : second - 1;
    return { text: marked.replace(/\|/g, ''), start, end };
}

function apply(marked: string, style: 'heading' | 'bullet' | 'body') {
    const { text, start, end } = at(marked);
    const result = toggleLinePrefix(text, start, end, style);
    return {
        text: result.text,
        caret: result.selectionStart,
        selected: result.text.slice(result.selectionStart, result.selectionEnd),
    };
}

describe('lineStyleOf', () => {
    it('reads the leading mark', () => {
        expect(lineStyleOf('## Experience')).toBe('heading');
        expect(lineStyleOf('- Ran the roster')).toBe('bullet');
        expect(lineStyleOf('Mildura, VIC')).toBe('body');
    });

    it('does not mistake an italic line for a bullet', () => {
        expect(lineStyleOf('*Qualified Drainer - Wastewater Systems*')).toBe('body');
    });
});

describe('toggleLinePrefix — applying', () => {
    it('makes the current line a section heading', () => {
        expect(apply('Hob|bies', 'heading').text).toBe('## Hobbies');
    });

    it('makes the current line a bullet', () => {
        expect(apply('Long distance run|ning', 'bullet').text).toBe('- Long distance running');
    });

    it('starts a bullet on an empty line and puts the caret after the mark', () => {
        const result = apply('## Hobbies\n|', 'bullet');
        expect(result.text).toBe('## Hobbies\n- ');
        expect(result.caret).toBe(result.text.length);
    });

    it('swaps one mark for the other rather than stacking them', () => {
        expect(apply('- Hob|bies', 'heading').text).toBe('## Hobbies');
        expect(apply('## Hob|bies', 'bullet').text).toBe('- Hobbies');
    });

    it('normalises whatever bullet character was already there', () => {
        expect(apply('• Volunteer surf life|saving', 'bullet').text).toBe('Volunteer surf lifesaving');
    });

    it('drops indentation, which the preview would read as a code block', () => {
        expect(apply('    Long distance run|ning', 'bullet').text).toBe('- Long distance running');
    });
});

describe('toggleLinePrefix — toggling off', () => {
    it('turns a heading back into body text when pressed again', () => {
        expect(apply('## Hob|bies', 'heading').text).toBe('Hobbies');
    });

    it('turns a bullet back into body text when pressed again', () => {
        const result = apply('## Hobbies\n- Long distance run|ning', 'bullet');
        expect(result.text).toBe('## Hobbies\n\nLong distance running');
    });

    it('only toggles off when every selected line already has the style', () => {
        const result = apply('|- One\nTwo|', 'bullet');
        expect(result.text).toBe('- One\n- Two');
    });
});

describe('toggleLinePrefix — multi-line selections', () => {
    it('bullets every line the selection touches', () => {
        expect(apply('Lo|ng distance running\nVolunteer surf li|fesaving', 'bullet').text)
            .toBe('- Long distance running\n- Volunteer surf lifesaving');
    });

    it('leaves the blank lines between paragraphs alone', () => {
        expect(apply('|One\n\nTwo|', 'bullet').text).toBe('- One\n\n- Two');
    });

    it('keeps the whole converted block selected', () => {
        expect(apply('|One\nTwo|', 'bullet').selected).toBe('- One\n- Two');
    });
});

describe('toggleLinePrefix — paragraph spacing', () => {
    it('pads a new paragraph off the bullet above it, which would otherwise swallow it', () => {
        expect(apply('- A point\n- Not a po|int', 'body').text).toBe('- A point\n\nNot a point');
    });

    it('pads both sides when converting a line out of the middle of a list', () => {
        expect(apply('- One\n- Tw|o\n- Three', 'body').text).toBe('- One\n\nTwo\n\n- Three');
    });

    it('does not add padding where there is already a blank line', () => {
        expect(apply('## Hobbies\n\n- A po|int', 'body').text).toBe('## Hobbies\n\nA point');
    });

    it('does not pad the top of the document', () => {
        expect(apply('- A po|int\n', 'body').text).toBe('A point\n');
    });

    it('keeps the caret on the same word after padding shifts the line down', () => {
        const result = apply('- A point\n- Not a po|int', 'body');
        expect(result.text.slice(result.caret)).toBe('int');
    });
});

describe('continueList', () => {
    function enter(marked: string) {
        const { text, start } = at(marked);
        return continueList(text, start, start);
    }

    it('starts the next bullet from the end of one', () => {
        expect(enter('- Long distance running|')?.text).toBe('- Long distance running\n- ');
    });

    it('leaves the caret ready to type', () => {
        const result = enter('- Long distance running|')!;
        expect(result.selectionStart).toBe(result.text.length);
    });

    it('carries the rest of the line down when the caret is mid-point', () => {
        expect(enter('- Long |distance running')?.text).toBe('- Long \n- distance running');
    });

    it('ends the list on an empty bullet', () => {
        const result = enter('- A point\n- |')!;
        expect(result.text).toBe('- A point\n');
        expect(result.selectionStart).toBe('- A point\n'.length);
    });

    it('does nothing on an ordinary line, so Enter behaves normally', () => {
        expect(enter('Mildura, VIC|')).toBeNull();
        expect(enter('## Hobbies|')).toBeNull();
    });

    it('does nothing when the caret sits before the bullet mark', () => {
        expect(enter('|- A point')).toBeNull();
    });

    it('does nothing when text is selected, so Enter replaces it as usual', () => {
        const { text } = at('- A point');
        expect(continueList(text, 2, 7)).toBeNull();
    });
});
