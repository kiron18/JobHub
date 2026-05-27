import { StrategyBlueprint } from './strategy';
import { computeYearsOfExperience, todayIso } from '../../lib/profileMath';

// =============================================================================
// STRUCTURED RESUME PROMPT — JSON output (structured template path)
// =============================================================================

/**
 * RESUME_STRUCTURED_PROMPT — for Llama 3.3 70B (executor role).
 *
 * Identical to DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT in all strategic
 * inputs (blueprint, achievements, profile data, rules, analysis context,
 * company research, employer questions). The ONLY difference is the output
 * instruction: the LLM produces a structured JSON object instead of markdown.
 *
 * The JSON is then validated with Zod (parsePolishJson), merged into a
 * ResumeData struct via buildTemplateResume, and rendered to markdown
 * server-side using the deterministic profileToMarkdown renderer.
 *
 * Advantages:
 * - Bullet quality is higher (LLM focuses on content, not formatting)
 * - Output is machine-validated (Zod catches structural errors)
 * - Markdown rendering is deterministic (no LLM formatting drift)
 * - Enforcers (first-person, banned phrases, provenance tagging) run on
 *   structured fields, not regex on raw text
 */
export const RESUME_STRUCTURED_PROMPT = (
    jd: string,
    profile: any,
    selectedAchievements: any[],
    blueprint: StrategyBlueprint,
    analysisContext?: { tone?: string; competencies?: string[]; regenerateFeedback?: string },
    companyResearch?: { salutation?: string; highlights?: string[]; companySize?: string; hiringManager?: string } | null,
    employerQuestions?: string[]
): string => {
    const todayDate = todayIso();
    const yearsOfExperience = computeYearsOfExperience(profile?.experience);

    // Build the proof point lookup for inline rendering
    const proofPointMap = new Map(
        blueprint.proofPoints.map(pp => [pp.achievementId, pp])
    );

    // Render achievements with their blueprint framing instructions inline
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

    // Focus areas: blueprint messagingAngles replace analysisContext competencies
    // when present
    const focusAreas = blueprint.messagingAngles.length > 0
        ? blueprint.messagingAngles.map(a => `- ${a}`).join('\n')
        : (analysisContext?.competencies?.map(c => `- ${c}`).join('\n') ?? 'Map candidate strengths to JD requirements.');

    return `==============================================================
DIRECTOR'S BRIEF — READ THIS FIRST. IT OVERRIDES ALL DEFAULTS.
==============================================================

You are executing a document strategy designed by a senior career strategist. Your job is to write the RESUME exactly as the strategist has specified. You will output structured JSON, not markdown.

PROFESSIONAL SUMMARY DIRECTIVE:
Write a 3-4 sentence professional summary that leads with years of experience + core professional identity, then top 2-3 quantified outcomes, then a forward-looking capability statement. It must NOT begin with a company-specific hook. It must be scannable and role-agnostic enough to work across similar applications.

VOICE — NON-NEGOTIABLE: Write the professional summary in FIRST PERSON. The candidate is speaking, not being described. NEVER open with the candidate's name (e.g. "${profile?.name ?? 'Jane'} brings...", "${profile?.name ?? 'Jane'} is a..."). NEVER use "he", "she", or "they" to refer to the candidate. Use "I" when a subject is needed, or write agentless first-person ("Seasoned Business Analyst with 15 years..." — "I" implied). This applies to the Professional Summary ONLY; work experience bullets use imperative voice (no "I" prefix needed).${yearsOfExperience !== null ? `

YEARS OF EXPERIENCE — USE EXACTLY THIS NUMBER: ${yearsOfExperience}. This figure has been pre-computed from the candidate's actual employment history (earliest start date to today, ${todayDate}). Write it verbatim — e.g. "I bring ${yearsOfExperience} years of marketing experience..." or "${yearsOfExperience}+ years in...". Do NOT recalculate. Do NOT estimate.` : ''}

POSITIONING STATEMENT (shape the professional summary around this):
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

If you find yourself about to write any of the above, stop and rewrite using the evidence from the achievements instead.

==============================================================
CANDIDATE DATA
==============================================================
IMPORTANT: If a section below is marked "(none — omit this section)" you MUST omit that entire section. Do not write placeholder text.

TODAY'S DATE: ${todayDate}${yearsOfExperience !== null ? `
TOTAL YEARS OF EXPERIENCE (pre-computed from work history — use verbatim): ${yearsOfExperience}` : ''}

Name: ${profile.name}
Contact (use | as separator on one line): ${[profile.email, profile.phone, profile.linkedin, profile.location].filter(Boolean).join(' | ')}
Professional Summary: ${profile.professionalSummary}
Skills: ${typeof profile.skills === 'string' ? profile.skills : '(none — omit this section)'}
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
TASK: GENERATE THE STRUCTURED RESUME JSON
==============================================================
Write the resume content as a JSON object. Each experience entry's bullets MUST be rewritten using the strategic framing from ACHIEVEMENTS WITH STRATEGIC FRAMING INSTRUCTIONS above. Map each achievement to the most impactful bullet under the relevant experience entry by matching the achievement's title/description to the experience entry it belongs to.

1. Use Australian English throughout (organised, analysed, recognised, programme, labour, colour).

2. MISSING DATA RULE: If a section has no data in CANDIDATE DATA, omit that section from the JSON. Never insert empty arrays for sections with no data — omit the key entirely. Never write "Available upon request" for sections that do not exist.

3. ACHIEVEMENT INTEGRATION: Map each achievement to the most impactful bullet under the relevant experience entry. Use the FRAMING ANGLE to position each bullet for this specific role. Achievements without a proofPoint entry are supporting evidence — use them as context only.

4. FORMATTING:
   - Write each bullet as a single, complete imperative sentence (no "I" prefix — bullets use imperative voice).
   - Every bullet demonstrates domain expertise. Cut generic filler. Quality over quantity — 3 sharp bullets beat 6 weak ones.
   - Do NOT use bold or any markdown formatting inside bullet strings.

5. ALL EXPERIENCE ENTRIES: You MUST generate rewritten bullets for EVERY experience entry in the CANDIDATE DATA, not just the ones with matched achievements. Entries without a matched achievement should get 1-2 relevant bullets drawn from their existing data.
   - Correct: All experience entries are present in the output with rewritten bullets.
   - Wrong: Only experience entries that have matched achievements appear in the output.

6. JD KEYWORD INTEGRATION (mandatory): Identify the most important technical skills, tools, certifications, role titles, and industry terminology from the JD above. Embed these naturally throughout the professional summary and experience bullets where the candidate's actual experience supports them. Every term must be contextually accurate — do NOT insert keywords the candidate cannot substantiate.

${employerQuestions && employerQuestions.length > 0 ? `
EMPLOYER QUESTIONS — the JD asks the candidate to answer these. Where relevant, weave responses into the professional summary or experience bullets naturally:
${employerQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
` : ''}

${analysisContext?.regenerateFeedback ? `
==============================================================
USER IMPROVEMENT REQUEST (HIGHEST PRIORITY — apply this)
==============================================================
The user has requested the following specific changes to this regeneration:
"${analysisContext.regenerateFeedback}"

Apply this feedback directly and deliberately. This overrides default choices where there is a conflict.
==============================================================
` : ''}

CONSTRAINTS:
- Do NOT include any meta-talk or pleasantries.
- Do NOT fabricate any data not present in CANDIDATE DATA above.
- The DIRECTOR'S BRIEF takes precedence. Where the brief specifies framing, use it.
- Output ONLY a valid JSON object with this exact structure. No preamble, no explanation, no markdown code fences.

{
  "summary": "string — rewritten professional summary in FIRST PERSON. Never use the candidate's name or third person (he/she/they). Start with 'I' or use agentless first person (e.g. 'Engineering leader with...'). 3-5 sentences.",
  "experience": [
    {
      "id": "string — the exact experience ID from the profile data",
      "bullets": ["string — rewritten bullet point", "string — another bullet"]
    }
  ]
}

CRITICAL OUTPUT RULES:
- The "experience" array MUST contain an entry for EVERY experience entry in the CANDIDATE DATA, matched by exact ID.
- The "bullets" array for each experience entry MUST contain rewritten bullets, not the original description text.
- If you cannot find a strategic framing for an experience entry, write 1-2 strong bullets based on the entry's existing description.
- Output NOTHING except the JSON object. No commentary. No markdown fences. No "Here is your resume JSON:". Just the JSON.`;
};
