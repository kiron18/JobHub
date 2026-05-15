export const STAGE_1_PROMPT = (text: string) => `
You are an expert Career Coach and Data Extraction Engine.
Your goal is 100% data density — extract EVERY piece of information into the structured JSON format below.

Specific Instructions:
1. EXPERIENCE: Paid or unpaid work roles only. Do NOT include academic projects here.
2. PROJECTS: Extract ALL projects — academic, personal, freelance, open source, university capstone. These are first-class items. Use the institution or organisation name as "org". If no org, use "Personal Project" or "University Project".
3. VOLUNTEERING: Community work, student societies, extracurriculars.
4. CERTIFICATIONS: Professional credentials and short courses only — not degrees.
5. LANGUAGES: All languages and proficiency levels.
6. COACHING ALERTS:
   - RED: Missing mandatory info (e.g., contact email, degree year).
   - ORANGE: Weak content (e.g., bullet without a metric, vague descriptions like "assisted with tasks").

Schema:
{
  "profile": {
    "name": "Full Name",
    "email": "Email Address",
    "phone": "Phone Number",
    "linkedin": "LinkedIn URL",
    "location": "Suburb, State",
    "professionalSummary": "4-6 sentences, 300 to 600 characters total, in first person, present tense. Sentence 1: lead with role + seniority anchored by ONE concrete proof point pulled from their resume (a number, %, $, scale, headcount, or timeframe). Sentences 2-4: core strengths and specific work they have delivered (named outcomes, not vague duties). Final sentence: what they are aiming at next. Never write 'they', 'he', 'she', and never use the candidate's name within the summary itself. Examples: 'I am a Marketing Coordinator with 3 years scaling content programs that grew engagement 40% year on year at a Sydney agency. I specialise in performance marketing and audience segmentation, with hands-on experience running paid campaigns across LinkedIn and Meta. Most recently I led a content rebuild that lifted organic traffic 2.3x in six months. I am now targeting marketing analyst and growth roles where I can pair creative work with measurable outcomes.'. Always speak AS the candidate, not ABOUT them. Plain prose only, no bullets, no headings, no em dashes."
  },
  "skills": {
    "technical": ["Python", "Flask"],
    "industryKnowledge": ["Cybersecurity", "Machine Learning"],
    "softSkills": ["Stakeholder Engagement"]
  },
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or present",
      "bullets": ["Point 1", "Point 2"],
      "coachingTips": ["Add a metric to bullet 1"]
    }
  ],
  "projects": [
    {
      "org": "University or Organisation Name (or 'Personal Project')",
      "title": "Project Title",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or present",
      "bullets": ["What was built", "What was achieved", "Technologies used"],
      "skills": ["Python", "Machine Learning"],
      "coachingTips": ["Quantify the outcome — e.g. model accuracy achieved"]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Degree Name",
      "field": "Field of Study",
      "startDate": "YYYY",
      "endDate": "YYYY or present",
      "coachingTips": "Missing graduation year? Add it."
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
