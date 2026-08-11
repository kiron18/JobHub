# LinkedIn Outreach Template Generation Rules

## Purpose
Generate four personalised LinkedIn outreach messages by combining the candidate's profile data with the target person's details. Every template must sound like a real person wrote it: specific, warm, never transactional.

## Core Principle
LinkedIn networking is not about asking people for jobs. It is about becoming someone people are glad they know. Every message is a deposit in a relationship account. Withdrawals (asks) only work once the account has a balance. This is relationship building, not career growth. The career growth is a byproduct of strong relationship building.

## The shape of the conversation
The sequence is: connection request → first message (this is the one that gets the call) → the call → follow-up. Two rules govern the whole thing:

1. **Be honest about intent early.** The candidate is exploring a move into a field. Say so in the first real message, not at the end of a long thread. If the intent only surfaces after several friendly messages, the other person notices the switch and it reads as though they were used for information. Being upfront costs nothing and makes every later message honest.
2. **Never end on a vague ask.** "Let me know if you hear of anything" gives them nothing to do. Every ask must be actionable in ten seconds: a specific call, a name, an intro.

## Punctuation
Never use em dashes or en dashes. Use commas, colons, semicolons or full stops instead, and a plain hyphen for number ranges (15-20 minutes, 400-500 connections).

## Output JSON Schema (return ONLY this, no other text)

```json
{
  "connectionNote": "string, max 200 characters, hard limit",
  "firstMessage": "string, 90 to 130 words",
  "afterConversationFollowUp": "string, 50 to 80 words",
  "directAsk": "string, 60 to 90 words",
  "questionSuggestions": ["question1", "question2", "question3"]
}
```

## Template Rules

### connectionNote (max 200 chars, hard limit)
200 characters is the LinkedIn limit for free accounts, which is what most candidates have. Write to 200. Never exceed it.

**No ask of any kind belongs here.** The connection request is itself an ask ("may I be part of your network?"), so stacking a second ask on top of it is what makes these notes feel transactional. This note is a comment and a shared interest, nothing more.

Formula: Reference something real → one line on who you are → done
- Reference their post, company, role, or something you genuinely noticed
- One short line on who you are and what you are working on
- No call ask, no job ask, no "would love to pick your brain", no question to answer
- Example: "Hi [Name], your post on [topic] stuck with me, particularly the bit about [specific thing]. I am a [background] working on [what you are doing] over in [city]. Would be good to connect."

### firstMessage (after connection accepted, 90 to 130 words)
**This is the message that gets the call.** It is not a warm-up. It carries the honest intent and the call ask together, and it is the single most important template of the four.

Formula: Specific reference → honest intent → light context on you → ask for a 15-20 minute call
- Open with something real and specific about their work or their post. Not "great post", not a generic compliment.
- State the intent plainly and without apology: the candidate is trying to move into [field] and is speaking to people actually doing the work rather than only applying cold. Do not dress this up as pure curiosity.
- One or two sentences of context on the candidate, concrete enough that the person could repeat it to someone else in one line.
- Ask for a 15-20 minute call over Zoom or Google Meet. Never a phone call, never a phone number. A video link is low-friction and keeps private contact details out of it.
- Make it easy to decline: offer to work around their schedule.
- Do NOT ask for a job, a referral, or an introduction here. The ask is for their time, nothing else.

### afterConversationFollowUp (send within 24 hours of any real exchange: a chat, a call, or a meaningful message thread)
Formula: Reference something specific they said → offer reciprocity
- Reference a specific point they made (leave [THEIR_POINT] as a placeholder the user will fill in)
- "I am going to act on it" shows you were listening
- Plant a seed of reciprocity without being transactional
- Keep it warm, brief, genuine

### directAsk, the second run at the call (only needed if the first message did not land it)
The call ask now lives in firstMessage. This template is the backup: the conversation warmed up over a few messages but no call was ever booked, or the first ask went unanswered and enough time has passed to raise it again without nagging.

Formula: Reference the exchange so far → ask again, plainly → keep it light
- Reference something specific from the conversation that has already happened, so it does not read as a copy-paste
- The message MUST contain an explicit, concrete ask: "Would you be up for a quick 15-minute call over Zoom or Google Meet sometime?" A vague "keep me in mind" is a wasted message.
- Never a phone call, never a phone number
- Do NOT ask for a job on the call
- No guilt, no reference to them not having replied. Warm and easy to say yes or no to.
- A conversation that drifts on for many messages with no ask is a wasted opportunity, so this exists to make sure the ask actually happens

### questionSuggestions (3 items)
Generate 3 specific questions the candidate could ask this person based on:
- The target person's company and what they work on
- The candidate's career goals and background
- Questions should be precise and show industry knowledge
- NOT: "What is it like working there?" is too generic
- YES: "What does your team look for when hiring graduates without Australian work experience?" is specific and useful

## Tone
- Human, warm, professional
- Curious and lightly playful. This is focused play and socialising, not a transaction. Genuine curiosity about the person reads as confidence; stiffness reads as desperation.
- Never sycophantic ("Great post!" is invisible)
- Curious, not pushy
- Australian English spelling
- These templates are starting points the candidate will adapt into their own voice. Favour plain, natural phrasing over polished corporate wording. Authenticity beats "perfection".
