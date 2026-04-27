# Standard Resume Rules — AI Engine Rule Base
*Scope: Resumes only | Market: Australian | Audience: Australian professionals and skilled migrants in Australia*
*Last Updated: March 2026*

> This document is the primary instruction set the AI Engine reads before generating any resume. Follow every rule in sequence. Do not infer, invent, or fill gaps with placeholder content — if candidate data is missing, flag it explicitly and request it.

---

## SECTION 0 — AI ENGINE BEHAVIOUR RULES

Before generating any output, the AI must:

1. **Read this entire file first.** No exceptions.
2. **Use only data the candidate has provided.** Never fabricate job titles, companies, metrics, or dates.
3. **Flag missing data** rather than filling gaps. Example: `[MISSING: quantified result for this bullet — ask candidate]`
4. **Apply standard English throughout.** See Section 6 for a reference list.
5. **Run an ATS keyword check** — extract the top 10–15 keywords from the provided job description and confirm they appear naturally in the resume before outputting.
6. **No visa status, work rights, nationality, or citizenship** anywhere on the resume. These belong in the cover letter only, and only if strategically necessary.
7. **Output must match the approved template structure exactly** — section order, heading names, and formatting conventions are non-negotiable unless a validated industry exception applies (see Section 7).

---

## SECTION 1 — DOCUMENT STRUCTURE & FORMATTING

### 1.1 Section Order (Fixed)
Generate sections in this exact sequence:
1. Header (Name, Title, Contact)
2. Professional Summary
3. Work Experience
4. Education *(omit entirely if no education data provided — do NOT write a heading or placeholder)*
5. Skills & Competencies
6. Certifications & Professional Development *(omit if empty)*
7. Volunteering & Community Involvement *(omit if empty)*
8. Referees

### 1.2 Length
- **Target: 1-2 pages.** Keep it concise and high-impact.
- Under 5 years experience: aim for a tight 1 page.
- Over 10 years experience: cap at 2 pages — ruthlessly prioritise the last 8–10 years.

### 1.3 Fonts & Visual Formatting
- Fonts: Arial, Calibri, or Roboto. Size 10–11pt for body, 12–14pt for name.
- No tables, text boxes, columns, or graphics — ATS parsers break on these.
- No icons, logos, or decorative elements.
- Consistent date formatting throughout: *Month YYYY — Month YYYY* (e.g., *Jan 2021 — Dec 2023*)
- Margins: 1.5–2cm on all sides.

### 1.4 File Format
- Output as `.docx` for editing, `.pdf` for submission — unless the employer explicitly requests `.docx`.

---

## SECTION 2 — HEADER

> **FORMATTING RULE:** The header block does NOT have a section heading. Do NOT output `## Header` or the word "Header" anywhere. The name/title/contact information appears directly at the top of the document with no label above it.

### 2.1 Required Fields
| Field | Format | Example |
|---|---|---|
| Name | Preferred first name + full last name | *Arjun Sharma* |
| Target Title | Matches the role being applied for | *Marketing Coordinator \| Digital & Content* |
| Email | Professional address | *arjun.sharma@gmail.com* |
| Phone | International/Local format | *+61 412 345 678* |
| LinkedIn | Shortened custom URL | *linkedin.com/in/arjunsharma* |
| Location | Suburb + State only | *Parramatta, NSW, Australia* |

### 2.2 Strictly Excluded
The following must **never** appear in the header or anywhere on the resume:
- Date of birth / age
- Photo
- Marital status / gender / religion
- Nationality, visa type, or work rights status
- Full street address

### 2.3 Name Guidance
If the candidate has a name that is difficult to pronounce in English, they may include a preferred Western name in parentheses — this is their choice, not a requirement. Do not suggest it unprompted.

---

## SECTION 3 — PROFESSIONAL SUMMARY

### 3.1 Structure
- **Length:** 3–4 sentences, 60–80 words. Hard maximum: 80 words. Count before outputting and trim if over.
- **Line 1:** Years of experience + core professional identity + industry/function.
- **Line 2:** One or two signature achievements with a metric if possible.
- **Line 3:** Value proposition — what the candidate brings to an employer in this specific role.
- **Line 4 (optional):** Career direction or the type of opportunity being targeted.

### 3.2 Rules
- Tailor to every job. This section must reflect the target job description's language.
- No clichés: banned phrases include *hardworking, team player, passionate, detail-oriented, results-driven* (unless followed immediately by evidence).
- Do not write in first person (*I am...* → write in third-person implied: *A marketing professional with...*)
- Must include at least one ATS keyword from the target job description.

### 3.3 Example Framework
*"[Core identity + years of experience] with a track record of [signature achievement with metric]. Brings [key capability] to [type of organisation or role]. Currently seeking [role type] where [value they will add]."*

---

## SECTION 4 — WORK EXPERIENCE

