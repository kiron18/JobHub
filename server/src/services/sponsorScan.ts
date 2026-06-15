import { prisma } from '../index';
import type { RawJob } from './jobFeed';
import { buildSeekClusterKey, fetchSeekJobsForCluster } from './seekScraper';
import { buildSponsorIndex, classifyJob } from './sponsorClassifier';
import { ensureSponsorJobTable } from '../db/ensureSponsorJobTable';
import { POSITIVE_PHRASES, NEGATION_PHRASES } from '../config/sponsorPhrases';
import {
  SPONSOR_SCAN_QUERIES,
  SPONSOR_SCAN_LOCATION,
  SPONSOR_SCAN_MAX_RESULTS,
  SPONSOR_SCAN_DATE_RANGE,
} from '../config/sponsorScan';

export interface ScanSummary {
  ingested: number;
  deduped: number;
  confirmed: number;
  likely: number;
  keyword_only: number;
  excluded: number;
  none: number;
  stored: number;
}

function feedDateAU(): string {
  const s = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const [day, month, year] = s.split('/');
  return `${year}-${month}-${day}`;
}

export async function runSponsorScan(opts?: { onlyQuery?: string }): Promise<ScanSummary> {
  await ensureSponsorJobTable(prisma);

  // STOP guard: registry must be seeded (ensureSponsorsSeeded runs at app boot).
  const sponsors = await prisma.sponsor.findMany({ select: { cleanName: true } });
  if (sponsors.length < 1000) {
    throw new Error(
      `[sponsorScan] STOP: Sponsor table has ${sponsors.length} rows (<1000). ` +
      `Seed the sponsor registry (start the app once so ensureSponsorsSeeded runs) before scanning.`,
    );
  }
  const index = buildSponsorIndex(sponsors.map(s => s.cleanName));
  const phrases = { positive: POSITIVE_PHRASES, negation: NEGATION_PHRASES };

  const queries = SPONSOR_SCAN_QUERIES.filter(q => !opts?.onlyQuery || q.label === opts.onlyQuery);
  if (queries.length === 0) {
    throw new Error(`[sponsorScan] STOP: --only-query "${opts?.onlyQuery}" matched no SPONSOR_SCAN_QUERIES label.`);
  }

  // Ingest + dedupe across queries by sourceUrl (first query that surfaces a URL wins).
  const bySourceUrl = new Map<string, { job: RawJob; scanQuery: string }>();
  let ingested = 0;
  for (const q of queries) {
    const key = buildSeekClusterKey(q.searchTerm, SPONSOR_SCAN_LOCATION, null);
    const jobs = await fetchSeekJobsForCluster(key, {
      maxResults: SPONSOR_SCAN_MAX_RESULTS,
      dateRange: SPONSOR_SCAN_DATE_RANGE,
    });
    ingested += jobs.length;
    for (const job of jobs) {
      if (job.sourceUrl && !bySourceUrl.has(job.sourceUrl)) {
        bySourceUrl.set(job.sourceUrl, { job, scanQuery: q.searchTerm });
      }
    }
  }

  const summary: ScanSummary = {
    ingested, deduped: bySourceUrl.size,
    confirmed: 0, likely: 0, keyword_only: 0, excluded: 0, none: 0, stored: 0,
  };
  const feedDate = feedDateAU();

  for (const { job, scanQuery } of bySourceUrl.values()) {
    const c = classifyJob(job, index, phrases);
    summary[c.confidence] += 1;

    if (c.confidence === 'confirmed' || c.confidence === 'likely' || c.confidence === 'keyword_only') {
      await prisma.sponsorJob.upsert({
        where: { sourceUrl: job.sourceUrl },
        create: {
          sourceUrl: job.sourceUrl,
          title: job.title,
          company: job.company,
          normalizedCompany: c.normalizedCompany,
          location: job.location ?? null,
          salary: job.salary ?? null,
          description: job.description,
          sourcePlatform: job.sourcePlatform,
          postedAt: job.postedAt ?? null,
          confidence: c.confidence,
          employerMatched: c.employerMatched,
          sponsorCleanName: c.sponsorCleanName,
          positivePhraseHit: c.positivePhraseHit,
          negationPhraseHit: c.negationPhraseHit,
          matchedPhrases: c.matchedPhrases,
          scanQuery,
          feedDate,
        },
        update: {
          confidence: c.confidence,
          employerMatched: c.employerMatched,
          sponsorCleanName: c.sponsorCleanName,
          positivePhraseHit: c.positivePhraseHit,
          negationPhraseHit: c.negationPhraseHit,
          matchedPhrases: c.matchedPhrases,
          feedDate,
          // lastSeenAt auto-updates via @updatedAt
        },
      });
      summary.stored += 1;
    }
  }

  return summary;
}
