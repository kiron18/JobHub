/**
 * Manual visa-sponsor jobs scan. Runs WITHOUT booting the HTTP server.
 *   npx tsx src/scripts/run_sponsor_scan.ts                  # all queries
 *   npx tsx src/scripts/run_sponsor_scan.ts --only-query broad
 *
 * SKIP_SERVER is set BEFORE importing the service graph so that importing
 * index.ts (transitively, via seekScraper) does not call app.listen().
 */
process.env.SKIP_SERVER = 'true';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const i = args.indexOf('--only-query');
  const onlyQuery = i >= 0 ? args[i + 1] : undefined;

  const { runSponsorScan } = await import('../services/sponsorScan');
  const summary = await runSponsorScan({ onlyQuery });
  console.log('[run_sponsor_scan] summary:', JSON.stringify(summary, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('[run_sponsor_scan] FAILED:', err);
  process.exit(1);
});
