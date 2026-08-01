# Resume PDF + job-order fixes — handoff

**Date:** 2026-08-01
**Branch:** `staging`
**Status:** four fixes done, verified and committed. One decision open (the page marker).
**Triggered by:** Khushal Malik's LinkedIn feedback (client), plus the PDF he sent back.

**Source material this was diagnosed from** (client's own files, outside the repo):
`~/Downloads/Khushal_Malik_Kinetic_Resume.pdf` (the broken generated PDF he sent back) and
`~/Downloads/Khushal Malik Resume v2 (2).docx` (the resume Kiron originally prepared for him,
carrying the intended section and role order).

---

## What was wrong

Four separate problems, three of them visible to the client, one of them invisible and worse.

### 1. The same heading printed twice

Khushal's resume has both a "Professional Experience" section and an "Additional Experience"
section. The PDF printed "Professional Experience" for both.

Cause: `src/lib/exportPdf.tsx` had every section's heading typed into the renderer, and threw
away `section.title`. `classifySection` in `src/lib/resumeStructure.ts` folds anything
containing "experience" into one section type, so both sections hit the same hard-coded
heading.

Same latent bug for any renamed section: "Technical Skills" printed as "Skills &
Competencies", "Key Projects" printed as "Projects".

Why it survived: the on-screen preview and the Word download both read `section.title`
correctly (`src/lib/exportDocx.ts`). Only the PDF had its own copy. So it was wrong on the
one artefact nobody inspects until a client complains.

### 2. Content clipped and headings orphaned at the page break

A section heading could land on the last line of a page with its content overleaf, and the
last line of a page could run past the bottom margin and get cut.

Cause: blocks were nested inside a per-section `<View>`. react-pdf only reliably honours
`wrap={false}` on a direct child of `<Page>`. Nested, a block that will not fit the remaining
space is drawn anyway, into the bottom padding. The previous attempt at this used
`minPresenceAhead`, which reserves space *after* a node rather than binding it to what
follows, so it never did the job.

### 3. Text stored out of order (invisible, and the most serious)

When an entry landed on a page boundary, its text was written to the PDF content stream out
of sequence. In the file Khushal sent, `Saras Care / Business Analyst and Developer` was the
**last** thing in the file, written after "Referees: available upon request", with title and
employer swapped.

On screen it looked correct because the coordinates were correct. An ATS reads the stream,
not the coordinates, so it saw the employer filed under Referees. This was live on roughly
10 applications he had already submitted.

Evidence from the client's own PDF:

```
stream#21 y=694.8 | REFEREES
stream#22 y=720.5 | Available upon request.
stream#23 y=293.6 | Saras Care / Business Analyst and Developer   <-- last block in the file
```

### 4. The generator reordered his jobs

Khushal: *"it brings the two roles of mega mulchers and sarascare right on top of the resume
and pushes care to heal down ... it happened in every resume."*

Cause: `server/src/services/prompts/resumeStructuredPrompt.ts` asks the model for
`experienceOrder`, a ranking of roles by relevance to the job ad, and
`server/src/lib/buildTemplateResume.ts` re-sorted the experience list by it on every build.

**This is the important one.** The order of roles is set deliberately by Kiron as part of each
client's strategy. Re-sorting overwrote that on every generation, and produced a different
answer each run because the ranking is a fresh model response every time.

---

## What was changed

All four are in the working tree, uncommitted.

| File | Change |
|---|---|
| `src/lib/exportPdf.tsx` | Headings read `section.title`. Render tree flattened to page-level blocks. Keep-together on heading + entry head + first bullet. |
| `server/src/lib/buildTemplateResume.ts` | Re-sorting is now opt-in via `allowExperienceReorder`, default off. |
| `server/src/services/prompts/generationV2.ts` | Tailoring rules say keep the source order; tailor by wording. |
| `src/lib/__tests__/exportPdf.sections.test.tsx` | New. 7 regression tests. |
| `src/lib/__tests__/fixtures/page-boundary.md` | New. Anonymised reconstruction of the client resume that reproduces the page-boundary case. |
| `scripts/pagesweep.tsx` | New. The page-count sweep harness used to prove the fix does not add a page. |

### Deliberate design decisions

**Nothing was deleted.** `reorderExperience` and its 5 tests are untouched in
`buildTemplateResume.ts`. The prompt still asks for `experienceOrder`. Only the *default*
changed. Set `allowExperienceReorder: true` in `BuildTemplateOptions` to get the old
behaviour back. The natural next step, if wanted, is moving that flag onto the candidate
profile so it can be set per client.

**Spacing between entries went from 7pt to 5pt.** The old per-entry wrapper's 5pt margin
stacked on top of the last bullet's own 2pt. Flattening replaced that with a flat 5pt. This
was made explicit rather than left as a side effect: it buys back roughly what the
keep-together rule costs, which is what keeps the page count from growing. `ENTRY_GAP` in
`exportPdf.tsx` is the single number that controls it.

**Only the first bullet is held with its heading.** Holding a whole entry would push long
roles wholesale onto the next page and waste half a page.

---

## Verification

- Reproduced the client's PDF byte-for-byte on layout (identical y-coordinates on every
  block) before changing anything, from a reconstruction of his markdown.
