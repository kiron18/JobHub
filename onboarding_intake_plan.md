# Onboarding Intake & Diagnostic Report — Plan

## What this is

A warm, psychologically-considered welcome experience that doubles as a diagnostic intake. The user answers 4 questions, uploads their resume and 2 recent cover letters, and receives a personalised AI-generated report that tells them honestly where their job search is breaking down and what to fix. It is also the mechanism by which we dramatically improve the quality of everything the system generates for them going forward.

---

## The psychology of the moment

When someone signs up for a tool like this, they are not in a neutral emotional state. They are somewhere on a spectrum between quietly frustrated and quietly desperate. They have sent applications into the void. They do not know if it is their resume, their targeting, their cover letters, or just bad luck. The uncertainty is the worst part.

The welcome screen has one job: make them feel like they have finally found someone who gets it and has a plan.

**Copy principles:**
- Acknowledge the emotional reality without being patronising ("we know job searching is hard" is weak — be specific about what they are experiencing)
- Reframe their situation: they do not have a job search problem, they have a positioning problem — and that is solvable
- Make the intake feel like a conversation with a career strategist, not a form fill
- Every question should feel like it is being asked because someone cares, not because the system needs data
- The CTA should feel like relief, not effort

**Draft welcome copy:**
> "Most people applying for jobs are doing it wrong — not because they are unqualified, but because they are invisible. Let's change that."
>
> "We are going to spend the next few minutes understanding exactly where your search is breaking down. Then we will fix it. Answer honestly — the more specific you are, the more powerful your results."

**Question framing (draft):**
1. "Which roles are you going for, and where?" — not "what positions are you targeting"
2. "How long has this been going on? How many applications, and where are you sending them?" — validates effort, surfaces strategy problems
3. "What is actually happening when you apply? Silence? Rejections? Interviews that go nowhere?" — no judgment, just data
4. "In your gut, what do you think is holding you back?" — this is gold. Their self-diagnosis is often partially right, which makes the AI report feel more personal when it addresses it directly

---

## What we are building

### Phase 1: Intake UI — 5-step flow

A full-screen stepped conversation that appears on first login. Not a form — one question per screen, progress indicator, forward momentum.

**Step 1 — Welcome screen**
Emotional hook. "This takes 4 minutes. It will change how you see your search." Two CTAs: "Let's go" and "Skip for now" (but with a cost — "You can skip, but we won't be able to personalise your results").

**Step 2 — Q1: Role + location**
Free text inputs for role(s) and city. Additional dropdowns: seniority level (graduate / mid / senior / lead / executive), industry (pre-populated list). This anchors every future generation to a specific target.

**Step 3 — Q2: Search timeline and channels**
- How long searching: dropdown (< 1 month / 1–3 months / 3–6 months / 6–12 months / 12+ months)
- Approx applications sent: range picker (< 10 / 10–30 / 30–60 / 60–100 / 100+)
- Channels used: multi-select (LinkedIn / Seek / Indeed / Recruiters / Direct / Referral / Other)

**Step 4 — Q3 + Q4: Responses and blocker**
These share a screen. Radio buttons for response pattern (mostly silence / mostly rejections / some interviews that stall / getting interviews but no offers / mix of all). Free text for biggest blocker — placeholder copy: "Be honest. Is it your resume? Your experience? Confidence in interviews? We have seen every answer and none of them are unfixable."

**Step 5 — File upload**
Resume (required) + up to 2 recent cover letters (optional but strongly encouraged). Warm framing: "Now show us what you have been sending. We are not judging the documents — we are using them to understand how you have been positioning yourself."

Processing screen: animated, with rotating copy:
- "Reading your documents..."
- "Identifying where applications are likely dropping off..."
- "Building your personalised diagnosis..."

Real wait time (30–60 seconds) used to build anticipation rather than anxiety.

**Result:** The diagnostic report, displayed immediately, stored permanently on their dashboard.

---

## The Claude diagnostic prompt — design intent

The prompt receives: Q1–Q4 answers, extracted resume text, extracted cover letter text(s), and produces a structured report.

