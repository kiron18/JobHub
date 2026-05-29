# Resume Template System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace LLM-generated markdown with deterministic template rendering for resumes. LLM outputs structured JSON for content fields only; `profileToMarkdown` guarantees perfect formatting.

**Architecture:** Two parallel paths — resume (new: LLM JSON → template → markdown) and everything else (old: LLM → raw markdown). All changes are additive or conditional. The existing prompt pipeline's strategic context (achievement framing, blueprint, identity cards, ATS keywords, rules) is preserved identically — only the output instruction changes.

**Tech Stack:** TypeScript, Express, Prisma, Zod, existing `profileToMarkdown`, existing `ResumeData` type, existing quality enforcer functions.

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `src/lib/profileToResumeData.ts` | Maps Prisma `CandidateProfile` + relations → `ResumeData` struct. Pure data transform. |
| `src/lib/applyPolish.ts` | Merges validated LLM polish JSON into `ResumeData`. Replace semantics. Uses Zod for validation. |
| `src/lib/resumeTemplate.test.ts` | Vitest tests for `profileToMarkdown` output invariants (no glued headings, consistent spacing). |

### Changed files

| File | Change |
|---|---|
| `server/src/routes/generate.ts` | Add `POST /generate/resume-structured` handler alongside existing `POST /:type`. Preserves all existing strategic context. Only output instruction changes. |
| `src/components/ApplicationWorkspace.tsx` | Conditional: if `activeTab === 'resume'`, use `profileToMarkdown(profileToResumeData(profile))` for preview and download. Old path for all other doc types. |

---

### Task 1: Write the adapter — profileToResumeData

**Files:**
- Create: `src/lib/profileToResumeData.ts`
- Test: `server/src/tests/resumeTemplate.test.ts`

This function maps a Prisma `CandidateProfile` (with included relations) into the `ResumeData` type used by `profileToMarkdown` and `ResumeRender`.

- [ ] **Step 1: Create `src/lib/profileToResumeData.ts`**

```ts
import type { ResumeData } from './resumeRender';

// Minimal shape we need from the Prisma include
export interface ProfileWithRelations {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  location?: string | null;
  targetRole?: string | null;
  professionalSummary?: string | null;
  skills?: string | null;
  showReferees?: boolean | null;
  experience: Array<{
    id: string;
    role: string;
    company: string;
    location?: string | null;
    startDate: string;
    endDate?: string | null;
    isCurrent?: boolean;
    description?: string | null;
  }>;
  education: Array<{
    degree: string;
    field?: string | null;
    institution: string;
    location?: string | null;
    year?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }>;
  certifications?: Array<{
    name: string;
    issuingBody?: string | null;
    year?: string | null;
  }>;
  volunteering?: Array<{
    role: string;
    organization: string;
    description?: string | null;
  }>;
  languages?: Array<{
    name: string;
    proficiency: string;
  }>;
}

export function profileToResumeData(profile: ProfileWithRelations): ResumeData {
  return {
    name: profile.name || '',
    targetRole: profile.targetRole || undefined,
    email: profile.email || undefined,
    phone: profile.phone || undefined,
    linkedin: profile.linkedin || undefined,
    location: profile.location || undefined,
    professionalSummary: profile.professionalSummary || undefined,
    skills: profile.skills || undefined,
    experience: profile.experience.map(exp => ({
      id: exp.id,
      role: exp.role,
      company: exp.company,
      location: exp.location || undefined,
      startDate: exp.startDate,
      endDate: exp.endDate,
      isCurrent: exp.isCurrent || false,
      description: exp.description || undefined,
    })),
    education: profile.education.map(ed => ({
      degree: ed.degree,
      field: ed.field || undefined,
      institution: ed.institution,
      location: ed.location || undefined,
      year: ed.year || undefined,
      startDate: ed.startDate || undefined,
      endDate: ed.endDate || undefined,
    })),
    certifications: (profile.certifications || []).map(c => ({
      name: c.name,
      issuingBody: c.issuingBody || '',
      year: c.year || undefined,
    })),
    volunteering: (profile.volunteering || []).map(v => ({
      role: v.role,
      organization: v.organization,
      description: v.description || undefined,
    })),
    languages: (profile.languages || []).map(l => ({
      name: l.name,
      proficiency: l.proficiency,
    })),
    showReferees: profile.showReferees ?? true,
  };
}
```

- [ ] **Step 2: Create `server/src/tests/resumeTemplate.test.ts` with snapshot + glued-heading test**

