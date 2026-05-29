# Visa Sponsor Directory — Design Spec

## Overview

A public landing page (`/visa-sponsors`) listing ~1,200 Australian companies that sponsor visas. Searchable, filterable, with an email gate that withholds contact links until capture. Uses existing landing aesthetic (petrol/gold/warm tokens, inline styles + `<style>` `@media` responsive pattern).

## Architecture

- **Data:** Prisma `Sponsor` table seeded from scraped JSON (one-time script, re-runnable)
- **Server gate:** `GET /api/sponsors/search` omits `website`, `careersUrl`, `careersSearchUrl` from results for anonymous visitors
- **Unlock:** `POST /api/sponsors/unlock { email }` sets httpOnly signed cookie; returns unlocked records for in-place swap
- **Search:** Postgres `ILIKE` on `cleanName` + `hiringProfile`; `WHERE` clauses for industry/location/confidence filters
- **Confidence filter:** `confidence === "high"` only
- **Sort:** `confidence DESC` (high→medium→low), then `cleanName ASC`
- **Login bypass:** Authenticated users see all data — no modal, no gate. The endpoint checks `req.user` and returns full records.

## Page Layout (`/visa-sponsors`)

Top to bottom:
1. **Hero** — headline + subhead + search bar
2. **Filter bar** — industry dropdown, location dropdown, "High confidence only" toggle chip
3. **Results line** — "47 sponsors hiring in Healthcare near you" — updates with current filters + total
4. **Results grid** — company cards, 3→2→1 columns at 1024/768/640 breakpoints
5. **Load more** — manual button at bottom, not infinite auto-scroll
6. **Landing footer** — reuse `LandingFooter` component

## Sponsor Card

Each card shows:
- **cleanName** (bold, 17px)
- **industry** tag (petrol chip)
- **locations** (comma-separated)
- **hiringProfile** (1-line, textSecondary)
- **Website** link — locked pill pre-unlock, active link post-unlock
- **Careers** link — locked pill pre-unlock, active link post-unlock (falls back: careersUrl → careersSearchUrl → hidden)

Locked pills: gold-outlined pill, clicking opens email capture modal. Both Website and Careers get the same treatment.

## Email Gate Flow

1. Anonymous user clicks locked pill → modal slides up (dark overlay, centered card)
2. Modal: "Enter your email to view contact links" + email input + submit button + "No spam, unsubscribe anytime" fine print
3. Submit → `POST /api/sponsors/unlock` → server sets `sponsor_unlock` httpOnly signed cookie, returns unlocked records
4. Modal closes → locked pills transition to active links (in-place, no refresh)
5. Cookie persists — subsequent searches return full data automatically
6. Track `sponsor_email_captured` in PostHog
7. Logged-in users: no modal ever, full data from first request

## Exit-intent / secondary trigger (optional v1 add)

If user does 2+ searches without clicking a link, show a softer CTA below the results count: "See contact details — enter your email." Not in the critical path but cheap to add.

## Prisma Model

```prisma
enum SponsorConfidence {
  high
  medium
  low
}

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

## API Endpoints

### GET /api/sponsors/search

Query params: `?q=&industry=&location=&highConfidence=true&page=1&pageSize=20`

Response (anonymous):
```json
{
  "total": 47,
  "page": 1,
  "pageSize": 20,
  "results": [
    {
      "id": "uuid",
      "cleanName": "Company Name",
      "industry": "Healthcare",
      "locations": ["Sydney NSW"],
      "hiringProfile": "Seeking civil engineers",
      "confidence": "high",
      "website": null,
      "careersUrl": null,
      "careersSearchUrl": null
    }
  ],
  "industries": ["Healthcare", "Technology", ...],
  "locations": ["Sydney NSW", "Melbourne VIC", ...]
}
```

Response (unlocked or authenticated):
- Same shape, but `website`, `careersUrl`, `careersSearchUrl` populated
- The frontend checks for null/undefined on these fields to decide render

### POST /api/sponsors/unlock

Request: `{ email: string }`

Response:
```json
{
  "success": true,
  "unlockedResults": [ ... ] // same shape as search results but with links
}
```

Sets cookie: `sponsor_unlock` (signed, httpOnly, 30-day expiry)

The search response includes `industries`/`locations` computed from the *unfiltered* dataset (ignoring the current query/filters) — the client uses those to populate dropdowns on first load. No separate filters endpoint needed.

## cold-outreach Integration

The "Write my outreach email" CTA on each card is **login + paid only**. Two states:
- **Logged in + paid subscription:** CTA navigates to workspace with company pre-filled. Calls `POST /generate/cold-outreach` and passes `companyResearch` (not the JD-hack from JobCard.tsx). A small backend change to let `cold-outreach` accept and use `companyResearch` body field.
- **Not paid / anonymous:** CTA shows blurred preview of a sample email + "Start your trial to unlock" CTA. Same wall as the rest of the app.

The endpoint itself stays behind `checkAccess('generation')` — no exposure to anonymous visitors.

## Responsive Breakpoints

Following landing pattern (inline styles + `<style>` tag overrides):

| Breakpoint | Grid cols | Section padding |
|---|---|---|
| Desktop (>1024px) | 3 | 120px 24px |
| ≤1024px | 2 | 120px 24px |
| ≤768px | 2 | 120px 24px |
| ≤640px | 1 | 72px 20px |

Cards stack vertically at mobile. Search bar and filter bar collapse to full width.

## Tracked Events (PostHog)

New helpers in `analytics.ts`, mirroring `trackLanding*` pattern:
- `sponsor_directory_viewed` — page mount
- `sponsor_search_performed(q, filters, result_count)` — any filter/search change
- `sponsor_email_gate_shown` — modal opened
- `sponsor_email_captured` — email submitted + unlock success
- `sponsor_links_unlocked` — fired once after unlock (not per-card)
- `sponsor_outreach_locked_clicked` — blurred CTA click
- `sponsor_trial_cta_clicked` — trial CTA click

## Files to Create/Modify

### New files:
- `server/prisma/migrations/XXXX_add_sponsor_model` — migration
- `server/src/routes/sponsors.ts` — search + unlock + filters endpoints
- `server/src/scripts/seed_sponsors.ts` — seed script from JSON
- `src/pages/VisaSponsorsPage.tsx` — the page
- `src/components/sponsors/SponsorHero.tsx` — hero section
- `src/components/sponsors/SponsorSearchBar.tsx` — search input
- `src/components/sponsors/SponsorFilterBar.tsx` — industry/location/confidence filters
- `src/components/sponsors/SponsorCard.tsx` — company card
- `src/components/sponsors/SponsorResultsGrid.tsx` — grid + load more
- `src/components/sponsors/SponsorEmailModal.tsx` — email capture modal

### Modified files:
- `server/src/app.ts` — mount sponsor routes + register with ensureColumns
- `server/prisma/schema.prisma` — add Sponsor model + SponsorConfidence enum
- `src/App.tsx` — add `/visa-sponsors` route
- `src/lib/analytics.ts` — add sponsor tracking helpers
- `server/src/routes/generate.ts` — let `cold-outreach` accept `companyResearch`
- `server/src/lib/ensureColumns.ts` — register Sponsor table

## Not in v1
- Pinecone semantic search
- Saved/sponsored company lists for logged-in users
- Email notifications when new sponsors are added
- Company detail page (click-through from card)
