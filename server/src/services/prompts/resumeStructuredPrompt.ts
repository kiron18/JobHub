import { StrategyBlueprint } from './strategy';
import type { BridgedGap } from '../../lib/bridgedGaps';

// =============================================================================
// STRUCTURED RESUME PROMPT — single capable-model pass, JSON output.
// =============================================================================

/**
 * RESUME_STRUCTURED_PROMPT — single-pass resume tailoring.
 *
 * One capable model receives the candidate's full resume (raw text) plus their
 * structured work history (with ids) and the target job description, and:
 *   1. rewrites the professional summary + per-role bullets, tailored to the job,
 *   2. tags each role `feature` (substantive professional role) vs casual/odd job,
 *      and `australianLocal`, so the renderer can fold or drop survival jobs.
 *
 * The output { summary, experience: [{ id, feature, australianLocal, bullets }] }
 * is consumed by the deterministic renderer (buildTemplateResume) — the document's
 * look never changes, only the words and which roles are featured.
 *
 * Guiding principle: take what is already in the resume, rearrange and sharpen it
 * for this job, and invent nothing.
 *
 * Signature is unchanged from the blueprint-era prompt so the route call sites do
 * not change. `blueprint`, `selectedAchievements`, `companyResearch`, `bridgedGaps`
 * and `precomputedYears` are no longer used by the body.
 */
