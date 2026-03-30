export const JOB_ANALYSIS_PROMPT = (jd: string, profile: any, topAchievements: string) => `
Act as a recruitment expert comparing a candidate to a Job Description (JD).

USER PROFILE SUMMARY:
${profile.professionalSummary}
Top Skills: ${profile.skills.technical.join(', ')}

TOP RELEVANT ACHIEVEMENTS (from bank):
${topAchievements}

JOB DESCRIPTION:
${jd}

---
TASK:
1. Extract the company name and job role title from the JD.
2. Extract 10-15 key skills/keywords from the JD.
3. Identify the "Tonal Profile" of the JD (e.g., "Corporate & Formal", "Fast-Paced Tech", "Direct & Service-Oriented", "Academic/Research").
4. Identify 3-5 "Core Competencies" the JD emphasizes most (beyond keywords, what are they actually looking for?).
5. Rank the provided achievements by relevance to this JD.
6. Calculate an overall match score (0-100).
7. Set requiresSelectionCriteria to true ONLY if the JD explicitly contains the words "Selection Criteria", "Key Selection Criteria", "KSC", "Statement of Claims", or "Capability Statements". Do NOT set to true for general competency questions or role requirement lists.

---
CONSTRAINTS:
- Return ONLY valid JSON.
- No preamble, no conversational text.

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
      "relevanceScore": number (0-100),
      "reason": "Specific 1-sentence reason why this achievement proves fit for the JD requirements"
    }
  ]
}

You must respond with valid JSON only.
`;
