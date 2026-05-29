# Resume Template System

**Date:** 2026-05-27
**Status:** Draft
**Drivers:** Formatting instability in LLM-generated markdown; need for deterministic, consistent resume output.

## Problem

The current resume generation pipeline asks the LLM to output a single markdown string containing content *and* typographic formatting. LLMs are unreliable at formatting, producing:

- `##` headings glued to body text (`##Work Experience###ACME`)
- Bold markers that don't close
- Random blank lines
- Inconsistent spacing between sections

Three separate parsers (ReactMarkdown, exportDocx, exportPdf) then re-parse this unreliable markdown, multiplying formatting errors.

## Solution

Split responsibility: **LLM decides WHAT to say** (content), **a deterministic template decides WHERE to put it and HOW it looks** (formatting).

### Architecture

```
profileFromDB → profileToResumeData → [optional LLM polish → merge] → profileToMarkdown → markdown
```

- `profileToResumeData` — adapter mapping Prisma `CandidateProfile` + relations into `ResumeData` struct
- LLM polish (if JD + analysis exist) — LLM outputs structured JSON, never markdown
- `applyPolish` — replaces summary and bullets in `ResumeData` with LLM output
- `profileToMarkdown` — existing deterministic function, always produces perfect markdown

### Scope

**Resume only.** Cover letters, STAR responses, selection criteria stay on the old markdown path. Zero changes to those flows.

## Strategic Context — Unchanged

The current generation pipeline injects substantial strategic context into the prompt. The structured prompt **preserves all of these verbatim** — only the output instruction changes:

- **Achievement framing.** Each selected achievement includes its `framingAngle` and `narrativeNote` (from the analysis phase). These are injected per-achievement in the prompt, unchanged.
- **Blueprint positioning.** The `StrategyBlueprint` (positioning statement, proof points, messaging angles, tone, pitfall flags) feeds the prompt identically.
- **Identity cards + positioning statement.** Diagnostic outputs (identity cards, positioning statement JSON) are included in the prompt context. These continue to feed the structured prompt.
- **ATS keyword lists.** Keyword coverage analysis is included in the prompt, unchanged.
- **Resume rules document.** The `server/rules/resume_rules.md` file is loaded and injected into the prompt, same as today.

The only change to the prompt is the output instruction: instead of "write a complete resume as markdown," the instruction becomes "output a JSON object with these fields." Everything above that line stays identical.

## Polish JSON Contract

The LLM returns a JSON object validated by this Zod schema:

```ts
const polishSchema = z.object({
  summary: z.string().optional(),
  experience: z.array(z.object({
    id: z.string(),
    bullets: z.array(z.string()),
  })).optional(),
});
```

- `summary` — replacement for `ResumeData.professionalSummary`. Optional: if absent, the raw profile summary is kept.
- `experience` — array of per-experience bullet replacements. `id` must match a `ResumeData.experience[].id`. Optional: if absent, raw bullets are kept.
- Any extra fields in the LLM output are stripped (`.passthrough()` disabled). Invalid `id` values are silently dropped.

On validation failure: retry the LLM call once. If still invalid, fall back to unpolished `ResumeData` (raw profile data flows through). Never crashes.

## Data Flow

### With JD (polished)

1. Analysis + blueprint phase — unchanged
2. Structured prompt built with all strategic context (achievement framing, blueprint, identity cards, ATS keywords, resume rules) — only the output instruction changes from "write markdown" to "output JSON"
3. LLM returns JSON → Zod validation → retry × 1 if bad → fall back to unpolished if still bad
4. `applyPolish` merges validated JSON into `ResumeData` (replace semantics — full bullet replacement)
5. First-person enforcement on summary text (explicit, separate step — never third person)
6. Quality enforcers run on text fields (summary, bullet strings) instead of markdown — banned-phrase scrubber, AI-tell provenance tagging, ATS keyword check
7. `profileToMarkdown` produces perfect markdown
8. Rendered markdown saved to `Document.content` (editable; regenerate overwrites — see UX note below)
9. ReactMarkdown / exportDocx / exportPdf consume the same perfect markdown

### Without JD (baseline)

1. `profileToResumeData(profile)` → raw `ResumeData`
2. `profileToMarkdown` → perfect markdown
3. No LLM call at all

## profileToMarkdown Output Contract

