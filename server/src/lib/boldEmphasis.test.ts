import { describe, it, expect } from 'vitest';
import {
    applyBoldEmphasis,
    boldFirstMetric,
    boldMetricsInMarkdown,
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

describe('boldFirstMetric', () => {
    const bolded = (line: string) => boldFirstMetric(line).line;

    it('bolds a percentage', () => {
        expect(bolded('Cut invoice processing time by 40% across three teams'))
            .toBe('Cut invoice processing time by **40%** across three teams');
    });

    it('bolds money with a currency code', () => {
        expect(bolded('Retained USD 800K in enterprise client value'))
            .toBe('Retained **USD 800K** in enterprise client value');
    });

    it('bolds money with a symbol', () => {
        expect(bolded('Generated $250,000 in additional revenue'))
            .toBe('Generated **$250,000** in additional revenue');
    });

    it('bolds a duration', () => {
        expect(bolded('Delivered the migration in 18 months'))
            .toBe('Delivered the migration in **18 months**');
    });

    it('bolds a bare count', () => {
        expect(bolded('Documented 45 process flows ahead of a migration'))
            .toBe('Documented **45** process flows ahead of a migration');
    });

    it('bolds a count written with a plus', () => {
        expect(bolded('Delivered 20+ product demonstrations across three regions'))
            .toBe('Delivered **20+** product demonstrations across three regions');
    });

    it('takes only the first figure — bullets lead with the result', () => {
        expect(bolded('Grew revenue 12% while cutting churn 3pts'))
            .toBe('Grew revenue **12%** while cutting churn 3pts');
    });

    it('leaves a bullet with no figure completely alone', () => {
        const line = 'Led requirements gathering for a warehouse management replacement';
        expect(bolded(line)).toBe(line);
        expect(boldFirstMetric(line).bolded).toBe(false);
    });

    it('never bolds a bare year — that is a date, not an achievement', () => {
        const line = 'Joined the payments programme in 2019 as the sole analyst';
        expect(bolded(line)).toBe(line);
    });

    it('skips past a year to reach the real figure', () => {
        expect(bolded('Since 2019, reduced processing time by 40%'))
            .toBe('Since 2019, reduced processing time by **40%**');
    });

    it('leaves a bullet the model already emphasised untouched', () => {
        const line = 'Cut costs by **40%** and reduced headcount risk by 12%';
        expect(bolded(line)).toBe(line);
    });

    it('does not alter the words themselves, only add markers', () => {
        const line = 'Grew the portfolio by 10% year on year';
        expect(unwrapBold(bolded(line))).toBe(line);
    });
});

describe('applyBoldEmphasis', () => {
    it('bolds figures even when the model returned nothing emphasised', () => {
        // The whole point: generation runs on whatever FAST_MODEL points at, and
        // a cheap model ignores a formatting rule buried in a long prompt.
        const [out] = applyBoldEmphasis(['Cut costs by 40%\nDocumented 45 process flows']);
        expect(out).toBe('Cut costs by **40%**\nDocumented **45** process flows');
    });

    it('honours what the model did bold rather than re-doing it', () => {
        const [out] = applyBoldEmphasis(['Grew revenue by **12% year on year**']);
        expect(out).toBe('Grew revenue by **12% year on year**');
    });

    it('still holds the whole resume to the ceiling', () => {
        const many = Array.from({ length: 10 }, (_, i) => `Improved result ${i} by ${i + 1}%`).join('\n');
        const result = applyBoldEmphasis([many, many]);
        const total = result.reduce((sum, block) => sum + countBoldSpans(block), 0);
        expect(total).toBe(MAX_BOLD_SPANS);
    });

    it('spends the budget on the earliest roles', () => {
        const many = Array.from({ length: 12 }, (_, i) => `Improved result ${i} by ${i + 1}%`).join('\n');
        const [first, second] = applyBoldEmphasis([many, many]);
        expect(countBoldSpans(first)).toBe(MAX_BOLD_SPANS);
        expect(countBoldSpans(second)).toBe(0);
    });

    it('leaves blank lines and empty descriptions alone', () => {
        expect(applyBoldEmphasis(['', 'Cut costs by 40%\n\nDocumented 45 flows'])).toEqual([
            '',
            'Cut costs by **40%**\n\nDocumented **45** flows',
        ]);
    });

    it('never bolds more than once in a single bullet', () => {
        const [out] = applyBoldEmphasis(['Grew revenue 12% while cutting churn 3pts and saving $40k']);
        expect(countBoldSpans(out)).toBe(1);
    });
});

describe('boldMetricsInMarkdown', () => {
    // Mirrors what the live generation path actually returns: a whole markdown
    // document written by the model, not a list of bullet strings.
    const RESUME = `# Priya Nair

*Business Analyst*

## Professional Summary

Business analyst with 6 years across financial services and logistics.

## Work Experience

### Business Analyst | Meridian Logistics
*Feb 2023 - Present*

- Cut invoice processing time by 40% across three teams
- Documented 45 process flows ahead of a migration
- Led requirements gathering for a warehouse replacement

## Education

**Bachelor of Commerce**  ·  2020
University of Melbourne

## Skills & Competencies

**Technical Skills:** SQL • Power BI

## Certifications

- **Certified Business Analysis Professional** - IIBA  ·  2024
`;

    const out = boldMetricsInMarkdown(RESUME);

    it('bolds the figure in each experience bullet', () => {
        expect(out).toContain('- Cut invoice processing time by **40%** across three teams');
        expect(out).toContain('- Documented **45** process flows ahead of a migration');
    });

    it('leaves a bullet with no figure alone', () => {
        expect(out).toContain('- Led requirements gathering for a warehouse replacement');
    });

    it('never touches the summary paragraph', () => {
        // "6 years" sits in prose, not a bullet — emphasis there reads as shouting.
        expect(out).toContain('Business analyst with 6 years across financial services');
    });

    it('leaves headings, dates and label rows exactly as they were', () => {
        expect(out).toContain('### Business Analyst | Meridian Logistics');
        expect(out).toContain('*Feb 2023 - Present*');
        expect(out).toContain('**Bachelor of Commerce**  ·  2020');
        expect(out).toContain('**Technical Skills:** SQL • Power BI');
    });

    it('does not re-emphasise a certification line that already carries bold', () => {
        expect(out).toContain('- **Certified Business Analysis Professional** - IIBA  ·  2024');
    });

    it('changes nothing except adding markers', () => {
        expect(unwrapBold(out)).toBe(unwrapBold(RESUME));
    });

    it('holds the document to the ceiling', () => {
        const many = ['## Work Experience', '']
            .concat(Array.from({ length: 20 }, (_, i) => `- Improved result ${i} by ${i + 1}%`))
            .join('\n');
        expect(countBoldSpans(boldMetricsInMarkdown(many))).toBe(MAX_BOLD_SPANS);
    });

    it('counts emphasis the model already added towards the ceiling', () => {
        const already = ['- Grew revenue by **12%**']
            .concat(Array.from({ length: 20 }, (_, i) => `- Improved result ${i} by ${i + 1}%`))
            .join('\n');
        expect(countBoldSpans(boldMetricsInMarkdown(already))).toBe(MAX_BOLD_SPANS);
    });
});
