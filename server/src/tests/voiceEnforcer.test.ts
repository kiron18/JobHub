import { describe, it, expect } from 'vitest';
import { scrubAITells, enforceFirstPersonCoverLetter } from '../lib/voiceEnforcer';

const LIVE_COVER_LETTER_BODY = `I am confident in my ability to deliver high-quality integrated campaigns that drive measurable results. With five years of experience, I bring a proven track record of success in communications.

Notably, I have demonstrated strong media relations skills and a knack for storytelling that aligns well with my professional background in public relations. My experience positions me to contribute effectively to Original Spin's award-winning team.

I am excited about the opportunity to work with your organisation and believe I would be a great fit for this role.

In my previous role, I led the rollout of a community festival marketing campaign, leveraging social media and traditional channels to drive attendance. I am passionate about creating campaigns that resonate with diverse audiences.

I thrive in a fast-paced environment and am comfortable managing multiple stakeholders simultaneously.`;

const FULL_COVER_LETTER = `Dear Hiring Manager,

${LIVE_COVER_LETTER_BODY}

Yours sincerely,

Kiron Kurian John`;

const FULL_COVER_LETTER_FAITHFULLY = `Dear Hiring Manager,

${LIVE_COVER_LETTER_BODY}

Yours faithfully,

Kiron Kurian John`;

describe('scrubAITells', () => {
    it('removes AI-tell phrases from cover letter body', () => {
        const { scrubbed, removed } = scrubAITells(LIVE_COVER_LETTER_BODY);

        // Should catch at least 4 AI-tell phrases
        expect(removed.length).toBeGreaterThanOrEqual(4);

        // Check specific phrases are removed
        expect(scrubbed).not.toContain('I am confident in my ability to');
        expect(scrubbed).not.toContain('Notably, I have demonstrated');
        expect(scrubbed).not.toContain('positions me to contribute effectively');
        expect(scrubbed).not.toContain('aligns well with my professional background');
    });

    it('replaces AI-tell phrases with natural alternatives', () => {
        const { scrubbed } = scrubAITells(LIVE_COVER_LETTER_BODY);

        // "leveraging" → "using"
        expect(scrubbed).toContain('using');
        expect(scrubbed).not.toContain('leveraging');

        // "passionate about" → "focused on"
        expect(scrubbed).toContain('focused on');
        expect(scrubbed).not.toContain('passionate about');

        // "proven track record of" → "track record of"
        expect(scrubbed).not.toContain('proven track record of');
    });

    it('does not crash on empty text', () => {
        const { scrubbed, removed } = scrubAITells('');
        expect(scrubbed).toBe('');
        expect(removed).toEqual([]);
    });

    it('does not crash on text without AI tells', () => {
        const clean = 'I led a team of five engineers to deliver a 30% reduction in deployment time.';
        const { scrubbed, removed } = scrubAITells(clean);
        expect(scrubbed).toBe(clean);
        expect(removed).toEqual([]);
    });
});

describe('enforceFirstPersonCoverLetter', () => {
    it('detects salutation and sign-off boundaries', () => {
        const result = enforceFirstPersonCoverLetter(FULL_COVER_LETTER, {
            candidateName: 'Kiron Kurian John',
        });

        // Should not lose the salutation or sign-off
        expect(result).toContain('Dear Hiring Manager');
        expect(result).toContain('Yours sincerely');
        expect(result).toContain('Kiron Kurian John');
    });

    it('detects "sincerely" sign-off', () => {
        const result = enforceFirstPersonCoverLetter(FULL_COVER_LETTER, {
            candidateName: 'Kiron Kurian John',
        });

        expect(result).toContain('Dear Hiring Manager');
        expect(result).toContain('Yours sincerely');
    });

    it('detects "faithfully" sign-off variant', () => {
        const result = enforceFirstPersonCoverLetter(FULL_COVER_LETTER_FAITHFULLY, {
            candidateName: 'Kiron Kurian John',
        });

        expect(result).toContain('Dear Hiring Manager');
        expect(result).toContain('Yours faithfully');
    });

    it('returns original text if no salutation found', () => {
        const noSalutation = 'Just some text without a letter format.';
        const result = enforceFirstPersonCoverLetter(noSalutation, {
            candidateName: 'Kiron',
        });
        expect(result).toBe(noSalutation);
    });
});
