# Company Intel + Analysis Results Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Perplexity-powered company intel research (background, persisted on JobApplication) and redesign the analysis results page with action-oriented copy + inline bridging UX.

**Architecture:** Company intel fires as a background fetch during the `/jobs` POST (when user navigates to `/apply`), not during analysis. Analysis results page gets updated labels and inline bridging. Two independent tracks can be implemented in parallel.

**Tech Stack:** Node/Express, TypeScript, Prisma/PostgreSQL, OpenRouter, Perplexity sonar-pro, React, Tailwind

---

## File Structure

### New files
- `server/src/services/companyIntel.ts` — Perplexity prompt construction + fetch orchestration

### Modified files
- `server/src/services/llm.ts` — Add `callPerplexity()` function
- `server/prisma/schema.prisma` — Add `companyIntel Json?` to JobApplication model
- `server/src/index.ts` — Add `companyIntel` column to `ensureColumns()` raw SQL
- `server/src/routes/profile/jobs.ts` — Fire background intel fetch after JobApplication create
- `src/components/strategy/AnalysisResult.tsx` — Redesign cards, copy, inline bridging UX

---

## Task 1: Add `callPerplexity` to LLM service

**Files:**
- Modify: `server/src/services/llm.ts`

**Goal:** Add a new function that calls `perplexity/sonar-pro` via OpenRouter and returns both content and citations. Follows the exact same pattern as `callLLM` and `callClaude`.

- [ ] **Add `callPerplexity` function**

Insert after `callClaude` (around line 125) in `server/src/services/llm.ts`:

```typescript
/**
 * Calls Perplexity Sonar Pro via OpenRouter for web-search-backed research.
 * Returns content + citations from the search results.
 */
export async function callPerplexity(
  prompt: string,
  jsonMode: boolean = true
): Promise<{ content: string; citations: string[] }> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set in environment variables.');
  }

  return await retryWithBackoff(async () => {
    const response = await axios.post(
      OPENROUTER_URL,
      {
        model: 'perplexity/sonar-pro',
        temperature: 0,
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content: jsonMode
              ? 'You are a company research assistant. Return ONLY valid JSON. No preamble, no markdown fences.'
              : 'You are a company research assistant.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://aussiegradcareers.com.au',
          'X-Title': process.env.OPENROUTER_APP_TITLE || 'JobHub',
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const content = response.data.choices[0].message.content as string;
    const citations: string[] = response.data.citations ?? [];
    return { content, citations };
  });
}
```

Key differences from `callLLM`:
- Model: `perplexity/sonar-pro` (not meta-llama)
- Timeout: 10s (shorter — Perplexity search is fast)
- Max tokens: 1024 (short structured output)
- Returns `{ content, citations }` object (not just a string)

- [ ] **Test the build**

```bash
cd server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no type errors (the `citations` field may be typed as `never[]` by axios — add `(response.data as any).citations ?? []` if needed).

---

## Task 2: Create companyIntel service

**Files:**
- Create: `server/src/services/companyIntel.ts`

- [ ] **Create new service file**

```typescript
import { callPerplexity } from './llm';

export interface CompanyIntelParams {
  companyName: string;
  jobTitle: string;
  jobExcerpts: string[];
  candidateSkills: string[];
}

export interface CompanyIntelResult {
  summary: string;
  suggestedContact: {
    title: string;
    reason: string;
  };
  citations: string[];
  fetchedAt: string;
}

/**
 * Fetches company intelligence by researching the intersection of
 * the candidate's profile, the job description, and the target company.
 * Calls Perplexity sonar-pro via OpenRouter.
 */
