# Fix-my-Resume → Job-Selection Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** After the email/roadmap unlock, add a "Fix my Resume" CTA → a job-selection modal that infers 3 locally-attainable titles, lets the user adjust title(s)+location, runs an Apify/Seek scrape in the background while they read, and stores the results server-side by `scanId`. Anonymous. Ends at scrape storage — no dashboard, no auth.

**Architecture:** 3 new endpoints on the existing `cv-scan` route + 2 backend services + 1 React modal. The scrape is fire-and-forget with poll-for-status and a `requestId` supersede guard.

**Tech Stack:** Express/TypeScript, Prisma, Apify (`websift/seek-job-scraper`), React/Vite/framer-motion, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-04-fix-my-resume-job-modal-design.md`

---

## ⚠️ INSTRUCTIONS FOR DEEPSEEK — READ BEFORE STARTING

Zero-latitude plan. You are a careful executor.

1. **You do NOT write any user-facing copy.** Every string the user sees already lives in `src/pages/fixMyResumeCopy.ts` (pre-authored). Import from it and render verbatim. Never inline, reword, or invent strings. The LLM prompt text in Task 2 is also fixed — copy it exactly.
2. **Copy every code block verbatim.** Do not rename, refactor, restyle, add features, or change design tokens.
3. **Do tasks in order.** Each ends with passing tests/build + a commit. Don't start the next until the current is committed green.
4. **STOP-and-report (do not improvise) if:** a test fails unexpectedly, a command errors, a "Modify" step's existing code doesn't match what's shown, an import path doesn't resolve, or the `deduplicateJobs` util signature differs from Task 3. Report and wait.
5. Run all `npm`/`npx` commands from inside `server/` for backend tasks and from repo root for frontend type-checks (`npx tsc -p tsconfig.json --noEmit`).

Repo root: `E:\AntiGravity\JobHub`. Backend package: `server/`. Frontend is the root Vite app.

---

## File Structure

**Pre-authored (DO NOT EDIT):** `src/pages/fixMyResumeCopy.ts`

**New:**
- `server/src/services/jobTitleSuggest.ts` (+ `.test.ts`)
- `server/src/services/userJobScrape.ts`
- `src/pages/FixMyResumeModal.tsx`

**Modified:**
- `server/src/routes/cv-scan.ts` — `jobScrapeStore` + 3 endpoints.
- `src/pages/MockLandingPage.tsx` — CTA + modal state/mount.

---

## Task 1: Title-suggestion service (TDD)

**Files:**
- Create: `server/src/services/jobTitleSuggest.ts`
- Create: `server/src/services/jobTitleSuggest.test.ts`

- [ ] **Step 1: Write the failing test** — create `server/src/services/jobTitleSuggest.test.ts` with EXACTLY this content:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the LLM wrapper so tests never hit the network.
vi.mock('../utils/callLLMWithRetry', () => ({ callLLMWithRetry: vi.fn() }));

import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { buildTitlePrompt, suggestJobTitles } from './jobTitleSuggest';

const mockLLM = callLLMWithRetry as unknown as ReturnType<typeof vi.fn>;
const baseResult = { inferredRole: 'Marketing Manager' } as any;

beforeEach(() => { mockLLM.mockReset(); });

describe('buildTitlePrompt', () => {
  it('includes the resume text, inferred role, and the local-experience down-rank rule', () => {
    const p = buildTitlePrompt('10 years marketing in Dubai', 'Marketing Manager');
    expect(p).toContain('10 years marketing in Dubai');
    expect(p).toContain('Marketing Manager');
    expect(p.toLowerCase()).toContain('overseas');
    expect(p).toContain('"titles"');
  });
});

describe('suggestJobTitles', () => {
  it('falls back to the inferred role when the LLM throws', async () => {
    mockLLM.mockRejectedValueOnce(new Error('boom'));
    const r = await suggestJobTitles('resume', baseResult);
    expect(r.titles).toEqual(['Marketing Manager']);
    expect(r.location).toBeNull();
  });

  it('parses, trims, and caps titles at 3', async () => {
    mockLLM.mockResolvedValueOnce(JSON.stringify({ titles: ['  A ', 'B', '', 'C', 'D'], location: 'Sydney NSW' }));
    const r = await suggestJobTitles('resume', baseResult);
    expect(r.titles).toEqual(['A', 'B', 'C']);
    expect(r.location).toBe('Sydney NSW');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `server/`): `npx vitest run src/services/jobTitleSuggest.test.ts`
Expected: FAIL — cannot find module `./jobTitleSuggest` / `buildTitlePrompt` not exported.

- [ ] **Step 3: Implement** — create `server/src/services/jobTitleSuggest.ts`

```ts
import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { parseLLMJson } from '../utils/parseLLMResponse';
import type { CvGapResult } from './cvGapScan';

