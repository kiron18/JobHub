// =============================================================================
// HYBRID ARCHITECTURE — STAGE 1 (Claude Sonnet strategist)
// =============================================================================

/**
 * StrategyBlueprint is the structured JSON contract between Claude (strategist)
 * and Llama (executor). Every field has a specific downstream use:
 *
 *   openingHook          → Llama writes the opening sentence verbatim from this
 *   positioningStatement → Shapes the professional summary / pitch opening
 *   proofPoints          → Drives framing angle + narrative expansion per achievement
 *   messagingAngles      → Sets the recurring themes threaded across the document
 *   toneBlueprint        → Overrides generic "professional" defaults
 *   structureNotes       → Doc-type-specific layout advice
 *   pitfallFlags         → Inline red-line list Llama checks before output
 *   employerInsight      → Company connection paragraph material (or MISSING flag)
 *   sector               → Gates industry-specific formatting exceptions in Llama
 */
export interface StrategyBlueprint {
    openingHook: string;
    positioningStatement: string;
    proofPoints: Array<{
        achievementId: string;
        framingAngle: string;
        jdConnection: string;
        narrativeNote: string;
    }>;
    messagingAngles: string[];
    toneBlueprint: string;
    structureNotes: string;
    pitfallFlags: string[];
    employerInsight: string;
    sector: 'GOVERNMENT' | 'TECH_STARTUP' | 'CORPORATE' | 'HEALTHCARE' | 'EDUCATION' | 'NFP' | 'GENERAL';
}

/**
 * STRATEGY_BLUEPRINT_PROMPT — for Claude Sonnet (strategist role).
 *
 * Claude's ONLY job here is to produce a JSON blueprint.
 * It must NOT write any document prose. Token budget is kept lean by
 * sending only name, summary, top skills, and achievements with IDs +
 * metrics — no full experience/education blocks.
 *
 * Design rationale:
 * - JD signal extraction is explicit and enumerated so Claude cannot skim
 * - openingHook is constrained to one sentence with a non-transferability test
 * - pitfallFlags are pre-seeded with concrete Llama defaults to defeat; Claude
 *   adds role-specific ones on top
 * - employerInsight uses a hard MISSING flag rather than a hallucinated value
 * - sector classification gates formatting decisions downstream without
 *   requiring Llama to re-infer context
 */
export const STRATEGY_BLUEPRINT_PROMPT = (
    jd: string,
    profile: any,
    selectedAchievements: any[],
    docType: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE',
    identityCard?: { label: string; summary: string; tone: string; keyStrengths: string[] } | null
): string => {
    // Lean candidate snapshot — avoids sending full experience/education JSON
    const candidateSnapshot = {
        name: profile.name,
        summary: profile.professionalSummary,
        topSkills: [
            ...(profile.skills?.technical?.slice(0, 8) ?? []),
            ...(profile.skills?.industryKnowledge?.slice(0, 4) ?? []),
        ],
        identityCard: identityCard ?? null,
    };

    const achievementSummary = selectedAchievements.map(a => ({
        id: a.id,
        title: a.title,
        metric: a.metric ?? null,
        metricType: a.metricType ?? null,
        industry: a.industry ?? null,
        skills: a.skills ?? [],
    }));

    return `You are a senior career strategist. Your sole output is a JSON strategy blueprint that a separate writing model will execute. You do NOT write any document prose.

CANDIDATE SNAPSHOT:
${JSON.stringify(candidateSnapshot, null, 2)}

${identityCard ? `IDENTITY CONTEXT: This candidate's primary professional identity for this role is "${identityCard.label}". Tone: ${identityCard.tone}. Let this shape your toneBlueprint and messagingAngles.` : ''}

AVAILABLE ACHIEVEMENTS (use "id" values in proofPoints.achievementId):
${JSON.stringify(achievementSummary, null, 2)}

DOCUMENT TYPE: ${docType}

JOB DESCRIPTION:
"""
${jd}
"""

---
YOUR TASK — STRATEGIC ANALYSIS IN 4 STEPS:

STEP 1 — JD SIGNAL EXTRACTION (do this before filling any schema field):
Extract and hold in working memory:
a) Company name and any stated company initiatives, strategic priorities, or recent projects
b) The exact language the JD uses for the top 3 required capabilities (copy verbatim, do not paraphrase)
c) Tone indicators: formal/informal markers, sector signals, culture language
d) Any specific problems, challenges, or goals the role is hired to solve
e) One concrete, specific detail about this employer that would NOT appear in a generic job ad for the same role title

