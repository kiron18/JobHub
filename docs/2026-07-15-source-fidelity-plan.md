# Source Fidelity plan (Generation V2.1) — Kimi execution plan

Date: 2026-07-15. Owner: Kiron. Executor: Kimi, one phase per session, report back after each.

## Execution workflow (Kimi: follow exactly)

- Branch: create `feat/source-fidelity` off `feat/generation-v2` before Phase 1. All work on
  this branch. Never commit to `master` or `feat/generation-v2` directly.
- One phase per session. At the end of each phase: run that phase's acceptance gate, commit
  with message `feat(fidelity): phase N - <short description>`, and **push the branch to
  GitHub**. Then STOP and report.
- Report format (paste back to Kiron/Claude for verification before the next phase starts):
  the commit SHA, the exact commands run for the acceptance gate, and the raw pass/fail
  output for every gate item. No summaries in place of raw output.
- Staging: Kiron deploys the branch to staging (Vercel branch preview + Railway staging
  service) and tests there after Phases 1 and 4 at minimum. Phases needing only local
  verification (2, parts of 3) can gate locally, but say so explicitly in the report.
- Execution order: **1 → 4 → 2 → 3 → 5.** Phases 1 and 4 are the client-visible
  transformation and ship first. Phase 5 only starts if Kiron explicitly green-lights it
  after 1-4 are verified.
- Out of scope, do not build even if tempting: section-level AI regeneration, new pipeline
  stages, new models, template pickers, profile-bank changes. If a phase seems to require
  one of these, stop and report instead.

## The principle (read this first, Kimi)

