# Kimi Instruction File — Fix Indeed + Build LinkedIn scrapers

Date: 2026-06-20
Author: Claude (spec). Executor: Kimi.
Status: READY FOR EXECUTION.

> **EXECUTION RULES (read first)**
> 1. ZERO-LATITUDE. Do exactly what's written. No extra refactors, renames, or sources.
> 2. **[STOP]** = stop, paste the requested output into chat, wait for approval before continuing.
> 3. Follow the existing adapter pattern exactly. `seek.ts` is your reference for LLM-based
>    parsing; `jora.ts` for adapter structure.
> 4. Do NOT touch the merge / persist / cache / feed layers. Adapters only, plus the 3 wiring
>    points named in Part 2.
> 5. The LLM parse prompt text in this file is fixed — use it verbatim, do not reword it.

---

## 0. How the ingestion pipeline works (context)

Every source is an **adapter** at `server/src/services/ingestion/adapters/<name>.ts` implementing:

```ts
// server/src/services/ingestion/types.ts
export interface SourceAdapter {
  readonly source: IngestionSource;          // 'seek' | 'indeed' | 'jora' | 'linkedin' | ...
  search(query: SearchQuery): Promise<AdapterResult>;
}
export interface SearchQuery { role: string; location: string; maxPages: number; }
export interface AdapterResult { jobs: RawJob[]; report: SourceReport; }
export interface SourceReport {
  source: IngestionSource; rawCount: number; blocked: boolean;
  errorMessage: string | null; latencyMs: number; creditsUsed: number;
}
```

A job is a `RawJob` (from `server/src/services/jobFeed.ts`):
```ts
interface RawJob {
  title: string; company: string; location: string;
  salary: string | null; description: string;
  sourceUrl: string; sourcePlatform: string; postedAt: Date | null;
}
```

Adapters scrape a search URL with `firecrawlScrape(url)` → `{ markdown, blocked }`, then parse the
markdown into `RawJob[]`. **SEEK parses with an LLM** (`parseSeekMarkdown` → `callClaude` with a
fixed prompt); that is the robust pattern. Indeed/Jora currently use brittle regex.

---

## 1. The robust shared parser (build this FIRST, both adapters use it)

Indeed's current parser fails because it requires `https://au.indeed.com/view_job` URLs that no
longer exist in the markup → it extracts 0 jobs from full, non-blocked pages. Do not patch the
regex. Instead, generalise SEEK's LLM approach into one reusable parser.

**Create** `server/src/services/ingestion/parseJobsMarkdown.ts`:
- Export `async function parseJobsMarkdown(markdown: string, platform: 'indeed' | 'linkedin'): Promise<RawJob[]>`.
- Mirror `parseSeekMarkdown.ts` exactly (truncate to ~15000 chars, call the model via
  `callClaude(prompt, true, undefined, PARSE_MODEL)`, extract the JSON array between the first
  `[` and last `]`, map to `RawJob`).
- Use `PARSE_MODEL = process.env.SEEK_PARSE_MODEL || 'anthropic/claude-haiku-4-5'` (same model the
  fixed SEEK parser uses).
- Set `sourcePlatform` to the `platform` arg, `postedAt: null`, `description` to the card's teaser.
- On any error or non-JSON output, log and return `[]` (never throw).

**Create** `server/src/services/ingestion/prompts/parseJobsPrompt.ts` with this exact prompt
(Claude-owned — use verbatim):

```ts
export const PARSE_JOBS_PROMPT = (markdown: string, platform: string) => `You are extracting job listings from the raw markdown of an Australian ${platform} job-search results page.

Return ONLY a JSON array (no prose, no code fences). Each element:
{
  "title": string,            // the job title exactly as listed
  "company": string,          // employer name; "" if genuinely absent
  "location": string | null,  // suburb/city and state if shown, e.g. "Dubbo, NSW"
  "salary": string | null,    // only if explicitly shown
  "sourceUrl": string,        // the absolute URL to the job's detail page
  "teaser": string | null     // one-line snippet/summary if present
}

Rules:
- Include ONLY real job listings shown in the results. Ignore ads, "people also searched",
  navigation, filters, and recommended-search chips.
- Never invent a field. If a value is not present in the markdown, use null (or "" for company).
- sourceUrl must be the actual listing link from the markdown; skip any card that has no link.
- Do not include duplicates.

