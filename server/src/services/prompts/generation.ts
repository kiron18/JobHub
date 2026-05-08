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
    profileViolations: string[];
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
export interface ProfileSnapshot {
    employers: string[];
    jobTitles: string[];
    achievementMetrics: string[];
}

export const QUALITY_GATE_PROMPT = (
    blueprint: StrategyBlueprint,
    generatedContent: string,
    docType: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' = 'COVER_LETTER',
    profileSnapshot?: ProfileSnapshot | null
): string => {
    const check1 = docType === 'COVER_LETTER'
        ? `CHECK 1 — OPENING HOOK: Does the cover letter open with (or very closely paraphrase) the required hook? A close paraphrase passes. A generic opener that ignores the hook fails.\nHook required: "${blueprint.openingHook}"`
        : docType === 'RESUME'
        ? `CHECK 1 — PROFESSIONAL SUMMARY: Does the resume professional summary read as a scannable credential block (years of experience + outcomes + capability)? FAIL if the summary begins with the exact company-specific hook "${blueprint.openingHook}" or any near-verbatim restatement of it. PASS if the summary is role-focused and does not echo the cover letter opener.`
        : `CHECK 1 — CRITERION OPENING: Does each criterion response open by directly restating the criterion or echoing its key terms in the first sentence? FAIL if any response opens with: (a) the company-specific hook "${blueprint.openingHook}", (b) a generic opener like "I am a dedicated professional" or "I have always had a passion for", or (c) a sentence with no connection to the criterion being addressed. PASS if each response's first sentence names the capability or echoes the criterion language.`;

    const formatCheck = docType === 'RESUME'
        ? `The document must use bullet points / short statements for experience and skills. FAIL if the professional summary or any experience section contains multi-sentence narrative paragraphs that read like a cover letter pitch. Scannable structure required.`
        : docType === 'COVER_LETTER'
        ? `The document must be written in flowing narrative paragraphs. FAIL if any section opens with a bullet-point list or reads like a resume bullet (e.g. "Led X achieving Y" as a standalone line with no surrounding prose). Cover letters must not replicate resume structure.`
        : `Each selection criterion response must: (1) open on-criterion (first sentence echoes the criterion), (2) include bold STAR labels (**Situation**, **Task**, **Action**, **Result**) as inline section markers before each component, (3) have an Action section that is the longest component and names specific tools/methods/decisions, (4) end with a quantified or qualitatively evidenced result. FAIL if STAR labels are absent or if any response ends with a vague completion statement like "the project was completed successfully".`;

    const profileGroundingBlock = profileSnapshot && (profileSnapshot.employers.length > 0 || profileSnapshot.jobTitles.length > 0)
        ? `
CHECK 4 — PROFILE GROUNDING (hallucination detection):
Verify every factual claim in the document is traceable to the candidate's actual data.

CANDIDATE'S VERIFIED EMPLOYERS: ${profileSnapshot.employers.length > 0 ? profileSnapshot.employers.map(e => `"${e}"`).join(' | ') : '(none on record)'}
CANDIDATE'S VERIFIED JOB TITLES: ${profileSnapshot.jobTitles.length > 0 ? profileSnapshot.jobTitles.map(t => `"${t}"`).join(' | ') : '(none on record)'}
${profileSnapshot.achievementMetrics.length > 0 ? `CANDIDATE'S VERIFIED METRICS (from achievement bank): ${profileSnapshot.achievementMetrics.map(m => `"${m}"`).join(' | ')}` : ''}

Scan the document for:
a) Any employer or organisation name NOT in VERIFIED EMPLOYERS — flag it.
b) Any job title claimed NOT in VERIFIED JOB TITLES — flag it.
c) Any specific numerical metric (%, $, team size, headcount, duration, dollar value) that does NOT appear in VERIFIED METRICS and is not already annotated [VERIFY:] — flag it.

For each violation: add a rewrite that either removes the fabricated claim or replaces the specific number with [VERIFY: describe what the candidate should check] so they can confirm accuracy before sending.

