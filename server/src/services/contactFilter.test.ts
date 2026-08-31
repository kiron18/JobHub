import { describe, it, expect } from 'vitest';
import {
    filterContact, fillSlots, rankOfTitle, disciplinesOf, statesIn,
    namesDifferentEmployer, type ContactCandidate,
} from './contactFilter';

/**
 * Every case below is a real pick from the 31-company contact-discovery
 * bake-off, quoted as the search actually returned it. The three in the first
 * block are the ones that would have reached a client.
 */

describe('the picks that would have hurt us', () => {
    it('rejects a WA Director General chosen for a Queensland role', () => {
        const verdict = filterContact(
            {
                name: 'Adam Tomison',
                title: 'Director General, WA Department of Justice',
                location: 'Perth, Western Australia',
            },
            { company: 'Department of Justice', role: 'Graduate Officer', location: 'Brisbane, Queensland' },
        );
        expect(verdict.pass).toBe(false);
        expect(verdict.rejections).toContain('STATE_CONFLICT');
    });

    it('rejects a professor of obstetrics chosen for a Project Officer role', () => {
        const verdict = filterContact(
            {
                name: 'Michelle Giles',
                title: 'Professor in the Department of Obstetrics and Gynaecology, School of Clinical Sciences',
            },
            { company: 'Monash University', role: 'Project Officer', location: 'Melbourne' },
        );
        expect(verdict.pass).toBe(false);
        expect(verdict.rejections).toContain('WRONG_FUNCTION');
    });

    it('rejects a CEO chosen for a junior analyst role', () => {
        const verdict = filterContact(
            { name: 'Stephen Crisp', title: 'Chief Executive Officer' },
            { company: 'AUS-MEAT', role: 'Junior Business Analyst' },
        );
        expect(verdict.pass).toBe(false);
        expect(verdict.rejections).toContain('TOO_SENIOR');
    });

    it('rejects a first name with no surname, which made Hunter return a 400', () => {
        const verdict = filterContact(
            { name: 'Iva', title: null },
            { company: 'Northern Beaches Council', role: 'Service Delivery Analyst' },
        );
        expect(verdict.pass).toBe(false);
        expect(verdict.rejections).toContain('INCOMPLETE_NAME');
    });
});

describe('the other over-senior picks the bake-off produced', () => {
    const tooSenior: Array<[string, string, string, string]> = [
        ['Chris Kelly', 'Director Corporate Services', 'Mackay Regional Council', 'Business Analyst Traineeship'],
        ['Scott Walker', 'Director, Urban Living', 'City of Boroondara', 'Functional Analyst'],
        ['Gary Wright', 'General Manager - Strategy, Planning & Delivery', 'RAC', 'Claims Delivery Analyst'],
        ['Josh Rieck', 'Chief Operating Officer', 'Killara Services', 'IT Support Officer'],
    ];

    for (const [name, title, company, role] of tooSenior) {
        it(`rejects ${title} for ${role}`, () => {
            const verdict = filterContact({ name, title }, { company, role });
            expect(verdict.pass).toBe(false);
        });
    }
});

describe('the picks that were actually good, which must survive', () => {
    it('keeps a Service Desk Team Leader for an IT graduate role', () => {
        const verdict = filterContact(
            { name: 'Sapna Musale', title: 'Service Desk Team Leader' },
            { company: 'Wyndham City Council', role: 'IT Graduate Support Officer', location: 'Werribee, Victoria' },
        );
        expect(verdict.pass).toBe(true);
        expect(verdict.outreachRole).toBe('hiring_manager');
    });

    it('keeps a talent consultant regardless of how senior they read', () => {
        const verdict = filterContact(
            { name: 'Zara Nevett', title: 'HR & Talent Acquisition Consultant' },
            { company: 'Sharp & Carter Recruitment', role: 'Business Analyst' },
        );
        expect(verdict.pass).toBe(true);
        expect(verdict.outreachRole).toBe('talent');
    });

    it('keeps a PMO manager two rungs above a business systems analyst', () => {
        const verdict = filterContact(
            { name: 'Erich Peters', title: 'Senior Project, Program & PMO Manager' },
            { company: 'Monadelphous', role: 'Business Systems Analyst' },
        );
        expect(verdict.pass).toBe(true);
        expect(verdict.outreachRole).toBe('hiring_manager');
    });

    it('keeps a Director of Nursing for a graduate nurse, four rungs up', () => {
        // The first version of this filter rejected all three of these on rung
        // count. A Director of Nursing is who hires a graduate nurse.
        for (const company of ['Pacific Private Hospital', 'Darwin Private Hospital', 'Maitland Private Hospital']) {
            const verdict = filterContact(
                { name: 'Jane McLennan', title: 'Director of Nursing' },
                { company, role: 'Graduate Nurse' },
            );
            expect(verdict.pass, company).toBe(true);
            expect(verdict.outreachRole).toBe('hiring_manager');
        }
    });

    it('does not let an executive back in on a coincidental shared word', () => {
        // "Delivery" in "General Manager - Strategy, Planning & Delivery" is not
        // the delivery in "Claims Delivery Analyst". Rank 5 gets no exemption.
        const verdict = filterContact(
            { name: 'Gary Wright', title: 'General Manager - Strategy, Planning & Delivery' },
            { company: 'RAC', role: 'Claims Delivery Analyst' },
        );
        expect(verdict.pass).toBe(false);
        expect(verdict.rejections).toContain('TOO_SENIOR');
    });

    it('keeps a peer on the same rung as a team insider', () => {
        const verdict = filterContact(
            { name: 'Dana Whitfield', title: 'Business Analyst' },
            { company: 'Monadelphous', role: 'Business Systems Analyst' },
        );
        expect(verdict.pass).toBe(true);
        expect(verdict.outreachRole).toBe('team_insider');
    });
});

