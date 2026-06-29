# LinkedIn Hub Redesign — Implementation Plan

**Audience:** the executing agent (Kimi). This is self-contained. Do not re-derive context; everything you need is below.

**One-line goal:** Turn the Profile tab from an abstract "generator toolkit" (form + stack of grey cards) into a **live mock that looks like a real LinkedIn profile**, filled in section-by-section by generating each piece in place — so students viscerally see what they're building and understand exactly what to do.

**Governing philosophy (read this first — it overrides any temptation to gold-plate):**
The profile is NOT the prize. It's a 30-second hygiene check before the thing that actually moves the needle: **outreach.** When a stranger gets a connection request, they click the name. The profile's only job is to make that click land as *"yeah, this person is legit"* — nothing more. So:
- **The tool does the work FOR them.** Generation should produce a finished, already-good result that the student can copy as-is. We are not handing them a blank canvas and a pile of knobs — we hand them a strong draft and say "this is good, use it." Optimize it on their behalf.
- **Don't let them overthink.** This is the prime directive. Minimize choices, minimize editing affordances, minimize anything that invites fiddling. A strong headline, a short solid About, a few outcome bullets, the right skills — presented as done. Avoid the major mistakes; that's the bar, not perfection.
- **Anti-obsession by design.** The UI must actively discourage rerolling and tweaking. Every flow biases toward "this is fine → copy it → move on."
- **The CTA is outreach.** The entire Profile tab funnels to one action: **Start outreach →**. The moment the profile is "good enough," push them there. Educate them that outreach (not profile polishing, not more applications) is what gets the role.

---

## 0. Decisions already made (flippable, but build to these)

1. **Regen behavior = SOFT NUDGE.** Students can re-generate the photo and About, but after the first result the UI pushes them to "use it and move on." Do NOT hard-lock generation. (Rationale: a hard one-shot lock traps people on a bad first result.) Keep existing backend limits unchanged (`MAX_DAILY_HEADSHOTS`, default 3/day).
2. **Scope = FULL PROFILE SHAPE.** Build the complete profile in real LinkedIn top-to-bottom order: cover/banner → photo → name/headline/location/open-to-work → About → Experience → Skills. ("Full" = the profile shape, NOT a pixel-perfect clone of LinkedIn's social-proof chrome — see §3a for what's deliberately omitted.)

3. **INTERACTION MODEL = ONE-SHOT, DONE-FOR-THEM (this resolves the philosophy↔affordances tension — obey it over any older wording in the build steps).** The tool optimizes the profile *for* the student and presents it finished. Concretely:
   - **One primary action: `Generate my profile`.** A single call fills every section at once (headline, About, experience bullets, skills, open-to-work, banner copy). There are **NO per-section Generate buttons.** Each section's empty/ghost state is only what shows *before* that one generate; after it, every section is filled and good.
   - **Editing stays, but quiet.** Inline edit is available (small pencil), but de-emphasized — no prominent char counters or "make longer" affordances competing for attention. The default message is "this is good, copy it."
   - **Regenerate is a faint secondary text link**, not a button, carrying the "drafts rarely improve with rerolls" note. Applies per-section after the first generate (still re-calls `/generate` and swaps one key — unchanged backend).
   - **Readiness is a paste-checklist, not a score to grind.** It tracks "what to copy into LinkedIn and where" and, once the few items are done, surfaces `Start outreach →`. It must not invite the student to keep regenerating to chase a number.

If the owner later says "hard lock" or "core only," those are localized changes — noted inline where relevant.

---

## 1. The core reframe

Current Profile tab = a form (target role) → one big "Generate" button → a vertical stack of identical grey `SectionCard`s → banner → headshot **at the bottom**.

Two concrete problems to fix:
- **Abstraction:** grey text cards don't show the student what their profile will look like.
- **Wrong order:** banner + photo currently render LAST. On a real profile they are the FIRST things at the top. Reorder to match reality.

New model: **edit content in the place it will appear** (like Canva/Webflow/Notion). Each section starts as a faded realistic example, has ONE primary action, and once generated looks like a real, strong profile section.

---

## 2. Files in play (all already exist unless marked NEW)

