/**
 * One-off backfill: fix names stored in block capitals.
 *
 * Resume headers are usually typeset in capitals and the intake extractor
 * stored what it read, so profiles hold names like "KIRON KURIAN JOHN". Those
 * names go out in email signatures and export filenames, so they are worth
 * correcting at rest rather than only papering over at render time.
 *
 * Writing at intake is fixed separately in lib/personName.ts. This is for the
 * rows written before that existed.
 *
 * Dry run by default. Nothing is written unless --apply is passed, and the
 * before/after of every row it touches is written to a JSON file first so the
 * change can be undone.
 *
 *   npx tsx src/scripts/normalise_profile_names.ts
 *   npx tsx src/scripts/normalise_profile_names.ts --apply
 */
import { writeFileSync } from 'node:fs';
import { prisma } from '../db';
import { normalisePersonName } from '../lib/personName';

async function main() {
    const apply = process.argv.includes('--apply');

    const profiles = await prisma.candidateProfile.findMany({
        where: { name: { not: null } },
        select: { id: true, name: true, email: true },
    });

    const changes = profiles
        .map((p) => ({ ...p, next: normalisePersonName(p.name) }))
        .filter((p) => p.next && p.next !== p.name);

    console.log(`${profiles.length} profiles with a name, ${changes.length} in block capitals.\n`);
    for (const c of changes) {
        console.log(`  ${c.email ?? '(no email)'}\n    "${c.name}"  ->  "${c.next}"`);
    }

    if (changes.length === 0) return;

    if (!apply) {
        console.log('\nDry run. Nothing written. Re-run with --apply to make these changes.');
        return;
    }

    const backupPath = `name-backup-${Date.now()}.json`;
    writeFileSync(backupPath, JSON.stringify(changes.map((c) => ({ id: c.id, name: c.name })), null, 2));
    console.log(`\nOriginals saved to ${backupPath}`);

    for (const c of changes) {
        await prisma.candidateProfile.update({ where: { id: c.id }, data: { name: c.next } });
    }
    console.log(`Updated ${changes.length} profiles.`);
}

main()
    .catch((err) => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
