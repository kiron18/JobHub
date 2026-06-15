# CV Scan Cinematic Redesign Implementation Plan

> **For DeepSeek (executing agent):** ZERO-LATITUDE plan. Do EXACTLY what each task says, in order. Every string in quotes is FINAL COPY authored by the product owner: transcribe it VERBATIM, including the deliberate absence of em dashes and en dashes. Do NOT reword copy, invent new copy, restyle beyond what is specified, or touch files not named here. READ the named file fully before editing it. If the live code does not match what a task describes, STOP and report what you actually found instead of forcing the edit or guessing.
>
> **Absolute rules:** No em dashes, no en dashes anywhere (use commas, full stops, colons, or "and"). Australian English. No new npm dependency (use Framer Motion, already installed). Reuse the existing design tokens from `src/components/landing/tokens.ts` (`colors`, `type`). Respect `prefers-reduced-motion`.

**Goal:** Rebuild the CV scan into an immersive, emotional, scroll-driven story: a full-screen "judgment chamber" while scanning, then a scroll-revealed sequence where a fractured CV heals as the user reads their own story, leading to the email gate and the app.

**Architecture:** Two full-screen portals. `ScanChamber` plays during `status === 'scanning'`. `ScanReveal` (rebuilt) is a scrollable portal whose beats are stacked full-height sections that animate in on scroll (`whileInView`), with a sticky `HealingCv` companion behind them whose wholeness is driven by scroll progress (`useScroll` + `useTransform`). Per-beat transparent images are placed as low-opacity side accents. The brutal verdict comes from a sharpened `cvGapScan` prompt (already on Opus).

**Tech Stack:** React + TypeScript, Framer Motion (`motion`, `AnimatePresence`, `useScroll`, `useTransform`, `useMotionValue`, `animate`, `useReducedMotion`), CSS 3D transforms. No GSAP, no Three.js.

**Global verification:**
- Frontend type-check: `npx tsc --noEmit -p tsconfig.app.json` (exit 0).
- Unit tests (where present): `cd server && npx vitest run <file>` for server, root vitest for frontend if configured.
- Visual checks are manual in the running app (`npm run dev`).

---

## Task 0: Orientation and image rename (prep)

- [ ] **Step 0.1:** Read these files fully before any edits: `src/components/landing/ScanReveal.tsx`, `src/components/landing/tokens.ts`, `src/pages/MockLandingPage.tsx` (find `ScanningState` and where `status === 'scanning'` renders), and `server/src/services/cvGapScan.ts` (the `buildScanInstructions` function). Confirm `ScanReveal` props match `ScanRevealProps` and that `MockLandingPage` renders a scanning state. If `ScanReveal` is not at that path or its props differ, STOP and report.

- [ ] **Step 0.2:** Confirm Framer Motion exposes `useScroll` and `useReducedMotion`: open `node_modules/framer-motion/package.json`, check `version` is 6.0.0 or higher. If lower, STOP and report (do not upgrade).

- [ ] **Step 0.3:** Rename the scan images to clean ASCII slugs. The source files are in `public/images/scan/` with messy names. Run these exact git moves (quote the messy names exactly as they appear with `ls`):

```bash
cd public/images/scan
git mv "Punch beat Hey Kiron, here is what a recruiter sees first - brutal verdict - what is costing you callbacks (the wound) - Female.png" scan-wound-female.png
git mv "Punch beat Hey Kiron, here is what a recruiter sees first - brutal verdict - what is costing you callbacks (the wound) - Male.png" scan-wound-male.png
git mv "End of punch Stakes line about silence (stakes) - Female.png" scan-stakes-female.png
git mv "End of punch Stakes line about silence (stakes) - Male.png" scan-stakes-male.png
git mv "Relief beat This isn't a talent problem (the relief"*"Female.png" scan-relief-female.png
git mv "Relief beat This isn't a talent problem (the relief"*"Male.png" scan-relief-male.png
git mv "Hope beat Quick wins shown + email wall (the wall) _ Female.png" scan-wall-female.png
git mv "Hope beat Quick wins shown + email wall (the wall) Male.png" scan-wall-male.png
git mv "After email"*"roadmap Fixes + bridge (the cure + bridge) - Female.png" scan-cure-female.png
git mv "After email"*"roadmap Fixes + bridge (the cure + bridge) - Male.png" scan-cure-male.png
git mv "Landing page.png" scan-landing.png
```

