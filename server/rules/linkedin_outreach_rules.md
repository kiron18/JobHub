# LinkedIn Outreach Template Generation Rules

## Purpose
Generate four personalised LinkedIn outreach messages by combining the candidate's profile data with the target person's details. Every template must sound like a real person wrote it — specific, warm, never transactional.

## Core Principle
LinkedIn networking is not about asking people for jobs. It is about becoming someone people are glad they know. Every message is a deposit in a relationship account. Withdrawals (asks) only work once the account has a balance. This is relationship building, not career growth — the career growth is a byproduct of strong relationship building.

## Output JSON Schema (return ONLY this, no other text)

```json
{
  "connectionNote": "string — max 300 characters, hard limit",
  "firstMessage": "string — 80 to 120 words",
  "afterConversationFollowUp": "string — 50 to 80 words",
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

### afterConversationFollowUp (send within 24 hours of any real exchange — a chat, a call, or a meaningful message thread)
Formula: Reference something specific they said → offer reciprocity
- Reference a specific point they made (leave [THEIR_POINT] as a placeholder the user will fill in)
- "I am going to act on it" — shows you were listening
- Plant a seed of reciprocity without being transactional
- Keep it warm, brief, genuine

### directAsk — the call ask (self-timed, not fixed to a position in the sequence)
Formula: Context → ask for a short call → make it a video call, not a phone call
- This is an ask for a 15–20 minute call over Zoom or Google Meet — never a phone call, and never ask for a phone number. A video link keeps the ask low-friction and doesn't require either person to share private contact details.
- The candidate should feel free to send this as soon as the conversation has real warmth — that might be the 2nd message, the 3rd, or later. It does not have to be the last message in the sequence, and it should not be saved for message 4 by default. Waiting too long to ask is its own failure mode — a conversation that drifts on for many messages with no ask is a wasted opportunity.
- Do NOT ask for a job on the call
- The message MUST contain an explicit, concrete ask — "Would you be up for a quick 15-minute call over Zoom or Google Meet sometime?" A vague "keep me in mind" is a wasted message.
- Reference that you have been building toward this conversation
- Small ask, high likelihood of yes — but it must actually be asked

### questionSuggestions (3 items)
Generate 3 specific questions the candidate could ask this person based on:
- The target person's company and what they work on
- The candidate's career goals and background
- Questions should be precise and show industry knowledge
- NOT: "What is it like working there?" — too generic
- YES: "What does your team look for when hiring graduates without Australian work experience?" — specific and useful

## Tone
- Human, warm, professional
- Curious and lightly playful — this is focused play and socialising, not a transaction. Genuine curiosity about the person reads as confidence; stiffness reads as desperation.
- Never sycophantic ("Great post!" is invisible)
- Curious, not pushy
- Australian English spelling
- These templates are starting points the candidate will adapt into their own voice. Favour plain, natural phrasing over polished corporate wording — authenticity beats "perfection".
