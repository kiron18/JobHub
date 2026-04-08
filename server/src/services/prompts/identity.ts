export interface IdentityCard {
  label: string;
  summary: string;
  keyStrengths: string[];
  tone: string;
  achievementThemes: string[];
}

export const IDENTITY_DERIVATION_PROMPT = (
  profile: {
    name: string | null;
    professionalSummary: string | null;
    targetRole: string | null;
    targetCity: string | null;
    seniority: string | null;
    industry: string | null;
    perceivedBlocker: string | null;
  },
  experiences: Array<{ company: string; role: string; startDate: string; endDate: string | null }>,
  achievements: Array<{ title: string; description: string; metric: string | null; skills: string | null }>,
  coverLetterSamples: string[]
): string => `
You are a career identity analyst. Based on a candidate's profile data, derive 2–3 professional identity cards that capture who this person authentically is as a professional — based on evidence, not aspiration.

An identity card is NOT a job title. It is a pattern: how this person consistently creates value, what types of problems they solve, and their natural professional language.

CANDIDATE PROFILE:
Name: ${profile.name || 'Unknown'}
Professional Summary: ${profile.professionalSummary || 'Not provided'}
Target Role: ${profile.targetRole || 'Not specified'}
Seniority: ${profile.seniority || 'Not specified'}
Industry: ${profile.industry || 'Not specified'}

WORK HISTORY:
${experiences.map(e => `- ${e.role} at ${e.company} (${e.startDate}–${e.endDate || 'present'})`).join('\n') || 'Not provided'}

ACHIEVEMENTS (sample):
${achievements.slice(0, 20).map(a => `- ${a.title}: ${a.description}${a.metric ? ` (${a.metric})` : ''}${a.skills ? ` [${a.skills}]` : ''}`).join('\n') || 'No achievements yet'}

${coverLetterSamples.length > 0 ? `COVER LETTER SAMPLES (tone analysis):
${coverLetterSamples.map((cl, i) => `--- Sample ${i + 1} ---\n${cl.slice(0, 800)}`).join('\n\n')}` : ''}

---
TASK:
Derive 2–3 identity cards based strictly on evidence from the data above.

Rules:
- Each card must be distinct — different facets of who this person is.
- If fewer than 5 achievements exist, return only 1 card and note limited evidence in the summary.
- Labels must be specific (NOT "Experienced Professional" or "Results-Driven Leader").
- Australian English spelling throughout.
- Do NOT invent patterns not evidenced by the data.

Return ONLY valid JSON. No preamble.

{
  "identityCards": [
    {
      "label": "3-6 word descriptive label",
      "summary": "2-3 sentences. Who they are, what they do, how they do it. Evidence-grounded.",
      "keyStrengths": ["strength1", "strength2", "strength3"],
      "tone": "How they naturally write and speak — e.g. 'direct, metric-heavy, systems-thinking'",
      "achievementThemes": ["theme1", "theme2", "theme3"]
    }
  ]
}
`;
