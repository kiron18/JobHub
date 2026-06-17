import { prisma } from '../../db';
import { firecrawlScrape } from './firecrawl';

export async function hydrateJobDescription(jobId: string): Promise<{ hydrated: boolean }> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.descriptionHydrated) return { hydrated: false };
  const src = await prisma.jobSource.findFirst({ where: { jobId, source: 'seek' } });
  if (!src) return { hydrated: false };
  const { markdown, blocked } = await firecrawlScrape(src.sourceUrl);
  if (blocked || !markdown) return { hydrated: false };
  await prisma.job.update({ where: { id: jobId }, data: { description: markdown, descriptionHydrated: true } });
  return { hydrated: true };
}
