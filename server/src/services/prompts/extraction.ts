export const STAGE_1_PROMPT = (text: string) => `
You are a expert Career Coach and Data Extraction Engine.
Your goal is 100% data density and providing helpful coaching hints to candidates.

Extract EVERY piece of information into the structured JSON format below.
Compare extracted data against the "Standard Resume Standards" (Reverse chronological, metrics needed, no personal ID).

Specific Instructions:
1. VOLUNTEERING: Extract any community work or student societies (valued as strategic assets).
2. CERTIFICATIONS: Separate professional credentials from formal education.
3. LANGUAGES: Extract all languages and proficiency levels.
4. COACHING ALERTS: Identify missing or weak data.
   - RED: Missing mandatory info (e.g., Year in Education, Contact info).
   - ORANGE: Content needs improvement (e.g., Bullet point without a metric, generic "team player" clichés).

Schema:
{
  "profile": {
    "name": "Full Name",
    "email": "Email Address",
    "phone": "Phone Number",
    "linkedin": "LinkedIn URL",
    "location": "Suburb, State",
    "professionalSummary": "3-4 sentences implied third person"
  },
  "skills": {
    "technical": ["Excel", "Python"],
    "industryKnowledge": ["Financial Modelling"],
    "softSkills": ["Stakeholder Engagement"]
  },
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or Present",
      "bullets": ["Point 1", "Point 2"],
      "coachingTips": ["Tip on how to add a metric here"]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Degree Name",
      "year": "YYYY",
      "coachingTips": "Missing year? Mention it here."
    }
  ],
  "volunteering": [{ "org": "", "role": "", "desc": "" }],
  "certifications": [{ "name": "", "issuer": "", "year": "" }],
  "languages": [{ "name": "", "proficiency": "" }],
  "coachingAlerts": [
    { "type": "MISSING_METRIC", "field": "experience[0].bullets[0]", "message": "Add a % or $ result to show impact.", "color": "orange" }
  ]
}

Resume Text:
"""
${text}
"""
`;

export const STAGE_2_PROMPT = (role: string, company: string, bullets: string[]) => `
Review the following resume bullet points for the role of "${role}" at "${company}".
Identify which points represent "Achievements" with measurable impact, leadership, or significant projects.

For each achievement, extract:
1. Title: A short, punchy summary.
2. Description: The full original bullet or a slightly polished version.
3. Metric: Exact numbers, percentages, or scale.
4. Metric Type: Categorize as "Revenue", "Efficiency", "Scale", "Team", "Technical", or "Cost".
5. Industry: Identify the specific industry (e.g., "SaaS", "Construction", "Government", "FinTech").
6. Skills/Tags: Relevant technical and soft skills.

Return a JSON array of objects.

JSON Schema:
{
  "achievements": [
    {
      "title": "Short title",
      "description": "Full bullet content",
      "metric": "Number/Percentage",
      "metricType": "Revenue|Efficiency|Scale|Team|Technical|Cost",
      "industry": "Industry context",
      "skills": ["skill1", "skill2"],
      "tags": ["tag1", "tag2"]
    }
  ]
}

IMPORTANT: Every achievement MUST have a 'title' and 'description'.

Bullets to analyze:
${JSON.stringify(bullets, null, 2)}
`;
