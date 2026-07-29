/**
 * The cover letter PDF renders four blocks, and which block a line lands in
 * decides its type size, colour and whether inline emphasis is applied at all.
 * Getting that wrong is invisible in the editor and only shows up in the
 * downloaded file, so it is worth pinning down here.
 */
import { describe, it, expect } from 'vitest';
import { parseCoverLetter } from '../exportPdf';

/** Exactly what coverLetterToMarkdown emits: salutation first, no letterhead. */
const GENERATED = `Dear Hiring Manager,

I am applying for the Business Analyst role at Meridian Logistics.

At my current role I cut invoice processing time by **40%** across three teams.

I would welcome the chance to discuss this further.

Yours sincerely,

Priya Nair
`;

/** The older shape, with contact details and a date above the salutation. */
const WITH_LETTERHEAD = `Priya Nair
priya.nair@example.com
0412 345 678

July 2026

Dear Ms Chen,

I am applying for the Business Analyst role.

Yours faithfully,

Priya Nair
`;

describe('parseCoverLetter', () => {
    it('treats a letter that opens on the salutation as body, not letterhead', () => {
        // The regression that shipped asterisks to the page: with nothing above
        // the salutation, every line was classified as contact details and the
        // whole letter rendered in small grey type with its markdown showing.
        const parsed = parseCoverLetter(GENERATED);
        expect(parsed.contactBlock).toEqual([]);
        expect(parsed.salutation).toBe('Dear Hiring Manager,');
        expect(parsed.bodyParagraphs).toHaveLength(3);
        expect(parsed.bodyParagraphs[1]).toContain('**40%**');
    });

    it('splits the signoff away from the body', () => {
        const parsed = parseCoverLetter(GENERATED);
        expect(parsed.signoff).toEqual(['Yours sincerely,', 'Priya Nair']);
        expect(parsed.bodyParagraphs.join(' ')).not.toContain('Yours sincerely');
    });

    it('still reads a letter that has contact details and a date on top', () => {
        const parsed = parseCoverLetter(WITH_LETTERHEAD);
        expect(parsed.contactBlock).toEqual([
            'Priya Nair',
            'priya.nair@example.com',
            '0412 345 678',
        ]);
        expect(parsed.date).toBe('July 2026');
        expect(parsed.salutation).toBe('Dear Ms Chen,');
        expect(parsed.bodyParagraphs).toEqual(['I am applying for the Business Analyst role.']);
        expect(parsed.signoff).toEqual(['Yours faithfully,', 'Priya Nair']);
    });

    it('falls back to treating everything as body when the salutation is gone', () => {
        const parsed = parseCoverLetter('I am applying for the role.\n\nIt suits me well.');
        expect(parsed.salutation).toBe('');
        expect(parsed.contactBlock).toEqual([]);
        expect(parsed.bodyParagraphs).toHaveLength(2);
    });

    it('does not fall over on an empty document', () => {
        expect(parseCoverLetter('')).toEqual({
            contactBlock: [],
            date: '',
            salutation: '',
            bodyParagraphs: [],
            signoff: [],
        });
    });
});