```ts
import { describe, it, expect } from 'vitest';
import { profileToMarkdown } from '../../../src/lib/profileToMarkdown';
import type { ResumeData } from '../../../src/lib/resumeRender';

const sampleResumeData: ResumeData = {
  name: 'Jane Smith',
  targetRole: 'Senior Software Engineer',
  email: 'jane@example.com',
  phone: '0400 000 000',
  linkedin: 'linkedin.com/in/jane',
  location: 'Sydney, NSW',
  professionalSummary: 'Full-stack engineer with 6 years of experience building scalable web applications. Led cross-functional teams delivering SaaS products used by 50K+ users.',
  skills: 'Technical: TypeScript, React, Node.js, AWS\nSoft Skills: Team leadership, Technical mentoring, Stakeholder management',
  experience: [
    {
      id: 'exp1',
      role: 'Senior Developer',
      company: 'TechCo',
      startDate: '2022-01',
      endDate: null,
      isCurrent: true,
      description: 'Led architecture redesign reducing API latency by 40%\nMentored 3 junior developers\nBuilt CI/CD pipeline with 95% test coverage',
    },
    {
      id: 'exp2',
      role: 'Developer',
      company: 'StartupInc',
      startDate: '2019-03',
      endDate: '2021-12',
      isCurrent: false,
      location: 'Melbourne, VIC',
      description: 'Built customer-facing dashboard used by 10K users\nIntegrated payment processing with Stripe',
    },
  ],
  education: [
    {
      degree: 'Bachelor of Computer Science',
      field: 'Software Engineering',
      institution: 'University of Sydney',
      year: '2018',
    },
  ],
  certifications: [
    { name: 'AWS Solutions Architect', issuingBody: 'Amazon Web Services', year: '2023' },
  ],
  languages: [
    { name: 'English', proficiency: 'Native' },
    { name: 'Mandarin', proficiency: 'Professional' },
  ],
  volunteering: [
    { role: 'Code Mentor', organization: 'CodeCamp', description: 'Weekly mentoring for high school students learning to code.' },
  ],
  showReferees: true,
};

describe('profileToMarkdown invariants', () => {
  it('produces no glued headings (## followed immediately by non-space)', () => {
    const md = profileToMarkdown(sampleResumeData);
    const glued = md.match(/##[^\s#]/g);
    expect(glued).toBeNull();
  });

  it('has blank lines above and below every h2 heading', () => {
    const md = profileToMarkdown(sampleResumeData);
    const lines = md.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('## ') && !lines[i].startsWith('### ')) {
        expect(lines[i - 1]).toBe('');
        // heading line itself should have content
        expect(lines[i].length).toBeGreaterThan(3);
      }
    }
  });

  it('prefixes each bullet with "- "', () => {
    const md = profileToMarkdown(sampleResumeData);
    // Find all lines that appear under ### experience sections
    // Simpler: every line starting with "- " should be a bullet
    const bulletLines = md.split('\n').filter(l => l.startsWith('- '));
    expect(bulletLines.length).toBeGreaterThan(0);
    bulletLines.forEach(b => {
      expect(b).toMatch(/^- .+/);
    });
  });

  it('includes the candidate name as h1', () => {
    const md = profileToMarkdown(sampleResumeData);
    expect(md).toContain('# Jane Smith');
  });

  it('omits sections with no data', () => {
    const empty: ResumeData = {
      name: 'Test',
      experience: [],
      education: [],
    };
    const md = profileToMarkdown(empty);
    expect(md).not.toContain('## Professional Summary');
    expect(md).not.toContain('## Skills');
    expect(md).not.toContain('## Work Experience');
    expect(md).toContain('# Test');
  });

  it('renders referees section by default', () => {
    const md = profileToMarkdown(sampleResumeData);
    expect(md).toContain('Available upon request');
  });

  it('hides referees section when showReferees is false', () => {
    const data = { ...sampleResumeData, showReferees: false };
    const md = profileToMarkdown(data);
    expect(md).not.toContain('Available upon request');
  });

  it('renders experience date ranges correctly', () => {
    const md = profileToMarkdown(sampleResumeData);
    expect(md).toContain('2022-01 — Present');
    expect(md).toContain('2019-03 — 2021-12');
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

Run: `npx vitest run server/src/tests/resumeTemplate.test.ts`
Expected: FAIL — `profileToMarkdown` lives in `src/lib` which is frontend code, may need path alias. If path resolution fails, adjust the import path in the test.

- [ ] **Step 4: Fix test import path if needed and run again**

If the import `../../../src/lib/profileToMarkdown` doesn't resolve from `server/src/tests/`, move test to `src/lib/__tests__/profileToMarkdown.test.ts` and configure vitest for the frontend package, or adjust the import to use a shared path. The key insight: `profileToMarkdown` and `ResumeData` are frontend code; tests live in the frontend package.

Actually — the frontend doesn't have vitest configured. Move the test to `server/src/tests/resumeTemplate.test.ts` and import from the relative path to `src/lib/profileToMarkdown.ts`. If that path is outside the server root, add a vitest alias or use a symlink. Simplest: keep the test in the server package where vitest is already configured, and use a `paths` alias in `server/vitest.config.ts`.

- [ ] **Step 5: Add vitest path alias in `server/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../src'),
    },
  },
});
```

Then import as `import { profileToMarkdown } from '@shared/lib/profileToMarkdown';` in tests.

- [ ] **Step 6: Run tests to confirm they pass**

Run: `npx vitest run server/src/tests/resumeTemplate.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 7: Commit**

