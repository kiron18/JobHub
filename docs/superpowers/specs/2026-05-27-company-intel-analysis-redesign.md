# Company Intel + Analysis Results Redesign

**Date:** 2026-05-27
**Status:** Ready for implementation

---

## 1. Summary

Two parts:

1. **Company Intel** — when a user clicks Analyse on a job, a Perplexity `sonar-pro` call (via OpenRouter) fires **in the background**, researches the intersection of the candidate's profile, the job description, and the target company, and persists the result on the `JobApplication` row. The user does not wait on it; it sits ready for when they reach the cover letter stage.

2. **Analysis Results Page Redesign** — re-labelled cards, action-oriented copy, inline bridging UX, a single sticky apply bar. No company intel surfaces here.

The cover letter generation flow (separate follow-up spec) will consume the persisted intel.

---

## 2. Backend: Company Intel

### 2.1 New service: `server/src/services/companyIntel.ts`

```typescript
export async function fetchCompanyIntel(params: {
  companyName: string;
  jobTitle: string;
  jobExcerpts: string[];        // 2-3 key lines from JD (tools, tech, requirements)
  candidateSkills: string[];    // top 5-7 relevant skills from profile
}): Promise<CompanyIntelResult>;
```

Calls `perplexity/sonar-pro` via OpenRouter chat completions with a structured instruction prompt.

### 2.2 Prompt

```
Company: {companyName}
Job Title: {jobTitle}
Key requirements from the job: {jobExcerpts}
Candidate's relevant strengths: {candidateSkills}

Research the intersection of this candidate, this job, and this company.
Find specific, concrete connections the candidate can reference in a cover letter.

Return JSON:
{
  "summary": "3-4 sentence paragraph — specific tools, projects, initiatives, or culture signals that connect the candidate to this company",
  "suggestedContact": {
    "title": "e.g. Head of Marketing, CTO, HR Manager, Founder/CEO",
    "reason": "One sentence explaining why this person is the right contact"
  }
}
```

Job title only — no named contacts. Avoids hallucination risk and the SerpAPI rabbit hole.

### 2.3 `callPerplexity` in `server/src/services/llm.ts`

New function (~25 lines) mirroring the existing `callLLM` pattern.

- Model: `perplexity/sonar-pro`
- Endpoint: existing `openrouter.ai/api/v1/chat/completions`
- Timeout: 8 seconds
- Returns: `{ content: string; citations: string[] }` — extracts `response.data.choices[0].message.content` and `response.data.citations`

### 2.4 Storage: new column on `JobApplication`

```prisma
companyIntel  Json?
```

Add to `ensureColumns()` in `server/src/index.ts`:

```sql
ALTER TABLE "JobApplication"
  ADD COLUMN IF NOT EXISTS "companyIntel" JSONB;
```

Persisted shape:

```typescript
{
  summary: string;
  suggestedContact: { title: string; reason: string };
  citations: string[];
  fetchedAt: string;  // ISO timestamp
}
```

### 2.5 Integration into `POST /api/analyze/dual`

In `server/src/routes/analyze.ts`, after the analysis result is built and the JobApplication row exists/updated (~line 502):

1. Build the Perplexity prompt from available data (company, role, JD excerpts, profile skills)
2. **Fire-and-forget** — do NOT await:
   ```typescript
   fetchCompanyIntel(params)
     .then(intel => prisma.jobApplication.update({
       where: { id: jobApplicationId },
       data: { companyIntel: { ...intel, fetchedAt: new Date().toISOString() } },
     }))
     .catch(err => console.warn('[companyIntel] background fetch failed:', err.message));
   ```
3. Analysis response returns immediately — no latency added, no field added to the response.

**Re-analysing the same job** triggers a fresh intel fetch (overwrites the existing row).

### 2.6 Why background, not response field

The intel is read at cover letter generation time, not on the analysis results page. Wiring it into the response would add 3-8s of latency for nothing — the user doesn't see it until later. Background fetch means by the time they reach the cover letter page, it's almost always already there.

If it isn't (user moves very fast or the call failed), the cover letter generation either:
- Waits briefly for an in-flight intel call (max 5s), then proceeds
- Falls back to a no-intel cover letter

Both behaviours decided in the cover letter spec.

---

## 3. UX Redesign: Analysis Results Page

### 3.1 Layout