- After: no block past the bottom margin, content stream in reading order on every page,
  `ADDITIONAL EXPERIENCE` prints correctly, `PROJECTS` moves cleanly to page 2 with its first
  entry instead of stranding at the foot of page 1.
- **Page-count sweep**, because a keep-together rule can silently cost a page: 31 content
  lengths across two resume shapes (the client's shape, and a second one with many short
  roles), 62 renders. Never longer than the current live code. One case a page shorter.
- Front end 50/50 tests, back end 494/494, both typecheck clean.
- Lint on `exportPdf.tsx` went from 9 errors to 7. The 7 remaining are pre-existing
  `react-refresh/only-export-components` warnings on this file's non-component exports.
- The parse snapshot `exportPdf.parse.test.ts.snap` is unchanged, confirming the parser was
  not touched. Only the renderer was.

### How to re-verify

```bash
cd public
cp ../src/lib/__tests__/fixtures/page-boundary.md ./_pb.md
npx tsx ../scripts/render-test.tsx ./_pb.md
```

Then check the produced PDF's block order and that nothing exceeds y=793.9 (A4 height 841.9
minus 48pt bottom padding).

To re-run the page-count sweep (31 content lengths per resume), which is what proves a layout
change has not cost anyone a page:

```bash
cd public && npx tsx ../scripts/pagesweep.tsx ./some-resume.md label
```

It writes `label.json` with the page count at each content length. Run it once before a change
and once after, and diff the two.

---

## What to tell the client

Plain-language version of the four fixes, for replying to Khushal:

1. **The duplicate heading.** The PDF had the section names built into it and ignored what he
   typed. It now prints his own headings, so "Additional Experience" stays "Additional
   Experience".
2. **The cut-off line and stranded headings at the bottom of page 1.** Nothing runs off the
   edge of the page now, and a heading always travels to the next page together with the job
   underneath it.
3. **Something he could not see.** When a job sat on a page break, the words were stored in
   the wrong order inside the file. It looked correct on screen, but application systems read
   the file rather than the screen, so they were reading his employer as though it sat under
   "Referees". This was live on the roughly 10 applications he mentioned sending. Worth
   telling him directly, and worth him re-sending anything important.
4. **His jobs moving around.** The system was asking the AI to rank his roles by relevance to
   each job ad and then reshuffling them, which is why it differed every time. It no longer
   reorders anything. The AI still rewrites his bullet wording to suit the job ad.

Note his "remove the part-time bit" advice is unaffected. The fold of casual roles into a
single "Additional Australian experience" line is untouched, since he said that worked well.