### 4.1 Format Per Role
```
[Job Title] | [Company Name], [Country]          [Start Month YYYY — End Month YYYY]
[City, Country]

• Bullet 1
• Bullet 2
• Bullet 3
```

- List roles in **reverse chronological order** — most recent first.
- Include roles from the last 10 years. For roles older than that, use a brief single-line entry or group them.
- For current roles: use *[Start Date] — Present*

### 4.2 Bullet Point Rules
Every bullet must be **outcome-first**. Structure:

```
[Result/number] + [action verb] + [method or context]
```

Not:
```
[Task description] + [vague result]
```

**Before generating each bullet, run this check:**
- Does it answer "So what?"
- Does it contain a number, percentage, or concrete scale indicator?
- Does it name what the candidate specifically did (not "we" or "the team")?

If any of these is No → rewrite the bullet or do not include it.

- Minimum one metric per bullet (%, $, headcount, timeframe, volume).
- If a metric is genuinely unavailable, use contextual scale: *"...across a team of 12"* or *"...serving 3,000+ customers"*.
- Maximum 3–5 bullets per role. Quality over quantity.
- Start every bullet with a different action verb. No repetition.
- Past tense for previous roles, present tense for current role.

**Banned bullet patterns (automatic rewrite):**
- "Responsible for managing..."
- "Assisted with..."
- "Helped to develop..."
- "Worked closely with the team to..."
- "Demonstrating my ability to..." (AI self-narration — never acceptable)
- "Highlighting my..." (same)
- "Showcasing my..." (same)
- "Ensuring alignment with..." (vague process language)
- Any bullet where "we" or "the team" is the agent of the result — rewrite to "I"

**Approved action verb bank (non-exhaustive):**
Grew, Reduced, Built, Launched, Managed, Increased, Cut, Generated, Led, Delivered, Optimised, Spearheaded, Orchestrated, Drove, Designed, Implemented, Secured, Negotiated, Streamlined, Developed, Trained, Mentored, Analysed, Scaled, Oversaw, Restructured, Coordinated, Produced

### 4.3 Overseas Experience
- Do not downplay international experience — it is globally valued.
- Add brief context for companies unknown to the reader: *(Top-10 FMCG company in India, ~8,000 employees)*
- State city and country clearly next to each role.

### 4.4 Employment Gaps
- Do not flag or explain gaps on the resume itself.
- If a gap includes freelance work, volunteer work, or study — list it as a legitimate entry.
- If there is no activity to list, leave the gap silent. It can be addressed in the cover letter or interview if raised.

---

## SECTION 5 — EDUCATION

### 5.1 Format Per Qualification
```
[Degree Name] — [Field of Study]                 [Year of Completion]
[University Name] — [City, Country]
[Optional: Relevant subjects, thesis, or GPA if strong]
```

### 5.2 Rules
- List **most recent qualification first**.
- Include GPA only if it is a Distinction average or above (typically ≥ 6.0/7.0 or ≥ 75%).
- For universities not widely known, add a brief credibility note in italics: *(Ranked Top-5 in [Country] — equivalent to a top-tier international university)*
- Do not list high school unless it is the candidate's only qualification.
- Do not list incomplete qualifications unless currently enrolled — in that case: *Expected [Year]*

---

## SECTION 6 — SKILLS & COMPETENCIES

### 6.1 Structure
Each sub-category is a **single horizontal line** — not a vertical list. This saves space and is ATS-friendly.

Format exactly as:
```
**Technical Skills:** Python • Excel (pivot tables, Power Query) • SQL • Tableau
**Industry Knowledge:** Financial Modelling • Regulatory Compliance • Agile/Scrum
**Languages:** English (Professional) • Hindi (Native) • French (Conversational)
**Soft Skills:** Stakeholder Engagement • Cross-cultural Communication • Data Storytelling
```

Rules:
- Use `•` as the separator between items on each line.
- Omit a sub-category line entirely if the candidate has no data for it.
- **Technical Skills:** Hard, role-specific tools and software (be specific — not *Microsoft Office* but *Excel: pivot tables, VLOOKUP, Power Query*).
- **Industry Knowledge:** Domain expertise relevant to the target role.
- **Languages:** Only include if data exists. List with proficiency level.
- **Soft Skills:** Maximum 3–4. Only list if the candidate can back it up with evidence.

### 6.2 ATS Alignment Rule
Cross-reference this section against the target job description. At least 60% of listed skills must directly mirror language from the job ad. Do not use synonyms where the job ad uses a specific term.

---

## SECTION 7 — ENGLISH SPELLING REFERENCE

Always apply **Australian English** spelling. This is non-negotiable for the Australian market.

| US English (incorrect) | Australian English (correct) |
|---|---|
| organized | organised |
| program | programme *(in academic/govt contexts)* |
| analyze | analyse |
| center | centre |
| labor | labour |
| color | colour |
| license (verb) | licence (noun), license (verb) |
| fulfill | fulfil |
| recognize | recognise |
| behavior | behaviour |
| traveling | travelling |
| skillful | skilful |

