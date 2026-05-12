# UI Polish Sprint — 11 May 2026

Capturing analysis and decisions for the feedback batch from this session.

---

## 1. Typography / Paragraph Spacing

**Problem:** Multi-paragraph instructional text (like the cover letter template in Image 1) is dense — no visual breathing room between paragraphs.

**Verdict:** The main UI's type hierarchy is already solid (4xl bold for hero headings, xl for subheads, sm/xs for metadata). The issue is specifically in **instructional/AI copy blocks** that render raw paragraphs without spacing. These need `mb-4` or `space-y-4` between paragraphs, and `leading-relaxed` on body text.

**Changes needed:**
- Add a `prose-paragraphs` utility pattern to instructional blocks (cover letter templates, diagnostic insight blocks)
- Not a global rework — surgical additions in the 2-3 places dense instructional text appears
- Verdict: **Yes, do it** but scoped and surgical — not a full design system overhaul

---

## 2. Resume Modal — Copy Rewrite (ProfileBank)

**Location:** `src/components/ProfileBank.tsx` lines ~1664–1694

**Current problems:**
- "40% complete / missing 60%" framing sounds like a quality score — users think their resume is bad, not that the _achievement bank_ is what unlocks the full power
- "Make it interview-ready →" with em dash is vague (user thought it was a button) — remove entirely

**New copy direction:**

```
[Bold heading block]
You know it's not working. Ready to fix it?

In just 7 minutes, we show you exactly what to change and why it matters.
```

Subtext (smaller, muted):
```
We'll coach you through each achievement — this is what turns generic applications into interview calls.
```

CTA stays: "Download & Continue Building →" — but with gradient treatment (see §3)
Remove: "Make it interview-ready →" link entirely

**Decision needed:** Does the user want the paragraph break WITHIN the modal body (i.e. the two-sentence format split across two visual lines with space between) or is a single strong statement okay? → User confirmed two-paragraph break style from Image 1 feedback.

---

## 3. CTA Button Gradient

**Reference:** Image 3 — the "business executive" text uses `orange → pink → purple` gradient.

**Target buttons:**
1. "Download & Continue Building" in resume modal (ProfileBank)
2. "Build your interview-ready resume" on diagnostic page (ReportExperience)

**Implementation:**
```css
background: linear-gradient(135deg, #f97316 0%, #ec4899 50%, #7c3aed 100%)
```
White text, `font-black`, subtle `shadow-lg` with a mixed-color shadow (`rgba(236,72,153,0.4)`). These are the **hero CTAs** — the only buttons getting this treatment. Everything else stays standard.

**Note on skill guidance:** frontend-design skill says avoid "cyan-purple gradients, neon on dark." This gradient is orange-to-purple, user-specified, and on a primary action button — not decorative gradient text. It's the exception, not the rule.

---

## 4. MatchEngine — Duplicate Banners

**Location:** `src/components/MatchEngine.tsx` lines ~300–343

**Two banners both saying "browse job feed":**
1. Teal "NEW" banner → links to `/job-feed` (wrong route — should be `/jobs`)
2. Amber "BETA" banner → links to `/jobs` (correct)

**Decision:** Remove the teal "NEW" banner entirely. The amber "BETA" banner is better positioned (inside the card, links correctly, has a "Browse →" CTA). No need for two.

---

## 5. Job Feed — Location Not Populating

**Location:** `src/pages/JobFeedPage.tsx` + backend route

**Problem:** Onboarding collects location but `profile.targetCity` / `profile.targetRole` aren't being populated, so the feed shows "Target role and city required."

**Investigation needed:** Check what field name onboarding saves location under vs what the job feed route queries. Likely a field name mismatch (`location` vs `targetCity`).

**Fix:** 
1. Backend: map onboarding `location` → `targetCity` at save time, OR read both fields in the feed query
2. Frontend error state: if profile is incomplete, improve the empty state UX — link directly to the onboarding field that's missing rather than "Go to Profile & Achievements" (vague)

