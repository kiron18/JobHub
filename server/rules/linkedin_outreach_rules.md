# LinkedIn Outreach Template Generation Rules

## Purpose
Generate four personalised LinkedIn outreach messages by combining the candidate's profile data with the target person's details. Every template must sound like a real person wrote it — specific, warm, never transactional.

## Core Principle
LinkedIn networking is not about asking people for jobs. It is about becoming someone people are glad they know. Every message is a deposit in a relationship account. Withdrawals (job asks) only work once the account has a balance.

## Output JSON Schema (return ONLY this, no other text)

```json
{
  "connectionNote": "string — max 300 characters, hard limit",
  "firstMessage": "string — 80 to 120 words",
  "afterCallFollowUp": "string — 50 to 80 words",
  "directAsk": "string — 60 to 90 words",
  "questionSuggestions": ["question1", "question2", "question3"]
}
```

## Template Rules

### connectionNote (max 300 chars — platform hard limit)
Formula: Reference something real → one sentence about who you are → reason to connect
- Reference their post, company, role, or something you genuinely noticed
- Say one sentence about who you are and what you are working on
- No ask, no pitch, no job request
- Example: "Hi [Name], I came across your post on [topic] and your point about [specific thing] resonated. I am a [background] currently [what you are doing]. I would love to connect."

### firstMessage (after connection accepted)
Formula: Research signal → low-pressure ask → easy to say no
- Show you have done research on them or their company
- Ask one specific, relevant question — not "pick your brain"
- Reference the candidate's situation briefly
- End with "No pressure at all if the timing is not right."
- A specific question about something they actually know is hard to walk away from

### afterCallFollowUp (send within 24 hours of a call)
Formula: Reference something specific they said → offer reciprocity
- Reference a specific point they made (leave [THEIR_POINT] as a placeholder the user will fill in)
- "I am going to act on it" — shows you were listening
- Plant a seed of reciprocity without being transactional
- Keep it warm, brief, genuine

### directAsk (only after meaningful exchange)
Formula: Context → specific ask for a name or direction → not a job ask
- Do NOT ask for a job
- Ask for a name or a direction — small ask, high likelihood of yes
- "Is there anyone you would suggest I speak with, or any companies worth approaching?"
- Reference that you have been building toward this conversation

### questionSuggestions (3 items)
Generate 3 specific questions the candidate could ask this person based on:
- The target person's company and what they work on
- The candidate's career goals and background
- Questions should be precise and show industry knowledge
- NOT: "What is it like working there?" — too generic
- YES: "What does your team look for when hiring graduates without Australian work experience?" — specific and useful

## Tone
- Human, warm, professional
- Never sycophantic ("Great post!" is invisible)
- Curious, not pushy
- Australian English spelling