export interface TitleSuggestion {
  titles: string[];
  location: string | null;
}

// PURE — unit-testable, no network.
export function buildTitlePrompt(resumeText: string, inferredRole: string): string {
  return [
    'You are an Australian recruitment strategist.',
    'Return the 3 job titles this candidate can REALISTICALLY land in Australia RIGHT NOW, most-attainable first.',
    'Critical rule: candidates whose experience is entirely overseas are routinely auto-rejected for senior/manager roles here — employers assume the skills are not transferable and there is no local vouch.',
    'So when the resume shows foreign-only or thin local experience, down-rank seniority and suggest the realistic entry/bridge rung (e.g. "Marketing Coordinator", not "Head of Marketing"). Reason it from the resume — never apply a fixed rule.',
    'Also infer their most likely job-search location (an Australian city) from the resume, or null if genuinely unclear.',
    `Their inferred current role is: ${inferredRole || 'unknown'}.`,
    'Return STRICT JSON only, no prose: {"titles": ["..","..",".."], "location": "City, State" | null}. Exactly 3 titles.',
    '--- RESUME ---',
    resumeText.slice(0, 12000),
  ].join('\n');
}

export async function suggestJobTitles(resumeText: string, result: CvGapResult): Promise<TitleSuggestion> {
  const inferredRole = result.inferredRole || '';
  try {
    const raw = await callLLMWithRetry(buildTitlePrompt(resumeText, inferredRole), true, 3, 0);
    const parsed = parseLLMJson(raw) as { titles?: unknown; location?: unknown };
    const titles = Array.isArray(parsed.titles)
      ? parsed.titles.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map(t => t.trim()).slice(0, 3)
      : [];
    const location = typeof parsed.location === 'string' && parsed.location.trim() ? parsed.location.trim() : null;
    if (titles.length === 0) throw new Error('no titles');
    return { titles, location };
  } catch {
    // Robust fallback — never block the user on an LLM hiccup.
    return { titles: [inferredRole || 'Entry-level roles'], location: null };
  }
}
```

- [ ] **Step 4: Run to verify all pass**

Run: `npx vitest run src/services/jobTitleSuggest.test.ts`
Expected: PASS (both describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/jobTitleSuggest.ts server/src/services/jobTitleSuggest.test.ts
git commit -m "feat(fix-resume): job-title suggestion service (local-aware, fallback-safe)"
```

---

## Task 2: Job-scrape service

**Files:**
- Create: `server/src/services/userJobScrape.ts`

- [ ] **Step 1: Create `server/src/services/userJobScrape.ts`** with EXACTLY this content (deduped by `sourceUrl` locally — do not import `deduplicateJobs`, whose signature takes two arrays):

