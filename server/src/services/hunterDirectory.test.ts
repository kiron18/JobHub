import { describe, it, expect } from 'vitest';
import { hunterDepartmentForRole } from './hunterDirectory';

describe('hunterDepartmentForRole', () => {
    it('routes the roles our corpus actually contains', () => {
        expect(hunterDepartmentForRole('Business Systems Analyst')).toBe('it');
        expect(hunterDepartmentForRole('IT Graduate Support Officer')).toBe('it');
        expect(hunterDepartmentForRole('Graduate Nurse')).toBe('health');
        expect(hunterDepartmentForRole('New Graduate (Perioperative)')).toBe('health');
        expect(hunterDepartmentForRole('Financial Accountant')).toBe('finance');
        expect(hunterDepartmentForRole('Marketing Coordinator')).toBe('marketing');
    });

    it('returns null for a role it cannot place, so the caller falls back', () => {
        expect(hunterDepartmentForRole('Untitled role')).toBeNull();
        expect(hunterDepartmentForRole('')).toBeNull();
    });

    it('does not match a fragment inside an unrelated word', () => {
        // These patterns once shipped with literal backspace bytes instead of
        // word boundaries, which is invisible on screen and matches nothing
        // deliberate. "ui" inside "Building" is the case that would bite.
        expect(hunterDepartmentForRole('Building Surveyor')).not.toBe('design');
        expect(hunterDepartmentForRole('Accountable Care Lead')).not.toBe('finance');
    });

    it('has no control characters in its patterns', () => {
        // A direct guard on the bug above: a stray \x08 in a source regex is
        // impossible to spot in review and silently disables the boundary.
        const source = hunterDepartmentForRole.toString();
        expect(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(source)).toBe(false);
    });
});

// ── The single targeted call ─────────────────────────────────────────────────

import { departmentToBuy, type EmailCount } from './hunterDirectory';

const count = (departments: Record<string, number>, total?: number): EmailCount => ({
    total: total ?? Object.values(departments).reduce((a, b) => a + b, 0),
    personal: 0,
    generic: 0,
    departments,
});

describe('departmentToBuy', () => {
    it('buys HR when Hunter holds anyone in it, whatever the role', () => {
        // Defence: 2803 addresses across nineteen departments, 25 of them HR.
        expect(departmentToBuy(count({ hr: 25, it: 117, management: 463 }), 'Technical Officer'))
            .toBe('hr');
    });

    it('buys the vacancy\'s own function when there is no HR', () => {
        // IT Strategic: 12 addresses, six of them IT, and no HR at all.
        expect(departmentToBuy(count({ it: 6, management: 1, support: 2 }), 'IT Support Engineer'))
            .toBe('it');
    });

    it('buys the largest bucket when neither exists', () => {
        // New Home Care: a lawyer, a paralegal, a bookkeeper and an inbox, and
        // an AI engineering vacancy that matches none of them.
        expect(departmentToBuy(count({ legal: 2, 'finance & accounting': 1, support: 1 }), 'AI Engineer'))
            .toBe('legal');
    });

    it('asks for nothing when Hunter reports no departments', () => {
        expect(departmentToBuy(count({}), 'Office Administrator')).toBeNull();
    });

    it('never asks for a department Hunter holds nobody in', () => {
        // The blind version asks for `hr` here regardless and pays for an empty
        // page. `hr` is absent, so the role's own function wins instead.
        const c = count({ it: 4, executive: 1 });
        const chosen = departmentToBuy(c, 'IT Support Engineer');
        expect(chosen).toBe('it');
        expect(c.departments[chosen!]).toBeGreaterThan(0);
    });
});
