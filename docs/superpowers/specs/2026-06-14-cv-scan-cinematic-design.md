# CV Scan Cinematic Redesign — Design Spec

**Status:** Design, awaiting owner review before the implementation plan is written.

**Goal:** Turn the CV scan from a calm, ignorable reading experience into an immersive, emotional story that makes a distraught job-seeker feel evaluated, then understood, then desperate for the fix, and hands them to the app. The scan's job is to convert an upload into an email, then a signup.

**Guiding principle:** Give the diagnosis away free and brutally; gate the cure behind email; gate the app behind signup. The wow and the scare come from pacing, hierarchy, bold type, motion, and 2.5D depth, not from heavy 3D.

---

## 1. The spine: a fractured CV that heals as you scroll

One motif runs through the whole experience and solves three problems at once (wow, narrative cohesion, and the "do I scroll?" affordance):

- The user's CV appears **fractured into shards** during the wound.
- As the user scrolls through their story, the shards **travel down the page and reassemble**, passing in front of and behind the copy and images via depth and z-index (2.5D).
- By the fix/roadmap it is a **clean, glowing, whole** document.

This healing CV IS the scroll-companion the owner asked for: it morphs and changes depth as you scroll, and its motion is the signpost that there is more below.

---

## 2. Three surfaces

### 2.1 Landing — push to the scan
The hero's only job is to get the CV dropped. Keep the live upload card ("Scanning your CV...") as the primary action and the six-second hook headline. The journey illustration (`scan-landing.png`, the despair to stairs to success scene) is a **supporting band lower on the page** or a faint background, never the hero competing with the CTA. It is a full composition, not a blend overlay.

### 2.2 The scan — a judgment chamber
The instant the CV is dropped, the screen takes over full-screen (no side card). Their CV floats centre with depth and a slow tilt; a scanner beam sweeps it; analysis lines stream one at a time. It must feel like being X-rayed and judged. Hold tension for a few seconds, then the verdict "locks in" and it hard-cuts into the reveal. Preload the reveal assets during this wait.

Static copy (authored, verbatim, no em or en dashes):
- "Reading your layout the way the software does."
- "Seeing what actually reaches a human."
- "Running the six-second test."
- Lock-in line: "Verdict locked."

### 2.3 The reveal — scroll-driven story, slap first
Rebuild the current click-through beats (`src/components/landing/ScanReveal.tsx`) into a pinned, scroll-triggered cinematic sequence (GSAP ScrollTrigger). Beats, in order:

1. **The slap (wound).** Full-bleed, oversized animated type. The brutal verdict lands first and alone, no soothing paragraph above it. The consequence is named in honest, general terms (silence, filtered out, never reaches a human), never an invented per-person statistic. Image: `scan-wound-*`. The CV is fully fractured here.
2. **What costs you (stakes).** The sharp flaws reveal one by one as red fractures on the CV; the silence/cost line lands. Image: `scan-stakes-*`.
3. **Why it happens (relief).** Tone shifts, "this is not a talent problem", the CV stabilises. Image: `scan-relief-*`.
4. **Translation.** "You wrote vs they hear vs write this instead" cards flip in 2.5D. (No dedicated image; the cards are the visual.)
5. **The fix tease + email wall.** Two quick wins burst in (success micro-interaction), then the gate. Image: `scan-wall-*`. Wall copy keeps the value anchor already written.
6. **Post-email roadmap + bridge.** The roadmap as a path the healing CV travels; it becomes whole and glowing; ends on the app bridge (visa-sponsor hook, free to start). Image: `scan-cure-*`.

Mobile: scroll-pinning is fragile on phones. Mobile falls back to the existing tap-advanced beats with the cinematic styling (type, images, micro-interactions) layered on, minus the pinned scroll choreography.

---

## 3. Image system

Source art lives in `public/images/scan/` with messy names (spaces, parentheses, non-ASCII arrows). **Prep step: rename to clean ASCII slugs** so code can import them safely:

| Beat | Slug (male / female) |
|---|---|
| Wound | `scan-wound-male.png` / `scan-wound-female.png` |
| Stakes | `scan-stakes-male.png` / `scan-stakes-female.png` |
| Relief | `scan-relief-male.png` / `scan-relief-female.png` |
| Wall | `scan-wall-male.png` / `scan-wall-female.png` |
| Cure + bridge | `scan-cure-male.png` / `scan-cure-female.png` |
| Landing | `scan-landing.png` |

- **Gender: no detection, no guessing.** Alternate variants across beats so the set reads as a mix: wound = female, stakes = male, relief = female, wall = male, cure = female. (Fixed assignment, not per-user.)
- **Treatment:** transparent cutouts placed to one side of the copy (asymmetric), at reduced opacity or a soft blend (multiply on the light canvas) so they influence without overpowering. They are accents, the type is the hero.

---

## 4. Copy and voice

The verdict is currently a polite observation. It must become the body count. This is a change to the `cvGapScan.ts` prompt (already routed through Opus):

- **Slap first.** The verdict (`firstImpression`) leads, before any framing paragraph. It names the consequence, not the trait. Authored rule to add to the prompt: the verdict states what it costs them ("This resume is filtered out before a human opens it"), never a neutral description ("strong content in a weak format"). Brutal, specific to this CV, never abusive: the flaw is the document, not the person.
- Keep the existing no-hedging and no-em-dash rules.
- All static UI copy (scan chamber lines, scroll cue, section labels) is authored in the implementation plan, verbatim, and lives in one locked file. DeepSeek transcribes, never rewords.

---

## 5. Typography and style

This surface breaks from the dashboard style guide on purpose: oversized display type for the slaps, generous whitespace, asymmetric layout, story-driven hierarchy. The **palette stays warm and on-brand** (reuse the existing `colors` tokens) so it does not feel like a different product, but type scale, weight, and motion go bold. This boldness applies to the scan surface only, not the dashboard (which still follows its own guide).

---

## 6. Scroll affordance (so no one gets stuck)

Three signals together:
1. The healing-CV companion moving on scroll (primary affordance + wow).
2. An explicit bouncing scroll cue on beat 1 ("Scroll" + down chevron) that fades after the first scroll.
3. An inactivity nudge: if the user does not scroll within a few seconds on beat 1, the page auto-eases down a fraction to reveal the next beat is there.

---

## 7. Tech and performance

- **Framer Motion** (already in stack) for component micro-interactions and 2.5D tilts/morphs.
- **GSAP + ScrollTrigger** (one new dependency) for the pinned scroll choreography. Lazy-load it; it is only needed on the reveal, which loads while the scan chamber is running.
- **CSS 3D transforms** for depth/parallax. No Three.js, no Spline.
- Preload beat images during the scan chamber wait so the reveal is instant.
- Respect `prefers-reduced-motion`: fall back to simple fades, no pinning or parallax.

---

## 8. Out of scope (later slices)
- Confetti/particle libraries (use CSS/Framer bursts first).
- Real 3D (Three.js/Spline).
- Per-user gendered or nationality-themed imagery.

---

## 9. Open decisions resolved
- Scroll-driven reveal (rebuilds ScanReveal): YES.
- Gender detection: NO, fixed alternation.
- Landing illustration as hero: NO, supporting band; upload stays the hero action.
- Healing-CV as the scroll companion and metaphor spine: YES.