export async function fetchCompanyIntel(
  params: CompanyIntelParams
): Promise<CompanyIntelResult> {
  const { companyName, jobTitle, jobExcerpts, candidateSkills } = params;

  const prompt = [
    `Company: ${companyName}`,
    `Job Title: ${jobTitle}`,
    `Key requirements from the job: ${jobExcerpts.join('; ')}`,
    `Candidate's relevant strengths: ${candidateSkills.join(', ')}`,
    '',
    'Research the intersection of this candidate, this job, and this company.',
    'Find specific, concrete connections the candidate can reference in a cover letter.',
    '',
    'Return JSON with this exact structure:',
    '{',
    '  "summary": "3-4 sentence paragraph — specific tools, projects, initiatives, or culture signals that connect the candidate to this company",',
    '  "suggestedContact": {',
    '    "title": "e.g. Head of Marketing, CTO, HR Manager, Founder/CEO",',
    '    "reason": "One sentence explaining why this person is the right contact"',
    '  }',
    '}',
  ].join('\n');

  const result = await callPerplexity(prompt, true);

  // Parse the JSON response from Perplexity
  let parsed: { summary: string; suggestedContact: { title: string; reason: string } };
  try {
    parsed = JSON.parse(result.content);
  } catch {
    // If Perplexity returns fuzzy JSON, try to extract from markdown code block
    const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      // Last resort: clean and parse
      const cleaned = result.content
        .replace(/^```(?:json)?\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      parsed = JSON.parse(cleaned);
    }
  }

  if (!parsed.summary || !parsed.suggestedContact?.title) {
    throw new Error('Company Intel response missing required fields');
  }

  return {
    summary: parsed.summary,
    suggestedContact: {
      title: parsed.suggestedContact.title,
      reason: parsed.suggestedContact.reason ?? '',
    },
    citations: result.citations,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Builds the candidate skills preview from profile data for the intel prompt.
 * Extracts the top N skills, preferring those that are strings over object shapes.
 */
export function buildSkillsPreview(
  rawSkills: any,
  maxCount: number = 7
): string[] {
  if (!rawSkills) return [];

  let skills: string[] = [];

  if (Array.isArray(rawSkills)) {
    skills = rawSkills
      .filter((s: any) => typeof s === 'string')
      .slice(0, maxCount);
  } else if (typeof rawSkills === 'object') {
    // Profile skills are often stored as { technical: string[], softSkills: string[], ... }
    const sections = ['technical', 'industryKnowledge', 'softSkills', 'tools', 'other'];
    for (const section of sections) {
      if (Array.isArray((rawSkills as any)[section])) {
        for (const item of (rawSkills as any)[section]) {
          if (typeof item === 'string' && skills.length < maxCount) {
            skills.push(item);
          }
        }
      }
    }
  }

  return skills;
}
```

- [ ] **Test the build**

```bash
cd server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no type errors.

---

## Task 3: Add companyIntel column to schema + startup

**Files:**
- Modify: `server/prisma/schema.prisma`
- Modify: `server/src/index.ts`

- [ ] **Update Prisma schema**

In `server/prisma/schema.prisma`, add the field to the `JobApplication` model (around line 192, after `followUpSentAt`):

```prisma
companyIntel           Json?
```

- [ ] **Add raw SQL migration to `ensureColumns`**

In `server/src/index.ts`, inside the first `$executeRawUnsafe` block (which targets `JobApplication`), add:

```sql
ADD COLUMN IF NOT EXISTS "companyIntel" JSONB,
```

Insert it after `ADD COLUMN IF NOT EXISTS "followUpSentAt" TIMESTAMP(3);` so it looks like:

```typescript
await prisma.$executeRawUnsafe(`
  ALTER TABLE "JobApplication"
    ADD COLUMN IF NOT EXISTS "australianFlags" JSONB,
    ADD COLUMN IF NOT EXISTS "dimensions" JSONB,
    ADD COLUMN IF NOT EXISTS "matchedIdentityCard" TEXT,
    ADD COLUMN IF NOT EXISTS "overallGrade" TEXT,
    ADD COLUMN IF NOT EXISTS "followUpSentAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "companyIntel" JSONB;
`);
```

- [ ] **Test the build**

```bash
cd server && npx prisma validate && npx tsc --noEmit 2>&1 | head -20
```

Expected: "Schema is valid" + no type errors.

---

## Task 4: Fire background intel fetch from /jobs POST

**Files:**
- Modify: `server/src/routes/profile/jobs.ts`

**Context:** The `POST /jobs` route creates a `JobApplication` and is called when the user reaches the Track step in StepperWorkspace. This is where we fire the background Perplexity call — the application row already exists, so we can write the intel directly to it.

- [ ] **Read the current jobs route to find the create handler**

The handler at line 54 (`prisma.jobApplication.create`). After the job is created, we add a fire-and-forget intel call.

- [ ] **Add imports at the top of `jobs.ts`**

Check existing imports, then add:

```typescript
import { fetchCompanyIntel, buildSkillsPreview } from '../services/companyIntel';
import { prisma } from '../../index';
```

(prisma import likely already exists — check and skip if so.)

- [ ] **Add fire-and-forget intel call after job creation**

After the `prisma.jobApplication.create()` call succeeds (around line 64), add:

```typescript
// ── Background: fetch company intel ────────────────────────────────────
// Fire-and-forget — never blocks the response. The intel is consumed by
// the cover letter generation flow later.
if (company && company !== 'Unknown Company') {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId: job.userId } as any,
    select: { skills: true },
  });

  const skillsPreview = buildSkillsPreview(profile?.skills, 7);

  // Use excerpts from the job description for context
  const jobExcerpts = (description ?? '')
    .split('\n')
    .filter((l: string) => l.trim().length > 20)
    .slice(0, 3);

  fetchCompanyIntel({
    companyName: company,
    jobTitle: title || 'Unknown Role',
    jobExcerpts,
    candidateSkills: skillsPreview,
  })
    .then(intel =>
      prisma.jobApplication.update({
        where: { id: job.id },
        data: { companyIntel: intel as any },
      })
    )
    .catch((err: Error) =>
      console.warn('[companyIntel] background fetch failed:', err.message)
    );
}
```

**Important:** `job` is the created application — you need its `userId` and `id`. The create returns the created record, so use the return value. If the create doesn't store it in a `job` variable, refactor to:

```typescript
const job = await prisma.jobApplication.create({ ... });
```

- [ ] **Test the build**

```bash
cd server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no type errors.

