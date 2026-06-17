import type { MergedJob, MergedJobSource } from './mergeSources';

export function jobRowToMergedJob(row: any): MergedJob {
  return {
    dedupKey: row.dedupKey,
    title: row.title,
    company: row.company,
    normalizedCompany: row.normalizedCompany,
    location: row.location ?? null,
    locationKey: row.locationKey ?? null,
    salary: row.salary ?? null,
    description: row.description,
    descriptionHydrated: row.descriptionHydrated,
    postedAt: row.postedAt ?? null,
    relevanceScore: row.relevanceScore,
    lowRelevance: row.lowRelevance,
    searchRole: row.searchRole,
    sources: (row.sources ?? []).map((s: any): MergedJobSource => ({
      source: s.source,
      sourceUrl: s.sourceUrl,
      sourceJobId: s.sourceJobId ?? null,
    })),
  };
}