```ts
import type { RawJob } from './jobFeed';
import { buildSeekClusterKey, fetchSeekJobsForCluster } from './seekScraper';

// Scrape Seek for each chosen title at the chosen location; merge + dedupe by sourceUrl.
export async function scrapeJobsForTitles(titles: string[], location: string): Promise<RawJob[]> {
  const bySourceUrl = new Map<string, RawJob>();
  for (const title of titles) {
    const key = buildSeekClusterKey(title, location, null);
    const jobs = await fetchSeekJobsForCluster(key); // default maxResults 30, dateRange 7
    for (const job of jobs) {
      if (job.sourceUrl && !bySourceUrl.has(job.sourceUrl)) bySourceUrl.set(job.sourceUrl, job);
    }
  }
  return [...bySourceUrl.values()];
}
```

- [ ] **Step 2: Verify build**

Run (from `server/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/userJobScrape.ts
git commit -m "feat(fix-resume): scrapeJobsForTitles (reuses Apify/Seek pipeline)"
```

---

## Task 3: Backend endpoints + store on `cv-scan.ts`

**Files:**
- Modify: `server/src/routes/cv-scan.ts`

- [ ] **Step 1: Add imports.** At the top of `server/src/routes/cv-scan.ts`, after the existing imports, add:

```ts
import type { RawJob } from '../services/jobFeed';
import { suggestJobTitles } from '../services/jobTitleSuggest';
import { scrapeJobsForTitles } from '../services/userJobScrape';
```

- [ ] **Step 2: Add the scrape store.** Immediately after the existing `scanStore` definition + its eviction helper, add:

```ts
// ── Job-scrape store (scanId → background scrape state) ──────────────────────
type ScrapeStatus = 'pending' | 'ready' | 'error';
interface ScrapeEntry {
  requestId: string;
  status: ScrapeStatus;
  titles: string[];
  location: string;
  jobs: RawJob[];
  error: string | null;
  at: number;
}
const jobScrapeStore = new Map<string, ScrapeEntry>();
const SCRAPE_TTL = 60 * 60 * 1000; // 60 min

function evictScrapeStore() {
  if (jobScrapeStore.size <= 100) return;
  const sorted = [...jobScrapeStore.entries()].sort((a, b) => b[1].at - a[1].at);
  jobScrapeStore.clear();
  for (const [k, v] of sorted.slice(0, 100)) jobScrapeStore.set(k, v);
}

function getFreshScrape(scanId: string): ScrapeEntry | null {
  const e = jobScrapeStore.get(scanId);
  if (!e) return null;
  if (Date.now() - e.at > SCRAPE_TTL) { jobScrapeStore.delete(scanId); return null; }
  return e;
}
```

- [ ] **Step 3: Add the three endpoints.** Place these AFTER the existing `POST /lead` handler (before `export default router` / `export { router }` — match whatever the file already uses):

```ts
// ── POST /api/cv-scan/job-titles ─────────────────────────────────────────────
router.post('/job-titles', ipRateLimit, async (req: Request, res: Response) => {
  try {
    const { scanId } = req.body as { scanId?: string };
    if (!scanId) { res.status(400).json({ error: 'scanId required' }); return; }
    const entry = scanStore.get(scanId);
    if (!entry) { res.status(404).json({ error: 'SESSION_EXPIRED' }); return; }

    const { titles, location } = await suggestJobTitles(entry.resumeText, entry.result);
    res.json({ titles, location, firstName: entry.result.firstName || '' });
  } catch (err) {
    console.error('[cv-scan/job-titles]', err instanceof Error ? err.message : String(err));
    res.status(502).json({ error: 'Could not infer roles, please try again.' });
  }
});

// ── POST /api/cv-scan/scrape-jobs ────────────────────────────────────────────
router.post('/scrape-jobs', ipRateLimit, async (req: Request, res: Response) => {
  try {
    const { scanId, titles, location } = req.body as { scanId?: string; titles?: string[]; location?: string };
    if (!scanId) { res.status(400).json({ error: 'scanId required' }); return; }
    if (!scanStore.has(scanId)) { res.status(404).json({ error: 'SESSION_EXPIRED' }); return; }

    const cleanTitles = Array.isArray(titles)
      ? Array.from(new Set(titles.map(t => (t || '').trim()).filter(Boolean))).slice(0, 3)
      : [];
    if (cleanTitles.length === 0) { res.status(400).json({ error: 'titles required' }); return; }
    const cleanLocation = (location || '').trim() || 'All Australia';

    const requestId = randomUUID();
    jobScrapeStore.set(scanId, {
      requestId, status: 'pending', titles: cleanTitles, location: cleanLocation, jobs: [], error: null, at: Date.now(),
    });
    evictScrapeStore();

    // Fire-and-forget; only the newest request may write results.
    scrapeJobsForTitles(cleanTitles, cleanLocation)
      .then(jobs => {
        const cur = jobScrapeStore.get(scanId);
        if (cur && cur.requestId === requestId) {
          jobScrapeStore.set(scanId, { ...cur, status: 'ready', jobs, at: Date.now() });
        }
      })
      .catch(err => {
        const cur = jobScrapeStore.get(scanId);
        if (cur && cur.requestId === requestId) {
          jobScrapeStore.set(scanId, { ...cur, status: 'error', error: err instanceof Error ? err.message : String(err), at: Date.now() });
        }
      });

    res.json({ status: 'started' });
  } catch (err) {
    console.error('[cv-scan/scrape-jobs]', err instanceof Error ? err.message : String(err));
    res.status(502).json({ error: 'Could not start job search, please try again.' });
  }
});

// ── GET /api/cv-scan/scrape-jobs?scanId= ─────────────────────────────────────
router.get('/scrape-jobs', (req: Request, res: Response) => {
  const scanId = String(req.query.scanId || '');
  const entry = getFreshScrape(scanId);
  if (!entry) { res.json({ status: 'pending', count: 0 }); return; }
  res.json({ status: entry.status, count: entry.jobs.length, titles: entry.titles, location: entry.location, error: entry.error });
});
```

- [ ] **Step 4: Verify build**

Run (from `server/`): `npx tsc --noEmit`
Expected: no errors. (If `ipRateLimit` or `randomUUID` are reported undefined, they are already imported at the top of this file — confirm; do not re-import.)

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/cv-scan.ts
git commit -m "feat(fix-resume): job-titles + scrape-jobs endpoints with supersede guard"
```

---

## Task 4: The modal component

**Files:**
- Create: `src/pages/FixMyResumeModal.tsx`

- [ ] **Step 1: Create `src/pages/FixMyResumeModal.tsx`** with EXACTLY this content:

```tsx
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil, MapPin } from 'lucide-react';
import api from '../lib/api';
import { colors, type as typeTokens } from '../components/landing/tokens';
import { fixMyResumeCopy as C } from './fixMyResumeCopy';

