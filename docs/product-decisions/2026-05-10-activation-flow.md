# User Activation & Document Generation Flow
*2026-05-10 — planning document, not yet approved for build*

---

## Issues to fix first (quick wins, no discussion needed)

### 1. "Marketings" grammar bug — `ProcessingScreen.tsx:60`
The code does `role.toLowerCase()` then appends `s` — so "Marketing" becomes "marketings".

**Fix:** Static demonym map, no LLM call. Falls back to `"${role} professionals"` for anything not in the map.

```typescript
const ROLE_DEMONYMS: Record<string, string> = {
  marketing: 'marketers',
  sales: 'salespeople',
  engineering: 'engineers',
  software: 'software engineers',
  finance: 'finance professionals',
  design: 'designers',
  product: 'product managers',
  hr: 'HR professionals',
  'human resources': 'HR professionals',
  operations: 'operations professionals',
  accounting: 'accountants',
  legal: 'lawyers',
  healthcare: 'healthcare professionals',
  nursing: 'nurses',
  education: 'educators',
  teaching: 'teachers',
  data: 'data professionals',
  management: 'managers',
  administration: 'administrators',
  logistics: 'logistics professionals',
  retail: 'retail professionals',
  hospitality: 'hospitality professionals',
};

function getRoleDemonym(targetRole: string): string {
  const key = targetRole.toLowerCase().trim();
  if (ROLE_DEMONYMS[key]) return ROLE_DEMONYMS[key];
  for (const [k, v] of Object.entries(ROLE_DEMONYMS)) {
    if (key.includes(k)) return v;
  }
  return `${targetRole} professionals`;
}
```

### 2. Redundant resume banner after download — `BaselineResumeBanner.tsx`
`handleDownload` shows the conversion modal but leaves the banner visible behind it. After a successful download, the banner should auto-dismiss so it never shows again. One-line fix: call `dismiss()` after the export succeeds.

---

## The core problem: Profile Bank is a dead end

Score 22. Long list of "Still Needed". No explanation of what any of it means or what to do next. This is the single highest-risk point in the product — users who can't construct a mental model here will churn.

**What the user is thinking when they land here:**
- "What is a Profile Bank?"
- "Why does it have a score?"
- "What does 70% actually unlock?"
- "Where do I even start?"

We are not answering any of these questions.

---

## Proposed full user activation flow

### Stage 0 → Onboarding (already built)
Upload resume → processing screen → diagnostic report delivered.

**Fix here:** Grammar demonym map above.

---

### Stage 1 → Dashboard (first visit after onboarding)
User arrives. They should see:

- Diagnostic score + top 2-3 findings (already there)
- Baseline resume banner (already there — fix the redundancy)
- **[NEW] "Next step" card** — a single prominent card that tells them exactly what to do right now. Not stats. Not activity. A directive.

```
┌─────────────────────────────────────────────────┐
│  Your profile needs work before documents shine. │
│                                                   │
│  Score: 22   ████░░░░░░░░░░  Target: 70          │
│                                                   │
│  [Build my profile →]                            │
└─────────────────────────────────────────────────┘
```

This card disappears when score ≥ 70 and is replaced by "You're ready to apply."

---

### Stage 2 → Profile Bank first visit (THE BIG GAP)

**A first-time modal fires.** One time only. This is the rules-of-the-game moment.

**Design:** Full-screen overlay, dark, high contrast. Three steps with icons. Single CTA.

**Headline:**
> "This is where your career lives."

**Body (3-step layout):**

```
[bank icon]  YOUR PROFILE BANK
──────────────────────────────────────────────────
①  Add your achievements.
   These are the stories that get you interviews.
   We pull them into every document we generate.

②  Hit 70% profile strength.
   That unlocks the job board, the workspace,
   and the full document engine.

③  Paste a job description. Get a resume and
   cover letter in under 3 minutes. Apply.
```

**CTA:** "Start with my work experience →"
This closes the modal and scrolls directly to the Work Experience section.

**Why this works:** It reframes "filling in a form" as "building the engine." Users who understand why they're doing something complete it at higher rates.

---

### Stage 3 → Profile completion (guided sequence)

Current state: sections listed in no particular priority. Users fill in whatever catches their eye.

**Proposed: priority-ordered completion nudges.**

Each section should have a small inline prompt that explains the scoring impact:

| Section | Score weight | Inline nudge |
|---|---|---|
| Work Experience | 15 pts | "Your biggest section — this feeds every resume we write" |
| Achievements | 20 pts base + 10 quality | "This is what separates you. Add 3+, hit 70." |
| Professional Summary | 10 pts | "We rewrite this for every job — give us the raw material" |
| Education | 5 pts | "Quick. Takes 2 minutes." |
| Skills | 3 pts | "Comma-separated, any format" |