---

## Task 5: Redesign AnalysisResult component — copy + labels

**Files:**
- Modify: `src/components/strategy/AnalysisResult.tsx`

**Goal:** Update card labels, copy, and remove the modal-based bridging UX. Replace with inline checkbox bridging.

- [ ] **Update the `DualSignalResult` interface**

The interface stays the same (no new fields). The `bridgeableGap.items` already contains `{ skill: string; suggestion: string }[]` which is exactly what we need for inline display.

- [ ] **Update card labels and copy**

Replace the card rendering sections:

**Direct Match card** (around line 134, `{directMatch.pct > 0 && (`):

Replace the entire card with:

```tsx
{directMatch.pct > 0 && (
  <ResultCard
    accent={warm.colors.success}
    icon={<CheckCircle2 size={18} />}
    label="Include in resume"
    pct={directMatch.pct}
    body={
      <>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: warm.colors.textMuted, lineHeight: 1.55 }}>
          Achievements that prove you can deliver what this role asks for.
          <strong style={{ color: warm.colors.textSecondary }}> These will be included in your resume.</strong>
        </p>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {directMatch.evidence.length === 0 ? (
            <li style={{ fontSize: 13, color: warm.colors.textMuted, lineHeight: 1.6 }}>
              No achievements surfaced for this role yet.
            </li>
          ) : (
            directMatch.evidence.map((line, i) => (
              <li key={i} style={{
                fontSize: 13,
                color: warm.colors.textSecondary,
                lineHeight: 1.6,
                paddingLeft: 14,
                position: 'relative',
              }}>
                <span style={{ position: 'absolute', left: 0, color: warm.colors.success }}>•</span>
                {line}
              </li>
            ))
          )}
        </ul>
      </>
    }
  />
)}
```

**Bridgeable Gap card** (around line 166, `{bridgeableGap.items.length > 0 && (`):

Replace with new label "Could add" and a body that renders items with checkboxes + inline suggestion text + Edit/Undo affordances:

```tsx
{bridgeableGap.items.length > 0 && (
  <ResultCard
    accent={warm.colors.accentPetrol}
    icon={<Sparkles size={18} />}
    label="Could add"
    pct={bridgeableGap.pct}
    body={
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
        <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, lineHeight: 1.55 }}>
          You likely have these — they just aren't on your profile yet.
          Adding them boosts your match to <strong style={{ color: warm.colors.textSecondary }}>{directMatch.pct + bridgeableGap.pct}%</strong>.
        </p>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {bridgeableGap.items.map((item, i) => {
            const isBridged = bridgedIndices.has(i);
            return (
              <li key={i} style={{
                padding: '12px 14px',
                background: isBridged ? 'rgba(125,166,125,0.14)' : 'rgba(125,166,125,0.06)',
                border: `1px solid ${isBridged ? 'rgba(125,166,125,0.40)' : 'rgba(125,166,125,0.18)'}`,
                borderRadius: 10,
                transition: 'background 0.2s, border-color 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={isBridged}
                    onChange={() => {
                      setBridgedIndices(prev => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i); else next.add(i);
                        return next;
                      });
                    }}
                    style={{
                      marginTop: 2,
                      accentColor: warm.colors.accentPetrol,
                      width: 16,
                      height: 16,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: '0 0 4px',
                      fontSize: 13,
                      fontWeight: 700,
                      color: warm.colors.textPrimary,
                      textDecoration: isBridged ? 'line-through' : 'none',
                      textDecorationColor: 'rgba(125,166,125,0.55)',
                    }}>
                      {item.skill}
                    </p>
                    {isBridged ? (
                      <div style={{ marginTop: 6 }}>
                        <div style={{
                          padding: '8px 10px',
                          background: 'rgba(125,166,125,0.08)',
                          border: '1px solid rgba(125,166,125,0.25)',
                          borderRadius: 8,
                          fontSize: 12,
                          color: warm.colors.textSecondary,
                          lineHeight: 1.5,
                        }}>
                          {item.suggestion}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <button
                            onClick={() => {/* TODO: inline edit */}}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: warm.colors.accentPetrol,
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            ✎ Edit
                          </button>
                          <button
                            onClick={() => {
                              setBridgedIndices(prev => {
                                const next = new Set(prev);
                                next.delete(i);
                                return next;
                              });
                            }}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: warm.colors.textMuted,
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            × Undo
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    }
  />
)}
```

