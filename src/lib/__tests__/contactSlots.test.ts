import { describe, it, expect } from 'vitest';
import {
    resolveContact, isGenericAddress, confidenceOf, withFallbackInbox,
} from '../contactSlots';

describe('isGenericAddress', () => {
    it('knows a shared inbox from a person', () => {
        expect(isGenericAddress('careers@acme.com.au')).toBe(true);
        expect(isGenericAddress('HR@acme.com.au')).toBe(true);
        expect(isGenericAddress('sarah.chen@acme.com.au')).toBe(false);
        expect(isGenericAddress('n.michalopoulos@westernsydney.edu.au')).toBe(false);
    });

    it('does not fire on a person whose name contains one of the words', () => {
        // "info" inside "infosys" or a surname would demote a real contact
        // below a shared inbox, which loses the warmer lead.
        expect(isGenericAddress('infante@acme.com.au')).toBe(false);
        expect(isGenericAddress('peoples@acme.com.au')).toBe(false);
    });
});

describe('confidenceOf', () => {
    it('never calls a Hunter record a guess', () => {
        // Hunter's directory reports addresses it has OBSERVED. Unverified
        // means unchecked, not invented, so it must not rank as constructed.
        expect(confidenceOf('sarah.chen@acme.com.au', null)).toBe('published');
        expect(confidenceOf('sarah.chen@acme.com.au', 'accept_all')).toBe('published');
    });

    it('promotes a verified mailbox', () => {
        expect(confidenceOf('sarah.chen@acme.com.au', 'valid')).toBe('verified');
    });

    it('calls a shared inbox generic even when it verifies', () => {
        expect(confidenceOf('careers@acme.com.au', 'valid')).toBe('generic');
    });

    it('ranks a job-ad-named contact above anything Hunter found on its own', () => {
        expect(confidenceOf('sarah.chen@acme.com.au', 'jd')).toBe('jd');
    });
});

describe('resolveContact', () => {
    it('reads the directory shape, carrying the picker’s reasoning across', () => {
        const contact = resolveContact({
            source: 'directory',
            slots: {
                talent: null,
                hiringManager: {
                    name: 'Sarah Chen',
                    email: 'sarah.chen@acme.com.au',
                    position: 'Head of Analytics',
                    verification: 'valid',
                    why: ['Runs the function this role sits in.', 'Two rungs above the advertised level.'],
                },
                teamInsider: null,
            },
        });
        expect(contact?.name).toBe('Sarah Chen');
        expect(contact?.title).toBe('Head of Analytics');
        expect(contact?.addresses[0].confidence).toBe('verified');
        expect(contact?.addresses[0].why).toHaveLength(2);
    });

    it('reads the search shape, where the title field is named differently', () => {
        const contact = resolveContact({
            source: 'search',
            slots: { talent: { name: 'Dave Waters', title: 'Director, Human Resources', why: ['Handles hiring.'] } },
        });
        expect(contact?.name).toBe('Dave Waters');
        expect(contact?.title).toBe('Director, Human Resources');
    });

    it('returns a name with no addresses rather than inventing one', () => {
        // The search path finds people but never addresses. An empty list is
        // the honest answer: we know who, not where.
        const contact = resolveContact({
            source: 'search',
            slots: { hiringManager: { name: 'Dave Waters', title: 'Director' } },
        });
        expect(contact?.addresses).toEqual([]);
    });

    it('prefers the hiring manager, then talent, then the insider', () => {
        const contact = resolveContact({
            slots: {
                talent: { name: 'Talent Person', email: 't@a.com' },
                hiringManager: { name: 'Manager Person', email: 'm@a.com' },
                teamInsider: { name: 'Insider Person', email: 'i@a.com' },
            },
        });
        expect(contact?.name).toBe('Manager Person');
    });

    it('does not mix addresses from different people into one list', () => {
        // A letter addressed to the manager must never be offered the
        // insider's mailbox as an alternative.
        const contact = resolveContact({
            slots: {
                hiringManager: { name: 'Manager Person', email: 'm@a.com' },
                teamInsider: { name: 'Insider Person', email: 'i@a.com' },
            },
        });
        expect(contact?.addresses.map(a => a.address)).toEqual(['m@a.com']);
    });

    it('is null when nothing was found', () => {
        expect(resolveContact(null)).toBeNull();
        expect(resolveContact({})).toBeNull();
        expect(resolveContact({ slots: { talent: null, hiringManager: null, teamInsider: null } })).toBeNull();
        expect(resolveContact({ slots: { hiringManager: { email: 'x@y.com' } } })).toBeNull();  // no name
    });
});

describe('withFallbackInbox', () => {
    const base = { name: 'Sarah Chen', title: 'Head of Analytics', addresses: [] };

    it('adds the shared inbox alongside the person', () => {
        const out = withFallbackInbox(base, 'careers@acme.com.au');
        expect(out.addresses).toHaveLength(1);
        expect(out.addresses[0].confidence).toBe('generic');
    });

    it('does nothing when the ad carried no inbox', () => {
        expect(withFallbackInbox(base, null).addresses).toEqual([]);
        expect(withFallbackInbox(base, '  ').addresses).toEqual([]);
    });

    it('does not duplicate an address we already have', () => {
        const withPerson = { ...base, addresses: [{ address: 'careers@acme.com.au', confidence: 'generic' as const, label: '', why: [] }] };
        expect(withFallbackInbox(withPerson, 'CAREERS@acme.com.au').addresses).toHaveLength(1);
    });
});
