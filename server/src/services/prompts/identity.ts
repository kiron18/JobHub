export interface IdentityCard {
  label: string;
  summary: string;
  keyStrengths: string[];
  tone: string;
  achievementThemes: string[];
  evidenceBasis: 'full' | 'limited';
}

export const IDENTITY_DERIVATION_PROMPT = (
  profile: {
    name: string | null;
    professionalSummary: string | null;
    targetRole: string | null;
    seniority: string | null;
    industry: string | null;
    perceivedBlocker: string | null;
  },
  experiences: Array<{ company: string; role: string; startDate: string; endDate: string | null; type?: string }>,
  achievements: Array<{ title: string; description: string; metric: string | null; skills: string | null }>,
  coverLetterSamples: string[]
): string => `
You are a recruiter and career strategist. Your job is to identify the 2–3 real job titles this candidate should be applying for right now, based strictly on their evidence — not aspiration, not generic patterns.

CANDIDATE PROFILE:
Name: ${profile.name || 'Unknown'}
Professional Summary: ${profile.professionalSummary || 'Not provided'}
Target Role: ${profile.targetRole || 'Not specified'}
Seniority: ${profile.seniority || 'Not specified'}
Industry: ${profile.industry || 'Not specified'}
${profile.perceivedBlocker ? `Perceived Career Blocker: ${profile.perceivedBlocker}` : ''}

WORK & PROJECT HISTORY (most recent first):
${experiences.map(e => `- [${e.type === 'project' ? 'PROJECT' : 'WORK'}] ${e.role} at ${e.company} (${e.startDate}–${e.endDate || 'present'})`).join('\n') || 'Not provided'}

ACHIEVEMENTS (sample):
${achievements.slice(0, 20).map(a => `- ${a.title}: ${a.description}${a.metric ? ` (${a.metric})` : ''}${a.skills ? ` [${a.skills}]` : ''}`).join('\n') || 'No achievements yet'}

${coverLetterSamples.length > 0 ? `COVER LETTER SAMPLES:
${coverLetterSamples.map((cl, i) => `--- Sample ${i + 1} ---\n${cl.slice(0, 800)}`).join('\n\n')}` : ''}

---
TASK:
Identify 2–3 specific, hireable job titles this person should be targeting based on the evidence above.

Rules:
- The label MUST be a real job title that appears in job listings — e.g. "Graduate Cybersecurity Analyst", "AI/ML Engineer", "Junior Penetration Tester", "Product Manager". NOT "Problem Solver", NOT "Technical Leader", NOT any abstract pattern or archetype.
- Weight the target role they declared and their most recent/technical work most heavily. A part-time or unrelated job (e.g. hospitality, retail) should not generate a separate title unless that is their clear primary career track.
- Each title must be distinct — different roles, not synonyms.
- The summary explains in 2 sentences WHY their background is a credible fit for this specific title, citing actual experience or projects.
- keyStrengths are the specific skills from their CV most relevant to THIS title.
- If fewer than 5 achievements exist, return only 1 card and set evidenceBasis to 'limited'. Otherwise set evidenceBasis to 'full'.
- Australian English spelling throughout.
- Do NOT invent experience not evidenced by the data.

Return ONLY valid JSON. No preamble.

{
  "identityCards": [
    {
      "label": "Real job title — e.g. Graduate Cybersecurity Analyst",
      "summary": "2 sentences. Why their background is a credible fit for this title. Cite specific evidence.",
      "keyStrengths": ["skill1", "skill2", "skill3"],
      "tone": "How they naturally write and speak — e.g. 'direct, metric-heavy, systems-thinking'",
      "achievementThemes": ["theme1", "theme2", "theme3"],
      "evidenceBasis": "full | limited"
    }
  ]
}
`;
