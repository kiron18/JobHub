/**
 * Dual-Signal analysis prompt — Floor (Positioning Statement) + Ceiling
 * (Achievement Bank) + Translatable Skill Mapping.
 *
 * Returns structured JSON the route serialises into the new AnalysisResult
 * shape: { directMatch, bridgeableGap, hardGap, insights, extractedMetadata }.
 *
 * Design rule: the model is a coach, not a filter. Even a Hard Gap result
 * gives the user a continue-anyway path; the model never *blocks*.
 */

import type { PositioningStatement } from '../positioningStatement';
import type { HardGapItem } from '../../data/hardGapKeywords';

interface AchievementLite {
    id: string;
    title: string | null;
    description: string | null;
    metric: string | null;
}

export function DUAL_SIGNAL_PROMPT(params: {
    jobDescription: string;
    positioningStatement: PositioningStatement | null;
    achievements: AchievementLite[];
    hardGapHints: HardGapItem[];
}): string {
    const { jobDescription, positioningStatement, achievements, hardGapHints } = params;

    const positioningSection = positioningStatement
        ? `
POSITIONING STATEMENT (the FLOOR — what the candidate is capable of based on role/experience shape, even when no achievement names it):

  ${positioningStatement.raw}

  Components:
    Title:     ${positioningStatement.components.title}
    Seniority: ${positioningStatement.components.seniority}
    Years:     ${positioningStatement.components.years}
    Domain:    ${positioningStatement.components.domain}
    Education: ${positioningStatement.components.education}
`
        : `
POSITIONING STATEMENT: not available (candidate has limited work history). Use only achievements to assess fit; do NOT infer capabilities beyond what achievements explicitly claim.
`;

    const achievementsBlock = achievements.length
        ? achievements
              .map(
                  (a, i) => `  ${i + 1}. ${a.title ?? '(untitled)'}
     ${a.description ?? '(no description)'}${a.metric && a.metric !== 'qualitative' ? `\n     Metric: ${a.metric}` : ''}`,
              )
              .join('\n')
        : '  (none — candidate has not logged any achievements yet)';

    const hardGapHintsBlock = hardGapHints.length
        ? hardGapHints.map((h) => `  • ${h.label} (category: ${h.category})`).join('\n')
        : '  (no hard-gap keywords detected in the JD)';

    return `You are a calm, evidence-led career coach for international graduates job-hunting in Australia. Analyse the role below using DUAL-SIGNAL reasoning, then return strict JSON.

═══ THE TWO SIGNALS ═══

1) FLOOR — Positioning Statement
   Tells you what the candidate is capable of based on their role title, seniority, years of experience, industry, and education. Even when no achievement explicitly names a skill, the Floor implies broad capabilities (e.g. a Senior Analyst with 7 years almost certainly has stakeholder management experience, even if the word doesn't appear in their achievements).

2) CEILING — Achievement Bank
   Tells you what the candidate has PROVED. Each achievement is evidence of a specific outcome the candidate delivered. The Achievement Bank is what distinguishes this candidate from others with similar resumes.

═══ TRANSLATABLE SKILL MAPPING (critical rule) ═══

For every requirement in the JD, decide which bucket it goes into:

  DIRECT MATCH    — An achievement explicitly demonstrates this skill.
  BRIDGEABLE GAP  — No achievement names this skill, BUT the Positioning Statement strongly implies the candidate has the experience. The fix is to draft a new achievement that names the skill in their own words.
  HARD GAP        — A formal credential, licence, clearance, or visa status that cannot be inferred from experience. The candidate either has it or they don't.

Hard Gaps must be drawn from this whitelist (and ONLY from this whitelist) when the candidate hasn't claimed them on their profile:

${hardGapHintsBlock}

If a JD requires something not in the whitelist above — assume it is BRIDGEABLE. Never invent a Hard Gap (e.g. "stakeholder management" is NEVER a hard gap; "CPA qualification" can be).

═══ INPUTS ═══

${positioningSection}

ACHIEVEMENT BANK (the CEILING — what the candidate has proved):
${achievementsBlock}

JOB DESCRIPTION:
"""
${jobDescription}
"""

═══ OUTPUT ═══

Return STRICT JSON only — no preamble, no explanation, no markdown fences. Match this exact shape:

{
  "extractedMetadata": { "company": "<company name>", "role": "<role title>" },
  "directMatch": {
    "pct": <integer 0-100>,
    "evidence": ["<short statement>", "<short statement>", "<short statement>"]
  },
  "bridgeableGap": {
    "pct": <integer 0-100>,
    "items": [
      { "skill": "<JD requirement>", "suggestion": "<single-sentence draft achievement the candidate could write to claim this>" }
    ]
  },
  "hardGap": {
    "items": ["<hard-gap label from the whitelist>"]
  },
  "insights": [
    "<calm qualitative observation about the role or fit>",
    "<calm qualitative observation>",
    "<calm qualitative observation>"
  ]
}

═══ OUTPUT RULES ═══

- directMatch.pct + bridgeableGap.pct should approximately reflect the share of role requirements they cover; they need NOT sum to 100 because some Hard Gaps subtract from coverage.
- directMatch.evidence: 3 short statements referencing actual achievement content. Quote or paraphrase the candidate's own work. No vague claims.
- bridgeableGap.items: 1-5 entries. Each suggestion is a single sentence in first person ("Led the rollout of...") that the candidate could turn into a real achievement after light editing. Do not invent metrics — leave numbers blank with a placeholder like "[X]" if needed, or omit the metric entirely.
- hardGap.items: 0-3 entries from the whitelist labels above. Empty array if none apply.
- insights: 3 calm, useful observations. Things like "This role weighs influence over technical depth — lead with leadership wins", "Government roles like this reward selection-criteria detail", or "Your APAC industry experience is uncommon for this employer". No fabricated statistics. No exclamation marks. No "you've got this!" tone.
- Avoid em dashes (—) anywhere in your output. Use periods, commas, or colons instead.
- Output ONLY the JSON object. Nothing before, nothing after.
`;
}
