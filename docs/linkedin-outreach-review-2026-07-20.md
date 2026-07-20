# LinkedIn Outreach System — Review (2026-07-20)

Triggered by Mayank's bug report (Generate → redirects to dashboard). Scope: everything touching LinkedIn/email outreach — the AI-generated templates, the static Email Templates library, the underlying strategy docs, and the plumbing connecting them.

## 1. What got fixed today (all pushed to `master`, live on Railway)

| Commit | Fix |
|---|---|
| `d48c590` | `requirePaid()` in `linkedin.ts` was the one paywall gate never disabled when payments were paused app-wide. Free accounts (Mayank) got a 402 nothing else in the app gives them. |
| `d48c590` | `LinkedInPage.tsx`'s 402 handler navigated to `/pricing`, a route deleted in the same rework — bounced through the catch-all straight to the dashboard, no error shown. Now shows a toast instead. |
| `07ae8db` | Added a "Tools" template: step-by-step guide to finding a recruiter's email via Hunter.io → RocketReach → Apollo.io, in that order, plus a verify-before-send step. |
| `07ae8db` | Added "Recruiter Follow-Up — Job You Already Applied For" template — distinct from the existing cold-outreach template, which has no application context. |
| `c1fd382` | Found the same dead-`/pricing`-link bug a second time: the "Back to pricing" button on the legal/terms page. Fixed to route home. |

That last one is the important meta-finding: **this bug pattern (something references `/pricing`, which no longer exists) happened twice independently.** Worth a five-minute `grep -rn "'/pricing'"` sweep next time anything routing-related changes, since it's the kind of thing that only surfaces when a real user hits it.

## 2. Structural issue: two different LinkedIn outreach playbooks, unreconciled

The app currently teaches **two different sequences** for the same goal (LinkedIn relationship-building → job leads), in two different tabs, and they don't fully agree with each other:

**A. AI-generated (LinkedIn tab → Outreach, `server/rules/linkedin_outreach_rules.md`)**
4 messages: Connection Note → First Message → After-Conversation Follow-Up → Direct Ask.
Also shows a collapsible **"7-Step Networking Playbook"** above the generator (find people → comment before connecting → connection note → first message → have the conversation → stay on radar → convert).

**B. Static (Email Templates tab, category "LinkedIn Outreach")**
6 numbered templates: Connection Request → Post-Acceptance (No Ask) → Engagement Comment → 15-Minute Ask → Post-Chat Follow-Up → Soft Ask — with explicit multi-week/multi-month pacing between each.

Problems this causes:
- The AI flow's own "7-Step Playbook" tells the user to **"comment before you connect"** (step 2) — but the AI generator never produces a comment template. That template only exists in the *other* tab (static template #3, "Engagement Comment"). A user following the playbook literally has to go find the other tab mid-sequence, and nothing tells them to.
- The two sequences don't line up 1:1 (4 AI messages vs. 6 static ones), and the static set is far more explicit about time-gating ("weeks", "months") than the AI set is. A client reading both could reasonably conclude they're two different strategies, not one.
- The AI version's "Direct Ask" and the static version's "Soft Ask" / "15-Minute Ask" are three different framings of the same moment (the eventual ask) with different scripts and different guidance on when to use it.

This isn't a "delete one" problem — the AI-generated one is *personalized* (uses the candidate's real background + the target's real company/topic), and the static one is a *reference library* someone browses without filling in a form. Both have a reason to exist. The fix is cross-referencing, not consolidation:
- The static "LinkedIn Outreach" category description (or a banner above it) should say something like *"Prefer personalized versions of these? Generate them from your real target's details in the LinkedIn tab."*
- The AI tab's 7-step playbook should link to (or inline) the Engagement Comment template it references in step 2, since the AI generator doesn't produce one.

## 3. Email Templates library — content review

16 templates across 6 categories now (Outreach, Follow-Up, Interview, Networking, Offer, Tools). Genuinely strong copywriting — specific placeholder guidance (`[specific reason — e.g., "..."]`), realistic tone, and the inline `(Tip: ...)` coaching notes are a good pattern that should probably spread to the non-LinkedIn templates too (currently only the 6 LinkedIn ones and the two I just added have tips; `application-followup`, `interview-thankyou`, `salary-negotiation`, etc. don't).

Two near-duplicates worth a second look, now that there are three "cold-ish recruiter" templates:
- `recruiter-intro` ("Cold Outreach to Recruiter") — no context, pure prospecting.
- `recruiter-job-followup` (new) — anchored to a specific application already submitted.
- `linkedin-15-minute-ask` — also a cold-ish ask, but explicitly gated behind weeks of prior engagement.

These are legitimately different situations, but nothing in the UI tells a user *which one applies to them right now*. A one-line "use this when…" under each title (the way the LinkedIn set already has parenthetical timing tips) would remove the guesswork — right now it's on the user to infer from the title alone.

## 4. Profile-generation rules (`linkedin_hub_profile_rules.md`)

High quality — clear banned-phrase lists ("passionate", "results-driven", "synergy"), concrete before/after examples, sensible section-length limits enforced server-side as a backstop. One soft mismatch: the "Context Sensitivity" section includes guidance for "Senior/executive: lead with business outcomes, P&L, team scale," which sits oddly next to the rest of the app's actual audience — international grads/early-career candidates navigating limited AU experience (that's the framing throughout the outreach rules and the static templates). Not broken, just scoped a bit wider than the product's actual ICP; low priority.

## 5. Recommendation priority

1. **Do soon:** add the "which template applies to you" one-liners to the recruiter-facing Outreach templates (cheap, removes real confusion).
2. **Do soon:** cross-link the two LinkedIn playbooks (one banner line in each direction) so the 7-step playbook's step 2 isn't an orphaned reference.
3. **Nice to have:** extend the `(Tip: ...)` pattern to the four templates that don't have one yet.
4. **Low priority:** trim or re-scope the executive-level branch of the profile-generation context rules to match the actual client base.
