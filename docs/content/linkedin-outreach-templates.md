# LinkedIn Outreach Templates (for EmailTemplatesLibrary)

Six templates that form a **relationship-building sequence** for the ICP (Australian graduate job seekers — many migrants/internationals — whose biggest weakness is asking for jobs/referrals before building any standing).

The sequence teaches the discipline by shape:

| # | Template | When | The ask |
|---|---|---|---|
| 1 | LinkedIn Connection Request | First touch | None — just curiosity |
| 2 | Post-Acceptance Hello | Day they accept | None — confirm + offer |
| 3 | Public Engagement Comment | Recurring, weeks | None — visibility through value |
| 4 | The 15-Minute Ask | After weeks of engagement | Time, not job |
| 5 | Post-Chat Follow-Up | Same day as chat | None — gratitude + offer |
| 6 | The Soft Ask | Months later | Job/referral, but earned |

The "(Tip: …)" lines at the end of each `body` are coaching — they teach the discipline as the user reads the template. Keep them inside the body for now; if a future iteration adds a `tip` field to the Template interface, those tips can be lifted out.

---

## Template objects (drop into `TEMPLATES` array in `src/components/EmailTemplatesLibrary.tsx`)

```typescript
{
  id: 'linkedin-connection-request',
  title: '1. LinkedIn Connection Request',
  category: 'LinkedIn Outreach',
  subject: '(LinkedIn connection request — no subject field)',
  body: `Hi [First Name] — your post on [specific topic / one thing they wrote] has been on my mind. I'm [one-line context — e.g., "an international student finishing a Master's in [field] in Melbourne, learning the [industry] space"].

Would love to follow your work as I navigate this. No agenda — just curious how people I respect think.

[Your first name]

(Tip: LinkedIn connection requests are capped at ~300 characters. Trim if needed. Lead with the specific thing about them — never with a generic "I'd love to connect.")`,
},
{
  id: 'linkedin-post-acceptance',
  title: '2. After They Accept (No Ask)',
  category: 'LinkedIn Outreach',
  subject: '(LinkedIn DM — sent same day they accept)',
  body: `Hi [First Name],

Thanks for connecting.

I wanted to come back to your point about [specific thing from their content]. [Your honest reaction in one sentence — what resonated, what you'd want to dig into, what you tested or thought after reading it.]

Not asking for anything — just wanted to say hi properly. Looking forward to learning from your posts as I work through [your situation].

[Your first name]

(Tip: This message exists to PREVENT you from jumping to an ask. Send it the same day they accept, then go quiet for at least 2-3 weeks of public engagement before any further DM.)`,
},
{
  id: 'linkedin-engagement-comment',
  title: '3. Engagement Comment (Public)',
  category: 'LinkedIn Outreach',
  subject: '(Comment on their LinkedIn posts — recurring)',
  body: `[Pick ONE specific point they made — not the whole post. Quote or paraphrase it.]

[Your perspective in 1-2 sentences. Add something to the conversation — a related experience, a counter-angle done respectfully, or a real question that goes deeper. Do not just say "great post" or "totally agree". Add value or don't comment.]

[Optional: one specific follow-up question. Not "what do you think about X?" — too vague. Try "When you say [their phrase], do you mean [your interpretation A] or [interpretation B]?"]

(Tip: Comment on 3-5 of their posts over several weeks before any further DM. Recruiters and decision-makers watch their comment sections. Visibility through thoughtful comments builds standing nobody can fake.)`,
},
{
  id: 'linkedin-15-minute-ask',
  title: '4. The 15-Minute Ask',
  category: 'LinkedIn Outreach',
  subject: '(LinkedIn DM — only after weeks of engagement)',
  body: `Hi [First Name],

I've been following your posts for a few weeks now, and your point about [specific thing they wrote about] has genuinely shaped how I'm thinking about [your situation].

I know your time is limited. I'd love 15 minutes — virtual is great — to ask you a few specific questions about [ONE narrow topic — e.g., "how you decided which direction to specialise in early in your career", NOT "the industry"].

I'm not asking about jobs or referrals — I just want to learn from someone whose thinking I trust. Happy to fit around any 15-min gap. Coffee, Zoom, walking call — whatever's easiest for you.

[Your first name]

(Tip: Ask for TIME, not a job. Be specific about the topic so they can say yes without preparing. If they say no, thank them and keep engaging publicly — sometimes the answer is "not yet" not "no".)`,
},
{
  id: 'linkedin-post-chat-thanks',
  title: '5. Post-Chat Follow-Up',
  category: 'LinkedIn Outreach',
  subject: '(LinkedIn DM or email — same day as the chat)',
  body: `[First Name] — thank you for the time today.

What stuck with me most: [specific thing they said — quote them]. I went home and [what you actually did with their advice — actioned it, researched it, started something. Be concrete, not "I'll think about it"].

I'll keep you posted as [specific thing develops]. And if I can ever return the favour — even just reading drafts of anything you're working on — please ask.

[Your first name]

(Tip: This message turns one chat into an ongoing relationship. Send it the same day. Reference something specific they said — not a generic "thanks for your time". Show you listened.)`,
},
{
  id: 'linkedin-soft-ask',
  title: '6. The Soft Ask (After Standing)',
  category: 'LinkedIn Outreach',
  subject: '(LinkedIn DM — only after months of relationship)',
  body: `Hi [First Name],

Quick one — I know we've talked about [topic] over the last few months, and you've watched me work through [thing you've shown them].

I'm now actively [specific situation — e.g., "looking for grad roles in [field] starting [date]"], and I wanted to mention it to you because [specific reason their input matters here — not generic].

I'm not asking for a referral, but if anything crosses your radar that fits, I'd be grateful for the heads-up. Either way, I appreciate your perspective as I navigate this.

[Your first name]

(Tip: This is the ONLY template that asks for anything career-related. By the time you send it, you've built real standing. The "I'm not asking for a referral" framing makes the request easy to honour or politely decline — both feel respectful.)`,
},
```