type ScrapeStatus = 'idle' | 'pending' | 'ready' | 'error';

interface Props {
  scanId: string;
  firstName?: string;
  onClose: () => void;
}

export default function FixMyResumeModal({ scanId, firstName, onClose }: Props) {
  const [titles, setTitles] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [titlesLoading, setTitlesLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>('idle');
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function startScrape(nextTitles: string[], nextLocation: string) {
    if (nextTitles.length === 0) return;
    setScrapeStatus('pending');
    stopPolling();
    try {
      await api.post('/cv-scan/scrape-jobs', { scanId, titles: nextTitles, location: nextLocation }, { timeout: 20000 });
    } catch {
      setScrapeStatus('error');
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get('/cv-scan/scrape-jobs', { params: { scanId } });
        const status = res.data.status as ScrapeStatus;
        if (status === 'ready') { setCount(res.data.count ?? 0); setScrapeStatus('ready'); stopPolling(); }
        else if (status === 'error') { setScrapeStatus('error'); stopPolling(); }
      } catch { /* keep polling */ }
    }, 2000);
  }

  // On mount: infer titles, then auto-start the scrape.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.post('/cv-scan/job-titles', { scanId }, { timeout: 30000 });
        if (cancelled) return;
        const t: string[] = (res.data.titles || []).slice(0, 3);
        const loc: string = res.data.location || 'All Australia';
        setTitles(t);
        setLocation(loc);
        setTitlesLoading(false);
        startScrape(t, loc);
      } catch (err: any) {
        if (cancelled) return;
        if (err?.response?.status === 404) { setExpired(true); setTitlesLoading(false); }
        else { setTitlesLoading(false); setScrapeStatus('error'); }
      }
    })();
    return () => { cancelled = true; stopPolling(); if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);

  // Re-scrape (debounced) after the user edits titles/location.
  function scheduleRescrape(nextTitles: string[], nextLocation: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => startScrape(nextTitles, nextLocation), 600);
  }

  function updateTitle(i: number, value: string) {
    const next = titles.map((t, idx) => (idx === i ? value : t));
    setTitles(next);
    scheduleRescrape(next.filter(Boolean), location);
  }
  function removeTitle(i: number) {
    const next = titles.filter((_, idx) => idx !== i);
    setTitles(next);
    scheduleRescrape(next.filter(Boolean), location);
  }
  function addTitle() {
    if (titles.length >= 3) return;
    setTitles([...titles, '']);
  }
  function updateLocation(value: string) {
    setLocation(value);
    scheduleRescrape(titles.filter(Boolean), value);
  }

  const ready = scrapeStatus === 'ready';
  const showError = scrapeStatus === 'error' || (ready && count === 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,14,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          onClick={e => e.stopPropagation()}
          style={{ width: '100%', maxWidth: 440, background: colors.bgCanvas, borderRadius: 18, padding: 24, boxShadow: '0 24px 60px rgba(20,18,14,0.28)', position: 'relative' }}
        >
          <button onClick={onClose} aria-label="Close"
            style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted, padding: 4 }}>
            <X size={18} />
          </button>

          {expired ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <h3 style={{ fontFamily: typeTokens.body, fontSize: 16, fontWeight: 700, color: colors.textPrimary, margin: '0 0 6px' }}>{C.expired.title}</h3>
              <p style={{ fontFamily: typeTokens.body, fontSize: 13, color: colors.textSecondary, margin: 0 }}>{C.expired.body}</p>
            </div>
          ) : done ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '16px 0' }}>
              <h3 style={{ fontFamily: typeTokens.body, fontSize: 19, fontWeight: 800, color: colors.accentPetrol, margin: '0 0 8px' }}>{C.success.title(count)}</h3>
              <p style={{ fontFamily: typeTokens.body, fontSize: 13, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>{C.success.sub}</p>
            </motion.div>
          ) : (
            <>
              <h3 style={{ fontFamily: typeTokens.body, fontSize: 17, fontWeight: 800, color: colors.textPrimary, margin: '0 30px 6px 0', lineHeight: 1.3 }}>
                {C.modal.header(firstName || '')}
              </h3>
              <p style={{ fontFamily: typeTokens.body, fontSize: 12.5, color: colors.textSecondary, margin: '0 0 18px', lineHeight: 1.45 }}>
                {C.modal.subhead}
              </p>

              <div style={{ fontFamily: typeTokens.body, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMuted, marginBottom: 8 }}>
                {C.modal.rolesLabel} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· {C.modal.rolesHint}</span>
              </div>

              {titlesLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
                      style={{ height: 38, borderRadius: 10, background: colors.bgAlt }} />
                  ))}
                  <p style={{ fontFamily: typeTokens.body, fontSize: 11, color: colors.textMuted, margin: '2px 0 0', fontStyle: 'italic' }}>{C.modal.thinking}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {titles.map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${colors.borderDefined}`, borderRadius: 10, padding: '8px 10px', background: colors.bgAlt }}>
                      <Pencil size={13} color={colors.textMuted} style={{ flexShrink: 0 }} />
                      <input value={t} onChange={e => updateTitle(i, e.target.value)}
                        style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: typeTokens.body, fontSize: 13, fontWeight: 600, color: colors.textPrimary }} />
                      <button onClick={() => removeTitle(i)} aria-label="Remove role"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted, padding: 2 }}><X size={14} /></button>
                    </div>
                  ))}
                  {titles.length < 3 && (
                    <button onClick={addTitle}
                      style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', fontFamily: typeTokens.body, fontSize: 12, fontWeight: 600, color: colors.accentPetrol, padding: '2px 0' }}>
                      {C.modal.addRole}
                    </button>
                  )}
                </div>
              )}

              <div style={{ fontFamily: typeTokens.body, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMuted, marginBottom: 8 }}>
                {C.modal.locationLabel}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${colors.borderDefined}`, borderRadius: 10, padding: '8px 10px', background: colors.bgAlt, marginBottom: 6 }}>
                <MapPin size={14} color={colors.textMuted} style={{ flexShrink: 0 }} />
                <input value={location} onChange={e => updateLocation(e.target.value)} placeholder="All Australia"
                  style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: typeTokens.body, fontSize: 13, color: colors.textPrimary }} />
              </div>
              <p style={{ fontFamily: typeTokens.body, fontSize: 11, color: colors.textMuted, margin: '0 0 18px', lineHeight: 1.4 }}>{C.modal.locationNudge}</p>

              {showError && (
                <p style={{ fontFamily: typeTokens.body, fontSize: 11.5, color: '#C2603F', margin: '0 0 12px', lineHeight: 1.4 }}>{C.modal.emptyOrError}</p>
              )}

              <motion.button
                onClick={() => { if (ready) setDone(true); }}
                disabled={!ready}
                animate={ready ? { boxShadow: ['0 0 0 0 rgba(45,90,110,0)', '0 0 0 6px rgba(45,90,110,0.12)', '0 0 0 0 rgba(45,90,110,0)'] } : {}}
                transition={{ duration: 1.6, repeat: ready ? Infinity : 0 }}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
                  fontFamily: typeTokens.body, fontSize: 13, fontWeight: 700,
                  cursor: ready ? 'pointer' : 'default',
                  background: ready ? colors.accentPetrol : colors.borderDefined,
                  color: ready ? colors.textOnDeep : colors.textMuted,
                }}>
                {ready ? `${C.modal.ctaReady} →` : C.modal.searching}
              </motion.button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Type-check the frontend**

