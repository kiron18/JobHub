/**
 * Achievement-draft-from-gap prompt.
 *
 * Takes a Bridgeable Gap (skill + seed suggestion) and the candidate's
 * positioning context, returns a polished draft achievement (title +
 * description + metric placeholder) the user can edit and save.
 *
 * The draft is explicitly marked as "draft / unverified" in the UI — we
 * never auto-save a fabricated achievement. The user reviews, edits the
 * placeholder metric, and clicks save.
 */
import type { PositioningStatement } from '../positioningStatement';

export function ACHIEVEMENT_DRAFT_PROMPT(params: {
    skill: string;
    suggestion: string;
    positioningStatement: PositioningStatement | null;
    jobRole: string;
    jobCompany: string;
}): string {
    const { skill, suggestion, positioningStatement, jobRole, jobCompany } = params;

    const positioningBlock = positioningStatement
        ? `CANDIDATE POSITIONING (use this to ground the draft in their actual experience):
  ${positioningStatement.raw}
`
        : 'CANDIDATE POSITIONING: not available — keep the draft general enough that the user can paste their own context.';

    return `You are helping an Australian job seeker turn a Bridgeable Gap into a real achievement. They likely have this experience based on their role and seniority. Your job is to draft an achievement they can lift verbatim into their profile after light editing.

═══ INPUTS ═══

${positioningBlock}

TARGET ROLE: ${jobRole} at ${jobCompany}

SKILL THE JOB REQUIRES (and the candidate likely has): ${skill}

INITIAL SUGGESTION (from the upstream analysis): "${suggestion}"

═══ OUTPUT ═══

Return STRICT JSON, no preamble, no markdown fences:

{
  "title": "<short achievement title, 4-8 words>",
  "description": "<single first-person sentence describing what the candidate did, in their voice; 18-32 words; do not invent metrics — use a placeholder like '[X%]' or '[N people]' or omit the metric entirely>",
  "metricPlaceholder": "<a one-line hint about what metric would prove this achievement, e.g. '% process time saved' or '# stakeholders coordinated'>"
}

═══ RULES ═══

- First person. "I led", "I drove", "I coordinated" — not "Led" or "The candidate led".
- Action verb at the start of the description.
- Do NOT fabricate specific numbers, dollar amounts, or company names. If a metric belongs, use a placeholder like "[X%]" so the user knows to fill it in.
- Keep it grounded. If the positioning says "Senior Financial Analyst, 7 years in banking", don't suggest a "ran a 50-person team" achievement.
- No em dashes (—) anywhere. Use periods, commas, or colons.
- Match the user's likely register. Australian English: organisation, programme, behaviour, recognise.
- Output only the JSON object.
`;
}
