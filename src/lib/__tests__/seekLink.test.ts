import { describe, it, expect } from 'vitest';
import { classifyPaste, isSubmittable, pasteHint, normaliseUrl } from '../seekLink';

const AD = 'We are looking for a Business Analyst to join our team in Sydney. '.repeat(4);

describe('classifyPaste', () => {
    it('recognises a Seek job link', () => {
        expect(classifyPaste('https://au.seek.com/job/93833475'))
            .toEqual({ kind: 'seek-url', url: 'https://au.seek.com/job/93833475' });
    });

    it('recognises the seek.com.au spelling', () => {
        expect(classifyPaste('https://www.seek.com.au/job/93833475').kind).toBe('seek-url');
    });

    it('accepts a link pasted without the scheme', () => {
        expect(classifyPaste('au.seek.com/job/93833475'))
            .toEqual({ kind: 'seek-url', url: 'https://au.seek.com/job/93833475' });
    });

    it('keeps the tracking parameters, because the server strips them', () => {
        const url = 'https://au.seek.com/job/93833475?type=standout&ref=search-standalone';
        expect(classifyPaste(url)).toEqual({ kind: 'seek-url', url });
    });

    it('tolerates surrounding whitespace and a trailing newline', () => {
        expect(classifyPaste('  https://au.seek.com/job/93833475 \n').kind).toBe('seek-url');
    });

    it('calls a link from another job board out separately', () => {
        expect(classifyPaste('https://www.linkedin.com/jobs/view/4438464998').kind).toBe('other-url');
        expect(classifyPaste('https://www.indeed.com/viewjob?jk=abc123').kind).toBe('other-url');
    });

    it('treats a pasted description as a description', () => {
        expect(classifyPaste(AD).kind).toBe('description');
    });

    it('a description that happens to contain a Seek link is still a description', () => {
        const withLink = `${AD}\nApply here: https://au.seek.com/job/93833475`;
        expect(classifyPaste(withLink).kind).toBe('description');
    });

    it('a link with prose on the same line is a description, not a link', () => {
        expect(classifyPaste('have a look at https://au.seek.com/job/93833475').kind).toBe('description');
    });

    it('an empty box is neither', () => {
        expect(classifyPaste('').kind).toBe('description');
        expect(classifyPaste('   ').kind).toBe('description');
    });
});

describe('isSubmittable', () => {
    it('lets a Seek link through even though it is short', () => {
        // The old floor was 50 characters, which this is under. That floor is
        // exactly why links could not be pasted into this box before.
        const url = 'https://au.seek.com/job/93833475';
        expect(url.length).toBeLessThan(50);
        expect(isSubmittable(url)).toBe(true);
    });

    it('still demands a real description when text is pasted', () => {
        expect(isSubmittable('Business Analyst')).toBe(false);
        expect(isSubmittable(AD)).toBe(true);
    });

    it('refuses a link from a site we cannot read', () => {
        expect(isSubmittable('https://www.linkedin.com/jobs/view/4438464998')).toBe(false);
    });

    it('refuses an empty box', () => {
        expect(isSubmittable('')).toBe(false);
    });
});

describe('pasteHint', () => {
    it('says nothing about an empty box', () => {
        expect(pasteHint('')).toBeNull();
    });

    it('says nothing about a good Seek link', () => {
        expect(pasteHint('https://au.seek.com/job/93833475')).toBeNull();
    });

    it('says nothing about a full description', () => {
        expect(pasteHint(AD)).toBeNull();
    });

    it('explains that other job boards need the description instead', () => {
        expect(pasteHint('https://www.linkedin.com/jobs/view/4438464998'))
            .toMatch(/paste the job description/i);
    });

    it('nudges when the description is too short', () => {
        expect(pasteHint('Business Analyst wanted')).toMatch(/full job description/i);
    });

    it('never returns an empty or placeholder string', () => {
        const hints = [
            pasteHint('https://www.linkedin.com/jobs/view/1'),
            pasteHint('too short'),
        ];
        for (const h of hints) {
            expect(typeof h).toBe('string');
            expect((h as string).length).toBeGreaterThan(10);
            expect(h).not.toMatch(/undefined|null/);
        }
    });
});

describe('normaliseUrl', () => {
    it('adds https when it is missing', () => {
        expect(normaliseUrl('au.seek.com/job/1')).toBe('https://au.seek.com/job/1');
    });

    it('leaves an existing scheme alone', () => {
        expect(normaliseUrl('http://au.seek.com/job/1')).toBe('http://au.seek.com/job/1');
    });
});