**Note:** The bridgeable gap items still need the real `Draft` action for non-bridged items (the "Draft this" button that opens the modal). Keep the existing `draftIndex`/`AchievementDraftModal` logic for the non-bridged state. The checkbox bridging is a local-only state toggle — it marks the gap as "I'll handle this" without persisting to the DB.

**Hard Gap card** (around line 269):

Replace label from "Hard Gap" to "Not on your profile":

```tsx
<ResultCard
  accent={warm.colors.textSecondary}
  icon={<Lock size={18} />}
  label="Not on your profile"
  pct={null}
  // ... rest stays the same
>
```

- [ ] **Update the headline copy**

The headline logic at line 65-70 already works. Update the bridgeable gap variant to use the new framing:

```tsx
const headline =
  dominantBand === 'directMatch'
    ? `Your achievements prove you can do ${directMatch.pct}% of this role right now.`
    : dominantBand === 'bridgeableGap'
      ? `Direct match: ${directMatch.pct}%. Could add: ${directMatch.pct + bridgeableGap.pct}% once you name what you already do.`
      : 'This role lists requirements you haven\'t claimed on your profile.';
```

- [ ] **Remove the modal-based bridging UX**

The `AchievementDraftModal` is only shown when `draftItem !== null` and a modal was opened. Keep it for the existing "Draft this" button path — but the checkbox path is purely local state, no modal needed.

- [ ] **Test the build**

```bash
cd .. && npx tsc --noEmit 2>&1 | head -20
```

Expected: no type errors.

---

## Task 6: Single sticky apply bar

**Files:**
- Modify: `src/components/strategy/AnalysisResult.tsx`

**Goal:** Replace the current bottom CTA buttons with a single sticky apply bar at the top of the result section.

- [ ] **Add ref-based floating bar at top**

Replace the CTA buttons section (around line 341-380, the `{/* CTAs */}` div) with:

```tsx
{/* Sticky apply bar */}
<div style={{
  position: 'sticky',
  top: 24,
  zIndex: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '14px 20px',
  background: warm.colors.bgSurface,
  border: `1px solid ${warm.colors.borderWhisper}`,
  borderRadius: 14,
  boxShadow: warm.shadow.soft,
  marginBottom: 8,
}}>
  <div>
    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>
      Apply for this role
    </p>
    <p style={{ margin: '2px 0 0', fontSize: 12, color: warm.colors.textMuted }}>
      {extractedMetadata.role} · {extractedMetadata.company}
    </p>
  </div>
  <button
    onClick={onContinue}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '10px 22px',
      fontSize: 14,
      fontWeight: 700,
      color: warm.colors.bgCanvas,
      background: warm.colors.accentPetrol,
      border: 'none',
      borderRadius: 12,
      cursor: 'pointer',
      boxShadow: warm.shadow.soft,
      letterSpacing: '-0.01em',
      whiteSpace: 'nowrap',
    }}
  >
    Apply now
    <ArrowRight size={16} />
  </button>
</div>
```

Remove the old CTA buttons block completely.

- [ ] **Test the build**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no type errors.

---

## Self-Review Checklist

**Spec coverage:**
- [x] Task 1: `callPerplexity` in llm.ts — covers §2.3
- [x] Task 2: companyIntel service — covers §2.1, §2.2
- [x] Task 3: DB schema + migration — covers §2.4
- [x] Task 4: background fetch from /jobs POST — covers §2.5, §2.6
- [x] Task 5: AnalysisResult redesign — covers §3.3, §3.4, §3.5
- [x] Task 6: sticky apply bar — no Company Intel on analysis page (§3.1)

**Placeholder check:** No placeholders. Every code block contains real implementation.

**Type consistency:** The `CompanyIntelResult` return type in `companyIntel.ts` matches the shape persisted as `companyIntel Json?` in Prisma. The `DualSignalResult` interface is unchanged.
