// Manual live smoke test (hits Seek). Run: npx tsx scripts/test-html-scraper.ts
import { buildSeekClusterKey, fetchSeekJobsForCluster } from '../src/services/seekHtmlScraper';

async function main() {
  const key = buildSeekClusterKey('laboratory technician', 'sydney', null);
  console.log('cluster:', JSON.stringify(key));
  const jobs = await fetchSeekJobsForCluster(key, { maxResults: 8, dateRange: 7 });
  console.log(`\nFetched ${jobs.length} jobs:\n`);
  for (const [i, j] of jobs.entries()) {
    console.log(`${i + 1}. ${j.title}`);
    console.log(`   ${j.company} • ${j.location}`);
    console.log(`   ${j.sourceUrl}`);
    console.log(`   posted: ${j.postedAt?.toISOString() ?? 'unknown'}`);
    console.log(`   desc(${j.description.length}): ${j.description.slice(0, 100)}...`);
    console.log();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
