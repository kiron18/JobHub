/**
 * applyWorkspaceCopy.ts — ALL user-facing copy for the de-frictioned apply
 * workspace (Slice C: parallel resume + cover-letter generation, upfront
 * gap-confirm modal, no placeholder tokens).
 *
 * Authored for JobHub's ICP (international grads / skilled migrants in
 * Australia). Voice = calm, momentum-forward, agency-giving. The user does
 * almost nothing: they confirm a couple of strengths and read a finished doc.
 *
 * ⚠️ Single source of truth for these strings. Do NOT reword, paraphrase,
 * inline alternatives, or "improve" any of it. Import and render verbatim.
 * `{skill}` style runtime values are supplied via the functions.
 */

export const applyWorkspaceCopy = {
  // ── GapConfirmModal ───────────────────────────────────────────────────────
  // Opens over the workspace the instant analysis finishes, before generation.
  // Pre-checked strengths the role wants; the user confirms in one tap.
  gapModal: {
    header: 'Quick check before we write',
    sub: "We spotted a few strengths this role is asking for. Confirm they're true and we'll build them into your resume — untick anything that isn't you.",
    editHint: 'Tap the text to adjust the wording.',
    cta: 'Looks right',
  },

  // ── Review framing ────────────────────────────────────────────────────────
  // Sits above each finished document. Shifts the mindset from "do work" to
  // "review and trim". The documents are already done.
  reviewFraming: {
    resume:
      "Your resume's done. Read it once, trim anything that doesn't fit, then download — it's yours to edit.",
    coverLetter:
      "Your cover letter's done. Read it once, trim anything that doesn't fit, then download.",
  },
} as const;