If any `git mv` fails because the source name does not match, run `ls` in that folder, find the real name, and adapt that one line only. Then verify exactly these 11 files exist: `scan-wound-female.png`, `scan-wound-male.png`, `scan-stakes-female.png`, `scan-stakes-male.png`, `scan-relief-female.png`, `scan-relief-male.png`, `scan-wall-female.png`, `scan-wall-male.png`, `scan-cure-female.png`, `scan-cure-male.png`, `scan-landing.png`.

- [ ] **Step 0.4: Commit.**

```bash
git add -A public/images/scan
git commit -m "chore(scan): rename scan beat images to clean slugs"
```

---

## Task 1: Beat image resolver (pure, tested)

**Files:**
- Create: `src/components/landing/scanImages.ts`
- Create: `src/components/landing/scanImages.test.ts`

- [ ] **Step 1.1: Create `src/components/landing/scanImages.ts` with exactly this content:**

```ts
// Maps each reveal beat to its illustration. Gender alternates across beats by
// design (no per-user detection): the set reads as a mix. Paths are absolute from
// the public root so they resolve the same in dev and prod.
export type ScanBeat = 'wound' | 'stakes' | 'relief' | 'wall' | 'cure';

const BEAT_IMAGE: Record<ScanBeat, string> = {
  wound: '/images/scan/scan-wound-female.png',
  stakes: '/images/scan/scan-stakes-male.png',
  relief: '/images/scan/scan-relief-female.png',
  wall: '/images/scan/scan-wall-male.png',
  cure: '/images/scan/scan-cure-female.png',
};

export function beatImage(beat: ScanBeat): string {
  return BEAT_IMAGE[beat];
}

// All beat images, for preloading during the scan chamber.
export const ALL_SCAN_IMAGES: string[] = Object.values(BEAT_IMAGE);
```

- [ ] **Step 1.2: Create `src/components/landing/scanImages.test.ts` with exactly this content:**

```ts
import { describe, it, expect } from 'vitest';
import { beatImage, ALL_SCAN_IMAGES } from './scanImages';

describe('beatImage', () => {
  it('resolves every beat to a slugged png under /images/scan/', () => {
    for (const beat of ['wound', 'stakes', 'relief', 'wall', 'cure'] as const) {
      expect(beatImage(beat)).toMatch(/^\/images\/scan\/scan-[a-z-]+\.png$/);
    }
  });

  it('alternates gender across beats (a mix, not all one)', () => {
    const males = ALL_SCAN_IMAGES.filter(p => p.includes('-male')).length;
    const females = ALL_SCAN_IMAGES.filter(p => p.includes('-female')).length;
    expect(males).toBeGreaterThan(0);
    expect(females).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 1.3:** Run the frontend test runner on this file (the repo runs vitest from root for `src`): `npx vitest run src/components/landing/scanImages.test.ts`. Expected: PASS. If the root has no vitest config for `src`, STOP and report how frontend unit tests are run.

- [ ] **Step 1.4: Commit.**

```bash
git add src/components/landing/scanImages.ts src/components/landing/scanImages.test.ts
git commit -m "feat(scan): beat image resolver with gender alternation"
```

---

## Task 2: Locked static copy

**Files:**
- Create: `src/components/landing/scanCinematicCopy.ts`

- [ ] **Step 2.1: Create `src/components/landing/scanCinematicCopy.ts` with exactly this content:**

```ts
// Locked, product-owner-authored static copy for the scan chamber and reveal
// affordances. Do not reword. No em or en dashes. Australian English.
export const scanCinematicCopy = {
  chamber: {
    lines: [
      'Reading your layout the way the software does.',
      'Seeing what actually reaches a human.',
      'Running the six-second test.',
    ],
    lockIn: 'Verdict locked.',
  },
  scrollCue: 'Scroll',
} as const;
```

- [ ] **Step 2.2:** Type-check: `npx tsc --noEmit -p tsconfig.app.json`. Expected exit 0.

- [ ] **Step 2.3: Commit.**

```bash
git add src/components/landing/scanCinematicCopy.ts
git commit -m "feat(scan): locked copy for chamber and scroll cue"
```

---

## Task 3: HealingCv companion component

A self-contained CV illustration that goes from fractured (progress 0) to whole and glowing (progress 1). Driven by a Framer `MotionValue`.

**Files:**
- Create: `src/components/landing/HealingCv.tsx`

- [ ] **Step 3.1: Create `src/components/landing/HealingCv.tsx` with exactly this content:**

```tsx
import { motion, useTransform, type MotionValue } from 'framer-motion';
import { colors } from './tokens';

