import { describe, it, expect, beforeEach } from 'vitest';
import { hasMailExchanger, pickMailableDomain, clearMxCache, type MxLookup } from './mailDomain';

/** A stubbed DNS: every domain listed here receives mail, nothing else does. */
const dns = (...withMail: string[]): MxLookup => async (domain: string) =>
    withMail.includes(domain) ? [`mx.${domain}`] : [];

beforeEach(clearMxCache);

describe('the three wrong picks the probe found', () => {
    // Each is a real resolver output over 30 employers from the corpus, and
    // each publishes no MX because nobody receives mail at it.

    it('an NT department drops the digital archive and finds nothing it trusts', async () => {
        // nt.gov.au receives mail and really is where the department sits, but
        // its host core is "nt", which the noise list strips as a state code, so
        // it bears no name match and the fallthrough will not take it. Returning
        // null is the right outcome anyway: the alternative is guessing that a
        // whole-of-government domain speaks for one department, which is how
        // Hudson became finance.gov.au in the first place.
        const choice = await pickMailableDomain(
            ['territorystories.nt.gov.au', 'nt.gov.au'],
            'Northern Territory Department of Trade',
            dns('nt.gov.au'),
        );
        expect(choice.domain).toBeNull();
        expect(choice.corrected).toBe(true);
        expect(choice.rejected).toBe('territorystories.nt.gov.au');
    });

    it('United Energy is not its community-consultation subdomain', async () => {
        const choice = await pickMailableDomain(
            ['engage.unitedenergy.com.au', 'unitedenergy.com.au'],
            'CitiPower, Powercor and United Energy',
            dns('unitedenergy.com.au'),
        );
        expect(choice.domain).toBe('unitedenergy.com.au');
        expect(choice.corrected).toBe(true);
    });

    it('Capricorn is not a tourism site', async () => {
        const choice = await pickMailableDomain(
            ['visitcapricorn.com.au', 'capricorn.coop'],
            'Capricorn',
            dns('capricorn.coop'),
        );
        expect(choice.domain).toBe('capricorn.coop');
    });
});

describe('what it refuses to do', () => {
    it('never falls through to a host that does not bear the company name', async () => {
        // seek.com.au is blacklisted upstream, so the realistic version of this
        // is an unrelated host that survived ranking on position alone.
        const choice = await pickMailableDomain(
            ['visitcapricorn.com.au', 'randomunrelated.com.au'],
            'Capricorn',
            dns('randomunrelated.com.au'),
        );
        expect(choice.domain).toBeNull();
        expect(choice.rejected).toBe('visitcapricorn.com.au');
    });

    it('leaves a correct top pick alone, and reports no correction', async () => {
        const choice = await pickMailableDomain(
            ['sportsbet.com.au', 'sportsbet.com'],
            'Sportsbet',
            dns('sportsbet.com.au', 'sportsbet.com'),
        );
        expect(choice.domain).toBe('sportsbet.com.au');
        expect(choice.corrected).toBe(false);
        expect(choice.rejected).toBeNull();
    });

    it('returns nothing when the picker had nothing', async () => {
        const choice = await pickMailableDomain([], 'Anyone', dns());
        expect(choice.domain).toBeNull();
        expect(choice.corrected).toBe(false);
    });
});

describe('when DNS itself fails', () => {
    const broken: MxLookup = async () => {
        throw new Error('ECONNREFUSED');
    };

    it('keeps the domain, because a failed lookup is not a verdict', async () => {
        expect(await hasMailExchanger('achgroup.org.au', broken)).toBe(true);
    });

    it('so the top pick still wins and nothing is reported as corrected', async () => {
        const choice = await pickMailableDomain(
            ['territorystories.nt.gov.au', 'nt.gov.au'],
            'Northern Territory Department of Trade',
            broken,
        );
        expect(choice.domain).toBe('territorystories.nt.gov.au');
        expect(choice.corrected).toBe(false);
    });
});

describe('the cache', () => {
    it('asks DNS once per domain', async () => {
        let calls = 0;
        const counting: MxLookup = async (d) => {
            calls++;
            return d === 'ac3.com.au' ? ['mx.ac3.com.au'] : [];
        };
        await hasMailExchanger('ac3.com.au', counting);
        await hasMailExchanger('ac3.com.au', counting);
        expect(calls).toBe(1);
    });

    it('remembers a domain with no mail too, rather than re-asking', async () => {
        let calls = 0;
        const counting: MxLookup = async () => {
            calls++;
            return [];
        };
        expect(await hasMailExchanger('visitcapricorn.com.au', counting)).toBe(false);
        expect(await hasMailExchanger('visitcapricorn.com.au', counting)).toBe(false);
        expect(calls).toBe(1);
    });
});
