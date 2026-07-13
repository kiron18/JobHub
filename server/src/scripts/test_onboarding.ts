/**
 * Manual test for the post-payment onboarding path.
 *
 * Runs the REAL onboardPaidCustomer against the configured environment, so it
 * creates a genuine Supabase login, a CandidateProfile row, and sends a real
 * set-password email. Use a safe address you control.
 *
 * Usage (run from server/, script mode so the HTTP server/crons stay off):
 *   SKIP_SERVER=true npx tsx src/scripts/test_onboarding.ts [email]
 *
 * Default email: kiron182+onboardtest@gmail.com
 */
import { onboardPaidCustomer } from '../services/onboarding';
import { prisma } from '../index';
import { supabase } from '../lib/supabase';

async function main() {
  const email = (process.argv[2] ?? 'kiron182+onboardtest@gmail.com').toLowerCase().trim();

  console.log('──────────────────────────────────────────────');
  console.log(`Onboarding test for: ${email}`);
  console.log(`Supabase project:    ${process.env.SUPABASE_URL}`);
  console.log('──────────────────────────────────────────────');

  const result = await onboardPaidCustomer({ email });
  console.log('\nonboardPaidCustomer() returned:');
  console.log(`  userId:          ${result.userId}`);
  console.log(`  createdAuthUser: ${result.createdAuthUser}`);
  console.log(`  emailSent:       ${result.emailSent}`);

  const profile = await prisma.candidateProfile.findFirst({
    where: { email },
    select: {
      id: true, userId: true, email: true, plan: true, planStatus: true,
      dashboardAccess: true, createdAt: true,
    },
  });
  console.log('\nCandidateProfile row now in the DB:');
  console.log(profile ? JSON.stringify(profile, null, 2) : '  (none found — something went wrong)');

  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const authUser = data?.users.find((u) => (u.email ?? '').toLowerCase() === email);
  console.log('\nSupabase auth user:');
  console.log(authUser
    ? `  id=${authUser.id}  email_confirmed_at=${authUser.email_confirmed_at ?? 'null'}  created_at=${authUser.created_at}`
    : '  (none found — something went wrong)');

  console.log('\nDone.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('\ntest_onboarding failed:', err); process.exit(1); });
