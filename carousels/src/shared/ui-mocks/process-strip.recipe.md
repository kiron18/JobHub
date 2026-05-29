# process-strip recipe

**Mirrors:** `src/components/processStrip/ProcessStrip.tsx`
**Natural width:** 720px
**Natural height:** ~140px
**Used for:** Showing the 5-step workflow (Paste / Analyse / Tailor / Save / Track) in onboarding and strategy hub carousels.

## Slots

| Slot | Type | Example | Notes |
|------|------|---------|-------|
| `{{CURRENT_STEP}}` | "paste", "analyse", "tailor", "save", or "track" | "analyse" | Drives which variant is visible. All prior steps render as completed (gold checkmark). |
| `{{CAPTION}}` | string | "Hit Analyse. We'll build your tailored resume and cover letter." | Centered caption below the step nodes. |

## Visual notes

- Uses the hardcoded 5-variant pattern: all strip states are pre-rendered in the HTML; the `data-step` attribute on `<section>` selects visibility via CSS `display`.
- Completed step: gold (`#C5A059`) circle with white checkmark SVG.
- Current step: petrol (`#2D5A6E`) circle with white step number and a 2px petrol ring at 40% opacity.
- Future step: transparent circle with 1.5px whisper border and muted step number.
- Connector segments between nodes: gold when both adjacent steps are completed, whisper otherwise.

## Last verified against real UI

Date: 2026-05-24