Frontend:
- `src/pages/LinkedInPage.tsx` — page shell, owns generate state + API calls. **Rework the `profile` tab render.**
- `src/components/linkedin/ProfileStrip.tsx` — current tiny avatar strip. **Replace** with the new intro card (or repurpose).
- `src/components/linkedin/ProfileSections.tsx` — current target-role input + Generate-all + stack of SectionCards. **Rework** into the profile-shaped composition.
- `src/components/linkedin/SectionCard.tsx` — reuse its copy/regenerate/char-count logic; restyle into LinkedIn-section look.
- `src/components/linkedin/HeadshotGenerator.tsx` — reuse as-is for the photo flow (embed/trigger from the intro card photo circle).
- `src/components/linkedin/BannerCanvas.tsx` / `BannerCopyPicker.tsx` — reuse for the cover region.
- `src/components/linkedin/OutreachTemplates.tsx` — leave logic alone; only align styling to the new look.
- `src/components/linkedin/types.ts` — `LinkedInProfileData`, `BannerConfig`, etc. No type changes required.
- **NEW** `src/components/linkedin/ProfileIntroCard.tsx` — cover + photo + name/headline/location/open-to-work.
- **NEW** `src/components/linkedin/ProfileSectionBlock.tsx` — the LinkedIn-looking About/Experience/Skills block (ghost state + generated state + copy + regenerate + why + how-to-paste). May supersede `SectionCard` usage on this page.
- **NEW** `src/components/linkedin/ReadinessBar.tsx` — the "X of 6 ready" meter + "Start outreach →" CTA.

Backend (NO required changes for v1):
- `server/src/routes/linkedin.ts` — `/generate` already returns ALL sections in one call; `/outreach`, `/headshot`, `/headshot/save` unchanged. Per-section regenerate already works (re-calls `/generate`, picks one key).

Design tokens (USE THESE — do not hardcode random hexes except the LinkedIn blue):
- `src/lib/theme/warmTokens.ts` → `warm.colors.*`, `warm.radius.*`, `warm.shadow.*`, `warm.spacing.*`.
- LinkedIn blue used throughout existing code: `#0A66C2`. Keep it for LinkedIn-flavored accents/buttons.
- Open-to-work green ring: use `#2A9D6F` (`warm.colors.success`) or LinkedIn's `#01754F` — pick the warm token for consistency.

Profile fields available (from `useProfile()` → `CandidateProfile`): `name`, `location`, `targetRole`, `seniority`, `headshotUrl`, `skills`. Generated content fields (from `/generate` → `LinkedInProfileData`): `headline`, `about`, `skills[]`, `experienceBullets[]`, `openToWork`, `bannerCopies[]`.

---

## 3. Target layout (Profile tab)

### 3a. Visual reference — match the real LinkedIn top card
The owner provided a real LinkedIn profile screenshot (Kushag Rai) as the precise visual target. Replicate the **structure and order** of LinkedIn's own top card so it reads as obviously, instantly familiar — but only the elements that matter for "good enough." Element inventory from the screenshot, top to bottom:

1. **Cover/banner** — full-width strip, rounded top corners, subtle light-blue gradient + faint tech texture. Bell/notification glyph sits top-right just under it (cosmetic only; optional).
2. **Profile photo** — circular, ~96–120px, **overlapping the banner's bottom-left**, with a thick white ring. (This is THE detail that sells the LinkedIn look — get the overlap right.)
3. **Name row** — bold name + small verified-shield glyph + faint `He/Him · 1st` (pronoun/degree text is cosmetic; keep it subtle or omit).
4. **Headline** — directly under the name, normal weight, dark grey; LinkedIn renders certain keywords as blue links (e.g. "IT") — we don't need clickable links, just the single headline line(s).
5. **Location line** — `Melbourne, Victoria, Australia · Contact info` (small, muted; "Contact info" in LinkedIn blue). Put the **Open to work** chip here.
6. **Connections** — `324 connections` in blue (cosmetic; can fake a sensible number or omit).
7. **Action buttons** — filled blue `Message` + outlined `More`. In OUR tool these become the generate/edit affordances, not real LinkedIn buttons — keep the *shape* familiar but repurpose.

