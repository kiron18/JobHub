/**
 * Post-apply outreach — the two messages a candidate sends to a human at the
 * company just after submitting an application.
 *
 * Kept out of the route so the prompt and the response handling can be tested
 * without standing up an LLM. The clamping matters more than it looks: LinkedIn
 * hard-rejects a connection note over 300 characters, and a draft the user
 * cannot actually paste is worse than no draft at all.
 */

/** LinkedIn refuses to send a connection note longer than this. */
export const LINKEDIN_NOTE_LIMIT = 300;

export interface OutreachProfile {
    name?: string | null;
    professionalSummary?: string | null;
    skills?: unknown;
    experience?: Array<{ role?: string | null; company?: string | null; description?: string | null }>;
}

export interface OutreachDraft {
    hook: string;
    linkedInNote: string;
    emailSubject: string;
    emailBody: string;
}

export function buildApplicationOutreachPrompt(
    jobTitle: string,
    company: string,
    jobDescription: string | undefined,
    profile: OutreachProfile,
): string {
    const experienceSummary = (profile.experience ?? [])
        .map((e) => `- ${e.role ?? 'Role'} at ${e.company ?? 'Company'}: ${(e.description || '').slice(0, 400)}`)
        .join('\n') || 'No experience recorded.';

    const skills = typeof profile.skills === 'string' ? profile.skills.slice(0, 600) : '(none)';
    const name = profile.name || 'the candidate';

    return `You are helping an Australian job seeker send a short, human message to someone at a company they have JUST applied to. The goal is to be remembered by a person, not to re-apply in prose.

THE ROLE
Title: ${jobTitle}
Company: ${company}

JOB DESCRIPTION (may be truncated)
${(jobDescription || '(not supplied)').slice(0, 3000)}

THE CANDIDATE
Name: ${name}
Summary: ${profile.professionalSummary || '(none)'}
Skills: ${skills}
Experience:
${experienceSummary}

WHAT TO WRITE

1. "hook" — the single most specific requirement in the job description that this candidate genuinely, evidently meets. One short phrase. If the job description is missing or vague, use the most relevant thing in their experience instead.

2. "linkedInNote" — a LinkedIn connection request note. HARD LIMIT 280 characters including spaces; LinkedIn rejects anything over ${LINKEDIN_NOTE_LIMIT} and shorter reads better. Say who they are, that they have applied for the role, and name the hook. Make NO request of any kind — no "would love to chat", no questions. Ending without an ask is what makes it easy to accept.

3. "emailSubject" — "Application for ${jobTitle} — ${name}". Use exactly that unless the job description gives a reference number, in which case append it.

4. "emailBody" — 90 to 130 words, plain text, no markdown. Structure: greeting line "Hi [name]," left as a literal placeholder for them to fill in; one sentence saying they applied and when; one sentence naming the specific requirement from the job description and the concrete evidence from their background that meets it, including a real figure if their experience contains one; one short sentence on why this company specifically, drawn from the job description — omit this sentence entirely rather than inventing praise; then close with a low-cost out, phrased close to "If you are not the right person for this, I would be grateful for a pointer to who is." Sign off "Best regards," then the candidate's name on its own line.

RULES
- Australian English (organised, specialised, programme).
- Invent nothing. Every claim must trace to the candidate details above. No fabricated numbers, tools, or employers.
- Warm and direct. No "I am writing to express my keen interest", no "I am excited about this opportunity", no flattery about the company being a leader in its field.
- Never ask for a referral, a call, or a favour in either message. The first contact earns the right to ask later.
- Leave "[name]" as a literal placeholder in the email — the candidate fills it in once they have found the person.

Return ONLY valid JSON:
{
  "hook": "short phrase",
  "linkedInNote": "under 280 characters",
  "emailSubject": "subject line",
  "emailBody": "the email"
}`;
}

/**
 * Coerce whatever the model returned into something the UI can render, or null
 * when the essential parts are missing. Never throws — a failed draft must not
 * take down the page the user's saved application is sitting on.
 */
export function normaliseOutreachDraft(
    raw: unknown,
    jobTitle: string,
    candidateName?: string | null,
): OutreachDraft | null {
    const result = (raw ?? {}) as Record<string, unknown>;

    const linkedInNote = typeof result.linkedInNote === 'string' ? result.linkedInNote.trim() : '';
    const emailBody = typeof result.emailBody === 'string' ? result.emailBody.trim() : '';
    if (!linkedInNote || !emailBody) return null;

    const fallbackSubject = `Application for ${jobTitle}${candidateName ? ` — ${candidateName}` : ''}`;
    const emailSubject = typeof result.emailSubject === 'string' && result.emailSubject.trim()
        ? result.emailSubject.trim()
        : fallbackSubject;

    return {
        hook: typeof result.hook === 'string' ? result.hook.trim() : '',
        // Truncating rather than rejecting: a slightly clipped note the user can
        // edit beats an error message, and they see the character count.
        linkedInNote: linkedInNote.slice(0, LINKEDIN_NOTE_LIMIT),
        emailSubject,
        emailBody,
    };
}
