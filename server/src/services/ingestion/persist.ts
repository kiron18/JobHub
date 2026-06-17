import { prisma } from '../../db';
import type { MergedJob } from './mergeSources';
import type { SourceReport, IngestionSource } from './types';

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
  let newJobs = 0, dupJobs = 0;
  const perSourceNew: Record<string, number> = {};

  for (const m of args.merged) {
    const existing = await prisma.job.findUnique({ where: { dedupKey: m.dedupKey } });
    if (existing) dupJobs++; else newJobs++;
    const job = await prisma.job.upsert({
      where: { dedupKey: m.dedupKey },
      create: {
        dedupKey: m.dedupKey, title: m.title, company: m.company, normalizedCompany: m.normalizedCompany,
        location: m.location, salary: m.salary, description: m.description,
        descriptionHydrated: m.descriptionHydrated, postedAt: m.postedAt, relevanceScore: m.relevanceScore,
        lowRelevance: m.lowRelevance, searchRole: m.searchRole, feedDate,
      },
      update: { relevanceScore: m.relevanceScore, lowRelevance: m.lowRelevance, feedDate },
    });
    for (const s of m.sources) {
      if (!existing) perSourceNew[s.source] = (perSourceNew[s.source] ?? 0) + 1;
      await prisma.jobSource.upsert({
        where: { source_sourceUrl: { source: s.source, sourceUrl: s.sourceUrl } },
        create: { jobId: job.id, source: s.source, sourceUrl: s.sourceUrl, sourceJobId: s.sourceJobId },
        update: { jobId: job.id },
      });
    }
  }

  for (const r of args.reports) {
    const unique = uniqueContribution(args.merged, r.source);
    await prisma.sourceResult.create({
      data: {
        runId: run.id, source: r.source, query: `${args.role} @ ${args.location}`,
        status: r.errorMessage ? 'error' : r.blocked ? 'blocked' : 'ok',
        rawCount: r.rawCount, newCount: perSourceNew[r.source] ?? 0, dupCount: 0,
        uniqueCount: unique, blocked: r.blocked, errorMessage: r.errorMessage,
        latencyMs: r.latencyMs, creditsUsed: r.creditsUsed,
      },
    });
  }

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
