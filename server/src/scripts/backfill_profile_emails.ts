/**
 * Fill in CandidateProfile.email from the Supabase login it belongs to.
 *
 * Why: profiles get created before the email is captured, so most rows carry
 * email = null. Everything that matches a human by email — the Stripe
 * reconciliation sweep above all — silently treats those people as having no
 * account. That is what produced the "PAID BUT UNMATCHED" alerts for customers
 * who did in fact have profiles.
 *
 * CandidateProfile.email is @unique, so this refuses to write when the address
 * is already held by a different profile row and reports the clash instead of
 * guessing which row wins.
 *
 * Usage (run from server/):
 *   npx tsx src/scripts/backfill_profile_emails.ts            # dry run
 *   npx tsx src/scripts/backfill_profile_emails.ts --write
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import { PrismaClient } from '@prisma/client';
import { supabase } from '../lib/supabase';

const prisma = new PrismaClient();

async function main() {
  const write = process.argv.includes('--write');
  console.log(write ? '=== WRITING ===' : '=== DRY RUN (pass --write to apply) ===\n');

  const blanks = await prisma.candidateProfile.findMany({
    where: { OR: [{ email: null }, { email: '' }] },
    select: { id: true, userId: true, name: true, plan: true, planStatus: true },
  });
  console.log(`profiles with no email: ${blanks.length}`);

  // One listUsers call beats N getUserById round-trips.
  const authEmail = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) {
      const e = (u.email ?? '').toLowerCase().trim();
      if (e) authEmail.set(u.id, e);
    }
    if (data.users.length < 1000) break;
  }
  console.log(`supabase logins with an email: ${authEmail.size}\n`);

  let filled = 0, noLogin = 0, clash = 0;

  for (const p of blanks) {
    const email = authEmail.get(p.userId);
    if (!email) {
      noLogin++;
      continue;
    }

    const holder = await prisma.candidateProfile.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, NOT: { id: p.id } },
      select: { id: true, plan: true, planStatus: true },
    });
    if (holder) {
      clash++;
      console.log(`CLASH  ${email}`);
      console.log(`         this row ${p.id} (plan=${p.plan}/${p.planStatus}) vs existing ${holder.id} (plan=${holder.plan}/${holder.planStatus}) — skipped`);
      continue;
    }

    filled++;
    console.log(`FILL   ${email}  <- profile ${p.id} (${p.name ?? 'no name'}, plan=${p.plan})`);
    if (write) {
      await prisma.candidateProfile.update({ where: { id: p.id }, data: { email } });
    }
  }

  console.log(`\n--- SUMMARY ---`);
  console.log(`filled            : ${filled}${write ? '' : ' (dry run — nothing written)'}`);
  console.log(`no matching login : ${noLogin}  (orphan profile rows, nothing to fill from)`);
  console.log(`unique clashes    : ${clash}  (two profiles, one address — resolve by hand)`);
}

main()
  .catch((err) => {
    console.error('backfill failed:', err?.message ?? err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
