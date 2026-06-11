import { prisma } from '../../index';

/**
 * Backfill: create Contact records for existing CandidateProfiles that do not
 * yet have a contactId set.
 *
 * Runs on every boot so newly-registered profiles that were created while the
 * feature flag was off get linked automatically. The WHERE contactId IS NULL
 * guard makes it idempotent — profiles already linked are skipped.
 *
 * Trade-off: this is a full table scan on every boot for the first run only.
 * Once all profiles are linked the query returns instantly (zero rows). No
 * index needed because the cardinality of contactId IS NULL drops to zero
 * post-backfill and never grows (new profiles go through the normal signup
 * path which sets contactId at creation time).
 */
export async function linkCandidateProfiles(): Promise<void> {
  console.log('[linkCandidateProfiles] Starting backfill of Contact records for existing CandidateProfiles...');

  const profiles = await prisma.candidateProfile.findMany({
    where: { contactId: null },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  console.log(`[linkCandidateProfiles] Found ${profiles.length} CandidateProfiles without a Contact record`);

  let created = 0;
  let skipped = 0;

  for (const profile of profiles) {
    const email = profile.email;
    if (!email) {
      console.warn(`[linkCandidateProfiles] No email for profile ${profile.id} — skipping`);
      skipped++;
      continue;
    }

    // Upsert by email — if a Contact already exists for this email, link it.
    const contact = await prisma.contact.upsert({
      where: { email },
      update: {},
      create: {
        email,
        firstName: profile.name ?? null,
        lastName: null,
        source: 'profile_backfill',
        emailOptIn: true,
      },
    });

    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { contactId: contact.id },
    });

    created++;
  }

  console.log(`[linkCandidateProfiles] Done — ${created} Contact records created/linked, ${skipped} profiles skipped (no email)`);
}
