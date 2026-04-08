# 10-Dimension Scoring + Identity Card Archetypes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single 0–100 job match score with a 10-dimension scoring model (each 1–5 with A–F letter grade), add a Stage 3 identity derivation pipeline that generates personalised professional identity cards from onboarding data, and surface both in the UI.

**Architecture:** The LLM scores each dimension 1–5; the server computes the weighted composite and overall grade deterministically. Identity cards are derived once post-onboarding and stored on `CandidateProfile`. The matched identity card is passed into Claude's strategic blueprint to improve document framing.

**Tech Stack:** Express/TypeScript/Prisma (server), Vitest + Supertest (tests), React/TypeScript/Framer Motion (client)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `server/src/services/compositeScoring.ts` | Pure functions: weighted composite, grade conversion |
| Create | `server/src/services/prompts/identity.ts` | Identity Derivation prompt + `IdentityCard` type |
| Create | `server/src/services/identityDerivation.ts` | Stage 3 service — calls LLM, writes identity cards to DB |
| Create | `server/src/routes/profile/identity.ts` | `POST /api/profile/regenerate-identity` |
| Create | `src/components/DimensionsIsland.tsx` | Full-width dimension breakdown UI |
| Create | `server/src/tests/compositeScoring.test.ts` | Unit tests for composite scoring |
| Modify | `server/prisma/schema.prisma` | Add `identityCards`, `dimensions`, `overallGrade` etc. |
| Modify | `server/src/services/prompts/analysis.ts` | Expand output schema to include 10 dimensions + AU flags |
| Modify | `server/src/services/prompts/index.ts` | Export identity prompt |
| Modify | `server/src/routes/analyze.ts` | Compute composite, store dimensions on JobApplication |
| Modify | `server/src/services/autoExtract.ts` | Add Stage 3 call after Stage 2 |
| Modify | `server/src/routes/profile/index.ts` | Register identity router |
| Modify | `server/src/services/strategy.ts` | Accept + pass identity card into blueprint |
| Modify | `server/src/services/prompts/strategy.ts` | Include identity card in candidate snapshot |
| Modify | `server/src/tests/analyze.test.ts` | Tests for dimensional response fields |
| Modify | `src/components/MatchEngine.tsx` | Extend `AnalysisResult` interface |
| Modify | `src/components/ApplicationWorkspace.tsx` | Score badge upgrade + DimensionsIsland |
| Modify | `src/components/ProfileBank.tsx` | Identity cards section + regenerate button |

---

## Task 1: DB Migration

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Add fields to `CandidateProfile`**

Open `server/prisma/schema.prisma`. After `marketingEmailSent Boolean @default(false)`, add:

```prisma
  identityCards                Json?
  identityCardsUpdatedAt       DateTime?
  achievementCountAtDerivation Int?
```

- [ ] **Step 2: Add fields to `JobApplication`**

In the same file, after `blueprintJson Json?`, add:

```prisma
  dimensions          Json?
  overallGrade        String?
  matchedIdentityCard String?
  australianFlags     Json?
```

- [ ] **Step 3: Run migration**

```bash
cd server && npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Verify**

```bash
npx prisma studio
```

Confirm `CandidateProfile` and `JobApplication` tables have the new columns. Close Prisma Studio.

- [ ] **Step 5: Commit**

```bash
git add server/prisma/schema.prisma
git commit -m "feat(db): add identity cards and dimension scoring fields"
```

---

## Task 2: Composite Scoring Utility + Tests

**Files:**
- Create: `server/src/services/compositeScoring.ts`
- Create: `server/src/tests/compositeScoring.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/src/tests/compositeScoring.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeComposite, scoreToGrade, addGrades } from '../services/compositeScoring';
import type { DimensionScores } from '../services/compositeScoring';

function makeDimensions(overrides: Partial<Record<keyof DimensionScores, number>> = {}): DimensionScores {
  const defaults: Record<keyof DimensionScores, number> = {
    roleMatch: 4, skillsAlignment: 4, seniorityFit: 4, compensation: 3,
    interviewLikelihood: 4, geographicFit: 5, companyStage: 4,
    marketFit: 3, growthTrajectory: 4, timelineAlignment: 5,
  };
  const scores = { ...defaults, ...overrides };
  const dims = {} as DimensionScores;
  for (const key of Object.keys(scores) as Array<keyof DimensionScores>) {
    dims[key] = { score: scores[key], grade: scoreToGrade(scores[key]), note: 'test note' };
  }
  return dims;
}

describe('scoreToGrade', () => {
  it('maps 5 to A', () => expect(scoreToGrade(5)).toBe('A'));
  it('maps 4 to B', () => expect(scoreToGrade(4)).toBe('B'));
  it('maps 3 to C', () => expect(scoreToGrade(3)).toBe('C'));
  it('maps 2 to D', () => expect(scoreToGrade(2)).toBe('D'));
  it('maps 1 to F', () => expect(scoreToGrade(1)).toBe('F'));
  it('maps 4.6 to A', () => expect(scoreToGrade(4.6)).toBe('A'));
  it('maps 3.6 to B', () => expect(scoreToGrade(3.6)).toBe('B'));
});