PASS if no violations found, or all inferred numbers are already marked [VERIFY:]. Do NOT flag legitimate paraphrases of verified metrics (e.g. "23% reduction" is a valid paraphrase of a metric "reduced costs by 23%").`
        : '';

    return `You are a quality gate. Check the document below against ${profileGroundingBlock ? '4' : '3'} criteria only. Return JSON.

BLUEPRINT REFERENCE:
Pitfall flags (must be absent): ${blueprint.pitfallFlags.map(f => `"${f}"`).join(' | ')}
Messaging angles that MUST appear in the document: ${blueprint.messagingAngles.map(a => `"${a}"`).join(' | ')}
Document type: ${docType}

GENERATED DOCUMENT:
"""
${generatedContent}
"""

${check1}

CHECK 2 — PITFALL FLAGS: Does the document contain any pitfall flag phrase or a close variant? Scan every sentence. If found, flag it.

CHECK 3 — KEYWORD COVERAGE AND FORMAT: Two sub-checks, both must pass.
  3a. KEYWORD COVERAGE: Do at least 3 of the messaging angles listed above appear (verbatim or as clear paraphrases) in the document? If fewer than 3 are present, fail and identify which angles are missing.
  3b. DOCUMENT FORMAT: ${formatCheck}
${profileGroundingBlock}

DECISION RULE: If all checks pass, set passed: true and return empty arrays. Only flag genuine failures — minor wording variations pass. Do not nitpick style.

REWRITE RULE: Maximum 4 rewrites total across all failing checks. Each rewrite must be surgical — replace only the failing text, leave surrounding content intact.

Return valid JSON only. No preamble. No markdown fences.

