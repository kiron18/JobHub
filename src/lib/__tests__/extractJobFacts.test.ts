/**
 * The values this produces reach an employer's inbox, so the test that matters
 * most is the one that says it gives up. A missing company reads as "I applied
 * for the Social Media Marketing Coordinator role"; a wrong one reads as "I
 * applied for the role at venues", which is what shipped.
 */
import { describe, it, expect } from 'vitest';
import { extractCompany, extractJobFacts, extractRole } from '../extractJobFacts';

/** Shaped like a Seek ad pasted straight into the box. */
const SEEK_PASTE = `Social Media Marketing Coordinator

Sydney NSW
Full time

About the role
You will manage content across our venues and events. Experience working at venues, festivals or events is highly regarded.

Reporting to the Marketing Manager.`;

describe('the bug that shipped', () => {
    it('does not read "working at venues" as the employer', () => {
        expect(extractCompany(SEEK_PASTE)).toBeUndefined();
    });

    it('finds the role it previously left blank', () => {
        expect(extractRole(SEEK_PASTE)).toBe('Social Media Marketing Coordinator');
    });
});

describe('extractRole', () => {
    it('takes the first real line, which is where the title sits', () => {
        expect(extractRole('Business Analyst\nMeridian Logistics\nMelbourne')).toBe('Business Analyst');
    });

    it('skips the page furniture above the title', () => {
        expect(extractRole('Save\nShare\nQuick apply\nBusiness Analyst\nMelbourne')).toBe('Business Analyst');
    });

    it('falls through to a title line further down when the ad opens on prose', () => {
        const jd = 'We are a fast growing logistics business based in Melbourne.\nBusiness Analyst, Supply Chain';
        expect(extractRole(jd)).toBe('Business Analyst, Supply Chain');
    });

    it('will not take a sentence as the title, even one naming the role', () => {
        // "I applied for the We are hiring a Business Analyst. role at ..." is
        // the email this prevents.
        const jd = 'We are a fast growing logistics business based in Melbourne.\nWe are hiring a Business Analyst.';
        expect(extractRole(jd)).toBeUndefined();
    });

    it('returns nothing rather than a paragraph', () => {
        expect(extractRole('We are looking for someone who can bring energy, curiosity and a genuine interest in our customers to this team.')).toBeUndefined();
    });

    it('does not fall over on an empty paste', () => {
        expect(extractRole('')).toBeUndefined();
    });
});

describe('extractCompany', () => {
    it('takes a labelled employer line', () => {
        expect(extractCompany('Business Analyst\nCompany: Meridian Logistics\nMelbourne')).toBe('Meridian Logistics');
        expect(extractCompany('Employer - Meridian Logistics')).toBe('Meridian Logistics');
    });

    it('takes a properly capitalised "at Company"', () => {
        expect(extractCompany('Join the team at Meridian Logistics and help us grow.')).toBe('Meridian Logistics');
    });

    it('refuses the ordinary nouns that follow "at" in prose', () => {
        expect(extractCompany('You will be working at scale across the business.')).toBeUndefined();
        expect(extractCompany('Experience working at venues is highly regarded.')).toBeUndefined();
        expect(extractCompany('You will be based at home two days a week.')).toBeUndefined();
    });

    it('refuses a job title that happens to follow "at"', () => {
        expect(extractCompany('You will be working at Senior Manager level.')).toBeUndefined();
    });

    it('refuses a whole sentence', () => {
        expect(extractCompany('We pride ourselves at Being The Very Best Place To Work In The Whole Of Sydney.')).toBeUndefined();
    });

    it('returns nothing when the ad never names the employer', () => {
        expect(extractCompany('Business Analyst\nMelbourne\nFull time\nApply now.')).toBeUndefined();
    });
});

describe('extractJobFacts', () => {
    it('returns both when the ad states both', () => {
        expect(extractJobFacts('Business Analyst\nCompany: Meridian Logistics\nMelbourne')).toEqual({
            role: 'Business Analyst',
            company: 'Meridian Logistics',
        });
    });
});
