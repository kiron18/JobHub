/**
 * Joining a generated document to the job it was written for.
 *
 * The workspace makes two independent calls: it generates the documents, then
 * on the last step it saves the application to the tracker. Nothing connected
 * the two, so 97% of generated documents had no jobApplicationId — the client's
 * tracker showed applications with no documents attached, and quality control
 * could not check targeting because it could not find the advert.
 *
 * The join key is a fingerprint of the advert, which both calls carry. It is
 * only ever used to fill in Document.jobApplicationId: no application is
 * created, deleted or restatused here, so nothing any count depends on moves.
 */
import { createHash } from 'crypto';
import { prisma } from '../../index';

/** How far back to look for a document belonging to a newly-saved application. */
const LINK_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Fingerprint of an advert, stable across the whitespace and line-ending
 * differences between a textarea paste and a stored column.
 *
 * Returns null for anything too short to be an advert — a one-line stand-in
 * like "Nurse at Ramsay" is not distinctive, and matching on it would attach a
 * client's documents to the wrong job.
 */
export function jobDescriptionHash(jobDescription: string | null | undefined): string | null {
    const normalized = (jobDescription ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalized.length < 200) return null;
    return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

/**
 * Attaches this user's recent unlinked documents for the same advert to a
 * newly-saved application. Returns how many were attached.
 *
 * Only documents with no application already set are touched, so re-running is
 * harmless and an existing link is never overwritten.
 */
export async function linkDocumentsToApplication(
    userId: string,
    jobApplicationId: string,
    jobDescription: string | null | undefined,
): Promise<number> {
    const hash = jobDescriptionHash(jobDescription);
    if (!hash) return 0;

    const { count } = await prisma.document.updateMany({
        where: {
            userId,
            jobApplicationId: null,
            jobDescriptionHash: hash,
            createdAt: { gte: new Date(Date.now() - LINK_WINDOW_MS) },
        },
        data: { jobApplicationId },
    });
    return count;
}
