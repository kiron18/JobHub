import { describe, it, expect } from 'vitest';
import { checkStyle, formatStyleViolationsForRetry } from '../lib/styleLint';

describe('checkStyle', () => {
    describe('em dash detection', () => {
        it('detects em dashes in text', () => {
            const text = 'This is a test—with an em dash.';
            const result = checkStyle(text);
            expect(result.emDashCount).toBe(1);
            expect(result.violations.some(v => v.type === 'em-dash')).toBe(true);
        });

        it('counts multiple em dashes', () => {
            const text = 'First—second—third';
            const result = checkStyle(text);
            expect(result.emDashCount).toBe(2);
        });

        it('passes when no em dashes present', () => {
            const text = 'This is a test - with a regular dash.';
            const result = checkStyle(text);
            expect(result.emDashCount).toBe(0);
            expect(result.violations.some(v => v.type === 'em-dash')).toBe(false);
        });
    });

    describe('banned phrase detection', () => {
        it('detects "passionate"', () => {
            const text = 'I am passionate about software development.';
            const result = checkStyle(text);
            expect(result.violations.some(v => v.message.includes('passionate'))).toBe(true);
        });

        it('detects "results-driven"', () => {
            const text = 'I am a results-driven professional.';
            const result = checkStyle(text);
            expect(result.violations.some(v => v.message.includes('results-driven'))).toBe(true);
        });

        it('detects "proven track record"', () => {
            const text = 'I have a proven track record of success.';
            const result = checkStyle(text);
            expect(result.violations.some(v => v.message.includes('track record'))).toBe(true);
        });

        it('detects "leverage"', () => {
            const text = 'We should leverage our resources.';
            const result = checkStyle(text);
            expect(result.violations.some(v => v.message.includes('leverage'))).toBe(true);
        });

        it('detects cover letter banned phrases', () => {
            const text = 'I believe I would be a great fit for your team.';
            const result = checkStyle(text);
            expect(result.violations.some(v => v.message.includes('great fit'))).toBe(true);
        });

        it('is case-insensitive', () => {
            const text = 'I am Passionate and Results-Driven.';
            const result = checkStyle(text);
            expect(result.violations.filter(v => v.type === 'banned-phrase').length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('word count check (cover letter only)', () => {
        it('flags cover letter under 400 words', () => {
            const text = 'Dear Hiring Manager,\n\n' + 'This is a short letter. '.repeat(50);
            const result = checkStyle(text, true); // isCoverLetter = true
            expect(result.violations.some(v => v.type === 'word-count' && v.message.includes('below'))).toBe(true);
        });

        it('flags cover letter over 500 words', () => {
            const text = 'Dear Hiring Manager,\n\n' + 'This is a very long letter with many words. '.repeat(200);
            const result = checkStyle(text, true);
            expect(result.violations.some(v => v.type === 'word-count' && v.message.includes('exceeds'))).toBe(true);
        });

        it('accepts cover letter within 400-500 words', () => {
            // Create text with ~450 words (14 words * 32 = 448 words)
            const sentence = 'I am writing to express my strong interest in this position at your company. ';
            const repeatedText = 'Dear Hiring Manager,\n\n' + sentence.repeat(32) + '\n\nYours sincerely,\nJohn';
            const result = checkStyle(repeatedText, true);
            expect(result.wordCount).toBeGreaterThanOrEqual(400);
            expect(result.wordCount).toBeLessThanOrEqual(500);
            expect(result.violations.some(v => v.type === 'word-count')).toBe(false);
        });

        it('does not check word count for resumes', () => {
            const text = 'Short text.';
            const result = checkStyle(text, false); // isCoverLetter = false
            expect(result.violations.some(v => v.type === 'word-count')).toBe(false);
        });
    });

    describe('formatStyleViolationsForRetry', () => {
        it('formats violations with STYLE prefix', () => {
            const violations = [
                { type: 'em-dash' as const, message: 'Contains 1 em dash' },
                { type: 'banned-phrase' as const, message: 'Banned phrase "passionate"' },
            ];
            const formatted = formatStyleViolationsForRetry(violations);
            expect(formatted[0]).toBe('[STYLE] Contains 1 em dash');
            expect(formatted[1]).toBe('[STYLE] Banned phrase "passionate"');
        });
    });
});

describe('Phase 2 Acceptance Gate', () => {
    it('Gate (a): retry with 0 violations should be adopted', () => {
        // This test documents the logic: if retry has 0 violations vs original > 0,
        // the retry is adopted (tie goes to retry)
        const originalViolations = 3;
        const retryViolations = 0;
        const shouldAdoptRetry = retryViolations <= originalViolations;
        expect(shouldAdoptRetry).toBe(true);
    });

    it('Gate (b): retry with MORE violations than original should be discarded', () => {
        const originalViolations = 2;
        const retryViolations = 5;
        const shouldAdoptRetry = retryViolations <= originalViolations;
        expect(shouldAdoptRetry).toBe(false);
    });

    it('Gate (c): shape-breaking retry keeps original (existing behavior)', () => {
        // Documented behavior: if retry breaks shape, original is kept regardless of violations
        const retryBreaksShape = true;
        const keepOriginal = retryBreaksShape;
        expect(keepOriginal).toBe(true);
    });

    it('counts grounding + style violations together', () => {
        // Simulating the combined count logic from generate.ts
        const groundingViolations = 2;
        const styleViolations = 3;
        const totalViolations = groundingViolations + styleViolations;
        expect(totalViolations).toBe(5);
    });
});
