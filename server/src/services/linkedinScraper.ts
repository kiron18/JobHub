import { createHash } from 'crypto';
import { ApifyClient } from 'apify-client';
import { prisma } from '../index';
import type { RawJob } from './jobFeed';

const LINKEDIN_ACTOR_ID = 'bebity/linkedin-jobs-scraper';

export interface LinkedInClusterKey {
  role: string;
  city: string;
  industry: string;
  hash: string;
}

function todayFeedDate(): string {
  const s = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const [day, month, year] = s.split('/');
  return `${year}-${month}-${day}`;
}

export function buildLinkedInClusterKey(
  targetRole: string,
  targetCity: string,
  industry: string | null
): LinkedInClusterKey {
  const role = targetRole.trim();
  const city = targetCity.trim().split(',')[0].trim().toLowerCase();
  const ind = (industry ?? '').trim().toLowerCase();
  const raw = `linkedin|${role.toLowerCase()}|${city}|${ind}`;
  return {
    role,
    city,
    industry: industry ?? '',
    hash: createHash('sha256').update(raw).digest('hex'),
  };
}

function mapLinkedInResult(item: any, city: string): RawJob | null {
  const sourceUrl =
    item.jobUrl ?? item.url ?? item.link ?? item.applyUrl ?? item.externalApplyLink ?? '';
  if (!sourceUrl) return null;

  const description =
    item.description ?? item.jobDescription ?? item.descriptionText ?? item.content ?? '';

  return {
    title: item.title ?? item.jobTitle ?? item.position ?? 'Untitled',
    company: item.companyName ?? item.company ?? item.employer ?? 'Unknown Company',
    location: item.location ?? item.jobLocation ?? item.place ?? city,
    salary: item.salary ?? item.salaryRange ?? null,
    description: typeof description === 'string' ? description : '',
    sourceUrl,
    sourcePlatform: 'linkedin',
    postedAt:
      item.publishedAt ?? item.postedAt ?? item.datePosted ?? item.listedAt
        ? new Date(item.publishedAt ?? item.postedAt ?? item.datePosted ?? item.listedAt)
        : null,
  };
}

export async function fetchLinkedInJobsForCluster(cluster: LinkedInClusterKey): Promise<RawJob[]> {
  const feedDate = todayFeedDate();

  const cached = await prisma.seekJobCache.findUnique({
    where: { queryHash_feedDate: { queryHash: cluster.hash, feedDate } },
  });

  if (cached) {
    const items = cached.results as any[];
    return items.flatMap(r => {
      const mapped = mapLinkedInResult(r, cluster.city);
      return mapped ? [mapped] : [];
    });
  }

  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    console.warn('[linkedinScraper] APIFY_API_KEY not set — skipping LinkedIn scrape');
    return [];
  }

  const client = new ApifyClient({ token: apiKey });

  let items: any[] = [];
  try {
    const run = await client.actor(LINKEDIN_ACTOR_ID).call(
      {
        title: `${cluster.role} ${cluster.city}`,
        rows: 50,
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL'],
        },
      },
      { waitSecs: 180 }
    );
    const dataset = await client.dataset(run.defaultDatasetId).listItems();
    items = dataset.items;
  } catch (err: any) {
    console.error(`[linkedinScraper] Apify call failed for cluster ${cluster.hash}:`, err.message);
    return [];
  }

  try {
    await prisma.seekJobCache.create({
      data: {
        queryHash: cluster.hash,
        queryMeta: { source: 'linkedin', role: cluster.role, city: cluster.city, industry: cluster.industry },
        feedDate,
        results: items,
        resultCount: items.length,
      },
    });
  } catch (cacheErr: any) {
    console.warn('[linkedinScraper] Cache write failed (non-fatal):', cacheErr.message);
  }

  return items.flatMap(r => {
    const mapped = mapLinkedInResult(r, cluster.city);
    return mapped ? [mapped] : [];
  });
}

export async function prewarmLinkedInClusters(
  users: { userId: string; targetRole: string; targetCity: string; industry: string | null }[]
): Promise<void> {
  const seen = new Map<string, LinkedInClusterKey>();
  for (const u of users) {
    const key = buildLinkedInClusterKey(u.targetRole, u.targetCity, u.industry);
    if (!seen.has(key.hash)) seen.set(key.hash, key);
  }

  const clusters = Array.from(seen.values());
  console.log(`[linkedinScraper] Prewarming ${clusters.length} LinkedIn cluster(s)`);

  await Promise.allSettled(
    clusters.map(c =>
      fetchLinkedInJobsForCluster(c)
        .then(jobs => console.log(`[linkedinScraper] ✓ ${c.role}/${c.city} → ${jobs.length} jobs`))
        .catch(err => console.error(`[linkedinScraper] ✗ ${c.role}/${c.city}:`, err.message))
    )
  );
}
