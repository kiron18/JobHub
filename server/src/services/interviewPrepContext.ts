import { prisma } from '../db';

/**
 * The candidate's own words, for interview prep.
 *
 * The answer bank holds stories the candidate has actually spoken and then
 * confirmed, which makes it the only material in the system that is already in
 * their voice. Everything else generation runs on (resume bullets, achievement
 * records) has been written ABOUT them, usually in resume register, and a
 * script built from that register is a script they cannot say out loud.
 *
 * Only `approved` text is ever used. `spoken` is the raw transcript and
 * `cleaned` is an unconfirmed pass over it, so neither is safe to put in front
 * of an interviewer. That rule is the whole point of the three-column design in
 * AnswerBankEntry and this must not be the place it gets quietly broken.
 */
export async function buildAnswerBankBlock(userId: string): Promise<string> {
    const intake = await prisma.answerBankIntake.findUnique({
        where: { userId },
        include: {
            entries: {
                where: { approvedAt: { not: null } },
                orderBy: { createdAt: 'asc' },
            },
        },
    });

    const entries = (intake?.entries ?? []).filter(e => e.approved && e.approved.trim());
    if (entries.length === 0) return '';

    const stories = entries.map((e, i) => {
        const variants = (e.variants as Record<string, string> | null) ?? {};
        // The medium cut is the one sized for a spoken answer. Fall back to the
        // approved text when variants were never generated.
        const body = (variants.medium || e.approved || '').trim();
        const headline = (variants.headline || '').trim();
        const themes = e.themes?.length ? e.themes.join(', ') : 'general';

        return [
            `STORY ${i + 1} (themes: ${themes})`,
            `Asked: ${e.questionText}`,
            headline ? `In one line: ${headline}` : null,
            `In their words: ${body}`,
        ].filter(Boolean).join('\n');
    }).join('\n\n');

    return `==============================================================
ANSWER BANK — THE CANDIDATE'S OWN WORDS (HIGHEST PRIORITY SOURCE)
==============================================================
These are stories the candidate has spoken aloud and then confirmed. This is how
they actually talk. When you write a script for them, build it from this phrasing
wherever the story fits the question.

Rules for using this material:
- Tighten for delivery. Do not rewrite into resume register.
- Never add a number, a date, an employer or an outcome that is not here.
- If a story does not fit the question, do not force it. Use the achievements instead.
- Prefer these over resume bullets whenever both cover the same ground.

${stories}
`;
}

/** The rounds a prep can be written for. The stage changes what gets asked. */
export const INTERVIEW_STAGES = {
    recruiter_screen: 'Recruiter screening call',
    hiring_manager: 'Hiring manager interview',
    panel: 'Panel interview',
    technical: 'Technical or task-based interview',
    final: 'Final round',
} as const;

export type InterviewStage = keyof typeof INTERVIEW_STAGES;

export const isInterviewStage = (v: unknown): v is InterviewStage =>
    typeof v === 'string' && Object.prototype.hasOwnProperty.call(INTERVIEW_STAGES, v);

/** What each round is actually for, and what the prep must therefore cover. */
const STAGE_BRIEF: Record<InterviewStage, string> = {
    recruiter_screen: `A recruiter or talent partner on the phone, 20 to 30 minutes, screening OUT rather than in.
They are checking the basics line up: can you do the job on paper, are you available, do the
logistics work, are your expectations realistic. They usually do not know the work deeply.
- Keep every script short. This is the round lost on rambling.
- Salary, availability, work rights, location and notice are LIKELY. Cover them properly.
- Keep technical depth out of it. Name the domain terms, do not lecture.
- The goal of the call is the next conversation, nothing more.`,

    hiring_manager: `The person who will manage you. They are screening IN: can you do the work, and do they want you
in their team.
- Depth over breadth. Fewer stories, further into each one.
- They care about how you work, what you do when it goes wrong, and who you had to bring with you.
- Their problems are the real subject. Your questions should be about the work, not the process.
- Logistics only if the ad raises something unavoidable.`,

    panel: `Several interviewers, often scored against set criteria, common in government, health and education.
- Answers are structured and complete. Name the criterion the story is answering.
- Spread the stories across the panel's areas, do not use the same example three times.
- Address the whole panel, and expect each member to probe their own area.
- Say the number and the outcome plainly, they may be writing it down.`,

    technical: `A technical, case or task round. They are testing how you think, not whether you already know the answer.
- Reasoning out loud matters more than the final answer.
- Prepare how to say "I don't know" well: what you would check, and in what order.
- Tools, systems and methods from the ad should be named and framed by how you learn them.
- Stories should be about diagnosis and trade-offs, not stakeholder management.`,

    final: `A final round, often with a senior leader or the manager's manager. The competence question is largely
settled, this is about judgement, motivation and fit.
- Why this organisation, and why now, must be genuinely specific.
- Expect the long view: where you want to go, what you want to own.
- Offer, start date and salary can all land here. Be ready and calm.
- Close deliberately. This is the round where asking for the next step is expected.`,
};

