import { createHash } from 'crypto'
import { ApifyClient } from 'apify-client'
import { prisma } from '../index'
import type { RawJob } from './jobFeed'

// ─── IMPORTANT ────────────────────────────────────────────────────────────────
// Before production use, verify this actor ID on https://apify.com/store
// Search "seek australia jobs scraper", pick highest-rated actor, check its
// input schema, and update buildActorInput() parameter names accordingly.
const SEEK_ACTOR_ID = 'bebity/seek-jobs-scraper'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClusterKey {
  role: string
  city: string
  industry: string
  hash: string
}

interface UserForCluster {
  userId: string
  targetRole: string
  targetCity: string
  industry: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function buildClusterKey(
  targetRole: string,
  targetCity: string,
  industry: string | null
): ClusterKey {
  const role = targetRole.trim()
  const city = targetCity.trim().split(',')[0].trim().toLowerCase()
  const ind = (industry ?? '').trim().toLowerCase()
  const raw = `${role.toLowerCase()}|${city}|${ind}`
  return {
    role,
    city,
    industry: industry ?? '',
    hash: createHash('sha256').update(raw).digest('hex'),
  }
}

function todayFeedDate(): string {
  const s = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const [day, month, year] = s.split('/')
  return `${year}-${month}-${day}`
}

function buildActorInput(role: string, city: string) {
  return {
    keyword: role,    // Verify param name in actor docs
    location: city,   // Verify param name in actor docs
    maxItems: 50,     // Verify param name in actor docs
  }
}

function mapActorResult(item: any, city: string): RawJob | null {
  const sourceUrl = item.jobUrl ?? item.url ?? item.link ?? ''
  if (!sourceUrl) return null
  return {
    title: item.title ?? item.jobTitle ?? 'Untitled',
    company: item.company ?? item.companyName ?? item.advertiser ?? 'Unknown Company',
    location: item.location ?? item.suburb ?? item.area ?? city,
    salary: item.salary ?? item.salaryRange ?? item.salaryDescription ?? null,
    description: item.description ?? item.jobDescription ?? item.jobSummary ?? '',
    sourceUrl,
    sourcePlatform: 'seek',
    postedAt: (item.listingDate ?? item.postedAt ?? item.datePosted)
      ? new Date(item.listingDate ?? item.postedAt ?? item.datePosted)
      : null,
  }
}

// ─── Core scrape (with cache) ─────────────────────────────────────────────────

export async function fetchSeekJobsForCluster(cluster: ClusterKey): Promise<RawJob[]> {
  const feedDate = todayFeedDate()

  const cached = await prisma.seekJobCache.findUnique({
    where: { queryHash_feedDate: { queryHash: cluster.hash, feedDate } },
  })

  if (cached) {
    const items = cached.results as any[]
    return items.flatMap(r => {
      const mapped = mapActorResult(r, cluster.city)
      return mapped ? [mapped] : []
    })
  }

  const apiKey = process.env.APIFY_API_KEY
  if (!apiKey) {
    console.warn('[seekScraper] APIFY_API_KEY not set — skipping Seek scrape')
    return []
  }

  const client = new ApifyClient({ token: apiKey })

  let items: any[] = []
  try {
    const run = await client.actor(SEEK_ACTOR_ID).call(
      buildActorInput(cluster.role, cluster.city),
      { waitSecs: 120 }
    )
    const dataset = await client.dataset(run.defaultDatasetId).listItems()
    items = dataset.items
  } catch (err: any) {
    console.error(`[seekScraper] Apify call failed for cluster ${cluster.hash}:`, err.message)
    return []
  }

  try {
    await prisma.seekJobCache.create({
      data: {
        queryHash: cluster.hash,
        queryMeta: { role: cluster.role, city: cluster.city, industry: cluster.industry },
        feedDate,
        results: items,
        resultCount: items.length,
      },
    })
  } catch (cacheErr: any) {
    console.warn('[seekScraper] Cache write failed (non-fatal):', cacheErr.message)
  }

  return items.flatMap(r => {
    const mapped = mapActorResult(r, cluster.city)
    return mapped ? [mapped] : []
  })
}

// ─── Prewarm all clusters in parallel (used by cron) ─────────────────────────

export async function prewarmSeekClusters(users: UserForCluster[]): Promise<void> {
  const seen = new Map<string, ClusterKey>()

  for (const u of users) {
    const key = buildClusterKey(u.targetRole, u.targetCity, u.industry)
    if (!seen.has(key.hash)) seen.set(key.hash, key)
  }

  const clusters = Array.from(seen.values())
  console.log(`[seekScraper] Prewarming ${clusters.length} cluster(s)`)

  await Promise.allSettled(
    clusters.map(c =>
      fetchSeekJobsForCluster(c)
        .then(jobs => console.log(`[seekScraper] cluster ${c.role}/${c.city} -> ${jobs.length} jobs`))
        .catch(err => console.error(`[seekScraper] cluster ${c.role}/${c.city}:`, err.message))
    )
  )
}
