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
