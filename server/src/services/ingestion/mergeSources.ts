import type { RawJob } from '../jobFeed';
import type { IngestionSource } from './types';
import { normalise, isSimilar } from '../../utils/deduplicateJobs';
import { locationKey } from './locationKey';
import { relevanceScore } from './relevance';
import { RELEVANCE_THRESHOLD } from '../../config/ingestion';

export interface MergedJobSource {
  source: IngestionSource;
  sourceUrl: string;
  sourceJobId: string | null;
}

export interface MergedJob {
  dedupKey: string;
  title: string;
  company: string;
  normalizedCompany: string;
  location: string;
  locationKey: string | null;
  salary: string | null;
  description: string;
  descriptionHydrated: boolean;
  postedAt: Date | null;
  relevanceScore: number;
  lowRelevance: boolean;
  searchRole: string;
  sources: MergedJobSource[];
}

function sig(j: RawJob): string {
  return normalise(`${j.title} ${j.company} ${j.location ?? ''}`);
}
function dedupKey(j: RawJob): string {
  return `${normalise(j.company)}|${normalise(j.title)}|${locationKey(j.location)}`;
}
function jobId(url: string): string | null {
  const m = url.match(/(\d{5,})/);
  return m ? m[1] : null;
}

export function mergeSources(
  input: Array<{ source: IngestionSource; jobs: RawJob[] }>,
  role: string,
): MergedJob[] {
  const merged: MergedJob[] = [];

  for (const { source, jobs } of input) {
    for (const job of jobs) {
      const existing = merged.find(m =>
        m.sources.some(s => s.sourceUrl === job.sourceUrl) ||
        isSimilar(sig(job), normalise(`${m.title} ${m.company} ${m.location ?? ''}`)),
      );
      if (existing) {
        if (!existing.sources.some(s => s.sourceUrl === job.sourceUrl)) {
          existing.sources.push({ source, sourceUrl: job.sourceUrl, sourceJobId: jobId(job.sourceUrl) });
        }
        if (!existing.descriptionHydrated && source !== 'seek') {
          existing.description = job.description;
          existing.descriptionHydrated = true;
        }
        continue;
      }
      const score = relevanceScore(job.title, role);
      merged.push({
        dedupKey: dedupKey(job),
        title: job.title,
        company: job.company,
        normalizedCompany: normalise(job.company),
        location: job.location,
        locationKey: locationKey(job.location),
        salary: job.salary,
        description: job.description,
        descriptionHydrated: source !== 'seek',
        postedAt: job.postedAt,
        relevanceScore: score,
        lowRelevance: score < RELEVANCE_THRESHOLD,
        searchRole: role,
        sources: [{ source, sourceUrl: job.sourceUrl, sourceJobId: jobId(job.sourceUrl) }],
      });
    }
  }
  return merged;
}