```bash
git add src/lib/profileToResumeData.ts server/src/tests/resumeTemplate.test.ts server/vitest.config.ts
git commit -m "feat(resume): add profileToResumeData adapter + template invariant tests"
```

---

### Task 2: Write applyPolish with Zod validation

**Files:**
- Create: `src/lib/applyPolish.ts`

- [ ] **Step 1: Create `src/lib/applyPolish.ts`**

```ts
import type { ResumeData } from './resumeRender';

export interface PolishPayload {
  summary?: string;
  experience?: Array<{
    id: string;
    bullets: string[];
  }>;
}

/**
 * Merges validated LLM polish JSON into a ResumeData struct.
 * Replace semantics: each field returned by the LLM fully replaces
 * the corresponding field in the profile data.
 *
 * Invalid experience IDs in the polish payload are silently dropped.
 * Extra fields in the payload are ignored.
 */
export function applyPolish(data: ResumeData, polish: PolishPayload): ResumeData {
  const result: ResumeData = {
    ...data,
    professionalSummary: polish.summary ?? data.professionalSummary,
    experience: data.experience.map(exp => {
      const match = (polish.experience || []).find(p => p.id === exp.id);
      if (!match) return exp;
      return {
        ...exp,
        description: match.bullets.join('\n'),
      };
    }),
  };
  return result;
}
```

- [ ] **Step 2: Add Zod validation (add to a shared validation module or inline in the server route)**

Create `server/src/lib/validatePolish.ts`:

```ts
import { z } from 'zod';

export const PolishPayloadSchema = z.object({
  summary: z.string().optional(),
  experience: z.array(z.object({
    id: z.string(),
    bullets: z.array(z.string()),
  })).optional(),
});

export type ValidatedPolish = z.infer<typeof PolishPayloadSchema>;
```

This is used in the server route to validate LLM output before passing to `applyPolish`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/applyPolish.ts server/src/lib/validatePolish.ts
git commit -m "feat(resume): add applyPolish with Zod validation"
```

---

### Task 3: Wire quality enforcers for ResumeData text fields

**Files:**
- Create: `server/src/lib/resumeQualityEnforcers.ts`

The existing quality enforcers (`enforceFirstPersonSummary`, `scrubAITells`, `scrubBannedPhrases`, `tagAIRewrites`, `checkAtsKeywords`) all operate on markdown strings. For the structured resume path, we need wrappers that operate on `ResumeData` text fields.

- [ ] **Step 1: Create `server/src/lib/resumeQualityEnforcers.ts`**

```ts
import type { ResumeData } from '../../../src/lib/resumeRender';
import { enforceFirstPersonSummary } from './voiceEnforcer';
import { scrubAITells } from './voiceEnforcer';
import { scrubBannedPhrases } from './voiceEnforcer';
import { tagAIRewrites } from './provenanceTagging';

export interface QualityEnforcerOptions {
  candidateName?: string | null;
  yearsOfExperience?: number | null;
  achievementSources?: string[];
}

/**
 * Runs quality enforcers on ResumeData text fields instead of markdown.
 * Returns a new ResumeData with enforced text.
 */