Run (from repo root): `npx tsc -p tsconfig.json --noEmit`
Expected: no errors referencing `FixMyResumeModal.tsx`. (The `lucide-react` icons `X`/`Pencil`/`MapPin` and the tokens `colors.bgCanvas`/`bgAlt`/`borderDefined`/`textOnDeep`/`textMuted`/`textPrimary`/`textSecondary`/`accentPetrol` all exist — confirm imports resolve.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/FixMyResumeModal.tsx
git commit -m "feat(fix-resume): job-selection modal (poll + supersede, on-brand tokens)"
```

---

## Task 5: CTA + modal mount in `MockLandingPage.tsx`

**Files:**
- Modify: `src/pages/MockLandingPage.tsx`

- [ ] **Step 1: Add imports.** Near the existing imports (after `import api from '../lib/api';`), add:

```tsx
import FixMyResumeModal from './FixMyResumeModal';
import { fixMyResumeCopy as fixCopy } from './fixMyResumeCopy';
```

- [ ] **Step 2: Add modal state.** In the same component that holds `revealStep`/`roadmap` state (where `const [roadmap, setRoadmap] = useState...` lives), add:

```tsx
  const [showFixModal, setShowFixModal] = useState(false);
```

- [ ] **Step 3: Insert the CTA inside the roadmap block.** In `src/pages/MockLandingPage.tsx`, find the roadmap steps closing `</div>` followed by the `<div style={{ marginTop: 14 }}>` that wraps the "Scan a different CV" button (around line 525). **Immediately before** that `<div style={{ marginTop: 14 }}>`, insert:

```tsx
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${colors.borderDefined}` }}>
                  <p style={{ fontFamily: typeTokens.body, fontSize: 12.5, color: colors.textSecondary, margin: '0 0 10px', lineHeight: 1.45 }}>
                    {fixCopy.cta.bridge}
                  </p>
                  <motion.button
                    onClick={() => setShowFixModal(true)}
                    animate={{ boxShadow: ['0 0 0 0 rgba(45,90,110,0)', '0 0 0 6px rgba(45,90,110,0.12)', '0 0 0 0 rgba(45,90,110,0)'] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                    style={{
                      width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
                      fontFamily: typeTokens.body, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      background: colors.accentPetrol, color: colors.textOnDeep,
                    }}>
                    {fixCopy.cta.button} →
                  </motion.button>
                  <p style={{ fontFamily: typeTokens.body, fontSize: 10.5, color: colors.textMuted, margin: '8px 0 0', textAlign: 'center' }}>
                    {fixCopy.cta.eta}
                  </p>
                </div>
```

- [ ] **Step 4: Mount the modal.** Find where `result` is in scope in the render (the same area that renders the reveal panel). Add, just before the component's final closing fragment/return-tag:

```tsx
      {showFixModal && result?.scanId && (
        <FixMyResumeModal
          scanId={result.scanId}
          firstName={result.firstName}
          onClose={() => setShowFixModal(false)}
        />
      )}
```

**STOP-and-report** if `result` is not in scope at the chosen mount point — report the surrounding JSX so the correct location can be confirmed. Do not duplicate state or move large blocks.

- [ ] **Step 5: Type-check + build the frontend**

Run (from repo root): `npx tsc -p tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/MockLandingPage.tsx
git commit -m "feat(fix-resume): Fix-my-Resume CTA + modal mount on roadmap"
```

---

## Task 6: End-to-end verification (report, do not fix beyond plan)

**Files:** none.

- [ ] **Step 1: Backend tests green**

Run (from `server/`): `npx vitest run src/services/jobTitleSuggest.test.ts`
Expected: PASS.

- [ ] **Step 2: Both builds clean**

Run (from `server/`): `npx tsc --noEmit` → no errors.
Run (from repo root): `npx tsc -p tsconfig.json --noEmit` → no errors.

- [ ] **Step 3: Manual flow** (requires `.env` with `DATABASE_URL` + `APIFY_API_KEY`, server running, frontend running). On `/mock-landing`: upload a resume → reveal → enter email → roadmap appears → click **Fix my Resume** → modal opens with skeleton → 3 role chips + a location populate → button reads "Finding your matches…" then enables → click **See my jobs** → success state shows a non-zero count.

- [ ] **Step 4: Report back** the observed behaviour at each stage above plus the network responses from `POST /cv-scan/job-titles` and `GET /cv-scan/scrape-jobs`. **STOP-and-report** (do not patch) if: the modal copy differs from `fixMyResumeCopy.ts`, the count is 0 for a common title, or the button never enables.

---

## Self-Review (by plan author)

**Spec coverage:** job-titles endpoint + service (Task 1, 3) ✓; scrape-jobs POST/GET + store + supersede (Task 3) ✓; userJobScrape reuse (Task 2) ✓; CTA on existing roadmap (Task 5) ✓; modal with skeleton/poll/edit/success/expired states (Task 4) ✓; all error rows from spec §5 (Task 3 handlers + modal `showError`/`expired`) ✓; tests (Task 1) + manual acceptance (Task 6) ✓.

**Copy ownership:** every user-facing string routes through `fixMyResumeCopy.ts`; the DeepSeek instruction block forbids inventing strings. ✓

**Placeholder scan:** none — all code complete.

**Type consistency:** `TitleSuggestion`/`CvGapResult` (Task 1) consumed in Task 3; `RawJob` import added Task 3 Step 1, used by store + `scrapeJobsForTitles`; `ScrapeStatus` union identical in backend store and modal; endpoint shapes (`{titles,location,firstName}`, `{status:'started'}`, `{status,count,...}`) match the modal's reads. ✓
