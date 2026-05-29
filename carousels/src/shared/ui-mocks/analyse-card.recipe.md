# analyse-card recipe

**Mirrors:** `src/pages/StrategyHub.tsx` (Analyse a Role card, ~line 500-660)
**Natural width:** 720px
**Natural height:** ~360px
**Used for:** Onboarding carousels showing "start by pasting a job listing", apply-flow walkthroughs.

## Slots

| Slot | Type | Example | Notes |
|------|------|---------|-------|
| `{{BROWSE_PILL_TEXT}}` | string | "Browse marketing jobs on Seek" | Text inside the pill link card. |
| `{{TEXTAREA_PLACEHOLDER}}` | string | "Paste the job description here..." | Displayed as div text (not an actual placeholder attribute). |
| `{{TOGGLE_ON}}` | "true" or "false" | "false" | Drives toggle knob position via `data-toggle-on` attribute. |

## Visual notes

- Analyse button and toggle are non-interactive (`cursor: default`).
- The toggle knob position is controlled by CSS attribute selector `[data-toggle-on="true"]`.
- All icons are inline SVGs with `stroke="currentColor"` so the parent `color` property controls tint.

## Last verified against real UI

Date: 2026-05-24
