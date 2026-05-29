# Visa Sponsor Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public `/visa-sponsors` landing page that lists ~1,200 visa-sponsoring Australian companies with search, filtering, an email gate for contact links, and cold-outreach integration for paid users.

**Architecture:** New Prisma `Sponsor` model seeded from scraped JSON. `GET /api/sponsors/search` returns results with contact links withheld for anonymous visitors. `POST /api/sponsors/unlock` sets an httpOnly signed cookie and returns unlocked records. Frontend follows existing landing aesthetic (inline styles + `<style>` `@media` at 1024/768/640 breakpoints). Cold-outreach endpoint (`POST /generate/cold-outreach`) gets a small backend tweak to accept and use `companyResearch`.

**Tech Stack:** Express/TypeScript/Prisma/Postgres (backend), React/TypeScript/Vite (frontend), PostHog (analytics)

---

### Task 1: Prisma schema — Sponsor model + SponsorConfidence enum

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] Add `SponsorConfidence` enum before existing models:
  ```prisma
  enum SponsorConfidence {
    high
    medium
    low
  }
  ```

- [ ] Add `Sponsor` model after the existing models (e.g. after `FridayBrief`):
  ```prisma
  model Sponsor {
    id               String             @id @default(uuid())
    cleanName        String
    rawName          String
    website          String?
    careersUrl       String?
    careersSearchUrl String?
    industry         String
    locations        String[]
    hiringProfile    String
    confidence       SponsorConfidence
    createdAt        DateTime           @default(now())
    updatedAt        DateTime           @updatedAt

    @@index([industry])
    @@index([confidence])
    @@index([cleanName])
  }
  ```

---

### Task 2: Generate Prisma migration + seed script

**Files:**
- Create: `server/src/scripts/seed_sponsors.ts`
- Generated: `server/prisma/migrations/XXXX_add_sponsor_model/`

- [ ] Generate migration:
  ```bash
  cd server && npx prisma migrate dev --name add_sponsor_model
  ```

- [ ] Create seed script at `server/src/scripts/seed_sponsors.ts`:
  ```typescript
  import { PrismaClient } from '@prisma/client';

  const prisma = new PrismaClient();

  interface SponsorSeed {
    rawName: string;
    cleanName: string;
    website: string | null;
    careersUrl: string | null;
    careersSearchUrl: string | null;
    industry: string;
    locations: string[];
    hiringProfile: string;
    confidence: 'high' | 'medium' | 'low';
  }

  async function seed() {
    const dataPath = process.argv[2];
    if (!dataPath) {
      console.error('Usage: npx ts-node src/scripts/seed_sponsors.ts <path-to-json>');
      process.exit(1);
    }

    const records: SponsorSeed[] = JSON.parse(
      require('fs').readFileSync(dataPath, 'utf-8')
    );

    // Upsert by cleanName to handle re-runs
    let created = 0;
    for (const r of records) {
      await prisma.sponsor.upsert({
        where: { cleanName: r.cleanName },
        update: {
          rawName: r.rawName,
          website: r.website,
          careersUrl: r.careersUrl,
          careersSearchUrl: r.careersSearchUrl,
          industry: r.industry,
          locations: r.locations,
          hiringProfile: r.hiringProfile,
          confidence: r.confidence as SponsorConfidence,
        },
        create: {
          cleanName: r.cleanName,
          rawName: r.rawName,
          website: r.website,
          careersUrl: r.careersUrl,
          careersSearchUrl: r.careersSearchUrl,
          industry: r.industry,
          locations: r.locations,
          hiringProfile: r.hiringProfile,
          confidence: r.confidence as SponsorConfidence,
        },
      });
      created++;
    }

    console.log(`Seeded ${created} sponsors`);
    await prisma.$disconnect();
  }

  seed().catch((e) => {
    console.error(e);
    process.exit(1);
  });
  ```

---

### Task 3: Sponsor routes — search + unlock endpoints

**Files:**
- Create: `server/src/routes/sponsors.ts`
- Modify: `server/src/index.ts` (mount routes + add Sponsor ensureColumns)

