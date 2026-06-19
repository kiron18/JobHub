import type { MergedJob } from './mergeSources';
import { mergeSources } from './mergeSources';
import { persistMergedJobs } from './persist';
import { seekAdapter } from './adapters/seek';
import { adzunaAdapter } from './adapters/adzuna';
import { jsearchAdapter } from './adapters/jsearch';
import { indeedAdapter } from './adapters/indeed';
import { joraAdapter } from './adapters/jora';
import { linkedinAdapter } from './adapters/linkedin';
import type { SourceAdapter, SourceReport, IngestionSource } from './types';
import { INGESTION_SOURCES, MAX_PAGES_PER_SOURCE, CACHE_MIN_HITS } from '../../config/ingestion';
import { prisma } from '../../db';
import { jobRowToMergedJob } from './cache';
import { locationKey } from './locationKey';

const ALL: SourceAdapter[] = [adzunaAdapter, jsearchAdapter, seekAdapter, indeedAdapter, joraAdapter, linkedinAdapter];

function todayStr(): string { return new Date().toISOString().slice(0, 10); }

// Request coalescing: track in-flight scrapes so concurrent requests for the same
// (role, location, day) share the same promise instead of duplicating work.
const inFlightScrapes = new Map<string, Promise<{ jobs: MergedJob[]; reports: SourceReport[] }>>();

function makeScrapeKey(role: string, location: string, date: string): string {
  return `${role}|${location}|${date}`;
}

export async function runIngestionForTitle(
  role: string, location: string, trigger: 'user_scan' | 'manual' | 'cron',
): Promise<{ jobs: MergedJob[]; reports: SourceReport[] }> {
  const startMs = Date.now();
  const logPrefix = `[Ingestion] "${role}" @ "${location}"`;

  // Cache read: check if we already have jobs for this (role, city, day)
  const cacheStart = Date.now();
  const locKey = locationKey(location);
  const today = todayStr();

  console.log(`${logPrefix} - Checking cache: searchRole="${role}" locationKey="${locKey}" feedDate="${today}"`);

  const cached = await prisma.job.findMany({
    where: { searchRole: role, locationKey: locKey, feedDate: today },
    include: { sources: true },
  });

  console.log(`${logPrefix} - Cache found ${cached.length} jobs (min hits: ${CACHE_MIN_HITS})`);

  if (cached.length >= CACHE_MIN_HITS) {
    const jobs = cached.map(jobRowToMergedJob);
    console.log(`${logPrefix} - CACHE HIT - returned ${jobs.length} jobs in ${Date.now() - startMs}ms`);
    return {
      jobs,
      reports: [{
        source: 'cache' as IngestionSource,
        rawCount: jobs.length,
        blocked: false,
        errorMessage: null,
        latencyMs: 0,
        creditsUsed: 0,
      }],
    };
  }

  console.log(`${logPrefix} - CACHE MISS - scraping fresh...`);

  const scrapeKey = makeScrapeKey(role, locKey, today);
  const existing = inFlightScrapes.get(scrapeKey);
  if (existing) {
    console.log(`${logPrefix} - JOINING in-flight scrape for same key`);
    return existing;
  }

  // Create the scrape promise and register it for coalescing
  const scrapePromise = doScrape(role, location, locKey, today, trigger, logPrefix, startMs);
  inFlightScrapes.set(scrapeKey, scrapePromise);

  // Clean up the in-flight entry when done (success or failure)
  scrapePromise
    .then(() => console.log(`${logPrefix} - In-flight scrape completed, key cleared`))
    .catch(() => console.log(`${logPrefix} - In-flight scrape failed, key cleared`))
    .finally(() => inFlightScrapes.delete(scrapeKey));

  return scrapePromise;
}

async function doScrape(
  role: string,
  location: string,
  locKey: string,
  today: string,
  trigger: 'user_scan' | 'manual' | 'cron',
  logPrefix: string,
  startMs: number,
): Promise<{ jobs: MergedJob[]; reports: SourceReport[] }> {
  const adapters = ALL.filter(a => INGESTION_SOURCES[a.source as IngestionSource]);
  console.log(`${logPrefix} - Enabled adapters: ${adapters.map(a => a.source).join(', ')}`);

  const scrapeStart = Date.now();
  const results = await Promise.all(
    adapters.map(a => a.search({ role, location, maxPages: MAX_PAGES_PER_SOURCE })
      .catch((e): { jobs: []; report: SourceReport } => ({
        jobs: [], report: { source: a.source, rawCount: 0, blocked: false,
          errorMessage: e?.message ?? 'adapter error', latencyMs: 0, creditsUsed: 0 } }))),
  );
  console.log(`${logPrefix} - Scraped in ${Date.now() - scrapeStart}ms`);

  const mergeStart = Date.now();
  const merged = mergeSources(results.map(r => ({ source: (r as any).report.source, jobs: r.jobs })), role);
  const reports = results.map(r => r.report);
  console.log(`${logPrefix} - Merged ${merged.length} jobs in ${Date.now() - mergeStart}ms`);

  const persistStart = Date.now();
  await persistMergedJobs({ merged, reports, trigger, role, location });
  console.log(`${logPrefix} - Persisted in ${Date.now() - persistStart}ms`);

  console.log(`${logPrefix} - TOTAL: ${Date.now() - startMs}ms, returned ${merged.length} jobs`);
  return { jobs: merged, reports };
}
