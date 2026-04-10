# LinkedIn Hub — Profile Generation Rules

## Purpose
Generate all LinkedIn profile sections plus banner copy as one cohesive output from the candidate's profile data. No job description is used. The output must read as if the same person wrote every section.

## Output JSON Schema (return ONLY this, no other text)

```json
{
  "headline": "string — max 220 characters",
  "about": "string — 1800 to 2200 characters",
  "skills": ["skill1", "skill2", "..."], 
  "experienceBullets": ["bullet1", "bullet2", "bullet3"],
  "openToWork": "string — max 150 characters",
  "bannerCopies": [
    {
      "formula": "value-prop",
      "copy": "string — 5 to 12 words",
      "sublineSuggestion": "string — optional proof element, e.g. '3,000+ helped · Forbes'"
    },
    {
      "formula": "bold-positioning",
      "copy": "string — 5 to 12 words",
      "sublineSuggestion": "string or empty"
    },
    {
      "formula": "credibility-offer",
      "copy": "string — 5 to 12 words",
      "sublineSuggestion": "string or empty"
    }
  ]
}
```

## Section Rules

### Headline (max 220 chars)
- Lead with current title or target role
- Add 2–3 differentiators using pipe separators: Title | Skill | Outcome
- Do NOT use: "Passionate about", "Results-driven", "Hardworking professional"
- Example: Senior Product Manager | B2B SaaS | Delivered $12M ARR pipeline turnaround

### About (1,800–2,200 chars)
- Hook (1–2 sentences): what you do and who you do it for
- Career narrative (2–3 short paragraphs): key expertise, how you work, what you are known for
- Signature achievements: 2–3 bullets with metrics (use • bullet)
- Call to action: what you are open to / what you want to connect about
- Tone: confident, conversational first person. Not a formal bio.

### Skills (exactly 10 items)
- Most role-relevant skills first
- Mix: technical skills + domain expertise + 1–2 leadership/interpersonal
- Do NOT include: "Communication", "Microsoft Office", "Teamwork"

### Experience Bullets (3–4 items)
- Most recent role only
- Start each with a strong past-tense verb
- Include at least 2 metrics or outcomes across the set
- STAR structure compressed to 1–2 sentences each

### Open to Work Signal (max 150 chars)
- "I am actively exploring [role type] opportunities in [industry/location]. [Brief value prop]."

### Banner Copies (exactly 3, one per formula)
**value-prop formula:** "I help [specific audience] [achieve specific outcome]"
**bold-positioning formula:** "Your [role] shortcut to [big result]" or direct declarative
**credibility-offer formula:** "[Achievement or credential] | Now helping [audience] do the same"

Banner rules:
- 5–12 words maximum — people scan on mobile
- No vague slogans ("Passionate entrepreneur", "Driven professional")
- sublineSuggestion should reference a proof element if the profile has one (metric, credential, publication, etc.)

## Tone and Voice
- First person, active voice
- Confident without arrogance
- Avoid: "passionate", "synergy", "leveraging", "thought leader", "guru", "ninja", "rockstar"
- Australian English spelling throughout
- Sound like a senior professional talking to a peer

## Context Sensitivity
- Government/APS: use policy/stakeholder/evidence-based language; emphasise security clearance if present
- Startup/tech: emphasise ship velocity, ownership, cross-functional collaboration
- Academic/research: include publications signal, research impact
- Senior/executive: lead with business outcomes, P&L, team scale
