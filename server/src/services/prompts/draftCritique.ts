/**
 * Draft critique prompt — reads a generated document back and flags the
 * specific human-readable failure modes that AI generators tend to miss:
 * desperation, overselling, hedging, vagueness, weak openings, narrative
 * incoherence. Returns structured JSON the frontend renders as a quiet
 * review panel.
 *
 * Built around a Strategy-Hub-aligned framing rule: the system does what
 * AI alone can't. Generation produces a draft; critique audits it for
 * trust signals a recruiter actually screens against.
 */

import type { PositioningStatement } from '../positioningStatement';

export function DRAFT_CRITIQUE_PROMPT(params: {
    docType: 'resume' | 'cover-letter' | 'selection-criteria';
    content: string;
    jobDescription?: string | null;
    positioningStatement: PositioningStatement | null;
    resumeText?: string | null;
}): string {
    const { docType, content, jobDescription, positioningStatement, resumeText } = params;

    const docTypeLabel =
        docType === 'cover-letter' ? 'Cover Letter' :
        docType === 'selection-criteria' ? 'Selection Criteria responses' :
        'Resume';

    const positioningBlock = positioningStatement
        ? `CANDIDATE POSITIONING (use this to check coherence — claims in the draft should be consistent with this shape):
  ${positioningStatement.raw}
`
        : 'CANDIDATE POSITIONING: not available — judge coherence against the document itself only.';

    const jdBlock = jobDescription && jobDescription.trim().length > 50
        ? `TARGET JOB DESCRIPTION:
"""
${jobDescription.trim()}
"""
`
        : 'TARGET JOB DESCRIPTION: not provided — critique against general Australian-market recruiter expectations.';

    const resumeBlock = resumeText && resumeText.trim().length > 100
        ? `THE CANDIDATE'S SOURCE RESUME (ground truth for what they have actually done — use it for failure mode 8):
"""
${resumeText.trim()}
"""
`
        : 'SOURCE RESUME: not available — skip failure mode 8 entirely.';

    return `You are a senior career strategist glancing over a candidate's ${docTypeLabel} before they send it. The candidate is an international graduate job-hunting in Australia. Offer at most two suggestions they can take or leave.

DO NOT rewrite the document. DO NOT suggest stylistic polish. DO NOT score or grade it. Pick the two most useful observations from the failure modes below, with concrete quoted snippets, and stop there.

═══ FAILURE MODES TO AUDIT ═══

1. DESPERATION SIGNALS
   Phrases like "any opportunity", "willing to learn anything", "open to relocate anywhere", "I'm passionate about everything", "please give me a chance". Recruiter-trust killers.

2. OVERSELLING WITHOUT EVIDENCE
   Empty superlatives: "world-class", "best-in-class", "rockstar", "ninja", "10x", "results-driven", "passionate professional", "highly motivated". These read as imported jargon, never as proof.

3. HEDGING / LACK OF OWNERSHIP
   "helped with", "assisted in", "involved in", "contributed to", "was part of a team that". The candidate is hiding their actual contribution.

4. VAGUENESS
   "various", "many", "multiple", "a number of", "several", "etc." without specifics. Numbers and named entities replace these.

5. WEAK OPENINGS (cover letters specifically)
   "I am writing to apply for...", "Please find attached...", "My name is...", or any opener that wastes the first sentence on logistics. The first sentence is real estate.

6. NARRATIVE INCOHERENCE
   Claims that don't match the candidate's positioning. Seniority claims with insufficient years. Generic "passionate about [industry]" with no track record in that industry. Career jumps left unexplained.

7. GENERIC POSITIONING
   "I'm a passionate marketing professional who thrives in fast-paced environments." Means nothing. Should be replaced with a specific positioning anchored in role + seniority + domain + proof point.

8. INFLATION BEYOND THE RESUME (highest value — check this one hardest)
   Claims of capability, seniority, or experience that the source resume does not strictly support. This is NOT about fabricated facts (names and numbers are checked elsewhere). It is about honest facts stretched into dishonest capability: "overseeing client engagements is familiar ground" when the resume shows reporting to stakeholders, not overseeing anything; "fluent in how these systems are built" backed by one online course; job-description vocabulary mirrored back as the candidate's own experience. For each: quote the claim, name what the resume actually supports, and give the honest phrasing that survives an interviewer probing it. An interview is where these claims get cross-examined — flag anything the candidate could not defend for two minutes.

═══ INPUTS ═══

${positioningBlock}

${jdBlock}

${resumeBlock}

DOCUMENT (${docTypeLabel}):
"""
${content}
"""

═══ OUTPUT ═══

Return STRICT JSON, no markdown fences, no preamble:

{
  "issues": [
    {
      "category": "desperation" | "overselling" | "hedging" | "vagueness" | "weak_opening" | "incoherence" | "generic_positioning" | "inflation",
      "snippet": "<the exact short phrase from the document, quoted>",
      "why": "<one sentence: why this signal hurts recruiter trust>",
      "fix": "<one sentence: how the candidate could rewrite it. Be specific. No platitudes.>"
    }
  ]
}

═══ RULES ═══

- AT MOST 2 issues. Not 3, not 6. Pick the two that would most change how a
  recruiter reads this document, and say nothing about the rest. A short,
  ignorable note is the point; a long audit is not.
- If the document is genuinely fine, return an empty issues array. An empty
  array is a perfectly good answer. Do NOT invent issues to fill the list.
- Do NOT grade, score, rank, or rate the document. No numbers, no percentages,
  no letter grades, no "out of 10" anywhere in your output. These are
  suggestions the candidate is free to ignore, not an assessment.
- "inflation" outranks every other category — a recruiter forgives a vague
  phrase, an interviewer never forgives a claim that collapses under
  questioning. Reframing, reordering, and tailoring to the job are NOT
  inflation; only flag claims the resume cannot support at all.
- Quote the exact phrase. Single sentence excerpts. Do not paraphrase.
- "fix" must be specific, not generic. "Replace with a number" is bad; "Replace 'helped with marketing campaigns' with 'Led the rollout of X to N audiences, delivering Y%' is good (use placeholders if metrics not visible).
- Strengths: 1-3 entries max. Only genuine strengths. No empty pleasantries.
- No em dashes (—) in any output string. Use periods, commas, or colons.
- Australian English in your prose: organisation, programme, behaviour.
- AUSTRALIAN RESUME CONVENTION (absolute): a referees section, or the line "References available on request", is standard and expected on an Australian resume. NEVER advise removing, deleting, shortening, or replacing the referees or references section, and never call it outdated, filler, or unnecessary. This is correct local practice, not a flaw.
- Output ONLY the JSON object. Nothing else.
`;
}
