/**
 * Generate a recovery link for local end-to-end testing of the set-password
 * flow. Prints a ready-to-click localhost URL using the token_hash flow, so it
 * does not depend on Supabase's redirect allowlist.
 *
 *   SKIP_SERVER=true npx tsx src/scripts/gen_recovery_link.ts [email] [baseUrl]
 */
import { supabase } from '../lib/supabase';

async function main() {
  const email = (process.argv[2] ?? 'kiron182+onboardtest@gmail.com').toLowerCase().trim();
  const baseUrl = process.argv[3] ?? 'http://localhost:5173';

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${baseUrl}/set-password` },
  });
  if (error || !data?.properties) {
    console.error('generateLink failed:', error?.message ?? 'no properties');
    process.exit(1);
  }

  const { hashed_token, action_link } = data.properties;
  const localUrl = `${baseUrl}/set-password?token_hash=${hashed_token}&type=recovery`;

  console.log('\n=== LOCAL TEST LINK (token_hash flow, click this) ===');
  console.log(localUrl);
  console.log('\n=== Supabase action_link (hash-fragment flow, needs localhost allowlisted) ===');
  console.log(action_link);
  console.log('');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
