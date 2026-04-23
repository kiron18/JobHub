import { StrategyBlueprint } from './strategy';

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
 * CriterionAchievementMap maps a single selection criterion to its
 * pre-matched achievement evidence (retrieved via semantic search).
 */
export interface CriterionAchievementMap {
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

export const FRAMEWORK_INSTRUCTIONS: Record<string, string> = {
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
    const isAcademicDoc = routeType === 'teaching-philosophy' || routeType === 'research-statement' || routeType === 'offer-negotiation' || routeType === 'linkedin-profile' || routeType === 'cold-outreach' || routeType === 'rejection-response';
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
IMPORTANT: If a section below is marked "(none — omit this section)" you MUST omit that entire section from the output. Do not write a heading, do not write placeholder text, do not say "Not provided". Simply leave it out.

Name: ${profile.name}
Contact (use | as separator on one line): ${[profile.email, profile.phone, profile.linkedin, profile.location].filter(Boolean).join(' | ')}
Professional Summary: ${profile.professionalSummary}
Skills: ${JSON.stringify(profile.skills)}
Experience: ${profile.experience?.length ? JSON.stringify(profile.experience) : '(none — omit this section)'}
Education: ${profile.education?.length ? JSON.stringify(profile.education) : '(none — omit this section)'}
Certifications: ${profile.certifications?.length ? JSON.stringify(profile.certifications) : '(none — omit this section)'}
Volunteering: ${profile.volunteering?.length ? JSON.stringify(profile.volunteering) : '(none — omit this section)'}
Languages: ${profile.languages?.length ? JSON.stringify(profile.languages) : '(none — omit this section)'}
${profile.coverLetterRawText ? `
==============================================================
VOICE REFERENCE
==============================================================
The candidate has uploaded a previous cover letter. Match their vocabulary level, sentence rhythm, and formality register. Preserve their natural writing style — do NOT homogenise into generic AI output.

SAMPLE (first 600 chars):
${profile.coverLetterRawText.slice(0, 600)}
` : ''}
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
    const isAcademicDoc = routeType === 'teaching-philosophy' || routeType === 'research-statement' || routeType === 'offer-negotiation' || routeType === 'linkedin-profile' || routeType === 'cold-outreach' || routeType === 'rejection-response';
    return `
You are a career coach generating a ${type}.

CRITICAL RULES FOR ${type}:
${ruleBase}

TONAL DIRECTION:
${analysisContext?.tone ? `Mirror this style: ${analysisContext.tone}` : "Professional, direct English."}

CORE FOCUS AREAS (Prioritize these):
${analysisContext?.competencies?.map(c => `- ${c}`).join('\n') || "Map candidate strengths to JD requirements."}

CANDIDATE DATA:
IMPORTANT: If a section below is marked "(none — omit this section)" you MUST omit that entire section from the output. Do not write a heading, do not write placeholder text, do not say "Not provided". Simply leave it out.

Name: ${profile.name}
Contact (use | as separator on one line): ${[profile.email, profile.phone, profile.linkedin, profile.location].filter(Boolean).join(' | ')}
Professional Summary: ${profile.professionalSummary}
Skills: ${JSON.stringify(profile.skills)}
Experience: ${profile.experience?.length ? JSON.stringify(profile.experience) : '(none — omit this section)'}
Education: ${profile.education?.length ? JSON.stringify(profile.education) : '(none — omit this section)'}
Certifications: ${profile.certifications?.length ? JSON.stringify(profile.certifications) : '(none — omit this section)'}
Volunteering: ${profile.volunteering?.length ? JSON.stringify(profile.volunteering) : '(none — omit this section)'}
Languages: ${profile.languages?.length ? JSON.stringify(profile.languages) : '(none — omit this section)'}
${profile.coverLetterRawText ? `
VOICE REFERENCE — match vocabulary level, sentence rhythm, and formality register from this sample. Preserve the candidate's natural style:
"${profile.coverLetterRawText.slice(0, 600)}"
` : ''}
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
