import { describe, it, expect } from 'vitest';
import { readJdContact, isSufficient, isGenericLocal } from './jdContact';

describe('the ads this was written against', () => {
    // Verbatim from a real Seek ad in the sample corpus. Seek masks the local
    // part and leaves the domain, and the employer is called "Konnexus" while
    // the domain is konnexuscg, so a name-based search would have missed it.
    it('takes the domain out of a Seek-redacted address', () => {
        const c = readJdContact(
            `If this position is of interest to you, please click 'Apply', or you can
             just send your details to ••••@konnexuscg.com.au. Konnexus specialises
             in the recruitment of permanent and contract professionals.`,
        );
        expect(c.domain).toBe('konnexuscg.com.au');
        expect(c.domainSource).toBe('JD_REDACTED');
        expect(c.email).toBeNull();
        expect(isSufficient(c)).toBe(false);   // a domain still needs a person
    });

    it('takes the domain from a link when the ad carries no address', () => {
        const c = readJdContact(
            `More information about our projects can be found on our website:
             https://www.defence.gov.au/projects#land
             For further information please review the job information pack on
             https://defencecareers.nga.net.au/?jati=ED656002`,
        );
        expect(c.domain).toBe('defence.gov.au');
        expect(c.domainSource).toBe('JD_URL');
    });

    it('ignores the ATS link and Seek itself', () => {
        // nga.net.au is the applicant tracking system Defence applies through.
        // A directory read off it would be a directory of the vendor's staff.
        const c = readJdContact(
            `Apply via https://defencecareers.nga.net.au/?jati=1 or see
             https://www.seek.com.au/job/123 for the listing.`,
        );
        expect(c.domain).toBeNull();
    });
});

describe('a full address ends the pipeline', () => {
    it('is sufficient on its own', () => {
        const c = readJdContact('For a confidential discussion email sarah.chen@acme.com.au today.');
        expect(c.email).toBe('sarah.chen@acme.com.au');
        expect(c.domain).toBe('acme.com.au');
        expect(c.domainSource).toBe('JD_EMAIL');
        expect(isSufficient(c)).toBe(true);
    });

    it('prefers a named person over the shared inbox in the same ad', () => {
        const c = readJdContact(
            'Send your CV to careers@acme.com.au or contact sarah.chen@acme.com.au directly.',
        );
        expect(c.email).toBe('sarah.chen@acme.com.au');
        expect(c.emailIsGeneric).toBe(false);
    });

    it('still takes a shared inbox when that is all there is', () => {
        // careers@ is a real, monitored destination. It beats a guess.
        const c = readJdContact('Applications to careers@acme.com.au by Friday.');
        expect(c.email).toBe('careers@acme.com.au');
        expect(c.emailIsGeneric).toBe(true);
        expect(isSufficient(c)).toBe(true);
    });
});

describe('the named contact keeps its title', () => {
    it('captures the function alongside the name', () => {
        // The old version took only the name. A contact with no function
        // cannot be judged against the role, which is how an Economic
        // Development Coordinator was proposed for a data job.
        const c = readJdContact('For enquiries, please contact Zoe Fitzgibbon, Unit Manager Tech Projects.');
        expect(c.personName).toBe('Zoe Fitzgibbon');
        expect(c.personTitle).toMatch(/Unit Manager/);
    });

    it('drops a "title" that is really the next sentence', () => {
        const c = readJdContact('Please contact Sarah Chen. Applications close Friday.');
        expect(c.personName).toBe('Sarah Chen');
        expect(c.personTitle).toBeNull();
    });
});

describe('isGenericLocal', () => {
    it('separates a role inbox from a person', () => {
        expect(isGenericLocal('careers@x.com')).toBe(true);
        expect(isGenericLocal('hiring@x.com')).toBe(true);
        expect(isGenericLocal('sarah.chen@x.com')).toBe(false);
    });
});

describe('an ad with nothing in it', () => {
    it('returns empty rather than guessing', () => {
        const c = readJdContact('We are a fast-growing team looking for a Data Analyst in Sydney.');
        expect(c).toEqual({
            email: null, emailIsGeneric: false, domain: null,
            domainSource: null, personName: null, personTitle: null,
        });
        expect(isSufficient(c)).toBe(false);
    });

    it('does not throw on missing or tiny input', () => {
        expect(readJdContact(null).domain).toBeNull();
        expect(readJdContact('').domain).toBeNull();
        expect(readJdContact('hi').domain).toBeNull();
    });
});