```
┌─────────────────────────────────────┐
│  APPLY BAR (sticky, single)         │
│  [Apply now →]                      │
├─────────────────────────────────────┤
│  Analysis · Role · Company          │
│  "Your achievements prove..."       │
├─────────────────────────────────────┤
│  INCLUDE IN RESUME   (68%)          │
│  "These will be included..."        │
│  • Evidence item                    │
├─────────────────────────────────────┤
│  COULD ADD           (+21%)         │
│  "Adding them boosts to 89%"        │
│  ☑ Video ad production ✓ Added     │
│      └ Suggested text shown inline  │
│        [✎ Edit]  [× Undo]          │
│  ☐ Campaign attribution             │
├─────────────────────────────────────┤
│  NOT ON YOUR PROFILE                │
│  "If you have these, add them..."   │
│  • SQL-based analytics              │
├─────────────────────────────────────┤
│  Strategic notes                    │
│  · Insight text                     │
└─────────────────────────────────────┘
```

One apply bar, sticky to the top while scrolling. No company intel section on this page.

### 3.2 Apply button behaviour

Single CTA: **"Apply now →"**

- Action: navigates the user to the Generate Resume page for this JobApplication
- No live bridged-gap count in the button text — keep it clean
- Behaviour identical at any scroll position

### 3.3 Copy — labels

| Old label | New label | Why |
|---|---|---|
| Direct Match | Include in resume | Tells user what to *do* |
| Bridgeable Gap | Could add | Implies user choice, not pre-approval |
| Hard Gap | Not on your profile | Honest, neutral, low-anxiety |

Percentages remain but are de-emphasised (right side, smaller). Action label is primary.

### 3.4 Inline bridging (optimistic with preview)

Each bridgeable item shows a checkbox. Click behaviour:

- Click ☐ → instantly becomes ☑ "Added"; the suggested bridge text expands inline beneath the item; two affordances appear: **[✎ Edit]** and **[× Undo]**
- Click [✎ Edit] → text becomes editable in place
- Click [× Undo] → checkbox returns to ☐, suggested text collapses, no DB change

The bridge is applied optimistically. The user sees what got claimed in the same click — no surprise content surfaces in the resume later. Safety comes from visibility, not from a confirmation modal.

The current modal-based bridging UX is removed.

### 3.5 Error / empty states

- **No "Include in resume" evidence:** Card shows 0% with copy: "No achievements surfaced for this role yet."
- **No bridgeable gaps:** Card doesn't render.
- **No hard gaps:** Card doesn't render.
- **Analysis failure:** Existing error handling unchanged (toast + retry).

### 3.6 Animations

Deferred to v2. Ship without slide-down.

---

## 4. Files

| File | Change |
|---|---|
| `server/src/services/companyIntel.ts` | **New file** — Perplexity prompt + call logic |
| `server/src/services/llm.ts` | Add `callPerplexity()` function |
| `server/src/routes/analyze.ts` | Background-fire `fetchCompanyIntel` after JobApplication update |
| `server/src/index.ts` | Add `companyIntel` column to `ensureColumns()` |
| `server/prisma/schema.prisma` | Add `companyIntel Json?` to `JobApplication` |
| `src/components/strategy/AnalysisResult.tsx` | Redesign cards, update labels and copy, replace modal bridging with inline optimistic UX, single sticky apply bar |

No changes to `StrategyHub.tsx` for animations. No new frontend service for intel (it lives on the JobApplication row, read at cover letter time).

---

## 5. Cost

~700 input tokens × $3/M + ~300 output tokens × $15/M = **~$0.0066 per analysis**.
At 100 analyses/month: **~$0.66/month**.

---

## 6. Out of scope (follow-up spec)

- Cover letter consumption of `companyIntel` (research panel above the editor, salutation pre-fill, sources row)
- Cover letter migration to the structured-template approach used by resume
- Stale-intel UX (e.g., re-analyse prompt if the job was analysed >30 days ago)

---

## 7. Verification

- After running an analysis, query the `JobApplication` row for the analysed job — `companyIntel` should be populated within 10 seconds. If absent, check Railway logs for `[companyIntel] background fetch failed`.
- Re-analysing the same job overwrites the row with a fresh `fetchedAt`.
- Analysis response time is unchanged from baseline (intel is not in the response).
- All redesigned cards render without the company intel section.
- Bridging a gap: one click marks it bridged, text expands inline, Edit and Undo both work, the bridged claim appears in the generated resume.
