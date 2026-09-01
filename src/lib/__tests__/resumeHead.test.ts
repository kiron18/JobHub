import { describe, it, expect } from 'vitest';
import { splitAtFirstSection } from '../resumeHead';

/**
 * This split decides what a candidate is allowed to read on the paywall.
 * Everything in `head` prints sharp, so a bad split either blurs their own name
 * or hands over the writing we are selling.
 */
describe('splitAtFirstSection', () => {
    it('keeps the name and contact line, and starts the body at the summary', () => {
        const cv = `# Pawan Hewage
Medical Device Technician | pawanhew7@gmail.com | 0480 510 886 | Arncliffe, NSW

## Professional summary
Chemistry graduate with over 4 years of laboratory experience.`;

        const { head, body } = splitAtFirstSection(cv);
        expect(head).toContain('Pawan Hewage');
        expect(head).toContain('0480 510 886');
        expect(head).not.toContain('Professional summary');
        expect(body.startsWith('## Professional summary')).toBe(true);
        expect(body).toContain('Chemistry graduate');
    });

    it('never splits on the name itself, even when it is the only heading level', () => {
        const cv = `## Pawan Hewage
Arncliffe, NSW

## Professional summary
Four years in the lab.`;

        const { head, body } = splitAtFirstSection(cv);
        expect(head).toContain('Pawan Hewage');
        expect(body.startsWith('## Professional summary')).toBe(true);
    });

    it('falls back to the contact block when the resume has no headings', () => {
        const cv = `Pawan Hewage
pawanhew7@gmail.com | Arncliffe, NSW

PROFESSIONAL SUMMARY
Chemistry graduate with four years in analytical testing.`;

        const { head, body } = splitAtFirstSection(cv);
        expect(head).toContain('pawanhew7@gmail.com');
        expect(head).not.toContain('PROFESSIONAL SUMMARY');
        expect(body).toContain('PROFESSIONAL SUMMARY');
    });

    it('leaves a one-line resume entirely sharp rather than blurring the name', () => {
        expect(splitAtFirstSection('Pawan Hewage')).toEqual({ head: 'Pawan Hewage', body: '' });
    });

    it('handles an empty resume without throwing', () => {
        expect(splitAtFirstSection('')).toEqual({ head: '', body: '' });
    });

    it('puts every character in exactly one half', () => {
        const cv = `# Sam Ortega
Melbourne VIC

## Professional summary
Analyst.

## Experience
### Analyst, Telstra
- Cut reporting time by half.`;

        const { head, body } = splitAtFirstSection(cv);
        expect(head + '\n' + body).toBe(cv);
    });
});
