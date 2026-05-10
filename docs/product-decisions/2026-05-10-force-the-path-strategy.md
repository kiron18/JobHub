# Force the Path: Activation Strategy

**Date:** 2026-05-10
**Problem:** Users complete the diagnostic and drop off. They generate one or two documents without building a solid profile, never reaching the workflow that actually gets them hired.
**Goal:** Make the path from diagnostic to hired feel inevitable. Remove drift. Replace optionality with momentum.

---

## The Core Psychology Stack

### 1. Loss Aversion (Diagnostic Handoff)
Kahneman's research is clear: the pain of losing something is roughly twice as powerful as the pleasure of gaining the equivalent. The diagnostic is currently framed as a scorecard. It should be framed as a damage report.

**What this means in practice:**
- Not "your profile score is 45%" — "your profile is currently invisible to ATS filters used by 80% of Australian employers"
- Not "improve your profile" — "3 fixable gaps are costing you interviews right now"
- The 7-day trial CTA belongs here, at peak anxiety: "Fix this in 7 days free"

**Challenge:** Fabricated precision destroys trust. "92% rejection rate" is a made-up number — when users figure that out (and they will), credibility collapses. Use directional language: "most ATS systems" not "92%". The fear is real. The framing doesn't need fake statistics to land.

### 2. Endowed Progress (Profile Starts at 25%)
The Endowed Progress Effect (Nunes & Dreze, 2006): people complete tasks faster when they believe they've already started. A loyalty card with 2 stamps pre-filled gets completed faster than a blank one even though both require the same number of stamps.

**What this means in practice:**
- If the user completed the diagnostic, their profile progress starts at 25%, not 0%
- The first screen they see on candidate profile should read: "You're already 25% there. Here's what finishes it."
- This is not dishonest — they HAVE made progress (intake answers, baseline resume, diagnostic data)

**Challenge:** The 25% must feel earned, not handed out. Tie it explicitly to what they did: "Your diagnostic is done. That's worth 25 points — here's what gets you the rest."

### 3. Zeigarnik Effect (Incomplete Feels Broken)
Uncompleted tasks occupy working memory disproportionately. The app should make "incomplete" feel unresolved — not locked out with a padlock, but visually unfinished in a way that creates tension.

**What this means in practice:**
- Profile sections without data should look like empty form fields, not hidden sections
- Achievement cards with amber warnings should feel like a draft, not a finished item
- The progress ring should throb or pulse subtly at low completion — static progress feels resolved; motion signals open loops
- Copy on amber warnings needs to shift from descriptive ("add a specific number") to consequential ("hiring managers score quantified achievements 3x higher — this one isn't scoring yet")

**Challenge:** Don't make incomplete feel broken in ways that feel punishing or blame-y. The emotional tone should be "almost there" not "you've failed." The sword analogy is right — they're sharpening a weapon, not being told they're incompetent.

### 4. Feature Gating with Clear Unlock Milestones
This is operant conditioning with a progress ladder. Each threshold unlocks something real and desirable.

**Proposed milestones:**

| Threshold | What Unlocks | Modal Copy |
|---|---|---|
| 25% (diagnostic done) | Baseline resume download | "Your starting point is ready." |
| 50% | LinkedIn Profile Optimiser | "Your profile just crossed the halfway point. LinkedIn is your next weapon — unlock it." |
| 70% | Job Board + Workspace (full access) | "You're ready. Let's get you hired." |
| 90%+ | Interview Prep (full Story Bank) | "Your profile is exceptional. Let's make sure you perform at interview too." |

**Challenge:** Hard-gating for paying subscribers is a retention risk. Users who've paid expect access. The gate should apply to free trial users; paying users get access but with persistent "your results will improve when you complete this" messaging. Don't punish the people who've committed.

### 5. The First Session Contract (Reciprocity + Foot in Door)
The baseline resume download is the platform's most powerful activation lever and it's currently sitting in a banner. It should be a modal moment.

When a user lands on candidate profile for the first time:
- A warm modal appears: "We've prepared a starting point for you."
- Shows a preview (or thumbnail) of their baseline resume
- Two buttons: **Download** (gives them something immediately) + **Let's sharpen it** (dismisses modal, keeps them in app)
- Copy beneath the buttons: "This is a solid foundation. A complete profile turns it into something that gets interviews. 6 minutes of your time could change the next 6 months."

