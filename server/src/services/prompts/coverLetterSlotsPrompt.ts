import { StrategyBlueprint } from './strategy';
import type { BridgedGap } from '../../lib/bridgedGaps';
import { salutationTitle } from '../companyIntel';

// =============================================================================
// COVER LETTER SLOTS PROMPT — single capable-model pass, JSON output.
// =============================================================================

/**
 * COVER_LETTER_SLOTS_PROMPT — single-pass cover letter.
 *
 * One capable model receives the candidate's full resume (raw text), the job
 * description, and real company research, and writes a four-paragraph cover
 * letter as the { salutation, p1, p2, p3, p4, signoff } JSON the deterministic
 * renderer (coverLetterToMarkdown) already consumes — so the look never changes.
 *
 * Guiding principle: persuade using only what is true of this candidate, and
 * make the company connection real. Invent nothing.
 *
 * Signature is unchanged so the route call site does not change. `blueprint`,
 * `selectedAchievements` and `bridgedGaps` are no longer used by the body.
 */
export const COVER_LETTER_SLOTS_PROMPT = (
    jd: string,
    profile: any,
    _selectedAchievements: any[],
    _blueprint: StrategyBlueprint,
    analysisContext?: { tone?: string; competencies?: string[]; regenerateFeedback?: string },
    companyResearch?: { salutation?: string; highlights?: string[]; companySize?: string; hiringManager?: string } | null,
    companyIntel?: { summary?: string | null; suggestedContact?: { title?: string | null } | null } | null,
    _bridgedGaps?: BridgedGap[],
): string => {
    const contactTitle = salutationTitle(companyIntel?.suggestedContact?.title)
        || companyResearch?.salutation
        || 'Hiring Manager';

    const companySummary = companyIntel?.summary
        || (companyResearch?.highlights?.length ? companyResearch.highlights.join(' ') : '');

    const rawResume = (profile?.resumeRawText ?? '').trim();
    const signoff = contactTitle === 'Hiring Manager' ? 'Yours faithfully,' : 'Yours sincerely,';

    return `You are an expert Australian cover letter writer. Write a cover letter that makes this candidate the obvious person to interview for the specific job below.

Persuade using only what is genuinely true of this candidate, drawn from their resume. Invent nothing.

==============================================================
THE CANDIDATE'S RESUME (the single source of truth)
==============================================================
${rawResume || '(raw resume text unavailable — work only from the structured profile below)\n' + `Name: ${profile?.name ?? ''}\nSummary: ${profile?.professionalSummary ?? ''}\nExperience: ${profile?.experience?.length ? JSON.stringify(profile.experience) : '(none)'}`}

==============================================================
THE JOB
==============================================================
${jd}

==============================================================
WHAT WE KNOW ABOUT THE EMPLOYER (use for the company connection — do NOT invent beyond this)
==============================================================
${companySummary || '(no specific company research available — do not fabricate company facts; connect through the role and what the job description itself reveals about the company)'}

==============================================================
HOW TO WRITE IT
==============================================================
1. SOURCE OF TRUTH. Every claim must be supported by the resume. NEVER state or imply experience, skills, qualifications, years, or industry exposure the candidate does not have. Do NOT add specifics the resume does not state: no funding bodies or grants, no awards, no certifications, no tools or software, and no proficiency levels (for example "advanced Excel") unless they appear in the resume. If the candidate does not meet a requirement, do not mention it and do not claim it; lead with their genuine, relevant strengths instead. Never write that they lack something, and never claim a compliance status (visa, clearance, vaccination, licence) that is not in the resume.

2. NUMBERS, HONESTLY. Use a specific figure only when it is in the resume. Otherwise lead with the concrete result or scope in plain words. Never invent, estimate, or inflate a number or a number of years.

3. FOUR PARAGRAPHS, each with a job:
   - Paragraph 1 — Hook + company connection. Open with a specific, genuine reason this candidate fits THIS role, and connect to THIS employer using the research above. No "I am writing to apply".
   - Paragraph 2 — Strongest evidence. The single most relevant, real achievement or experience for this job, shown with impact.
   - Paragraph 3 — Second evidence / breadth. Another genuine, relevant strength that covers a different part of what the job needs.
   - Paragraph 4 — Close. Confident, warm, a clear call to a conversation. No grovelling.

4. THE COMPETITOR TEST. Paragraph 1 and the company connection must NOT be sentences that could be sent to any other employer. If they could, rewrite them to reference something specific about this company or role.

5. VOICE. First person. Warm, direct, professional Australian English (organised, specialised, programme, behaviour). No em dashes or en dashes — use commas, full stops, or "and". No markdown, no bullet points. No placeholders of any kind. No AI cliches ("I am writing to express my interest", "I believe I would be a great fit", "team player", "passionate", "I am excited to apply").

6. LENGTH. Tight and readable: roughly 250 to 350 words across the four paragraphs. Every sentence earns its place.

${analysisContext?.regenerateFeedback ? `The user asked for this specific change — apply it: "${analysisContext.regenerateFeedback}"\n` : ''}
==============================================================
OUTPUT
==============================================================
Return ONLY this JSON object. No preamble, no explanation, no markdown fences.

{
  "salutation": "Dear ${contactTitle},",
  "p1": "opening hook + genuine company connection, 3-4 sentences",
  "p2": "strongest real evidence for this job, 3-4 sentences",
  "p3": "second genuine strength covering another requirement, 3-4 sentences",
  "p4": "confident close with a call to a conversation, 2-3 sentences",
  "signoff": "${signoff}\\n${profile?.name ?? ''}"
}

Output nothing except the JSON.`;
};