**Achievement quality nudge** (already built — the How? modal) should be surfaced more visibly. Right now it's a small link. It should be a subtle banner within the achievements section when <50% have metrics:

> "Most of your achievements are missing numbers. A metric turns a duty into evidence."

---

### Stage 4 → Milestone moments (already built)

- 50% → LinkedIn Optimiser modal
- 70% → Job board + workspace unlock modal

**One addition:** After the 70% modal closes, don't just drop them back on the page. Add a second action inside the modal:

> "You're ready. Generate your first tailored resume →"

This CTA goes to `/application-workspace` with a `?firstTime=true` query param that triggers the workspace onboarding state.

---

### Stage 5 → Application Workspace first visit (SECOND BIG GAP)

Right now the workspace is blank. User lands with no idea what they're doing.

**Empty state redesign:**

```
┌─────────────────────────────────────────────────────┐
│                                                       │
│  Paste a job description.                            │
│                                                       │
│  We'll read it, match it against your profile,       │
│  and write you a tailored resume and cover letter     │
│  — usually in under 3 minutes.                       │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │  Paste the job description here...           │    │
│  │                                              │    │
│  │                                              │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  [Try with a sample job →]    [Analyse →]           │
└─────────────────────────────────────────────────────┘
```

"Try with a sample job" pre-fills a realistic job description in their target role so they can experience the full flow immediately without having to find a real listing first.

---

### Stage 6 → Document generation loop (THE MONEY LOOP)

This is the core flywheel. Resume + cover letter → apply → track → repeat.

**Current flow after JD analysis:**
1. Match score + achievement breakdown shown
2. User can generate resume or cover letter from the workspace

**Proposed changes:**

**a) Sequential prompt after resume generation:**
Don't just show "resume generated." Show:
> "Resume ready — want the cover letter for this role too?"
> [Generate cover letter →]  [Download resume]

This doubles document generation with almost no extra friction.

**b) Speed display:**
Show the generation time: "Generated in 1:52"
This reinforces the core value prop. Users share this kind of thing.

**c) One-click "Apply & Track":**
After both documents are ready:
> [Apply to this job →]
This opens the job URL and simultaneously creates a tracker entry pre-filled with the job title, company, and both document IDs.

---

### Stage 7 → Gamification layer

**Dashboard — always-visible stats (replace dead activity zeros):**

For new users with 0 applications, the current stats (Sent this week: 0, Interviewing: 0) create negative momentum. Replace with forward-looking framing:

```
┌──────────────────────┐  ┌──────────────────────┐
│  DOCS THIS WEEK      │  │  APPLICATIONS GOAL   │
│  1                   │  │  0 / 5               │
│  keep going          │  │  Set your weekly goal │
└──────────────────────┘  └──────────────────────┘
```

**Milestone toasts (fire once, stored in localStorage):**

| Trigger | Toast |
|---|---|
| First resume generated | "First one in the bag." |
| First application sent | "You're in the game." |
| 5 applications sent | "Building momentum." |
| First cover letter | "Full kit. Resume + cover letter." |
| 10 applications | "Consistent. This is how you land roles." |

**Weekly application goal:**
Let the user set a number (3, 5, or 10 per week). Dashboard shows a progress bar. Simple, no backend needed — localStorage.

**Speed record:**
After each generation, compare against their personal best. If they beat it: "Your fastest yet — 1:34."

---

## What we are NOT building (scope guard)

- No social proof numbers until we have real cohort data
- No AI calls for the demonym fix
- No complex backend for goal tracking — localStorage is enough
- No full gamification scoring system — toasts and counters only

---

## Priority order for build

### P0 — Fix before anything else (< 1 hour total)
1. Grammar demonym map in `ProcessingScreen.tsx`
2. Auto-dismiss banner after download in `BaselineResumeBanner.tsx`

### P1 — Activation gaps (the two dead ends)
3. Profile Bank first-time modal (rules of the game)
4. Application Workspace empty state + sample job
5. Sequential cover letter prompt after resume generation

### P2 — Momentum layer
6. "Next step" directive card on Dashboard
7. Post-70% milestone modal CTA → workspace
8. "Apply & Track" one-click after generation

### P3 — Gamification
9. Milestone toasts (first resume, first application, etc.)
10. Speed display on generation
11. Weekly goal setter (localStorage, no backend)

---

## Open questions for discussion

1. **Sample job description for workspace:** Do we hardcode one per target role, or use the same job for everyone? Hardcoded per role is better UX but more maintenance.

2. **Profile Bank modal — trigger condition:** Fire on first visit to `/workspace` ever, or fire every session until profile hits 50%? I'd lean toward: fire once, but if score is still <30 after 3 days, fire a gentler reminder.

3. **Weekly goal — where on dashboard?** Could be the "Next step" card itself: "Goal: 5 applications this week. 0 sent." Or a separate widget. Needs to not feel like homework.
