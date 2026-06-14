/**
 * RE-EXPORT SHIM: all Seek scraping now lives in seekHtmlScraper.ts (direct HTML
 * fetch via axios + cheerio). This file preserves the old public API so callers
 * (jobFeed, sponsorScan, userJobScrape, jobFeedCron) and their tests need zero
 * import changes. The old Apify implementation has been removed.
 *
 * Follow-up (optional, after ~1 week stable): delete this file, rename
 * seekHtmlScraper.ts to seekScraper.ts, update the 4 import sites, and remove
 * apify-client + APIFY_API_KEY.
 */
export {
  fetchSeekJobsForCluster,
  prewarmSeekClusters,
  buildSeekClusterKey,
  buildEntryLevelSearchTerm,
  ENTRY_LEVEL_QUALIFIERS,
  buildSeekSearchUrl,
  stripEntryLevelQualifiers,
} from './seekHtmlScraper';
export type { SeekHtmlClusterKey as ClusterKey } from './seekHtmlScraper';