The candidate's uploaded resume is the single source of truth. For every job, the system
REFRAMES that resume: reorders, reweights, rewords for the job. It never invents anything
(grounding gate enforces this) and it never deletes anything (this plan adds that invariant).
The previous prompt enumerated an allowed section list, which silently deleted any content
outside the list (a client's IEEE publication and GitHub link). Do NOT fix that by adding
more named sections. Fix it with the preservation invariant below. No new models, no new
pipeline stages, no new hardcoded section rules. If a step in this plan seems to need one,
stop and report instead.

Non-negotiables that STAY exactly as they are:
- The grounding gate (`server/src/lib/groundingGate.ts`) and its one retry. It is the
  "nothing made up" guarantee.
- The shape check in `/generate/resume-structured` (it only requires universal anchors and
  already tolerates extra sections).
- One Claude call per document via `callClaude(..., PREMIUM_MODEL)`. No second model.

---

## Phase 1: Replace RESUME_V2_PROMPT with the fidelity version

File: `server/src/services/prompts/generationV2.ts`. Replace the entire `RESUME_V2_PROMPT`
template string with the version below. Do not paraphrase it; copy it exactly.

```
You are an expert Australian resume writer. You write the way a top human career coach
writes: specific, honest, outcome-first, and tailored to one job.

You will receive:
1. THE CANDIDATE'S RESUME. This is the single source of truth. Every fact in your output
   must come from here.
2. THE JOB DESCRIPTION for the role they are applying to.

== HONESTY RULES (these override everything else) ==
- Every employer name, job title, date, qualification, institution, certification,
  publication, project name, link, and number in your output must appear in the candidate's
  resume. Copy them exactly.
- Never invent, estimate, round, or extrapolate a number. If a bullet has no metric, write
  it without one. A strong unmetriced bullet beats an invented metric every time.
- Never state a years-of-experience figure unless the resume's own dates clearly support it.
- Never import facts from the job description into the candidate's history, and never use
  your own outside knowledge about any company. If it is not in the resume, it does not exist.

== COMPLETENESS RULES (equal priority to honesty) ==
- Every category of content in the source resume must appear in your output. If the resume
  has publications, your output has a Publications section. Projects, volunteering, awards,
  patents, languages, certifications: same rule. Never delete a section the candidate had.
- Every employer, every education entry, every project title, every publication, and every
  certification in the source must survive into the output.
- To fit the length budget, tighten wording and trim the least relevant bullets within an
  entry. Never fit the budget by deleting an entry or a section.
- Contact line: reproduce every contact channel present in the resume (email, phone,
  LinkedIn, GitHub, portfolio, location). Omit any item that is a placeholder or
  note-to-self (e.g. "04XX XXX XXX", "add correct number", "TBD").

== TAILORING RULES ==
- Reframe, do not rewrite history. Reorder sections and bullets so the experience most
  relevant to THIS job is most prominent. Older or less relevant entries get shorter, not
  deleted.
- Mirror the job description's genuine vocabulary where the resume honestly supports it.
  Never mirror vocabulary the resume cannot support.
- 3 to 5 bullets for the most recent or most relevant roles, 2 to 3 for older ones. Every
  bullet starts with a strong verb and states an outcome or concrete scope.
- Professional summary: first person, 3 to 4 sentences, no name, no "he/she/they", anchored
  by one real proof point from the resume, ending with what they are targeting (aligned to
  this job). Plain prose. Never repeat a summary sentence verbatim in a bullet.
- Aim for 2 A4 pages of a standard resume layout, achieved per the completeness rules.
- Australian English. No em dashes anywhere. No cliches: never write "results-driven",
  "passionate", "dynamic", "proven track record", "leverage", "spearheaded", "synergy".

== OUTPUT FORMAT ==
Return ONLY the finished resume as markdown. No preamble, no code fences, no commentary.

Required conventions (the renderer depends on these):
- Line 1: # {Candidate full name exactly as in the resume}
- Then: *{The job title from the job description}*
- Then the contact line, items separated by " | ".
- "## Professional Summary" is the first section, "## Work Experience" (with each role as
  "### {Role} | {Company}" followed by "*{Mmm YYYY - Mmm YYYY or Present}*" on its own line
  and "- " bullets), "## Education" (each entry as "**{Degree}**  ·  {Year}" with the
  institution on the next line), and "## Skills & Competencies" (2 or 3 "**{Label}:**"
  lines) must all exist.
- All other sections mirror the source resume's own content, as "## {Section name}"
  headings, placed in the order that best serves this application. Projects use the same
  "### {name}" + date-line + bullets convention as roles.
- End with "## Referees" containing "Available upon request." unless the resume lists
  referees.

== THE CANDIDATE'S RESUME ==
"""
${resumeText}
"""

== THE JOB DESCRIPTION ==
"""
${jobDescription}
"""
```

Do NOT touch `COVER_LETTER_V2_PROMPT`, the routes, the shape check, or the grounding gate
in this phase.

**Acceptance gate (pass/fail, run all four):** using the test harness or a local server
call to `/generate/resume-structured` with Vaibhav Singh's stored `resumeRawText` (or the
fixture copy of it) and the Capgemini AI Engineer JD:
1. Output contains "IEEE" (his publication survived) and "github.com/vaibhavsingh10".
2. Output contains all six project titles from the source (Assembly Calculus, Skip-gram,
   Random Forest, SDN routing/Dijkstra, Radio interferometry, Rocket telemetry).
3. Output does NOT contain "04XX" (placeholder omitted).
4. `checkGrounding(output, resumeText, jd).violations` is empty, and the existing shape
   check passes.
Run the same generation with Kiron's own resume + the LLL Marketing Officer JD (the V2
acceptance pair) and confirm no section from that source resume is missing either.

## Phase 2: Grounding retry must keep the better draft

File: `server/src/routes/generate.ts`, both `-structured` routes. Today one violation
triggers a full regeneration and the retry is adopted even when it still has violations.
Change: after the retry, compare `violations.length` of original vs retry (both shape-valid);
keep the draft with fewer violations (tie: keep the retry); surface the kept draft's
violations as `groundingWarnings` exactly as today.

**Acceptance gate:** unit test proving (a) retry with 0 violations replaces original,
(b) retry with MORE violations than the original is discarded and the original ships with
its warnings, (c) shape-breaking retry keeps original (existing behaviour, keep the test).

## Phase 3: UI safety (no pipeline changes)

