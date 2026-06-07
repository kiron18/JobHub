# Application Workspace — Slice C (Apply loop: cap → generate → Seek → return) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Wire a card's Apply to enforce the daily cap, enter generation with the full JD, add "Download both" + a Submit-on-Seek banner on the cover-letter page, and on completion mark the job applied and return to the workspace.

**Architecture:** `JobStream.onApply` calls `POST /job-feed/:id/start-apply` (Slice A). On `429` it shows the daily-cap message; on success it navigates to `/apply` with the full job description + `sourceUrl`/`feedItemId`. The cover-letter step in `StepperWorkspace` gains a "Download both" action and a Seek banner that opens `sourceUrl`; its completion calls `POST /job-feed/:id/mark-applied` then returns to `/` with the applied id (Slice D animates it).

**Tech Stack:** React, TypeScript, react-router, react-query, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-07-application-workspace-job-stream-design.md` §4, copy §8.3/§8.6/§8.7. **Depends on Slices A + B.**

**Rules:** Build exactly this. No em dashes ([[feedback_no_em_dashes]]). Reuse warm tokens. STOP-and-report where told.

---

## Phase 0 — Verifications (DONE 2026-06-07 by Claude)

- **0.1** `StepperWorkspace` (`src/pages/StepperWorkspace.tsx`) reads `location.state` as `ApplyState` already containing `jobDescription, company, role, feedItemId, sourceUrl, sourcePlatform, bridgedGaps` (interface ~line 147). It auto-runs analysis + generates resume then cover letter (overlap), so no generation-order change is needed here.
- **0.2** Slice A added `POST /api/job-feed/:id/start-apply` returning `{ ok, jobApplicationId, used, cap }` or `429 { error:'DAILY_CAP_REACHED', cap, used }`, and `POST /api/job-feed/:id/mark-applied` exists (flips the application to APPLIED).
- **0.3 STOP-and-report:** before Task 3, open `StepperWorkspace.tsx` and locate the existing document **download/export** mechanism for a generated doc (search for `download`, `blob`, `.docx`, `export`, `handleCopy`). Note the exact function/handler name. If there is only copy-to-clipboard and no download, report it so copy owner decides; do not invent an exporter.

---

## File Structure

- Modify: `src/pages/StrategyHub.tsx` — real `handleStreamApply` (start-apply + navigate) + daily-cap message state/UI.
- Modify: `src/pages/StepperWorkspace.tsx` — cover-letter step: "Download both" + Seek banner; completion marks applied + returns with `appliedFeedItemId`.

---

## Task 1: Real Apply handler with cap guard

**Files:** Modify `src/pages/StrategyHub.tsx` (`AnalysisHeroCard`).

- [ ] **Step 1: Add cap-message state**

In `AnalysisHeroCard`, near the other `useState`s:

```typescript
    const [applyingId, setApplyingId] = useState<string | null>(null);
    const [capMessage, setCapMessage] = useState(false);
```

- [ ] **Step 2: Replace `handleStreamApply` (from Slice B) with the real one**

```typescript
    const handleStreamApply = async (job: import('../components/jobs/JobCard').JobFeedItem) => {
        if (applyingId) return;
        setApplyingId(job.id);
        try {
            await api.post(`/job-feed/${job.id}/start-apply`);
        } catch (err: any) {
            setApplyingId(null);
            if (err?.response?.status === 429) { setCapMessage(true); return; }
            toast.error('Could not start that application. Please try again.');
            return;
        }
        navigate('/apply', {
            state: {
                jobDescription: job.description ?? '',
                company: job.company,
                role: job.title,
                sourceUrl: job.sourceUrl,
                feedItemId: job.id,
                sourcePlatform: job.sourcePlatform,
            },
        });
    };
```

(Remove the Slice B `setJd/setPickedFeedItem/setShowPaste` body. If `showPaste`-only helpers become unused, leave the paste box wired to the two buttons as in Slice B.)

- [ ] **Step 3: Pass `applyingId` into the stream**

Change the Slice B render `<JobStream onApply={handleStreamApply} />` to `<JobStream onApply={handleStreamApply} applyingId={applyingId} />`.

- [ ] **Step 4: Render the daily-cap message (copy §8.6)**

Add near the top of the `AnalysisHeroCard` returned JSX (e.g. above the stream), an inline dismissible banner shown when `capMessage`:

```tsx
                {capMessage && (
                    <div style={{
                        border: `1px solid ${warm.colors.borderDefined}`, borderRadius: 12,
                        background: warm.colors.bgAlt, padding: '14px 16px', marginBottom: 14,
                    }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: warm.colors.textPrimary }}>
                            That is 25 applications today. Serious effort.
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: warm.colors.textSecondary }}>
                            Come back tomorrow for a fresh batch. Your trial keeps running, and the more you apply, the sooner the callbacks start.
                        </p>
                    </div>
                )}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/pages/StrategyHub.tsx
