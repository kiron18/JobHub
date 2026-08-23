import { describe, it, expect } from 'vitest';
import {
    pickCompanyDomain, nameMatchStrength, initialsOf, hostCore,
    looksGovernment, tldBonus, isBlacklisted, nameTokens,
    type DomainCandidate,
} from './companyDomain';

/** Search results, in the order they came back. */
const results = (...hosts: string[]): DomainCandidate[] =>
    hosts.map((host, position) => ({ host, position }));

describe('the failures this exists to fix', () => {
    // Every case below is a real pick from the contact-discovery bake-off,
    // with the hosts in the order the search actually returned them.

    it('Brisbane Youth Service is not the national redress scheme', () => {
        const pick = pickCompanyDomain(
            results('nationalredress.gov.au', 'brisyouth.org', 'acnc.gov.au', 'employmenthero.com'),
            'Brisbane Youth Service',
        );
        expect(pick.domain).toBe('brisyouth.org');
    });

    it('Scania is not the government vehicle recall page', () => {
        const pick = pickCompanyDomain(
            results('vehiclerecalls.gov.au', 'scania.com', 'afacconference.com.au'),
            'Scania',
        );
        expect(pick.domain).toBe('scania.com');
    });

    it('Hudson the recruiter is not the Department of Finance', () => {
        const pick = pickCompanyDomain(
            results('finance.gov.au', 'au.hudson.com', 'hcamag.com', 'hudson.org'),
            'Hudson',
        );
        expect(pick.domain).toBe('au.hudson.com');
    });

    it('the College of Surgeons is not a health directory', () => {
        const pick = pickCompanyDomain(
            results('healthdirect.gov.au', 'surgeons.org', 'generalsurgeons.com.au'),
            'The Royal Australasian College of Surgeons',
        );
        expect(pick.domain).toBe('surgeons.org');
    });

    it('Bioscience is not a NSW tender portal', () => {
        const pick = pickCompanyDomain(
            results('buy.nsw.gov.au', 'science.org.au', 'lifebioscience.com.au'),
            'Bioscience',
        );
        expect(pick.domain).toBe('lifebioscience.com.au');
    });

    it('Wesfarmers Health is the subsidiary, not the parent', () => {
        const pick = pickCompanyDomain(
            results('wesfarmers.com.au', 'wesfarmershealth.com.au', 'sisuhealthgroup.com'),
            'Wesfarmers Health',
        );
        expect(pick.domain).toBe('wesfarmershealth.com.au');
    });
});

describe('the acronym guard', () => {
    // Without this, the name-match rule "fixes" a correct government domain
    // into a different agency, because a department shares a word with its own
    // portfolio but shares nothing with its initials.

    it('a department keeps its acronym domain over a word match', () => {
        const pick = pickCompanyDomain(
            results('dcceew.gov.au', 'nsw.gov.au', 'energy.gov.au'),
            'Department of Climate Change, Energy, the Environment and Water',
        );
        expect(pick.domain).toBe('dcceew.gov.au');
        expect(pick.reason).toBe('acronym');
    });

    it('builds initials from the words that carry meaning', () => {
        expect(initialsOf('Department of Climate Change, Energy, the Environment and Water')).toBe('dcceew');
        expect(initialsOf('Royal Australasian College of Surgeons')).toBe('racs');
    });

    it('an acronym outranks a single word match', () => {
        const company = 'Department of Climate Change, Energy, the Environment and Water';
        expect(nameMatchStrength('dcceew.gov.au', company)).toBe(5);
        expect(nameMatchStrength('energy.gov.au', company)).toBe(3);
    });

    it('two random letters are not an acronym', () => {
        // Guard against a two-word company matching any short domain.
        expect(nameMatchStrength('ab.com', 'Acme Bakery')).toBe(0);
    });

    it('an initialism company still matches its own domain', () => {
        // A one-word company scores 4: its single word IS the whole name, so
        // "is the name" and "is one of its words" are the same tier here.
        expect(nameMatchStrength('jbs.com.au', 'JBS Australia Pty Limited')).toBe(4);
        expect(nameMatchStrength('aig.com.au', 'AIG')).toBe(4);
    });

    it('but a three-letter name does not match a host that merely contains it', () => {
        expect(nameMatchStrength('continental.com', 'NTI')).toBe(0);
    });
});