- [ ] Create `server/src/routes/sponsors.ts`:
  ```typescript
  import { Router } from 'express';
  import { prisma } from '../index';
  import { authenticate, AuthRequest } from '../middleware/auth';
  import { Prisma } from '@prisma/client';
  import crypto from 'crypto';

  const router = Router();

  const SPONSOR_COOKIE = 'sponsor_unlock';
  const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

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
    return crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
  }

  function isUnlocked(req: any): boolean {
    // Logged-in users always get full data
    if (req.user?.id) return true;
    return verifySignedCookie(req.cookies?.[SPONSOR_COOKIE]);
  }

  const PUBLIC_FIELDS = {
    id: true,
    cleanName: true,
    industry: true,
    locations: true,
    hiringProfile: true,
    confidence: true,
    // website, careersUrl, careersSearchUrl omitted — gated
  } as const;

  const FULL_FIELDS = {
    id: true,
    cleanName: true,
    rawName: true,
    website: true,
    careersUrl: true,
    careersSearchUrl: true,
    industry: true,
    locations: true,
    hiringProfile: true,
    confidence: true,
  } as const;

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

      // Text search: cleanName + hiringProfile ILIKE
      if (q.trim()) {
        const qPattern = `%${q.trim()}%`;
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

      // Get total with filters applied (for results count)
      const total = await prisma.sponsor.count({ where: whereClause });

      // Get filtered results with pagination
      const results = await prisma.sponsor.findMany({
        where: whereClause,
        orderBy: [
          { confidence: 'desc' }, // high → medium → low
          { cleanName: 'asc' },
        ],
        skip: (pageNum - 1) * size,
        take: size,
      });

      // Gate: strip locked fields from anonymous results
      const unlocked = isUnlocked(req);
      const gatedResults = results.map((r) => {
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

      // Compute unfiltered distinct industries/locations for filter chips
      const [allIndustries, allLocations] = await Promise.all([
        prisma.sponsor.findMany({ select: { industry: true }, distinct: ['industry'], orderBy: { industry: 'asc' } }),
        prisma.sponsor.findMany({ select: { locations: true } }),
      ]);
      const distinctLocations = [...new Set(allLocations.flatMap((r) => r.locations))].sort();

      res.json({
        total,
        page: pageNum,
        pageSize: size,
        results: gatedResults,
        industries: allIndustries.map((r) => r.industry),
        locations: distinctLocations,
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
        await prisma.sponsorLead.upsert({
          where: { email: email.trim().toLowerCase() },
          update: { unlockedAt: new Date() },
          create: { email: email.trim().toLowerCase() },
        });
      } catch {
        // SponsorLead table may not exist in older envs — non-fatal
      }

      // Set the unlock cookie
      const signed = signValue(email.trim().toLowerCase() + ':' + Date.now());
      res.cookie(SPONSOR_COOKIE, signed, {
        httpOnly: true,
        signed: false,      // we sign manually above
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        secure: process.env.NODE_ENV === 'production',
      });

      // Re-fetch all records with full fields for in-place unlock
      const allSponsors = await prisma.sponsor.findMany({
        select: FULL_FIELDS,
        orderBy: [{ confidence: 'desc' }, { cleanName: 'asc' }],
      });

      res.json({ success: true, unlockedResults: allSponsors });
    } catch (err) {
      console.error('[sponsors/unlock]', err);
      res.status(500).json({ error: 'Unlock failed' });
    }
  });

  export default router;
  ```

- [ ] Register route and SponsorLead in `server/src/index.ts`:

  Add import near other route imports:
  ```typescript
  import sponsorsRouter from './routes/sponsors';
  ```

  Add route mount near other routes (after insights):
  ```typescript
  app.use('/api/sponsors', sponsorsRouter);
  ```

  Add SponsorLead `ensureColumns` entry in the `ensureColumns` function:
  ```typescript
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SponsorLead" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email TEXT NOT NULL UNIQUE,
      unlockedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  ```

  Note: Since the Sponsor model is managed by Prisma migrations, it doesn't need ensureColumns — only SponsorLead does since it's used ad-hoc.

---

### Task 4: Analytics — sponsor tracking helpers

**Files:**
- Modify: `src/lib/analytics.ts`

- [ ] Add sponsor tracking helpers after the existing `trackLanding*` block:
  ```typescript
  // ── Sponsor directory funnel ──────────────────────────────────────

  export function trackSponsorDirectoryViewed() {
    posthog.capture('sponsor_directory_viewed');
  }

  export function trackSponsorSearchPerformed(q: string, filters: Record<string, string>, resultCount: number) {
    posthog.capture('sponsor_search_performed', { query: q, ...filters, result_count: resultCount });
  }

  export function trackSponsorEmailGateShown() {
    posthog.capture('sponsor_email_gate_shown');
  }

  export function trackSponsorEmailCaptured() {
    posthog.capture('sponsor_email_captured');
  }

  export function trackSponsorLinksUnlocked() {
    posthog.capture('sponsor_links_unlocked');
  }

  export function trackSponsorOutreachLockedClicked() {
    posthog.capture('sponsor_outreach_locked_clicked');
  }

  export function trackSponsorTrialCtaClicked() {
    posthog.capture('sponsor_trial_cta_clicked');
  }
  ```

