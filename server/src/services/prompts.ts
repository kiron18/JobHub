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

---
CONSTRAINTS:
- Return ONLY valid JSON. 
- No preamble, no conversational text.

OUTPUT SCHEMA:
{
  "matchScore": number,
  "keywords": string[],
  "analysisTone": string,
  "requiresSelectionCriteria": boolean (true if the JD explicitly asks for a standalone selection criteria document or 'Selection Criteria' responses),
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

export const DOCUMENT_GENERATION_PROMPT = (
    type: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE', 
    jd: string, 
    profile: any, 
    selectedAchievements: any[], 
    ruleBase: string,
    analysisContext?: { tone?: string, competencies?: string[] }
) => `
You are a career coach generating a ${type}.

CRITICAL RULES FOR ${type}:
${ruleBase}

TONAL DIRECTION:
${analysisContext?.tone ? `Mirror this style: ${analysisContext.tone}` : "Professional, direct English."}

CORE FOCUS AREAS (Prioritize these):
${analysisContext?.competencies?.map(c => `- ${c}`).join('\n') || "Map candidate strengths to JD requirements."}

CANDIDATE DATA:
Name: ${profile.name}
Contact (use | as separator on one line): ${[profile.email, profile.phone, profile.linkedin, profile.location].filter(Boolean).join(' | ')}
Professional Summary: ${profile.professionalSummary}
Skills: ${JSON.stringify(profile.skills)}
Experience: ${JSON.stringify(profile.experience || [])}
Education: ${JSON.stringify(profile.education || [])}
Certifications: ${JSON.stringify(profile.certifications || [])}
Volunteering: ${JSON.stringify(profile.volunteering || [])}
Languages: ${JSON.stringify(profile.languages || [])}

SELECTED ACHIEVEMENTS (Use ONLY these for evidence):
${selectedAchievements.length > 0 
    ? selectedAchievements.map(a => `- [${a.title}] ${a.description} (Metric: ${a.metric})`).join('\n')
    : "No specific achievements selected. Focus on general skills and background if possible, or use placeholders."}

JOB DESCRIPTION:
${jd}

---
TASK:
Generate the ${type} as high-impact Markdown.
1. Use standard English (e.g., "organized", "analyzed").
   HEADER BLOCK (resume only — no "## Header" label, just these 3 lines):
   Line 1: Candidate full name (e.g. # John Smith)
   Line 2: Target Job Title from JD | Industry (e.g. *Senior Product Manager | FinTech*)
   Line 3: contact details separated by | (e.g. john@email.com | 0400 000 000 | linkedin.com/in/john | Sydney, NSW, Australia)
2. CONTENT GAP HANDLING: If you need a specific piece of information from the candidate that is NOT in the data above, YOU MUST insert a "Missing Flag".
   - Format: [MISSING: clear description of what is needed]
3. Map achievements specifically to the "Impact" the JD asks for. Do NOT just list achievements; synthesize them into the narrative.
4. For Cover Letters: Focus heavily on the "Why this role" and "Why this company" mapping. Include placeholders at the top for contact details if missing.
5. Standardized Formatting (RESUME only — ignore for COVER_LETTER):
   - ${type === 'COVER_LETTER' ? 'Do NOT use headers or subheadings.' : `Use ## for main section headers EXCEPT the header block — the name/title/contact block at the top has NO heading label. Never output the word "Header" or "## Header".`}
   - Use - for bullet points.
   - SKILLS SECTION: Format each sub-category as a single horizontal line, not a vertical list.
     Example: **Technical Skills:** Python • Excel • SQL • Tableau
     Example: **Industry Knowledge:** Financial Modelling • Regulatory Compliance • Agile
     Example: **Languages:** English (Professional) • Mandarin (Native)
     Example: **Soft Skills:** Stakeholder Engagement • Data Storytelling • Cross-cultural Communication
   - OMIT any section entirely if the candidate has no data for it. Never output an empty section or a section with placeholder text.
   - Minimise vertical whitespace — the goal is 1–2 pages. Do not add blank lines between bullets.

CONSTRAINTS:
- Do NOT use bold ** within bullet points unless highlighting a metric.
- Do NOT include any meta-talk or pleasantries (e.g., "Here is your resume...").
- Output ONLY the Markdown content.
`;
