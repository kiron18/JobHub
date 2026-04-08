export const JOB_ANALYSIS_PROMPT = (
  jd: string,
  profile: any,
  topAchievements: string,
  identityCards: Array<{ label: string; summary: string }>
): string => `
Act as an expert Australian recruitment consultant comparing a candidate to a Job Description (JD).

USER PROFILE:
${profile.professionalSummary}
Top Skills: ${profile.skills.technical.join(', ')}

CANDIDATE IDENTITY CARDS:
${identityCards.length > 0
  ? identityCards.map((c, i) => `${i + 1}. ${c.label}: ${c.summary}`).join('\n')
  : 'Not yet derived — assess without identity context.'}

TOP RELEVANT ACHIEVEMENTS (from bank):
${topAchievements}

JOB DESCRIPTION:
${jd}

---
TASK:
1. Extract the company name and job role title from the JD.
2. Extract 10-15 key skills/keywords from the JD.
3. Identify the "Tonal Profile" of the JD (e.g., "Corporate & Formal", "Fast-Paced Tech", "Direct & Service-Oriented", "Academic/Research").
4. Identify 3-5 "Core Competencies" the JD emphasises most.
5. Rank the provided achievements by relevance to this JD.
6. Score each of the 10 dimensions (integer 1–5) and write a one-sentence note explaining the score. Be honest — do not inflate.
7. Identify which identity card label best matches this role, or null if none fit.
8. Detect Australian-specific signals from the JD.
9. Set requiresSelectionCriteria to true ONLY if the JD explicitly contains: "Selection Criteria", "Key Selection Criteria", "KSC", "Statement of Claims", or "Capability Statements".

---
DIMENSION SCORING GUIDE (score 1–5, integer only):
- roleMatch: Does this job function match what the candidate does?
- skillsAlignment: Do the hard skills in the JD match the candidate's proven skills?
- seniorityFit: Does the level match? Map APS1–6, EL1–2, SES bands if applicable.
- compensation: Does the expected AU salary/TRP align with this candidate's market value?
- interviewLikelihood: Probability of callback. Government SC roles: reduce slightly (longer pipeline).
- geographicFit: Does location/remote policy work? Key AU markets: Sydney, Melbourne, Brisbane, Perth, Adelaide, Canberra.
- companyStage: Does company type (startup/sme/enterprise/government/university/nfp) suit this candidate's background?
- marketFit: Is the company/sector growing or declining in the Australian market?
- growthTrajectory: Does this role offer genuine career progression?
- timelineAlignment: Does hiring urgency match candidate availability?

---
CONSTRAINTS:
- Return ONLY valid JSON. No preamble, no markdown fences.
- All dimension scores must be integers 1–5.
- Australian English spelling throughout.

OUTPUT SCHEMA:
{
  "matchScore": number,
  "keywords": string[],
  "analysisTone": string,
  "requiresSelectionCriteria": boolean,
  "coreCompetencies": string[],
  "extractedMetadata": {
    "company": string,
    "role": string
  },
  "rankedAchievements": [
    {
      "id": "achievementId",
      "relevanceScore": number,
      "reason": "1-sentence reason why this achievement proves fit for this JD"
    }
  ],
  "dimensions": {
    "roleMatch":           { "score": number, "note": string },
    "skillsAlignment":     { "score": number, "note": string },
    "seniorityFit":        { "score": number, "note": string },
    "compensation":        { "score": number, "note": string },
    "interviewLikelihood": { "score": number, "note": string },
    "geographicFit":       { "score": number, "note": string },
    "companyStage":        { "score": number, "note": string },
    "marketFit":           { "score": number, "note": string },
    "growthTrajectory":    { "score": number, "note": string },
    "timelineAlignment":   { "score": number, "note": string }
  },
  "matchedIdentityCard": string | null,
  "australianFlags": {
    "apsLevel": string | null,
    "requiresCitizenship": boolean,
    "securityClearanceRequired": "none" | "baseline" | "nv1" | "nv2" | "pv",
    "salaryType": "base" | "trp" | "unknown"
  }
}

You must respond with valid JSON only.
`;