---

### Task 5: Frontend — SponsorCard component

**Files:**
- Create: `src/components/sponsors/SponsorCard.tsx`

- [ ] Create the card component:
  ```tsx
  import React from 'react';
  import { colors, type, spacing } from '../landing/tokens';

  interface SponsorCardData {
    id: string;
    cleanName: string;
    industry: string;
    locations: string[];
    hiringProfile: string;
    confidence: string;
    website: string | null;
    careersUrl: string | null;
    careersSearchUrl: string | null;
  }

  interface Props {
    sponsor: SponsorCardData;
    unlocked: boolean;
    onLockedClick: () => void;
  }

  export function SponsorCard({ sponsor, unlocked, onLockedClick }: Props) {
    const careersTarget = sponsor.careersUrl || sponsor.careersSearchUrl;

    const linkStyle: React.CSSProperties = {
      fontSize: 13,
      fontWeight: 600,
      color: colors.accentPetrol,
      textDecoration: 'none',
      padding: '6px 14px',
      borderRadius: 20,
      border: `1.5px solid ${colors.accentGold}`,
      background: 'transparent',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: type.body,
    };

    const lockedLinkStyle: React.CSSProperties = {
      ...linkStyle,
      color: colors.textMuted,
      borderColor: colors.borderDefined,
      cursor: 'pointer',
    };

    return (
      <div style={{
        background: colors.bgSurface,
        border: `1px solid ${colors.borderWhisper}`,
        borderRadius: 12,
        padding: spacing.cardPaddingDesktop,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'box-shadow 180ms ease',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
      >
        {/* Company name */}
        <h3 style={{
          margin: 0,
          fontFamily: type.display,
          fontSize: 17,
          fontWeight: 700,
          color: colors.textPrimary,
          lineHeight: 1.3,
        }}>
          {sponsor.cleanName}
        </h3>

        {/* Industry tag */}
        <span style={{
          display: 'inline-block',
          fontSize: 11,
          fontWeight: 600,
          color: colors.accentPetrol,
          background: 'rgba(45, 90, 110, 0.08)',
          padding: '2px 10px',
          borderRadius: 10,
          width: 'fit-content',
          textTransform: 'uppercase',
          letterSpacing: '0.3px',
        }}>
          {sponsor.industry}
        </span>

        {/* Locations */}
        <p style={{
          margin: 0,
          fontSize: 13,
          color: colors.textSecondary,
          fontFamily: type.body,
        }}>
          {sponsor.locations.join(', ')}
        </p>

        {/* Hiring profile */}
        <p style={{
          margin: 0,
          fontSize: 14,
          color: colors.textMuted,
          fontFamily: type.body,
          lineHeight: 1.4,
        }}>
          {sponsor.hiringProfile}
        </p>

        {/* Action links */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginTop: 'auto',
          paddingTop: 8,
          flexWrap: 'wrap',
        }}>
          {unlocked && sponsor.website ? (
            <a href={sponsor.website} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              Website →
            </a>
          ) : (
            <button onClick={onLockedClick} style={lockedLinkStyle}>
              🔒 Website
            </button>
          )}

          {unlocked && careersTarget ? (
            <a href={careersTarget} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              Careers →
            </a>
          ) : !unlocked ? (
            <button onClick={onLockedClick} style={lockedLinkStyle}>
              🔒 Careers
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  ```

  Important: The lock icon uses Unicode 🔒 and will render as a simple lock across all browsers. If the user wants a different icon approach, they'll request it — do not install an icon library.

---

### Task 6: Frontend — SponsorEmailModal component

**Files:**
- Create: `src/components/sponsors/SponsorEmailModal.tsx`