git commit -m "feat(workspace): Apply enforces daily cap then enters generation"
```

---

## Task 2: Seek banner + Download both on the cover-letter step

**Files:** Modify `src/pages/StepperWorkspace.tsx`.

**Pre-req:** the download handler name from Phase 0.3. In the steps below, replace `downloadDoc(stepId)` with the real handler. If the page exposes a per-step download, "Download both" triggers it for the resume step's draft and the cover-letter step's draft (both drafts are in localStorage via `loadDraft(workspaceKey, step)`).

- [ ] **Step 1: Read `sourceUrl` from state**

Confirm `state.sourceUrl` is in scope on the cover-letter step (it is, per Phase 0.1). If not, thread it from `location.state`.

- [ ] **Step 2: Add the Seek banner (copy §8.3) on the cover-letter step, after a draft exists**

Where the cover-letter step renders its draft (the `isCoverLetter && content` region), add below the content:

```tsx
                {isCoverLetter && content && state.sourceUrl && (
                    <div style={{
                        border: `1px solid ${warm.colors.accentPetrol}`, borderRadius: 12,
                        background: warm.colors.bgAlt, padding: '16px 18px',
                        display: 'flex', flexDirection: 'column', gap: 8,
                    }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary }}>Last step: submit on Seek</p>
                        <p style={{ margin: 0, fontSize: 13, color: warm.colors.textSecondary }}>
                            Download your resume and cover letter, then submit them on the live listing. We open it for you in a new tab.
                        </p>
                        <a
                            href={state.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                alignSelf: 'flex-start', marginTop: 4, fontSize: 13.5, fontWeight: 700,
                                padding: '9px 18px', borderRadius: 10, textDecoration: 'none',
                                background: warm.colors.accentPetrol, color: warm.colors.textOnDeep,
                            }}
                        >
                            Submit on Seek
                        </a>
                    </div>
                )}
```

- [ ] **Step 3: Add "Download both" on the cover-letter step CTAs**

In the CTA row, when `isCoverLetter && hasDraft`, add next to the existing download a button labelled `Download both` that calls the resume + cover-letter download handlers. Use the verified handler from Phase 0.3. Example shape (adapt to the real handler):

```tsx
                    {isCoverLetter && hasDraft && (
                        <button onClick={() => { downloadDoc('resume'); downloadDoc('cover-letter'); }} style={ghostButtonStyle(generating)}>
                            Download both
                        </button>
                    )}
```

Resume step keeps its own single download labelled `Download resume`; cover-letter step's single download is labelled `Download cover letter`. (Copy §8.7.)

- [ ] **Step 4: Typecheck + manual check**

Run: `npx tsc -p tsconfig.app.json --noEmit` (exit 0). Manually: on the cover-letter step the Seek banner shows with a working new-tab link to the job, and "Download both" downloads both docs.

- [ ] **Step 5: Commit**

```bash
git add src/pages/StepperWorkspace.tsx
git commit -m "feat(apply): Seek submission banner + Download both on cover letter"
```

---

## Task 3: Completion marks applied + returns to the workspace

**Files:** Modify `src/pages/StepperWorkspace.tsx`.

- [ ] **Step 1: On the final (cover-letter) step, the primary action marks applied then returns**

The existing final-step primary button reads `Finish` (when `isLast`). Change its handler so that, for the apply flow with a `feedItemId`, it records the application and returns to the workspace with the applied id. Replace the `handleContinue`/Finish behaviour on the last step with:

```typescript
    const handleFinishApplication = async () => {
        commitEdit();
        try {
            if (state.feedItemId) {
                await api.post(`/job-feed/${state.feedItemId}/mark-applied`);
            }
        } catch (err) {
            console.warn('[apply] mark-applied failed (non-fatal):', err);
        }
        navigate('/', { state: { appliedFeedItemId: state.feedItemId ?? null } });
    };
```

Wire the last-step primary button to `handleFinishApplication` and label it `Back to my jobs` (instead of `Finish`) when `state.feedItemId` is present; otherwise keep existing `Finish` behaviour.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: exit 0.

- [ ] **Step 3: Manual check**

Apply a job end to end: resume → cover letter → Submit on Seek (opens) → "Back to my jobs" returns to the dashboard. In the DB the `JobApplication` for that job is `APPLIED`. (The card removal/animation is Slice D; for now the feed refetch should drop it after invalidation, which Slice D adds.)

- [ ] **Step 4: Commit**

```bash
git add src/pages/StepperWorkspace.tsx
git commit -m "feat(apply): mark applied and return to workspace on finish"
```

---

## Self-Review

- [ ] Spec §4 (cap-aware Apply → full JD → overlap generation → downloads → Seek banner → mark applied → return) covered. Copy §8.3 (Seek banner), §8.6 (daily cap), §8.7 (downloads) transcribed verbatim.
- [ ] Consumes Slice A contracts exactly: `start-apply` `429 DAILY_CAP_REACHED`; `mark-applied`. Returns `{ appliedFeedItemId }` for Slice D.
- [ ] Phase 0.3 download-handler verification done before Task 2; no invented exporter.
