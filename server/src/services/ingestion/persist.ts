import { prisma } from '../../db';
import type { MergedJob } from './mergeSources';
import type { SourceReport, IngestionSource } from './types';
import { locationKey } from './locationKey';

function today(): string { return new Date().toISOString().slice(0, 10); }

export async function persistMergedJobs(args: {
  merged: MergedJob[];
  reports: SourceReport[];
  trigger: 'user_scan' | 'manual' | 'cron';
  role: string;
  location: string;
}): Promise<{ runId: string; newJobs: number; dupJobs: number }> {
  const run = await prisma.ingestionRun.create({ data: { trigger: args.trigger } });
  const feedDate = today();
  const perSourceNew: Record<string, number> = {};

  // Use the search location key for cache consistency, not the job's extracted location
  const searchLocationKey = locationKey(args.location);

  // New-vs-dup counting in a single query instead of one findUnique per job.
  const existingRows = await prisma.job.findMany({
    where: { dedupKey: { in: args.merged.map(m => m.dedupKey) } },
    select: { dedupKey: true },
  });
  const existingKeys = new Set(existingRows.map(r => r.dedupKey));
  const newJobs = args.merged.filter(m => !existingKeys.has(m.dedupKey)).length;
  const dupJobs = args.merged.length - newJobs;

  // Upsert every job in parallel rather than serially. The old per-row await loop
  // meant ~60-120 sequential round-trips to Supabase and was the dominant cost of
  // the whole feed build (seen as 78-153s "Persisted" times in prod). merged is
  // already deduped by dedupKey, so parallel upserts never collide.
  const jobs = await Promise.all(args.merged.map(m =>
    prisma.job.upsert({
      where: { dedupKey: m.dedupKey },
      create: {
        dedupKey: m.dedupKey, title: m.title, company: m.company, normalizedCompany: m.normalizedCompany,
        location: m.location, locationKey: searchLocationKey, salary: m.salary, description: m.description,
        descriptionHydrated: m.descriptionHydrated, postedAt: m.postedAt, relevanceScore: m.relevanceScore,
        lowRelevance: m.lowRelevance, searchRole: m.searchRole, feedDate,
      },
      update: { relevanceScore: m.relevanceScore, lowRelevance: m.lowRelevance, feedDate, locationKey: searchLocationKey },
    })
  ));

  // Build the source upserts (and tally per-source new counts) off the resolved
  // job ids, then run them in parallel too.
  const sourceUpserts = args.merged.flatMap((m, i) => {
    const isNew = !existingKeys.has(m.dedupKey);
    return m.sources.map(s => {
      if (isNew) perSourceNew[s.source] = (perSourceNew[s.source] ?? 0) + 1;
      return prisma.jobSource.upsert({
        where: { source_sourceUrl: { source: s.source, sourceUrl: s.sourceUrl } },
        create: { jobId: jobs[i].id, source: s.source, sourceUrl: s.sourceUrl, sourceJobId: s.sourceJobId },
        update: { jobId: jobs[i].id },
      });
    });
  });
  await Promise.all(sourceUpserts);

  await Promise.all(args.reports.map(r => {
    const unique = uniqueContribution(args.merged, r.source);
    return prisma.sourceResult.create({
      data: {
        runId: run.id, source: r.source, query: `${args.role} @ ${args.location}`,
        status: r.errorMessage ? 'error' : r.blocked ? 'blocked' : 'ok',
        rawCount: r.rawCount, newCount: perSourceNew[r.source] ?? 0, dupCount: 0,
        uniqueCount: unique, blocked: r.blocked, errorMessage: r.errorMessage,
        latencyMs: r.latencyMs, creditsUsed: r.creditsUsed,
      },
    });
  }));

  await prisma.ingestionRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), totalRaw: args.reports.reduce((a, b) => a + b.rawCount, 0),
            totalNew: newJobs, totalDup: dupJobs },
  });
  return { runId: run.id, newJobs, dupJobs };
}

function uniqueContribution(merged: MergedJob[], source: IngestionSource): number {
  return merged.filter(m => m.sources.length === 1 && m.sources[0].source === source).length;
}
