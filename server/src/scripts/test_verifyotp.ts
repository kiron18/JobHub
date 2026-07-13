/**
 * Reproduce the browser's token_hash exchange to confirm the set-password
 * mechanism works against this Supabase project. Uses the ANON key + verifyOtp,
 * exactly like SetPasswordPage does. NOTE: consumes the token it generates.
 *
 *   SKIP_SERVER=true npx tsx src/scripts/test_verifyotp.ts [email]
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// server/.env has SUPABASE_URL + service role; the anon key lives in the repo-root .env
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

async function main() {
  const email = (process.argv[2] ?? 'kiron182+onboardtest@gmail.com').toLowerCase().trim();

  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const anon = createClient(process.env.SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

  console.log(`ANON key present: ${!!process.env.VITE_SUPABASE_ANON_KEY}`);

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: 'http://localhost:5173/set-password' },
  });
  if (linkErr || !linkData?.properties) {
    console.error('generateLink failed:', linkErr?.message);
    process.exit(1);
  }
  const tokenHash = linkData.properties.hashed_token;
  console.log(`Got hashed_token: ${tokenHash.slice(0, 12)}…`);

  const { data, error } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
  if (error) {
    console.error('\n❌ verifyOtp FAILED:', error.status, error.message);
    process.exit(1);
  }
  console.log('\n✅ verifyOtp OK — session established:');
  console.log(`   user: ${data.user?.email}`);
  console.log(`   has access_token: ${!!data.session?.access_token}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
