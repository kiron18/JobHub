import { describe, it, expect } from 'vitest';
import { pickFromDirectory, SMALL_ORG_MAX } from './directoryPick';
import type { Directory, DirectoryPerson } from './hunterDirectory';

/**
 * The two directories below are verbatim from Hunter's domain-search, pulled
 * while deciding whether this path should replace the LinkedIn one. AUS-MEAT is
 * the case that started it: our LinkedIn pipeline picked the CEO for a JUNIOR
 * analyst vacancy while Hunter's own directory was holding a Head of People.
 */

const person = (p: Partial<DirectoryPerson>): DirectoryPerson => ({
    email: 'x@example.com', firstName: null, lastName: null, position: null,
    department: null, seniority: null, verification: null, confidence: null,
    type: 'personal', linkedin: null, ...p,
});

const AUSMEAT: Directory = {
    domain: 'ausmeat.com.au',
    acceptAll: false,
    pattern: '{first}.{last}',
    total: 24,
    people: [
        person({ email: 'stephen.crisp@ausmeat.com.au', firstName: 'Stephen', lastName: 'Crisp', position: 'CEO', department: 'executive', seniority: 'executive', verification: 'valid' }),
        person({ email: 'bruce.gormley@ausmeat.com.au', firstName: 'Bruce', lastName: 'Gormley', position: 'General Manager', department: 'management', seniority: 'senior' }),
        person({ email: 'heidi.casey@ausmeat.com.au', firstName: 'Heidi', lastName: 'Casey', position: 'Head of People', department: 'hr', seniority: 'executive' }),
        person({ email: 'rebecca.dillon@ausmeat.com.au', firstName: 'Rebecca', lastName: 'Dillon', position: 'Head of Finance', department: 'finance', seniority: 'executive', verification: 'valid' }),
        person({ email: 'amy.mack@ausmeat.com.au', firstName: 'Amy', lastName: 'Mack', position: 'Commodity Coordinator', department: 'operations', verification: 'valid' }),
        person({ email: 'samuel.blight@ausmeat.com.au', firstName: 'Samuel', lastName: 'Blight', position: 'Software Developer', department: 'it' }),
        person({ email: 'emma.see@ausmeat.com.au', firstName: 'Emma', lastName: 'See', position: 'Compliance Coordinator', department: 'legal' }),
        person({ email: 'robyn.neary@ausmeat.com.au', firstName: 'Robyn', lastName: 'Kemp', position: 'Human Resources Coordinator', department: 'hr' }),
    ],
};

const AC3: Directory = {
    domain: 'ac3.com.au',
    acceptAll: true,
    pattern: '{first}.{last}',
    total: 40,
    people: [
        person({ email: 'michal.gavernik@ac3.com.au', firstName: 'Michal', lastName: 'Gavernik', position: 'IT Manager', department: 'it', seniority: 'senior', verification: 'accept_all' }),
        person({ email: 'parul.shah-batra@ac3.com.au', firstName: 'Parul', lastName: 'Batra', position: 'Head of People and Culture', department: 'hr', seniority: 'executive', verification: 'valid' }),
        person({ email: 'stephanie.challinor@ac3.com.au', firstName: 'Stephanie', lastName: 'Challinor', position: 'General Manager', department: 'management', seniority: 'senior', verification: 'valid' }),
        person({ email: 'jan.stedry@ac3.com.au', firstName: 'Jan', lastName: 'Stedry', position: 'Head of Cloud', department: 'management', seniority: 'executive', verification: 'valid' }),
    ],
};

