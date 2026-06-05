import { StrategyBlueprint } from './strategy';
import type { BridgedGap } from '../../lib/bridgedGaps';
import { salutationTitle } from '../companyIntel';

// =============================================================================
// COVER LETTER SLOTS PROMPT — JSON output (structured template path)
// =============================================================================

/**
 * COVER_LETTER_SLOTS_PROMPT — for Llama 3.3 70B (executor role).
 *
 * The LLM writes prose for fixed slots; code owns paragraph structure.
 * Outputs structured JSON instead of markdown. The JSON is validated with
 * Zod, merged into CoverLetterData via applyCoverLetterPolish, and rendered
 * to deterministic markdown via coverLetterToMarkdown.
 *
 * Advantages:
 * - Higher paragraph quality (LLM focuses on content, not formatting)
 * - Output is machine-validated (Zod catches structural errors)
 * - Markdown rendering is deterministic (no LLM formatting drift)
 * - Company intel is consumed directly in the prompt
 */
export const COVER_LETTER_SLOTS_PROMPT = (
    jd: string,
    profile: any,
    selectedAchievements: any[],
    blueprint: StrategyBlueprint,
    analysisContext?: { tone?: string; competencies?: string[]; regenerateFeedback?: string },
    companyResearch?: { salutation?: string; highlights?: string[]; companySize?: string; hiringManager?: string } | null,
    companyIntel?: { summary?: string | null; suggestedContact?: { title?: string | null } | null } | null,
    bridgedGaps?: BridgedGap[],
): string => {
    const todayDate = new Date().toISOString().split('T')[0];

    // Build the proof point lookup
    const proofPointMap = new Map(
        blueprint.proofPoints.map(pp => [pp.achievementId, pp])
    );

    // Render achievements with strategic framing
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

    const toneInstruction = blueprint.toneBlueprint
        || (analysisContext?.tone ? `Mirror this style: ${analysisContext.tone}` : 'Professional, direct Australian English.');

    const focusAreas = blueprint.messagingAngles.length > 0
        ? blueprint.messagingAngles.map(a => `- ${a}`).join('\n')
        : (analysisContext?.competencies?.map(c => `- ${c}`).join('\n') ?? 'Map candidate strengths to JD requirements.');

    const contactTitle = salutationTitle(companyIntel?.suggestedContact?.title)
        || companyResearch?.salutation
        || 'Hiring Manager';

    const companySummary = companyIntel?.summary
        || (companyResearch?.highlights?.length ? companyResearch.highlights.join(' ') : '');

    const bridgedBlock = (bridgedGaps && bridgedGaps.length > 0)
        ? bridgedGaps.map(g => `- ${g.statement}`).join('\n')
        : '';

    return `==============================================================
DIRECTOR'S BRIEF — READ THIS FIRST. IT OVERRIDES ALL DEFAULTS.
==============================================================

You are writing a cover letter for a specific job application. The strategist has prepared a blueprint. Follow it exactly. You will output structured JSON, not markdown.

SALUTATION TARGET: ${contactTitle}
${companySummary ? `COMPANY CONTEXT (use this in paragraph 1 — it's from real research on this company):\n${companySummary}\n` : ''}
COMPANY NAME: ${companyIntel ? 'see intel above' : (companyResearch ? 'see research above' : 'the company from the job description')}

POSITIONING STATEMENT (shape the opening around this):
${blueprint.positioningStatement}

MESSAGING ANGLES (these themes must recur across the cover letter):
${focusAreas}

TONE DIRECTIVE:
${toneInstruction}

STRUCTURE NOTES FOR THIS DOCUMENT:
${blueprint.structureNotes}

SECTOR: ${blueprint.sector}
${blueprint.sector === 'GOVERNMENT' ? '→ Apply formal tone, reference APS values language if present in JD, use capability framework terminology.' : ''}
${blueprint.sector === 'TECH_STARTUP' ? '→ Warmer, direct tone acceptable. Conciseness rewarded.' : ''}
${blueprint.sector === 'HEALTHCARE' ? '→ Emphasise patient outcomes and care quality alongside operational metrics.' : ''}
${blueprint.sector === 'NFP' ? '→ Values alignment is essential. Community impact must be evidenced, not asserted.' : ''}

EMPLOYER INSIGHT (use in company connection paragraph — if MISSING flag present, omit the company connection paragraph entirely):
${blueprint.employerInsight}

ACHIEVEMENTS WITH STRATEGIC FRAMING INSTRUCTIONS:
${achievementBlock}

${bridgedBlock ? `
==============================================================
CONFIRMED CAPABILITIES (the candidate possesses these — weave in as genuine experience)
==============================================================
${bridgedBlock}
` : ''}
==============================================================
CONTRADICTION GUARD — NON-NEGOTIABLE
==============================================================
NEVER state, imply, or hedge that the candidate lacks, has not used, is unfamiliar with,
or is "eager/looking forward to learn" any skill listed above (CONFIRMED CAPABILITIES) or
any skill in the candidate's Skills data. Banned phrasings include: "although I have not",
"while I don't have direct experience", "I lack", "I am eager to learn", "I have yet to".
If the candidate genuinely lacks a requirement, OMIT it — never narrate the absence.
NEVER invent a number or metric; use only metrics already present in the text.

==============================================================
BLOCK THESE PHRASES — THEY MUST NOT APPEAR ANYWHERE IN THE OUTPUT:
==============================================================
${blueprint.pitfallFlags.map((f, i) => `${i + 1}. "${f}"`).join('\n')}

==============================================================
COVER LETTER STRUCTURE — 4 PARAGRAPHS, EACH WITH A SPECIFIC JOB
==============================================================

You will write EXACTLY 4 paragraphs. Each has a specific purpose:

**Paragraph 1 — Opening Hook + Company Connection** (3-4 sentences)
- Lead with a specific, concrete hook that connects the candidate's expertise to the role
- Include a genuine company reference: why this company specifically
- Use the COMPANY CONTEXT above if available
- End with a transition into evidence

**Paragraph 2 — Strongest Evidence** (3-4 sentences)
- Lead with the single most impressive, relevant achievement
- MUST include at least one numerical metric
- Show impact, not just responsibilities

**Paragraph 3 — Bridge + Second Evidence** (3-4 sentences)
- Address a skill or requirement from the JD not yet covered
- Provide a second concrete achievement or experience
- Show the candidate is well-rounded

**Paragraph 4 — Enthusiasm + CTA** (2-3 sentences)
- Express genuine interest in the role and company
- Include an explicit call to action ("I would welcome the opportunity...")
- End on a forward-looking note

==============================================================
CANDIDATE DATA
==============================================================
TODAY'S DATE: ${todayDate}

Name: ${profile.name}
Current role/target: ${profile.targetRole || 'N/A'}
Location: ${profile.location || 'N/A'}
Professional Summary: ${profile.professionalSummary || 'N/A'}
Skills: ${typeof profile.skills === 'string' ? profile.skills : '(none)'}
Experience: ${profile.experience?.length ? JSON.stringify(profile.experience) : '(none)'}
Education: ${profile.education?.length ? JSON.stringify(profile.education) : '(none)'}

JOB DESCRIPTION:
${jd}

==============================================================
TASK: GENERATE THE STRUCTURED COVER LETTER JSON
==============================================================
Write the cover letter content as a JSON object. Write every paragraph in FIRST PERSON active voice. NEVER use third person (he/she/they) to refer to the candidate.

1. Use Australian English throughout (organised, analysed, recognised, colour).

2. PARAGRAPH RULES:
   - Each paragraph MUST be 2-5 complete sentences
   - Do NOT include any markdown formatting, headers, or bullet points
   - Do NOT include salutation or signoff in paragraphs — those are separate fields
   - Write flowing prose, not bullet points

3. SALUTATION RULE:
   - Use "Dear ${contactTitle}," — exactly as specified
   - If the contact title is "Hiring Manager", signoff must be "Yours faithfully,"
   - Otherwise signoff must be "Yours sincerely,"

4. MISSING DATA RULE: Never fabricate company intel or candidate data. If the candidate's experience section is empty, draw from their professional summary and skills instead.

${analysisContext?.regenerateFeedback ? `
==============================================================
USER IMPROVEMENT REQUEST (HIGHEST PRIORITY — apply this)
==============================================================
The user has requested the following specific changes to this regeneration:
"${analysisContext.regenerateFeedback}"
` : ''}

CONSTRAINTS:
- Do NOT include any meta-talk or pleasantries.
- Do NOT fabricate data not present in CANDIDATE DATA above.
- NEVER emit a bracketed placeholder of any kind — not [VERIFY: ...], [ADD: ...], [INSERT: ...], [TBD], [PLACEHOLDER], or anything similar. The finished letter must read as complete, signable work with no gaps for the candidate to fill in. When a specific detail is genuinely absent from CANDIDATE DATA, either omit it or rephrase the sentence around it so it stays true and complete. NEVER fabricate a number, metric, credential, or fact to fill a gap. If a value already exists in the data (e.g. an achievement metric), use it verbatim.
- Before finalising, re-read every paragraph: each sentence must be grammatically complete. Do not output sentence fragments.
- Output ONLY a valid JSON object with this exact structure. No preamble, no explanation, no markdown code fences.

{
  "salutation": "string — exactly 'Dear {contactTitle},'",
  "p1": "string — opening hook paragraph (3-4 sentences)",
  "p2": "string — strongest evidence paragraph with metric (3-4 sentences)",
  "p3": "string — bridge + second evidence paragraph (3-4 sentences)",
  "p4": "string — enthusiasm + CTA paragraph (2-3 sentences)",
  "signoff": "string — 'Yours sincerely,{newline}Candidate Name' or 'Yours faithfully,{newline}Candidate Name'"
}

CRITICAL OUTPUT RULES:
- Output NOTHING except the JSON object. No commentary. No markdown fences. No "Here is your cover letter JSON:".
- Each paragraph must be 2-5 sentences of flowing prose.
- Never include bullet points or dashes in paragraph text.
- The signoff must include the candidate's full name on a new line after the sincerity/faithfully line.`;
};