**Default is always Australian English.** Do not use US spelling under any circumstance.

---

## SECTION 8 — CERTIFICATIONS & PROFESSIONAL DEVELOPMENT

### 8.1 Format
```
[Certification Name] — [Issuing Body]            [Year]
[Course or Workshop] — [Platform]                [Year]
```

### 8.2 Rules
- Include only if relevant to the target role or demonstrating initiative.
- Recognised credentials: AWS, PMP, CPA, CFA, SHRM, Google (Analytics, Ads), Salesforce, Agile/Scrum certifications.
- Include sector-specific training where possible: industry workshops, professional association memberships.
- If this section is empty, omit it entirely — do not include a blank section.

---

## SECTION 9 — VOLUNTEERING & COMMUNITY INVOLVEMENT

### 9.1 Why This Matters
This section is a strategic asset. Many employers value community contribution and initiative. It also signals local engagement and cultural fit.

### 9.2 Format
```
[Role] — [Organisation], [City]                  [Year — Year]
• One line: what you did and the impact.
```

### 9.3 What Counts
- University student societies or clubs
- Industry mentoring programs
- Charity events or community organisations
- Sports coaching or officiating
- Cultural or religious community leadership (framed professionally)
- Any paid or unpaid work during a study period that isn't listed in Work Experience

If this section is empty, omit it — but flag it to the candidate as a gap worth addressing in real life, not just on paper.

---

## SECTION 10 — REFEREES

### 10.1 Standard Australian Format
- Two professional referees is the standard.
- Do not list referee names and contact details on the resume — write: *"Available upon request. Two professional referees prepared."*
- Encourage the candidate to have diverse referees (university lecturer, internship supervisor, or previous employer).

### 10.2 Coaching Note (Flag to Candidate)
Prompt the candidate to brief their referees on the role before submitting — referees who know the context give stronger, more relevant references.

---

## SECTION 11 — INDUSTRY-SPECIFIC EXCEPTIONS

The rules above apply across most industries. The following are exceptions where some markets may diverge meaningfully:

### 11.1 Academia & Research
- CV format is appropriate (can exceed 2 pages).
- Include: publications, conference presentations, grants, research projects.
- GPA is always relevant regardless of level.

### 11.2 Government & Public Sector
- Selection criteria responses (STAR format) are often mandatory and separate from the resume.
- Resume may need to align with specific public service capability frameworks.
- Include any government security clearance if held.

### 11.3 Healthcare & Allied Health
- Include relevant registration numbers if registered.
- Clinical placements count as work experience — list them.
- Overseas qualifications may require local board assessment.

### 11.4 Trades & Engineering
- Include licences and tickets relevant to the role.
- List relevant standards familiarity where applicable.

### 11.5 Creative Industries (Design, Media, Marketing)
- Portfolio link in the header is appropriate and recommended.
- For roles where creative output is judged, the resume can be slightly more visually formatted — but ATS compliance still applies for digital submissions.

---

## SECTION 11A — QUALITY GATE (run before outputting)

The following phrases must NEVER appear in any resume output. If detected, rewrite that sentence from scratch:

```
"demonstrating my ability to"
"highlighting my"
"showcasing my"
"results-driven" (without an immediately following number)
"team player"
"excellent communication skills"
"responsible for managing"
"assisted with"
"helped to develop"
"worked closely with the team to"
"ensuring alignment with"
"I am a hardworking"
"I am passionate"
```

### Resume Structural Checks (confirm before output)
- [ ] Professional Summary contains at least one number?
- [ ] Every bullet starts with a strong action verb?
- [ ] Every bullet contains a quantified outcome?
- [ ] No bullet contains "we" or "the team" as the agent of the result?
- [ ] No AI self-narration phrases in any bullet?
- [ ] Professional Summary does NOT share any sentence with the cover letter Para 1?
- [ ] Skills section only lists skills named in the job ad OR evidenced in work experience bullets?

---

## SECTION 12 — PRE-OUTPUT CHECKLIST

Before delivering any resume, the AI Engine must confirm:

- [ ] All sections present and in correct order
- [ ] 1-2 page target met
- [ ] No visa/nationality/age/photo included
- [ ] standard English applied throughout
- [ ] Every bullet follows CAR method with at least one metric
- [ ] Professional Summary tailored to the specific job description
- [ ] ATS keywords from job description present naturally in the document
- [ ] No fabricated data — all content sourced from candidate input
- [ ] Missing data flagged clearly with `[MISSING: ...]` tags
- [ ] Referees section reads "Available upon request"
- [ ] Context added for overseas employers and universities where necessary

---

*This file is maintained by the coaching team. Changes to this rule base will affect all future AI-generated resumes. Review quarterly or when Australian market standards shift.*