describe('the .gov.au bonus only applies to actual government', () => {
    it('gives government domains weight for a government employer', () => {
        expect(tldBonus('mackay.qld.gov.au', 'Mackay Regional Council')).toBe(5);
        expect(looksGovernment('Mackay Regional Council')).toBe(true);
        expect(looksGovernment('Building Commission NSW')).toBe(true);
        expect(looksGovernment('City of Stirling')).toBe(true);
    });

    it('gives them nothing for a company that merely got mentioned', () => {
        expect(tldBonus('vehiclerecalls.gov.au', 'Scania')).toBe(0);
        expect(tldBonus('finance.gov.au', 'Hudson')).toBe(0);
        expect(looksGovernment('Scania')).toBe(false);
    });

    it('a council still resolves to its own council domain', () => {
        const pick = pickCompanyDomain(
            results('vic.gov.au', 'banyule.vic.gov.au', 'business.gov.au'),
            'Banyule City Council',
        );
        expect(pick.domain).toBe('banyule.vic.gov.au');
    });

    it('a university keeps its edu.au domain', () => {
        const pick = pickCompanyDomain(
            results('westernsydney.edu.au', 'uac.edu.au'),
            'Western Sydney University',
        );
        expect(pick.domain).toBe('westernsydney.edu.au');
    });
});

describe('cases that already worked keep working', () => {
    it('a plain company with a matching domain is unchanged', () => {
        expect(pickCompanyDomain(results('harrisfarm.com.au', 'amazon.com.au'), 'Harris Farm').domain)
            .toBe('harrisfarm.com.au');
        expect(pickCompanyDomain(results('rest.com.au', 'apps.apple.com'), 'Rest').domain)
            .toBe('rest.com.au');
        expect(pickCompanyDomain(results('symbio.com.au', 'careers.symbio.global'), 'Symbio Australia').domain)
            .toBe('symbio.com.au');
    });

    it('falls back to search order when nothing matches the name', () => {
        const pick = pickCompanyDomain(results('someagency.com.au', 'other.com'), 'CONVERGED TECHNOLOGY PTY LTD');
        expect(pick.domain).toBe('someagency.com.au');
        expect(pick.reason).toBe('position');
    });

    it('prefers an Australian TLD when neither matches the name', () => {
        const pick = pickCompanyDomain(results('example.com', 'example2.com.au'), 'Nothing Alike');
        expect(pick.domain).toBe('example2.com.au');
    });
});

describe('blacklist', () => {
    it('drops the aggregators that were being picked as employers', () => {
        for (const h of ['bebee.com', 'buy.nsw.gov.au', 'glassdoor.com.au', 'seek.com.au', 'leadiq.com']) {
            expect(isBlacklisted(h)).toBe(true);
        }
    });

    it('drops subdomains of a blacklisted host', () => {
        expect(isBlacklisted('au.linkedin.com')).toBe(true);
    });

    it('returns nothing rather than an aggregator when that is all there is', () => {
        const pick = pickCompanyDomain(results('bebee.com', 'talent.com'), 'Converged Technology');
        expect(pick.domain).toBeNull();
        expect(pick.reason).toBe('none');
    });
});

describe('helpers', () => {
    it('strips the TLD to find the identifying part of a host', () => {
        expect(hostCore('au.hudson.com')).toBe('hudson');   // the 'au' label is a TLD label
        expect(hostCore('www.brisyouth.org')).toBe('brisyouth');
        expect(hostCore('mackay.qld.gov.au')).toBe('mackayqld');
    });

    it('ignores legal suffixes and geography when matching a name', () => {
        expect(nameTokens('Iscar Australia Pty Ltd')).toEqual(['iscar']);
        expect(nameTokens('JBS Australia Pty Limited')).toEqual(['jbs']);
    });

    it('reports why a domain won', () => {
        expect(pickCompanyDomain(results('scania.com'), 'Scania').reason).toBe('name-match');
        expect(pickCompanyDomain(results('dcceew.gov.au'), 'Department of Climate Change, Energy, the Environment and Water').reason).toBe('acronym');
    });
});