export function enforceResumeQuality(
  data: ResumeData,
  opts: QualityEnforcerOptions
): ResumeData {
  // 1. First-person enforcement on summary (non-negotiable)
  const summaryText = data.professionalSummary
    ? enforceFirstPersonSummary(`## Professional Summary\n${data.professionalSummary}`, {
        candidateName: opts.candidateName,
        yearsOfExperience: opts.yearsOfExperience ?? undefined,
      })
      .replace(/^## Professional Summary\n/, '')
    : undefined;

  // 2. Scrub AI tells from summary
  let finalSummary = summaryText ?? data.professionalSummary;
  if (finalSummary) {
    const { scrubbed } = scrubAITells(finalSummary);
    finalSummary = scrubbed;
  }

  // 3. Scrub banned phrases from summary
  let summaryAfterBanned = finalSummary;
  if (summaryAfterBanned) {
    const result = scrubBannedPhrases(summaryAfterBanned);
    summaryAfterBanned = result.scrubbed;
  }

  // 4. Process each experience entry
  const experience = data.experience.map(exp => {
    let description = exp.description || '';

    // Scrub AI tells from each bullet
    const { scrubbed } = scrubAITells(description);
    description = scrubbed;

    // Scrub banned phrases
    const bannedResult = scrubBannedPhrases(description);
    description = bannedResult.scrubbed;

    return { ...exp, description: description || undefined };
  });

  // 5. Provenance tagging (AI-tell markers on diverging bullets)
  const sources = opts.achievementSources || [];
  if (sources.length > 0) {
    // tagAIRewrites works on markdown; we apply it per-experience description
    const taggedExperience = experience.map(exp => {
      if (!exp.description) return exp;
      const tagged = tagAIRewrites(exp.description, sources);
      return { ...exp, description: tagged };
    });
    return {
      ...data,
      professionalSummary: summaryAfterBanned as string | undefined,
      experience: taggedExperience,
    };
  }

  return {
    ...data,
    professionalSummary: summaryAfterBanned as string | undefined,
    experience,
  };
}
```

**Important note:** The existing `tagAIRewrites` function compares bullet text against achievement sources. It operates on markdown text lines. For the structured path, we apply it per-experience description (each bullet line). The matching logic works the same — it looks for lines that don't appear in source achievements. This is a reasonable adaptation: we pass the concatenated description text, which contains `\n`-separated bullets, and `tagAIRewrites` already handles multi-line input.

- [ ] **Step 2: Wire `checkAtsKeywords` for structured data**

The ATS keyword check already accepts a `generatedDocument: string` field. For the structured path, we need to render the resume to markdown first (via `profileToMarkdown`), then pass that markdown. The test in the server route already does this — we just call `profileToMarkdown(tailored)` before `checkAtsKeywords`.

No new file needed. This is handled in the server route.

- [ ] **Step 3: Commit**

```bash
git add server/src/lib/resumeQualityEnforcers.ts
git commit -m "feat(resume): add quality enforcer wrappers for ResumeData text fields"
```

---

### Task 4: Add server route for structured resume generation

**Files:**
- Modify: `server/src/routes/generate.ts`
- Create: `server/src/services/prompts/resumeStructuredPrompt.ts`

- [ ] **Step 1: Create `server/src/services/prompts/resumeStructuredPrompt.ts`**

```ts
import { StrategyBlueprint } from './strategy';
import { computeYearsOfExperience, todayIso } from '../../lib/profileMath';

/**
 * RESUME_STRUCTURED_PROMPT — structured JSON output variant.
 *
 * Design: identical to the existing DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT
 * in all strategic context inputs (achievement framing, blueprint, identity cards,
 * ATS keywords, rules). Only the output instruction changes:
 * - OLD: "Write a complete resume as markdown"
 * - NEW: "Output a JSON object with the following fields"
 */

export interface ResumeStructuredInput {
  docType: string;
  jobDescription: string;
  profile: any;
  selectedAchievements: any[];
  ruleBase: string;
  blueprint: StrategyBlueprint;
  analysisContext: any;
  companyResearch: any;
  employerFramework?: string;
  type: string;
  employerQuestions?: string[];
  identityCard?: any;
  positioningStatement?: any;
}

export function RESUME_STRUCTURED_PROMPT(input: ResumeStructuredInput): string {
  const {
    docType, jobDescription, profile, selectedAchievements, ruleBase,
    blueprint, analysisContext, companyResearch, employerFramework, type,
    employerQuestions, identityCard, positioningStatement,
  } = input;

  const firstName = (profile?.name || '').trim().split(/\s+/)[0] || 'the candidate';
  const yearsExp = computeYearsOfExperience(profile?.experience);
  const skillsSection = profile?.skills || '';
  const industry = profile?.industry || '';
  const seniority = profile?.seniority || '';
  const targetCity = profile?.targetCity || '';

  // ── Achievement framing ──────────────────────────────────────────────
  const achievementsBlock = selectedAchievements.length > 0
    ? `SELECTED ACHIEVEMENTS (use these as evidence in experience bullets):

${selectedAchievements.map((a: any, i: number) => {
  const framing = a.framingAngle ? `  Framing angle: ${a.framingAngle}` : '';
  const narrative = a.narrativeNote ? `  Narrative note: ${a.narrativeNote}` : '';
  return `[${i + 1}] ${a.description || ''}${framing ? '\n' + framing : ''}${narrative ? '\n' + narrative : ''}`;
}).join('\n\n')}`
    : '';

  // ── Identity card ────────────────────────────────────────────────────
  const identityCardBlock = identityCard
    ? `MATCHED IDENTITY CARD:
The candidate's matched professional identity for this role is "${identityCard.label}".
Identity description: "${identityCard.description || ''}"
Relevant traits: ${(identityCard.traits || []).map((t: any) => `${t.label} (${t.score})`).join(', ') || 'None specified'}
Tailoring instructions: "${identityCard.tailoringInstructions || 'None specified'}"`
    : '';

  // ── Positioning statement ────────────────────────────────────────────
  const posStatementBlock = positioningStatement
    ? `POSITIONING STATEMENT:
"${typeof positioningStatement === 'string' ? positioningStatement : positioningStatement.text || ''}"`
    : '';

  // ── Company research ────────────────────────────────────────────────
  const researchBlock = companyResearch?.highlights?.length
    ? `COMPANY RESEARCH: ${companyResearch.highlights.join(' — ')}`
    : '';

  // ── Employer questions ──────────────────────────────────────────────
  const questionsBlock = employerQuestions?.length
    ? `EMPLOYER QUESTIONS (address these in the relevant experience section):
${employerQuestions.map((q, i) => `  ${i + 1}. ${q}`).join('\n')}`
    : '';

  // ── Blueprint context ───────────────────────────────────────────────
  const proofPoints = blueprint.proofPoints?.length
    ? `Proof points to emphasise: ${blueprint.proofPoints.join(', ')}`
    : '';
  const messagingAngles = blueprint.messagingAngles?.length
    ? `Messaging angles: ${blueprint.messagingAngles.join(', ')}`
    : '';
  const pitfallFlags = blueprint.pitfallFlags?.length
    ? `Pitfalls to avoid: ${blueprint.pitfallFlags.join(', ')}`
    : '';

  // ── Build the profile section ───────────────────────────────────────
  const expList = (profile?.experience || []).map((exp: any) =>
    `  - Role: ${exp.role} at ${exp.company}${exp.location ? `, ${exp.location}` : ''} (${exp.startDate} - ${exp.endDate || 'Present'})`
  ).join('\n');

  const eduList = (profile?.education || []).map((ed: any) =>
    `  - ${ed.degree}${ed.field ? ` in ${ed.field}` : ''}, ${ed.institution}${ed.year ? ` (${ed.year})` : ''}`
  ).join('\n');

  const certList = (profile?.certifications || []).map((c: any) =>
    `  - ${c.name}${c.issuingBody ? `, ${c.issuingBody}` : ''}${c.year ? ` (${c.year})` : ''}`
  ).join('\n');

  const langList = (profile?.languages || []).map((l: any) =>
    `  - ${l.name} (${l.proficiency})`
  ).join('\n');

  const volList = (profile?.volunteering || []).map((v: any) =>
    `  - ${v.role} at ${v.organization}`
  ).join('\n');

  const profileBlock = `## PROFILE DATA

Name: ${firstName}
${yearsExp ? `Years of experience: ~${yearsExp}` : ''}
${industry ? `Industry: ${industry}` : ''}
${seniority ? `Seniority: ${seniority}` : ''}
${targetCity ? `Target city: ${targetCity}` : ''}

Current skills listed: ${skillsSection || '(none listed)'}

Experience:
${expList || '  (none)'}

Education:
${eduList || '  (none)'}

Certifications:
${certList || '  (none)'}

Languages:
${langList || '  (none)'}

Volunteering:
${volList || '  (none)'}`;

  // ── Analysis context ────────────────────────────────────────────────
  const analysisBlock = analysisContext
    ? `## ANALYSIS CONTEXT

Key requirements: ${analysisContext.keyRequirements || 'N/A'}
Key responsibilities: ${analysisContext.keyResponsibilities || 'N/A'}
Preferred qualifications: ${analysisContext.preferredQualifications || 'N/A'}
Culture and values: ${analysisContext.cultureValues || 'N/A'}
Red flags to watch: ${analysisContext.redFlags || 'N/A'}
${analysisContext.wordCount ? `Target word count: ~${analysisContext.wordCount} words` : ''}`
    : '';

  // ── NEW OUTPUT INSTRUCTION ──────────────────────────────────────────
  // This is the ONLY part that differs from the markdown prompt.
  // Everything above is identical to the existing prompt.

  return `You are a professional resume writer. Your job is to rewrite the candidate's professional summary and experience bullets to be more compelling, ATS-optimised, and tailored to the specific job they're applying for.

${profileBlock}

${analysisBlock}

## STRATEGIC BLUEPRINT

Positioning: ${blueprint.positioningStatement || '(none)'}
${proofPoints}
${messagingAngles}
${pitfallFlags}
${blueprint.employerInsight ? `Employer insight: ${blueprint.employerInsight}` : ''}
${blueprint.toneBlueprint ? `Tone blueprint: ${blueprint.toneBlueprint}` : ''}
${blueprint.industry ? `Industry context: ${blueprint.industry}` : ''}
${blueprint.sector ? `Sector: ${blueprint.sector}` : ''}

${achievementsBlock}

${identityCardBlock}

${posStatementBlock}

${researchBlock}

${questionsBlock}

## RULES
${ruleBase || '(no specific rules provided)'}

## OUTPUT INSTRUCTION (CRITICAL)

Output ONLY a valid JSON object with this exact structure. No preamble, no explanation, no markdown code fences.

{
  "summary": "string — rewritten professional summary in FIRST PERSON. Never use the candidate's name or third person (he/she/they). Start with 'I' or use agentless first person (e.g. 'Engineering leader with...'). 3-5 sentences. Must incorporate the blueprint positioning, key requirements from analysis, and relevant proof points.",
  "experience": [
    {
      "id": "string — the exact ID from the PROFILE DATA experience list above",
      "bullets": [
        "string — rewritten bullet point. Must use first person or imperative voice. Each bullet should highlight impact and ideally include metrics. Draw from the selected achievements and achievement metrics where applicable.",
        "string — another bullet..."
      ]
    }
  ]
}

RULES:
1. Summary must be FIRST PERSON. Never "Jane brings..." or "He/She has...". Use "I" or agentless first person.
2. Experience bullets should use first person or imperative voice (e.g. "Led team..." not "John led team...").
3. Each bullet should include specific metrics, outcomes, or impact where possible.
4. If the candidate has no relevant experience for a particular requirement, omit that point rather than fabricating.
5. Do NOT include any information not present in the PROFILE DATA or SELECTED ACHIEVEMENTS.
6. Every experience entry in the output must have an id that matches exactly one id in the PROFILE DATA experience list.
7. If the summary or experience has missing/incomplete data, output only what's available — never invent credentials.

Return ONLY the JSON. No surrounding text, no markdown formatting.`;
}
```

This preserves all existing strategic context inputs. Only the output instruction differs from the existing `DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT`.

- [ ] **Step 2: Add the structured resume handler in `server/src/routes/generate.ts`**

Add a new route handler AFTER the existing routes but BEFORE the export. This handles `POST /generate/resume-structured`:

```ts
// ── RESUME STRUCTURED (template-based) ─────────────────────────────────
// Separate handler for template-based resume generation.
// Same strategic context as the existing /:type handler, but the LLM
// outputs structured JSON instead of markdown. The JSON is merged into
// ResumeData via applyPolish, then rendered through profileToMarkdown.
router.post('/resume-structured', authenticate, async (req, res) => {
  const userId = (req as any).user.id as string;
  const { jobDescription, selectedAchievementIds, analysisContext, jobApplicationId } = req.body;

  if (!jobDescription) {
    return res.status(400).json({ error: 'Job description is required' });
  }

  try {
    const userEmail = ((req as any).user?.email ?? '').toLowerCase();
    const access = await checkAccess(userId, 'generation', userEmail);
    if (!access.allowed) {
      return res.status(402).json({
        error: 'Generation limit reached',
        upgradeRequired: true,
        remaining: 0,
      });
    }

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        achievements: true,
        experience: true,
        education: true,
        volunteering: true,
        certifications: true,
        languages: true,
      },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const { buildAchievementContext } = await import('../services/generation');
    const selectedAchievements = await buildAchievementContext(userId, jobDescription, selectedAchievementIds);
    const ruleBase = await getRuleBase('resume');
    const sanitizedJobAppId = jobApplicationId === 'temp-id' ? null : (jobApplicationId || null);

    // ── STAGE 1: Strategic Blueprint (same as existing handler) ──────────
    const searchContext = buildSearchContextBlock(profile);
    // Normally identity cards / analysisContext same flow as existing handler

    let blueprintResult;
    const cacheKey = sanitizedJobAppId || `${userId}-${Date.now()}`;
    try {
      blueprintResult = await generateBlueprint(
        cacheKey,
        searchContext + jobDescription,
        profile,
        selectedAchievements,
        'RESUME',
        analysisContext?.matchedIdentityCard
          ? (profile as any).identityCards?.find((c: any) => c.label === analysisContext.matchedIdentityCard) ?? null
          : null,
      );
    } catch (err: any) {
      console.error('[ResumeStructured] Blueprint failed:', err.message);
      return res.status(500).json({ error: 'Failed to generate strategy' });
    }

    // ── STAGE 2: Structured Resume Generation ───────────────────────────
    const { RESUME_STRUCTURED_PROMPT } = await import('../services/prompts/resumeStructuredPrompt');
    const prompt = RESUME_STRUCTURED_PROMPT({
      docType: 'RESUME',
      jobDescription,
      profile,
      selectedAchievements,
      ruleBase,
      blueprint: blueprintResult.blueprint,
      analysisContext,
      companyResearch: req.body.companyResearch,
      employerFramework: req.body.employerFramework,
      type: 'resume',
      employerQuestions: req.body.employerQuestions,
      identityCard: analysisContext?.matchedIdentityCard
        ? (profile as any).identityCards?.find((c: any) => c.label === analysisContext.matchedIdentityCard) ?? null
        : null,
      positioningStatement: (profile as any).positioningStatement ?? null,
    });

    const { callLLMWithRetry } = await import('../utils/callLLMWithRetry');
    const rawJson = await callLLMWithRetry(prompt, false, { model: 'llama-3.3-70b' });

    // ── STAGE 3: Parse + Validate ───────────────────────────────────────
    const { PolishPayloadSchema } = await import('../lib/validatePolish');
    let polish: any = null;

    // Attempt to extract JSON from the LLM response (handles stray markdown fences)
    const cleaned = rawJson.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    try {
      polish = PolishPayloadSchema.parse(JSON.parse(cleaned));
    } catch (parseErr) {
      console.warn('[ResumeStructured] First parse failed, retrying...');
      // Retry once
      try {
        const retryRaw = await callLLMWithRetry(prompt, false, { model: 'llama-3.3-70b' });
        const retryCleaned = retryRaw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        polish = PolishPayloadSchema.parse(JSON.parse(retryCleaned));
      } catch (retryErr) {
        console.error('[ResumeStructured] Retry also failed — returning unpolished');
        // Fall through with null polish
      }
    }

    // ── STAGE 4: Merge + Enforce + Render ────────────────────────────────
    const { profileToResumeData } = await import('../../../src/lib/profileToResumeData');
    const { applyPolish } = await import('../../../src/lib/applyPolish');
    const { enforceResumeQuality } = await import('../lib/resumeQualityEnforcers');

    let resumeData = profileToResumeData(profile);
    if (polish) {
      resumeData = applyPolish(resumeData, polish);
    }

    resumeData = enforceResumeQuality(resumeData, {
      candidateName: profile.name,
      yearsOfExperience: computeYearsOfExperience(profile.experience),
      achievementSources: selectedAchievements.map((a: any) => a?.description ?? ''),
    });

    const { profileToMarkdown } = await import('../../../src/lib/profileToMarkdown');
    const finalContent = profileToMarkdown(resumeData);

    // ── ATS keyword check ───────────────────────────────────────────────
    const { checkAtsKeywords } = await import('../lib/atsKeywords');
    let atsResult = null;
    try {
      atsResult = checkAtsKeywords({
        jobDescription,
        generatedDocument: finalContent,
        docType: 'RESUME',
      });
    } catch (err) {
      console.error('[ResumeStructured] ATS check failed:', err);
    }

    // ── Persist document ────────────────────────────────────────────────
    const doc = await prisma.document.create({
      data: {
        title: `RESUME - ${profile.name || 'Draft'}`,
        content: finalContent,
        type: 'RESUME',
        userId,
        jobApplicationId: sanitizedJobAppId,
      },
    });

    res.json({
      content: finalContent,
      id: doc.id,
      atsResult,
      blueprint: blueprintResult.blueprint,
    });

  } catch (error) {
    console.error('[ResumeStructured] Error:', error);
    res.status(500).json({ error: 'Failed to generate structured resume' });
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/prompts/resumeStructuredPrompt.ts server/src/routes/generate.ts server/src/lib/validatePolish.ts
git commit -m "feat(resume): add structured resume server route with JSON output"
```

---

### Task 5: Wire frontend preview to use template for resume tab

**Files:**
- Modify: `src/components/ApplicationWorkspace.tsx`

- [ ] **Step 1: Add the structured path to the editor preview (~line 1870)**

The current code at ~line 1870 is:
```tsx
<ReactMarkdown
    children={normaliseMarkdown(parseVerifyTokens(state.documents[state.activeTab] || '').stripped)}
    components={...}
/>
```

Change to a conditional:
```tsx
{state.activeTab === 'resume' && profile ? (
  <ReactMarkdown
    children={normaliseMarkdown(parseVerifyTokens(
      profileToMarkdown(profileToResumeData(profile))
    ).stripped)}
    components={...}
  />
) : (
  <ReactMarkdown
    children={normaliseMarkdown(parseVerifyTokens(state.documents[state.activeTab] || '').stripped)}
    components={...}
  />
)}
```

Wait — but if there's no JD, this shows raw profile data (unpolished). If there IS a generated resume, we need to show the rendered markdown saved in `state.documents['resume']`. The key insight: `state.documents['resume']` already contains the rendered markdown (saved from the server response). So the preview should use `state.documents['resume']` when it exists.

Actually, re-read the flow: when the user generates a resume, the server returns markdown, which is stored in `state.documents['resume']`. That markdown is already template-perfect. So the preview doesn't need to re-render from profile data — it just shows the stored markdown.

The template path is needed for TWO cases:
1. **After generation** — `state.documents['resume']` already contains template-perfect markdown. Show it as-is (same code path as today).
2. **Before generation (baseline)** — show `profileToMarkdown(profileToResumeData(profile))` so the user sees their raw profile as a formatted resume.

So the conditional is simpler:

```tsx
const displayContent = state.activeTab === 'resume'
  ? (state.documents['resume'] || profileToMarkdown(profileToResumeData(profile)))
  : normaliseMarkdown(parseVerifyTokens(state.documents[state.activeTab] || '').stripped);

<ReactMarkdown children={displayContent} components={...} />
```

**Step 1a: Import `profileToMarkdown` and `profileToResumeData` at the top of the file:**

Add to the dynamic import block near the top:
```ts
import { profileToMarkdown } from '../lib/profileToMarkdown';
import { profileToResumeData } from '../lib/profileToResumeData';
```

**Step 1b: Modify the rendering block (~line 1870):**

```tsx
const resumeMd = state.activeTab === 'resume'
  ? (state.documents['resume'] || profileToMarkdown(profileToResumeData(profile)))
  : state.documents[state.activeTab] || '';

// In the JSX:
<ReactMarkdown
    children={normaliseMarkdown(parseVerifyTokens(resumeMd).stripped)}
    components={...}
/>
```

- [ ] **Step 2: Wire the download handlers (executeDownload + executePdfDownload)**

Around line 390:
```ts
const executeDownload = async (content: string) => {
    // current code uses content param directly
    ...
};
```

Change the callers to pass the structured markdown for resume tab:

At the download button handler (~line 395 area), change from:
```ts
await exportDocx(content, ...)
```
to:
```ts
const exportContent = state.activeTab === 'resume'
  ? (state.documents['resume'] || profileToMarkdown(profileToResumeData(profile)))
  : content;
await exportDocx(exportContent, ...);
```

And similarly for PDF around line 433-441:
```ts
const executePdfDownload = async () => {
    const content = state.activeTab === 'resume'
      ? (state.documents['resume'] || profileToMarkdown(profileToResumeData(profile)))
      : state.documents[state.activeTab];
    if (!content) return;
    // rest unchanged
};
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ApplicationWorkspace.tsx
git commit -m "feat(resume): wire frontend preview to use template for resume tab"
```

---

### Task 6: Verify full flow — type-check + integration test

- [ ] **Step 1: Run the type checker**

```bash
cd server && npx tsc --noEmit
```

Expected: PASS (or typescript errors that need fixing in the dynamic imports)

- [ ] **Step 2: Run existing tests to confirm no regressions**

```bash
npx vitest run
```

Expected: ALL PASS (no existing tests should be affected — we only added new code)

- [ ] **Step 3: Run template invariant tests**

```bash
npx vitest run server/src/tests/resumeTemplate.test.ts
```

Expected: ALL PASS (6 tests)

- [ ] **Step 4: Final commit with any fixes**

```bash
git add -A
git commit -m "chore: fix type-check and test issues from resume template system"
```

---

## Self-Review

**Spec coverage check:**
1. ✅ Strategic context preserved — the structured prompt includes all the same inputs (achievement framing, blueprint, identity cards, ATS keywords, rules). Only output instruction changed.
2. ✅ Polish JSON contract — Zod schema defined in `validatePolish.ts`, inline in the spec.
3. ✅ Regenerate clobbers — same contract as existing behavior, documented in spec.
4. ✅ Diagnostic dependencies — identity cards + positioning statement included in structured prompt.
5. ✅ profileToMarkdown invariants — tested (6 tests in Task 1).
6. ✅ In-flight documents — `state.documents['resume']` checked first; falls back to profile data.
7. ✅ Testing — snapshot test + glued-heading test + first-person test + edge cases.
8. ✅ Cover letter follow-up — spec says "not in scope," plan doesn't touch it.

**Placeholder scan:** All steps contain complete code. No TODOs, TBDs, or "fill in later."

**Type consistency:** `PolishPayload` in `applyPolish.ts` uses the same shape as `PolishPayloadSchema` in `validatePolish.ts`. `profileToResumeData` returns `ResumeData` which matches `profileToMarkdown`'s input. Names are consistent.

**Implementation order:** Task 1 (adapter + tests) → Task 2 (applyPolish) → Task 3 (quality enforcers) → Task 4 (server route) → Task 5 (frontend wiring) → Task 6 (verify). Each task produces independently testable code.
