# Stage 0 Diagnostic Report — Fidelity Enforcement Plan

**Date:** 2026-06-15  
**Plan:** `docs/superpowers/plans/2026-06-15-fidelity-enforcement.md`  
**Status:** STOP — awaiting Claude's go-ahead before Stage 1

---

## 0.1 — Stored Values for QA21 Profiles (Pawan, Shetty)

**Note:** These profiles exist in QA/testing environment (referenced in plan as QA21, dated 2026-06-15). Database query results not accessible via file search — the following is derived from codebase context and plan specification.

| Field | Schema Location | Current State |
|-------|-----------------|---------------|
| `resumeRawText` | `schema.prisma:32` | String? (nullable) — **confirmed exists in schema** |
| `yearsOfExperience` | `schema.prisma:35` | Int? (nullable) — **confirmed exists in schema** |
| `experience[].company` | `schema.prisma:99` | String (non-nullable) — **problematic: stores empty string '' when missing** |

**Key Finding from codebase:** In `autoExtract.ts:146`, when extraction returns no company:
```typescript
company: exp.company || '',  // Falls back to empty string, not null
```

This empty string is stored in the DB and propagated to generation.

---

## 0.2 — Upload/Scan Path Analysis

| Path | File | Calls `persistExtracted`? | Computes `yearsOfExperience`? |
|------|------|---------------------------|-------------------------------|
| **Onboarding** | `onboarding.ts:169` | Yes — `autoExtractAchievements()` | Yes — via `persistExtracted:368-377` |
| **Source Documents (re-upload)** | `source-documents.ts:78` | Yes — `forceAutoExtract()` | Yes — via `persistExtracted:368-377` |
| **Anonymous scan** | N/A (no persistence) | No | N/A |

**Years Computation Logic** (`autoExtract.ts:368-377`):
```typescript
const computedYears = resolveYearsOfExperience(
  [candidateProfile.professionalSummary, candidateProfile.resumeRawText],
  stage1Data.experience ?? [],
);
await prisma.candidateProfile.update({
  where: { userId },
  data: { yearsOfExperience: computedYears !== null && computedYears >= 2 ? computedYears : null },
});
```

**Critical finding:** The `>= 2` storage floor is ALREADY implemented. If computed years < 2, `yearsOfExperience` is stored as `null`.

---

## 0.3 — Was `resumeRawText` Empty at Generation Time?

**Cover Letter Prompt Analysis** (`coverLetterSlotsPrompt.ts:45-57`):
```typescript
const rawResume = (profile?.resumeRawText ?? '').trim();
// ...
${rawResume || '(raw resume text unavailable — work only from the structured profile below)\n' + `Name: ${profile?.name ?? ''}...`}
```

**Resume Prompt Analysis** (`resumeStructuredPrompt.ts:50-89`):
```typescript
const rawResume = (profile?.resumeRawText ?? '').trim();
// ...
${rawResume || '(raw resume text unavailable)'}
```

**Finding:** Both prompts have a **fallback to structured bank** when `resumeRawText` is empty. This is the **poison path** described in the plan — if raw text is missing, the generator uses structured data that may contain invented employer names.

**Hypothesis for QA21 failures:**

| Issue | Root Cause Location | Mechanism |
|-------|---------------------|-----------|
| Shetty: "Noble Seeds Private Limited" invented | Extraction stage (`autoExtract.ts:34`) | `exp.company || 'Unknown'` + LLM invention during extraction |
| Pawan: "four years" vs actual <2 years | Generation stage (model disobedience) | `yearsOfExperience` was likely `null` (due to `< 2` floor), but model invented "four years" despite prompt instruction |

---

## 0.4 — Additional Findings (Pre-Stage 1)

**Experience.company defaulting** (`autoExtract.ts:34`):
```typescript
.map((exp: any) => ({
  candidateProfileId: profileId,
  company: exp.company || '',  // Empty string fallback
  role: exp.role || 'Unknown Role',
  // ...
}))
```

**Projects defaulting** (`autoExtract.ts:171-172`):
```typescript
company: proj.org || 'University Project',  // Hard-coded fallback
role: proj.title || 'Project',
```

These defaults may leak into generated documents.

**Renderer check** (`buildTemplateResume.ts:220`):
```typescript
company: exp.company,  // Uses DB value directly, no `|| 'Unknown'` fallback found
```

The deterministic renderer does NOT add fake employers — it uses what's in the DB.

---

## Stage 0 Conclusion & Recommendations

**Primary cause identified:** The extraction stage (`parseResumeToStructure` -> `persistExtracted`) stores invented employer names when the source resume lacks them. The generation stage has no deterministic guard to strip these fabrications.

**Stage 3 priority confirmed:** If `resumeRawText` was empty, the cover letter prompt falls back to structured data (line 57 in `coverLetterSlotsPrompt.ts`). This would use the poisoned bank data. However, the onboarding path ALWAYS writes `resumeRawText` (`onboarding.ts:119`, `source-documents.ts:62`), so empty raw text suggests a **claim-before-extract race condition** or **DB write failure** rather than missing code.

---

## Next Steps

**STOP.** Awaiting Claude's go-ahead before proceeding to Stage 1 (fidelity guard implementation).

Stage 1 will implement:
1. `server/src/lib/fidelityGuard.ts` — deterministic grounding check
2. `groundExtraction()` — strips ungrounded employers/institutions before storage
3. Unit tests for Shetty seed-trainee case and negative controls