**Section 1 — Targeting Assessment**
Is the role + city combination realistic given their experience level? Are they too broad (applying to everything) or too narrow? Does the experience in their resume actually match the roles they say they want? This section should be honest but not brutal — "your resume positions you as an operations manager, but you are applying for strategy roles. These require different language and different proof points."

**Section 2 — Document Audit**
- Resume: Achievement-led or duty-led? Does it pass a 6-second scan? Quantifiable outcomes present? Positioning match?
- Cover letters (if provided): Generic or specific? Is the opening hook engaging? Is there a compelling narrative? Does the tone match the target industry?
- The gap between how they present themselves and what the target role is actually looking for

**Section 3 — Pipeline Diagnosis**
Based on their response pattern:
- Mostly silence → likely an ATS / keyword / targeting problem (not getting past the filter)
- Mostly rejections → likely a fit or positioning problem (getting seen but not connecting)
- Interviews that stall → likely a presentation / preparation / expectation problem (good on paper, something breaks down in person or at offer stage)
- Getting interviews but no offers → compensation, culture fit, or interview technique

**Section 4 — The Honest Assessment**
Cross-references what they said in Q4 (their self-diagnosis) against what the documents actually reveal. If they said "I think it's my resume" but their resume is actually solid and their cover letters are weak — say so, warmly. If they are right — validate that and tell them why.

**Section 5 — The 3-Step Fix**
Three concrete, specific actions. Not "improve your resume" — "your resume opens with a 4-line objective statement that tells employers what you want. Replace it with a 2-line summary that tells them what you deliver." Each fix should be something they can act on today.

**Section 6 — What JobHub Will Do For Them**
Close the loop. "Based on your answers, here is what we are going to build for you." Makes the intake feel like the beginning of something, not a standalone exercise.

---

## The quality improvement angle — the most important part

The user is right that the content exists. The achievement bank is populated. The gap is in how the system uses it. Here is how the intake data elevates output quality systematically.

### 1. Persistent job search context
After intake, every generation request is enriched with a context block:

```
Target role: Senior Product Manager
Target city: Sydney
Industry: FinTech / B2B SaaS
Seniority: Senior (8+ years experience)
Search status: 4 months active, ~60 applications, mix of silence + stalled interviews
Self-identified blocker: "I think my resume is too generic"
```

Claude's blueprint layer can now make far better strategic decisions. It knows this is a senior candidate who has been at it for months — so positioning should be confident and specific, not broad or desperate.

### 2. Voice extraction from uploaded cover letters
The uploaded cover letters are a goldmine. Claude can extract:
- Natural sentence rhythm and length preference
- Vocabulary level and formality register
- Whether they naturally lead with data or narrative
- Recurring phrases (to either reinforce or consciously break)
- Their instinctive story structure

This extracted voice profile gets stored on the user record and injected into the Llama executor prompt as a style reference. Output will sound more like *them*, not like a generic AI cover letter. This directly addresses the #1 complaint about AI-written content.

### 3. Gap analysis against target role
With a target role defined, we can run a proactive gap analysis against the achievement bank:

"You are targeting Senior PM roles in Sydney. Your achievement bank has strong evidence of delivery and stakeholder management, but no quantified product outcomes — no growth metrics, conversion rates, or revenue attribution. Cover letters generated for PM roles will flag this gap and prompt you to add those details."

The achievement bank UI shows a "gap indicator" — what you have, what you are missing for your target role type, and suggested prompts to fill the gaps.

### 4. Calibrated match scoring
Right now the match engine compares JD to achievements without knowing the candidate's targeting context. With intake data:
- Weight matches against the target role category (a PM targeting PM roles needs PM-specific achievements ranked higher than general achievements)
- Identify systemic patterns: if 90% of applications score < 50%, the problem is at the targeting level, not the document level — the system should flag this explicitly

### 5. The report as a living document
After initial generation, the report should update. After 30 days, prompt the user with "Has anything changed?" A re-intake comparison creates a before/after story:

"Last time you reported mostly silence. Now you are getting interviews. Here is what shifted in how you are presenting yourself."

