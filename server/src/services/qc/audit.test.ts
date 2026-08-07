import { describe, it, expect, vi, beforeEach } from 'vitest';

const callClaude = vi.fn();
vi.mock('../llm', () => ({ callClaude: (...a: unknown[]) => callClaude(...a) }));

import { verifyQuotes, auditHash, auditDocument, type QcAuditFinding } from './audit';

const finding = (over: Partial<QcAuditFinding> = {}): QcAuditFinding => ({
    dimension: 'honesty',
    severity: 'critical',
    quote: 'increased revenue by 400% in six weeks',
    issue: 'not in the source',
    fix: 'remove it',
    ...over,
});

describe('verifyQuotes', () => {
    const doc = 'I increased revenue by 400% in six weeks while leading the team.';

    it('keeps a finding whose quote is really in the document', () => {
        const { kept, discarded } = verifyQuotes([finding()], doc);
        expect(kept).toHaveLength(1);
        expect(discarded).toBe(0);
    });

    it('discards a finding the model could not actually point at', () => {
        // The failure this exists for: a judge paraphrases and presents it as a
        // quotation, and a coach is sent to correct a sentence nobody wrote.
        const { kept, discarded } = verifyQuotes(
            [finding({ quote: 'grew revenue fourfold within a month and a half' })],
            doc,
        );
        expect(kept).toHaveLength(0);
        expect(discarded).toBe(1);
    });

    it('matches across the line wrapping difference between stored and echoed text', () => {
        const wrapped = 'I increased revenue\n   by 400% in six weeks.';
        expect(verifyQuotes([finding()], wrapped).kept).toHaveLength(1);
    });

    it('rejects a quote too short to be evidence of anything', () => {
        // "the team" appears, but it proves nothing and would match by accident.
        expect(verifyQuotes([finding({ quote: 'the' })], doc).kept).toHaveLength(0);
    });
});

describe('auditHash', () => {
    const base = {
        docType: 'COVER_LETTER',
        content: 'letter body',
        jobDescription: 'the advert',
        profile: { resumeRawText: 'source resume' },
    };

    it('is stable for the same inputs, so a re-open is served from cache', () => {
        expect(auditHash(base)).toBe(auditHash({ ...base }));
    });

    it('changes when the document is edited', () => {
        expect(auditHash({ ...base, content: 'letter body, edited' })).not.toBe(auditHash(base));
    });

    it('changes when the advert or the source resume changes', () => {
        expect(auditHash({ ...base, jobDescription: 'a different advert' })).not.toBe(auditHash(base));
        expect(auditHash({ ...base, profile: { resumeRawText: 'a new upload' } })).not.toBe(auditHash(base));
    });
});

describe('auditDocument', () => {
    beforeEach(() => callClaude.mockReset());

    const input = {
        docType: 'COVER_LETTER',
        content: 'I increased revenue by 400% in six weeks while leading the team.',
        jobDescription: 'advert',
        profile: { resumeRawText: 'source' },
    };

    it('returns only the findings it could verify, and says how many it dropped', async () => {
        callClaude.mockResolvedValue({
            content: JSON.stringify({
                scores: { targeting: 3, honesty: 2, quality: 4 },
                summary: 'Needs work.',
                findings: [
                    { dimension: 'honesty', severity: 'critical', quote: 'increased revenue by 400%', issue: 'x', fix: 'y' },
                    { dimension: 'honesty', severity: 'critical', quote: 'managed a team of fifty engineers', issue: 'x', fix: 'y' },
                ],
                notAssessed: [],
            }),
            usage: { promptTokens: 1000, completionTokens: 200 },
        });

        const { verdict, tokens } = await auditDocument(input);
        expect(verdict.findings).toHaveLength(1);
        expect(verdict.discardedFindings).toBe(1);
        expect(tokens.costUsd).toBeGreaterThan(0);
    });

    it('clamps a score the model returns out of range', async () => {
        callClaude.mockResolvedValue({
            content: JSON.stringify({ scores: { targeting: 9, honesty: 0, quality: 'good' }, findings: [] }),
            usage: { promptTokens: 10, completionTokens: 10 },
        });
        const { verdict } = await auditDocument(input);
        expect(verdict.scores).toEqual({ targeting: 5, honesty: 1, quality: 3 });
    });

    it('fails loudly on an unreadable verdict rather than reporting a clean document', async () => {
        callClaude.mockResolvedValue({ content: 'I am afraid I cannot do that', usage: { promptTokens: 1, completionTokens: 1 } });
        await expect(auditDocument(input)).rejects.toThrow(/could not be read/i);
    });

    it('sends the rubric as a cached prefix so repeat audits do not re-pay for it', async () => {
        callClaude.mockResolvedValue({
            content: JSON.stringify({ scores: { targeting: 5, honesty: 5, quality: 5 }, findings: [] }),
            usage: { promptTokens: 1, completionTokens: 1 },
        });
        await auditDocument(input);
        const [, jsonMode, cachedSystem] = callClaude.mock.calls[0];
        expect(jsonMode).toBe(true);
        expect(String(cachedSystem)).toContain('quality controller');
    });
});