- [ ] Create the email capture modal:
  ```tsx
  import React, { useState } from 'react';
  import { colors, type } from '../landing/tokens';
  import api from '../../lib/api';
  import { trackSponsorEmailCaptured, trackSponsorLinksUnlocked } from '../../lib/analytics';

  interface Props {
    onClose: () => void;
    onUnlock: (unlockedResults: any[]) => void;
  }

  export function SponsorEmailModal({ onClose, onUnlock }: Props) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!email.includes('@')) {
        setError('Please enter a valid email');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const { data } = await api.post('/sponsors/unlock', { email });
        if (data.success) {
          setSuccess(true);
          trackSponsorEmailCaptured();
          trackSponsorLinksUnlocked();
          // Brief pause so user sees confirmation, then close + unlock
          setTimeout(() => {
            onUnlock(data.unlockedResults);
            onClose();
          }, 800);
        }
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(26, 24, 20, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20,
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{
          background: colors.bgSurface,
          borderRadius: 16,
          padding: '40px 36px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          textAlign: 'center',
        }}>
          {success ? (
            <>
              <h3 style={{ fontFamily: type.display, color: colors.success, margin: '0 0 8px' }}>
                ✓ You're in!
              </h3>
              <p style={{ color: colors.textSecondary, fontSize: 14, margin: 0 }}>
                Contact links are now unlocked across the directory.
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <h3 style={{
                fontFamily: type.display,
                fontSize: 22,
                color: colors.textPrimary,
                margin: '0 0 6px',
              }}>
                See contact details
              </h3>
              <p style={{
                color: colors.textSecondary,
                fontSize: 14,
                margin: '0 0 24px',
                lineHeight: 1.5,
              }}>
                Enter your email to view website and careers links for all sponsors.
              </p>

              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: `1.5px solid ${error ? '#dc2626' : colors.borderDefined}`,
                  fontSize: 15,
                  fontFamily: type.body,
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: error ? 6 : 16,
                }}
              />
              {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '0 0 12px', textAlign: 'left' }}>{error}</p>}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 10,
                  border: 'none',
                  background: colors.accentPetrol,
                  color: colors.textOnDeep,
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: type.body,
                  cursor: loading ? 'default' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Unlocking...' : 'Unlock contact links'}
              </button>

              <p style={{
                color: colors.textMuted,
                fontSize: 12,
                margin: '16px 0 0',
              }}>
                No spam. Unsubscribe anytime.
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }
  ```

  Note: No separate cookie-reading logic needed in the frontend — the server determines unlock state from the cookie on every search request. The frontend just needs to track whether it has ever received unlocked results (via `onUnlock` callback), and re-fetch with the cookie automatically included on subsequent searches.

---

### Task 7: Frontend — SponsorResultsGrid + SponsorSearchBar + SponsorFilterBar

**Files:**
- Create: `src/components/sponsors/SponsorSearchBar.tsx`
- Create: `src/components/sponsors/SponsorFilterBar.tsx`
- Create: `src/components/sponsors/SponsorResultsGrid.tsx`

- [ ] Create `SponsorSearchBar.tsx`:
  ```tsx
  import React, { useState } from 'react';
  import { colors, type } from '../landing/tokens';

  interface Props {
    onSearch: (q: string) => void;
    defaultValue?: string;
  }

  export function SponsorSearchBar({ onSearch, defaultValue = '' }: Props) {
    const [value, setValue] = useState(defaultValue);

    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      onSearch(value);
    }

    return (
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 640, margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          gap: 0,
          background: colors.bgSurface,
          border: `1.5px solid ${colors.borderDefined}`,
          borderRadius: 12,
          overflow: 'hidden',
          transition: 'border-color 180ms ease',
        }}
          onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = colors.accentPetrol; }}
          onBlurCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = colors.borderDefined; }}
        >
          <input
            type="text"
            placeholder="Search companies or hiring profiles..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{
              flex: 1,
              padding: '14px 20px',
              border: 'none',
              outline: 'none',
              fontSize: 15,
              fontFamily: type.body,
              background: 'transparent',
              color: colors.textPrimary,
            }}
          />
          <button
            type="submit"
            style={{
              padding: '14px 24px',
              border: 'none',
              background: colors.accentPetrol,
              color: colors.textOnDeep,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: type.body,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Search
          </button>
        </div>
      </form>
    );
  }
  ```

- [ ] Create `SponsorFilterBar.tsx`:
  ```tsx
  import React from 'react';
  import { colors, type } from '../landing/tokens';

  interface Props {
    industries: string[];
    locations: string[];
    selectedIndustry: string;
    selectedLocation: string;
    highConfidenceOnly: boolean;
    onIndustryChange: (v: string) => void;
    onLocationChange: (v: string) => void;
    onConfidenceToggle: () => void;
  }

  export function SponsorFilterBar({
    industries, locations,
    selectedIndustry, selectedLocation,
    highConfidenceOnly,
    onIndustryChange, onLocationChange, onConfidenceToggle,
  }: Props) {
    const selectStyle: React.CSSProperties = {
      padding: '8px 14px',
      borderRadius: 10,
      border: `1.5px solid ${colors.borderDefined}`,
      background: colors.bgSurface,
      fontSize: 13,
      fontFamily: type.body,
      color: colors.textPrimary,
      outline: 'none',
      cursor: 'pointer',
      minWidth: 150,
    };

    const chipActive: React.CSSProperties = {
      padding: '8px 16px',
      borderRadius: 20,
      border: `1.5px solid ${colors.accentPetrol}`,
      background: colors.accentPetrol,
      color: colors.textOnDeep,
      fontSize: 13,
      fontWeight: 600,
      fontFamily: type.body,
      cursor: 'pointer',
      transition: 'all 180ms ease',
    };

    const chipInactive: React.CSSProperties = {
      ...chipActive,
      background: 'transparent',
      color: colors.textSecondary,
      borderColor: colors.borderDefined,
    };

    return (
      <div style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <select
          value={selectedIndustry}
          onChange={(e) => onIndustryChange(e.target.value)}
          style={selectStyle}
        >
          <option value="">All industries</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>

        <select
          value={selectedLocation}
          onChange={(e) => onLocationChange(e.target.value)}
          style={selectStyle}
        >
          <option value="">All locations</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>

        <button
          onClick={onConfidenceToggle}
          style={highConfidenceOnly ? chipActive : chipInactive}
        >
          {highConfidenceOnly ? '✓ High confidence only' : 'High confidence only'}
        </button>
      </div>
    );
  }
  ```