describe('computeComposite', () => {
  it('returns matchScore between 0 and 100', () => {
    const { matchScore } = computeComposite(makeDimensions());
    expect(matchScore).toBeGreaterThanOrEqual(0);
    expect(matchScore).toBeLessThanOrEqual(100);
  });

  it('weights sum to 1.0', () => {
    // All 5s => matchScore 100
    const dims = makeDimensions({ roleMatch: 5, skillsAlignment: 5, seniorityFit: 5,
      compensation: 5, interviewLikelihood: 5, geographicFit: 5, companyStage: 5,
      marketFit: 5, growthTrajectory: 5, timelineAlignment: 5 });
    const { matchScore, overallGrade } = computeComposite(dims);
    expect(matchScore).toBe(100);
    expect(overallGrade).toBe('A');
  });

  it('all 1s => matchScore 20 and grade F', () => {
    const dims = makeDimensions({ roleMatch: 1, skillsAlignment: 1, seniorityFit: 1,
      compensation: 1, interviewLikelihood: 1, geographicFit: 1, companyStage: 1,
      marketFit: 1, growthTrajectory: 1, timelineAlignment: 1 });
    const { matchScore, overallGrade } = computeComposite(dims);
    expect(matchScore).toBe(20);
    expect(overallGrade).toBe('F');
  });

  it('caps overallGrade at C when roleMatch is D (score 2)', () => {
    const dims = makeDimensions({ roleMatch: 2, skillsAlignment: 5 });
    const { overallGrade } = computeComposite(dims);
    expect(['C', 'D', 'F']).toContain(overallGrade);
    expect(overallGrade).not.toBe('A');
    expect(overallGrade).not.toBe('B');
  });

  it('caps overallGrade at C when skillsAlignment is D (score 2)', () => {
    const dims = makeDimensions({ roleMatch: 5, skillsAlignment: 2 });
    const { overallGrade } = computeComposite(dims);
    expect(['C', 'D', 'F']).toContain(overallGrade);
  });

  it('does NOT cap when both gate-pass scores are >= 3', () => {
    const dims = makeDimensions({ roleMatch: 5, skillsAlignment: 5 });
    const { overallGrade } = computeComposite(dims);
    expect(overallGrade).toBe('B'); // weighted mix of 4s and 5s and 3s
  });
});

