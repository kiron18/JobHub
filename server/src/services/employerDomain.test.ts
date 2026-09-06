import { describe, it, expect } from 'vitest';
import { resolveEmployerDomain, stateOf, type DomainSearchers } from './employerDomain';
import type { GoogleSearch, MapsResult } from './serpapi';

/**
 * Every fixture below is a real response shape from the 2026-09-06 corpus run,
 * reduced to the fields the ladder reads. The wrong answers are the point: each
 * one is a source returning something confident about a different company.
 */
const google = (kg: string | null, links: string[]): GoogleSearch => ({
    knowledgeGraphWebsite: kg,
    organic: links.map(l => ({ title: '', snippet: '', link: l })),
});

const searchers = (
    g: GoogleSearch,
    m: MapsResult[] = [],
    withMx: string[] = [],
): DomainSearchers => ({
    google: async () => g,
    maps: async () => m,
    // Every domain named in `withMx` receives mail; everything else does not.
    mx: async (d: string) => (withMx.includes(d) ? ['10 mx.example.com'] : []),
});

describe('the knowledge panel rung', () => {
    it('takes Google\'s own answer when it bears the name', async () => {
        const out = await resolveEmployerDomain(
            'Sekisui Pilon Pty Ltd', 'NSW',
            searchers(google('https://www.sekisuifoam.com.au/', []), [], ['sekisuifoam.com.au']),
        );
        expect(out.domain).toBe('sekisuifoam.com.au');
        expect(out.source).toBe('KNOWLEDGE_GRAPH');
        expect(out.searches).toBe(1);
    });

    it('ignores a knowledge panel that names a different company', async () => {
        const out = await resolveEmployerDomain(
            'Beyond Pier', null,
            searchers(google('https://www.westfield.com.au/', []), [], ['westfield.com.au']),
        );
        expect(out.domain).toBeNull();
    });
});

describe('the organic rung', () => {
    it('prefers the host that bears the name over the one that ranks', async () => {
        // Verbatim failure: the youth service's own site sat below a government
        // page ABOUT them, and ranking by position picked the government page.
        const out = await resolveEmployerDomain(
            'Brisbane Youth Service', 'QLD',
            searchers(
                google(null, ['https://nationalredress.gov.au/x', 'https://brisyouth.org/']),
                [], ['brisyouth.org', 'nationalredress.gov.au'],
            ),
        );
        expect(out.domain).toBe('brisyouth.org');
        expect(out.source).toBe('ORGANIC');
    });

    it('returns nothing rather than the top result when nothing bears the name', async () => {
        // GIOXLE: the best-ranked host was entertainment.com.au, a ticketing site.
        const out = await resolveEmployerDomain(
            'GIOXLE', 'NSW',
            searchers(google(null, ['https://www.entertainment.com.au/']), [], ['entertainment.com.au']),
        );
        expect(out.domain).toBeNull();
        expect(out.note).toMatch(/entertainment\.com\.au/);
    });

    it('never spends the Maps search when the organic rung answered', async () => {
        const out = await resolveEmployerDomain(
            'Screen Australia', null,
            searchers(google(null, ['https://www.screenaustralia.gov.au/']), [], ['screenaustralia.gov.au']),
        );
        expect(out.searches).toBe(1);
    });
});

