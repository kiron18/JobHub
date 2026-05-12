# Force the Path — Strategy Spec v2

**Date:** 2026-05-10  
**Status:** Approved — building  
**Purpose:** Sense-check the activation framework, challenge weak ideas, add angles that were missing, define the scoring system properly before a line of code is written.

---

## The Real Problem First

Users complete the diagnostic and then drift. They generate one or two documents and leave. The product has done the hard work — it knows exactly what's wrong with their profile — and then hands them a report and steps back. The activation gap is not a copy problem or a UI problem. It's a **momentum problem**. The product stops pushing exactly when the user is most anxious and most ready to act.

The goal of this document is to define a system that converts diagnostic anxiety into profile completion, and profile completion into active applications — without burning the user's trust in the process.

---

## 1. The Scoring System Needs Recalibrating Before Anything Else

This is the most important decision in the whole framework and it's currently wrong.

**Current weights (backend):**
| Field | Points |
|---|---|
| Name | 15 |
| Email | 10 |
| Location | 10 |
| Professional summary | 15 |
| Experience (any) | 20 |
| Education (any) | 10 |
| 3+ achievements | 15 |
| Skills | 5 |
| **Total** | **100** |

**The problem:** Someone can reach 70% (name + email + location + summary + experience = 70) with a skeleton profile that has zero achievements. This person cannot produce a quality document, but the system tells them they're ready. The gating is broken at the foundation.

**What 70% should actually mean:** The user has given the system enough material to generate something worth sending. That means achievements with metrics are load-bearing, not optional.

**Proposed recalibration:**
| Signal | Points | Why |
|---|---|---|
| Diagnostic completed (endowed) | 20 | Real work done — intake + analysis + baseline resume |
| Name + contact | 5 | Table stakes |
| Location | 5 | Needed for targeting |
| Professional summary | 10 | Context for AI generation |
| Experience (1+ roles) | 10 | Without this nothing else makes sense |
| Achievements (3+) | 20 | The actual evidence — most important field |
| Achievements with metrics (>50% have a number) | 15 | Quality signal — half-quantified is not quantified |
| Education | 5 | Needed for ATS |
| Skills | 5 | Keyword matching |
| Target role set | 5 | Without this the AI is guessing |
| **Total** | **100** |

Under this system, a user cannot reach 70% without: achievements AND at least half of them quantified. That's the gate worth enforcing. It also means every amber warning to "add a number" is now directly tied to a visible score improvement — the connection between action and reward is explicit.

**The 90% problem (no incentive above 70%):**  
This is a real gap. Once users hit 70% and the job board unlocks, the pull to keep going disappears. Three options:

1. **Quality framing:** Make it clear that output quality visibly improves at 85%+. Not a gate — a genuine signal. "Your resume at 90% will be measurably stronger than at 70%. Here's why." This is honest and real — the AI genuinely has more to work with.
2. **Interview prep gate at 90%:** Full Story Bank (5 stories, not 4) only unlocks at 90%. If users want the best interview coaching, they need the best profile.
3. **"Exceptional Profile" label:** Identity effect. At 90%+, the header shows "Exceptional Profile." People live up to labels. This costs nothing to build and creates pull.

Recommend: all three. They compound.

---

## 2. The Psychology Framework — What to Use, What to Drop

### Keep: Loss Aversion (with better framing)

The diagnostic should feel like a damage report, not a scorecard. This is correct. But the execution needs to avoid fabricated precision.

**Challenge the "92% ATS rejection" stat.** This number is invented. When a user googles "92% ATS rejection Australia" and finds nothing, the credibility of everything else you've said collapses. Job seekers in distress are not credulous — they're anxious AND sceptical. Use directional language that's accurate:

> "Your profile is currently invisible to the filters used by major Australian employers. Here are the specific gaps."

That's just as scary, and it's true.

**The 7-day trial CTA belongs at peak anxiety — immediately after the damage is named.** Not at the end of the report after the emotional moment has passed. The line "Fix this in 7 days free" should be the first CTA after the diagnostic section that identifies their biggest blocker.

### Keep: Endowed Progress (with mandatory explanation copy)

Starting at 25% (or 20% with the new scoring) is psychologically sound. But the effect **only works if the user understands what they got credit for.** Without explanation copy, users assume the scoring is broken or padded. The moment they see the ring at 25% and don't know why, they discount it.

The copy needs to be explicit: *"Your diagnostic is done. That's 20 points — you've already mapped the problem. Here's what finishes it."*

### Keep: Zeigarnik Effect (but implement it visually, not with locks)

The 70% gate is right. Making incomplete feel unresolved is right. **The method matters enormously.** 