**"Rework this page"** — the user wants the empty/error state improved. Design for the case where they've done onboarding but the job feed hasn't built yet (building state) vs truly missing data.

---

## 6. Dashboard — Header + Greeting + Copy

**Location:** `src/App.tsx` — `Dashboard` component, lines ~116–120

### 6a. Time-aware greeting with variety

Current: single string per time block.

New: 3 options per period, selected randomly on each render (but deterministically by date so it doesn't flicker on re-render — seed with `new Date().toDateString()`).

```ts
const greetings = {
  morning: ['Rise and shine', 'Morning', 'Good morning'],
  afternoon: ['Good afternoon', 'Afternoon', 'Hey there'],
  evening: ['Good evening', 'Evening', 'Evening — still at it'],
};
```
Simple seeded selection (no LLM). Use `toDateString()` hash so the greeting is consistent within a calendar day.

### 6b. Remove "Your Diagnosis" card

Lines 123–154. Remove entirely. The report is still accessible via the sidebar link and the onboarding flow — no need to surface it as a dashboard card.

### 6c. Dashboard subtitle copy options

Current: "Here's your job application intelligence overview."

Options I'd suggest:
- **"Drop a job description. Get a matched resume in 3 minutes."** — functional, sets expectation
- **"Match roles. Build your case. Land interviews."** — rhythmic, positioning statement
- **"Your career documents, matched to every role."** — describes the product
- **User's suggestion:** "generate resumes and cover letters that land interviews here" → refined: "Generate resumes and cover letters that land interviews."

My pick: **"Drop a job description. Get a matched resume in 3 minutes."** — most action-oriented, tells users exactly what to do first.

→ Needs user decision.

### 6d. Remove pipeline status cards (Saved/Applied/Interview/Offer/Rejected)

Lines 231–244. The user says they "add no value." 

BUT: looking at Image 8, when data exists (Saved: 1, Applied: 1) the user said "I can see the value of this."

**Proposal:** Show pipeline cards **only when total applications > 0** (progressive disclosure). When the user is fresh, the dashboard is clean. As they use the tracker, the cards appear.

Also **remove** the "Active Applications" counter card (the large `0` in the right column) — it's the same data and it's empty. If we hide the pipeline cards when count is 0, this goes too.

---

## 7. Application Workspace Header Cleanup

**Location:** `src/components/ApplicationWorkspace.tsx` lines ~800–846

**Changes:**
1. Remove match score circle (`state.matchScore` display, lines ~762–773) from the header
2. Remove "CHANGES SAVED" pill (lines 809–820)  
3. Rename "Edit Selections" → "Choose Achievements"
4. Make docx/pdf export buttons smaller — reduce padding and text size

The match score and grade are still accessible in the DimensionsIsland below the header (lines 1199–1205), so removing from the header doesn't lose the data.

**On simplification:** The header bar already shows role/company, tab navigation, and export controls. Removing the noise (match score, save status) makes it a clean action bar. The user saw value in the workspace concept after using it — the goal is to keep the functionality, trim the clutter.

---

## 8. Wizard Congratulations Screen

**Problem:** Screen flashes by too quickly.

**Fix:** Increase the display duration/animation hold time before auto-advancing. Alternatively, add a "Continue →" button so the user controls when to proceed. This is the safer UX choice — the user can read at their own pace.

**Recommendation:** Add a manual "Continue →" button. Remove auto-advance or make it much longer (e.g. 4–5 seconds with a visible countdown).

---

## Deliberation Items Needing User Input

1. **Dashboard subtitle copy** — which direction? (options in §6c)
2. **Pipeline status cards** — hide when count=0 (progressive), or remove entirely?
3. **"Active Applications" counter** — remove entirely or keep on dashboard?
4. **Wizard congratulations screen** — auto-advance with longer delay, or add manual "Continue →" button?