**Deliberately OMIT** (real LinkedIn has them, we don't need them for "good enough"): the right-hand current-company / university mini-cards, the Activity/followers feed, the reposted-post card, "Show all posts." These add zero to the hygiene goal and would bloat the build. Experience + Skills below the top card is all we add.

The ASCII mock below is the OUR-TOOL adaptation of that screenshot (generate-in-place affordances replacing LinkedIn's static chrome):

```
  Make your profile worth finding
  When you reach out, the first thing people do is click your
  name. Let's make that 30 seconds count.

  Profile readiness  ●●●○○○  3 of 6        [ Start outreach → ]
  ────────────────────────────────────────────────────────────
  ★ Start here: your Photo, Headline and About are what a
    stranger judges in the first 5 seconds. Nail those first.

  [ ✨ Generate my profile ]   ← single action; fills every
       section at once. (Shown before first generate; after it,
       sections render filled as below. No per-section buttons.)

  ┌─ INTRO CARD ──────────────────────────────────────────────┐
  │  [        cover / banner image        ]      [✨ Banner]    │
  │   ( ⬤ )  ← photo, overlapping cover, green "open" ring      │
  │          [📷 Generate photo]                                │
  │  Pawan Hewage                                    [✏] [⧉]    │
  │  Analytical Chemist | HPLC · QC · UV-Vis …  ← headline      │
  │  Melbourne, AU · 🟢 Open to work                            │
  │  why: your headline rides next to your name everywhere you  │
  │       comment, message or appear in search.                │
  └───────────────────────────────────────────────────────────┘

  ┌─ About ───────────────────────────────────────── [⧉] [✏] ┐
  │ (ghosted example until generated) Chemistry graduate at…   │
  │ how to use: LinkedIn → your profile → About → paste        │
  └───────────────────────────────────────────────────────────┘

  ┌─ Experience ────────────────────────────────────── [⧉] ┐
  │ ▣  QC Trainee · Lanka Hospitals                          │
  │    • Maintained 98% accuracy across QC analysis…         │
  └─────────────────────────────────────────────────────────┘

  ┌─ Skills ──────────────────────────────────────────── [⧉] ┐
  │ (HPLC) (UV-Vis) (Quality Control) (GLP) (+4)             │
  └─────────────────────────────────────────────────────────┘
```

Keep the page `maxWidth: 740` and the existing `Profile | Outreach` tab control and `SectionIntroBanner`.

---

## 4. Build steps

### Step 1 — Intro card (`ProfileIntroCard.tsx`)
Replicates LinkedIn's top card.
- **Cover region:** full-width strip (height ~140px, `warm.radius.card` top corners). If a banner has been built (`bannerConfig.mainMessage` set), render the `BannerCanvas` output as the cover; otherwise a faded placeholder gradient + a `✨ Banner` button (top-right) that opens the existing banner editor flow (`BannerCopyPicker` → `BannerCanvas`). Reuse the existing `bannerConfig`/`bannerEditorOpen` state already in `LinkedInPage`.
- **Photo:** circular avatar (~96px) overlapping the cover's bottom-left (negative margin, like LinkedIn). Shows `headshotUrl` if present, else initial letter (reuse `ProfileStrip` avatar logic). A small camera button on the avatar opens the headshot flow (`HeadshotGenerator`) — render it inline below the card or in a small modal/expander. When `openToWork` content exists, draw the green ring around the photo (2–3px `warm.colors.success` border) + a `🟢 Open to work` chip near the location line.
- **Name:** `profile.name` (fallback "Your Name").
- **Headline:** the generated `headline`. Editable inline (pencil → textarea) + Copy button. Ghost state before generation: faded example + a small `Generate` button.
- **Location line:** `profile.location` + open-to-work chip.
- **Why-this-matters caption** under headline (small, `warm.colors.textMuted`): "Your headline rides next to your name everywhere you comment, message or appear in search."

### Step 2 — Section blocks (`ProfileSectionBlock.tsx`)
A reusable block used for About, Experience, Skills. Props: `label`, `why` (string), `howToPaste` (string), `content`, `generated` (bool), `onRegenerate`, `regenerating`, `onContentChange`, plus optional `renderContent` (for Skills pills / Experience bullets). **Note (per §0.3): there is NO per-section `onGenerate` / Generate button.** The whole profile is filled by the single top-level `Generate my profile` action; these blocks only render a ghost state (before that first generate) or the filled state (after).
- **Ghost/empty state (pre-generate only):** faded realistic example text. No button here — the single top-of-page `Generate my profile` action fills it. The ghost is purely a preview of what's coming.
- **Generated state:** real content styled like a LinkedIn section card (white surface, `warm.radius.card`, `warm.shadow.soft`), with a header row: label (left) + `Copy ⧉` and a quiet edit-pencil (right). Below content: the `howToPaste` line in `warm.colors.textMuted`, and a faint `↻ regenerate` text link (secondary, per §0.3 / Step 5).
- Reuse the copy/char-count logic from existing `SectionCard.tsx` (don't reinvent clipboard handling).
- **Skills:** render as pills (reuse the existing pill markup in `ProfileSections.tsx` lines ~88–98).
- **Experience:** render `experienceBullets` as a LinkedIn experience entry — a small logo placeholder square + role/company line + bulleted list.

**Length/quality bar — "good enough, not perfect":** Each section is deliberately short. The About should land around **8–10 lines / 3–4 short paragraphs max** — long enough to be credible, short enough that nobody agonizes over it. Headline = one line. Experience = 3–4 outcome bullets. Skills = ~8 pills. The ghost examples should model this brevity so students copy the *length*, not just the content. Do not add "expand"/"make longer" affordances — the bias is toward trimming and moving on.

Per-section copy:
- About → why: "This is your pitch. Most people read the first two lines, then decide whether to keep reading. Keep it to a few short paragraphs." howToPaste: "LinkedIn → your profile → About → Edit → paste."
- Experience → why: "Recruiters scan for outcomes, not duties. These bullets lead with results." howToPaste: "LinkedIn → Experience → your role → Edit → paste bullets."
- Skills → why: "Skills drive LinkedIn search. The right ones make you findable." howToPaste: "LinkedIn → Skills → Add → paste each."

### Step 3 — Readiness bar (`ReadinessBar.tsx`)
- Compute completion over **6 items**: `headshotUrl` (photo), banner built, `headline`, `about`, `experienceBullets.length`, `skills.length`. (openToWork can ride along with the intro card; keep the count at 6 using photo+banner+headline+about+experience+skills.)
- Render `●●●○○○  X of 6` + label "Profile readiness."
- When `X === 6`, show a prominent `Start outreach →` button that calls `setTab('outreach')`. Before that, show it disabled/ghosted with a tooltip "Finish your profile first."
- **Frame it as a paste-checklist, NOT a score to grind (per §0.3).** The items become complete as content is generated/present and (ideally) copied — it's a "here's what to put on LinkedIn and where" tracker. Do not add anything that nudges the student to regenerate repeatedly to move the number.
- **Operational point:** the profile is the prerequisite; outreach is the goal. The bar exists to make profile setup feel finite and then push the student onward — not to be an endless playground.

### Step 4 — Weak-spot / "start here" highlighting
- v1 heuristic (no backend work): highlight the highest-impact INCOMPLETE sections among **Photo, Headline, About** with a subtle "★ Start here" treatment (gold accent `warm.colors.accentGold`, or a left border). Once those three are done, drop the banner.
- Copy: "Start here: your Photo, Headline and About are what a stranger judges in the first 5 seconds. Nail those first."
- This honors the owner's "students don't all need every section — point them at the few that matter." The single generate (per §0.3) fills everything in one shot; "start here" then steers attention to the few sections that actually move the needle (Photo, Headline, About) so the student copies those and moves on rather than perfecting all of them.
- (Future, out of scope: use the existing `diagnosticReport.reportMarkdown` the backend already loads to do a real per-section weakness scan.)

### Step 5 — Regen = soft nudge (anti-perfectionism)
Apply to **About** and the **headshot** specifically:
- First generation: primary button reads `✨ Generate`.
- After a result exists: the PRIMARY action becomes `Copy` / `Use this`. `Regenerate` demotes to a small secondary text link.
- Add a one-line note next to Regenerate: "Drafts rarely improve with rerolls — tweak it yourself instead."
- Keep backend limits unchanged. Do not block; just de-emphasize.
- (If owner later flips to HARD LOCK: gate `onRegenerate` to fire at most once per section and show a confirm dialog before "spending" it.)

### Step 6 — Wire it in `LinkedInPage.tsx`
- Keep existing state: `profileData`, `generating`, `regeneratingSection`, `bannerConfig`, `bannerEditorOpen`, `headshotUrl`, `targetRole`, `handleGenerateAll`, `handleRegenerate`, `handleSectionChange`.
- The `targetRole` input still exists but move it into a small "tune output" affordance (collapsible), not the headline of the page — generation should feel like filling a profile, not configuring a form.
- Replace the `tab === 'profile'` block: render `ReadinessBar`, the start-here banner, `ProfileIntroCard`, then `ProfileSectionBlock` × (About, Experience, Skills).
- **Single generate, per §0.3.** `handleGenerateAll` (one API call filling every section) is THE generate action — surface it as one prominent `Generate my profile` button (in/near the intro card). There are NO per-section Generate buttons. Per-section **regenerate** (the faint secondary link) calls the existing `handleRegenerate(section)`, which re-calls `/generate` and swaps that one key — unchanged. Before the first generate, all section blocks show ghost previews; after it, all are filled at once.

### Step 7 — Outreach tab (this is the destination — make it earn the handoff)
The Profile tab funnels here, so this tab must *pay off* the "outreach is what matters" promise. Two parts:

**(a) Logic — no changes.** Keep the existing generator (first name / company / topic / question → 4 sequenced templates: connection note, first message, after-call follow-up, direct ask) and the existing collapsible 7-step playbook in `OutreachTemplates.tsx`. Only restyle surfaces to match the new look (consistent card radius/shadow/tokens).

**(b) Education — port the client outreach guide into the app.** The owner already hands clients a polished PDF (`Pawan-Outreach-Guide.html`) full of teaching that currently lives NOWHERE in the product. Bring the high-value, evergreen pieces in as lightweight, collapsible education modules above/around the generator (static content, no backend). Port these specifically:
- **"Why outreach beats applications"** — the core mindset flip. *"Applications put you in a queue. Outreach puts you in a conversation."* Include the Outreach-mindset vs Application-mindset two-column contrast (already a clean do/don't visual in the guide).
- **The daily habit** — *"10 outreach actions per day"* (5 connection requests + 3 follow-ups + 2 cold emails ≈ 45 min). This is the concrete behavior that moves the needle; make it a small target card.
- **The follow-up sequence** — Day 1 → Day 5–6 → Day 12–14 → move on. Most people don't reply to the first message; that's not a no. Render as the existing sequence-step visual.
- **"What success looks like"** — week 1 / 2 / 4 / 8 realistic milestones, so students don't quit at week 1 silence. Reset expectations: most won't reply, it's a numbers game, not personal.
- **What NOT to do** — blank requests, asking for a job in msg 1, essays, blasting 50 identical messages, attaching a resume to the first touch, giving up after 2 days.

Keep these collapsed by default (don't wall off the generator); the playbook pattern already in the file is the right interaction model. Email-specific tactics (Hunter.io, address patterns) are lower priority — include only if cheap.

---

## 5. Visual / styling rules
- Use `warm` tokens for surfaces, borders, text, radius, shadow. LinkedIn blue `#0A66C2` for LinkedIn-flavored accents and primary buttons (consistent with existing code).
- Cards: `background: warm.colors.bgSurface`, `border: 1px solid warm.colors.borderWhisper`, `borderRadius: warm.radius.card` (16), `boxShadow: warm.shadow.soft`.
- Ghost states: same shape, faded text (`warm.colors.textMuted` at low opacity), single Generate button.
- Keep `maxWidth: 740` centered. Mobile: cover/photo/sections stack naturally; ensure the photo overlap and cover scale down without clipping.
- Respect existing `spin` keyframe animation already used for loaders.

---

## 6. Acceptance criteria
1. Profile tab visually reads as a LinkedIn profile: cover at top, circular photo overlapping it, name + headline + location, then About, Experience, Skills — in that order.
2. Each section has: a ghost/example empty state, a single primary Generate action, a Copy button, a "why this matters" line, and a "how to paste into LinkedIn" line.
3. Photo and banner generation are reachable from the TOP of the page (intro card), not the bottom.
4. A readiness meter shows `X of 6`; at 6/6 a working `Start outreach →` button switches to the Outreach tab.
5. "Start here" highlighting calls out Photo + Headline + About while incomplete.
6. After About / headshot have a result, the primary CTA becomes Copy/Use-this and Regenerate is de-emphasized with the "rerolls rarely help" note.
6b. Profile tab visibly funnels to outreach (readiness → Start outreach), and the Outreach tab carries the ported education (why outreach > applications, daily-10 habit, follow-up sequence, week-by-week expectations, what-not-to-do) as collapsible modules — no backend changes.
7. No backend changes; existing `/generate`, `/outreach`, `/headshot`, `/headshot/save` still used as-is.
8. `npm run build` (frontend) passes with no type errors; existing tests still green.

## 7. Explicitly OUT of scope (v1)
- Real diagnostic-based weakness scan (use static "start here" heuristic instead).
- Hard one-shot generation lock.
- Any backend/schema/migration changes.
- Changes to Outreach tab logic.
- Persisting generated profile text server-side (current behavior is client-state only — keep it).

---

## 8. Suggested commit sequence
1. `feat(linkedin): ProfileIntroCard — cover + photo + headline at top`
2. `feat(linkedin): ProfileSectionBlock for About/Experience/Skills with why + paste hints`
3. `feat(linkedin): readiness meter + start-outreach handoff`
4. `feat(linkedin): start-here weak-spot highlighting`
5. `feat(linkedin): soft-nudge regen framing for photo + About`
6. `feat(linkedin): port outreach guide education into Outreach tab + restyle`

Branch off `master` (do not commit directly to master). Keep each step independently buildable.
