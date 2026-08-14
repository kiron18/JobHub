/**
 * The follow-up is copied straight out of the dashboard and pasted into a real
 * email to a real employer, usually without being read first. So the bar is
 * that what comes out is sendable as it stands: no brackets left in it, and no
 * name in the greeting that the job ad did not actually give us.
 */
import { describe, it, expect } from 'vitest';
import { renderTemplate, getRawTemplate } from '../emailTemplates';

const JOB = {
    title: 'Business Analyst',
    company: 'Meridian Logistics',
    dateApplied: '2026-08-07T02:00:00.000Z',
};

const PROFILE = {
    name: 'Priya Nair',
    phone: '0412 345 678',
    email: 'priya.nair@example.com',
};

describe('application follow-up', () => {
    it('leaves nothing for the candidate to fill in', () => {
        const { full } = renderTemplate(
            'application-followup',
            { ...JOB, description: 'Business Analyst, Melbourne. Please contact Sarah Chen on 03 9000 0000.' },
            PROFILE,
        );
        expect(full).not.toContain('[');
    });

    it('greets the person the job ad named', () => {
        const { body } = renderTemplate(
            'application-followup',
            { ...JOB, description: 'For a confidential discussion please contact Sarah Chen.' },
            PROFILE,
        );
        expect(body).toContain('Hi Sarah,');
    });

    it('uses the formal address when the ad named nobody, never a bracket', () => {
        const { body } = renderTemplate(
            'application-followup',
            { ...JOB, description: 'We are hiring a Business Analyst in Melbourne.' },
            PROFILE,
        );
        expect(body).toContain('Dear Hiring Manager,');
        expect(body).not.toContain('[Hiring Manager Name]');
    });

    it('will not greet a department as though it were a person', () => {
        for (const ad of [
            'Please contact Human Resources.',
            'Please contact Talent Acquisition.',
            'Contact: Recruitment Team',
        ]) {
            const { body } = renderTemplate('application-followup', { ...JOB, description: ad }, PROFILE);
            expect(body).toContain('Dear Hiring Manager,');
        }
    });

    it('still addresses an older row saved before the ad was kept', () => {
        const { body } = renderTemplate('application-followup', JOB, PROFILE);
        expect(body).toContain('Dear Hiring Manager,');
        expect(body).not.toContain('[Hiring Manager Name]');
    });

    it('carries the role, employer, date and sign-off it always did', () => {
        const { subject, body } = renderTemplate('application-followup', JOB, PROFILE);
        expect(subject).toBe('Application for Business Analyst, submitted 7 Aug 2026');
        expect(body).toContain('Business Analyst at Meridian Logistics on 7 Aug 2026');
        expect(body).toContain('Priya Nair');
        expect(body).toContain('0412 345 678 | priya.nair@example.com');
    });

    it('leaves the sign-off blanks alone when the profile has no phone yet', () => {
        // These are a gap in the profile, not something we can infer, so the
        // bracket is the honest output and tells the candidate what to add.
        const { body } = renderTemplate(
            'application-followup',
            { ...JOB, description: 'Please contact Sarah Chen.' },
            { name: 'Priya Nair' },
        );
        expect(body).toContain('[Phone]');
    });

    it('keeps the library copy unfilled, since it is shown with no job attached', () => {
        expect(getRawTemplate('application-followup').body).toContain('[Hiring Manager Name]');
    });
});

describe('a row saved from an ad that named neither the role nor the employer', () => {
    // The tracker stores these sentinels because the columns are required. They
    // must never reach the employer inside a sentence.
    const UNKNOWN = { title: 'Untitled role', company: 'Unknown company', dateApplied: '2026-08-07T02:00:00.000Z' };

    it('does not send the tracker placeholders to the employer', () => {
        const { full } = renderTemplate('application-followup', UNKNOWN, PROFILE);
        expect(full).not.toContain('Untitled role');
        expect(full).not.toContain('Unknown company');
        expect(full).toContain('a role you advertised');
    });

    it('drops the employer clause when only the role is known', () => {
        const { body } = renderTemplate(
            'application-followup',
            { ...UNKNOWN, title: 'Social Media Marketing Coordinator' },
            PROFILE,
        );
        expect(body).toContain('an application for Social Media Marketing Coordinator on 7 Aug 2026');
        expect(body).not.toContain('Unknown company');
    });

    it('keeps the script exactly as written when both facts are known', () => {
        const { body } = renderTemplate('application-followup', JOB, PROFILE);
        expect(body).toContain('an application for Business Analyst at Meridian Logistics on 7 Aug 2026');
    });
});
