/**
 * Backfill: attach orphaned documents to the applications they were written for.
 *
 * Generation and the tracker row were, for a long time, two independent calls
 * with nothing joining them, so 97% of generated documents ended up with no
 * jobApplicationId. The join was fixed going forward by fingerprinting the
 * advert (see services/qc/linkDocuments.ts). This repairs the history.
 *
 * It is deliberately conservative. Three rules:
 *
 *   1. Only documents with no application already set are touched. An existing
 *      link is never overwritten, so a wrong guess here cannot destroy a right
 *      answer that already exists.
 *   2. A document is only attached when its advert fingerprint matches exactly
 *      ONE application for that user. A fingerprint matching two applications
 *      means the same ad was applied to twice, and picking one at random would
 *      put a client's document under the wrong employer.
 *   3. Nothing is created, deleted or restatused. No count anybody looks at
 *      moves as a result of running this.
 *
 * Usage:
 *   npx tsx src/scripts/backfill_document_links.ts           # count only
 *   npx tsx src/scripts/backfill_document_links.ts --apply   # write
 */
import { prisma } from '../index';
import { jobDescriptionHash } from '../services/qc/linkDocuments';

const APPLY = process.argv.includes('--apply');

async function main() {
    const orphans = await prisma.document.findMany({
        where: { jobApplicationId: null },
        select: { id: true, userId: true, type: true, jobDescriptionHash: true, createdAt: true },
    });

    console.log(`Orphaned documents: ${orphans.length}`);

    const withHash = orphans.filter(d => d.jobDescriptionHash);
    console.log(`  ...of which carry an advert fingerprint: ${withHash.length}`);
    console.log(`  ...unfingerprinted, unrecoverable by this route: ${orphans.length - withHash.length}`);

    if (withHash.length === 0) {
        console.log('\nNothing to do.');
        return;
    }

    // Every application belonging to the users who own an orphan, fingerprinted
    // the same way. Done in one pass rather than per document: the hash is
    // computed from the description, which is not stored pre-hashed on the job.
    const userIds = [...new Set(withHash.map(d => d.userId))];
    const jobs = await prisma.jobApplication.findMany({
        where: { candidateProfile: { userId: { in: userIds } } },
        select: { id: true, description: true, candidateProfile: { select: { userId: true } } },
    });

    /** userId -> fingerprint -> application ids */
    const index = new Map<string, Map<string, string[]>>();
    for (const j of jobs) {
        const hash = jobDescriptionHash(j.description);
        if (!hash) continue;
        const userId = j.candidateProfile.userId;
        if (!index.has(userId)) index.set(userId, new Map());
        const forUser = index.get(userId)!;
        forUser.set(hash, [...(forUser.get(hash) ?? []), j.id]);
    }

    let matched = 0;
    let ambiguous = 0;
    let unmatched = 0;
    const writes: Array<{ documentId: string; jobApplicationId: string }> = [];

    for (const doc of withHash) {
        const candidates = index.get(doc.userId)?.get(doc.jobDescriptionHash!) ?? [];
        if (candidates.length === 1) {
            matched++;
            writes.push({ documentId: doc.id, jobApplicationId: candidates[0] });
        } else if (candidates.length > 1) {
            ambiguous++;
        } else {
            unmatched++;
        }
    }

    console.log('');
    console.log(`  Match exactly one application:  ${matched}   <- these would be linked`);
    console.log(`  Match more than one:            ${ambiguous}   <- left alone, cannot pick safely`);
    console.log(`  Match none:                     ${unmatched}   <- the application was never saved`);

    if (!APPLY) {
        console.log('\nCount only. Re-run with --apply to write.');
        return;
    }

    let written = 0;
    for (const w of writes) {
        // updateMany with the null guard, not update: another process linking
        // this document between the read above and this write must win, because
        // it has more context than a backfill does.
        const { count } = await prisma.document.updateMany({
            where: { id: w.documentId, jobApplicationId: null },
            data: { jobApplicationId: w.jobApplicationId },
        });
        written += count;
    }
    console.log(`\nLinked ${written} document(s).`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
