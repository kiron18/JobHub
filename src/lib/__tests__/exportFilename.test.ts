import { describe, it, expect } from 'vitest';
import { buildExportFilename, deriveFromContent } from '../exportFilename';

const base = { docType: 'resume' as const, extension: 'pdf' as const };

describe('buildExportFilename', () => {
    it('names a document after the candidate, the employer and the type', () => {
        expect(buildExportFilename({ ...base, candidateName: 'Michael O’Connor', company: 'Bunnings' }))
            .toBe('Michael_OConnor_Bunnings_Resume.pdf');
    });

    it('falls back to the role when there is no company', () => {
        expect(buildExportFilename({ ...base, candidateName: 'Michael OConnor', jobTitle: 'Qualified Drainer' }))
            .toBe('Michael_OConnor_Qualified_Drainer_Resume.pdf');
    });

    it('prefers the company over the role when both are known', () => {
        expect(buildExportFilename({ ...base, candidateName: 'Ana Silva', company: 'Telstra', jobTitle: 'Analyst' }))
            .toBe('Ana_Silva_Telstra_Resume.pdf');
    });

    it('drops the middle segment entirely when neither is known', () => {
        expect(buildExportFilename({ ...base, candidateName: 'Ana Silva' })).toBe('Ana_Silva_Resume.pdf');
    });

    it('gives the two formats the same name but for the extension', () => {
        const parts = { candidateName: 'Ana Silva', company: 'Telstra', docType: 'cover-letter' as const };
        expect(buildExportFilename({ ...parts, extension: 'pdf' })).toBe('Ana_Silva_Telstra_Cover_Letter.pdf');
        expect(buildExportFilename({ ...parts, extension: 'docx' })).toBe('Ana_Silva_Telstra_Cover_Letter.docx');
    });

    it('labels selection criteria the same way in both formats', () => {
        const parts = { candidateName: 'Ana Silva', docType: 'selection-criteria' as const };
        expect(buildExportFilename({ ...parts, extension: 'pdf' })).toBe('Ana_Silva_Selection_Criteria.pdf');
        expect(buildExportFilename({ ...parts, extension: 'docx' })).toBe('Ana_Silva_Selection_Criteria.docx');
    });
});

describe('buildExportFilename — junk it must not put in a filename', () => {
    it('ignores this app’s own placeholder company and role', () => {
        expect(buildExportFilename({ ...base, candidateName: 'Ana Silva', company: 'Unknown company' }))
            .toBe('Ana_Silva_Resume.pdf');
        expect(buildExportFilename({ ...base, candidateName: 'Ana Silva', jobTitle: 'Untitled role' }))
            .toBe('Ana_Silva_Resume.pdf');
    });

    it('ignores a sentence fragment scraped out of the job ad', () => {
        // Both of these are real company values sitting in the tracker today.
        expect(buildExportFilename({ ...base, candidateName: 'Ana Silva', company: 'the core of our oper' }))
            .toBe('Ana_Silva_Resume.pdf');
        expect(buildExportFilename({ ...base, candidateName: 'Ana Silva', company: 'Marshall White, a prominent name i' }))
            .toBe('Ana_Silva_Resume.pdf');
    });

    it('still accepts ordinary multi-word employers', () => {
        expect(buildExportFilename({ ...base, candidateName: 'Ana Silva', company: 'Lingard Private Hospital' }))
            .toBe('Ana_Silva_Lingard_Private_Hospital_Resume.pdf');
    });

    it('strips characters a filesystem would reject', () => {
        expect(buildExportFilename({ ...base, candidateName: 'Ana Silva', company: 'Smith/Jones & Co' }))
            .toBe('Ana_Silva_Smith_Jones_and_Co_Resume.pdf');
    });

    it('never produces a nameless file when the candidate is unknown', () => {
        expect(buildExportFilename({ ...base, company: 'Telstra' })).toBe('Application_Telstra_Resume.pdf');
    });
});

describe('deriveFromContent', () => {
    it('reads the name and role off a resume heading', () => {
        expect(deriveFromContent('# Michael O’Connor\n\n*Qualified Drainer*\n\nMildura, VIC'))
            .toEqual({ candidateName: 'Michael O’Connor', jobTitle: 'Qualified Drainer' });
    });

    it('reads the name off a cover letter sign-off, which has no heading', () => {
        const letter = 'Dear Hiring Manager,\n\nI am writing to apply.\n\nKind regards,\n\nMichael O’Connor';
        expect(deriveFromContent(letter).candidateName).toBe('Michael O’Connor');
    });

    it('handles a sign-off with no blank line after it', () => {
        expect(deriveFromContent('Thanks for your time.\n\nSincerely,\nAna Silva').candidateName).toBe('Ana Silva');
    });

    it('does not mistake a closing sentence for a signature', () => {
        const letter = 'Regards,\nI would welcome the chance to discuss this role with you in person.';
        expect(deriveFromContent(letter).candidateName).toBeUndefined();
    });

    it('returns nothing rather than a guess when the letter is unsigned', () => {
        expect(deriveFromContent('Dear Hiring Manager,\n\nI am writing to apply.').candidateName).toBeUndefined();
    });
});