describe('the Maps rung', () => {
    it('is only reached when the cheaper rungs found nothing', async () => {
        const out = await resolveEmployerDomain(
            'Pro Speed Racing', 'NSW',
            searchers(
                google(null, ['https://www.seek.com.au/job/1']),
                [{ title: 'Pro Speed Racing', website: 'https://prospeedracing.com.au/', address: 'Somersby NSW 2250' }],
                ['prospeedracing.com.au'],
            ),
        );
        expect(out.domain).toBe('prospeedracing.com.au');
        expect(out.source).toBe('MAPS');
        expect(out.searches).toBe(2);
    });

    it('refuses the similarly named business Maps substitutes', async () => {
        // Asked for NSN Electrical, Maps returned N.V.M. Electrical Services.
        const out = await resolveEmployerDomain(
            'NSN Electrical', 'NSW',
            searchers(
                google(null, []),
                [{ title: 'N.V.M. Electrical Services', website: 'https://nvmelectrical.com/', address: 'Sydney NSW' }],
                ['nvmelectrical.com'],
            ),
        );
        expect(out.domain).toBeNull();
    });

    it('refuses a name match in the wrong state', async () => {
        const out = await resolveEmployerDomain(
            'Strong Pilates', 'NSW',
            searchers(
                google(null, []),
                [{ title: 'Strong Pilates', website: 'https://strongpilates.com.au/', address: 'Scarborough WA 6019' }],
                ['strongpilates.com.au'],
            ),
        );
        expect(out.domain).toBeNull();
    });

    it('accepts a name match when the ad names no state', async () => {
        const out = await resolveEmployerDomain(
            'Strong Pilates', null,
            searchers(
                google(null, []),
                [{ title: 'Strong Pilates', website: 'https://strongpilates.com.au/', address: 'Scarborough WA 6019' }],
                ['strongpilates.com.au'],
            ),
        );
        expect(out.domain).toBe('strongpilates.com.au');
    });
});

describe('the MX gate', () => {
    it('rejects a name-matching site that receives no mail', async () => {
        // territorystories.nt.gov.au is a digital archive that bears the
        // department's name and has no MX record at all.
        const out = await resolveEmployerDomain(
            'Northern Territory Department of Territory Stories', 'NT',
            searchers(google(null, ['https://territorystories.nt.gov.au/']), [], []),
        );
        expect(out.domain).toBeNull();
        expect(out.note).toMatch(/receives no mail/);
    });

    it('falls to a runner-up that still bears the name and does receive mail', async () => {
        // Capricorn: a tourism site and the co-operative itself score the same
        // on the name and the same on the TLD, so position decides and the
        // tourism site wins it. Only the MX record separates them.
        const out = await resolveEmployerDomain(
            'Capricorn', 'WA',
            searchers(
                google(null, ['https://www.visitcapricorn.com.au/', 'https://www.capricornsociety.com.au/']),
                [], ['capricornsociety.com.au'],
            ),
        );
        expect(out.domain).toBe('capricornsociety.com.au');
        expect(out.corrected).toBe(true);
    });

    it('does not report a correction when the top pick already receives mail', async () => {
        // The picker already ranks the apex above a consultation subdomain, so
        // this never reaches the MX fallback at all.
        const out = await resolveEmployerDomain(
            'United Energy', 'VIC',
            searchers(
                google(null, ['https://engage.unitedenergy.com.au/', 'https://www.unitedenergy.com.au/']),
                [], ['unitedenergy.com.au', 'engage.unitedenergy.com.au'],
            ),
        );
        expect(out.domain).toBe('unitedenergy.com.au');
        expect(out.corrected).toBe(false);
    });
});

describe('blacklisted hosts', () => {
    it('never returns a job board, however well it matches', async () => {
        const out = await resolveEmployerDomain(
            'Seek', null,
            searchers(google('https://www.seek.com.au/', ['https://www.seek.com.au/']), [], ['seek.com.au']),
        );
        expect(out.domain).toBeNull();
    });
});

describe('stateOf', () => {
    it('reads the state out of an ad header', () => {
        expect(stateOf('Office Administrator\nPenrith, Sydney NSW\nFull time')).toBe('NSW');
    });

    it('is null when the ad names none', () => {
        expect(stateOf('Remote, work from anywhere')).toBeNull();
    });

    it('is null for empty input rather than throwing', () => {
        expect(stateOf(null)).toBeNull();
    });
});

describe('guards', () => {
    it('spends no search on an empty company name', async () => {
        const out = await resolveEmployerDomain('  ', null, searchers(google(null, [])));
        expect(out.searches).toBe(0);
        expect(out.domain).toBeNull();
    });
});
