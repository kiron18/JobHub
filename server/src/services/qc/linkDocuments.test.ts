import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateMany = vi.fn();
vi.mock('../../index', () => ({ prisma: { document: { updateMany: (...a: unknown[]) => updateMany(...a) } } }));

import { jobDescriptionHash, linkDocumentsToApplication } from './linkDocuments';

const ADVERT = `
Registered Nurse - Surgical Ward. St Vincent's Hospital is seeking a Registered
Nurse for our surgical ward. You will provide post-operative patient care,
manage medication administration and maintain accurate clinical documentation.
Requirements: AHPRA registration and acute care experience.
`;

describe('jobDescriptionHash', () => {
    it('is stable across the whitespace differences between a paste and a stored column', () => {
        const pasted = ADVERT.replace(/\n/g, '\r\n').replace(/ /g, '  ');
        expect(jobDescriptionHash(pasted)).toBe(jobDescriptionHash(ADVERT));
    });

    it('differs for a different advert', () => {
        expect(jobDescriptionHash(`${ADVERT} Night shift only.`)).not.toBe(jobDescriptionHash(ADVERT));
    });

    it('refuses to fingerprint a one-line stand-in', () => {
        // "Nurse at Ramsay" is not distinctive; matching on it would attach a
        // client's documents to the wrong job.
        expect(jobDescriptionHash('Registered Nurse at St Vincent Hospital')).toBeNull();
        expect(jobDescriptionHash('')).toBeNull();
        expect(jobDescriptionHash(null)).toBeNull();
    });
});

describe('linkDocumentsToApplication', () => {
    beforeEach(() => {
        updateMany.mockReset();
        updateMany.mockResolvedValue({ count: 2 });
    });

    it('does nothing when there is no real advert to match on', async () => {
        expect(await linkDocumentsToApplication('u1', 'job1', 'Nurse at Ramsay')).toBe(0);
        expect(updateMany).not.toHaveBeenCalled();
    });

    it('only touches this user\'s documents that have no application yet', async () => {
        await linkDocumentsToApplication('u1', 'job1', ADVERT);
        const [{ where, data }] = updateMany.mock.calls[0] as [{ where: any; data: any }];
        expect(where.userId).toBe('u1');
        expect(where.jobApplicationId).toBeNull();
        expect(where.jobDescriptionHash).toBe(jobDescriptionHash(ADVERT));
        expect(data).toEqual({ jobApplicationId: 'job1' });
    });

    it('will not reach back further than a day', async () => {
        await linkDocumentsToApplication('u1', 'job1', ADVERT);
        const [{ where }] = updateMany.mock.calls[0] as [{ where: any }];
        const age = Date.now() - where.createdAt.gte.getTime();
        expect(age).toBeGreaterThan(23 * 3600_000);
        expect(age).toBeLessThanOrEqual(24 * 3600_000 + 1000);
    });

    it('reports how many it attached', async () => {
        expect(await linkDocumentsToApplication('u1', 'job1', ADVERT)).toBe(2);
    });
});
