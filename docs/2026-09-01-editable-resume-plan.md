# Editable resume on the welcome screen

**Branch:** `fit-check-one-door` → pushed to `staging`
**Status:** built 1 Sep 2026, on staging, not yet exercised end to end

## The flow (confirmed by Kiron)

The welcome resume screen is the **only** place a candidate edits this document.

1. Rebuild finishes, they read the resume on `step === 'resume'`.
2. They edit it in place if they want to.
3. They click **See my next steps**, which is the single send.
4. The email goes out with whatever is on screen at that moment.

There is no resend, no versioning and no snapshot mismatch, because the edit
happens before the only send. Editing later from the profile, and a download
button there, is out of scope for now.

## Two decisions, made

- **An explicit Edit / Done toggle**, not an always-live textarea. Consistent
  with the generation workspace they meet later, and this screen is the payoff
  being handed over: a page that turns out to be a giant textarea reads as a
  form rather than a resume.
- **The send flushes a pending edit.** "See my next steps" saves the buffer
  before it sends, so what is on screen is what gets emailed even if they never
  blurred the field. The button waits on that save rather than racing it.

## Reuse, do not rebuild

One editor, used in three places. `DocumentStep` in `StepperWorkspace.tsx`
(~lines 650-1710) already has the whole thing: textarea, formatting toolbar,
caret and line-style tracking, save-on-blur. It sits on `lib/toggleLinePrefix`,
which `ProfileBank` also uses.

- Extract the editor from `DocumentStep` into `src/components/MarkdownDocEditor.tsx`.
  Behaviour-preserving move, no feature changes in the same pass.
- Point `DocumentStep` at the extracted component, so the paid workspace and the
  welcome screen cannot drift apart.
- Use it on the welcome resume step.

`DocumentStep` is the paid workspace, so the extraction is where the risk is.
Do it on its own, verify generation still works, then build on top.

## Server

The gate already anticipates this. `resumeSourceGate` has two modes:

- `authored` — a model wrote it, an ungrounded figure is a fabrication, throws.
- `human` — the candidate wrote it, a new figure is them telling us something
  true about themselves, returned as an advisory.

So an edited resume saves in `human` mode. Length and `[placeholder]` brackets
still throw in both modes.

1. `PATCH /api/welcome/resume` — `{ token, resume }`. Loads the session,
   `assertResumeSource(text, [original, ...answers], 'human', 'welcome/edit')`,
   writes `resumeCleanText`, returns the recomputed `pageCount` and any figure
   advisories. ~40 lines plus tests.
2. A column recording that the candidate edited it (`resumeEditedAt`), plus a
   migration, so `/welcome/finish` switches to `human` mode instead of rejecting
   their own added figures with the `authored` gate.

## Length control

`pageCount` on that screen is already the real number from the same renderer
that produces the emailed PDF, so recompute it after each save and they watch
three pages become two as they cut.

"Here is what I would cut" starts rule-based: longest bullets, oldest roles,
repeated skills. No model call, instant and free. An LLM suggestion pass is a
later upgrade, not a prerequisite.

## Related state at time of writing

- Staging frontend: https://job-hub-git-staging-kiron18s-projects.vercel.app
- Staging API: https://aussiegradcareers-staging-production.up.railway.app/api
- The offer is $197/month, `price_1UAiOeRRHBMzeTPTxvLKH3pt`, plan key `premium`.
- `CHECKOUT_ENABLED=true` must be set per Railway environment or `/stripe/checkout`
  returns 410. Staging's Stripe key is live, so a completed checkout is a real charge.
- `MAX_REBUILD_ATTEMPTS` is 6 after a client resume was refused at 4 and then
  rebuilt cleanly twice on the same file.

## What was built, 1 Sep 2026

All four pieces, in the order above, each one green before the next started.

1. `src/components/MarkdownDocEditor.tsx` — the editor, moved out of
   `DocumentStep` verbatim. `DocumentStep` points at it. The only additions are
   an optional `tone` and style overrides whose defaults reproduce exactly what
   was there, for a caller that is not on the in-app palette.
2. `PATCH /api/welcome/resume`, gated in `human` mode, plus `resumeEditedAt` and
   its migration (`20260901000001_welcome_resume_edited_at`). `/welcome/finish`
   now picks its mode off that column. 13 tests in
   `server/src/routes/welcome.resume.test.ts`, including the pair that matters:
   the same invented figure is refused when the model wrote it and accepted once
   the candidate has.
3. The editor on the welcome resume step, behind an Edit / Done toggle above the
   paper. "See my next steps" awaits `flushEdit()` before it sends, and a
   refusal keeps them on the screen in edit mode with the reason.
4. `src/lib/resumeCuts.ts` — `suggestCuts`, rule-based, 8 tests. The panel shows
   only when the measured count is over two pages and the rules have something
   to say.

### Still to check on a real run

Nothing here has been through the actual flow: that needs an upload, two LLM
calls, and a database with the new column. Worth watching on staging:

- The migration applies on the Railway deploy. **Local dev needs
  `npm run migrate` in `server/` and a dev-server restart**, or the PATCH will
  fail on a column Postgres does not have.
- The toolbar sits at `top: 12, right: 128` inside the paper, to the left of the
  page-count badge. That clearance was worked out on paper, not in a browser.
- Whether the cut suggestions read as useful on a real three-page resume, or
  merely as true.
