# Sub-project 1: 10-Dimension Scoring + Identity Card Archetypes
*Design spec — April 7 2026*

---

## Overview

Replaces the single 0–100 match score with a structured 10-dimension scoring model and letter grades (A–F). Adds a Stage 3 to the onboarding pipeline that derives 2–3 personalised "Identity Cards" from the user's profile data. Identity Cards replace hardcoded archetypes and drive document generation framing. Australian-market signals (APS level, security clearance, TRP vs base salary) are detected and surfaced inline.

**This is Sub-project 1 of 4.** Sub-projects 2 (multi-offer comparison), 3 (batch pipeline + deduplication), and 4 (full SC generation) depend on this being complete first.

---

## Scoring Model

### 10 Dimensions

| Tier | Dimension Key | What it measures | Australian context |
|---|---|---|---|
| Gate-pass | `roleMatch` | Is this the right job function for this candidate? | Covers APS vs private sector role type |
| Gate-pass | `skillsAlignment` | Do hard skills match stated requirements? | — |
| High | `seniorityFit` | Does role level match candidate experience? | Maps APS1–6, EL1–2, SES bands AND private sector levels |
| High | `compensation` | Does expected range work for this candidate? | TRP (base + 11.5% super) vs base-only framing; government vs private sector norms |
| High | `interviewLikelihood` | How likely is a callback given match quality? | Government roles with SC requirements scored differently — longer pipeline |
| Medium | `geographicFit` | Location, remote/hybrid policy, commute viability | Key markets: Sydney, Melbourne, Brisbane, Perth, Adelaide, Canberra (APS-heavy) |
| Medium | `companyStage` | Does company type match candidate's context? | Types: `startup` `sme` `enterprise` `government` `university` `nfp` |
| Medium | `marketFit` | Is the company in a growth sector or decline? | Australian sectors: fintech, govtech, resources, healthtech, edtech |
| Medium | `growthTrajectory` | Does this role have upward path? | — |
| Low | `timelineAlignment` | Urgency of hire vs candidate availability | — |

### Scoring Rules

- Each dimension scores **1–5** (integer), converted to letter grade: 5=A, 4=B, 3=C, 2=D, 1=F
- **Gate-pass dimensions act as a ceiling:** if either `roleMatch` or `skillsAlignment` scores ≤ 2 (D or F), overall grade cannot exceed C regardless of other dimensions
- **Weighted composite** for overall score:
  - Gate-pass: 15% each (30% total)
  - High weight: 10% each (30% total)
  - Medium weight: 7.5% each (30% total)
  - Low weight: 10% total
- `matchScore` (0–100) is derived from the weighted composite: `round((weightedComposite / 5) × 100)`. A composite of 4.35/5 → matchScore 87. Kept for backwards compatibility — no breaking change to existing API consumers.

### Letter Grade Mapping

| Score | Grade |
|---|---|
| 5 | A |
| 4 | B |
| 3 | C |
| 2 | D |
| 1 | F |

---

## Australian Flags

Detected from JD text and returned as `australianFlags` on the analysis response. Surfaced inline in the report — not in a separate section.

| Flag | Values | Effect |
|---|---|---|
| `apsLevel` | `APS1`–`APS6`, `EL1`, `EL2`, `SES1`–`SES3`, `null` | Informs seniority scoring; passed to SC generation |
| `requiresCitizenship` | `boolean` | If true and candidate profile doesn't indicate AU citizenship, caps `interviewLikelihood` to max 3 |
| `securityClearanceRequired` | `none` \| `baseline` \| `nv1` \| `nv2` \| `pv` | Surfaced as inline warning in report |
| `salaryType` | `base` \| `trp` \| `unknown` | Drives compensation scoring; TRP notation shown inline |
| `requiresSelectionCriteria` | `boolean` | Existing flag — no change |

---

## Identity Card Archetypes

### Concept

Identity Cards are derived from the user's own data — not selected from a fixed list. They describe *who the user professionally is* based on patterns across their onboarding answers, experience, achievement themes, and cover letter language.

- 2–3 cards per user, stored as JSON on `CandidateProfile.identityCards`
- Generated in **Stage 3** of the onboarding pipeline, after existing Stage 1 and Stage 2
- Regenerated automatically when achievement count grows by ≥ 15 since last derivation
- User can manually trigger regeneration from the Profile tab

### Stage 3: Identity Derivation

**Trigger:** Runs fire-and-forget after Stage 2 completes in `autoExtract.ts`. Failures logged, not surfaced to user.

**Input:**
- All extracted achievements (full text, metrics, skills, tags)
- Experience entries (roles, companies, tenure patterns)
- Onboarding answers (career goals, work style, strengths responses)
- Cover letter samples if provided during onboarding

**Output:** 2–3 identity cards, each containing:
```json
{
  "label": "Technical Platform Lead",
  "summary": "Builds systems that scale teams. Consistent evidence of reliability improvements and operational cost reduction. Language: direct, metric-heavy, systems-thinking.",
  "keyStrengths": ["infrastructure architecture", "cross-functional alignment", "cost reduction"],
  "tone": "direct, evidence-first, technical depth",
  "achievementThemes": ["platform reliability", "team enablement", "cost optimisation"]
}
```

### How Identity Cards Are Used

1. **During analysis:** The LLM identifies which identity card best maps to the JD's requirements. Returns `matchedIdentityCard` (the label string).
2. **During generation:** The matched identity card is injected into Claude's Stage 1 strategic blueprint prompt, replacing the generic archetype. This shapes framing, achievement selection priority, and cover letter persona.
3. **In the report:** The matched card label appears at the bottom of the Dimensions Island — "Identity match: Technical Platform Lead".

---

## API Changes

