import { Router } from 'express';
import { prisma } from '../index';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { optionalAuthenticate } from '../middleware/auth';

const router = Router();

// Populate req.user when a logged-in user calls these routes (without blocking
// anonymous visitors). Logged-in users then get the full, unlocked dataset;
// anonymous visitors still hit the email gate. See isUnlocked() below.
router.use(optionalAuthenticate);

const SPONSOR_COOKIE = 'sponsor_unlock';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Cached filter options ──────────────────────────────────────────
let cachedIndustries: string[] = [];
let cachedLocations: string[] = [];
let cachedTotal = 0;
let cacheLoaded = false;

export async function loadFilterCache() {
  try {
    const [industries, locations, total] = await Promise.all([
      prisma.sponsor.findMany({ select: { industry: true }, distinct: ['industry'], orderBy: { industry: 'asc' } }),
      prisma.sponsor.findMany({ select: { locations: true } }),
      prisma.sponsor.count(),
    ]);
    cachedIndustries = industries.map((r) => r.industry);
    cachedLocations = [...new Set(locations.flatMap((r) => r.locations))].sort();
    cachedTotal = total;
    cacheLoaded = true;
    console.log(`[sponsors] Filter cache loaded: ${cachedIndustries.length} industries, ${cachedLocations.length} locations, ${total} total`);
  } catch (err) {
    console.warn('[sponsors] Failed to load filter cache (table may not exist yet):', err);
  }
}

// Cache is warmed explicitly at server startup (after prisma is initialised and
// the table is seeded) via loadFilterCache() in index.ts. Calling it at module
// import time raced the prisma export and threw "Cannot access 'prisma' before
// initialization". The per-request lazy load below remains as a safety net.

// ── Helpers ──────────────────────────────────────────────────────

function signValue(value: string): string {
  const secret = process.env.COOKIE_SECRET || 'sponsor-dev-secret';
  return value + '.' + crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function verifySignedCookie(cookie: string | undefined): boolean {
  if (!cookie) return false;
  const secret = process.env.COOKIE_SECRET || 'sponsor-dev-secret';
  const parts = cookie.split('.');
  if (parts.length !== 2) return false;
  const expected = parts[0] + '.' + crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url');
  // Use timing-safe comparison
  const bufA = Buffer.from(cookie);
  const bufB = Buffer.from(expected);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isUnlocked(req: any): boolean {
  // Logged-in users always get full data
  if (req.user?.id) return true;
  return verifySignedCookie(req.cookies?.[SPONSOR_COOKIE]);
}

// ── GET /sponsors/search ─────────────────────────────────────────

router.get('/search', async (req: any, res: any) => {
  try {
    const {
      q = '',
      industry = '',
      location = '',
      highConfidence = '',
      page = '1',
      pageSize = '20',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));

    const where: Prisma.SponsorWhereInput[] = [];

    // Text search: cleanName + hiringProfile
    if (q.trim()) {
      where.push({
        OR: [
          { cleanName: { contains: q.trim(), mode: 'insensitive' } },
          { hiringProfile: { contains: q.trim(), mode: 'insensitive' } },
        ],
      });
    }

    // Industry filter
    if (industry.trim()) {
      where.push({ industry: { equals: industry.trim(), mode: 'insensitive' } });
    }

    // Location filter (array contains)
    if (location.trim()) {
      where.push({ locations: { has: location.trim() } });
    }

    // High-confidence only
    if (highConfidence === 'true') {
      where.push({ confidence: 'high' });
    }

    const whereClause = where.length > 0 ? { AND: where } : {};
    const isFiltered = where.length > 0;

    // confidence enum is declared high → medium → low, so ascending puts
    // high-confidence (best data) first. cleanName breaks ties.
    const rawResults = await prisma.sponsor.findMany({
      where: whereClause,
      orderBy: [{ confidence: 'asc' }, { cleanName: 'asc' }],
      skip: (pageNum - 1) * size,
      take: size + 1,
    });

    const hasMore = rawResults.length > size;

    // Total: use the cached global count for the unfiltered list (avoids a
    // round-trip on the common case). For filtered queries we need the real
    // matching count so the "X sponsors in Y" hook is accurate.
    const total = isFiltered
      ? await prisma.sponsor.count({ where: whereClause })
      : cachedTotal;
    const pageResults = hasMore ? rawResults.slice(0, size) : rawResults;

    // Gate: strip locked fields from anonymous results
    const unlocked = isUnlocked(req);
    const gatedResults = pageResults.map((r) => {
      const base: Record<string, any> = {
        id: r.id,
        cleanName: r.cleanName,
        industry: r.industry,
        locations: r.locations,
        hiringProfile: r.hiringProfile,
        confidence: r.confidence,
      };
      if (unlocked) {
        base.website = r.website;
        base.careersUrl = r.careersUrl;
        base.careersSearchUrl = r.careersSearchUrl;
      } else {
        base.website = null;
        base.careersUrl = null;
        base.careersSearchUrl = null;
      }
      return base;
    });

      // Use cached filter options (computed once at startup)
      if (!cacheLoaded) {
        await loadFilterCache();
      }

      res.json({
        page: pageNum,
        pageSize: size,
        total,
        hasMore,
        results: gatedResults,
        industries: cachedIndustries,
        locations: cachedLocations,
      });
    } catch (err) {
    console.error('[sponsors/search]', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── POST /sponsors/unlock ────────────────────────────────────────

router.post('/unlock', async (req: any, res: any) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    // Track the lead
    try {
      await (prisma as any).sponsorLead.upsert({
        where: { email: email.trim().toLowerCase() },
        update: { unlockedAt: new Date() },
        create: { email: email.trim().toLowerCase() },
      });
    } catch (err) {
      // Non-fatal: the unlock cookie is still set so the user gets their links.
      // But surface it — a swallowed failure here means we're silently losing leads.
      console.warn('[sponsors/unlock] lead capture failed:', err instanceof Error ? err.message : err);
    }

    // Set the unlock cookie
    const signed = signValue(email.trim().toLowerCase() + ':' + Date.now());
    res.cookie(SPONSOR_COOKIE, signed, {
      httpOnly: true,
      signed: false,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      secure: process.env.NODE_ENV === 'production',
    });

    // Re-fetch all records with full fields for in-place unlock
    const allSponsors = await prisma.sponsor.findMany({
      orderBy: [{ confidence: 'asc' }, { cleanName: 'asc' }],
    });

    res.json({ success: true, unlockedResults: allSponsors });
  } catch (err) {
    console.error('[sponsors/unlock]', err);
    res.status(500).json({ error: 'Unlock failed' });
  }
});

export default router;
