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
}): string {
    const { docType, content, jobDescription, positioningStatement } = params;

    const docTypeLabel =
        docType === 'cover-letter' ? 'Cover Letter' :
        docType === 'selection-criteria' ? 'Selection Criteria responses' :
        'Resume';

    const positioningBlock = positioningStatement
        ? `CANDIDATE POSITIONING (use this to check coherence — claims in the draft should be consistent with this shape):
  ${positioningStatement.raw}
`
        : 'CANDIDATE POSITIONING: not available — score coherence against the document itself only.';

    const jdBlock = jobDescription && jobDescription.trim().length > 50
        ? `TARGET JOB DESCRIPTION:
"""
${jobDescription.trim()}
"""
`
        : 'TARGET JOB DESCRIPTION: not provided — critique against general Australian-market recruiter expectations.';

    return `You are a senior career strategist auditing a candidate's ${docTypeLabel} BEFORE they send it. The candidate is an international graduate job-hunting in Australia. Your job is to surface the specific failure modes that get applications screened out by recruiters, the things automated generation misses.

DO NOT rewrite the document. DO NOT suggest stylistic polish. Catch the failure modes below, with concrete quoted snippets.

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

═══ INPUTS ═══

${positioningBlock}

${jdBlock}

DOCUMENT (${docTypeLabel}):
"""
${content}
"""

═══ OUTPUT ═══

Return STRICT JSON, no markdown fences, no preamble:

{
  "overall": {
    "verdict": "<one short sentence — calm, evidence-led, no panic words. Examples: 'Solid draft, two specific tightens will lift it.' / 'Strong frame, one weak opening line to fix.' />",
    "trustScore": <integer 0-100 — how a recruiter would read this for trust, not polish>
  },
  "issues": [
    {
      "category": "desperation" | "overselling" | "hedging" | "vagueness" | "weak_opening" | "incoherence" | "generic_positioning",
      "severity": "high" | "medium" | "low",
      "snippet": "<the exact short phrase from the document, quoted>",
      "why": "<one sentence: why this signal hurts recruiter trust>",
      "fix": "<one sentence: how the candidate could rewrite it. Be specific. No platitudes.>"
    }
  ],
  "strengths": [
    "<one sentence per strength — what the draft does WELL. 1-3 entries. Honest, not flattery. Skip this array if there are no genuine strengths.>"
  ]
}

═══ RULES ═══

- ONLY flag actual instances. If the document doesn't oversell, return an empty issues array on that category. Do NOT invent issues to fill the list.
- Maximum 6 issues total. Lead with the highest-severity ones.
- Quote the exact phrase. Single sentence excerpts. Do not paraphrase.
- "fix" must be specific, not generic. "Replace with a number" is bad; "Replace 'helped with marketing campaigns' with 'Led the rollout of X to N audiences, delivering Y%' is good (use placeholders if metrics not visible).
- Strengths: 1-3 entries max. Only genuine strengths. No empty pleasantries.
- No em dashes (—) in any output string. Use periods, commas, or colons.
- Australian English in your prose: organisation, programme, behaviour.
- Output ONLY the JSON object. Nothing else.
`;
}
