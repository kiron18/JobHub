# Draft Modal + Orphan Fix + Apply CTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make a drafted gap sentence reach the generated documents (not just the Profile Bank), simplify the draft modal to a single sentence with a red placeholder cue, and make the Apply button the obvious next step once gaps are bridged.

**Architecture:** Client-only (React + warm light theme). The orphan fix reuses the existing `bridgedGaps` pipe: the modal feeds its edited sentence into `AnalysisResult`'s `bridgedText` map, which an existing effect already serialises into the generate payload. No backend, no schema, no new pipe.

**Spec:** `docs/superpowers/specs/2026-05-31-draft-modal-and-apply-cta-design.md`

---

## ⚠️ Execution guardrails (READ FIRST)

- Client has **no test runner**. Verify with `npx tsc --noEmit -p tsconfig.json` (exit 0)
  and `npm run build` (succeeds). Do NOT add a test runner.
- Theme is the **warm light palette** via `warm.colors.*` from `../../lib/theme/warmTokens`
  (already imported in both files). Do NOT use slate/dark Tailwind classes here.
- Exact tokens to use: `warm.colors.danger` (#B85C5C), `warm.colors.dangerSoft`,
  `warm.colors.success` (#2A9D6F), `warm.colors.accentPetrol`, `warm.colors.bgCanvas`,
  `warm.colors.textMuted`, `warm.colors.textSecondary`.
- Do tasks in order (1 → 3). Task 2 depends on Task 1's `onSaved` signature change.
- Edit only the blocks shown. No global find/replace. If a quoted block isn't found
  verbatim, STOP and report.
- Commit after each task.

---

## Task 1: Draft modal → single-sentence editor + red placeholder + `onSaved(text)`

**File:** `src/components/strategy/AchievementDraftModal.tsx`

- [ ] **Step 1: Change the `onSaved` prop type**

In the `Props` interface, change:

```ts
    onSaved?: () => void;
```
to:
```ts
    onSaved?: (finalDescription: string) => void;
```

- [ ] **Step 2: Return the edited sentence on save**

In `handleSave`, find:

```ts
            toast.success('Achievement added to your profile');
            onSaved?.();
            onClose();
```
Replace with:
```ts
            toast.success('Added to your application and profile');
            onSaved?.(description.trim());
            onClose();
```

- [ ] **Step 3: Send the skill as title and null metric (Title/Metric fields are leaving the UI)**

In `handleSave`, find the `api.post('/achievements', { ... })` body:

```ts
            await api.post('/achievements', {
                title: title.trim(),
                description: description.trim(),
                metric: metric.trim() || null,
                skills: skill,
            });
```
Replace with (title falls back to skill; metric is null — it now lives in the sentence):
```ts
            await api.post('/achievements', {
                title: (title.trim() || skill),
                description: description.trim(),
                metric: null,
                skills: skill,
            });
```

- [ ] **Step 4: Compute the placeholder for the red cue**

Directly after the `const canSave = ...` line, add:

```ts
    const pendingPlaceholder = (description.match(/\[[^\]]*\]/) || [])[0] ?? null;
```

- [ ] **Step 5: Replace the Title + Description + Metric block with a single-sentence editor**

Find the block that renders the three fields (inside the `) : (` branch, the
`<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>` containing the
Title `<input>`, the Description `<textarea>`, and the Metric `<input>`). Replace that
ENTIRE inner `<div>...</div>` (Title group + Description group + Metric group) with:

```tsx
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {/* Single sentence — the artifact we actually use */}
                                <div>
                                    <label style={labelStyle(warm.colors.textSecondary)}>Your achievement (first person)</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                        style={{ ...inputStyle(), resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: 1.6 }}
                                        placeholder="I led the rollout of…"
                                    />
                                </div>

                                {/* Red placeholder cue OR positive ready state */}
                                {pendingPlaceholder ? (
                                    <div style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 8,
                                        padding: '8px 12px', borderRadius: 10,
                                        background: warm.colors.dangerSoft,
                                        fontSize: 12, lineHeight: 1.5, color: warm.colors.danger,
                                    }}>
                                        <span>
                                            Replace <span style={{ fontWeight: 800, color: warm.colors.danger }}>{pendingPlaceholder}</span> with a real number — a metric makes this far stronger.
                                        </span>
                                    </div>
                                ) : (
                                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: warm.colors.success }}>
                                        Looks strong — ready to add.
                                    </p>
                                )}

                                {metricPlaceholder && (
                                    <p style={{ margin: 0, fontSize: 11, color: warm.colors.textMuted, lineHeight: 1.5 }}>
                                        Suggested measure: {metricPlaceholder}
                                    </p>
                                )}
                            </div>
```

Note: this removes the Title `<input>` and Metric `<input>` from the UI but the `title`,
`metric`, `setMetric`, `metricPlaceholder` state remain declared. `metric`/`setMetric`
will now be unused → see Step 6.

- [ ] **Step 6: Remove now-unused `metric` state (noUnusedLocals is ON)**

`noUnusedLocals`/`noUnusedParameters` are enabled. After Step 5, `metric` and `setMetric`
are unused. Find and DELETE this line:

```ts
    const [metric, setMetric] = useState('');
```

Leave `title`, `setTitle`, `metricPlaceholder`, `setMetricPlaceholder` — they are still
used (title in the POST + setTitle in the fetch effect; metricPlaceholder in the hint).
If `tsc` later reports any OTHER unused symbol, remove only that symbol. Do not remove
`description`/`setDescription`.

- [ ] **Step 7: Update the primary button copy + add reuse caption**

Find the primary button text:

```tsx
                                ) : (
                                    'Save to my profile'
                                )}
```
Replace with:
```tsx
                                ) : (
                                    'Add to application'
                                )}
```

Then, immediately AFTER the closing `</div>` of the actions row (the
`<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>`
block), add a caption:

```tsx
                        <p style={{ margin: '10px 0 0', fontSize: 11, color: warm.colors.textMuted, textAlign: 'right' as const }}>
                            Also saved to your profile for future jobs.
                        </p>
```

- [ ] **Step 8: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.json` → exit 0
Run: `npm run build` → succeeds
If `tsc` reports an unused `title`/`setTitle`, that means the fetch effect block was
altered — STOP and report (do not delete `title`, it is needed for the POST).

- [ ] **Step 9: Commit**

```bash
git add src/components/strategy/AchievementDraftModal.tsx
git commit -m "feat(draft-modal): single-sentence editor with red placeholder cue; return edited text"
```

---

## Task 2: Orphan fix — feed the drafted sentence into the bridged pipe

**File:** `src/components/strategy/AnalysisResult.tsx`

- [ ] **Step 1: Write the edited sentence into `bridgedText` on save**

Find the `<AchievementDraftModal ... onSaved={...} />` usage (near line 464). Its current
`onSaved` is:

```tsx
                onSaved={() => {
                    if (draftIndex !== null) {
                        setBridgedIndices(prev => {
                            const next = new Set(prev);
                            next.add(draftIndex);
                            return next;
                        });
                    }
                    setDraftIndex(null);
                }}
```
Replace with (capture the index, store the returned sentence, then tick it):

```tsx
                onSaved={(finalDescription) => {
                    if (draftIndex !== null) {
                        const idx = draftIndex;
                        setBridgedText(prev => {
                            const next = new Map(prev);
                            next.set(idx, finalDescription);
                            return next;
                        });
                        setBridgedIndices(prev => {
                            const next = new Set(prev);
                            next.add(idx);
                            return next;
                        });
                    }
                    setDraftIndex(null);
                }}
```

This makes the existing `bridgedGaps` effect (which reads
`bridgedText.get(i) ?? capabilityStatement(item.suggestion)`) emit the user's edited
sentence, so it flows to the generate payload and into both documents.

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.json` → exit 0
Run: `npm run build` → succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/strategy/AnalysisResult.tsx
git commit -m "fix(strategy): drafted gap sentence now flows into generation via bridged pipe"
```

---

## Task 3: Apply CTA — elevate once gaps are bridged

**File:** `src/components/strategy/AnalysisResult.tsx`

The sticky apply bar is near line 123. `bridgedIndices` is in scope. We use plain CSS
transitions (NOT a Framer keyframe pulse — that would replay on every keystroke-driven
re-render). No new imports needed.

- [ ] **Step 1: Derive the bridged count**

Immediately after the `const headline = ...` assignment (near line 65–70, before the
`return (`), add:

```ts
    const bridgedCount = bridgedIndices.size;
```

- [ ] **Step 2: Make the apply bar respond to `bridgedCount`**

Replace the sticky apply bar block (the `{/* Sticky apply bar */}` `<div>` through its
closing `</div>`, lines ~123–169) with:

```tsx
            {/* Sticky apply bar */}
            <div style={{
                position: 'sticky',
                top: 24,
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '14px 20px',
                background: warm.colors.bgSurface,
                border: `1px solid ${bridgedCount > 0 ? 'rgba(45,90,110,0.35)' : warm.colors.borderWhisper}`,
                borderRadius: 14,
                boxShadow: warm.shadow.soft,
                marginBottom: 16,
                transition: 'border-color 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
            }}>
                <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>
                        Apply for this role
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: bridgedCount > 0 ? warm.colors.success : warm.colors.textMuted }}>
                        {bridgedCount > 0
                            ? `✓ ${bridgedCount} strength${bridgedCount > 1 ? 's' : ''} added — you're ready to apply`
                            : `${extractedMetadata.role} · ${extractedMetadata.company}`}
                    </p>
                </div>
                <button
                    onClick={onContinue}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: bridgedCount > 0 ? '12px 26px' : '10px 22px',
                        fontSize: 14,
                        fontWeight: 700,
                        color: warm.colors.bgCanvas,
                        background: warm.colors.accentPetrol,
                        border: 'none',
                        borderRadius: 12,
                        cursor: 'pointer',
                        boxShadow: bridgedCount > 0
                            ? `0 0 0 4px rgba(45,90,110,0.18), ${warm.shadow.soft}`
                            : warm.shadow.soft,
                        letterSpacing: '-0.01em',
                        whiteSpace: 'nowrap',
                        transition: 'padding 0.3s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
                    }}
                >
                    Apply now
                    <ArrowRight size={16} />
                </button>
            </div>