**Challenge: removing the Home button or hard-locking the dashboard.** This creates resentment in exactly the users you most need to keep — the ones who are anxious, overwhelmed, and haven't decided whether to trust you yet. Trapped users churn. The research on forced tunnels shows high short-term completion but elevated abandonment at the point of frustration.

**Better:** Make incomplete feel visually unfinished, not locked. An amber pulsing ring. Achievement cards that look like drafts. Empty profile sections that look like blank form fields. The "itch" is the visual incompleteness, not a padlock. The user feels the tension but doesn't feel punished.

**One exception:** Show exactly what's locked and what unlocks it. Not a padlock — a preview with a clear condition. "Job Board: unlocks at 70% — you're 12 points away." Seeing what's behind the door is motivating. A padlock just says "no."

### Keep: Endowed Progress + Micro-rewards at milestones

Milestone unlocks (50% → LinkedIn Optimiser, 70% → Job Board, 90% → Full Interview Prep) are correct. The dopamine hit from crossing a threshold and seeing something new unlock is real.

**Challenge: variable / mystery rewards.** The Social Dilemma framework is right about intermittent reinforcement for engagement apps. It's wrong for job seekers. Job seekers are anxious, not playful. Variable rewards work when the emotional state is curiosity or excitement. The emotional state of an international grad who hasn't heard back from 40 applications is closer to dread. Unpredictable rewards feel unreliable. **Predictable milestone rewards signal that the system is trustworthy** — which is exactly what an anxious user needs.

Stick with predictable, clearly signposted rewards. The unlock moment should feel earned, not lucky.

### Keep: Hick's Law (fewer choices = more action)

Under 70%: one primary CTA. "Complete your profile to unlock the job board." No competing actions. This is correct and should be enforced in the sidebar — not by hiding navigation, but by making the completion CTA the most visually dominant element on the page until 70% is reached.

### Challenge: The "live ticker" social validation

"Raj just unlocked Interview Prep" risks feeling automated and fake, which it is. Users will clock this immediately. The response is eye-roll, not motivation.

**Real aggregate stats work.** They're verifiable. They're less manipulative. And they're more persuasive to a sceptical audience:

> "214 candidates reached 70% this week. Their application-to-interview rate is 3x higher than candidates below 70%."

If you don't have this data yet, don't show it. A fake stat that gets caught destroys more trust than no stat at all.

### Challenge: "System Alert" framing

> "System Alert: Your current CV will be auto-rejected by 92% of Australian ATS filters."

This is clickbait language. It works on the first read. On the second read — when the user has calmed down and is thinking clearly — it reads as manipulative, and the 92% figure has no source. This is the exact moment users decide whether to trust a platform long-term.

The fear should be real, not manufactured. The fear IS real — their resume probably IS getting filtered. Name the specific filters. Name the specific gaps. That's scarier than a made-up statistic because it's specific to them.

### Challenge: Hard-gating paying subscribers

The gate must apply differently to free trial users vs. paying subscribers.

- **Free trial:** Hard gate at 70%. The gate is an activation mechanism.
- **Paying subscriber:** No hard gate. Instead, persistent persuasion copy: "Your profile is at 58%. Documents generated from here will improve significantly at 70%. Here's what gets you there." A paying user who hits a padlock is a cancellation waiting to happen.

---

## 3. The User Journey by Tier

### Tier 0: Just completed the diagnostic (<25% / diagnostic not done)

**Emotional state:** Anxious. Just saw a damage report. Simultaneously scared and motivated.

**What the product does:**
- Diagnostic CTA fires at the moment of peak anxiety: "Fix this in 7 days free — your first application is 3 steps away."
- Navigate to Profile Bank for the first time
- First-visit modal: "We've prepared a starting point for you." Download the baseline resume OR choose to sharpen the profile (micro-commitment: staying = intention signal)
- Score ring shows 20% (endowed, with explanation copy)

### Tier 1: 20–49% (building)

**Emotional state:** Has started but hasn't committed. Most likely to drift here.

**What the product does:**
- Ring is amber, pulsing — visually unresolved
- CTA: "Your profile isn't ready yet. Complete it to unlock the job board." (red/amber)
- Every achievement without a metric shows: "Without a number here, this achievement looks the same as every other candidate's. Add one." + How? button
- Breadcrumb hints on locked features show exactly what's behind them: "LinkedIn Optimiser: unlocks at 50% — you're 8 points away."
- At 40–49%: Goal gradient copy kicks in: "8 points away from unlocking LinkedIn. You're close enough to feel it."

### Tier 2: 50–69% (close)

**Emotional state:** Invested. Has put in real work. Motivated but not over the line.