### `POST /api/analyze/job` — enhanced response

No breaking changes. New fields added alongside existing fields.

```typescript
// New fields added to existing response
dimensions: {
  roleMatch:           { score: number; grade: string; note: string };
  skillsAlignment:     { score: number; grade: string; note: string };
  seniorityFit:        { score: number; grade: string; note: string };
  compensation:        { score: number; grade: string; note: string };
  interviewLikelihood: { score: number; grade: string; note: string };
  geographicFit:       { score: number; grade: string; note: string };
  companyStage:        { score: number; grade: string; note: string };
  marketFit:           { score: number; grade: string; note: string };
  growthTrajectory:    { score: number; grade: string; note: string };
  timelineAlignment:   { score: number; grade: string; note: string };
};
overallGrade: string;           // "A" | "B" | "C" | "D" | "F"
matchedIdentityCard: string | null;
australianFlags: {
  apsLevel: string | null;
  requiresCitizenship: boolean;
  securityClearanceRequired: "none" | "baseline" | "nv1" | "nv2" | "pv";
  salaryType: "base" | "trp" | "unknown";
  requiresSelectionCriteria: boolean;
};
```

### New endpoint: `POST /api/profile/regenerate-identity`

Authenticated. Triggers Stage 3 re-derivation for the current user. Returns `{ status: "started" }` immediately (fire-and-forget).

---

## Database Changes

Two migrations required — both additive (no existing columns touched):

```prisma
model CandidateProfile {
  // ... existing fields ...
  identityCards          Json?    // Array of IdentityCard objects
  identityCardsUpdatedAt DateTime?
  achievementCountAtDerivation Int? // tracks when to auto-regenerate
}

model JobApplication {
  // ... existing fields ...
  dimensions      Json?    // DimensionScores object
  overallGrade    String?  // "A" | "B" | "C" | "D" | "F"
  matchedIdentityCard String?
  australianFlags Json?
}
```

---

## UI Changes

### Dashboard job card

Upgrade score badge from `87` → `87 — B`. No layout change. Letter grade derived from `overallGrade` field on the job application record.

### `ReportExperience` — Dimensions Island

New full-width island, inserted between the existing header and current report sections.

**Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│  YOUR FIT BREAKDOWN                    Overall: B  87/100   │
│                                                              │
│  GATE-PASS                                                   │
│  Role Match        ████████████████████  A  5.0             │
│  Skills Alignment  ████████████████░░░░  B  4.0             │
│                                                              │
│  HIGH WEIGHT                                                 │
│  Seniority Fit     ████████████████░░░░  B  4.0             │
│  Compensation      ████████████░░░░░░░░  C  3.0  ⚠ TRP      │
│  Interview Odds    ████████████████░░░░  B  4.0             │
│                                                              │
│  MEDIUM WEIGHT                                               │
│  Geographic Fit    ████████████████████  A  5.0             │
│  Company Stage     ████████████████░░░░  B  4.0             │
│  Market Fit        ████████████░░░░░░░░  C  3.0             │
│  Growth Path       ████████████████░░░░  B  4.0             │
│                                                              │
│  LOW WEIGHT                                                  │
│  Timeline          ████████████████████  A  5.0             │
│                                                              │
│  Identity match: Technical Platform Lead                     │
│  🇦🇺 EL1 · Baseline clearance required · TRP package        │
└─────────────────────────────────────────────────────────────┘
```

Each row: dimension label, filled progress bar (out of 5), letter grade, score. Australian flags surface as inline chips at the bottom. Note text per dimension available on hover/tap.

### Profile tab — Identity Cards section

Small card block at top of Profile tab. Shows 2–3 identity cards with label, summary, and key strengths. "Regenerate" button triggers `POST /api/profile/regenerate-identity`. Disabled while regeneration is in progress (poll via existing profile query).

---

## Prompt Changes

### `prompts/analysis.ts` — `JOB_ANALYSIS_PROMPT`

The output schema is expanded to include the `dimensions` object, `overallGrade`, `matchedIdentityCard`, and `australianFlags`. The LLM is instructed to:
- Score each dimension 1–5 with a one-sentence `note` explaining the score
- Detect Australian-specific signals from JD text
- Match against the candidate's identity cards (passed as context)
- Australian seniority mapping guide included in the system instructions

The LLM does NOT compute the weighted composite or overall grade — the server computes these from the raw dimension scores to ensure consistency.

### New: `prompts/identity.ts` — `IDENTITY_DERIVATION_PROMPT`

New file. Takes full profile data and returns 2–3 identity card objects as JSON.

### `prompts/generation.ts` — updated blueprint context

The `matchedIdentityCard` object (full card, not just label) is injected into Stage 1 (Claude strategic blueprint). Replaces the generic archetype placeholder that existed conceptually but wasn't implemented.

---

## Implementation Order

1. DB migration — add new fields
2. `prompts/identity.ts` — write Identity Derivation prompt
3. `autoExtract.ts` — add Stage 3 call after Stage 2
4. `prompts/analysis.ts` — expand output schema + Australian instructions
5. `routes/analyze.ts` — compute weighted composite server-side, store dimensions on JobApplication
6. `routes/profile/index.ts` — add `POST /regenerate-identity` endpoint
7. `ReportExperience` — add Dimensions Island component
8. Dashboard job card — upgrade score badge with letter grade
9. Profile tab — add Identity Cards display + regenerate button
10. `prompts/generation.ts` — inject matched identity card into blueprint

---

## Out of Scope (this sub-project)

- Multi-offer comparison (Sub-project 2)
- Batch URL pipeline (Sub-project 3)
- Full SC generation (Sub-project 4)
- Mobile responsiveness pass
- Exporting dimensional scores to PDF