- [ ] Create `SponsorResultsGrid.tsx`:
  ```tsx
  import React from 'react';
  import { colors, type } from '../landing/tokens';
  import { SponsorCard } from './SponsorCard';

  interface SponsorCardData {
    id: string;
    cleanName: string;
    industry: string;
    locations: string[];
    hiringProfile: string;
    confidence: string;
    website: string | null;
    careersUrl: string | null;
    careersSearchUrl: string | null;
  }

  interface Props {
    results: SponsorCardData[];
    total: number;
    page: number;
    pageSize: number;
    unlocked: boolean;
    loading: boolean;
    onLoadMore: () => void;
    onLockedClick: () => void;
  }

  export function SponsorResultsGrid({ results, total, page, pageSize, unlocked, loading, onLoadMore, onLockedClick }: Props) {
    const hasMore = page * pageSize < total;

    return (
      <div>
        {/* Results count */}
        <p style={{
          textAlign: 'center',
          color: colors.textSecondary,
          fontSize: 14,
          fontFamily: type.body,
          margin: '0 0 24px',
        }}>
          {total} {total === 1 ? 'sponsor' : 'sponsors'} found
        </p>

        {/* Grid */}
        <div className="sponsor-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
        }}>
          {results.map((sponsor) => (
            <SponsorCard
              key={sponsor.id}
              sponsor={sponsor}
              unlocked={unlocked}
              onLockedClick={onLockedClick}
            />
          ))}
        </div>

        {/* Load more */}
        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <button
              onClick={onLoadMore}
              disabled={loading}
              style={{
                padding: '12px 32px',
                borderRadius: 10,
                border: `1.5px solid ${colors.accentPetrol}`,
                background: 'transparent',
                color: colors.accentPetrol,
                fontSize: 14,
                fontWeight: 700,
                fontFamily: type.body,
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              {loading ? 'Loading...' : 'Load more sponsors'}
            </button>
          </div>
        )}

        {/* Responsive grid: 3→2→1 columns */}
        <style>{`
          @media (max-width: 1024px) {
            .sponsor-grid { grid-template-columns: repeat(2, 1fr) !important; }
          }
          @media (max-width: 640px) {
            .sponsor-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    );
  }
  ```

---

### Task 8: Frontend — SponsorHero component

**Files:**
- Create: `src/components/sponsors/SponsorHero.tsx`

- [ ] Create the hero section:
  ```tsx
  import React from 'react';
  import { colors, type, spacing } from '../landing/tokens';
  import { SponsorSearchBar } from './SponsorSearchBar';

  interface Props {
    onSearch: (q: string) => void;
  }

  export function SponsorHero({ onSearch }: Props) {
    return (
      <section style={{
        textAlign: 'center',
        padding: `${spacing.sectionDesktop} 24px`,
        background: colors.bgCanvas,
      }}>
        <h1 style={{
          fontFamily: type.display,
          fontSize: 'clamp(2rem, 4vw, 3rem)',
          fontWeight: 700,
          color: colors.textPrimary,
          margin: '0 auto 12px',
          maxWidth: spacing.containerReadable,
          lineHeight: 1.15,
        }}>
          Companies sponsoring visas in Australia
        </h1>
        <p style={{
          fontFamily: type.body,
          fontSize: 17,
          color: colors.textSecondary,
          margin: '0 auto 32px',
          maxWidth: spacing.containerReadable,
          lineHeight: 1.5,
        }}>
          Search 1,200+ verified sponsors. Find companies actively hiring skilled migrants — no guesswork.
        </p>
        <SponsorSearchBar onSearch={onSearch} />

        <style>{`
          @media (max-width: 640px) {
            section[data-hero] { padding: ${spacing.sectionMobile} 20px !important; }
          }
        `}</style>
      </section>
    );
  }
  ```

---

### Task 9: Frontend — VisaSponsorsPage (main page)

**Files:**
- Create: `src/pages/VisaSponsorsPage.tsx`

- [ ] Create the main page that composes all sponsor components:
  ```tsx
  import React, { useState, useEffect, useCallback } from 'react';
  import { colors, spacing } from '../components/landing/tokens';
  import { SponsorHero } from '../components/sponsors/SponsorHero';
  import { SponsorFilterBar } from '../components/sponsors/SponsorFilterBar';
  import { SponsorResultsGrid } from '../components/sponsors/SponsorResultsGrid';
  import { SponsorEmailModal } from '../components/sponsors/SponsorEmailModal';
  import { LandingFooter } from '../components/landing/LandingFooter';
  import api from '../lib/api';
  import { trackSponsorDirectoryViewed, trackSponsorSearchPerformed, trackSponsorEmailGateShown } from '../lib/analytics';

  interface SponsorData {
    id: string;
    cleanName: string;
    industry: string;
    locations: string[];
    hiringProfile: string;
    confidence: string;
    website: string | null;
    careersUrl: string | null;
    careersSearchUrl: string | null;
  }

  export function VisaSponsorsPage() {
    const [results, setResults] = useState<SponsorData[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    const [query, setQuery] = useState('');
    const [industry, setIndustry] = useState('');
    const [location, setLocation] = useState('');
    const [highConfidence, setHighConfidence] = useState(false);

    const [industries, setIndustries] = useState<string[]>([]);
    const [locations, setLocations] = useState<string[]>([]);

    const [unlocked, setUnlocked] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const pageSize = 20;

    const fetchResults = useCallback(async (q: string, ind: string, loc: string, hc: boolean, p: number, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (ind) params.set('industry', ind);
        if (loc) params.set('location', loc);
        if (hc) params.set('highConfidence', 'true');
        params.set('page', String(p));
        params.set('pageSize', String(pageSize));

        const { data } = await api.get(`/sponsors/search?${params.toString()}`);
        if (append) {
          setResults((prev) => [...prev, ...data.results]);
        } else {
          setResults(data.results);
        }
        setTotal(data.total);
        setPage(data.page);
        setIndustries(data.industries);
        setLocations(data.locations);

        // If server returned full data (unlocked cookie set), mark unlocked
        if (data.results.length > 0 && data.results[0].website !== null) {
          setUnlocked(true);
        }
      } catch (err) {
        console.error('Sponsor search failed', err);
      } finally {
        setLoading(false);
      }
    }, []);

    // Initial load
    useEffect(() => {
      trackSponsorDirectoryViewed();
      fetchResults('', '', '', false, 1, false);
    }, [fetchResults]);

    function handleSearch(q: string) {
      setQuery(q);
      setPage(1);
      fetchResults(q, industry, location, highConfidence, 1, false).then(() => {
        trackSponsorSearchPerformed(q, { industry, location, highConfidence: String(highConfidence) }, total);
      });
    }

    function handleIndustryChange(ind: string) {
      setIndustry(ind);
      setPage(1);
      fetchResults(query, ind, location, highConfidence, 1, false);
    }

    function handleLocationChange(loc: string) {
      setLocation(loc);
      setPage(1);
      fetchResults(query, industry, loc, highConfidence, 1, false);
    }

    function handleConfidenceToggle() {
      const next = !highConfidence;
      setHighConfidence(next);
      setPage(1);
      fetchResults(query, industry, location, next, 1, false);
    }

    function handleLoadMore() {
      fetchResults(query, industry, location, highConfidence, page + 1, true);
    }

    function handleLockedClick() {
      trackSponsorEmailGateShown();
      setShowModal(true);
    }

    function handleUnlock(unlockedResults: SponsorData[]) {
      setUnlocked(true);
      setResults(unlockedResults.slice(0, page * pageSize));
    }

    return (
      <div style={{ minHeight: '100vh', background: colors.bgCanvas' }}>
        <SponsorHero onSearch={handleSearch} searchValue={query} />

        <div style={{ padding: `0 24px ${spacing.sectionDesktop}` }}>
          <div style={{ maxWidth: spacing.containerMax, margin: '0 auto' }}>
            <SponsorFilterBar
              industries={industries}
              locations={locations}
              selectedIndustry={industry}
              selectedLocation={location}
              highConfidenceOnly={highConfidence}
              onIndustryChange={handleIndustryChange}
              onLocationChange={handleLocationChange}
              onConfidenceToggle={handleConfidenceToggle}
            />

            <div style={{ marginTop: 32 }}>
              <SponsorResultsGrid
                results={results}
                total={total}
                page={page}
                pageSize={pageSize}
                unlocked={unlocked}
                loading={loading}
                onLoadMore={handleLoadMore}
                onLockedClick={handleLockedClick}
              />
            </div>
          </div>
        </div>

        <LandingFooter />

        {showModal && (
          <SponsorEmailModal
            onClose={() => setShowModal(false)}
            onUnlock={handleUnlock}
          />
        )}
      </div>
    );
  }
  ```

  Note: Wait — the VisaSponsorsPage currently imports `spacing` as a named import in one place and potentially as a default elsewhere. The tokens.ts file uses named exports: `export const spacing = { ... }`. So `import { colors, spacing }` is correct.

  However, there's a subtle bug: the `SponsorHero` function takes `{ onSearch }` but I just realized the SearchBar needs the `defaultValue` prop to show the current query when re-rendering. Let me fix the hero to pass it through:

  Update `SponsorHero` interface to accept `searchValue` and pass it to the search bar.

  Also, the grid uses `spacing.containerMax` which is correct. The `const pageSize = 20` is used in URL params and the hasMore check.

---

### Task 10: Route registration — add `/visa-sponsors` to App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] Add lazy import near other page imports:
  ```tsx
  const VisaSponsorsPage = React.lazy(() =>
    import('./pages/VisaSponsorsPage').then(m => ({ default: m.VisaSponsorsPage }))
  );
  ```

- [ ] Add route in the public routes section (after the `/` landing route):
  ```tsx
  <Route path="/visa-sponsors" element={
    <React.Suspense fallback={null}>
      <VisaSponsorsPage />
    </React.Suspense>
  } />
  ```

---

### Task 11: Backend — cold-outreach companyResearch support

**Files:**
- Modify: `server/src/routes/generate.ts`

- [ ] The route already destructures `companyResearch` from `req.body` (line 107). The issue is that the prompt function `DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT` already receives `companyResearch` as a parameter — but the `cold-outreach` type is classified as `isAcademicDoc` (line 212), which means it gets the `STAR_RESPONSE` format block instead of the `COVER_LETTER` format block that uses `companyResearch?.salutation`.

  Since `cold-outreach` follows `STAR_RESPONSE` format (narrative first-person), the company research data won't be used in the format block. But it IS passed through to the function and available in the prompt. The real fix is to make the `cold-outreach` format block include salutation and company context from `companyResearch`.

  Find the format block for `STAR_RESPONSE` at line 366 and add a cold-outreach branch:

  Original code at line 364-367:
  ```typescript
  : type === 'STAR_RESPONSE'
  ? 'STAR FORMAT: Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%)...'
  ```

  Change to:
  ```typescript
  : type === 'STAR_RESPONSE'
  ? 'STAR FORMAT: Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%)...'
  : type === 'COLD_OUTREACH'
  ? `COLD OUTREACH FORMAT: Salutation if available: ${companyResearch?.salutation || 'Hiring Manager'}.`
  ```

  Wait — I need to check whether the prompt function uses `type` or `docType`. Let me verify.

  Looking at the function at line 199-211, the type parameter passed is `docType` which is set earlier in the route from the `type` URL param. For `cold-outreach`, the map in `getRuleBase` returns `cold_outreach_rules.md`, and the prompt function gets the route type.

  Actually, let me look at the actual conditional chain more carefully. The code at line 364-373:

  ```typescript
  : type === 'STAR_RESPONSE'
  ? 'STAR FORMAT: ...'
  : type === 'COVER_LETTER'
  ? `COVER LETTER FORMAT: ...`
  : 'SPECIALIST POSITIONING: ...'
  ```

  The `cold-outreach` route type resolves `docType` to `STAR_RESPONSE` (line 212 in generation.ts). So the format block for `cold-outreach` is the `STAR_RESPONSE` block, not the `COVER_LETTER` block. This means `companyResearch?.salutation` is never injected into the cold-outreach format.

  The cleanest fix: Route `cold-outreach` through the `COVER_LETTER` format block instead of `STAR_RESPONSE`, since cold outreach needs a salutation and sign-off. The change is in the prompt function:

  At line 212, change the condition to exclude `cold-outreach` from `isAcademicDoc`:
  ```typescript
  const isAcademicDoc = routeType === 'teaching-philosophy' || routeType === 'research-statement' || routeType === 'offer-negotiation' || routeType === 'linkedin-profile' || routeType === 'rejection-response';
  ```

  This makes `cold-outreach` fall through to the `COVER_LETTER` format block which uses `companyResearch?.salutation`.

  But wait — cold-outreach also shouldn't follow COVER_LETTER format exactly. It needs its own format block. Let me check if there's a simpler way.

  Actually, the cleanest approach: add a dedicated format block for `cold-outreach` in the prompt. Amend the ternary chain at line 364-373:

  ```typescript
  : type === 'COVER_LETTER'
  ? `COVER LETTER FORMAT: No headers or subheadings. 3-5 paragraphs separated by a blank line.
  SALUTATION: ${companyResearch?.salutation ?? 'Dear Hiring Manager,'}
  ...`
  : routeType === 'cold-outreach'
  ? `COLD OUTREACH FORMAT: Two variants — LinkedIn DM (≤150 words) and Email (≤200 words).
  SALUTATION: ${companyResearch?.salutation ?? 'Dear Hiring Manager,'}
  COMPANY CONTEXT: ${companyResearch?.highlights?.join(' — ') ?? 'The candidate is reaching out about this company.'}
  Follow the COLD OUTREACH RULES in the rule base for structure and tone.`
  : 'SPECIALIST POSITIONING: ...'
  ```

  This is cleaner — it doesn't change the `isAcademicDoc` classification, so the rest of the prompt behavior (first-person narrative) stays the same. It just adds a dedicated format block that uses `companyResearch`.

  Wait, but `type` at line 364 is the docType (`STAR_RESPONSE` for cold-outreach), not the route type. I need to use `routeType` for the conditional.

  Let me read the exact code once more to verify the available variable names:

  At line 209: the function signature includes `routeType?: string | null`
  At line 365: `? type === 'STAR_RESPONSE'` — here `type` is the resolved `docType` (e.g., `STAR_RESPONSE`, `COVER_LETTER`, `RESUME`)

  So the ternary checks `type` which is the resolved doc type. For cold-outreach, type === `STAR_RESPONSE`. The format block at line 365 matches on `STAR_RESPONSE`.

  If I want to differentiate within the STAR_RESPONSE block, I can check `routeType === 'cold-outreach'` there. Like this:

  ```typescript
  : type === 'STAR_RESPONSE'
  ? routeType === 'cold-outreach'
    ? `COLD OUTREACH FORMAT: Two variants — LinkedIn DM (≤150 words) and Email (≤200 words).
  SALUTATION: ${companyResearch?.salutation ?? 'Dear Hiring Manager,'}
  COMPANY CONTEXT: ${companyResearch?.highlights?.join(' — ') ?? ''}
  Follow the cold outreach rules in the rule base for structure and tone.`
    : 'STAR FORMAT: Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%). Flowing prose. First person active voice. Each component MUST be introduced with its bold label on its own line: **Situation**, **Task**, **Action**, **Result** — written exactly like that, before the prose for each component.'
  ```

  This is minimal, targeted, and doesn't affect any other document type. The same change needs to be made in both the `DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT` function (line 366) and the `DOCUMENT_GENERATION_PROMPT` function (line 591).

  Apply the same pattern at line 591-596:

  ```typescript
  : type === 'STAR_RESPONSE'
  ? routeType === 'cold-outreach'
    ? `COLD OUTREACH FORMAT: Two variants — LinkedIn DM (≤150 words) and Email (≤200 words).\nSALUTATION: ${companyResearch?.salutation ?? 'Dear Hiring Manager,'}\nCOMPANY CONTEXT: ${companyResearch?.highlights?.join(' — ') ?? ''}\nFollow the cold outreach rules in the rule base for structure and tone.`
    : `STAR FORMAT REQUIRED: ...`
  ```

---

### Task 12: Self-review and test

- [ ] Read back the plan and verify:
  - No placeholder text, TBD, or TODO
  - All file paths are real and match the codebase
  - Import paths in frontend components are correct (`../../lib/api` from `src/components/sponsors/`, `../lib/api` from `src/pages/`)
  - Token imports use correct named export pattern (`import { colors, type, spacing }`)
  - API path is `/sponsors/search` (matching the route mount `app.use('/api/sponsors', sponsorsRouter)`)
  - `POST /sponsors/unlock` body and response match Task 3 route definition

- [ ] Compile frontend: `npm run build` in project root (or run directly `npx vite build`)
- [ ] Compile backend: `cd server && npx tsc --noEmit` (type-check only, since route may not be registered for full build)
- [ ] Fix any compilation errors found

---

### Execution handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task with the full task spec, review between tasks
2. **Inline Execution** — execute all tasks in this session with batch checkpoints

Which approach?