The deterministic markdown renderer guarantees these invariants (enforced by existing tests):

- Every `##` heading is on its own line
- Blank line above and below every `##` heading
- No glued headings (`##Work Experience` never occurs)
- `###` role headings always followed by ` | ` and company name
- Bullets always prefixed with `- ` and space
- Trailing whitespace stripped from all lines
- Sections with no data are omitted (no empty headings)
- Referees section defaults to "Available upon request" unless `showReferees: false`

These invariants mean the output is always valid markdown safe for any parser (ReactMarkdown, exportDocx, exportPdf).

## In-Flight Document Rows

Users who already have markdown resumes in `Document.content` see them rendered as-is (current behavior). Nothing changes until they hit "Regenerate," at which point the new structured path produces the template-rendered output and saves it. No migration needed — old markdown is valid markdown, just potentially poorly formatted. Regen fixes it.

## UX: Regenerate Clobbers Edits

Current behavior: user edits the markdown, hits regen, edited markdown is overwritten. The template system keeps this same contract. However, because the new output is *always* perfectly formatted, there's less reason to hand-edit formatting. Content edits (changing a bullet's wording) are still possible in the edit textarea.

Decision: **keep the same overwrite-on-regen contract.** No confirm dialog for v1. If users report losing edits, a confirmation dialog is a one-line addition later.

## Cover Letter Follow-Up

The same wall-of-text formatting bug exists in cover letters. Once the resume template system is proven stable, the same architecture applies: structured JSON output → deterministic renderer. Not in scope for this spec.

## Files

### New files

| File | Purpose |
|---|---|
| `src/lib/profileToResumeData.ts` | Maps Prisma `CandidateProfile` → `ResumeData`. Pure data transform. |
| `src/lib/applyPolish.ts` | Merges validated LLM polish JSON into `ResumeData`. Replace semantics. |
| `server/src/services/prompts/resumeStructuredPrompt.ts` | Prompt that instructs LLM to output structured JSON (not markdown). Preserves all existing strategic context inputs. |
| (inline in route) | Zod schema for polish JSON validation. |

### Changed files

| File | Change |
|---|---|
| `server/src/routes/generate.ts` | Add handler for structured resume generation alongside existing markdown handler. |
| `src/components/ApplicationWorkspace.tsx` | Conditional: if `activeTab === 'resume'`, use template path. Edit textarea still reads from `Document.content`. |

## Key Design Decisions

1. **LLM writes JSON, not markdown.** The template owns all formatting.
2. **Save rendered markdown** to `Document.content`. Polish JSON is ephemeral. The existing edit-the-markdown flow works unchanged.
3. **Replace semantics on polish.** LLM returns complete replacement bullets per experience entry, not append.
4. **Zod validation with retry × 1 + graceful fallback.** Bad JSON → retry → unpolished. Never crashes.
5. **Strategic context preserved.** All existing prompt inputs (achievement framing, blueprint, identity cards, ATS keywords, resume rules) are unchanged — only the output instruction changes.
6. **Quality enforcers adapt to text fields.** First-person enforcement (non-negotiable), banned-phrase scrubber, AI-tell tagging, and ATS keyword check run on `ResumeData.professionalSummary` and `experience[].description` instead of markdown lines.
7. **First person is non-negotiable.** The professional summary must never use third person. The first-person enforcer runs on the summary text before template rendering, independent of other quality steps.

## Testing

Minimum verification:

1. **Snapchat test.** `profileToMarkdown` with a representative `ResumeData` input. Confirm output matches expected markdown exactly. Catches regressions in the template renderer.
2. **Glued-heading test.** Integration test that generates a resume from a representative profile + polish JSON and asserts the rendered markdown contains zero occurrences of `##` followed immediately by a non-space character (regex: `/##[^\s#]/`).
3. **First-person test.** After first-person enforcement, assert `professionalSummary` does not contain the user's name or third-person pronouns ("he", "she", "his", "her", "[Name] is...").

## Safety

Every change is additive (new file) or conditional (if-block). The old markdown path is fully preserved. Removing the `if activeTab === 'resume'` conditional in `ApplicationWorkspace.tsx` restores old behavior with no other changes needed.

Existing `Document.content` rows are left untouched. In-flight resumes continue rendering as-is until the user explicitly regenerates.
