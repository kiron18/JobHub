import { describe, it, expect } from 'vitest';
import { parseJD } from '../lib/jdParser';

const seekJDWithQuestions = `
Marketing Executive — Original Spin PR
Posted 14d ago
Full time
$50 – $70 per year

We are looking for a marketing executive to join our team...

Missed questions from Seek - Not included in the pasted description
Employer questions
Your application will include the following questions:
Which of the following statements best describes your right to work in Australia?
How many years' experience do you have as a Marketing and Public Relations Executive?
How many years' experience do you have in digital marketing?
Do you have a current Police Check (National Police Certificate) for employment?
What's your expected annual base salary?
How much notice are you required to give your current employer?
Do you have a current Working With Children (WWC) Check?
`;

const seekJDWithoutQuestions = `
Marketing Executive — Original Spin PR
Posted 14d ago
Full time
$50 – $70 per year

We are looking for a marketing executive to join our team...
`;

const nonSeekJD = `
Senior Software Engineer
We are looking for an engineer to join our team...
Must have 5+ years of experience.
`;

describe('parseJD', () => {
    it('detects employer questions when present in Seek JD', () => {
        const result = parseJD(seekJDWithQuestions);
        expect(result.hasEmployerQuestions).toBe(true);
        expect(result.employerQuestions.length).toBeGreaterThanOrEqual(7);
        expect(result.employerQuestions[0]).toContain('right to work');
        expect(result.warning).toBeUndefined();
    });

    it('warns when JD looks like Seek but employer questions are missing', () => {
        const result = parseJD(seekJDWithoutQuestions);
        expect(result.hasEmployerQuestions).toBe(false);
        expect(result.employerQuestions).toHaveLength(0);
        expect(result.warning).toBeDefined();
        expect(result.warning).toContain('Seek');
    });

    it('does not warn for non-Seek JDs without questions', () => {
        const result = parseJD(nonSeekJD);
        expect(result.hasEmployerQuestions).toBe(false);
        expect(result.employerQuestions).toHaveLength(0);
        expect(result.warning).toBeUndefined();
    });

    it('handles empty string gracefully', () => {
        const result = parseJD('');
        expect(result.hasEmployerQuestions).toBe(false);
        expect(result.employerQuestions).toHaveLength(0);
        expect(result.warning).toBeUndefined();
    });

    it('handles partial match of question block patterns', () => {
        const partial = 'Employer questions\nSome text without actual questions\n';
        const result = parseJD(partial);
        expect(result.hasEmployerQuestions).toBe(true);
        expect(result.employerQuestions).toHaveLength(0);
    });

    it('extracts only text ending with ? as questions', () => {
        const withMix = `Your application will include the following questions:
1. Do you have experience?
2. Skills summary
3. What is your salary?`;
        const result = parseJD(withMix);
        expect(result.employerQuestions.length).toBe(2);
        expect(result.employerQuestions[0]).toBe('Do you have experience?');
        expect(result.employerQuestions[1]).toBe('What is your salary?');
    });
});
