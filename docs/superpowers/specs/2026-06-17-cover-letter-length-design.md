# Cover Letter Length — Adaptive, Page-Bounded, Evidence-Driven

*Date: 2026-06-17*
*Scope: cover letter generation only*

## Problem

Generated cover letters read too short (~320 to 340 words). We want them roughly
25% longer (~400 to 420 words) without padding, fabrication, or breaking the
one-page convention.

## Root cause

Length is controlled entirely by `server/src/services/prompts/coverLetterSlotsPrompt.ts`.
Nothing downstream clamps length:

- Quality enforcers (`coverLetterQualityEnforcers.ts`) only fix sentence-case and
  scrub banned phrases. No word-count logic.
- No `max_tokens` ceiling binds (a 450-word letter is ~600 tokens).
- `server/rules/cover_letter_rules.md` is a reference doc and is NOT fed to the
  generator. Ignore it for behaviour.

Two anchors in the live prompt cap length, and the tighter one wins:

1. Word band (line 86): "roughly 250 to 350 words."
2. Per-slot sentence hints in the JSON template: p1/p2/p3 "3-4 sentences", p4
   "2-3 sentences". Models obey explicit sentence counts more rigidly than a word
   range, so this is the binding constraint and lands output at ~300 to 340 words.

## Decision

**Option A: emergent length within a one-page ceiling.** Length becomes an output
of genuine evidence depth, not a dialed number. A strong candidate fills the page
honestly; a thin candidate stays shorter and sharper, which is correct. No
pre-computed evidence budget (Option B) for now.

The one-page limit is the outer wall. A one-page 11pt letter, minus header, date,
salutation and signoff, holds ~400 to 450 words of body. That is the ceiling, not
the target.

"Lines" / "one page" cannot be controlled directly at generation time (the model
emits four JSON paragraphs as plain text; line count is render-dependent). It is
translated into a word ceiling tuned to fit one page. A true render-time page
backstop in the exporter is a possible future safety net, out of scope here.

## Changes (single file: `coverLetterSlotsPrompt.ts`)

1. **Rewrite the LENGTH section (currently rule 6, line 86).** Replace the fixed
   "250 to 350 words" band with:
   - A one-page ceiling of roughly 450 words, never more.
   - An explicit instruction that length should match the depth of genuine,
     relevant evidence: develop strong achievements fully; stay concise when
     material is thin.
   - An anti-padding line: a shorter letter is better than a padded one; never
     invent, repeat, or generalise to reach a length.

2. **Adjust per-slot sentence hints in the OUTPUT JSON template:**
   - `p1`: keep at 2-3 sentences (tight hook).
   - `p2`: "3 to 5 sentences, as many as genuine evidence supports."
   - `p3`: "3 to 5 sentences, as many as genuine evidence supports."
   - `p4`: keep at 2-3 sentences (tight close).

3. **Strengthen alignment in the evidence paragraphs (p2, p3).** Each evidence
   paragraph must tie its genuine achievement to a specific requirement from the
   job description and, where research exists, to this company. The extra length
   comes from richer evidence and tighter alignment, not more words around the
   same content.

## Out of scope

- Pre-computed evidence budget (Option B).
- Render-time page-overflow backstop in the PDF/DOCX exporter.
- `cover_letter_rules.md` edits (not fed to the generator; can be reconciled
  separately to avoid future confusion).
- Adding a fifth paragraph (system is hardwired to four slots end to end).

## Risk

Models drift toward filling available space, so the anti-padding framing must be
strong and explicit. Thin resumes (e.g. two short roles) must stay short rather
than reach for invented content; this is the same fabrication root cause flagged
previously, so the "shorter beats padded, invent nothing" guard is load-bearing.