1. Copy button (`src/pages/StepperWorkspace.tsx`, `handleCopy`): convert markdown to plain
   readable text before writing to the clipboard (strip #, **, *, leading "- " into "• ").
2. Persist edits: when `commitEdit` saves, also PATCH the document server-side with the
   edited content, `edited: true`, and timestamp (new route or extend documents route).
   Show a small "Edited by you" badge on drafts where `edited` is true.
3. Grammar check on download: before export, run the final text through one fast model call
   ("list any sentences that are not grammatical English, return JSON array, empty if none");
   if non-empty, show an inline "Review these lines before sending" warning with the
   sentences. Never block the download.

**Acceptance gate:** copying a generated resume pastes with no `#` or `*` characters; an
in-app edit appears in the DB row with `edited: true`; a draft with a deliberately broken
sentence ("where with Python my built was deployed") triggers the review warning, and a
clean draft does not.

## Phase 4: Exporter design pass (separate session, visual)

`src/lib/exportPdf.tsx` (and `exportDocx.ts` to the extent docx allows): single-column,
ATS-safe, designed to the standard of the hand-made master resume ("Vaibhav Singh - Resume"
style). The design language is not open to interpretation; the model does NOT design per
generation. The template spec:

- **Fonts:** bundle TTF files locally in the repo and register them via
  `@react-pdf/renderer`'s `Font.register` (built-in Helvetica is not enough). Name/headline
  in a serif (Source Serif 4 or EB Garamond); body in a humanist sans (Source Sans 3 or
  Inter). No external font fetches at runtime; the files ship in the bundle.
- **Name:** serif, ~22pt, near-black. Headline line under it: bold, ~11pt, accent colour.
- **Contact line:** 9pt, muted grey, items separated by " | "; links in accent colour.
- **Section headers:** ~9.5pt, UPPERCASE with ~0.12em letter-spacing, ONE accent colour
  (steel blue / slate), hairline rule underneath, generous top margin (~16pt).
- **Roles/projects:** bold 11pt title left, dates right-aligned on the same line in muted
  9.5pt. Italic descriptor line under the role where the content has one.
- **Bullets:** 10.5pt, 1.35 line height, hanging indent, tight 3pt gaps within a role.
- **Skills:** label/value rows (bold small-caps label in a ~120pt left column, values
  wrapping right), not comma-soup paragraphs.
- **Education/certifications:** same title-left/date-right pattern.
- **Hard rules:** single column only, no images/icons/graphics, real selectable text, A4
  with ~20mm margins, no orphaned section header at a page bottom (use the renderer's
  break/minPresenceAhead handling on heading elements).

**Acceptance gate:** export the Phase-1 generated Vaibhav resume to PDF on staging and
eyeball side-by-side against the master resume PDF for hierarchy parity (name treatment,
section headers, date alignment, skills rows). Every line of content present, nothing
clipped, no stranded headers, and text is drag-selectable/copyable in a PDF viewer.

## Phase 5 (optional, flag-gated): native PDF input

Store the uploaded resume file (Supabase storage) and send the PDF bytes to Claude directly
instead of extracted text, behind `RESUME_PDF_NATIVE=true`. Falls back to `resumeRawText`
when the file is missing. Kills extraction artifacts ("git hub.com", spaced headings,
HTML entities). Report token-cost delta before enabling by default.

---

## Final end-to-end acceptance (after Phases 1-4, on staging, run by Kiron)

Fresh account (or Vaibhav's account) on staging:
1. Upload the master resume PDF ("Vaibhav Singh - Resume.pdf"). Confirm the profile shows
   a resume on file.
2. Generate against the Capgemini AI Engineer JD. Confirm in the output: IEEE publication
   present, github.com/vaibhavsingh10 in the contact line, all six project titles present,
   no "04XX", no invented numbers (spot-check every metric against the master).
3. Copy the resume: pasted text has no # or * characters.
4. Edit one line in the app, save. Confirm the DB Document row shows edited=true and the
   edited content.
5. Break a sentence deliberately in the editor, hit Download: grammar warning appears.
   Fix it, download again: no warning.
6. Downloaded PDF matches the master resume's design standard (Phase 4 gate) and opens
   with selectable text.
7. Generate a cover letter for the same job: consistent facts, 400-500 words, no em dashes.

All seven pass = ship to production. Any fail = back to the phase that owns it.

## Supersession note

`docs/generation-v2-quality-fixes.md` Phase A item 1 (add named Publications/GitHub rules)
is SUPERSEDED by Phase 1 here (the general completeness invariant). Its other items map to
Phase 3 (copy/grammar/edits) and Phase B/C items map to Phases 2 and 4 here.
