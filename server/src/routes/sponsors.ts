import { Router } from 'express';
import { prisma } from '../index';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { optionalAuthenticate } from '../middleware/auth';
import { searchSponsorVectors } from '../services/vector';

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
    const [industries, states, total] = await Promise.all([
      prisma.sponsor.findMany({ select: { industry: true }, distinct: ['industry'], orderBy: { industry: 'asc' } }),
      prisma.sponsor.findMany({ select: { state: true }, distinct: ['state'], orderBy: { state: 'asc' } }),
      prisma.sponsor.count(),
    ]);
    // Unenriched sponsors have a null industry; it is not a filter option.
    cachedIndustries = industries.map((r) => r.industry).filter((i): i is string => !!i);
    // The location filter runs on the ABR's `state`, which is exactly the eight
    // states and territories. It used to flatten the free-text `locations` array,
    // which produced a 742-entry dropdown listing 'Adelaide', 'Adelaide SA',
    // 'Adelaide, S.A.' and 'Adelaide, South Australia' as four separate choices.
    cachedLocations = states.map((r) => r.state).filter((s): s is string => !!s);
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
      accreditedOnly = '',
      page = '1',
      pageSize = '20',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));

    // Warm the cache before anything reads cachedTotal. This used to sit at the end
    // of the handler, so the first request after every restart reported a total of
    // 0 and the page rendered "0 sponsors found" until someone reloaded.
    if (!cacheLoaded) {
      await loadFilterCache();
    }

    // Non-text filters always AND together.
    const filterConds: Prisma.SponsorWhereInput[] = [];
    if (industry.trim()) filterConds.push({ industry: { equals: industry.trim(), mode: 'insensitive' } });
    if (location.trim()) filterConds.push({ state: { equals: location.trim(), mode: 'insensitive' } });
    if (accreditedOnly === 'true') filterConds.push({ tier: 'accredited' });

    const term = q.trim();
    let pageResults: any[];
    let total: number;
    let hasMore: boolean;

    if (term) {
      // ── Hybrid: literal substring match OR semantic (Pinecone) match ──
      // Literal handles exact name/keyword hits ("lab" → "laboratory"); semantic
      // handles meaning ("lab analyst" → pathology/scientist employers that never
      // literally say "lab analyst"). Semantic is non-fatal: [] on failure → the
      // query degrades to literal-only.
      const sem = await searchSponsorVectors(term, 60);
      const scoreMap = new Map(sem.map((s) => [s.id, s.score]));
      const literalCond: Prisma.SponsorWhereInput = {
        OR: [
          { cleanName: { contains: term, mode: 'insensitive' } },
          { hiringProfile: { contains: term, mode: 'insensitive' } },
        ],
      };
      const candidates = await prisma.sponsor.findMany({
        where: { AND: [...filterConds, { OR: [literalCond, { id: { in: sem.map((s) => s.id) } }] }] },
        take: 200,
      });

      const lc = term.toLowerCase();
      const isLiteral = (r: any) =>
        r.cleanName.toLowerCase().includes(lc) ||
        (r.hiringProfile?.toLowerCase().includes(lc) ?? false);
      candidates.sort((a, b) => {
        // Literal matches first, then by semantic score, then accredited, then name.
        const la = isLiteral(a) ? 1 : 0, lb = isLiteral(b) ? 1 : 0;
        if (la !== lb) return lb - la;
        const sa = scoreMap.get(a.id) ?? 0, sb = scoreMap.get(b.id) ?? 0;
        if (sb !== sa) return sb - sa;
        const ta = a.tier === 'accredited' ? 1 : 0, tb = b.tier === 'accredited' ? 1 : 0;
        if (ta !== tb) return tb - ta;
        return a.cleanName.localeCompare(b.cleanName);
      });

      total = candidates.length;
      const start = (pageNum - 1) * size;
      pageResults = candidates.slice(start, start + size);
      hasMore = start + size < candidates.length;
    } else {
      // ── No query: filtered/unfiltered list with DB-level pagination ──
      // tier enum is declared accredited → standard, so ascending puts the
      // priority-processing employers first. cleanName breaks ties.
      const whereClause = filterConds.length > 0 ? { AND: filterConds } : {};
      const rawResults = await prisma.sponsor.findMany({
        where: whereClause,
        orderBy: [{ tier: 'asc' }, { cleanName: 'asc' }],
        skip: (pageNum - 1) * size,
        take: size + 1,
      });
      hasMore = rawResults.length > size;
      // Cached global count for the unfiltered list avoids a round-trip; filtered
      // queries need the real matching count for an accurate "X sponsors" hook.
      total = filterConds.length > 0
        ? await prisma.sponsor.count({ where: whereClause })
        : cachedTotal;
      pageResults = hasMore ? rawResults.slice(0, size) : rawResults;
    }

    // Gate: strip locked fields from anonymous results
    const unlocked = isUnlocked(req);
    const gatedResults = pageResults.map((r) => {
      const base: Record<string, any> = {
        id: r.id,
        cleanName: r.cleanName,
        industry: r.industry,
        locations: r.locations,
        hiringProfile: r.hiringProfile,
        tier: r.tier,
        state: r.state,
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
      // But surface it, because a swallowed failure here means we silently lose leads.
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

    // The cookie is what unlocks the data, so the client just re-runs its current
    // search. This used to return the entire Sponsor table for the client to slice
    // down to one page; at 37k rows that is a multi-megabyte response for ~20 cards.
    res.json({ success: true });
  } catch (err) {
    console.error('[sponsors/unlock]', err);
    res.status(500).json({ error: 'Unlock failed' });
  }
});

export default router;
