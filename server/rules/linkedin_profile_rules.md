# LinkedIn Profile Optimisation Rules

## Purpose
Generate LinkedIn profile sections optimised for a specific target role. The goal is a profile that ranks in recruiter searches, passes the 10-second skim test, and reads as a human wrote it — not a keyword-stuffed bot.

## Format
Return a structured document with clear section headers and character counts noted where relevant. Australian English spelling throughout.

## Output Sections (mandatory)

### 1. Headline (max 220 characters)
- Lead with current title or target role — this is what shows in search results
- Add 2-3 differentiators using the pipe `|` separator pattern: Title | Skill | Credential or outcome
- Do NOT use: "Passionate about", "Results-driven", "Hardworking professional"
- Example: Senior Product Manager | B2B SaaS | Delivered $12M ARR pipeline turnaround

### 2. About Section (max 2,600 characters — aim for 1,800–2,200)
Structure:
- **Hook (1–2 sentences)**: What you do and who you do it for — make the value clear
- **Career narrative (2–3 short paragraphs)**: Key expertise areas, how you work, what you're known for
- **Signature achievements**: 2–3 bulleted highlights with metrics (use • bullet)
- **Call to action**: What you're open to / what you want to connect about
Tone: Confident, conversational first person. Not a formal bio. Like a strong LinkedIn post, not a cover letter.

### 3. Featured Skills (exactly 10 skills)
- Order: most role-relevant skills first
- Mix: technical (hard) skills + domain expertise + leadership/interpersonal (1–2 only)
- Match the exact terminology used in the target JD for ATS alignment
- Do NOT include generic terms: "Communication", "Microsoft Office", "Teamwork"

### 4. Experience Bullet Rewrite (for most recent role only)
Rewrite 3–4 bullets for the most recent experience entry:
- Start each with a strong past-tense verb
- Include at least 2 metrics or outcomes
- Follow STAR structure compressed to 1–2 sentences each
- Match language from the target role

### 5. Open To Work Signal (optional one-liner)
One sentence the user can add to their Featured section or send in connection requests: "I'm actively exploring [role type] opportunities in [industry/location]. [Brief value prop]."

## Tone and Voice
- First person, active voice
- Confident without being arrogant
- Avoid LinkedIn clichés: "passionate", "synergy", "leveraging", "thought leader", "guru", "ninja", "rockstar"
- Sound like a senior professional talking to a peer, not selling themselves

## Context Sensitivity
- **Government/APS roles**: Use APS-aligned language (policy, stakeholder engagement, evidence-based), emphasise security clearance if present
- **Startup/tech**: Emphasise ship velocity, ownership, cross-functional collaboration
- **Academic/research**: Include publications signal, teaching philosophy briefly, research impact
- **Senior/executive**: Lead with business outcomes, P&L, team scale, transformation

## Common Errors to Avoid
- Do NOT repeat the same phrase in Headline and About
- Do NOT use third person in the About section
- Do NOT pad the About with soft skills — use concrete examples instead
- Do NOT generate a summary that could apply to any person in any job