```

(`ArrowRight` is already imported in this file. The `45,90,110` RGB equals
`accentPetrol` #2D5A6E. Plain `<button>` + CSS transition — no Framer needed.)

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.json` → exit 0
Run: `npm run build` → succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/strategy/AnalysisResult.tsx
git commit -m "feat(strategy): elevate Apply CTA once a gap is bridged"
```

---

## Task 4: Verify + manual smoke

- [ ] **Step 1: Build gate**

Run: `npx tsc --noEmit -p tsconfig.json` → exit 0
Run: `npm run build` → succeeds

- [ ] **Step 2: Manual smoke (record pass/fail; needs running app)**

1. Analyse a job → click **Draft** on a gap.
2. Modal shows ONE sentence field (no Title/Metric fields), with a **red** line naming
   the `[…]` placeholder.
3. Type a real number over the placeholder → red line flips to green "Looks strong — ready to add."
4. Click **Add to application** → modal closes, the gap is ticked showing YOUR sentence,
   the caption confirmed it saved to profile.
5. The **Apply bar elevates** (glow + "✓ 1 strength added — you're ready to apply").
6. Generate résumé + cover letter → your edited sentence (with the real number) appears.
7. Check Profile Bank → the achievement is saved (reusable).

Any fail → STOP and report.

---

## Self-review notes (author)

- **Spec coverage:** orphan fix → Task 2; modal single-sentence + red placeholder → Task 1; Apply CTA → Task 3.
- **noUnusedLocals trap handled:** Task 1 Step 6 removes the now-unused `metric` state.
- **Reuses existing pipe** — Task 2 is a 1-block change; no new state/props/endpoints.
- **Motion fires on transition** via `animate` keyed off `bridgedCount > 0`, exponential ease, no bounce.
- **Type consistency:** `onSaved(finalDescription: string)` defined in Task 1, consumed in Task 2.