The "Download" creates reciprocity — we gave them something real. The "Let's sharpen it" is the micro-commitment — they chose to stay and improve, which makes them more likely to follow through (Cialdini's commitment principle).

**Challenge:** The baseline resume must be genuinely good. If it's mediocre, reciprocity backfires — they'll think the platform is mediocre too. The quality gate on baseline resume generation matters here more than anywhere else.

### 6. CTA Language Shifts With Progress
The primary CTA on the candidate profile page should not be static. It should reflect where they are:

- **<50%:** "Your profile isn't ready yet. Complete it to unlock job matching." (red/amber)
- **50-70%:** "Almost there. 2 more achievements to unlock the job board." (amber)
- **>70%:** "You're ready. Find your next role." → links to job board (green)
- **>90%:** "Your profile is exceptional. Go get hired." (brand purple)

The CTA changes when they save progress — the reward is immediate.

---

## The Achievement Warning: Copy Rewrite

**Current:** "Add a specific number, % or $ to quantify impact."

This is descriptively accurate and emotionally inert. It tells the user WHAT to do without telling them WHY it matters to THEM.

**Proposed:** "Hiring managers score quantified achievements 3x higher. This one isn't scoring yet."

Or more visceral: "Without a number here, this achievement is indistinguishable from every other candidate's. Add one."

The GIF animation showing how to do this belongs as a small "How?" link next to the warning — taps to open a modal with the 8-second loop. Dimensions: 560x360px, under 400KB. MP4 preferred over GIF.

---

## The 3-Step Plan: Copy and Structure Fix

**Current issues seen in the diagnostic output:**
- "What's Happening" and "Your 3-Step Plan" headers are redundant — the content IS the plan
- The third step (cover letter advice) ends without connecting back to the platform

**Fix:**
- Remove both headers. Replace with a single unlabelled numbered list of exactly 3 items
- Each item: bold action title + 2-3 sentences of specific advice
- The third item always ends with a platform-specific CTA: "The fastest way to do this is to generate a tailored cover letter using the system that's been fine-tuned on your specific profile and this exact role type. Your first 7 days are free — use them."

This should be dynamic — the third step's platform mention should reflect what the diagnostic identified as the biggest gap (resume → mention resume generation; cover letter → mention cover letter; interview → mention interview prep).

---

## Additional Ideas to Explore

### The "Almost There" Effect
At 60-65% completion, the copy should shift to urgency not encouragement: "8 minutes of work unlocks the job board. You're close enough to feel it." Proximity to a goal accelerates effort (the "goal gradient effect" — Hull, 1932).

### Investment Visibility
Every time a user adds an achievement or fills a profile section, a micro-animation should show that data flowing into their profile score ring. Makes invisible progress visible. The user sees their investment working in real time.

### Identity Labeling
When users hit 70%, don't just show a number. Show a label: "You're a Prepared Candidate." People live up to the labels they're given (labeling effect). At 90%: "Exceptional Profile." These labels should persist in the header.

### Aggregate Social Proof (Not Fabricated)
Instead of a live ticker that feels fake ("Raj just unlocked Interview Prep"), use real aggregate stats that update weekly: "214 candidates reached 70% this week. Their average application-to-interview rate is 3x higher than candidates below 70%." This is verifiable and non-manipulative.

### The Diagnostic on Candidate Profile
Add a small "Run Diagnostic" link in the profile header area — understated, not prominent. Users who've completed the diagnostic should see "View Diagnostic" linking back to their report. This closes the loop and makes the two sections feel like one system.

---

## What to Challenge in the Original Framework

| Idea | Challenge |
|---|---|
| Remove Home button for <70% users | Creates resentment. Better: make incomplete feel unresolved, not imprisoned. Trapped users churn. |
| "92% of ATS filters will reject you" | Fabricated precision. Users who google this and find no evidence lose trust permanently. Use: "most ATS systems" or "the filters used by major Australian employers." |
| Variable mystery rewards | Works for games and social media. Job seekers are anxious, not playful. Predictable milestone rewards signal reliability — which is what anxious users need. |
| Social ticker ("Raj just unlocked...") | Risks feeling automated and fake. Real aggregate stats are more credible and just as motivating. |
| Hard gate EVERYTHING at 70% for all users | Paying users expect access. Gate the free trial; for paying users, gate with persuasion not locks. |
| "Warning: progress saved but you remain locked out" exit modal | Dark pattern. Users remember being trapped. A persistent "you're X% away from unlocking" nudge achieves the same goal without the coercion. |

---

## Implementation Phases

### Phase 1 — Copy and Framing (No new infrastructure)
- Rewrite achievement amber warning copy
- Rewrite ProfileCompletion component copy (current: "Complete your profile to avoid placeholder results" — weak)
- Rewrite diagnostic 3-step plan structure and add platform CTA
- Add "Run Diagnostic / View Diagnostic" button to candidate profile header
- Shift primary profile CTA based on completion score threshold

### Phase 2 — Milestone Moments (New components, existing data)
- Baseline resume welcome modal on first profile visit
- Unlock milestone modals (50% LinkedIn, 70% job board)
- Endowed progress: start score at 25% if diagnostic is done
- Achievement warning GIF modal (560x360px MP4)
- Progress ring pulse animation at low completion

### Phase 3 — Gating and Rails (Requires backend gating logic)
- Feature availability tied to completion score for free trial users
- Progress-based CTA that updates on save
- Aggregate social proof stats endpoint
- Identity label system (Prepared Candidate, Exceptional Profile)
- Automated 7-day nudge email: "Your profile is X% complete. Here's what's left."

---

## The Emotional Arc We're Engineering

| Stage | Emotion | What the App Does |
|---|---|---|
| Diagnostic | Anxious + seen | Shows them specifically what's wrong. Doesn't judge. Shows a fix. |
| First profile visit | Relieved + motivated | Gives them something immediately (baseline resume). Shows a clear path. |
| Building profile | Invested + focused | Progress is visible. Every action has a visible reward. |
| 70% unlock | Triumphant | A genuine moment. "You're ready" should feel earned. |
| First application | Committed | They've built something. Walking away from it now has a cost. That's the sunk cost working FOR them. |

The goal is not addiction. The goal is momentum that converts into a hired candidate — which is the only outcome that creates a genuine advocate and a referral.
