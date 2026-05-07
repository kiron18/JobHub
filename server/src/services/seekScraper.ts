import { createHash } from 'crypto';
import { ApifyClient } from 'apify-client';
import { prisma } from '../index';
import type { RawJob } from './jobFeed';

const SEEK_ACTOR_ID = 'websift/seek-job-scraper';

export interface ClusterKey {
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

export function buildSeekClusterKey(
  targetRole: string,
  targetCity: string,
  industry: string | null
): ClusterKey {
  const role = targetRole.trim();
  const city = targetCity.trim().split(',')[0].trim().toLowerCase();
  const ind = (industry ?? '').trim().toLowerCase();
  const raw = `seek|${role.toLowerCase()}|${city}|${ind}`;
  return {
    role,
    city,
    industry: industry ?? '',
    hash: createHash('sha256').update(raw).digest('hex'),
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ').trim();
}

function mapSeekResult(item: any, city: string): RawJob | null {
  const sourceUrl = item.jobLink ?? item.applyLink ?? '';
  if (!sourceUrl) return null;

  const rawDescription = item.content?.unEditedContent
    ? stripHtml(item.content.unEditedContent)
    : Array.isArray(item.content?.sections)
    ? item.content.sections.join('\n')
    : '';

  return {
    title: item.title ?? 'Untitled',
    company: item.advertiser?.name ?? item.company ?? 'Unknown Company',
    location: item.joblocationInfo?.displayLocation ?? item.joblocationInfo?.location ?? city,
    salary: item.salary ?? null,
    description: rawDescription,
    sourceUrl,
    sourcePlatform: 'seek',
    postedAt: item.listedAt ? new Date(item.listedAt) : null,
  };
}

export async function fetchSeekJobsForCluster(cluster: ClusterKey): Promise<RawJob[]> {
  const feedDate = todayFeedDate();

  const cached = await prisma.seekJobCache.findUnique({
    where: { queryHash_feedDate: { queryHash: cluster.hash, feedDate } },
  });

  if (cached) {
    const items = cached.results as any[];
    return items.flatMap(r => {
      const mapped = mapSeekResult(r, cluster.city);
      return mapped ? [mapped] : [];
    });
  }

  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    console.warn('[seekScraper] APIFY_API_KEY not set — skipping Seek scrape');
    return [];
  }

  const client = new ApifyClient({ token: apiKey });

  let items: any[] = [];
  try {
    const run = await client.actor(SEEK_ACTOR_ID).call(
      {
        searchTerm: cluster.role,
        location: cluster.city,
        maxResults: 30,
        sortBy: 'date',
        dateRange: 7,
      },
      { waitSecs: 180 }
    );
    const dataset = await client.dataset(run.defaultDatasetId).listItems();
    items = dataset.items;
  } catch (err: any) {
    console.error(`[seekScraper] Apify call failed for cluster ${cluster.hash}:`, err.message);
    return [];
  }

  try {
    await prisma.seekJobCache.create({
      data: {
        queryHash: cluster.hash,
        queryMeta: { source: 'seek', role: cluster.role, city: cluster.city, industry: cluster.industry },
        feedDate,
        results: items,
        resultCount: items.length,
      },
    });
  } catch (cacheErr: any) {
    console.warn('[seekScraper] Cache write failed (non-fatal):', cacheErr.message);
  }

  return items.flatMap(r => {
    const mapped = mapSeekResult(r, cluster.city);
    return mapped ? [mapped] : [];
  });
}

export async function prewarmSeekClusters(
  users: { userId: string; targetRole: string; targetCity: string; industry: string | null }[]
): Promise<void> {
  const seen = new Map<string, ClusterKey>();
  for (const u of users) {
    const key = buildSeekClusterKey(u.targetRole, u.targetCity, u.industry);
    if (!seen.has(key.hash)) seen.set(key.hash, key);
  }

  const clusters = Array.from(seen.values());
  console.log(`[seekScraper] Prewarming ${clusters.length} Seek cluster(s)`);

  await Promise.allSettled(
    clusters.map(c =>
      fetchSeekJobsForCluster(c)
        .then(jobs => console.log(`[seekScraper] ✓ ${c.role}/${c.city} → ${jobs.length} jobs`))
        .catch(err => console.error(`[seekScraper] ✗ ${c.role}/${c.city}:`, err.message))
    )
  );
}
