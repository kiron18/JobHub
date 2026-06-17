import { runIngestionForTitle } from '../services/ingestion/runIngestion';

async function main() {
  const role = process.argv[2] ?? 'Registered Nurse';
  const location = process.argv[3] ?? 'Sydney NSW';
  const { jobs, reports } = await runIngestionForTitle(role, location, 'manual');
  console.log(JSON.stringify({
    role, location,
    totalMerged: jobs.length,
    lowRelevance: jobs.filter(j => j.lowRelevance).length,
    perSource: reports.map(r => ({ source: r.source, raw: r.rawCount, blocked: r.blocked, error: r.errorMessage, credits: r.creditsUsed })),
  }, null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
