import { describe, it, expect } from 'vitest';
import {
    buildInterviewContextBlock,
    isInterviewStage,
    stripEmDashes,
    INTERVIEW_STAGES,
} from './interviewPrepContext';

const FULL = {
    visaStatus: 'Australian citizen',
    visaExpiry: 'Not applicable',
    salaryExpectation: '$85,000 to $95,000 plus super',
    availability: '4 weeks notice',
    location: 'Melbourne, VIC',
};

const NONE = {
    visaStatus: null,
    visaExpiry: null,
    salaryExpectation: null,
    availability: null,
    location: null,
};

describe('interview prep context', () => {
    it('accepts only the five real stages', () => {
        for (const stage of Object.keys(INTERVIEW_STAGES)) {
            expect(isInterviewStage(stage)).toBe(true);
        }
        expect(isInterviewStage('phone')).toBe(false);
        expect(isInterviewStage('')).toBe(false);
        expect(isInterviewStage(null)).toBe(false);
        expect(isInterviewStage(undefined)).toBe(false);
        // A user-supplied value must not reach through to Object.prototype.
        expect(isInterviewStage('toString')).toBe(false);
        expect(isInterviewStage('constructor')).toBe(false);
    });

    it('writes the brief for the round it is given', () => {
        const screen = buildInterviewContextBlock('recruiter_screen', FULL);
        expect(screen).toContain('Recruiter screening call');
        expect(screen).toMatch(/screening OUT/);
        expect(screen).toMatch(/Salary, availability, work rights/);

        const technical = buildInterviewContextBlock('technical', FULL);
        expect(technical).toContain('Technical or task-based interview');
        expect(technical).toMatch(/Reasoning out loud/);
        // The rounds must not bleed into each other.
        expect(technical).not.toMatch(/screening OUT/);
    });

    it('falls back to a first conversation when no round is chosen', () => {
        const block = buildInterviewContextBlock(null, FULL);
        expect(block).toMatch(/THE ROUND IS NOT KNOWN/);
        expect(block).toMatch(/first conversation with the employer/);
    });

    it('lists the facts it has', () => {
        const block = buildInterviewContextBlock('recruiter_screen', FULL);
        expect(block).toContain('Work rights: Australian citizen');
        expect(block).toContain('Salary expectation: $85,000 to $95,000 plus super');
        expect(block).toContain('Availability and notice: 4 weeks notice');
        expect(block).toContain('Based in: Melbourne, VIC');
        expect(block).not.toMatch(/NOT ON FILE/);
    });

    it('names what is missing instead of dropping it, and forbids inventing it', () => {
        const block = buildInterviewContextBlock('recruiter_screen', NONE);
        expect(block).toMatch(/NOT ON FILE/);
        expect(block).toMatch(/Never invent any of these/);
        expect(block).toContain('Work rights are not on file.');
        expect(block).toContain('Salary expectation is not on file.');
        expect(block).toContain('Nothing on file.');
    });

    it('treats whitespace as absent, since a space is not an answer', () => {
        const block = buildInterviewContextBlock('panel', { ...NONE, visaStatus: '   ' });
        expect(block).toContain('Work rights are not on file.');
        expect(block).not.toMatch(/Work rights: /);
    });

    it('reports each fact exactly once', () => {
        const block = buildInterviewContextBlock('final', { ...NONE, salaryExpectation: '$120k' });
        expect(block.match(/Salary expectation/g)).toHaveLength(1);
    });

    describe('em dashes', () => {
        it('replaces a dash doing the job of a comma', () => {
            expect(stripEmDashes('operational environments where accuracy matters—requirements, process mapping.'))
                .toBe('operational environments where accuracy matters, requirements, process mapping.');
            expect(stripEmDashes('When there were trade-offs — like performance — I went back.'))
                .toBe('When there were trade-offs, like performance, I went back.');
        });

        it('keeps a number range a range', () => {
            expect(stripEmDashes('the next 12–18 months')).toBe('the next 12 to 18 months');
            expect(stripEmDashes('$85,000—$95,000 plus super')).toBe('$85,000 to $95,000 plus super');
        });

        it('does not double up punctuation that was already there', () => {
            expect(stripEmDashes('one thing, — and another')).toBe('one thing, and another');
            expect(stripEmDashes('that is the whole call —.')).toBe('that is the whole call.');
        });

        it('leaves a hyphen alone', () => {
            expect(stripEmDashes('trade-offs and multi-source data')).toBe('trade-offs and multi-source data');
            expect(stripEmDashes('SAP S/4HANA MM and SD')).toBe('SAP S/4HANA MM and SD');
        });
    });
});