Markdown:
${markdown.slice(0, 15000)}`;
```

**[STOP]** Paste `parseJobsMarkdown.ts` + `parseJobsPrompt.ts` before wiring them into adapters.

---

## 2. Part A — Fix the Indeed adapter

File: `server/src/services/ingestion/adapters/indeed.ts`.

**Step 1 — capture reality.** Add a temporary throwaway script (`server/src/scripts/dump_indeed.ts`)
that calls `firecrawlScrape('https://au.indeed.com/jobs?q=Registered%20Nurse&l=Sydney%2C%20NSW&start=0')`
and writes the returned `markdown` to `server/src/services/ingestion/__fixtures__/indeed-search.md`.
Run it. **[STOP]** Paste the first ~80 lines of that markdown + whether `blocked` was true.
(If Indeed is hard-blocked even via Firecrawl, we stop and reconsider — don't proceed to Step 2.)

**Step 2 — swap parser to the LLM.** In `indeed.ts`, delete `parseIndeedMarkdown` (the regex
function) and replace the call site with `await parseJobsMarkdown(markdown, 'indeed')`. Keep the
rest of the adapter (URL build, firecrawl loop, blocked handling, dedupe, report) unchanged.

**Step 3 — test.** Add `adapters/indeed.test.ts` that feeds the captured `indeed-search.md`
fixture through the parse path (mock `callClaude` to return a representative JSON array, assert it
maps to `RawJob[]` correctly) — mirror the existing SEEK/adapter tests. No live network in tests.

**[STOP]** Paste the `indeed.ts` diff + test result.

---

## 3. Part B — Build the LinkedIn adapter (new)

> **Honest caveat — read before building.** LinkedIn aggressively blocks scraping. The only
> no-login surface is the **guest jobs API**, which returns plain HTML job cards and is the most
> parseable, but it is frequently rate-limited/blocked. Treat `blocked` as a normal, expected
> outcome and report it cleanly — do NOT throw or retry aggressively. If Step 1 below shows it's
> hard-blocked, we stop and tell the user LinkedIn isn't viable via Firecrawl rather than shipping
> a dead source (we already have one of those in Indeed's old state).

**Step 1 — viability check FIRST.** Add `server/src/scripts/dump_linkedin.ts` that calls
`firecrawlScrape` on the guest endpoint:
```
https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=Registered%20Nurse&location=Sydney%2C%20NSW&start=0
```
Write the markdown to `__fixtures__/linkedin-search.md`. Run it.
**[STOP]** Paste the first ~80 lines + whether `blocked` was true. **Do not build the adapter until
this confirms LinkedIn returns real job cards.** If blocked/empty, report and stop.

**Step 2 — adapter.** Only after Step 1 confirms viability, create
`server/src/services/ingestion/adapters/linkedin.ts` implementing `SourceAdapter` with
`source: 'linkedin'`. Copy the structure of `jora.ts` (URL build → firecrawl loop with maxPages
and stagger → blocked handling → dedupe by sourceUrl → SourceReport). Parse with
`await parseJobsMarkdown(markdown, 'linkedin')`. Build the guest URL with `start = (page-1)*25`.

**Step 3 — wire it in (REQUIRED — without all three it never runs):**
1. `server/src/services/ingestion/types.ts` — add `'linkedin'` to the `IngestionSource` union.
2. `server/src/config/ingestion.ts` — add `linkedin: true` to `INGESTION_SOURCES`.
3. `server/src/services/ingestion/runIngestion.ts` — import `linkedinAdapter` and add it to the
   `ALL` array.

**Step 4 — test.** Add `adapters/linkedin.test.ts` (fixture-based, mock `callClaude`, no network).

**[STOP]** Paste the new files' diffs + test results.

---

## 4. Final verification (all must pass)
- [ ] `cd server && npx tsc --noEmit` clean.
- [ ] `cd server && npm test` passes (new + existing adapter/parse tests).
- [ ] Delete the throwaway `dump_*.ts` scripts before final commit (keep the `__fixtures__/*.md`).
- [ ] Confirm via one live build log that `[scrapeJobsForTitles] Reports:` now shows non-zero
      `indeed=` and (if viable) `linkedin=` counts for a common role/city.

## 5. Out of scope (do NOT do here)
- Changing the merge/relevance/location filters, the cache, or the feed build.
- Re-enabling jsearch.
- Auth-based LinkedIn scraping (guest surface only).