STEP 2 — OPENING HOOK TEST:
Draft the openingHook. Apply this test: "Could this exact sentence appear in a cover letter for a different company's identical job title?" If yes, it fails. The hook must reference a specific detail from Step 1e. It must be one sentence. It must not begin with "I am writing", "I am a", or "As a".

STEP 3 — PROOF POINT MAPPING:
For each achievement in AVAILABLE ACHIEVEMENTS, decide whether it warrants a proofPoint entry. Only include achievements that have a genuine connection to a stated JD requirement. For each included achievement:
- framingAngle: the specific lens through which to present it for THIS role (e.g. "Frame as operational efficiency, not just cost saving — JD emphasises 'process improvement'")
- jdConnection: quote the specific JD language this achievement proves (e.g. "proven ability to manage complex stakeholder relationships")
- narrativeNote: how to expand the raw bullet into a story — what context to add, what secondary impact to surface

STEP 4 — PITFALL FLAGS:
Start with these known Llama default patterns that MUST be blocked:
- "I am writing to express my strong interest in"
- "I am a passionate [profession]"
- "I believe I would be a great fit"
- "I am excited about the opportunity to"
- "With my [X] years of experience"
Then add 1-2 role-specific patterns that would be generic for THIS particular JD.

---
OUTPUT SCHEMA — return valid JSON only, no preamble, no markdown fences:

{
  "openingHook": "One sentence. Specific to this JD. Fails the transferability test if it could appear in any other application.",
  "positioningStatement": "2-3 sentences. Why this exact candidate for this exact role. Uses JD language. Does not assert — demonstrates.",
  "proofPoints": [
    {
      "achievementId": "exact id string from AVAILABLE ACHIEVEMENTS",
      "framingAngle": "How to present this achievement for this JD — specific lens, not generic",
      "jdConnection": "Quoted or close-paraphrased JD language this achievement directly proves",
      "narrativeNote": "What context or secondary impact to surface when expanding the raw bullet into prose"
    }
  ],
  "messagingAngles": [
    "Theme 1 — use JD language, 3-5 themes total",
    "Theme 2",
    "Theme 3"
  ],
  "toneBlueprint": "Specific tone signal derived from JD evidence — e.g. 'Direct and results-oriented; JD uses action verbs (deliver, drive, own) and has no mission-statement language — avoid warm or values-heavy framing'",
  "structureNotes": "Structural advice specific to this docType and this JD — e.g. word count guidance for STAR responses, paragraph sequencing for cover letters, section prioritisation for resumes",
  "pitfallFlags": [
    "I am writing to express my strong interest in",
    "I am a passionate [profession]",
    "I believe I would be a great fit",
    "I am excited about the opportunity to",
    "With my [X] years of experience",
    "Role-specific pitfall 1",
    "Role-specific pitfall 2"
  ],
  "employerInsight": "One specific, verifiable detail about this employer that can anchor the company connection paragraph — OR exactly: [MISSING: no employer-specific detail found in JD — candidate must research company website, LinkedIn, or recent news before this field can be populated]",
  "sector": "GOVERNMENT | TECH_STARTUP | CORPORATE | HEALTHCARE | EDUCATION | NFP | GENERAL"
}

CONSTRAINTS:
- Return ONLY valid JSON. No preamble. No explanatory text. No markdown code fences.
- Do NOT fabricate employer details. Use the MISSING flag if the JD does not supply them.
- Do NOT write any document prose in any field. Fields contain strategic instructions, not finished sentences (except openingHook, which is a finished sentence the executor will use directly).
- achievementId values MUST exactly match id strings from AVAILABLE ACHIEVEMENTS. Do not invent IDs.
- messagingAngles: minimum 3, maximum 5. Mirror JD language — do not substitute synonyms.
- pitfallFlags: minimum 5 (the 5 seeded above), maximum 7. The 5 seeded flags must always be present.
`;
};
