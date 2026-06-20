# Apply Full-JD Guard — Design

Date: 2026-06-21
Status: Approved, ready for implementation plan

## Problem

When a user applies to a feed job, the document generator can receive a one-line
**teaser** instead of the full job description. Observed in QA25: a SEEK role's
JD reached `/apply` as *"Utilise your exceptional people and technical skills in
this exciting role"*, and the resume + cover letter were generated off that teaser.

### Root cause

SEEK (and other named boards) ship a search-results teaser at ingest, not the
full detail-page text. Full text is meant to be hydrated lazily on demand via
`POST /api/job-feed/:id/fetch-description` (see `descriptionHydrated` flag +
`server/src/services/ingestion/hydrate.ts`).

The hydration trigger in `src/components/jobs/JobCard.tsx` is gated by a brittle
detector:

```js
const isTruncated = !fullDescLoaded && (
  item.description.endsWith('...') || item.description.endsWith('…') ||
  (item.sourcePlatform === 'other' && item.description.length < 600)
);
```

A SEEK teaser does not end in `...`/`…` and its `sourcePlatform` is `'seek'`, not
`'other'`. So `isTruncated` is `false`, `fetch-description` never fires, the modal
shows the teaser, and `handlePrepareAndApply` stuffs the teaser into localStorage
and `/apply`. Result: documents generated from a teaser.

## Invariant

**A user can never generate documents from a teaser.** The full JD must be in hand
(hydrated, pasted, or an explicit user override) before navigation to `/apply`.

## Solution (frontend only)

No server changes. The `fetch-description` endpoint already does the scraping and
SSRF allowlisting. Scope is `JobCard.tsx` + `JobPreviewModal.tsx`.

### 1. Fix detection

Replace the `endsWith`/`'other'` sniffing with a hydration-needed notion driven by
whether the item is already a full posting. An item **needs hydration** when it is
not yet confirmed full AND its source is a known teaser-shipping board.

- Treat these `sourcePlatform` values as teaser-shipping: `seek`, `indeed`,
  `linkedin`, `jora`, `other`.
- An item is **confirmed full** when: a successful `fetch-description` has run this
  session (`fullDescLoaded`), OR the item is from a source that ships full text at
  ingest, OR the user has pasted/overridden.
- The old length/ellipsis heuristics are removed. Do not reintroduce
  `description.length < 600` as the sole gate; it false-negatives on terse teasers.

### 2. Apply awaits hydration (Approach B)

The `Apply →` button label is unchanged in the happy path. Behaviour:

- On modal open, hydration fires automatically (as today) for items that need it.
- On `Apply` click, if the JD is not yet confirmed full:
  - button enters a loading state (label `Preparing full description…`, disabled),
  - await `fetch-description`,
  - on success, stash the **full** description and navigate.
- If hydration already completed before the click, navigate immediately.

`handlePrepareAndApply` is the single guard. It must refuse to navigate unless it
holds a confirmed-full JD (hydrated, pasted, or explicit preview override). No code
path may stash a teaser silently.

### 3. Failure path

If `fetch-description` returns blocked/empty/error, the modal footer swaps into a
recovery state instead of the normal actions:

- Heading: `Couldn't load the full description automatically.`
- An `Open original ↗` link to `item.sourceUrl` (new tab).
- A paste textarea, placeholder `Paste the job description here`. When non-empty
  text is present, the Apply button is enabled and uses the pasted text as the full
  JD (this counts as confirmed-full).
- A quiet text link `Use the preview anyway`. Clicking it proceeds with the teaser
  and fires a warning toast (see copy below). This is the only path that allows a
  partial JD, and it requires an explicit click.

### 4. State model (JobCard)

The component already tracks `loadingFullDesc`, `fullDescFailed`, `fullDescLoaded`.
Add:

- `pastedDescription: string | null` — user-supplied JD from the recovery box.
- A derived `applyReady` boolean: true when (not needs-hydration) OR `fullDescLoaded`
  OR `pastedDescription` is non-empty OR preview-override was clicked.

`handlePrepareAndApply` resolves the JD in priority order:
1. `pastedDescription` if present,
2. else the hydrated `item.description` if `fullDescLoaded` / not-needs-hydration,
3. else (preview override only) the teaser, with the warning toast.

## User-facing copy (locked — do not paraphrase)

| Key | String |
| --- | --- |
| Button default | `Apply →` |
| Button preparing | `Preparing full description…` |
| Recovery heading | `Couldn't load the full description automatically.` |
| Open original link | `Open original ↗` |
| Paste placeholder | `Paste the job description here` |
| Use preview link | `Use the preview anyway` |
| Preview-override toast (warning) | `Applying with a partial description. Your documents may be weaker.` |
| Success toast (unchanged) | `Job loaded, generate your documents, then apply` |

No em dashes or en dashes anywhere. Ellipsis `…` is acceptable (matches existing UI).

## Out of scope

- Server / ingestion changes (no hydrate-at-ingest; lazy model stays).
- `FocusedApplyView.tsx` and `ApplyFeedStrip.tsx` (separate surfaces; only touch if
  the plan finds them sharing the same guard, otherwise leave untouched).
- Any change to `fetch-description` endpoint behaviour.

## Acceptance

- A SEEK feed item opened and applied to lands at `/apply` with the **full**
  detail-page JD, not the teaser.
- Clicking Apply before hydration finishes shows the preparing state and still
  results in a full JD at `/apply` (no race window).
- When scraping fails, Apply is blocked until the user pastes a JD or explicitly
  clicks `Use the preview anyway`.
- No code path navigates to `/apply` with a teaser without an explicit override.