**What the product does:**
- LinkedIn Optimiser milestone modal fires on first cross of 50%
- CTA: "Almost there. X more points unlock the job board." (amber, specific)
- Ring turns from red to amber at 50% — visible colour shift as reward
- Job board shows a shadow list: blurred job cards with "Unlock at 70% to see these roles" — real jobs, real data, actually blurred. This is real FOMO, not manufactured.

### Tier 3: 70–89% (ready)

**Emotional state:** Accomplished. Has done the work. Needs momentum toward applications.

**What the product does:**
- Job board unlock modal fires on first cross of 70%: "You're ready. Let's get you hired." — genuine moment, not another nudge
- Ring turns green at 70% — satisfying payoff
- Header shows: "Prepared Candidate" — identity label
- CTA: "You're ready. Find your next role." (indigo, active)
- Sidebar shifts from completion-focused to application-focused

### Tier 4: 90%+ (exceptional)

**Emotional state:** High confidence. Most likely to refer others.

**What the product does:**
- Header: "Exceptional Profile"
- Full Interview Prep Story Bank unlocks (5 stories, not 4)
- CTA: "Your profile is exceptional. Go get hired." (brand purple)
- This is also the referral moment — "Know someone who needs this? They get a free diagnostic."

### The "Big Dick Swingers" (>70% on first visit)

Some users arrive with strong profiles — a career counsellor helped them, or they've done this before. The current system treats them the same as everyone else, which feels tone-deaf.

**On first profile visit, check score before showing the welcome modal:**
- >90% from the start: "Your profile is already exceptional. Let's put it to work." → direct path to job board
- 70–89%: "You're in good shape. Here's what sharpens it further." → show residual gaps, not completion journey
- <70%: standard baseline resume gift modal + completion journey

This acknowledges the work they've already done instead of making them feel like a beginner.

---

## 4. The Copy System

### Achievement warnings — not instructional, consequential

**Current:** "Add a specific number, % or $ to quantify impact."  
This describes WHAT to do. It doesn't explain WHY it matters to them specifically.

**Proposed:**
> "Without a number here, this achievement looks the same as every other candidate's. Add one."

Or, for the "How?" modal copy (shown when they tap the How? button):
> "Hiring managers score quantified achievements significantly higher. An estimate works — 'reduced handling time by roughly 30%' beats a blank field every time."

The key shift: the consequence is specific to their competitive position, not generic advice about resume writing.

### The baseline resume modal — reciprocity + micro-commitment

Two buttons. No more. No less.

- **"Download my resume"** — gives them something real, immediately. Creates reciprocity. They now owe us something (their attention and continued use).
- **"Let's sharpen it →"** — the micro-commitment. They chose to stay and improve. That's a different mental state from passive scrolling. Cialdini: once committed, people follow through.

Copy beneath: "6 minutes of your time here could change the next 6 months."

Do NOT use this modal if the baseline resume isn't actually good. Reciprocity backfires if the gift is mediocre. The quality gate on baseline resume generation is non-negotiable.

### CTA copy — changes with score, not static

| Score | CTA text | State |
|---|---|---|
| <50% | "Your profile isn't ready yet. Complete it to unlock the job board." | Disabled, red-toned |
| 50–69% | "Almost there. [X] more points unlocks the job board." | Disabled, amber-toned |
| 70–89% | "You're ready. Find your next role." | Active, indigo |
| 90%+ | "Your profile is exceptional. Go get hired." | Active, brand purple |

The CTA updates immediately when the user saves progress — the reward is instant and visible.

### Progress copy — use specifics, not vague encouragement

"2 more achievements with metrics to unlock the job board" is better than "keep going." Specificity creates a concrete task. Vague encouragement creates drift.

The goal gradient effect (Hull, 1932): proximity to a goal accelerates effort. At 60–65%, copy should shift to urgency: "You're 8 points away. That's 2 achievements with numbers."

---

## 5. The Shadow List — A New Idea Worth Building

When a user is under 70%, the job board is locked. But showing them nothing is a missed activation moment.

**Proposal:** Show 3–5 actual job matches (blurred, partially visible) with the message: "[N] roles matching [their target role] in [their city] are waiting. Unlock the job board at 70%."

This uses real data, not fabricated scarcity. The jobs are real. The blur is real. The FOMO is earned.

This is the single most motivating thing you can show someone who's close to 70% — not an abstract progress ring, but actual evidence of what's on the other side.

---

## 6. What This Connects To (Cross-Product)

### Diagnostic → Profile

The diagnostic identifies the biggest gap. The profile completion journey should surface those exact gaps first — not in generic order. If the diagnostic says "your achievements lack specificity," the Achievement section should be the first thing the user sees when they land on the profile, not buried below experience. The diagnostic and the profile are one system, not two separate pages.

