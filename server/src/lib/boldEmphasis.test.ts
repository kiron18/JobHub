import { describe, it, expect } from 'vitest';
import {
    capBoldEmphasis,
    capBoldInLine,
    countBoldSpans,
    unwrapBold,
    MAX_BOLD_SPANS,
} from './boldEmphasis';

describe('unwrapBold', () => {
    it('removes the markers and keeps the words', () => {
        expect(unwrapBold('Cut costs by **40%** in six months'))
            .toBe('Cut costs by 40% in six months');
    });

    it('leaves text without emphasis untouched', () => {
        expect(unwrapBold('Cut costs by 40%')).toBe('Cut costs by 40%');
    });

    it('ignores a bare run of asterisks rather than eating a character', () => {
        expect(unwrapBold('****')).toBe('****');
    });
});

describe('capBoldInLine', () => {
    it('keeps the first emphasis and unwraps the rest', () => {
        const { line } = capBoldInLine('Grew revenue **12%** and cut churn **3pts**', 5);
        expect(line).toBe('Grew revenue **12%** and cut churn 3pts');
    });

    it('reports one span used when it keeps something', () => {
        expect(capBoldInLine('Grew revenue **12%**', 5).used).toBe(1);
    });

    it('strips all emphasis once the budget is gone', () => {
        const { line, used } = capBoldInLine('Grew revenue **12%**', 0);
        expect(line).toBe('Grew revenue 12%');
        expect(used).toBe(0);
    });

    it('reports nothing used on a line with no emphasis', () => {
        expect(capBoldInLine('Grew revenue 12%', 5).used).toBe(0);
    });
});

describe('capBoldEmphasis', () => {
    const bulletsWith = (n: number) =>
        Array.from({ length: n }, (_, i) => `- Result number ${i} improved by **${i}%**`).join('\n');

    it('allows at most one bolded span per bullet', () => {
        const [out] = capBoldEmphasis(['- Grew revenue **12%** while cutting churn **3pts**']);
        expect(countBoldSpans(out)).toBe(1);
        expect(out).toContain('cutting churn 3pts');
    });

    it('holds the whole resume to the ceiling', () => {
        const result = capBoldEmphasis([bulletsWith(10), bulletsWith(10)]);
        const total = result.reduce((sum, block) => sum + countBoldSpans(block), 0);
        expect(total).toBe(MAX_BOLD_SPANS);
    });

    it('spends the budget on the earliest roles, which are the most relevant', () => {
        const [first, second] = capBoldEmphasis([bulletsWith(12), bulletsWith(12)]);
        expect(countBoldSpans(first)).toBe(MAX_BOLD_SPANS);
        expect(countBoldSpans(second)).toBe(0);
    });

    it('leaves a resume already within budget completely alone', () => {
        const input = ['- Cut processing time by **40%**\n- Documented 45 process flows'];
        expect(capBoldEmphasis(input)).toEqual(input);
    });

    it('never drops the words themselves, only the markers', () => {
        const [out] = capBoldEmphasis(['- Grew revenue **12%** while cutting churn **3pts**']);
        expect(unwrapBold(out)).toBe('- Grew revenue 12% while cutting churn 3pts');
    });

    it('passes through empty and unemphasised blocks unchanged', () => {
        expect(capBoldEmphasis(['', '- Plain bullet'])).toEqual(['', '- Plain bullet']);
    });
});
