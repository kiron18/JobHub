# Retention Roadmap — Building a Career Ally, Not a Scoreboard

**Date:** 2026-05-12
**Status:** Draft / discussion
**Purpose:** Map the retention/loyalty levers for JobHub. Identify what to build to make the product the thing users *reach for* when they think about their career — without resorting to engagement-bait patterns that backfire in this domain.

---

## Thesis: this domain is grief-shaped

Job hunting is unlike almost any other consumer product context:

- **Success = leaving.** When the user wins, they stop using us.
- **Failure path is long and demoralising.** Most weeks deliver silence, ghosting, or rejection. Users arrive already anxious; we cannot add to that load.
- **The work itself is unpleasant.** Filling forms, tailoring resumes, writing cover letters.
- **Engagement is bursty.** A flurry of activity for 2 weeks, then a dead fortnight, then another burst.

Standard retention playbooks — streaks, leaderboards, push-notification ladders, dopamine loops — actively backfire here. They feel like a dating app gamifying loneliness.

The right north star is different: **"the calm competent ally they reach for when they think about their career."** Retention here means being demonstrably useful at the lowest points of the process, building a relationship that compounds across job searches (this one and the next one in 3 years), and making each session leave the user *slightly better positioned* — even on dead-market days.

---

## The activation problem we have today

[Screenshot reference: post-onboarding modal showing a 22/100 score, headline "Your profile isn't ready yet.", subhead "Documents generated from an incomplete profile won't reflect your real ability — and they won't get you interviews.", microcopy "You're 48 points away from unlocking everything."]

A user who has just spent 10–15 minutes completing onboarding should not see "isn't ready yet" with a 22 and the words "won't get you interviews." Three problems:

**1. The copy is harsh at the worst possible moment.** They just did the work. The first thing the product says back is "not enough." This is the opposite of the relationship we want to establish in session 1.

**2. People with qualitative work feel structurally excluded.** Carers, creatives, early-career, some operations and policy roles — their genuine contribution doesn't compress into a percentage and a number. The current copy implies they're permanently locked out, when really the system just doesn't have a way to score what they do.

**3. The gate framing implies value is hidden.** "Unlock everything" creates the suspicion that we're withholding the thing they came for. Even when the gate is reasonable, the *language* makes us look like an obstacle.

This is not a fight with the Force the Path v2 spec — the recalibrated scoring and the 70% gate stay. The fix is narrower:

**Recommendation — copy and framing only, no spec change:**

- Replace **"Your profile isn't ready yet."** with something honest about where they are and where to go next. e.g. *"Foundation set. Two add-ons will sharpen it."*
- Drop **"won't get you interviews."** Replace with what's actually true: *"Documents are stronger when this is filled in — and a number on at least one bullet is what makes recruiters stop scrolling."*
- Replace **"unlocking everything"** with a specific, named outcome: *"~10 minutes to a complete profile and a sharper first resume."*
- For users without easily quantified work, the achievements step should explicitly accept and honour qualitative descriptions. The wizard already has a `qualitative` marker on metrics — surface that as a first-class choice, not a fallback. "Some of my impact doesn't have a number" should be a button, not a workaround.

This is a 30-minute copy edit. Everything else in the activation framework can stay.

---

## The core unlock — "Today's 15 minutes"

The current dashboard is a multi-widget homepage. After the wizard, every visit asks the user to scan, decide, and pick. That's friction on every session, and most sessions end with no concrete forward motion.

Replace it with a single focused suggested action per visit, picked by where they are:

```
┌─────────────────────────────────────────────────────┐
│  Senior Product Designer · Melbourne                │
│  Targeting Series A startups                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Today  ·  about 12 minutes                         │
│                                                     │
│  ► Your Stripe Senior PM application is at day 8.   │
│    Most candidates who heard back nudged by day 7.  │
│    [ Draft a follow-up → ]                          │
│                                                     │
│  ► 3 new matches in your range this week            │
│    Atlassian, Canva, Tinybird — all 80%+ fit        │
│    [ Review → ]                                     │
│                                                     │
│  ► Your Atlassian interview is Tuesday              │
│    [ Open prep doc → ]                              │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Pipeline                                           │
│  Saved 4 · Applied 11 · Interview 2 · Offer 0       │
└─────────────────────────────────────────────────────┘
```

Decision rules (in priority order):
- If an interview is scheduled within 5 days → surface prep
- If applications are aging past their response window → surface follow-up
- If pipeline is thin → surface new matches
- If nothing is pressing → surface one resume / profile tightening suggestion