/**
 * A stylised CV that heals as `progress` goes 0 (fractured) to 1 (whole).
 * Three stacked "shards" splay out and fade their cracks as progress rises.
 * Purely decorative; drives the scroll metaphor and doubles as the scroll signpost.
 */
export function HealingCv({ progress }: { progress: MotionValue<number> }) {
  // Shard offsets collapse to 0 as the CV heals.
  const topX = useTransform(progress, [0, 1], [-46, 0]);
  const topRot = useTransform(progress, [0, 1], [-9, 0]);
  const botX = useTransform(progress, [0, 1], [40, 0]);
  const botRot = useTransform(progress, [0, 1], [7, 0]);
  const crackOpacity = useTransform(progress, [0, 1], [1, 0]);
  const glow = useTransform(progress, [0, 1], ['0 0 0 rgba(45,90,110,0)', '0 18px 60px rgba(45,90,110,0.30)']);

  const sheet: React.CSSProperties = {
    position: 'absolute',
    width: 150,
    height: 70,
    left: 35,
    background: colors.bgSurface,
    border: `1px solid ${colors.borderDefined}`,
    borderRadius: 8,
  };
  const line: React.CSSProperties = {
    position: 'absolute', left: 14, height: 6, borderRadius: 3, background: colors.borderDefined,
  };

  return (
    <div style={{ position: 'relative', width: 220, height: 230 }} aria-hidden>
      <motion.div style={{ ...sheet, top: 0, x: topX, rotate: topRot, boxShadow: glow }}>
        <div style={{ ...line, top: 14, width: 70 }} />
        <div style={{ ...line, top: 30, width: 110 }} />
      </motion.div>
      <div style={{ ...sheet, top: 80 }}>
        <div style={{ ...line, top: 14, width: 90 }} />
        <div style={{ ...line, top: 30, width: 120 }} />
      </div>
      <motion.div style={{ ...sheet, top: 160, x: botX, rotate: botRot, boxShadow: glow }}>
        <div style={{ ...line, top: 14, width: 100 }} />
        <div style={{ ...line, top: 30, width: 60 }} />
      </motion.div>
      {/* red crack marks that fade as it heals */}
      <motion.div style={{ position: 'absolute', inset: 0, opacity: crackOpacity }}>
        <div style={{ position: 'absolute', top: 74, left: 20, width: 180, height: 2, background: '#C2603F', transform: 'rotate(-2deg)' }} />
        <div style={{ position: 'absolute', top: 154, left: 30, width: 170, height: 2, background: '#C2603F', transform: 'rotate(3deg)' }} />
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 3.2:** Type-check: `npx tsc --noEmit -p tsconfig.app.json`. Expected exit 0. If `tokens.ts` does not export `colors` with `bgSurface`/`borderDefined`, STOP and report the actual token names.

- [ ] **Step 3.3: Commit.**

```bash
git add src/components/landing/HealingCv.tsx
git commit -m "feat(scan): healing CV companion component"
```

---

## Task 4: The scan judgment chamber

Full-screen takeover during scanning. The CV (HealingCv at fixed low progress) sits centre under a sweeping scanner beam; the three chamber lines stream in one at a time; ends on "Verdict locked." Preloads beat images.

**Files:**
- Create: `src/components/landing/ScanChamber.tsx`
- Modify: `src/pages/MockLandingPage.tsx` (swap the scanning state for `ScanChamber`)

- [ ] **Step 4.1: Create `src/components/landing/ScanChamber.tsx` with exactly this content:**

```tsx
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { colors, type as typeTokens } from './tokens';
import { HealingCv } from './HealingCv';
import { ALL_SCAN_IMAGES } from './scanImages';
import { scanCinematicCopy } from './scanCinematicCopy';

const EASE = [0.25, 1, 0.5, 1] as const;

/** Full-screen "being evaluated" moment shown while the scan runs. */
export function ScanChamber() {
  const reduce = useReducedMotion();
  const progress = useMotionValue(0); // CV stays mostly fractured during the scan
  const [shown, setShown] = useState(0);

  // Preload the reveal images so the next screen is instant.
  useEffect(() => {
    ALL_SCAN_IMAGES.forEach(src => { const img = new Image(); img.src = src; });
  }, []);

  // Stream the analysis lines one at a time.
  useEffect(() => {
    const total = scanCinematicCopy.chamber.lines.length;
    const t = setInterval(() => setShown(s => (s < total ? s + 1 : s)), 1100);
    return () => clearInterval(t);
  }, []);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: colors.bgCanvas,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28,
        backgroundImage: `radial-gradient(120% 80% at 50% 0%, ${colors.bgSurface} 0%, ${colors.bgCanvas} 60%)` }}
    >
      <div style={{ position: 'relative' }}>
        <HealingCv progress={progress} />
        {!reduce && (
          <motion.div
            initial={{ y: -10, opacity: 0.0 }}
            animate={{ y: 240, opacity: [0, 0.9, 0] }}
            transition={{ duration: 1.6, ease: EASE, repeat: Infinity }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3,
              background: `linear-gradient(90deg, transparent, ${colors.accentPetrol}, transparent)` }}
          />
        )}
      </div>
      <div style={{ height: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        {scanCinematicCopy.chamber.lines.slice(0, shown).map((l, i) => (
          <motion.p key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
            style={{ fontFamily: typeTokens.body, fontSize: 14, color: colors.textSecondary, margin: 0 }}>
            {l}
          </motion.p>
        ))}
      </div>
    </motion.div>,
    document.body,
  );
}
```

- [ ] **Step 4.2:** In `src/pages/MockLandingPage.tsx`, import `ScanChamber` (`import { ScanChamber } from '../components/landing/ScanChamber';`) and render it while scanning. Find the line that renders the scanning state (e.g. `{status === 'scanning' && <ScanningState />}`) and replace `<ScanningState />` with `<ScanChamber />`. Leave the old `ScanningState` component defined but unused (do not delete it in this task). If there is no `status === 'scanning'` render, STOP and report how the scanning state is shown.

- [ ] **Step 4.3:** Type-check: `npx tsc --noEmit -p tsconfig.app.json`. Expected exit 0.

- [ ] **Step 4.4:** Manual check: run `npm run dev`, upload a CV on the landing page, confirm a full-screen chamber appears with a sweeping beam, the three lines stream in, then the reveal opens. Then commit.

```bash
git add src/components/landing/ScanChamber.tsx src/pages/MockLandingPage.tsx
git commit -m "feat(scan): full-screen judgment chamber during scanning"
```

---

## Task 5: Rebuild ScanReveal as a scroll-driven story

Convert the click-advanced beats into stacked, full-height sections that animate in on scroll, with a sticky `HealingCv` companion behind them and a scroll cue. PRESERVE all existing beat copy and the email/roadmap flow; only the layout and advance mechanism change.

**Files:**
- Modify: `src/components/landing/ScanReveal.tsx`

- [ ] **Step 5.1:** Read the current `ScanReveal.tsx` fully. Note the existing beat content for punch, relief, translation, hope (pre-email wall) and the roadmap (post-email) branch, and the props (`result`, `email`, `setEmail`, `emailLoading`, `onEmailSubmit`, `roadmap`, `roadmapError`, `onClose`, `onEnterDashboard`). You will reuse all of this copy and logic verbatim; only the container and navigation change.

- [ ] **Step 5.2:** Replace the beat state machine (`idx`, `beats`, `advance`, the footer advance button, the `AnimatePresence` single-beat swap) with a SCROLL layout:
  - The portal root stays `position: fixed; inset: 0; z-index: 2000; overflow-y: auto` on `colors.bgCanvas`.
  - Add `const { scrollYProgress } = useScroll({ container: <ref to the scroll root> });` and pass `scrollYProgress` to a sticky `<HealingCv progress={scrollYProgress} />` layer (position: sticky; top: 50%; translateY(-50%); right side; `pointerEvents: none`; opacity ~0.5; `zIndex: 0`). Honour `useReducedMotion()`: when reduced, render `HealingCv` with a static `useMotionValue(1)` and skip parallax.
  - Each beat becomes a full-viewport `<section style={{ minHeight: '100vh', display:'flex', alignItems:'center' }}>` containing the existing beat content, wrapped so it animates in with `whileInView`:

```tsx
<motion.div
  initial={{ opacity: 0, y: 28 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.5 }}
  transition={{ duration: 0.6, ease: [0.25,1,0.5,1] }}
  style={{ width: '100%', maxWidth: 680, margin: '0 auto', position: 'relative', zIndex: 1 }}
>
  {/* existing beat content here, copy unchanged */}
</motion.div>
```

  - Order of sections: punch (wound), relief, translation (only if `result.culturalTranslations?.length`), then the hope section. Keep the existing copy inside each.

- [ ] **Step 5.3:** Make the verdict the visual slap. In the punch section, render `result.firstImpression` FIRST as the oversized headline (keep the existing `fiSize` logic and the quote styling), and move the framing paragraph ("Hiring managers spend about 6 seconds...") to BELOW the verdict. The verdict leads; the explanation follows.

- [ ] **Step 5.4:** Add the per-beat image accents. Import `beatImage` from `./scanImages`. In the punch section add `<img src={beatImage('wound')} .../>`, relief `beatImage('relief')`, the hope/wall section `beatImage('wall')`, and the post-email roadmap section `beatImage('cure')`. Each image: `style={{ position:'absolute', right: -8, bottom: 0, width: 180, opacity: 0.16, mixBlendMode: 'multiply', pointerEvents: 'none' }}` and `alt=""` `aria-hidden`. Place each inside its section, behind the text (lower zIndex). On viewport widths under 720px, hide them (`display: none` via a width check or a CSS class). Use `beatImage('stakes')` on the stakes content that currently sits at the end of the punch section.

- [ ] **Step 5.5:** Add the scroll cue. On the first section only, render a fixed-bottom-centre cue: the word `scanCinematicCopy.scrollCue` above a bouncing down chevron (reuse the `ArrowDown` icon already imported). Animate `y: [0, 8, 0]` on a loop (skip the loop when `useReducedMotion()`). Fade it out once `scrollYProgress` passes 0.05 (`useTransform(scrollYProgress, [0, 0.05], [1, 0])` as opacity). Skip the bounce entirely under reduced motion.

- [ ] **Step 5.6:** Keep the email gate and roadmap EXACTLY as today: the hope section shows the two quick wins and the email input/button (unchanged copy and `onEmailSubmit`); when `roadmap` is truthy, render the roadmap section (unchanged copy) and the bridge block and the `onEnterDashboard` CTA that already exist. After a successful email submit, scroll the roadmap section into view (`element.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })`).

- [ ] **Step 5.7:** Keep the top bar with the close button (`onClose`) and the progress dots, but drive the dots from `scrollYProgress` instead of `idx` (e.g. light up dot N when progress passes N/total). If wiring the dots to progress is awkward, replace them with a single thin top progress bar whose width is `useTransform(scrollYProgress, [0,1], ['0%','100%'])`. Either is acceptable; do not remove the close button.

- [ ] **Step 5.8:** Type-check: `npx tsc --noEmit -p tsconfig.app.json`. Expected exit 0.

- [ ] **Step 5.9:** Manual check in `npm run dev`: the reveal is now scrolled, not clicked; the verdict is the first big thing; sections fade in as you scroll; the healing CV sits behind and becomes whole toward the bottom; the scroll cue shows then fades; email submit still produces the roadmap and the bridge CTA. Then commit.

```bash
git add src/components/landing/ScanReveal.tsx
git commit -m "feat(scan): scroll-driven cinematic reveal with healing CV and image accents"
```

---

## Task 6: Make the verdict a slap (prompt)

**Files:**
- Modify: `server/src/services/cvGapScan.ts` (the `firstImpression` instruction inside `buildScanInstructions`)

- [ ] **Step 6.1:** In `server/src/services/cvGapScan.ts`, find the line in `buildScanInstructions` that defines `firstImpression` (it begins with `` `firstImpression`: ``). Replace that whole single instruction line with this VERBATIM text (one line, no em or en dashes):

```
\`firstImpression\`: the verdict, and it must hit like a slap. State the CONSEQUENCE for this specific resume, not a neutral description. "This resume is filtered out before a human opens it" is right. "Strong content in a weak format" is WRONG, it describes instead of landing the cost. Brutal and specific to THIS resume, never abusive: the flaw is in the document, never the person. NOT a number, NOT a grade, NOT a percentage, NOT hedged. ≤56 characters, no trailing period.
```

- [ ] **Step 6.2:** Type-check the server: `cd server && npx tsc --noEmit`. Expected exit 0.

- [ ] **Step 6.3:** Run the server scan test if present: `cd server && npx vitest run src/services/cvGapScan.test.ts`. If it asserts the old wording and fails, STOP and report (do not edit the test). Otherwise commit.

```bash
git add server/src/services/cvGapScan.ts
git commit -m "feat(scan): verdict prompt lands the consequence, not a description"
```

---

## Task 7: Landing supports and pushes the scan

**Files:**
- Modify: `src/pages/MockLandingPage.tsx`

- [ ] **Step 7.1:** Confirm the hero's primary action is the CV upload/scan (the scan card). It already is; do NOT demote it. Read the hero section to confirm.

- [ ] **Step 7.2:** Add the journey illustration as a supporting band BELOW the hero (not in the hero, not as a blend overlay). Insert one full-width section after the hero with `scan-landing.png`:

```tsx
<section style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px', textAlign: 'center' }}>
  <img src="/images/scan/scan-landing.png" alt="From rejection to your first Australian job" loading="lazy"
       style={{ width: '100%', maxWidth: 760, height: 'auto', margin: '0 auto', display: 'block' }} />
</section>
```

Place it where it reinforces the promise (after the hero, before or among the existing social-proof). If the page structure makes the exact placement unclear, put it directly after the hero block and report the location you chose.

- [ ] **Step 7.3:** Type-check: `npx tsc --noEmit -p tsconfig.app.json`. Expected exit 0. Manual check: the band shows below the hero and the upload remains the obvious primary action. Then commit.

```bash
git add src/pages/MockLandingPage.tsx
git commit -m "feat(landing): journey illustration band supporting the scan CTA"
```

---

## Final verification (after all tasks)
- [ ] `npx tsc --noEmit -p tsconfig.app.json` exits 0.
- [ ] `cd server && npx tsc --noEmit` exits 0 and `npx vitest run` shows no NEW failures (pre-existing `analyze`/clustering/stale-`dist` failures are not yours).
- [ ] In `npm run dev`, full walk-through: upload CV, see the chamber, scroll the reveal (verdict first, sections animate, CV heals, cue fades), submit email, see roadmap + bridge, and the landing band renders. Test once with the OS "reduce motion" setting on and confirm no pinning/parallax jank.
- [ ] Report the commit range and any STOP-and-report points.

## Notes for the owner (not DeepSeek)
- No GSAP was added; scroll choreography uses Framer Motion `useScroll` + `whileInView` + sticky, already in the stack. If you later want true scroll-pinned cinematics, that is a follow-up.
- The healing-CV is a stylised abstraction, not a render of the user's real CV. Rendering the real document is a heavier follow-up.
- Per-user gendered imagery is intentionally NOT implemented; beats alternate via `scanImages.ts`.