describe('rankOfTitle', () => {
    it('puts an entry marker below a bare title', () => {
        expect(rankOfTitle('Junior Business Analyst')).toBe(0);
        expect(rankOfTitle('Business Analyst')).toBe(1);
    });

    it('reads Director General as running the place, not a department', () => {
        expect(rankOfTitle('Director General')).toBe(5);
        expect(rankOfTitle('Director of Nursing')).toBe(4);
    });

    it('reads a senior manager as a manager, not a senior IC', () => {
        expect(rankOfTitle('Senior Project Manager')).toBe(3);
        expect(rankOfTitle('Senior Analyst')).toBe(1);
    });

    it('defaults an unrecognised title to the IC rung rather than guessing high', () => {
        expect(rankOfTitle('Widget Wrangler')).toBe(1);
        expect(rankOfTitle(null)).toBe(1);
    });
});

describe('statesIn', () => {
    it('reads an upper-case abbreviation as a state', () => {
        expect(statesIn('Director General, WA Department of Justice')).toContain('WA');
    });

    it('does not read ordinary prose as a state', () => {
        // "act" and "vic" lower-cased are English, not Australian states. A
        // false state here would invent a conflict and drop a good contact.
        expect(statesIn('will act as the primary contact for the team')).toEqual([]);
        expect(statesIn('a saas platform')).toEqual([]);
    });

    it('reads a city as its state', () => {
        expect(statesIn('Greater Sydney Area')).toContain('NSW');
        expect(statesIn('Brisbane, Queensland, Australia')).toContain('QLD');
    });
});

describe('namesDifferentEmployer', () => {
    it('does not fire when the snippet simply omits the employer', () => {
        expect(namesDifferentEmployer('Marketing Manager', 'Scania')).toBe(false);
    });

    it('fires when the snippet names some other organisation', () => {
        expect(namesDifferentEmployer('Senior Analyst at Commonwealth Bank', 'Talent')).toBe(true);
    });
});

describe('disciplinesOf', () => {
    it('reads a clinical title as clinical', () => {
        expect(disciplinesOf('Professor of Obstetrics and Gynaecology')).toContain('clinical');
    });

    it('reads talent titles as talent', () => {
        expect(disciplinesOf('Talent Acquisition Partner')).toContain('talent');
        expect(disciplinesOf('HR Advisor')).toContain('talent');
    });
});

describe('fillSlots', () => {
    const target = { company: 'Monadelphous', role: 'Business Systems Analyst', location: 'Perth, WA' };

    it('returns fewer than three rather than inventing one', () => {
        const only: ContactCandidate[] = [
            { name: 'Stephen Crisp', title: 'Chief Executive Officer' },
            { name: 'Erich Peters', title: 'Senior Project, Program & PMO Manager' },
        ];
        const slots = fillSlots(only, target);
        expect(slots.hiring_manager?.candidate.name).toBe('Erich Peters');
        expect(slots.talent).toBeNull();
        expect(slots.team_insider).toBeNull();
    });

    it('returns nothing at all when everyone fails a gate', () => {
        const slots = fillSlots([{ name: 'Stephen Crisp', title: 'Chief Executive Officer' }], target);
        expect(slots.talent).toBeNull();
        expect(slots.hiring_manager).toBeNull();
        expect(slots.team_insider).toBeNull();
    });

    it('keeps the first survivor for a slot, since discovery already ranked them', () => {
        const slots = fillSlots(
            [
                { name: 'Erich Peters', title: 'Senior Project, Program & PMO Manager' },
                { name: 'Other Manager', title: 'Delivery Manager' },
            ],
            target,
        );
        expect(slots.hiring_manager?.candidate.name).toBe('Erich Peters');
    });
});