Every session ends with **visible forward motion**, even on dead-market days. This single pattern subsumes 80% of the "tips / tour" thinking — instead of explaining what's where, the app says what to do *next*.

What this *replaces*:
- First-visit tip pills (already removed)
- Forced tour overlays (we considered and rejected)
- Multi-widget scanning behaviour
- The need for the user to know what to do

---

## Four priority builds

### 1. Interview Prep Generator

**Status:** Highest emotional surface in the entire product. Currently uncaptured. A high-quality candidate (Ananya) used this in Word-doc form and came back asking for a second one when a new interview came up — that is the single strongest signal we have that the value is real.

#### Format (validated by Ananya's two docs)

Same voice, structure, and design across roles. Personalised against the candidate's actual profile.

**Header**
- Role · Organisation
- 3 short framing panels: *Organisation* (what they do, in 2 lines) · *The Role* (what it actually is, in 3 lines) · *Why You* (the candidate's specific fit, in 3 lines)

**Part 1 — Before you walk in**
- *Five mindset anchors.* Numbered. Sentence-flow paragraphs, calm and direct. e.g. *"You are not auditioning. You are having a conversation. You have already been selected for interview — walk in as someone deciding whether this role is right for them."*
- *"What [Org] is really looking for"* — four pillars derived from the JD selection criteria. Each is a paragraph, not a bullet list. Tells the candidate the lens to interpret every question through.

**Part 2 — The questions and your answers**
- 5–7 likely questions, tailored to the JD
- Each question structured as Context / Action / Result, built from the candidate's actual profile and experience
- Each answer ends with *"Probe ready:"* — 2–3 follow-up questions to be prepared for
- Each answer has a short framing tip ("If they ask about X, be honest — overclaiming outcomes is a common interview error")

**For multi-role candidates:** A comparison table at the top — same candidate, different angle per role. Critical when someone is interviewing at multiple places in parallel.

#### In-app implementation

- Candidate marks a job as "Interview" in the pipeline → an "Interview prep" button appears on the card
- Clicking it asks for the JD (paste or upload) if not already attached, then generates the full doc using their profile + the JD
- Renders in-app (scrollable, copy-paste-friendly) and exports to PDF / Word
- Regenerable — if they want a different angle or want to refresh after more research, one click
- Every prep auto-saves to their **Profile Bank** as a permanent asset

#### Build notes

- Voice: calm, sentence-flow, direct. Match Ananya's docs. No bullet-point clutter, no exclamation marks, no "you've got this!" tone.
- General principles + JD-specific tactics. We do NOT scrape company knowledge per org — the candidate fills in any role-specific research they want. Keeps it scalable.
- No score, no rating, no "interview readiness 7/10". Just the doc.

This is the build with the strongest demonstrated user pull. Build first.

---

### 2. Daily-focused dashboard

Spec described above under *"The core unlock."*

This is the surface that #3 and #4 render on. Without it, follow-up nudges and rejection prompts compete with everything else on the dashboard.

Build second. Modest scope — most of the data already exists (pipeline state, application dates, matches, profile state). The work is the decision layer (which suggestion to surface) and the UI.

---

### 3. Pipeline aging + smart follow-up nudges

Every card in the pipeline tracks days-since-last-action. After a threshold (~5–7 days quiet in Applied), the card visually softens — a subtle *"8 days quiet"* tag, slightly desaturated treatment. Not a panic indicator, not a red badge — just an honest signal that this is going stale.

When the user opens an aged card, an inline nudge appears:

> Most candidates who heard from Stripe got their first reply within 7 days. You're at day 8.
> **[ Draft a follow-up → ]**

Clicking generates a tailored short email — uses the JD, their profile, the original application date, and a calm professional template. The user reads, tweaks if needed, sends. The product just removed 90% of the friction of writing a follow-up.

**Why this works:**
- *Concrete grounding* ("within 7 days") beats generic "you should follow up." We're giving them a reason and a benchmark, not nagging.
- *Card aging* makes the pipeline a living board instead of a static log. Stale cards visibly demand attention; fresh cards don't shout.
- *The friction removal is the actual product.* Without one-click drafting, this is just a notification — which we've explicitly committed not to spam.

**Infra we already have:** `followUpReminderCron.ts` (recently added) handles the scheduling layer. What we still need:
- Per-company / per-role response-window defaults (start with sensible global defaults: 7 days first reply, 14 days follow-up)
- The email-draft generator (small prompt, mostly populated from existing profile data)
- The aging visual treatment on pipeline cards

Build third — leverages cron infra and the dashboard surface from #2.

---

### 4. Rejection-to-lesson flow

When a user moves a card to **Rejected**, instead of just changing status, surface a quiet inline prompt:

> Sorry to hear it. Want to capture what you learned?
>
> - What signal did you miss in the JD or the interview?
> - What would you do differently next time?
> - Anything to note about this company or this kind of role?
>
> **[ Skip ]   [ Save lesson ]**

The reflection saves to a "Lessons" log on their profile.

**Three downstream effects:**

1. **The moment is validated.** A rejection in most products is just a status change. Here, the product acknowledges the weight of it and offers a meaningful action. That's the relationship-builder.

2. **A personal asset accumulates.** Every rejection becomes input for the next application. After 5–10 lessons, the user has a private reflection journal worth scrolling. After 20, it's an archive of who they're becoming.

3. **Pattern surfacing.** Periodically (weekly digest, or surfaced on the dashboard), we can identify cross-rejection patterns: *"You've been rejected from 4 'Senior Manager' roles in the last month. Is the seniority calibration right?"* This insight is invisible to the user looking at one rejection at a time. The product is the only thing that can see across them.

**Scope:** Smallest build of the four. New `Lesson` table linking to pipeline card, an inline UI on the Rejected transition, a lessons-view in the profile, and the weekly pattern-detection job.

**Why it's the most psychologically powerful per line of code:** because it converts the product's biggest moment of negative emotional weight into a deposit. Every other product in this space silently logs the rejection and shows them another job. We acknowledge it. That alone is differentiating.

Build fourth.

---

## Anti-patterns to actively avoid

These are temptations that look like good engagement design but will burn the trust we're building.

- **Streaks that punish bad weeks.** Job hunt has dead weeks; a broken streak feels like the product is shaming them. If we use any signal, make it forgiving: *"4 of the last 7 days."*
- **Push notification ladders.** Anxious users do not need pings. Email digests at predictable cadences only.
- **Forced tours, multi-tooltip onboarding, animated arrows.** Same problem as the tip pills we just removed.
- **Vanity / fake percentile metrics.** Already removed ("outperforms 85%"). Stay vigilant — these creep back in any time we feel pressure to show progress that isn't real.
- **Celebrating trivial actions.** Already fixed in the wizard (reward screens now suppressed when the user didn't actually edit anything). Don't reintroduce.
- **Doom-scoring at activation.** See "The activation problem we have today." The number can stay; the wording around it cannot crush.
- **Borrowed engagement patterns from social / dating / fitness apps.** Different domain, different emotional contract.

---

## What we'd measure

Retention metrics that actually reflect the relationship we want to build:

| Metric | Why |
|---|---|
| D7 / D28 return rate by activation cohort | Are they coming back? |
| Sessions per week (not minutes) | Frequency, not duration. Long sessions in this domain usually mean they're stuck. |
| Interview-stage rate | The real success milestone the user cares about before an offer. |
| Time from Saved → Applied | Better matching + better affordances should compress this. |
| Pipeline aging distribution | Long stale = something's broken. Healthy = movement. |
| **For #1:** % of Interview cards that use the prep generator | Adoption of the highest-emotion feature. |
| **For #3:** % of follow-up drafts that get sent | Friction-removal working. |
| **For #4:** % of Rejected moves that save a lesson | Engagement with the relationship-building surface. |
| **Cross-search retention:** users who return for a *new* job search 6+ months later | The long-game success metric. This is where the relationship pays off. |

---

## Build order rationale, condensed

1. **Interview prep** — biggest emotional surface, hardest to fake, only feature with prior user pull (Ananya). Strong week-2 retention driver for active candidates.
2. **Daily-focused dashboard** — gates the surface for #3 and #4. Subsumes the entire tips/tour problem. Calms the homepage.
3. **Pipeline aging + follow-up drafts** — leverages cron infra we already have. Compounds with #2. Genuinely useful at the most demoralising stretch (post-application silence).
4. **Rejection-to-lesson** — smallest build, biggest relationship payoff. Differentiating in a category that mostly ignores this moment.

Each is 1–2 weeks of focused work. None require schema redesign beyond the `Lesson` table for #4. They reinforce each other.

---

## What this doc is not

- Not a tactical engineering spec — each idea will need its own when we commit to building it.
- Not a replacement for Force the Path v2 — that addresses *activation* (getting the user through onboarding). This addresses *retention* (keeping them after).
- Not a list of every possible feature — it's the prioritised four that I'd build before considering anything else.

Open question for discussion: any of the four feel mis-prioritised? Anything obviously missing from the "calm competent ally" frame?