/**
 * The facts a coach always knows before a call and JobHub has not been asking.
 *
 * Everything here is optional, and the honest gap matters more than the block
 * being full: a prep that invents a visa answer is worse than one that tells
 * the candidate to have theirs ready. So each missing fact is stated as missing
 * rather than silently dropped.
 */
export function buildInterviewContextBlock(
    stage: InterviewStage | null,
    profile: {
        visaStatus?: string | null;
        visaExpiry?: string | null;
        salaryExpectation?: string | null;
        availability?: string | null;
        location?: string | null;
    },
): string {
    const known: string[] = [];
    const missing: string[] = [];

    const fact = (label: string, value: string | null | undefined, absent: string) => {
        if (value && value.trim()) known.push(`- ${label}: ${value.trim()}`);
        else missing.push(`- ${absent}`);
    };

    fact('Work rights', profile.visaStatus, 'Work rights are not on file.');
    fact('Visa expiry', profile.visaExpiry, 'Visa expiry is not on file.');
    fact('Salary expectation', profile.salaryExpectation, 'Salary expectation is not on file.');
    fact('Availability and notice', profile.availability, 'Availability and notice period are not on file.');
    if (profile.location?.trim()) known.push(`- Based in: ${profile.location.trim()}`);

    const stageBlock = stage
        ? `THIS PREP IS FOR: ${INTERVIEW_STAGES[stage]}

${STAGE_BRIEF[stage]}

Write the whole document for this round. A script that belongs in a different round does not
belong in this one.`
        : `THE ROUND IS NOT KNOWN. Write for a first conversation with the employer: cover the basics
properly, keep the scripts short, and include work rights, availability and salary.`;

    return `==============================================================
THIS INTERVIEW
==============================================================
${stageBlock}

CANDIDATE LOGISTICS
${known.length > 0 ? known.join('\n') : '- Nothing on file.'}
${missing.length > 0 ? `
NOT ON FILE. Never invent any of these. Where the ad makes one unavoidable, write the item as an
instruction to have the fact ready and the shape of the answer, not as a claim about the candidate:
${missing.join('\n')}` : ''}
`;
}

/**
 * Take the em dashes out of a generated prep.
 *
 * The rules file forbids them and the model uses them anyway, roughly once per
 * document. Asking a second time does not fix it: this is a deterministic
 * substitution, so it belongs in code rather than in a prompt.
 *
 * Number ranges are handled first and separately. Rewriting "12–18 months" to
 * "12, 18 months" would change what the sentence means, which is a worse
 * outcome than the dash it was fixing.
 */
export function stripEmDashes(text: string): string {
    return text
        // 12–18 months, $85,000—$95,000. The dash is a range, not punctuation.
        // The currency symbol has to be allowed on the right or a salary band,
        // the one range a prep is most likely to carry, slips straight past.
        .replace(/(\d)\s*[—–]\s*([$€£]?\d)/g, '$1 to $2')
        // Dash doing the work of a comma, spaced or not.
        .replace(/\s*[—–]\s*/g, ', ')
        // The substitution can meet punctuation that was already there.
        .replace(/,\s*,/g, ',')
        .replace(/([,;:])\s*,\s*/g, '$1 ')
        .replace(/,\s*([.!?])/g, '$1');
}
