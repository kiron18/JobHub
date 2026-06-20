# Apply Full-JD Guard Implementation Plan

> **For DeepSeek / agentic workers:** Execute task-by-task in order. Steps use checkbox (`- [ ]`) syntax. This plan is ZERO-LATITUDE: implement exactly what is written. Do not add features, refactor unrelated code, rename things, change copy, or "improve" beyond these steps. If reality does not match this plan (a file/line differs, a command fails unexpectedly, a type doesn't resolve), **STOP and report** what you found instead of improvising.

**Goal:** Guarantee a user can never generate documents from a one-line job teaser; the full JD must be hydrated, pasted, or explicitly overridden before navigating to `/apply`.

**Architecture:** Frontend-only. Fix the broken truncation detector (it never recognised SEEK/Indeed/LinkedIn/Jora teasers as needing hydration), make the Apply action await hydration through a single guard, and add a failure-recovery UI (paste box + open-original + explicit override). The existing `POST /api/job-feed/:id/fetch-description` endpoint is unchanged and does all scraping/SSRF work.

**Tech Stack:** React + TypeScript, Vite, Tailwind, Framer Motion, sonner toasts, axios (`src/lib/api`).

## Global Constraints

- **No server changes.** Touch only `src/components/jobs/`. Do not modify `server/`, Prisma, or the `fetch-description` endpoint.
- **No new dependencies.** No test runner is configured for the frontend; do not add one.
- **Verification is `npm run build`** (runs `tsc -b && vite build`) plus the manual checks in each task. Build MUST pass with zero TypeScript errors.
- **User-facing copy is locked. Copy these strings verbatim. Do NOT paraphrase, retitle, or add/remove punctuation:**
  - Apply button default: `Apply →`
  - Apply button busy: `Preparing full description…` (note: real ellipsis character `…`, not three dots)
  - Recovery heading: `Couldn't load the full description automatically.`
  - Open original link: `Open original ↗`
  - Paste box placeholder: `Paste the job description here`
  - Use-preview link: `Use the preview anyway`
  - Partial-apply warning toast: `Applying with a partial description. Your documents may be weaker.`
  - Success toast (unchanged): `Job loaded, generate your documents, then apply`
- **No em dashes or en dashes** anywhere in code, comments, or copy. The ellipsis character `…` is allowed (it already appears in this codebase).
- Commit after each task with the exact message given.

---

## File Structure

- **Create** `src/components/jobs/jobDescription.ts` — pure helpers for hydration detection (no React, no I/O). Isolated so the core decision logic is readable in one place.
- **Modify** `src/components/jobs/JobCard.tsx` — copy constants, new state, rewritten `openModal`, new `handleApplyClick` guard, `handlePrepareAndApply(jd)` now takes the resolved JD, updated props passed to the modal.
- **Modify** `src/components/jobs/JobPreviewModal.tsx` — copy constants, updated Props, removed stale truncation hint, rewritten footer with the busy state and recovery UI.

---

## Task 1: Pure hydration-detection helpers

**Files:**
- Create: `src/components/jobs/jobDescription.ts`

**Interfaces:**
- Produces:
  - `TEASER_PLATFORMS: string[]`
  - `looksHydrated(description: string): boolean`
  - `needsHydration(platform: string, description: string, fullDescLoaded: boolean): boolean`

- [ ] **Step 1: Create the helper file**

Create `src/components/jobs/jobDescription.ts` with exactly this content:

```ts
// Job descriptions from these boards arrive at ingest as a short search-results
// teaser, not the full posting. They must be hydrated via fetch-description
// before they can drive document generation.
export const TEASER_PLATFORMS = ['seek', 'indeed', 'linkedin', 'jora', 'other'];

// Conservative "already full" check: a hydrated detail-page JD is long markdown
// with line breaks. Teasers (including Adzuna's ~500 char single block) never
// reach this. Used only to skip a redundant re-fetch, never to gate correctness.
export function looksHydrated(description: string): boolean {
  return description.length > 1200 && description.includes('\n');
}

// True when we must fetch the full description before the user can apply.
export function needsHydration(
  platform: string,
  description: string,
  fullDescLoaded: boolean,
): boolean {
  if (fullDescLoaded) return false;
  if (!TEASER_PLATFORMS.includes(platform)) return false;
  return !looksHydrated(description);
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: build succeeds, zero TypeScript errors. (The new file is not yet imported anywhere; that is fine.)

- [ ] **Step 3: Commit**

```bash
git add src/components/jobs/jobDescription.ts
git commit -m "feat(feed): pure hydration-detection helpers for apply guard"
```

---

## Task 2: JobCard apply guard

**Files:**
- Modify: `src/components/jobs/JobCard.tsx`

**Interfaces:**
- Consumes: `needsHydration` from `./jobDescription` (Task 1).
- Produces: passes these props to `JobPreviewModal` (consumed in Task 3): `onApply: () => void`, `applyBusy: boolean`, `applyDisabled: boolean`, `showRecovery: boolean`, `pastedDescription: string`, `setPastedDescription: (val: string) => void`, `onUsePreviewAnyway: () => void`. It no longer passes `isTruncated` or `fullDescFailed`.

- [ ] **Step 1: Add the helper import**

Find this line near the top (currently `JobCard.tsx:8`):

```ts
import { JobPreviewModal } from './JobPreviewModal';
```

Add immediately below it:

```ts
import { needsHydration } from './jobDescription';
```

- [ ] **Step 2: Add locked copy constants**

Immediately after the import block (before `export interface JobFeedItem`), insert:

```ts
// User-facing copy locked by spec 2026-06-21-apply-full-jd-guard. Do not paraphrase.
const APPLY_LABEL = 'Apply →';
const APPLY_PREPARING = 'Preparing full description…';
const WARN_PARTIAL = 'Applying with a partial description. Your documents may be weaker.';
```

- [ ] **Step 3: Add two state hooks**

Find this block (currently `JobCard.tsx:55-57`):

```ts
  const [loadingFullDesc, setLoadingFullDesc] = useState(false);
  const [fullDescFailed, setFullDescFailed] = useState(false);
  const [fullDescLoaded, setFullDescLoaded] = useState(false);
```

Add immediately below it:

```ts
  const [pastedDescription, setPastedDescription] = useState('');
  const [previewOverride, setPreviewOverride] = useState(false);
```

- [ ] **Step 4: Replace the truncation derivation with the new derived values**

Find and DELETE this block (currently `JobCard.tsx:59-64`):

```ts
  const platform = getPlatformConfig(item.sourcePlatform);
  const addresseeFetched = item.addresseeSource !== null;
  const isTruncated = !fullDescLoaded && (
    item.description.endsWith('...') || item.description.endsWith('…') ||
    (item.sourcePlatform === 'other' && item.description.length < 600)
  );
```

Replace it with:

```ts
  const platform = getPlatformConfig(item.sourcePlatform);
  const addresseeFetched = item.addresseeSource !== null;

  const mustHydrate = needsHydration(item.sourcePlatform, item.description, fullDescLoaded);

  // The confirmed-full JD, or null if we do not yet hold one.
  const resolvedFullJd: string | null =
    pastedDescription.trim() ? pastedDescription.trim()
    : !mustHydrate ? item.description
    : null;

  // Recovery UI shows only after an automatic hydration attempt has failed, we
  // still have no confirmed-full JD, and the user has not chosen to override.
  const showRecovery = fullDescFailed && resolvedFullJd === null && !previewOverride;

  const applyBusy = loadingFullDesc;
  // Disable Apply while fetching, or while recovery is showing and the user has
  // neither pasted a JD nor (handled separately) chosen the preview override.
  const applyDisabled = applyBusy || (showRecovery && !pastedDescription.trim());
```

- [ ] **Step 5: Rewrite `openModal` to use `mustHydrate`**

Find this block (currently `JobCard.tsx:66-81`, the description-fetch portion only):

```ts
  const openModal = async () => {
    setModalOpen(true);

    // Fetch full description if truncated
    if (isTruncated && !loadingFullDesc && !fullDescFailed) {
      setLoadingFullDesc(true);
      try {
        const { data } = await api.post(`/job-feed/${item.id}/fetch-description`);
        onUpdate({ id: item.id, description: data.description });
        setFullDescLoaded(true);
      } catch {
        setFullDescFailed(true);
      } finally {
        setLoadingFullDesc(false);
      }
    }
```

Replace ONLY that portion with (leave the addressee-fetch block that follows it untouched):

```ts
  const openModal = async () => {
    setModalOpen(true);

    // Hydrate the full description up front for teaser-shipping boards so it is
    // ready by the time the user reaches Apply.
    if (mustHydrate && !loadingFullDesc && !fullDescFailed) {
      setLoadingFullDesc(true);
      try {
        const { data } = await api.post(`/job-feed/${item.id}/fetch-description`);
        onUpdate({ id: item.id, description: data.description });
        setFullDescLoaded(true);
      } catch {
        setFullDescFailed(true);
      } finally {
        setLoadingFullDesc(false);
      }
    }
```

- [ ] **Step 6: Make `handlePrepareAndApply` take the resolved JD**

Find the whole function (currently `JobCard.tsx:138-166`):

```ts
  const handlePrepareAndApply = () => {
    localStorage.setItem('jobhub_current_jd', item.description);
    localStorage.setItem('jobhub_current_job_context', JSON.stringify({
      company: item.company,
      title: item.title,
      suggestedAddressee: addresseeOverride ?? item.suggestedAddressee ?? null,
      matchScore: item.matchScore ?? null,
    }));
    localStorage.setItem('jobhub_apply_context', JSON.stringify({
      jobId: item.id,
      title: item.title,
      company: item.company,
      description: item.description,
      sourceUrl: item.sourceUrl,
      sourcePlatform: item.sourcePlatform,
    }));
    setModalOpen(false);
    navigate('/apply', {
      state: {
        jobDescription: item.description,
        company: item.company,
        role: item.title,
        feedItemId: item.id,
        sourceUrl: item.sourceUrl,
        sourcePlatform: item.sourcePlatform,
      },
    });
    toast.success('Job loaded, generate your documents, then apply');
  };
```

Replace it with (note: signature gains a `jd` parameter; three `item.description` usages become `jd`):

```ts
  const handlePrepareAndApply = (jd: string) => {
    localStorage.setItem('jobhub_current_jd', jd);
    localStorage.setItem('jobhub_current_job_context', JSON.stringify({
      company: item.company,
      title: item.title,
      suggestedAddressee: addresseeOverride ?? item.suggestedAddressee ?? null,
      matchScore: item.matchScore ?? null,
    }));
    localStorage.setItem('jobhub_apply_context', JSON.stringify({
      jobId: item.id,
      title: item.title,
      company: item.company,
      description: jd,
      sourceUrl: item.sourceUrl,
      sourcePlatform: item.sourcePlatform,
    }));
    setModalOpen(false);
    navigate('/apply', {
      state: {
        jobDescription: jd,
        company: item.company,
        role: item.title,
        feedItemId: item.id,
        sourceUrl: item.sourceUrl,
        sourcePlatform: item.sourcePlatform,
      },
    });
    toast.success('Job loaded, generate your documents, then apply');
  };
```

- [ ] **Step 7: Add the apply guard and the override handler**

Immediately AFTER the `handlePrepareAndApply` function you just edited, insert:

```ts
  // Single guard: never navigate to /apply without a confirmed-full JD.
  const handleApplyClick = async () => {
    if (resolvedFullJd) {
      handlePrepareAndApply(resolvedFullJd);
      return;
    }
    // No full JD yet. If we have not already failed, hydrate now. This covers the
    // race where the user clicks Apply before the on-open fetch finished.
    if (!fullDescFailed) {
      setLoadingFullDesc(true);
      try {
        const { data } = await api.post(`/job-feed/${item.id}/fetch-description`);
        onUpdate({ id: item.id, description: data.description });
        setFullDescLoaded(true);
        handlePrepareAndApply(data.description);
      } catch {
        setFullDescFailed(true);
      } finally {
        setLoadingFullDesc(false);
      }
      return;
    }
    // Already failed: the recovery UI is showing. Do nothing here; the user must
    // paste a JD (which flips resolvedFullJd) or click Use the preview anyway.
  };

  const handleUsePreviewAnyway = () => {
    setPreviewOverride(true);
    toast(WARN_PARTIAL);
    handlePrepareAndApply(item.description);
  };
```

- [ ] **Step 8: Update the props passed to `JobPreviewModal`**

Find the `<JobPreviewModal ... />` element (currently `JobCard.tsx:256-274`):

```tsx
      <JobPreviewModal
        item={item}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpdate={onUpdate}
        onApply={handlePrepareAndApply}
        onSave={handleSave}
        onSkip={handleSkip}
        addresseeLoading={addresseeLoading}
        addresseeFetched={addresseeFetched}
        addresseeFailed={addresseeFailed}
        addresseeOverride={addresseeOverride}
        setAddresseeOverride={setAddresseeOverride}
        editingAddressee={editingAddressee}
        setEditingAddressee={setEditingAddressee}
        saving={saving}
        isTruncated={isTruncated}
        fullDescFailed={fullDescFailed}
      />
```

Replace it with:

```tsx
      <JobPreviewModal
        item={item}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpdate={onUpdate}
        onApply={handleApplyClick}
        onSave={handleSave}
        onSkip={handleSkip}
        addresseeLoading={addresseeLoading}
        addresseeFetched={addresseeFetched}
        addresseeFailed={addresseeFailed}
        addresseeOverride={addresseeOverride}
        setAddresseeOverride={setAddresseeOverride}
        editingAddressee={editingAddressee}
        setEditingAddressee={setEditingAddressee}
        saving={saving}
        applyBusy={applyBusy}
        applyDisabled={applyDisabled}
        showRecovery={showRecovery}
        pastedDescription={pastedDescription}
        setPastedDescription={setPastedDescription}
        onUsePreviewAnyway={handleUsePreviewAnyway}
      />
```

- [ ] **Step 9: Type-check**

Run: `npm run build`
Expected: build FAILS with TypeScript errors in `JobPreviewModal.tsx` about unknown props (`applyBusy`, `showRecovery`, etc.) and/or missing `isTruncated`/`fullDescFailed`. This is expected — Task 3 updates the modal. If the ONLY errors are in `JobPreviewModal.tsx`, proceed. If there are errors inside `JobCard.tsx` itself, STOP and report them.

- [ ] **Step 10: Commit**

```bash
git add src/components/jobs/JobCard.tsx
git commit -m "feat(feed): apply guard awaits full JD hydration in JobCard"
```

---

## Task 3: JobPreviewModal busy state and recovery UI

**Files:**
- Modify: `src/components/jobs/JobPreviewModal.tsx`

**Interfaces:**
- Consumes (from Task 2): `onApply`, `applyBusy`, `applyDisabled`, `showRecovery`, `pastedDescription`, `setPastedDescription`, `onUsePreviewAnyway`.

- [ ] **Step 1: Add locked copy constants**

Find the import block at the top of `JobPreviewModal.tsx` (ends around line 5 with `import type { JobFeedItem } from './JobCard';`). Immediately after the imports, insert:

```ts
// User-facing copy locked by spec 2026-06-21-apply-full-jd-guard. Do not paraphrase.
const APPLY_LABEL = 'Apply →';
const APPLY_PREPARING = 'Preparing full description…';
const RECOVERY_HEADING = "Couldn't load the full description automatically.";
const OPEN_ORIGINAL = 'Open original ↗';
const PASTE_PLACEHOLDER = 'Paste the job description here';
const USE_PREVIEW = 'Use the preview anyway';
```

- [ ] **Step 2: Update the Props interface**

Find this block (currently `JobPreviewModal.tsx:22-24`):

```ts
  saving: boolean;
  isTruncated: boolean;
  fullDescFailed: boolean;
}
```

Replace it with:

```ts
  saving: boolean;
  applyBusy: boolean;
  applyDisabled: boolean;
  showRecovery: boolean;
  pastedDescription: string;
  setPastedDescription: (val: string) => void;
  onUsePreviewAnyway: () => void;
}
```

- [ ] **Step 3: Update the destructured params**

Find this block (currently `JobPreviewModal.tsx:42-44`):

```ts
  saving,
  isTruncated,
  fullDescFailed,
}) => {
```

Replace it with:

```ts
  saving,
  applyBusy,
  applyDisabled,
  showRecovery,
  pastedDescription,
  setPastedDescription,
  onUsePreviewAnyway,
}) => {
```

- [ ] **Step 4: Remove the stale truncation hint**

Find and DELETE this block entirely (currently `JobPreviewModal.tsx:149-161`):

```tsx
              {isTruncated && fullDescFailed && (
                <p className="text-xs text-[#8B847B]">
                  Full description unavailable —{' '}
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#5C5750] hover:text-[#1A1814] underline underline-offset-2 transition-colors"
                  >
                    open the listing for complete details →
                  </a>
                </p>
              )}
```

(The recovery affordance now lives in the footer.)

- [ ] **Step 5: Rewrite the footer**

Find the entire Footer Actions block (currently `JobPreviewModal.tsx:231-269`):

```tsx
            {/* Footer Actions */}
            <div className="p-5 border-t border-[rgba(26,24,20,0.08)] bg-[#FDFBF8] flex items-center justify-between gap-4">
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-bold text-[#8B847B] hover:text-[#1A1814] transition-colors"
              >
                <ExternalLink size={12} />
                View Original
              </a>

              <div className="flex items-center gap-2">
                <button
                  onClick={onSkip}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider border border-[rgba(26,24,20,0.16)] text-[#8B847B] hover:border-[rgba(26,24,20,0.24)] hover:text-[#1A1814] transition-colors"
                >
                  <EyeOff size={12} />
                  Skip
                </button>

                <button
                  onClick={onSave}
                  disabled={saving || item.isSaved}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider border border-[rgba(26,24,20,0.16)] text-[#5C5750] hover:border-[rgba(26,24,20,0.24)] hover:text-[#1A1814] transition-colors disabled:opacity-40"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : item.isSaved ? <BookmarkCheck size={12} className="text-emerald-400" /> : <BookmarkPlus size={12} />}
                  {item.isSaved ? 'Saved' : 'Save'}
                </button>

                <button
                  onClick={onApply}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider text-white transition-opacity hover:opacity-80"
                  style={{ background: platform.color }}
                >
                  Apply →
                </button>
              </div>
            </div>
```

Replace it with:

```tsx
            {/* Footer Actions */}
            <div className="p-5 border-t border-[rgba(26,24,20,0.08)] bg-[#FDFBF8] space-y-3">
              {showRecovery && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-[#1A1814]">{RECOVERY_HEADING}</p>
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5C5750] hover:text-[#1A1814] transition-colors"
                  >
                    <ExternalLink size={12} />
                    {OPEN_ORIGINAL}
                  </a>
                  <textarea
                    value={pastedDescription}
                    onChange={(e) => setPastedDescription(e.target.value)}
                    placeholder={PASTE_PLACEHOLDER}
                    rows={4}
                    className="w-full bg-white border border-[rgba(26,24,20,0.16)] rounded-lg px-3 py-2 text-sm text-[#1A1814] focus:outline-none focus:border-brand-500 resize-y"
                  />
                  <button
                    onClick={onUsePreviewAnyway}
                    className="text-xs font-bold text-[#8B847B] hover:text-[#1A1814] underline underline-offset-2 transition-colors"
                  >
                    {USE_PREVIEW}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-bold text-[#8B847B] hover:text-[#1A1814] transition-colors"
                >
                  <ExternalLink size={12} />
                  View Original
                </a>

                <div className="flex items-center gap-2">
                  <button
                    onClick={onSkip}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider border border-[rgba(26,24,20,0.16)] text-[#8B847B] hover:border-[rgba(26,24,20,0.24)] hover:text-[#1A1814] transition-colors"
                  >
                    <EyeOff size={12} />
                    Skip
                  </button>

                  <button
                    onClick={onSave}
                    disabled={saving || item.isSaved}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider border border-[rgba(26,24,20,0.16)] text-[#5C5750] hover:border-[rgba(26,24,20,0.24)] hover:text-[#1A1814] transition-colors disabled:opacity-40"
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : item.isSaved ? <BookmarkCheck size={12} className="text-emerald-400" /> : <BookmarkPlus size={12} />}
                    {item.isSaved ? 'Saved' : 'Save'}
                  </button>

                  <button
                    onClick={onApply}
                    disabled={applyDisabled}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider text-white transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: platform.color }}
                  >
                    {applyBusy && <Loader2 size={12} className="animate-spin" />}
                    {applyBusy ? APPLY_PREPARING : APPLY_LABEL}
                  </button>
                </div>
              </div>
            </div>
```

- [ ] **Step 6: Type-check**

Run: `npm run build`
Expected: build SUCCEEDS, zero TypeScript errors. If any error remains, STOP and report it (do not "fix" by changing logic or copy).

- [ ] **Step 7: Commit**

```bash
git add src/components/jobs/JobPreviewModal.tsx
git commit -m "feat(feed): busy state + JD recovery UI in JobPreviewModal"
```

---

## Task 4: Manual verification

No automated frontend tests exist. Verify by hand against a running app (`npm run dev`, then a separate `cd server && npm run dev` if the API is needed locally; use staging data).

- [ ] **Check 1 (happy path, the QA25 bug):** Open a SEEK feed job. While the modal is open, confirm the description area fills with the full multi-paragraph JD (not the one-line teaser). Click `Apply →`. On `/apply`, confirm the job-description panel shows the FULL JD, not the teaser.

- [ ] **Check 2 (race):** Open a SEEK job and click `Apply →` immediately, before the description finishes loading. Confirm the button shows `Preparing full description…` with a spinner, then navigation happens and `/apply` shows the FULL JD.

- [ ] **Check 3 (already-full / non-teaser source):** Open a job whose description is already long and full (or a non-teaser platform). Confirm Apply works immediately with no re-fetch stall and the full JD reaches `/apply`.

- [ ] **Check 4 (failure recovery):** Trigger a fetch failure (e.g. a listing that Firecrawl cannot extract). Confirm the footer shows `Couldn't load the full description automatically.`, an `Open original ↗` link, a paste box, and `Use the preview anyway`. Confirm `Apply →` is disabled until either: (a) you paste text into the box (then Apply uses the pasted JD), or (b) you click `Use the preview anyway` (then a warning toast appears and apply proceeds with the teaser).

- [ ] **Check 5 (no silent teaser):** Confirm there is no path that reaches `/apply` with a teaser WITHOUT either hydration succeeding, a paste, or an explicit `Use the preview anyway` click.

- [ ] **Step 6: Report** the result of all five checks. If any check fails, STOP and report which one and what you observed. Do not attempt further fixes beyond this plan without reporting first.

---

## Self-Review (completed by plan author)

- **Spec coverage:** detection fix (Task 1 + Task 2 step 4), apply-awaits-hydration (Task 2 steps 5/7), single guard in `handlePrepareAndApply`/`handleApplyClick` (Task 2 steps 6/7), failure recovery with paste + open-original + override (Task 3 step 5), locked copy (Global Constraints + Task 2/3 constants), invariant "no silent teaser" (Task 4 Check 5). All covered.
- **Placeholder scan:** none — every step has exact code and commands.
- **Type consistency:** prop names (`applyBusy`, `applyDisabled`, `showRecovery`, `pastedDescription`, `setPastedDescription`, `onUsePreviewAnyway`, `onApply`) match between Task 2 step 8 (producer) and Task 3 steps 2/3 (consumer). `handlePrepareAndApply(jd: string)` signature matches all call sites in Task 2 step 7.
