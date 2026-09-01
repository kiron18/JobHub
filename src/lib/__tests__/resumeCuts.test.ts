import { describe, it, expect } from 'vitest';
import { suggestCuts } from '../resumeCuts';

/** A three-line bullet: past 190 characters, which is where they start wrapping. */
const LONG_BULLET =
    '- Coordinated the end-to-end delivery of fourteen concurrent oncology trials across three metropolitan sites, '
    + 'liaising with sponsors, ethics committees and site staff to keep every protocol amendment on schedule and '
    + 'documented to GCP standard throughout.';

const RESUME = `# Priya Ramesh
Sydney NSW | priya@example.com

## Professional summary
Clinical research coordinator moving into health data analysis.

## Core skills
Stakeholder management, SQL, Protocol design, Vendor negotiation

## Experience

### Clinical Research Coordinator, Westmead
${LONG_BULLET}
- Cut screening turnaround from 21 days to 9.
- Ran stakeholder management across three sponsor relationships.

### Research Assistant, UNSW
- Built the SQL extracts the trial team reported from.
- Handled stakeholder management for two academic partners.

### Laboratory Technician, Douglass Hanly Moir
- Processed samples.
- Maintained the equipment log.
- Trained two new starters.
- Covered reception on Fridays.

## Education
### Master of Public Health, University of Sydney`;

describe('suggestCuts', () => {
    it('names the long bullet, where it is, and how it opens', () => {
        const cuts = suggestCuts(RESUME);
        const long = cuts.find((c) => /three lines/.test(c.title));

        expect(long).toBeDefined();
        expect(long!.title).toMatch(/^One bullet runs to three lines/);
        expect(long!.detail).toContain('Clinical Research Coordinator, Westmead');
        expect(long!.detail).toContain('Coordinated the end-to-end delivery of fourteen');
        // Quoted, not reproduced: the point is to find it on the page.
        expect(long!.detail).toContain('…');
    });

    it('points at the oldest role, which is the last one listed', () => {
        const cuts = suggestCuts(RESUME);
        const oldest = cuts.find((c) => /oldest role/.test(c.title));

        expect(oldest).toBeDefined();
        expect(oldest!.title).toContain('4 bullets');
        expect(oldest!.detail).toContain('Laboratory Technician, Douglass Hanly Moir');
    });

    it('drops a skill from the list once the bullets have proven it twice', () => {
        const cuts = suggestCuts(RESUME);
        const repeated = cuts.find((c) => /skills? (list|are)/i.test(c.title));

        expect(repeated).toBeDefined();
        // "Stakeholder management" is in two bullets; SQL is in one, so only the
        // first has earned the suggestion.
        expect(repeated!.detail).toContain('Stakeholder management');
        expect(repeated!.detail).not.toContain('SQL');
    });

    it('says nothing about a short, tidy resume', () => {
        const tidy = `# Sam Ortega

## Experience

### Analyst, Telstra
- Cut reporting time by half.

## Education
### BCom, Monash`;

        expect(suggestCuts(tidy)).toEqual([]);
    });

    it('leaves a two-role history alone — there is no oldest role worth cutting yet', () => {
        const twoRoles = `# Sam Ortega

## Experience

### Analyst, Telstra
- Cut reporting time by half.

### Graduate, NAB
- Built the weekly pack.
- Ran the reconciliation.
- Onboarded the new starters.`;

        expect(suggestCuts(twoRoles).some((c) => /oldest role/.test(c.title))).toBe(false);
    });

    it('never returns more than three, so it stays advice rather than a to-do list', () => {
        expect(suggestCuts(RESUME).length).toBeLessThanOrEqual(3);
    });

    it('is quiet on an empty document rather than guessing', () => {
        expect(suggestCuts('')).toEqual([]);
    });

    it('reads a skills block written as bullets, not just as one delimited line', () => {
        const bulletedSkills = `# Sam Ortega

## Technical skills
- Power BI
- Forecasting

## Experience

### Analyst, Telstra
- Rebuilt the Power BI suite the exec team reads.
- Owned the Power BI refresh pipeline.`;

        const cuts = suggestCuts(bulletedSkills);
        expect(cuts.some((c) => c.detail.includes('Power BI'))).toBe(true);
    });
});