describe('addGrades', () => {
  it('adds grade field to each dimension score', () => {
    const raw = { roleMatch: { score: 4, note: 'good' } } as any;
    const result = addGrades(raw);
    expect(result.roleMatch.grade).toBe('B');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run src/tests/compositeScoring.test.ts
```

Expected: FAIL — `Cannot find module '../services/compositeScoring'`

- [ ] **Step 3: Create `server/src/services/compositeScoring.ts`**

```typescript
export interface DimensionScore {
  score: number; // 1–5 integer
  grade: string; // A | B | C | D | F
  note: string;
}

export interface DimensionScores {
  roleMatch: DimensionScore;
  skillsAlignment: DimensionScore;
  seniorityFit: DimensionScore;
  compensation: DimensionScore;
  interviewLikelihood: DimensionScore;
  geographicFit: DimensionScore;
  companyStage: DimensionScore;
  marketFit: DimensionScore;
  growthTrajectory: DimensionScore;
  timelineAlignment: DimensionScore;
}

const WEIGHTS: Record<keyof DimensionScores, number> = {
  roleMatch:           0.15,
  skillsAlignment:     0.15,
  seniorityFit:        0.10,
  compensation:        0.10,
  interviewLikelihood: 0.10,
  geographicFit:       0.075,
  companyStage:        0.075,
  marketFit:           0.075,
  growthTrajectory:    0.075,
  timelineAlignment:   0.10,
};

export function scoreToGrade(score: number): string {
  if (score >= 4.5) return 'A';
  if (score >= 3.5) return 'B';
  if (score >= 2.5) return 'C';
  if (score >= 1.5) return 'D';
  return 'F';
}

/** Adds a `grade` field to each dimension score object returned by the LLM. */
export function addGrades(raw: Record<string, { score: number; note: string }>): DimensionScores {
  const result: any = {};
  for (const [key, val] of Object.entries(raw)) {
    result[key] = { score: val.score, grade: scoreToGrade(val.score), note: val.note };
  }
  return result as DimensionScores;
}

export function computeComposite(dimensions: DimensionScores): {
  composite: number;
  matchScore: number;
  overallGrade: string;
} {
  let composite = 0;
  for (const key of Object.keys(WEIGHTS) as Array<keyof DimensionScores>) {
    composite += dimensions[key].score * WEIGHTS[key];
  }
  composite = Math.round(composite * 100) / 100;

  let overallGrade = scoreToGrade(composite);

  // Gate-pass ceiling: if roleMatch or skillsAlignment <= 2 (D or F), cap overall at C
  const gatePassMin = Math.min(
    dimensions.roleMatch.score,
    dimensions.skillsAlignment.score,
  );
  if (gatePassMin <= 2 && (overallGrade === 'A' || overallGrade === 'B')) {
    overallGrade = 'C';
  }

  const matchScore = Math.round((composite / 5) * 100);
  return { composite, matchScore, overallGrade };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run src/tests/compositeScoring.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/compositeScoring.ts server/src/tests/compositeScoring.test.ts
git commit -m "feat(scoring): add composite scoring utility with gate-pass ceiling"
```

---

## Task 3: Identity Derivation Prompt

**Files:**
- Create: `server/src/services/prompts/identity.ts`

- [ ] **Step 1: Create the file**

```typescript
export interface IdentityCard {
  label: string;
  summary: string;
  keyStrengths: string[];
  tone: string;
  achievementThemes: string[];
}

export const IDENTITY_DERIVATION_PROMPT = (
  profile: {
    name: string | null;
    professionalSummary: string | null;
    targetRole: string | null;
    targetCity: string | null;
    seniority: string | null;
    industry: string | null;
    perceivedBlocker: string | null;
  },
  experiences: Array<{ company: string; role: string; startDate: string; endDate: string | null }>,
  achievements: Array<{ title: string; description: string; metric: string | null; skills: string | null }>,
  coverLetterSamples: string[]
): string => `
You are a career identity analyst. Based on a candidate's profile data, derive 2–3 professional identity cards that capture who this person authentically is as a professional — based on evidence, not aspiration.

An identity card is NOT a job title. It is a pattern: how this person consistently creates value, what types of problems they solve, and their natural professional language.

CANDIDATE PROFILE:
Name: ${profile.name || 'Unknown'}
Professional Summary: ${profile.professionalSummary || 'Not provided'}
Target Role: ${profile.targetRole || 'Not specified'}
Seniority: ${profile.seniority || 'Not specified'}
Industry: ${profile.industry || 'Not specified'}

WORK HISTORY:
${experiences.map(e => `- ${e.role} at ${e.company} (${e.startDate}–${e.endDate || 'present'})`).join('\n') || 'Not provided'}

ACHIEVEMENTS (sample):
${achievements.slice(0, 20).map(a => `- ${a.title}: ${a.description}${a.metric ? ` (${a.metric})` : ''}${a.skills ? ` [${a.skills}]` : ''}`).join('\n') || 'No achievements yet'}

${coverLetterSamples.length > 0 ? `COVER LETTER SAMPLES (tone analysis):
${coverLetterSamples.map((cl, i) => `--- Sample ${i + 1} ---\n${cl.slice(0, 800)}`).join('\n\n')}` : ''}

---
TASK:
Derive 2–3 identity cards based strictly on evidence from the data above.

Rules:
- Each card must be distinct — different facets of who this person is.
- If fewer than 5 achievements exist, return only 1 card and note limited evidence in the summary.
- Labels must be specific (NOT "Experienced Professional" or "Results-Driven Leader").
- Australian English spelling throughout.
- Do NOT invent patterns not evidenced by the data.

Return ONLY valid JSON. No preamble.

{
  "identityCards": [
    {
      "label": "3-6 word descriptive label",
      "summary": "2-3 sentences. Who they are, what they do, how they do it. Evidence-grounded.",
      "keyStrengths": ["strength1", "strength2", "strength3"],
      "tone": "How they naturally write and speak — e.g. 'direct, metric-heavy, systems-thinking'",
      "achievementThemes": ["theme1", "theme2", "theme3"]
    }
  ]
}
`;
```

- [ ] **Step 2: Export from prompts index**

Open `server/src/services/prompts/index.ts` and add:

```typescript
export * from './identity';
```

Final file contents:

```typescript
export * from './search-context';
export * from './extraction';
export * from './analysis';
export * from './strategy';
export * from './generation';
export * from './identity';
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/prompts/identity.ts server/src/services/prompts/index.ts
git commit -m "feat(prompts): add identity derivation prompt and IdentityCard type"
```

---

## Task 4: Identity Derivation Service

**Files:**
- Create: `server/src/services/identityDerivation.ts`

- [ ] **Step 1: Create the service**

```typescript
import { callLLM } from './llm';
import { IDENTITY_DERIVATION_PROMPT, IdentityCard } from './prompts/identity';
import { prisma } from '../index';
import { parseLLMJson } from '../utils/parseLLMResponse';

export async function deriveIdentityCards(userId: string): Promise<void> {
  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        experience: { orderBy: { createdAt: 'asc' } },
        achievements: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });

    if (!profile) {
      console.log(`[IdentityDerivation] No profile for userId: ${userId}`);
      return;
    }

    const achievementCount = await prisma.achievement.count({ where: { userId } });

    const coverLetterSamples: string[] = [];
    if (profile.coverLetterRawText) coverLetterSamples.push(profile.coverLetterRawText);
    if (profile.coverLetterRawText2) coverLetterSamples.push(profile.coverLetterRawText2);

    const prompt = IDENTITY_DERIVATION_PROMPT(
      {
        name: profile.name,
        professionalSummary: profile.professionalSummary,
        targetRole: profile.targetRole,
        targetCity: profile.targetCity,
        seniority: profile.seniority,
        industry: profile.industry,
        perceivedBlocker: profile.perceivedBlocker,
      },
      profile.experience.map(e => ({
        company: e.company,
        role: e.role,
        startDate: e.startDate,
        endDate: e.endDate,
      })),
      profile.achievements.map(a => ({
        title: a.title,
        description: a.description,
        metric: a.metric,
        skills: a.skills,
      })),
      coverLetterSamples
    );

    console.log(`[IdentityDerivation] Running Stage 3 for userId: ${userId}`);
    const raw = await callLLM(prompt, true);

    let parsed: { identityCards: IdentityCard[] };
    try {
      parsed = parseLLMJson(raw);
    } catch (e: any) {
      console.error('[IdentityDerivation] Failed to parse JSON:', e.message);
      return;
    }

    if (!Array.isArray(parsed.identityCards) || parsed.identityCards.length === 0) {
      console.error('[IdentityDerivation] No identity cards returned');
      return;
    }

    await prisma.candidateProfile.update({
      where: { userId },
      data: {
        identityCards: parsed.identityCards as any,
        identityCardsUpdatedAt: new Date(),
        achievementCountAtDerivation: achievementCount,
      },
    });

    console.log(`[IdentityDerivation] Saved ${parsed.identityCards.length} cards for userId: ${userId}`);
  } catch (err) {
    // Fire-and-forget — log but never throw
    console.error('[IdentityDerivation] Error:', err);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/identityDerivation.ts
git commit -m "feat(identity): add identity derivation service (Stage 3)"
```

---

## Task 5: Stage 3 in AutoExtract

**Files:**
- Modify: `server/src/services/autoExtract.ts`

- [ ] **Step 1: Add import at top of file**

Open `server/src/services/autoExtract.ts`. After the existing imports, add:

```typescript
import { deriveIdentityCards } from './identityDerivation';
```

- [ ] **Step 2: Add Stage 3 call after the transaction**

Find the line `console.log(`[AutoExtract] Completed for userId: ${userId}`);` near the bottom of the function (just before the closing `} catch (err) {`).

Replace it with:

```typescript
    // Stage 3 — Identity Derivation (fire-and-forget, does not block onboarding)
    deriveIdentityCards(userId).catch(err => {
      console.error('[AutoExtract] Stage 3 (identity derivation) failed:', err);
    });

    console.log(`[AutoExtract] Completed for userId: ${userId}`);
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/autoExtract.ts
git commit -m "feat(onboarding): trigger identity derivation (Stage 3) after achievement extraction"
```

---

## Task 6: Enhanced Analysis Prompt

**Files:**
- Modify: `server/src/services/prompts/analysis.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
export const JOB_ANALYSIS_PROMPT = (
  jd: string,
  profile: any,
  topAchievements: string,
  identityCards: Array<{ label: string; summary: string }>
): string => `
Act as an expert Australian recruitment consultant comparing a candidate to a Job Description (JD).

USER PROFILE:
${profile.professionalSummary}
Top Skills: ${profile.skills.technical.join(', ')}

CANDIDATE IDENTITY CARDS:
${identityCards.length > 0
  ? identityCards.map((c, i) => `${i + 1}. ${c.label}: ${c.summary}`).join('\n')
  : 'Not yet derived — assess without identity context.'}

TOP RELEVANT ACHIEVEMENTS (from bank):
${topAchievements}

JOB DESCRIPTION:
${jd}

---
TASK:
1. Extract the company name and job role title from the JD.
2. Extract 10-15 key skills/keywords from the JD.
3. Identify the "Tonal Profile" of the JD (e.g., "Corporate & Formal", "Fast-Paced Tech", "Direct & Service-Oriented", "Academic/Research").
4. Identify 3-5 "Core Competencies" the JD emphasises most (beyond keywords).
5. Rank the provided achievements by relevance to this JD.
6. Score each of the 10 dimensions (integer 1–5) and write a one-sentence note explaining the score. Be honest — do not inflate.
7. Identify which identity card label best matches this role, or null if none fit.
8. Detect Australian-specific signals from the JD.
9. Set requiresSelectionCriteria to true ONLY if the JD explicitly contains: "Selection Criteria", "Key Selection Criteria", "KSC", "Statement of Claims", or "Capability Statements".

---
DIMENSION SCORING GUIDE (score 1–5, integer only):
- roleMatch: Does this job function match what the candidate does?
- skillsAlignment: Do the hard skills in the JD match the candidate's proven skills?
- seniorityFit: Does the level match? Map APS1–6, EL1–2, SES bands if applicable.
- compensation: Does the expected AU salary/TRP align with this candidate's market value?
- interviewLikelihood: Probability of callback. Government SC roles: reduce slightly (longer pipeline).
- geographicFit: Does location/remote policy work? Key AU markets: Sydney, Melbourne, Brisbane, Perth, Adelaide, Canberra.
- companyStage: Does company type (startup/sme/enterprise/government/university/nfp) suit this candidate's background?
- marketFit: Is the company/sector growing or declining in the Australian market?
- growthTrajectory: Does this role offer genuine career progression?
- timelineAlignment: Does hiring urgency match candidate availability?

---
CONSTRAINTS:
- Return ONLY valid JSON. No preamble, no markdown fences.
- All dimension scores must be integers 1–5.
- Australian English spelling throughout.

OUTPUT SCHEMA:
{
  "matchScore": number,
  "keywords": string[],
  "analysisTone": string,
  "requiresSelectionCriteria": boolean,
  "coreCompetencies": string[],
  "extractedMetadata": {
    "company": string,
    "role": string
  },
  "rankedAchievements": [
    {
      "id": "achievementId",
      "relevanceScore": number,
      "reason": "1-sentence reason why this achievement proves fit for this JD"
    }
  ],
  "dimensions": {
    "roleMatch":           { "score": number, "note": string },
    "skillsAlignment":     { "score": number, "note": string },
    "seniorityFit":        { "score": number, "note": string },
    "compensation":        { "score": number, "note": string },
    "interviewLikelihood": { "score": number, "note": string },
    "geographicFit":       { "score": number, "note": string },
    "companyStage":        { "score": number, "note": string },
    "marketFit":           { "score": number, "note": string },
    "growthTrajectory":    { "score": number, "note": string },
    "timelineAlignment":   { "score": number, "note": string }
  },
  "matchedIdentityCard": string | null,
  "australianFlags": {
    "apsLevel": string | null,
    "requiresCitizenship": boolean,
    "securityClearanceRequired": "none" | "baseline" | "nv1" | "nv2" | "pv",
    "salaryType": "base" | "trp" | "unknown"
  }
}

You must respond with valid JSON only.
`;
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/prompts/analysis.ts
git commit -m "feat(prompts): expand analysis prompt with 10 dimensions and Australian flags"
```

---

## Task 7: Enhanced Analyze Route + Tests

**Files:**
- Modify: `server/src/routes/analyze.ts`
- Modify: `server/src/tests/analyze.test.ts`

- [ ] **Step 1: Write failing test for new response fields**

Open `server/src/tests/analyze.test.ts`. Find the existing mock for `callLLM`. There is already a section with mocked responses. Add this describe block after the existing tests:

```typescript
describe('POST /api/analyze/job — dimensional scoring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns dimensions, overallGrade, matchedIdentityCard, australianFlags', async () => {
    (prisma.candidateProfile.findUnique as any).mockResolvedValue({
      ...mockProfile,
      identityCards: [{ label: 'Platform Engineer', summary: 'Builds scalable systems.' }],
    });
    (prisma.jobApplication.create as any).mockResolvedValue({ id: 'job-1' });

    (callLLM as any).mockResolvedValue(JSON.stringify({
      matchScore: 80,
      keywords: ['TypeScript'],
      analysisTone: 'Tech',
      requiresSelectionCriteria: false,
      coreCompetencies: ['Engineering'],
      extractedMetadata: { company: 'Acme', role: 'Senior Engineer' },
      rankedAchievements: [],
      dimensions: {
        roleMatch:           { score: 5, note: 'Strong match' },
        skillsAlignment:     { score: 4, note: 'Good alignment' },
        seniorityFit:        { score: 4, note: 'Appropriate level' },
        compensation:        { score: 3, note: 'Market rate' },
        interviewLikelihood: { score: 4, note: 'Likely callback' },
        geographicFit:       { score: 5, note: 'Melbourne, hybrid' },
        companyStage:        { score: 4, note: 'Enterprise' },
        marketFit:           { score: 4, note: 'Growing sector' },
        growthTrajectory:    { score: 3, note: 'Lateral move' },
        timelineAlignment:   { score: 5, note: 'Immediate start available' },
      },
      matchedIdentityCard: 'Platform Engineer',
      australianFlags: {
        apsLevel: null,
        requiresCitizenship: false,
        securityClearanceRequired: 'none',
        salaryType: 'base',
      },
    }));

    const res = await request(app)
      .post('/api/analyze/job')
      .send({ jobDescription: VALID_JD });

    expect(res.status).toBe(200);
    expect(res.body.dimensions).toBeDefined();
    expect(res.body.dimensions.roleMatch.grade).toBe('A');
    expect(res.body.overallGrade).toBeDefined();
    expect(res.body.matchedIdentityCard).toBe('Platform Engineer');
    expect(res.body.australianFlags).toBeDefined();
    expect(res.body.australianFlags.securityClearanceRequired).toBe('none');
  });

  it('does not crash when dimensions are missing from LLM response', async () => {
    (prisma.candidateProfile.findUnique as any).mockResolvedValue({ ...mockProfile, identityCards: null });
    (prisma.jobApplication.create as any).mockResolvedValue({ id: 'job-2' });

    (callLLM as any).mockResolvedValue(JSON.stringify({
      matchScore: 60,
      keywords: [],
      analysisTone: 'Generic',
      requiresSelectionCriteria: false,
      coreCompetencies: [],
      extractedMetadata: { company: 'Co', role: 'Role' },
      rankedAchievements: [],
      // dimensions intentionally absent
    }));

    const res = await request(app)
      .post('/api/analyze/job')
      .send({ jobDescription: VALID_JD });

    expect(res.status).toBe(200);
    expect(res.body.matchScore).toBeDefined();
    // overallGrade absent is acceptable when dimensions missing
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run src/tests/analyze.test.ts
```

Expected: The new test cases FAIL because the route does not yet return `dimensions`.

- [ ] **Step 3: Modify `server/src/routes/analyze.ts`**

Add the import at the top of the file (after existing imports):

```typescript
import { addGrades, computeComposite } from '../services/compositeScoring';
import type { DimensionScores } from '../services/compositeScoring';
```

In the `/job` route handler, find this block where the profile is fetched:

```typescript
const profile = await prisma.candidateProfile.findUnique({
    where: { userId } as any,
    include: { achievements: true }
});
```

Replace it with:

```typescript
const profile = await prisma.candidateProfile.findUnique({
    where: { userId } as any,
    include: { achievements: true }
}) as any; // includes identityCards after migration
```

Find the block where `analysisPrompt` is called:

```typescript
const analysisPrompt = JOB_ANALYSIS_PROMPT(
    jobDescription,
    { ...profile, skills: parsedSkills },
    achievementsText
);
```

Replace it with:

```typescript
const identityCards: Array<{ label: string; summary: string }> =
    Array.isArray(profile.identityCards) ? profile.identityCards : [];

const analysisPrompt = JOB_ANALYSIS_PROMPT(
    jobDescription,
    { ...profile, skills: parsedSkills },
    achievementsText,
    identityCards
);
```

Find the block after `analysis` is parsed (just after `parseLLMJson`). After the `let finalRanked = []` block and before `const company = ...`, add:

```typescript
        // --- Dimensional scoring (server-side composite) ---
        let dimensions: DimensionScores | undefined;
        let overallGrade: string | undefined;
        let computedMatchScore: number = analysis.matchScore || 50;

        if (analysis.dimensions && typeof analysis.dimensions === 'object') {
            try {
                dimensions = addGrades(analysis.dimensions);
                const composite = computeComposite(dimensions);
                overallGrade = composite.overallGrade;
                computedMatchScore = composite.matchScore;
            } catch (err: any) {
                console.error('[Analyze] Composite scoring failed:', err.message);
            }
        }

        const australianFlags = analysis.australianFlags ?? {
            apsLevel: null,
            requiresCitizenship: false,
            securityClearanceRequired: 'none',
            salaryType: 'unknown',
        };
        const matchedIdentityCard: string | null = analysis.matchedIdentityCard ?? null;
```

Find the `prisma.jobApplication.create` call:

```typescript
jobApplication = await prisma.jobApplication.create({
    data: { userId, candidateProfileId: profile.id, title: role, company, description: jobDescription }
});
```

Replace it with:

```typescript
jobApplication = await prisma.jobApplication.create({
    data: {
        userId,
        candidateProfileId: profile.id,
        title: role,
        company,
        description: jobDescription,
        dimensions: dimensions as any ?? undefined,
        overallGrade: overallGrade ?? undefined,
        matchedIdentityCard: matchedIdentityCard ?? undefined,
        australianFlags: australianFlags as any,
    }
});
```

Find the final `res.json({...})` call. Replace `matchScore: analysis.matchScore || 50,` with `matchScore: computedMatchScore,` and add the new fields:

```typescript
        res.json({
            jobApplicationId: jobApplication?.id || 'temp-id',
            matchScore: computedMatchScore,
            overallGrade: overallGrade ?? null,
            dimensions: dimensions ?? null,
            matchedIdentityCard,
            australianFlags,
            keywords: analysis.keywords || [],
            analysisTone: analysis.analysisTone || 'Professional',
            requiresSelectionCriteria: !!analysis.requiresSelectionCriteria,
            coreCompetencies: analysis.coreCompetencies || [],
            extractedMetadata: { company, role },
            rankedAchievements: finalRanked,
            hasSufficientEvidence,
            evidenceWarning: hasSufficientEvidence
                ? null
                : "You have fewer than 3 'Strong' matched achievements. Consider adding more specific metrics to your profile for a better match."
        });
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run src/tests/analyze.test.ts
```

Expected: All tests PASS (including existing tests — no regressions).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/analyze.ts server/src/tests/analyze.test.ts
git commit -m "feat(analyze): add 10-dimension scoring, AU flags, identity card matching to /job route"
```

---

## Task 8: Identity Regenerate Route

**Files:**
- Create: `server/src/routes/profile/identity.ts`
- Modify: `server/src/routes/profile/index.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { deriveIdentityCards } from '../../services/identityDerivation';

const router = Router();

/**
 * POST /api/profile/regenerate-identity
 * Triggers a fresh identity derivation for the authenticated user.
 * Fire-and-forget — returns immediately.
 */
router.post('/profile/regenerate-identity', authenticate, async (req, res) => {
  const userId = (req as any).user.id;

  deriveIdentityCards(userId).catch(err => {
    console.error('[Identity Regenerate] Background error:', err);
  });

  return res.json({ status: 'started' });
});

export default router;
```

- [ ] **Step 2: Register in profile index**

Open `server/src/routes/profile/index.ts`. Add:

```typescript
import { Router } from 'express';
import profileCoreRouter from './profile-core';
import experienceRouter from './experience';
import educationRouter from './education';
import achievementsRouter from './achievements';
import jobsRouter from './jobs';
import identityRouter from './identity';

const router = Router();

router.use(profileCoreRouter);
router.use(experienceRouter);
router.use(educationRouter);
router.use(achievementsRouter);
router.use(jobsRouter);
router.use(identityRouter);

export default router;
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/profile/identity.ts server/src/routes/profile/index.ts
git commit -m "feat(api): add POST /api/profile/regenerate-identity endpoint"
```

---

## Task 9: Identity Card in Strategy Blueprint

**Files:**
- Modify: `server/src/services/strategy.ts`
- Modify: `server/src/services/prompts/strategy.ts`

- [ ] **Step 1: Update `STRATEGY_BLUEPRINT_PROMPT` to include identity card**

Open `server/src/services/prompts/strategy.ts`. Find the `candidateSnapshot` object inside `STRATEGY_BLUEPRINT_PROMPT`:

```typescript
    const candidateSnapshot = {
        name: profile.name,
        summary: profile.professionalSummary,
        topSkills: [
            ...(profile.skills?.technical?.slice(0, 8) ?? []),
            ...(profile.skills?.industryKnowledge?.slice(0, 4) ?? []),
        ],
    };
```

Replace it with:

```typescript
    const candidateSnapshot = {
        name: profile.name,
        summary: profile.professionalSummary,
        topSkills: [
            ...(profile.skills?.technical?.slice(0, 8) ?? []),
            ...(profile.skills?.industryKnowledge?.slice(0, 4) ?? []),
        ],
        identityCard: identityCard ?? null,
    };
```

Update the function signature to accept the optional parameter:

```typescript
export const STRATEGY_BLUEPRINT_PROMPT = (
    jd: string,
    profile: any,
    selectedAchievements: any[],
    docType: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE',
    identityCard?: { label: string; summary: string; tone: string; keyStrengths: string[] } | null
): string => {
```

In the template string, find `CANDIDATE SNAPSHOT:` and update the instruction:

```
CANDIDATE SNAPSHOT:
${JSON.stringify(candidateSnapshot, null, 2)}

${identityCard ? `IDENTITY CONTEXT: This candidate's primary professional identity for this role is "${identityCard.label}". Tone: ${identityCard.tone}. Let this shape your toneBlueprint and messagingAngles.` : ''}
```

- [ ] **Step 2: Update `generateBlueprint` in `strategy.ts`**

Open `server/src/services/strategy.ts`. Update the `generateBlueprint` signature:

```typescript
export async function generateBlueprint(
    jobApplicationId: string,
    jd: string,
    profile: any,
    selectedAchievements: any[],
    docType: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE',
    identityCard?: { label: string; summary: string; tone: string; keyStrengths: string[] } | null
): Promise<BlueprintResult> {
```

Update the `STRATEGY_BLUEPRINT_PROMPT` call:

```typescript
    const prompt = STRATEGY_BLUEPRINT_PROMPT(jd, profile, selectedAchievements, docType, identityCard);
```

- [ ] **Step 3: Update the generate route to pass identity card**

Open `server/src/routes/generate.ts`. Find where `generateBlueprint` is called. It receives `analysisContext` from `req.body`. The analysis now includes `matchedIdentityCard`. Find the profile fetch and add identity card lookup:

Find this block (approximately around line 77):
```typescript
        const profile = await prisma.candidateProfile.findUnique({
            where: { userId },
            include: {
                achievements: true,
```

After the profile fetch, extract the matched identity card:

```typescript
        // Resolve identity card for this application's matched identity
        const matchedCardLabel: string | null = analysisContext?.matchedIdentityCard ?? null;
        let resolvedIdentityCard: any = null;
        if (matchedCardLabel && Array.isArray((profile as any)?.identityCards)) {
            resolvedIdentityCard = (profile as any).identityCards.find(
                (c: any) => c.label === matchedCardLabel
            ) ?? null;
        }
```

Then pass `resolvedIdentityCard` to `generateBlueprint`. Find the `generateBlueprint` call and add the argument:

```typescript
        const { blueprint } = await generateBlueprint(
            jobApplicationId,
            jobDescription,
            { ...profile, skills: parsedSkills },
            selectedAchievements,
            docTypeEnum,
            resolvedIdentityCard
        );
```

- [ ] **Step 4: Commit**

```bash
git add server/src/services/prompts/strategy.ts server/src/services/strategy.ts server/src/routes/generate.ts
git commit -m "feat(strategy): inject matched identity card into Claude blueprint prompt"
```

---

## Task 10: DimensionsIsland Component

**Files:**
- Create: `src/components/DimensionsIsland.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Shield } from 'lucide-react';

export interface DimensionScore {
  score: number;
  grade: string;
  note: string;
}

export interface DimensionScores {
  roleMatch: DimensionScore;
  skillsAlignment: DimensionScore;
  seniorityFit: DimensionScore;
  compensation: DimensionScore;
  interviewLikelihood: DimensionScore;
  geographicFit: DimensionScore;
  companyStage: DimensionScore;
  marketFit: DimensionScore;
  growthTrajectory: DimensionScore;
  timelineAlignment: DimensionScore;
}

export interface AustralianFlags {
  apsLevel: string | null;
  requiresCitizenship: boolean;
  securityClearanceRequired: 'none' | 'baseline' | 'nv1' | 'nv2' | 'pv';
  salaryType: 'base' | 'trp' | 'unknown';
}

interface DimensionsIslandProps {
  dimensions: DimensionScores;
  overallGrade: string;
  matchScore: number;
  matchedIdentityCard: string | null;
  australianFlags: AustralianFlags;
}

const GRADE_COLOURS: Record<string, string> = {
  A: 'text-emerald-400',
  B: 'text-brand-400',
  C: 'text-amber-400',
  D: 'text-orange-400',
  F: 'text-red-400',
};

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  roleMatch: 'Role Match',
  skillsAlignment: 'Skills Alignment',
  seniorityFit: 'Seniority Fit',
  compensation: 'Compensation',
  interviewLikelihood: 'Interview Odds',
  geographicFit: 'Geographic Fit',
  companyStage: 'Company Stage',
  marketFit: 'Market Fit',
  growthTrajectory: 'Growth Path',
  timelineAlignment: 'Timeline',
};

const TIERS: Array<{ label: string; keys: Array<keyof DimensionScores> }> = [
  { label: 'GATE-PASS', keys: ['roleMatch', 'skillsAlignment'] },
  { label: 'HIGH WEIGHT', keys: ['seniorityFit', 'compensation', 'interviewLikelihood'] },
  { label: 'MEDIUM WEIGHT', keys: ['geographicFit', 'companyStage', 'marketFit', 'growthTrajectory'] },
  { label: 'LOW WEIGHT', keys: ['timelineAlignment'] },
];

function DimensionRow({ dimKey, dim }: { dimKey: keyof DimensionScores; dim: DimensionScore }) {
  const [hovered, setHovered] = useState(false);
  const filled = dim.score;
  const gradeColour = GRADE_COLOURS[dim.grade] ?? 'text-slate-400';

  return (
    <div
      className="relative flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors hover:bg-slate-800/40 cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="w-36 text-xs text-slate-400 shrink-0">{DIMENSION_LABELS[dimKey]}</span>
      <div className="flex gap-0.5 flex-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= filled ? 'bg-brand-500' : 'bg-slate-700'
            }`}
          />
        ))}
      </div>
      <span className={`text-xs font-black w-5 text-right ${gradeColour}`}>{dim.grade}</span>
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 bottom-full mb-2 z-10 w-64 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-300 shadow-xl pointer-events-none"
          >
            {dim.note}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const DimensionsIsland: React.FC<DimensionsIslandProps> = ({
  dimensions,
  overallGrade,
  matchScore,
  matchedIdentityCard,
  australianFlags,
}) => {
  const [expanded, setExpanded] = useState(false);
  const gradeColour = GRADE_COLOURS[overallGrade] ?? 'text-slate-400';

  const auChips: string[] = [];
  if (australianFlags.apsLevel) auChips.push(australianFlags.apsLevel);
  if (australianFlags.securityClearanceRequired !== 'none') {
    auChips.push(`${australianFlags.securityClearanceRequired.toUpperCase()} clearance`);
  }
  if (australianFlags.salaryType === 'trp') auChips.push('TRP package');
  if (australianFlags.requiresCitizenship) auChips.push('AU citizenship required');

  return (
    <div className="border border-slate-700/50 rounded-2xl bg-slate-900/60 backdrop-blur-sm overflow-hidden mb-4">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Fit Breakdown</span>
          {matchedIdentityCard && (
            <span className="text-xs text-slate-500">· {matchedIdentityCard}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-lg font-black ${gradeColour}`}>{overallGrade}</span>
          <span className="text-xs text-slate-500">{matchScore}/100</span>
          {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-3">
              {TIERS.map(tier => (
                <div key={tier.label}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1 px-2">
                    {tier.label}
                  </p>
                  {tier.keys.map(key => (
                    <DimensionRow key={key} dimKey={key} dim={dimensions[key]} />
                  ))}
                </div>
              ))}

              {auChips.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap px-2 pt-1 border-t border-slate-800">
                  <Shield size={11} className="text-slate-500 shrink-0" />
                  {auChips.map(chip => (
                    <span
                      key={chip}
                      className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DimensionsIsland.tsx
git commit -m "feat(ui): add DimensionsIsland component with hover notes and AU flag chips"
```

---

## Task 11: Update MatchEngine Types

**Files:**
- Modify: `src/components/MatchEngine.tsx`

- [ ] **Step 1: Extend `AnalysisResult` interface**

Open `src/components/MatchEngine.tsx`. Find the existing `AnalysisResult` interface:

```typescript
interface AnalysisResult {
    matchScore: number;
    keywords: string[];
    rankedAchievements: Array<{...}>;
    extractedMetadata?: { company: string; role: string; };
    evidenceWarning?: string;
    requiresSelectionCriteria?: boolean;
}
```

Replace it with:

```typescript
interface AnalysisResult {
    matchScore: number;
    overallGrade?: string;
    dimensions?: Record<string, { score: number; grade: string; note: string }>;
    matchedIdentityCard?: string | null;
    australianFlags?: {
        apsLevel: string | null;
        requiresCitizenship: boolean;
        securityClearanceRequired: 'none' | 'baseline' | 'nv1' | 'nv2' | 'pv';
        salaryType: 'base' | 'trp' | 'unknown';
    };
    keywords: string[];
    rankedAchievements: Array<{
        id: string;
        relevanceScore: number;
        reason: string;
        tier: 'STRONG' | 'MODERATE' | 'WEAK';
    }>;
    extractedMetadata?: { company: string; role: string; };
    evidenceWarning?: string;
    requiresSelectionCriteria?: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MatchEngine.tsx
git commit -m "feat(types): extend AnalysisResult with dimensional scoring fields"
```

---

## Task 12: Update ApplicationWorkspace

**Files:**
- Modify: `src/components/ApplicationWorkspace.tsx`

- [ ] **Step 1: Add new fields to `WorkspaceState`**

Open `src/components/ApplicationWorkspace.tsx`. Find the `WorkspaceState` interface. After `matchScore?: number;`, add:

```typescript
    overallGrade?: string;
    dimensions?: Record<string, { score: number; grade: string; note: string }> | null;
    matchedIdentityCard?: string | null;
    australianFlags?: {
        apsLevel: string | null;
        requiresCitizenship: boolean;
        securityClearanceRequired: 'none' | 'baseline' | 'nv1' | 'nv2' | 'pv';
        salaryType: 'base' | 'trp' | 'unknown';
    } | null;
```

- [ ] **Step 2: Initialise new fields from `currentAnalysis`**

Find the `useState` initialiser block (around line 163). After `matchScore: currentAnalysis.matchScore,`, add:

```typescript
            overallGrade: currentAnalysis.overallGrade ?? null,
            dimensions: currentAnalysis.dimensions ?? null,
            matchedIdentityCard: currentAnalysis.matchedIdentityCard ?? null,
            australianFlags: currentAnalysis.australianFlags ?? null,
```

- [ ] **Step 3: Import DimensionsIsland**

At the top of the file, after the existing component imports, add:

```typescript
import { DimensionsIsland } from './DimensionsIsland';
import type { DimensionScores, AustralianFlags } from './DimensionsIsland';
```

- [ ] **Step 4: Upgrade the score badge to show letter grade**

Find the score badge block (around line 652):

```typescript
                    {state.matchScore !== undefined && state.matchScore > 0 && (
                        <div className="flex items-center gap-1.5 ml-2">
                            <div className={`relative w-8 h-8 flex items-center justify-center rounded-full border-2 text-[9px] font-black ${
                                state.matchScore >= 70 ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                                : state.matchScore >= 50 ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                                : 'border-red-500 text-red-400 bg-red-500/10'
                            }`}>
                                {state.matchScore}
                            </div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">match</span>
                        </div>
                    )}
```

Replace it with:

```typescript
                    {state.matchScore !== undefined && state.matchScore > 0 && (
                        <div className="flex items-center gap-1.5 ml-2">
                            <div className={`relative w-8 h-8 flex items-center justify-center rounded-full border-2 text-[9px] font-black ${
                                state.matchScore >= 70 ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                                : state.matchScore >= 50 ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                                : 'border-red-500 text-red-400 bg-red-500/10'
                            }`}>
                                {state.matchScore}
                            </div>
                            {state.overallGrade && (
                                <span className="text-xs font-black text-slate-400">— {state.overallGrade}</span>
                            )}
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">match</span>
                        </div>
                    )}
```

- [ ] **Step 5: Add DimensionsIsland to workspace content**

Find the main workspace content area — search for the outer container that wraps the tab content. Find the section that renders above the tab panels (the area below the tab bar but above the generated document content).

Add the DimensionsIsland just below the tab bar `<div>`, before any tab content renders:

```typescript
                {/* Dimensions Island — shown when analysis has dimensional data */}
                {state.dimensions && state.overallGrade && (
                    <DimensionsIsland
                        dimensions={state.dimensions as unknown as DimensionScores}
                        overallGrade={state.overallGrade}
                        matchScore={state.matchScore ?? 0}
                        matchedIdentityCard={state.matchedIdentityCard ?? null}
                        australianFlags={(state.australianFlags as unknown as AustralianFlags) ?? {
                            apsLevel: null,
                            requiresCitizenship: false,
                            securityClearanceRequired: 'none',
                            salaryType: 'unknown',
                        }}
                    />
                )}
```

- [ ] **Step 6: Verify in browser**

Run the app and perform a job analysis. Confirm:
1. The score badge shows `87 — B` format
2. The DimensionsIsland appears below the tab bar (collapsed by default)
3. Clicking the island expands to show all 10 dimensions
4. Hovering a dimension row shows its note

- [ ] **Step 7: Commit**

```bash
git add src/components/ApplicationWorkspace.tsx
git commit -m "feat(workspace): add DimensionsIsland and letter grade to score badge"
```

---

## Task 13: ProfileBank Identity Cards

**Files:**
- Modify: `src/components/ProfileBank.tsx`

- [ ] **Step 1: Add identity cards section at top of ProfileBank**

Open `src/components/ProfileBank.tsx`. Find the `Profile` interface (around line ~50–100). Confirm `identityCards` is not yet there — add it:

```typescript
interface Profile {
  // ... existing fields ...
  identityCards?: Array<{
    label: string;
    summary: string;
    keyStrengths: string[];
    tone: string;
    achievementThemes: string[];
  }> | null;
  identityCardsUpdatedAt?: string | null;
}
```

Find where the profile data is used in the component. Add an identity cards section. Search for the first major section rendered (e.g., the experience section or the summary section). Insert the identity cards block BEFORE the first section:

```typescript
              {/* Identity Cards */}
              {Array.isArray(profile?.identityCards) && profile.identityCards.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Professional Identity
                    </h3>
                    <button
                      onClick={async () => {
                        try {
                          await api.post('/profile/regenerate-identity');
                          toast.success('Identity cards are being regenerated. Refresh in a moment.');
                        } catch {
                          toast.error('Regeneration failed — try again.');
                        }
                      }}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Regenerate
                    </button>
                  </div>
                  <div className="space-y-3">
                    {profile.identityCards.map((card, i) => (
                      <div
                        key={i}
                        className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4"
                      >
                        <p className="text-sm font-black text-slate-200 mb-1">{card.label}</p>
                        <p className="text-xs text-slate-400 mb-2 leading-relaxed">{card.summary}</p>
                        {card.keyStrengths.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {card.keyStrengths.map(s => (
                              <span
                                key={s}
                                className="text-[10px] font-bold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
```

Note: The `toast` import is already present in ProfileBank. Confirm `api` is imported at the top.

- [ ] **Step 2: Verify in browser**

After completing onboarding (or with a seeded user who has identity cards), navigate to Profile tab. Confirm:
1. Identity cards section appears at the top of the profile
2. Each card shows label, summary, and key strength chips
3. "Regenerate" button sends a POST request and shows a toast

- [ ] **Step 3: Commit**

```bash
git add src/components/ProfileBank.tsx
git commit -m "feat(profile): add identity cards display with regenerate button to ProfileBank"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| DB fields: identityCards, identityCardsUpdatedAt, achievementCountAtDerivation | Task 1 |
| DB fields: dimensions, overallGrade, matchedIdentityCard, australianFlags | Task 1 |
| Composite scoring utility with gate-pass ceiling | Task 2 |
| Identity Derivation prompt + IdentityCard type | Task 3 |
| Identity derivation service (Stage 3) | Task 4 |
| Stage 3 call in autoExtract | Task 5 |
| Enhanced analysis prompt (10 dims + AU flags) | Task 6 |
| Enhanced analyze route (composite, store fields) | Task 7 |
| POST /api/profile/regenerate-identity | Task 8 |
| Identity card in Claude strategy blueprint | Task 9 |
| DimensionsIsland component | Task 10 |
| MatchEngine type extension | Task 11 |
| Workspace score badge upgrade + DimensionsIsland | Task 12 |
| ProfileBank identity cards + regenerate | Task 13 |

All spec requirements covered. No TBDs or placeholders.

**Type consistency check:**
- `DimensionScore` / `DimensionScores` defined in `compositeScoring.ts` (server) and `DimensionsIsland.tsx` (client) — intentionally separate (server and client are independent TypeScript projects)
- `IdentityCard` exported from `prompts/identity.ts` and re-exported via `prompts/index.ts`
- `addGrades` returns `DimensionScores` — consumed in `analyze.ts` ✓
- `computeComposite` accepts `DimensionScores` — same type ✓
- `generateBlueprint` new optional parameter `identityCard` — optional so existing call sites without it don't break ✓
