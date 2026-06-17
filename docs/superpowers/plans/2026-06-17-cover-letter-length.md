# Cover Letter Length Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make generated cover letters adaptively longer (up to one page) by driving length from genuine evidence depth, with no padding or fabrication.

**Architecture:** Length is controlled entirely by the prompt string in `coverLetterSlotsPrompt.ts`. This plan changes two things in that one file: the LENGTH rule, and the per-slot sentence hints in the OUTPUT JSON template. No other files change behaviour. Nothing downstream clamps length.

**Tech Stack:** TypeScript, Vitest.

---

## ZERO-LATITUDE NOTICE FOR THE EXECUTOR

- This is a STRING-EDIT-ONLY plan. Copy the exact `old_string` and `new_string` blocks below. Do NOT reword, rephrase, "improve", or reformat any prompt text. The prompt copy is locked.
- Preserve every `${...}` template expression and every backslash exactly as shown. `${contactTitle}`, `${signoff}`, `${profile?.name ?? ''}`, and `\\n` must remain byte-for-byte identical.
- Do NOT touch any other file, rule, or prompt. Do NOT edit `server/rules/cover_letter_rules.md`.
- If any `old_string` below does not match the file exactly, STOP and report. Do not guess a replacement.

---

## Task 1: Lock the new length behaviour with a test

**Files:**
- Modify (test): `server/src/services/prompts/coverLetterSlotsPrompt.test.ts`

- [ ] **Step 1: Add a failing test**

Add this test inside the existing `describe('COVER_LETTER_SLOTS_PROMPT', () => { ... })` block, immediately after the last existing `it(...)` test and before the closing `});` of the describe:

```typescript
  it('caps length at one page and forbids padding to reach length', () => {
    const out = COVER_LETTER_SLOTS_PROMPT('JD', profile, [], blueprint);
    expect(out).toContain('never exceed roughly 450 words');
    expect(out).toContain('A shorter letter is always better than a padded one');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && npx vitest run src/services/prompts/coverLetterSlotsPrompt.test.ts`
Expected: the new test FAILS (the two strings are not yet in the prompt). The five existing tests PASS.

If the existing tests do not pass, STOP and report.

---

## Task 2: Rewrite the LENGTH rule

**Files:**
- Modify: `server/src/services/prompts/coverLetterSlotsPrompt.ts`

- [ ] **Step 1: Replace the LENGTH rule**

Find this exact line (it is rule 6):

old_string:
```
6. LENGTH. Tight and readable: roughly 250 to 350 words across the four paragraphs. Every sentence earns its place.
```

new_string:
```
6. LENGTH. The letter must fit one page: never exceed roughly 450 words across the four paragraphs. Within that ceiling, length should follow the depth of genuine, relevant evidence. When the candidate has strong, relevant experience, develop it fully. When their relevant material is thin, keep the letter shorter and sharper rather than stretching it. A shorter letter is always better than a padded one. Never invent, repeat, or generalise to reach a length, and never add a claim the resume does not support just to fill space. Every sentence must earn its place.
```

---

## Task 3: Adjust the per-slot sentence hints

**Files:**
- Modify: `server/src/services/prompts/coverLetterSlotsPrompt.ts`

- [ ] **Step 1: Replace the OUTPUT JSON template block**

Find this exact block:

old_string:
```
{
  "salutation": "Dear ${contactTitle},",
  "p1": "opening hook + genuine company connection, 3-4 sentences",
  "p2": "strongest real evidence for this job, 3-4 sentences",
  "p3": "second genuine strength covering another requirement, 3-4 sentences",
  "p4": "confident close with a call to a conversation, 2-3 sentences",
  "signoff": "${signoff}\\n${profile?.name ?? ''}"
}
```

new_string:
```
{
  "salutation": "Dear ${contactTitle},",
  "p1": "opening hook + genuine company connection, 2-3 sentences",
  "p2": "strongest real evidence for this job, tied to a specific requirement from the job description, 3 to 5 sentences (use only as many as genuine evidence supports)",
  "p3": "second genuine strength covering another requirement from the job description and, where research allows, connected to this company, 3 to 5 sentences (use only as many as genuine evidence supports)",
  "p4": "confident close with a call to a conversation, 2-3 sentences",
  "signoff": "${signoff}\\n${profile?.name ?? ''}"
}
```

---

## Task 4: Verify and commit

**Files:**
- None (verification only)

- [ ] **Step 1: Run the prompt tests**

Run: `cd server && npx vitest run src/services/prompts/coverLetterSlotsPrompt.test.ts`
Expected: ALL six tests PASS (the five original plus the new length test from Task 1).

If any test fails, STOP and report. Do not edit the prompt copy to make a test pass; the copy is locked.

- [ ] **Step 2: Commit**

```bash
git add server/src/services/prompts/coverLetterSlotsPrompt.ts server/src/services/prompts/coverLetterSlotsPrompt.test.ts
git commit -m "feat(cover-letter): adaptive page-bounded length, no padding"
```

---

## STOP

After Task 4 commits, STOP and report completion. Do not run wider builds, do not refactor, do not touch any other file.