{
  "passed": true | false,
  "flags": ["description of each failure — empty array if passed"],
  "profileViolations": ["list of fabricated or unverifiable claims found — empty array if none"],
  "rewrites": [
    {
      "section": "short label e.g. 'opening paragraph'",
      "original": "exact text from the document that fails",
      "suggested": "replacement text that passes the relevant check"
    }
  ]
}`;
};

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

${type === 'COVER_LETTER' ? `OPENING HOOK (use this — or a minimal paraphrase that preserves specificity — as the cover letter's opening sentence):
"${blueprint.openingHook}"` : `PROFESSIONAL SUMMARY DIRECTIVE (resume only — do NOT replicate the cover letter hook):
Write a 3–4 sentence professional summary that leads with years of experience + core professional identity, then top 2–3 quantified outcomes, then a forward-looking capability statement. It must NOT begin with a company-specific hook or mirror the cover letter opening sentence. It must be scannable and role-agnostic enough to work across similar applications.`}

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
        ? 'STAR FORMAT: Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%). Flowing prose. First person active voice. Each component MUST be introduced with its bold label on its own line: **Situation**, **Task**, **Action**, **Result** — written exactly like that, before the prose for each component.'
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
The candidate has pasted their selection criteria below. Read it carefully before generating.

PARSING RULE — CRITICAL:
The pasted text may contain section headings such as "Required Qualifications", "Required Experience", "Required Skills", "Essential Criteria", "Desirable Criteria", or similar. These headings are NOT criteria — they are category labels.
The ACTUAL criteria are the individual bullet points, numbered items, or sentences listed UNDER those headings.
Generate one STAR response per individual criterion item (bullet/numbered point/sentence), NOT per section heading.
If you see "Required Experience" followed by three dot points, generate three separate STAR responses — one for each dot point.
NEVER generate a response where the heading is "Required Qualifications/Certificates" or "Required Experience" — those are not criteria, they are containers.

WORD LIMIT CHECK: Before writing, scan the criteria text and job description for any stated word limit, page limit, or character limit per criterion (e.g. "maximum 300 words", "no more than half a page"). If found, apply it strictly and note it at the top of the document as: [Word limit: X words per criterion — applied per application instructions]. If no limit is stated, use the defaults below.

STAR ALLOCATION: Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%).
Write in flowing prose, first person, active voice.
Target 250-400 words per criterion unless a limit was found above.

STAR LABELS (mandatory): Each STAR component must be introduced with its label in bold on its own line, immediately before the prose for that component. Use exactly this format:
**Situation**
[prose...]

**Task**
[prose...]

**Action**
[prose...]

**Result**
[prose...]

Do NOT use ## for these labels. Each criterion response must look exactly like this structure:

**Situation**
[prose for situation]

**Task**
[prose for task]

**Action**
[prose for action]

**Result**
[prose for result]

This is mandatory. Every single criterion response must have all four labels.

MANDATORY OPENING: Each response MUST open by directly restating the criterion or echoing its key terms in the first sentence. This signals to the assessment panel that you are addressing their specific criterion.
CORRECT: "My experience managing competing stakeholder priorities has developed across three programme delivery roles..."
WRONG: Opening with the cover letter hook, a generic "I am a dedicated professional", or a sentence unrelated to the criterion.

ACTION SECTION STANDARD — this is where applications are won or lost:
- Name the specific tool, system, methodology, or approach you used and WHY you chose it
- Describe the decision-making behind your actions: "Recognising that X, I chose Y rather than Z because..."
- Sequence actions logically — show the candidate directing events, not just responding to them
- Write: "I designed a milestone tracker in Excel that surfaced conflicts 3 weeks in advance" — not "I managed project timelines"
- The Action section MUST be the longest component

MULTI-EXAMPLE OPTION: For broad criteria (communication, collaboration, stakeholder engagement, problem-solving), use TWO mini-STARs showing consistent capability across different contexts rather than a single example. Same total word count applies.

RESULT STANDARD: State organisational impact, not just task completion.
- Quantify wherever possible: %, $, time saved, headcount impacted, error rate reduced, satisfaction score
- If no metric exists, use qualitative evidence: senior endorsement, policy adopted, award, team feedback, process continued after the candidate's involvement
- Do NOT end a response with "The project was completed successfully" — that is not a result

QUALITY BENCHMARK: The worked example in the FORMATTING RULES section is the reference standard. Every response must match or exceed that level of specificity. Ask yourself: "Could this response have been written by any candidate, or does it clearly reflect this specific person's experience?" If the former — rewrite with more detail.

PRE-WRITING STEP — do this silently before drafting each response:
For each criterion, identify:
  a) The core capability being assessed (e.g. "stakeholder management", "financial governance") — often different from the criterion's surface wording
  b) Which achievement from TARGETED EVIDENCE most directly proves that specific capability
  c) The single most specific detail from that achievement — a tool, a decision, a number, a method — that the Action section MUST anchor around
Only then write. If you find yourself writing generically, stop — return to (c) and build the response outward from that concrete detail.

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
${type === 'RESUME' ? `- JD KEYWORD INTEGRATION (mandatory): Identify the most important technical skills, tools, certifications, role titles, and industry terminology from the JD above. Embed these naturally throughout the professional summary, skills section, and experience bullets where the candidate's actual experience supports them. Every term must be contextually accurate — do NOT insert keywords the candidate cannot substantiate. Do NOT stuff the company name into the resume. Goal: a recruiter reading both documents should feel they were built for each other.` : ''}
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
    ? `STAR FORMAT REQUIRED: Each criterion response must follow Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%). Write in flowing prose, first person, active voice. Each component MUST be introduced with its bold label on its own line (**Situation**, **Task**, **Action**, **Result**) before the prose for that component.`
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

STAR ALLOCATION: Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%).
Write in flowing prose, first person, active voice. Target 250-400 words per criterion.

MANDATORY OPENING: Each response MUST open by restating the criterion or echoing its key terms in the first sentence. Do not open with a generic statement or the cover letter hook.

ACTION SECTION: Name the specific tool, system, or method used and WHY. Describe decision-making. Write "I designed X using Y because Z" — not "I managed the project." Action must be the longest component.

MULTI-EXAMPLE: For broad criteria (communication, collaboration, stakeholder engagement), use two mini-STARs from different contexts at the same total word count.

RESULT: State organisational impact with quantified evidence (%, $, time, headcount). If no metric, use qualitative evidence: senior endorsement, policy adopted, feedback score. Never end with "the project was completed successfully."

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
