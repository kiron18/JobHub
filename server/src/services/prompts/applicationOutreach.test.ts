import { describe, it, expect } from 'vitest';
import {
    buildApplicationOutreachPrompt,
    normaliseOutreachDraft,
    LINKEDIN_NOTE_LIMIT,
    type OutreachProfile,
} from './applicationOutreach';

const profile: OutreachProfile = {
    name: 'Priya Nair',
    professionalSummary: 'Business analyst with six years across financial services.',
    skills: 'SQL, Power BI, stakeholder management',
    experience: [
        { role: 'Business Analyst', company: 'Meridian Logistics', description: 'Cut invoice processing time by 40%.' },
    ],
};

describe('buildApplicationOutreachPrompt', () => {
    it('includes the role, the company and the candidate evidence', () => {
        const prompt = buildApplicationOutreachPrompt('Business Analyst', 'Atlassian', 'We need SQL.', profile);
        expect(prompt).toContain('Business Analyst');
        expect(prompt).toContain('Atlassian');
        expect(prompt).toContain('Cut invoice processing time by 40%.');
        expect(prompt).toContain('We need SQL.');
    });

    it('states the LinkedIn limit so the model writes something sendable', () => {
        const prompt = buildApplicationOutreachPrompt('Analyst', 'Acme', '', profile);
        expect(prompt).toContain(String(LINKEDIN_NOTE_LIMIT));
    });

    it('bans the ask — a first message that requests a favour does not get answered', () => {
        const prompt = buildApplicationOutreachPrompt('Analyst', 'Acme', '', profile);
        expect(prompt).toContain('Never ask for a referral, a call, or a favour');
    });

    it('copes with an empty profile rather than throwing', () => {
        const prompt = buildApplicationOutreachPrompt('Analyst', 'Acme', undefined, {});
        expect(prompt).toContain('No experience recorded.');
        expect(prompt).toContain('(not supplied)');
    });

    it('truncates a very long job description instead of sending the whole thing', () => {
        const huge = 'x'.repeat(9000);
        const prompt = buildApplicationOutreachPrompt('Analyst', 'Acme', huge, profile);
        expect(prompt).not.toContain('x'.repeat(3001));
    });
});

describe('normaliseOutreachDraft', () => {
    const good = {
        hook: 'stakeholder engagement across three teams',
        linkedInNote: 'Hi — I have just applied for the Analyst role.',
        emailSubject: 'Application for Analyst — Priya Nair',
        emailBody: 'Hi [name],\n\nI applied yesterday.\n\nBest regards,\nPriya Nair',
    };

    it('passes a well-formed draft straight through', () => {
        expect(normaliseOutreachDraft(good, 'Analyst', 'Priya Nair')).toEqual(good);
    });

    it('clamps a note that LinkedIn would refuse to send', () => {
        const draft = normaliseOutreachDraft(
            { ...good, linkedInNote: 'a'.repeat(400) },
            'Analyst',
            'Priya Nair',
        );
        expect(draft?.linkedInNote).toHaveLength(LINKEDIN_NOTE_LIMIT);
    });

    it('falls back to a sensible subject when the model omits one', () => {
        const draft = normaliseOutreachDraft({ ...good, emailSubject: '   ' }, 'Analyst', 'Priya Nair');
        expect(draft?.emailSubject).toBe('Application for Analyst — Priya Nair');
    });

    it('leaves the name out of the fallback subject when there is no name', () => {
        const draft = normaliseOutreachDraft({ ...good, emailSubject: undefined }, 'Analyst', null);
        expect(draft?.emailSubject).toBe('Application for Analyst');
    });

    it('returns null when the essential messages are missing', () => {
        expect(normaliseOutreachDraft({ hook: 'x' }, 'Analyst', 'Priya')).toBeNull();
        expect(normaliseOutreachDraft({ ...good, emailBody: '  ' }, 'Analyst', 'Priya')).toBeNull();
    });

    it('never throws on junk from the model', () => {
        expect(normaliseOutreachDraft(null, 'Analyst', 'Priya')).toBeNull();
        expect(normaliseOutreachDraft('not an object', 'Analyst', 'Priya')).toBeNull();
        expect(normaliseOutreachDraft({ linkedInNote: 42, emailBody: [] }, 'Analyst', 'Priya')).toBeNull();
    });
});