### Profile → Document Generation

Document quality is the silent incentive above 70%. Users who generate a resume at 55% vs. 90% get a materially different document. Make this explicit: "Your next document will be stronger because you added metrics to 4 achievements. Here's what improved." Real-time quality feedback creates pull to keep improving.

### Profile → Interview Prep

The story bank in interview prep draws from actual achievements. A profile with 8 quantified achievements produces 5 strong CAR stories. A profile with 3 bare-bones achievements produces 2 weak ones. This connection is currently invisible — users don't know why their interview prep varies. Make it visible.

---

## 7. What to Challenge in the Original Framework (Summary)

| Idea | Verdict | Why |
|---|---|---|
| Remove Home button for <70% | Drop | Creates resentment. Trapped users churn. |
| "92% of ATS filters will reject you" | Drop | Fabricated. Destroys trust when googled. |
| Variable/mystery rewards | Drop | Works for games. Wrong emotional state for job seekers. |
| Social ticker ("Raj just unlocked...") | Drop | Feels automated and fake. Use real aggregate stats instead. |
| Hard gate EVERYTHING at 70% including paying users | Modify | Gate free trial. Persuade paid users. |
| Exit modal "Warning: you remain locked out" | Drop | Dark pattern. Users remember being trapped. |
| "System Alert" framing | Drop | Clickbait tone. Specific gaps are scarier than fake alerts. |
| Current achievement scoring (15 pts) | Recalibrate | Achievements are the most important field — they should be the heaviest. |
| 70% gate with nothing above it | Fix | Add incentives at 90%: identity label, interview prep unlock, quality framing. |

---

## 9. Profile Gate Overlay — Dashboard, Application Workspace, Job Board

Users below 70% rawScore see a frosted overlay on the dashboard, application workspace, and job board. The profile bank (/workspace) is never gated — that's where they go to fix things.

**Approach:** Simple client-side overlay. The real security is server-side — `checkAccess` already blocks generation/analysis requests. The overlay's job is motivational, not a security gate. If someone removes it via inspect element they see a skeleton with no useful data, which proves the point for you.

**Copy on overlay:**
> "Your profile isn't ready yet — documents generated from an incomplete profile won't reflect your real ability."
> "[X] points away from unlocking everything. Finish your profile first."
> CTA: "Complete my profile →" (links to /workspace)

**What's behind the overlay:** Render real content with pointer-events disabled and a blur. Don't fake/mock it — the real empty state is persuasive enough.

**Routes that get gated:**
- `/` — Dashboard
- `/application-workspace` — Document generation workspace
- `/jobs` — Job feed (additionally: show shadow list of blurred real job cards with "unlock at 70%" message rather than a full overlay here)

**Routes never gated:**
- `/workspace` — Profile bank (where they fix things)
- `/linkedin` — LinkedIn optimiser unlocks at 50%, not 70%
- `/tracker` — Application tracker always available (they may have existing applications)

## 10. Non-Quantifiable Achievement Bypass

**Flow:**
1. Amber warning fires with pointed questions generated from the achievement text (LLM call using the achievement description)
2. After questions: secondary link — "This genuinely can't be measured — mark as qualitative"
3. Qualitative-marked achievements: count as achievements for scoring, don't count toward metrics quality multiplier
4. Sidebar note when qualitative achievements exist: "Qualitative achievements are fine — aim to have at least half your achievements with a number."

**Pointed question prompt:** Takes the achievement text and returns 2–3 specific questions like "How many people were involved?", "Over what time period?", "What changed as a result?" — no hardcoded question banks.

## 11. Open Questions Before Building Anything

1. **What does a "good" baseline resume actually look like?** If we're promising "we've prepared a starting point," that promise needs to be kept. Has the baseline resume quality been validated with real users?

2. **Do we have real aggregate data for social proof?** "214 candidates reached 70% this week" is only usable if it's true. If we don't have the data yet, don't show it — placeholder social proof is as bad as a live ticker.

3. **Shadow list — can we show real job data to a <70% user?** This requires the job feed to be available even before the gate. Is that technically feasible without giving full access?

4. **What's the plan for the 7-day trial CTA placement?** It should fire at peak diagnostic anxiety — immediately after the biggest identified blocker. Currently it's at the end of the report. Does moving it up cannibalise organic completion, or does it accelerate it?

5. **Hard gating for free trial users — does this apply from day 1 or after a grace period?** A user who just signed up and hits a padlock before they've had a chance to feel the value is likely to leave. Consider: a 48-hour open-access window followed by the gate.