export const RESUME_STRUCTURED_PROMPT = (
    jd: string,
    profile: any,
    _selectedAchievements: any[],
    _blueprint: StrategyBlueprint,
    analysisContext?: { tone?: string; competencies?: string[]; regenerateFeedback?: string },
    _companyResearch?: { salutation?: string; highlights?: string[]; companySize?: string; hiringManager?: string } | null,
    employerQuestions?: string[],
    _bridgedGaps?: BridgedGap[],
    _precomputedYears?: number | null,
): string => {
    // Structured work history → the output rows. Each entry's id MUST come back so
    // the renderer maps bullets to the right role; keep the same order.
    const experienceBlock = (profile?.experience ?? []).length
        ? (profile.experience as any[]).map((e, i) => {
            const dates = [e.startDate, e.isCurrent ? 'Present' : e.endDate].filter(Boolean).join(' to ');
            const header = `[${i + 1}] id: ${e.id} — ${e.role ?? ''}${e.company ? ` at ${e.company}` : ''}${dates ? ` (${dates})` : ''}`;
            const src = (e.description ?? '').trim();
            return src ? `${header}\n${src}` : header;
        }).join('\n\n')
        : '(no structured work history)';

    const rawResume = (profile?.resumeRawText ?? '').trim();

    	    // Normalised skills the model may reorder/trim (never add to). Handles the
	    // JSON-object skills shape ({technical, industryKnowledge, softSkills}) and a
	    // plain string. Falls back to whatever string is stored.
	    const skillsBlock = (() => {
	        const s = profile?.skills;
	        if (!s) return '(no skills listed)';
	        if (typeof s === 'string') {
	            const t = s.trim();
	            if (!t.startsWith('{') && !t.startsWith('[')) return t || '(no skills listed)';
	            try {
	                const parsed = JSON.parse(t);
	                if (Array.isArray(parsed)) return parsed.join(', ');
	                return Object.entries(parsed)
	                    .map(([k, v]) => {
	                        const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
	                        return `${label}: ${Array.isArray(v) ? v.join(', ') : String(v)}`;
	                    })
	                    .join('\n');
	            } catch {
	                return t;
	            }
	        }
	        return '(no skills listed)';
	    })();

	    return `You are an expert Australian resume writer. Rewrite this candidate's resume so it wins an interview for the specific job below.

Your job is simple: take what is already in their resume, rearrange and sharpen it for this role, and tailor the language to the job. Do not invent anything.

==============================================================
THEIR WORK HISTORY (the single source of truth — return one object for EACH entry; keep the same order and ids)
==============================================================
${experienceBlock}

==============================================================
ORIGINAL RESUME TEXT (reference only — the structured work history above is authoritative and supersedes this wherever they differ, because the candidate may have edited their profile since uploading)
==============================================================
${rawResume || '(raw resume text unavailable)'}

==============================================================
THEIR SKILLS (reorder and trim for this job — never add a skill not listed here)
==============================================================
${skillsBlock}

==============================================================
THE JOB THEY ARE APPLYING FOR
==============================================================
${jd}

==============================================================
HOW TO WRITE IT
==============================================================
1. SOURCE OF TRUTH. Use only facts that appear in the structured work history above, which the candidate has reviewed and edited. The original resume text is reference only. Where they differ, the structured work history wins. Never invent a company, role, date, qualification, tool, or metric. If the resume does not contain something the job wants, leave it out — do not claim it, and do not write that the candidate lacks it.

2. NUMBERS, HONESTLY. Lead a bullet with a figure ONLY when that exact figure is in the resume. When there is no number, lead with the concrete result, scope, or action instead. Never make up, estimate, or round a number. This is the most important rule.

3. TAILOR TO THE JOB. Surface the most relevant experience first. Mirror the important words and skills from the job description wherever the candidate genuinely has that experience.

4. PROFESSIONAL SUMMARY. Write it in the first person (the candidate speaking). Never use their name or "he", "she", or "they". Open with their years of PROFESSIONAL experience and their professional identity, then their two or three strongest, most relevant strengths. 3 to 4 sentences. When you state years, count only substantive professional roles — do NOT count casual, part-time survival, or odd jobs.

5. BULLETS — TIGHT AND OUTCOME-FIRST. Never copy a bullet from the source resume word-for-word. Rewrite each so it leads with the result (what improved, changed, was maintained, or was prevented), even with no number, then the how in a few words. Keep each bullet to ONE sentence of about 15 to 22 words. Do NOT write dense 30-plus-word sentences that pile on three trailing clauses — that is the single most common failure here. Cut adjectives and filler. Example: "Managed daily water quality testing and adjusted nutrient parameters across aquaponics systems" becomes "Held water quality within target range across commercial aquaponics systems, sustaining high yields and healthy fish stock." Active voice, no "I" prefix, no markdown, no bold.

6. CASUAL JOBS ONLY (set this per entry). Almost every role belongs on the resume. Set "casual": true ONLY for a casual or odd survival job — retail, hospitality filler, kitchen hand, cleaning, delivery, warehouse temp, or similar work unrelated to a professional career. EVERY skilled, technical, managerial, professional, research, engineering, or trade role is NOT casual: set "casual": false — even when the role is in a different field from this job. NEVER mark a real professional role casual just because it does not match this job; relevance is handled by how you write the bullets, not by removing roles. Also set "australianLocal": true if the role was performed in Australia. For a casual role write just ONE short factual bullet (it will be folded into a single line); for every other role write full bullets per the rules above.

7. KEEP IT TO TWO PAGES (hard limit). This MUST fit two pages, so budget the space by relevance to THIS job. Give the 2 to 3 roles most relevant to the job 3 to 4 tight bullets each. Give clearly less-relevant professional roles (for example an unrelated hospitality or retail management role on a technical application) just 1 to 2 bullets, focused only on the one thing this job actually values from it, such as safety, compliance, or stakeholder communication. Across the whole resume aim for roughly 10 to 14 bullets in total, never more. When in doubt, cut.

8. SKILLS, RETARGETED. Output a skills block tailored to this job. Start from THEIR SKILLS above and use only those, never add a skill the candidate does not have. Put the skills this job names first, drop skills with no relevance to this job, and keep the candidate's category labels (for example Technical, Industry Knowledge, Soft Skills). Format as one line per category in the form "Label: item, item, item". If the candidate clearly has a skill the job names under different wording, you may use the job's wording for that same skill, but never introduce a capability the resume does not show.

9. AUSTRALIAN ENGLISH. organised, analysed, recognised, programme, labour, colour, specialised.

10. NO GAPS, NO PLACEHOLDERS. The result must read as finished, signable work. Never output [VERIFY], [ADD], [TBD], or any bracketed placeholder. Every sentence must be complete.${employerQuestions && employerQuestions.length > 0 ? `

11. The job asks the candidate to address these — weave answers naturally into the summary or bullets where the resume supports them:
${employerQuestions.map(q => `   - ${q}`).join('\n')}` : ''}${analysisContext?.regenerateFeedback ? `

The user asked for this specific change — apply it: "${analysisContext.regenerateFeedback}"` : ''}

==============================================================
OUTPUT
==============================================================
Return ONLY this JSON object. No preamble, no explanation, no markdown fences.

{
  "summary": "first-person professional summary, 3-4 sentences, no name, no he/she/they",
  "skills": "one line per category, e.g. 'Technical: SAP, Microsoft Excel, inventory reconciliation\\nIndustry Knowledge: stock control, cycle counting'",
  "targetRoleTitle": "exact job title from the job ad — copy it word for word",
  "pageBudgetWarning": false,
  "experienceOrder": ["id of most relevant role", "id of 2nd most relevant", "...continue for ALL ids"],
  "experience": [
    {
      "id": "the exact id from the work history above",
      "casual": false,
      "australianLocal": true,
      "display": "full",
      "bullets": ["tailored bullet", "tailored bullet"],
      "tips": [
        {
          "bulletIndex": 0,
          "suggestion": "Adding what % or volume figure here would make this achievement significantly stronger — for example, how many tonnes of seed were processed per season, or what yield improvement was achieved."
        }
      ]
    }
  ]
}

FIELD RULES:

targetRoleTitle: Copy the job title exactly from the job ad. This becomes the candidate’s resume headline. Do not invent a title not in the ad.

experienceOrder: List ALL experience IDs from the work history, sorted from most to least relevant to this specific job. Every id must appear exactly once. This is the order they will appear on the resume.

display: Set one value per experience entry.
- "full" — any substantive professional, technical, managerial, academic, or research role. This is the default for almost every role.
- "fold" — a casual or survival job only: retail assistant, kitchen hand, delivery driver, warehouse picker, cleaning staff, or similar work with no professional skill relevance to any career. A restaurant MANAGER is NOT casual — set "full". When in doubt, set "full".
- "omit" — only for a role that is both irrelevant to this job AND was performed entirely outside Australia. Never omit Australian roles.

pageBudgetWarning: Set true only if you estimate the resume content you have written will still exceed 2 pages after all your curation decisions. Be honest — a false alarm is better than silently producing a 3-page resume.

tips (optional, per experience): Add a tip ONLY when a bullet would be significantly stronger with a specific metric that you cannot invent from the resume. Each tip must be one concrete, specific sentence spelling out exactly what the candidate should add — name the type of number (%, $, volume, timeframe, headcount). Do not add a tip for a bullet that is already quantified. Maximum 2 tips per experience entry, 5 tips total across the entire resume. If no bullet needs a tip, omit the tips array entirely.

Return one experience object for EVERY entry in the work history. Every object must carry its exact id. Output nothing except the JSON.`;
};