describe('the case that made us invert the pipeline', () => {
    it('picks the Head of People, not the CEO, for a junior analyst role', () => {
        const slots = pickFromDirectory(AUSMEAT, { role: 'Junior Business Analyst' });
        expect(slots.talent?.name).toBe('Heidi Casey');
        // The CEO is in this directory and must not win any slot.
        const chosen = [slots.talent, slots.hiring_manager, slots.team_insider]
            .filter(Boolean).map(s => s!.name);
        expect(chosen).not.toContain('Stephen Crisp');
    });

    it('offers the software developer as the team insider', () => {
        const slots = pickFromDirectory(AUSMEAT, { role: 'Junior Business Analyst' });
        expect(slots.team_insider?.name).toBe('Samuel Blight');
    });

    it('does not hand an analyst vacancy to the Head of Finance', () => {
        const slots = pickFromDirectory(AUSMEAT, { role: 'Junior Business Analyst' });
        expect(slots.hiring_manager?.name).not.toBe('Rebecca Dillon');
    });

    it('prefers the senior HR person over the coordinator', () => {
        const slots = pickFromDirectory(AUSMEAT, { role: 'Junior Business Analyst' });
        expect(slots.talent?.position).toBe('Head of People');
    });
});

describe('AC3, where the LinkedIn path returned nothing usable', () => {
    it('finds both a talent contact and an IT manager for an IT role', () => {
        const slots = pickFromDirectory(AC3, { role: 'IT Support Officer' });
        expect(slots.talent?.name).toBe('Parul Batra');
        expect(slots.hiring_manager?.name).toBe('Michal Gavernik');
    });

    it('does not pick the General Manager at a company this size', () => {
        const slots = pickFromDirectory(AC3, { role: 'IT Support Officer' });
        expect(slots.hiring_manager?.name).not.toBe('Stephanie Challinor');
    });
});

describe('the small-employer rule', () => {
    const tiny: Directory = {
        domain: 'tinyco.com.au', acceptAll: false, pattern: '{first}', total: 4,
        people: [
            person({ email: 'dana@tinyco.com.au', firstName: 'Dana', lastName: 'Reid', position: 'Founder', department: 'executive' }),
            person({ email: 'sam@tinyco.com.au', firstName: 'Sam', lastName: 'Ng', position: 'Office Administrator', department: 'operations' }),
        ],
    };

    it('allows the founder when the directory says the company is tiny', () => {
        const slots = pickFromDirectory(tiny, { role: 'Marketing Coordinator' });
        expect(slots.hiring_manager?.name).toBe('Dana Reid');
        expect(slots.hiring_manager?.why.join(' ')).toMatch(/small enough/);
    });

    it('does not allow the equivalent person at a large employer', () => {
        const big = { ...tiny, total: SMALL_ORG_MAX + 30 };
        const slots = pickFromDirectory(big, { role: 'Marketing Coordinator' });
        expect(slots.hiring_manager).toBeNull();
    });
});

describe('what it refuses to do', () => {
    it('skips generic role addresses', () => {
        const d: Directory = {
            domain: 'x.com.au', acceptAll: false, pattern: null, total: 2,
            people: [person({ email: 'careers@x.com.au', position: 'Recruitment', department: 'hr', type: 'generic' })],
        };
        expect(pickFromDirectory(d, { role: 'Business Analyst' }).talent).toBeNull();
    });

    it('skips an address Hunter says is invalid', () => {
        const d: Directory = {
            domain: 'x.com.au', acceptAll: false, pattern: null, total: 2,
            people: [person({ email: 'a.b@x.com.au', firstName: 'A', lastName: 'B', position: 'HR Manager', department: 'hr', verification: 'invalid' })],
        };
        expect(pickFromDirectory(d, { role: 'Business Analyst' }).talent).toBeNull();
    });

    it('returns three empty slots for an empty directory rather than throwing', () => {
        const d: Directory = { domain: 'x.com.au', acceptAll: false, pattern: null, total: 0, people: [] };
        const slots = pickFromDirectory(d, { role: 'Business Analyst' });
        expect(slots).toEqual({ talent: null, hiring_manager: null, team_insider: null });
    });

    it('never puts the same person in two slots', () => {
        const slots = pickFromDirectory(AUSMEAT, { role: 'Junior Business Analyst' });
        const emails = [slots.talent, slots.hiring_manager, slots.team_insider]
            .filter(Boolean).map(s => s!.email);
        expect(new Set(emails).size).toBe(emails.length);
    });
});
