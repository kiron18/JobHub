export function buildSearchContextBlock(profile: any): string {
  if (!profile?.hasCompletedOnboarding) return '';
  return `
--- CANDIDATE SEARCH CONTEXT ---
Target role: ${profile.targetRole || 'Not specified'}
Target city: ${profile.targetCity || 'Not specified'}
Seniority: ${profile.seniority || 'Not specified'}
Industry: ${profile.industry || 'Not specified'}
Search duration: ${profile.searchDuration || 'Not specified'}
Applications sent: ${profile.applicationsCount || 'Not specified'}
Response pattern: ${profile.responsePattern || 'Not specified'}
Self-identified blocker: ${profile.perceivedBlocker || 'Not specified'}
--- END CONTEXT ---

Use the above context to calibrate positioning, tone, and emphasis. A candidate who has sent 100+ applications and is getting silence needs ATS-optimised language and sharp keyword alignment. A candidate getting interviews that stall needs stronger proof points and narrative specificity. Weight the document accordingly.

`;
}

export const STAGE_1_PROMPT = (text: string) => `
You are a expert Career Coach and Data Extraction Engine.
Your goal is 100% data density and providing helpful coaching hints to candidates.

Extract EVERY piece of information into the structured JSON format below.
Compare extracted data against the "Standard Resume Standards" (Reverse chronological, metrics needed, no personal ID).

Specific Instructions:
1. VOLUNTEERING: Extract any community work or student societies (valued as strategic assets).
2. CERTIFICATIONS: Separate professional credentials from formal education.
3. LANGUAGES: Extract all languages and proficiency levels.
4. COACHING ALERTS: Identify missing or weak data.
   - RED: Missing mandatory info (e.g., Year in Education, Contact info).
   - ORANGE: Content needs improvement (e.g., Bullet point without a metric, generic "team player" clichés).

Schema:
{
  "profile": {
    "name": "Full Name",
    "email": "Email Address",
    "phone": "Phone Number",
    "linkedin": "LinkedIn URL",
    "location": "Suburb, State",
    "professionalSummary": "3-4 sentences implied third person"
  },
  "skills": {
    "technical": ["Excel", "Python"],
    "industryKnowledge": ["Financial Modelling"],
    "softSkills": ["Stakeholder Engagement"]
  },
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or Present",
      "bullets": ["Point 1", "Point 2"],
      "coachingTips": ["Tip on how to add a metric here"]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Degree Name",
      "year": "YYYY",
      "coachingTips": "Missing year? Mention it here."
    }
  ],
  "volunteering": [{ "org": "", "role": "", "desc": "" }],
  "certifications": [{ "name": "", "issuer": "", "year": "" }],
  "languages": [{ "name": "", "proficiency": "" }],
  "coachingAlerts": [
    { "type": "MISSING_METRIC", "field": "experience[0].bullets[0]", "message": "Add a % or $ result to show impact.", "color": "orange" }
  ]
}

Resume Text:
"""
${text}
"""
`;

export const STAGE_2_PROMPT = (role: string, company: string, bullets: string[]) => `
Review the following resume bullet points for the role of "${role}" at "${company}".
Identify which points represent "Achievements" with measurable impact, leadership, or significant projects.

For each achievement, extract:
1. Title: A short, punchy summary.
2. Description: The full original bullet or a slightly polished version.
3. Metric: Exact numbers, percentages, or scale.
4. Metric Type: Categorize as "Revenue", "Efficiency", "Scale", "Team", "Technical", or "Cost".
5. Industry: Identify the specific industry (e.g., "SaaS", "Construction", "Government", "FinTech").
6. Skills/Tags: Relevant technical and soft skills.

Return a JSON array of objects.

JSON Schema:
{
  "achievements": [
    {
      "title": "Short title",
      "description": "Full bullet content",
      "metric": "Number/Percentage",
      "metricType": "Revenue|Efficiency|Scale|Team|Technical|Cost",
      "industry": "Industry context",
      "skills": ["skill1", "skill2"],
      "tags": ["tag1", "tag2"]
    }
  ]
}

IMPORTANT: Every achievement MUST have a 'title' and 'description'.

Bullets to analyze:
${JSON.stringify(bullets, null, 2)}
`;