This is a natural referral trigger — people share transformation stories.

---

## Improvements to the existing generation pipeline

The intake enables fixes the current prompt cannot make alone:

**Current gap 1: No search context awareness**
The blueprint prompt is good at positioning for a specific JD. It does not know if this is a candidate's 3rd application or their 60th, whether they are getting ignored or getting interviews. The intake fixes this — the context block becomes part of every blueprint call.

**Current gap 2: Generic voice**
The Llama executor writes well but generically. Voice extraction from uploaded cover letters gives the executor a style target. "Write in the style of the following examples, maintaining the candidate's natural rhythm and vocabulary while improving structure and specificity."

**Current gap 3: No systemic feedback**
If someone generates documents for roles where they consistently score < 40%, the system should be surfacing this at the dashboard level: "You have generated 8 applications this week. 6 scored below 40%. This suggests your targeting may need adjustment." The intake data makes this insight possible.

**Current gap 4: Interview-stage candidates need different help**
Someone who is getting interviews but stalling needs different output than someone not clearing screening. The intake identifies which stage they are at, and the system can emphasise different things — stronger proof points for screening candidates, more nuanced narrative for interview-stage candidates who need to prep talking points.

---

## Open questions before building

**1. What is your designed Claude prompt?**
You mentioned having a prompt for the diagnostic report. I need to see it before designing the processing layer — we should build around your intent, not around a guess at it.

**2. When does the intake trigger?**
- Option A: First login only, mandatory (with a skip that permanently costs them personalisation)
- Option B: First login, fully optional, with a persistent dashboard CTA
- Option C: Triggered only when a user imports their first resume (natural moment)
Recommendation: Option A, with a graceful skip. The intake is the product's most valuable moment — hiding it behind optionality undersells it.

**3. Report storage**
The report needs to live in the database to persist across sessions. Proposed schema:
```
DiagnosticReport {
  id, userId, createdAt, updatedAt,
  status: PROCESSING | COMPLETE | FAILED,
  intakeAnswers: JSON,  // Q1–Q4 answers
  reportMarkdown: String,  // Claude's output
  targetRole: String,
  targetCity: String,
  voiceProfile: JSON  // extracted from cover letters
}
```

**4. File handling cost**
3 files through Claude per user = approximately $0.03–0.08 per intake depending on document length. At 100 signups a day this is $3–8/day — manageable. Options if cost becomes a concern: (a) use Llama for extraction, Claude only for final synthesis; (b) make the full diagnostic a premium feature after the free tier runs out.

**5. What if they have no cover letters?**
Make upload optional but reframe the absence: "If you do not have any recent cover letters — that might be part of the problem. We will generate your first one together after your diagnosis." This converts a gap in their application into a feature of the onboarding.

**6. Re-intake cadence**
After 30 days, prompt the user to update their status. After 60 days, send a more substantive re-intake. These create progress checkpoints and keep users engaged with the platform beyond the initial generation sessions.

---

## Recommended build order

1. Intake UI — stepped modal, questions, file upload, processing screen
2. Processing pipeline — extract file text, call Claude with diagnostic prompt, store report
3. Report display — in-app styled markdown, persistent "Your Diagnosis" card on dashboard
4. Context injection — pass search context into every blueprint generation call
5. Voice extraction — store voice profile on user record, inject into executor prompt
6. Gap analysis UI in achievement bank — what you have vs what target roles need
7. Re-intake flow — 30-day prompt, progress comparison report

---

## One important caution

The report needs to be honest but not crushing. This is someone who is already struggling. Problems must always be framed as fixable and specific, never as character flaws or permanent limitations.

"Your resume is duty-led rather than achievement-led" — fine.
"Your resume is weak" — not fine.

Every problem identified should be immediately followed by what the tool is going to do about it. The emotional arc of reading the report should be: recognition → relief → excitement. Not: recognition → shame → overwhelm.

The goal: they finish reading and their first thought is "finally, someone who actually understands what is wrong and has a plan." Not "I am worse off than I thought."
