/**
 * Run the Stripe payment reconciliation by hand.
 *
 * The same sweep runs daily at 11:00 UTC (see cron/paymentReconcileCron.ts).
 * This is for checking it, or for catching up immediately after a webhook
 * outage rather than waiting for the next run.
 *
 *   npx tsx -r dotenv/config scripts/reconcile-stripe-payments.ts                    (dry run)
 *   npx tsx -r dotenv/config scripts/reconcile-stripe-payments.ts --write
 *   npx tsx -r dotenv/config scripts/reconcile-stripe-payments.ts --write --onboard  (also create logins)
 */
// Must be set before anything pulls in ../src/index, which boots the HTTP
// server on import. ESM hoists static imports above assignments, so the
// service is loaded dynamically inside main() — a plain import here would run
// too late and start a second server on the dev port.
process.env.SKIP_SERVER = 'true';

async function main() {
  const { reconcileStripePayments } = await import('../src/services/paymentReconcile');

  const write = process.argv.includes('--write');
  const autoOnboard = process.argv.includes('--onboard');

  console.log(write ? '=== WRITING ===' : '=== DRY RUN (pass --write to apply) ===');
  if (autoOnboard) console.log('autoOnboard ON — payers with no account will get a login and a set-password email');
  console.log('');

  const r = await reconcileStripePayments({ write, autoOnboard });

  console.log(`Payers found in Stripe: ${r.scanned}`);
  console.log(`\nWould grant / granted (${r.granted.length}):`);
  for (const g of r.granted) console.log(`  ${g.email.padEnd(34)} -> ${g.plan.padEnd(12)} ${g.reason}`);
  if (!r.granted.length) console.log('  none — every payer is already marked correctly');

  if (r.onboarded.length) {
    console.log(`\nOnboarded (${r.onboarded.length}):`);
    for (const e of r.onboarded) console.log('  ', e);
  }
  if (r.unmatched.length) {
    console.log(`\nPaid but no JobHub account (${r.unmatched.length}):`);
    for (const e of r.unmatched) console.log('  ', e);
  }
  if (r.errors.length) {
    console.log(`\nErrors (${r.errors.length}):`);
    for (const e of r.errors) console.log('  ', e);
  }
  console.log(write ? '\nDone.' : '\nNothing written.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
