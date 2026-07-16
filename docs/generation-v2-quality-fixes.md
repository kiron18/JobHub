# Generation V2 quality fixes (post Vaibhav incident, 2026-07-15)

Context: prod (Railway + Vercel) confirmed on `7ccbd1b` = V2 live. DB forensics proved both
of Vaibhav's generations today were grammatically clean; the garbled PDF sentence was his own
in-app edit (he also fixed the placeholder phone, which is how we know he edited), and the
"## Professional Summary" screenshot was a partial copy of raw markdown from the Copy button.
The V2 engine (one Claude call, shape check, grounding gate) is sound. The gaps are the prompt
skeleton, the UI edges, and observability. Full analysis lives in the incident notes in
Claude's memory (`jobhub-generation-v2`).

## Phase A: ship before Vaibhav regenerates (promised "this afternoon")

1. **Prompt: stop deleting content.** In `server/src/services/prompts/generationV2.ts`
   (`RESUME_V2_PROMPT`):
   - Add a `## Publications` section to OUTPUT FORMAT (include only if the resume has any;
     never drop a publication).
   - Add GitHub to the contact line spec: `{email} | {phone} | {linkedin} | {github} | {location}`.
   - Add rule: "Never drop publications or certifications. If space is tight, trim older
     project bullets first, and prefer keeping a one-line mention over deleting a section."
   - Add rule: "Omit any contact item that looks like a placeholder or note-to-self
     (e.g. '04XX XXX XXX', 'add correct number', 'TBD')."
2. **Copy button copies plain text, not markdown.** `src/pages/StepperWorkspace.tsx`
   (`handleCopy`): strip `#`/`*`/`-` markers into readable plain text before writing to
   clipboard. This caused the client's "## symbols" complaint.
3. **Grammar check before download.** One cheap/fast model call over the final text
   (generated or edited) when the user hits Download; inline warning for broken sentences.
   This is the only guard that catches client-introduced garble, which was the actual
   failure vector today.

## Phase B: observability (next)

4. **Persist client edits server-side.** Edits currently live only in localStorage
   (`saveDraft`, `edited: true` never reaches the server). Add an endpoint to save edited
   content + flag + timestamp on the Document row; show an "edited by you" badge; expose
   generated-vs-edited diff in the coach/admin view.
5. **Log generation forensics.** Persist per generation: raw first Claude output, whether
   shape/grounding retry fired, violations found, which draft shipped. Even structured
   console logs on Railway would do as v1.
6. **Grounding retry must not adopt a worse draft.** `server/src/routes/generate.ts`
   (`/resume-structured` and `/cover-letter-structured`): currently one violation triggers a
   full regeneration and the retry is adopted even when it still has violations. Compare
   violation counts and keep the better draft.

## Phase C: visual quality (the "look how impressive" gap)

7. **Design pass on `src/lib/exportPdf.tsx`** so one-click downloads match the editor
   preview's quality: serif name, small-caps coloured section headers with rules, skills
   table, italic company descriptors, right-aligned dates. Keep single-column bones
   (ATS-safe), typographic richness only. `@react-pdf/renderer` supports all of it; the
   current template just never got a design pass. Same treatment for `exportDocx.ts`.
8. Alternative/quick win considered: print the styled HTML preview via browser print CSS.
   Rejected as primary path (print-dialog friction) but fine as a stopgap.

## Phase D: product (later)

9. **Native PDF input.** Store the uploaded resume file and send PDF bytes to Claude
   directly (API supports it) instead of extracted text; kills extraction garble
   ("git hub.com", spaced headings, &#x26; entities). Requires file storage (Supabase).
10. **Section-level regeneration / structured editor.** The client's actual feature ask;
    also removes the raw-markdown-textarea hazard that caused this incident.
11. Send `jobApplicationId` from `StepperWorkspace` so documents link to the tracker and
    the cover letter's resume-consistency lookup stops being dead code.

## Known-good facts (don't re-litigate)

- voiceEnforcer/scrubAITells/scrubBannedPhrases do NOT run on V2 routes; they only touch
  legacy `/generate/:type` docs (cold-outreach, rejection-response, offer-negotiation).
- Old resume/cover-letter/SC wildcard paths return 410; frontend calls only `-structured`.
- `PREMIUM_MODEL = CLAUDE_MODEL_PREMIUM || CLAUDE_MODEL || 'anthropic/claude-sonnet-4-5'`;
  verify Railway env values when touching model config. `callClaude` has no
  `finish_reason === 'length'` truncation check (minor, known).