---

## Where the artefacts live

| Thing | Location |
|---|---|
| This handoff | `docs/2026-08-01-resume-pdf-and-order-handoff.md` |
| Repro resume (anonymised) | `src/lib/__tests__/fixtures/page-boundary.md` |
| Regression tests | `src/lib/__tests__/exportPdf.sections.test.tsx` |
| Page-count sweep harness | `scripts/pagesweep.tsx` |
| Existing render harness | `scripts/render-test.tsx` (pre-existing) |

Two entries were also written to the project memory at
`~/.claude/projects/E--AntiGravity-JobHub/memory/`, so they survive into future sessions:

- `resume-order-is-coach-strategy.md` — the order of roles and sections is Kiron's deliberate
  call and generation must not re-sort it.
- `no-hardcoded-absolutes.md` — do not fix a baked-in rule with the opposite baked-in rule,
  and do not delete code to prevent its reuse; change the default and leave a switch.

---

## Open decision: the page marker in the editor

This is Khushal's original complaint #1 and it is **not built**:

> *"whenever I am generating a resume I have no idea of page distribution which leaves a
> heading or start of a section orphaned on the page 1 and I cant do anything in the edit
> section to fix that."*

Fix 2 above stops the orphaning happening. It does not give him visibility into where the
page breaks.

The editor is a plain `<textarea>` at `src/pages/StepperWorkspace.tsx:1248` holding raw
markdown. It has no knowledge of the rendered page, and you cannot draw inside a textarea.

Two options put to Kiron:

- **Rough** (~1 hour): estimate the break from content length, draw a line. Risk: a marker in
  the wrong place is worse than none, because he will move content to fix a break that is not
  there.
- **Proper** (~half a day): run the react-pdf layout in the background, find which block
  starts page 2, map it back to its source item, draw the divider in the *preview* pane at
  that exact point. Always correct.

Recommendation was the proper one. **Awaiting Kiron's call.**

---

## Also not done

`src/lib/exportDocx.ts` has no `keepNext`, so the Word download can still orphan a heading.
Word repaginates on its own so it needs a different fix to the PDF one. Raised, not actioned.

---

## Notes for whoever picks this up

- Committed to `staging` as a single commit containing exactly these seven files:

  ```
  src/lib/exportPdf.tsx
  src/lib/__tests__/exportPdf.sections.test.tsx
  src/lib/__tests__/fixtures/page-boundary.md
  scripts/pagesweep.tsx
  server/src/lib/buildTemplateResume.ts
  server/src/services/prompts/generationV2.ts
  docs/2026-08-01-resume-pdf-and-order-handoff.md
  ```

- The working tree at the time also carried changes from a **second concurrent Claude Code
  session**: `server/src/routes/admin-funnel.ts`, `src/pages/AdminUserUsage.tsx`,
  `server/scripts/reconcile-paid-clients.ts`, `server/scripts/_tmp-apps.ts`,
  `server/scripts/_tmp-integrity.ts`, `docs/audit/`. Those are unrelated to this work and were
  deliberately left out of the commit. They are still uncommitted.
- `server/src/services/prompts/resumeStructuredPrompt.ts` is deliberately **unchanged**. It
  still asks the model for `experienceOrder`. The behaviour change is entirely in the builder,
  which is what keeps the capability available behind the flag.

### Working preferences confirmed during this session

Kiron pushed back hard, and correctly, on two habits. Worth carrying forward:

1. **Do not replace one hard-coded absolute with another.** The first attempt at fix 4 wrote
   "never reorder, for any reason" into the prompt in capitals and deleted `reorderExperience`
   so it could not be turned back on. That is the same failure mode as the bug, pointed the
   other way. Prefer a default plus a switch. Delete nothing.
2. **Explain in plain language.** No file names or framework terms when describing what a fix
   does for the client. Describe what the client will see.