export const JOB_ANALYSIS_PROMPT = (jd: string, profile: any, topAchievements: string) => `
Act as a recruitment expert comparing a candidate to a Job Description (JD).

USER PROFILE SUMMARY:
${profile.professionalSummary}
Top Skills: ${profile.skills.technical.join(', ')}

TOP RELEVANT ACHIEVEMENTS (from bank):
${topAchievements}

JOB DESCRIPTION:
${jd}

---
TASK:
1. Extract the company name and job role title from the JD.
2. Extract 10-15 key skills/keywords from the JD.
3. Identify the "Tonal Profile" of the JD (e.g., "Corporate & Formal", "Fast-Paced Tech", "Direct & Service-Oriented", "Academic/Research").
4. Identify 3-5 "Core Competencies" the JD emphasizes most (beyond keywords, what are they actually looking for?).
5. Rank the provided achievements by relevance to this JD.
6. Calculate an overall match score (0-100).
7. Set requiresSelectionCriteria to true ONLY if the JD explicitly contains the words "Selection Criteria", "Key Selection Criteria", "KSC", "Statement of Claims", or "Capability Statements". Do NOT set to true for general competency questions or role requirement lists.

---
CONSTRAINTS:
- Return ONLY valid JSON.
- No preamble, no conversational text.

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
      "relevanceScore": number (0-100),
      "reason": "Specific 1-sentence reason why this achievement proves fit for the JD requirements"
    }
  ]
}

You must respond with valid JSON only.
`;

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
    docType: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE'
): string => {
    // Lean candidate snapshot — avoids sending full experience/education JSON
    const candidateSnapshot = {
        name: profile.name,
        summary: profile.professionalSummary,
        topSkills: [
            ...(profile.skills?.technical?.slice(0, 8) ?? []),
            ...(profile.skills?.industryKnowledge?.slice(0, 4) ?? []),
        ],
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

// =============================================================================
// HYBRID ARCHITECTURE — STAGE 3 (Claude Sonnet quality gate)
// =============================================================================

/**
 * QualityGateResult is the JSON contract returned by the quality gate.
 * Callers should check passed === true before saving the document.
 * If passed === false, rewrites are surgical replacements — not full regeneration.
 */
export interface QualityGateResult {
    passed: boolean;
    flags: string[];
    rewrites: Array<{
        section: string;
        original: string;
        suggested: string;
    }>;
}

/**
 * QUALITY_GATE_PROMPT — for Claude Sonnet (cheap, fast pass).
 *
 * Design rationale:
 * - Deliberately narrow scope: 3 checks only, no nitpicking
 * - Hard cap of 3 rewrites prevents over-correction that breaks Llama's output
 * - "Pass if good" default prevents the gate from blocking acceptable work
 * - Prompt kept under 400 words total to minimise latency and cost
 */
export const QUALITY_GATE_PROMPT = (
    blueprint: StrategyBlueprint,
    generatedContent: string
): string => `You are a quality gate. Check the document below against 3 criteria only. Return JSON.

BLUEPRINT REFERENCE:
Opening hook required: "${blueprint.openingHook}"
Pitfall flags (must be absent): ${blueprint.pitfallFlags.map(f => `"${f}"`).join(' | ')}
Tone required: ${blueprint.toneBlueprint}

GENERATED DOCUMENT:
"""
${generatedContent}
"""

CHECK 1 — OPENING HOOK: Does the document open with (or very closely paraphrase) the required hook? A close paraphrase passes. A generic opener that ignores the hook fails.

CHECK 2 — PITFALL FLAGS: Does the document contain any pitfall flag phrase or a close variant? Scan every sentence. If found, flag it.

CHECK 3 — TONE MATCH: Does the overall tone match the tone blueprint? Minor deviations pass. A document that is warm and values-heavy when the blueprint calls for direct and results-oriented fails.

DECISION RULE: If all 3 checks pass, set passed: true and return empty arrays. Only flag genuine failures. Do not nitpick style. Do not suggest improvements to content that meets the spec.

REWRITE RULE: Maximum 3 rewrites. Each rewrite must be surgical — replace only the failing text, leave surrounding content intact. Do not rewrite passing sections.

Return valid JSON only. No preamble. No markdown fences.

{
  "passed": true | false,
  "flags": ["description of each failure — empty array if passed"],
  "rewrites": [
    {
      "section": "short label e.g. 'opening paragraph'",
      "original": "exact text from the document that fails",
      "suggested": "replacement text that passes the relevant check"
    }
  ]
}`;

// =============================================================================
// HYBRID ARCHITECTURE — STAGE 2 (Llama executor with blueprint)
// =============================================================================

/**
 * DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT — for Llama 3.3 70B (executor role).
 *
 * The blueprint goes at the TOP as a "DIRECTOR'S BRIEF" before the rule base
 * and candidate data. This re-prioritises the instruction hierarchy so Llama
 * treats strategic direction as primary and formatting rules as secondary.
 *
 * Design rationale:
 * - Llama is recency-biased: the last instruction tends to dominate. Placing the
 *   blueprint first means formatting rules are "freshest" at generation time,
 *   but strategic framing has been established before any other context loads.
 *   The DIRECTOR'S BRIEF label signals authority, not just information.
 * - pitfallFlags are repeated as a numbered BLOCK THESE PHRASES list immediately
 *   before the TASK so they are the final constraint Llama sees before writing.
 * - proofPoints are rendered as explicit per-achievement instructions, not left
 *   as implicit signals in the achievement list — Llama needs explicit mapping.
 * - analysisContext tone/competencies are preserved for backward compatibility
 *   but blueprint.toneBlueprint takes precedence when present.
 */
// Inline import type to avoid circular deps — generation.ts exports this
interface CriterionAchievementMap {
    criterion: string;
    criterionIndex: number;
    achievements: Array<{ id: string; title: string; description: string; metric: string | null; relevanceScore: number }>;
}

function buildPerCriterionBlock(maps: CriterionAchievementMap[]): string {
    if (maps.length === 0) return '';
    return maps.map(cm => {
        const achBlock = cm.achievements.length > 0
            ? cm.achievements.map(a =>
                `    - [${a.relevanceScore}% match] ${a.title}: ${a.description} (Metric: ${a.metric ?? 'none'})`
              ).join('\n')
            : '    - (No strong matches — draw on all available experience)';
        return `Criterion ${cm.criterionIndex}: ${cm.criterion}\n${achBlock}`;
    }).join('\n\n');
}

const FRAMEWORK_INSTRUCTIONS: Record<string, string> = {
    aps_ils: `FRAMEWORK: Australian Public Service — Integrated Leadership System (ILS).
Use ILS cluster language where appropriate: "Shapes Strategic Thinking", "Achieves Results", "Cultivates Productive Working Relationships", "Exemplifies Personal Drive and Integrity", "Communicates with Influence".
Match language to APS band level evident in the JD (APS 3-6: operational specificity; EL1-2: strategic framing).`,
    qld_lc4q: `FRAMEWORK: Queensland Government — Leadership Competencies for Queensland (LC4Q).
Reference the three domains: Vision (leads strategically, leads change), Results (delivers results, drives accountability), Accountability (fosters healthy and inclusive workplaces, demonstrates sound governance).`,
    nsw_capability: `FRAMEWORK: NSW Public Sector Capability Framework.
Align responses to the five capability groups: Personal Attributes, Relationships, Results, Business Enablers, People Management.`,
    vic_vpsc: `FRAMEWORK: Victorian Public Sector Commission (VPSC) Values and Behaviours framework.
Reference VPSC values: Responsiveness, Integrity, Impartiality, Accountability, Respect, Leadership, Human Rights.`,
    university_academic: `FRAMEWORK: Australian University Academic appointment.
Structure responses against academic criteria: Teaching excellence, Research quality/impact, Community engagement, Leadership/service. Avoid STAR for teaching philosophy — use reflective first-person narrative instead.`,
    university_professional: `FRAMEWORK: Australian University Professional Staff (HEW scale).
Apply HEW level-appropriate language. Focus on operational delivery, service quality, and technical/professional expertise relevant to the HEW band.`,
};

export const DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT = (
    type: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE',
    jd: string,
    profile: any,
    selectedAchievements: any[],
    ruleBase: string,
    blueprint: StrategyBlueprint,
    analysisContext?: { tone?: string; competencies?: string[]; regenerateFeedback?: string },
    companyResearch?: { salutation?: string; highlights?: string[]; companySize?: string; hiringManager?: string } | null,
    selectionCriteriaText?: string | null,
    perCriterionAchievements?: CriterionAchievementMap[] | null,
    employerFramework?: string | null,
    routeType?: string | null
): string => {
    const isAcademicDoc = routeType === 'teaching-philosophy' || routeType === 'research-statement' || routeType === 'offer-negotiation' || routeType === 'linkedin-profile' || routeType === 'cold-outreach';
    // Build the proof point lookup for inline rendering
    const proofPointMap = new Map(
        blueprint.proofPoints.map(pp => [pp.achievementId, pp])
    );

    // Render achievements with their blueprint framing instructions inline.
    // Achievements without a proof point entry are still included as raw evidence
    // but without strategic framing — Llama uses them as supporting material only.
    const achievementBlock = selectedAchievements.length > 0
        ? selectedAchievements.map(a => {
            const pp = proofPointMap.get(a.id);
            if (pp) {
                return [
                    `- [ID: ${a.id}] ${a.title}: ${a.description} (Metric: ${a.metric ?? 'none'})`,
                    `  FRAMING ANGLE: ${pp.framingAngle}`,
                    `  JD CONNECTION: ${pp.jdConnection}`,
                    `  NARRATIVE NOTE: ${pp.narrativeNote}`,
                ].join('\n');
            }
            return `- [ID: ${a.id}] ${a.title}: ${a.description} (Metric: ${a.metric ?? 'none'}) [supporting evidence — use as context only]`;
        }).join('\n\n')
        : 'No achievements selected. Draw on candidate experience data only.';

    // Tone: blueprint takes precedence; fall back to analysisContext for
    // backward compatibility with callers that have not yet adopted the blueprint.
    const toneInstruction = blueprint.toneBlueprint
        || (analysisContext?.tone ? `Mirror this style: ${analysisContext.tone}` : 'Professional, direct Australian English.');

    // Competencies: blueprint messagingAngles replace analysisContext competencies
    // when present. Both are surfaced so Llama can cross-reference.
    const focusAreas = blueprint.messagingAngles.length > 0
        ? blueprint.messagingAngles.map(a => `- ${a}`).join('\n')
        : (analysisContext?.competencies?.map(c => `- ${c}`).join('\n') ?? 'Map candidate strengths to JD requirements.');

    return `==============================================================
DIRECTOR'S BRIEF — READ THIS FIRST. IT OVERRIDES ALL DEFAULTS.
==============================================================

You are executing a document strategy designed by a senior career strategist. Your job is to write the ${type} exactly as the strategist has specified. Do not improvise the strategic elements. Apply your formatting and language skills within the strategic frame you are given.

OPENING HOOK (use this — or a minimal paraphrase that preserves specificity — as the document's opening sentence):
"${blueprint.openingHook}"

POSITIONING STATEMENT (shape the professional summary / pitch opening around this):
${blueprint.positioningStatement}

MESSAGING ANGLES (these themes must recur across the document using this exact language):
${focusAreas}

TONE DIRECTIVE:
${toneInstruction}

STRUCTURE NOTES FOR THIS DOCUMENT:
${blueprint.structureNotes}

SECTOR: ${blueprint.sector}
${blueprint.sector === 'GOVERNMENT' ? '→ Apply formal tone, reference APS values language if present in JD, use capability framework terminology.' : ''}
${blueprint.sector === 'TECH_STARTUP' ? '→ Warmer, direct tone acceptable. Conciseness rewarded. Bold opening is appropriate.' : ''}
${blueprint.sector === 'HEALTHCARE' ? '→ Emphasise patient outcomes and care quality alongside operational metrics.' : ''}
${blueprint.sector === 'NFP' ? '→ Values alignment is essential. Community impact must be evidenced, not asserted.' : ''}

EMPLOYER INSIGHT (use in company connection paragraph — if MISSING flag present, omit the company connection paragraph entirely rather than fabricating):
${blueprint.employerInsight}

ACHIEVEMENTS WITH STRATEGIC FRAMING INSTRUCTIONS:
${achievementBlock}

==============================================================
BLOCK THESE PHRASES — THEY MUST NOT APPEAR ANYWHERE IN THE OUTPUT:
==============================================================
${blueprint.pitfallFlags.map((f, i) => `${i + 1}. "${f}"`).join('\n')}

If you find yourself about to write any of the above, stop and rewrite using the evidence from the achievements or the opening hook instead.

==============================================================
FORMATTING RULES FOR ${type}
==============================================================
${ruleBase}

==============================================================
CANDIDATE DATA
==============================================================
Name: ${profile.name}
Contact (use | as separator on one line): ${[profile.email, profile.phone, profile.linkedin, profile.location].filter(Boolean).join(' | ')}
Professional Summary: ${profile.professionalSummary}
Skills: ${JSON.stringify(profile.skills)}
Experience: ${JSON.stringify(profile.experience || [])}
Education: ${JSON.stringify(profile.education || [])}
Certifications: ${JSON.stringify(profile.certifications || [])}
Volunteering: ${JSON.stringify(profile.volunteering || [])}
Languages: ${JSON.stringify(profile.languages || [])}

JOB DESCRIPTION:
${jd}

==============================================================
TASK: GENERATE THE ${type}
==============================================================
Write the ${type} as high-impact Markdown.

1. Use Australian English throughout (organised, analysed, recognised, programme, labour, colour).
${type === 'RESUME' ? `
HEADER BLOCK (no "## Header" label — just these 3 lines at the top):
   Line 1: # Candidate full name
   Line 2: *Target Job Title from JD | Industry*
   Line 3: contact details separated by | (e.g. john@email.com | 0400 000 000 | linkedin.com/in/john | Sydney, NSW, Australia)` : ''}

2. MISSING DATA RULE: If a section has no data in CANDIDATE DATA, omit that section entirely.
   - Never insert [MISSING:] placeholders or empty sections into the document.
   - Never write "Available upon request" for sections that do not exist in the candidate's data.
   ${type === 'STAR_RESPONSE' ? '- For selection criteria evidence gaps, flag with [MISSING: description] only inside the relevant criterion response.' : ''}

3. ACHIEVEMENT INTEGRATION: ${type === 'COVER_LETTER'
        ? 'Weave achievements into narrative paragraphs as specific evidence. Use the FRAMING ANGLE and NARRATIVE NOTE from each achievement\'s strategic instructions. Do NOT produce a bullet list of achievements.'
        : type === 'STAR_RESPONSE'
            ? 'Map each achievement to the most relevant selection criterion. Build each STAR response around the achievement evidence and its NARRATIVE NOTE.'
            : 'Map each achievement to the most impactful bullet under the relevant experience entry. Use the FRAMING ANGLE to position each bullet for this specific role.'}

${type === 'COVER_LETTER' ? `METRICS RULE (mandatory): You MUST include at least one specific numerical reference in the cover letter.
   Priority order:
   1. Use exact metrics from the ACHIEVEMENTS WITH STRATEGIC FRAMING INSTRUCTIONS above (percentages, dollar values, team sizes, time savings).
   2. If no achievement has a metric, draw a quantitative detail from the CANDIDATE DATA experience entries: years in role, team size, number of clients/projects/stakeholders managed, budget administered, geographic scope, or similar.
   3. A reference like "led a team of 6" or "managed 3 concurrent projects over 2 years" qualifies.
   4. For early-career or student candidates with no work metrics: reference program duration ("a 3-year Computer Science degree"), number of projects completed ("built 4 automation pipelines"), or academic scale ("served a cohort of 200+ students"). Any factual count or duration from the candidate data counts.
   IMPORTANT: If you use a number NOT found in the selected achievements (i.e., inferred from experience context), immediately follow the sentence with [VERIFY: brief description of what to confirm] so the candidate can check accuracy before sending.
   NEVER write a cover letter with zero numerical references — it reads as unsubstantiated assertion and weakens the application.` : ''}

4. ${isAcademicDoc
        ? 'ACADEMIC DOCUMENT FORMAT: Follow the specific format and structure rules in the FORMATTING RULES section above exactly. Do NOT apply STAR framework. Write as first-person narrative prose as specified.'
        : type === 'STAR_RESPONSE'
        ? 'STAR FORMAT: Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%). Flowing prose. First person active voice. Do NOT use Situation/Task/Action/Result as subheadings.'
        : type === 'COVER_LETTER'
            ? `COVER LETTER FORMAT: No headers or subheadings. 3-5 paragraphs separated by a blank line.
   SALUTATION: ${companyResearch?.salutation ?? 'Dear Hiring Manager,'}
   Open with the DIRECTOR'S BRIEF hook immediately after the salutation.
   Evidence paragraphs follow. Company connection paragraph last (omit if employerInsight has MISSING flag). Proactive CTA in closing.
   SIGN-OFF: End with "Yours sincerely," (if named salutation) or "Yours faithfully," (if "Dear Hiring Manager") followed by a blank line and then the candidate's full name: ${profile.name}`
            : 'SPECIALIST POSITIONING: Every bullet demonstrates domain expertise. Cut generic filler. Quality over quantity — 3 sharp bullets beat 6 weak ones.'}

${type === 'RESUME' ? `5. FORMATTING:
   - Use ## for section headers (not the header block at top)
   - Experience bullets MUST use markdown list syntax — each bullet on its own line starting with "- ". Never use • for bullet points.
   - Skills layout: each category on a SEPARATE paragraph (blank line between each). Format exactly:
       **Technical Skills:** Skill A • Skill B • Skill C

       **Industry Knowledge:** Domain A • Domain B

       **Soft Skills:** Skill A • Skill B
   - The bold label (**Technical Skills:**, **Industry Knowledge:**, **Soft Skills:**) always starts flush at the beginning of its line.
   - Omit any skill category entirely if no data exists for it.
   - Omit any section entirely if no candidate data exists for it.
   - Minimise vertical whitespace — target 1-2 pages.` : ''}

${selectionCriteriaText ? `
==============================================================
SELECTION CRITERIA TO ADDRESS
==============================================================
The candidate has provided the following selection criteria. Generate a separate STAR response for each criterion, headed with the criterion text. Address them in the order listed. Do not skip any criterion.

STAR ALLOCATION: Situation (10-15%) → Task (10-15%) → Action (60-70%) → Result (15-20%).
Write in flowing prose, first person, active voice. Do NOT label STAR components as subheadings.
Target 250-400 words per criterion unless the role specifies a different limit.

${employerFramework && FRAMEWORK_INSTRUCTIONS[employerFramework] ? `
${FRAMEWORK_INSTRUCTIONS[employerFramework]}
` : ''}

${selectionCriteriaText}

${perCriterionAchievements && perCriterionAchievements.length > 0 ? `
--------------------------------------------------------------
TARGETED EVIDENCE — use these pre-matched achievements first for each criterion.
These were retrieved via semantic search specifically for each criterion above.
--------------------------------------------------------------
${buildPerCriterionBlock(perCriterionAchievements)}
` : ''}

IMPORTANT: Generate ALL criteria listed above. Each response is a separate headed section.
` : ''}

CONSTRAINTS:
- Do NOT use bold ** within bullet points unless highlighting a metric.
- Do NOT include any meta-talk or pleasantries (e.g. "Here is your cover letter...").
- Output ONLY the Markdown content. Nothing before it, nothing after it.
- Do NOT fabricate any data not present in CANDIDATE DATA above.
- The DIRECTOR'S BRIEF takes precedence. Where the brief specifies framing, use it. Where it specifies the opening hook, use it. Do not substitute your own interpretation.
${analysisContext?.regenerateFeedback ? `
==============================================================
USER IMPROVEMENT REQUEST (HIGHEST PRIORITY — apply this)
==============================================================
The user has requested the following specific changes to this regeneration:
"${analysisContext.regenerateFeedback}"

Apply this feedback directly and deliberately. This overrides default choices where there is a conflict.
==============================================================
` : ''}`;
};

// =============================================================================
// ORIGINAL SINGLE-PASS PROMPT (preserved for A/B comparison and fallback)
// =============================================================================

export const DOCUMENT_GENERATION_PROMPT = (
    type: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE',
    jd: string,
    profile: any,
    selectedAchievements: any[],
    ruleBase: string,
    analysisContext?: { tone?: string; competencies?: string[]; regenerateFeedback?: string },
    companyResearch?: { salutation?: string; highlights?: string[]; companySize?: string } | null,
    selectionCriteriaText?: string | null,
    perCriterionAchievements?: CriterionAchievementMap[] | null,
    employerFramework?: string | null,
    routeType?: string | null
) => {
    const isAcademicDoc = routeType === 'teaching-philosophy' || routeType === 'research-statement' || routeType === 'offer-negotiation' || routeType === 'linkedin-profile' || routeType === 'cold-outreach';
    return `
You are a career coach generating a ${type}.

CRITICAL RULES FOR ${type}:
${ruleBase}

TONAL DIRECTION:
${analysisContext?.tone ? `Mirror this style: ${analysisContext.tone}` : "Professional, direct English."}

CORE FOCUS AREAS (Prioritize these):
${analysisContext?.competencies?.map(c => `- ${c}`).join('\n') || "Map candidate strengths to JD requirements."}

CANDIDATE DATA:
Name: ${profile.name}
Contact (use | as separator on one line): ${[profile.email, profile.phone, profile.linkedin, profile.location].filter(Boolean).join(' | ')}
Professional Summary: ${profile.professionalSummary}
Skills: ${JSON.stringify(profile.skills)}
Experience: ${JSON.stringify(profile.experience || [])}
Education: ${JSON.stringify(profile.education || [])}
Certifications: ${JSON.stringify(profile.certifications || [])}
Volunteering: ${JSON.stringify(profile.volunteering || [])}
Languages: ${JSON.stringify(profile.languages || [])}

SELECTED ACHIEVEMENTS (Use ONLY these for evidence):
${selectedAchievements.length > 0
    ? selectedAchievements.map(a => `- [${a.title}] ${a.description} (Metric: ${a.metric})`).join('\n')
    : "No specific achievements selected. Focus on general skills and background."}

JOB DESCRIPTION:
${jd}

---
TASK:
Generate the ${type} as high-impact Markdown.
1. Use Australian English (organised, analysed, recognised, programme, labour, colour).
   ${type !== 'COVER_LETTER' && type !== 'STAR_RESPONSE' ? `HEADER BLOCK (no "## Header" label — just these 3 lines at the top):
   Line 1: # Candidate full name
   Line 2: *Target Job Title from JD | Industry*
   Line 3: contact details separated by | (e.g. john@email.com | 0400 000 000 | linkedin.com/in/john | Sydney, NSW, Australia)` : ''}

2. MISSING DATA RULE: If a section has no data in CANDIDATE DATA above, OMIT that section entirely.
   - Never insert [MISSING:] placeholders or empty sections into the document.
   - Never write "Available upon request" for sections that simply don't exist in the candidate's data.
   ${type === 'STAR_RESPONSE' ? `- For selection criteria gaps, flag with [MISSING: description] only in the criteria response itself.` : ''}

3. ACHIEVEMENT INTEGRATION: ${type === 'COVER_LETTER'
    ? `Weave the selected achievements directly into the cover letter as specific evidence. Each achievement should be referenced naturally within the narrative paragraphs — not as a bullet list. Show HOW these achievements prove fit for this specific role.`
    : type === 'STAR_RESPONSE'
    ? `Map each selected achievement to the most relevant selection criterion. Build each STAR response around the achievement evidence.`
    : `Map each selected achievement to the most impactful bullet point under the relevant experience entry.`}

4. ${isAcademicDoc
    ? 'ACADEMIC DOCUMENT FORMAT: Follow the specific format and structure rules in the FORMATTING RULES section above exactly. Do NOT apply STAR framework. Write as first-person narrative prose as specified.'
    : type === 'STAR_RESPONSE'
    ? `STAR FORMAT REQUIRED: Each criterion response must follow Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%). Do NOT label these components as subheadings. Write in flowing prose, first person, active voice.`
    : type === 'COVER_LETTER'
    ? `COVER LETTER FORMAT: No headers or subheadings. 3-4 paragraphs separated by a blank line.
   SALUTATION: ${companyResearch?.salutation ?? 'Dear Hiring Manager,'}
   Opening: hook tied to this specific role and company. Body: evidence from achievements. Closing: proactive CTA.
   SIGN-OFF: End with "Yours sincerely," (if named salutation) or "Yours faithfully," followed by a blank line then the candidate's full name: ${profile.name}`
    : `SPECIALIST POSITIONING: Present the candidate as a deep specialist in their field. Cut generic filler. Every bullet must demonstrate domain expertise. Quality over quantity — 3 sharp bullets beat 6 weak ones.`}

5. ${type === 'RESUME' ? `FORMATTING:
   - Use ## for section headers (not the header block at top)
   - Experience bullets MUST use markdown list syntax — each bullet on its own line starting with "- ". Never use • for bullet points.
   - Skills layout: each category on a SEPARATE paragraph (blank line between each). Format exactly:
       **Technical Skills:** Skill A • Skill B • Skill C

       **Industry Knowledge:** Domain A • Domain B

       **Soft Skills:** Skill A • Skill B
   - The bold label (**Technical Skills:**, **Industry Knowledge:**, **Soft Skills:**) always starts flush at the beginning of its line. Never appear mid-line or mid-paragraph.
   - Omit any skill category entirely if no data exists for it
   - Omit any section entirely if no candidate data exists for it
   - Minimise vertical whitespace — target 1–2 pages` : ''}

${selectionCriteriaText ? `
SELECTION CRITERIA TO ADDRESS:
The candidate has provided the following criteria. Generate a separate STAR response for each, headed with the criterion text. Address ALL criteria in the order listed.

STAR ALLOCATION: Situation (10-15%) → Task (10-15%) → Action (60-70%) → Result (15-20%).
Write in flowing prose, first person, active voice. Target 250-400 words per criterion.

${employerFramework && FRAMEWORK_INSTRUCTIONS[employerFramework] ? FRAMEWORK_INSTRUCTIONS[employerFramework] + '\n' : ''}

${selectionCriteriaText}

${perCriterionAchievements && perCriterionAchievements.length > 0 ? `
TARGETED EVIDENCE per criterion (semantic search pre-matched):
${buildPerCriterionBlock(perCriterionAchievements)}
` : ''}
` : ''}

CONSTRAINTS:
- Do NOT use bold ** within bullet points unless highlighting a metric.
- Do NOT include any meta-talk or pleasantries (e.g., "Here is your resume...").
- Output ONLY the Markdown content.
- Do NOT fabricate any data not present in CANDIDATE DATA above.
${analysisContext?.regenerateFeedback ? `
==============================================================
USER IMPROVEMENT REQUEST (HIGHEST PRIORITY — apply this)
==============================================================
The user has requested the following specific changes to this regeneration:
"${analysisContext.regenerateFeedback}"

Apply this feedback directly and deliberately. This overrides default choices where there is a conflict.
==============================================================
` : ''}`;
};
