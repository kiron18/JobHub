# diagnostic-card recipe

**Mirrors:** `src/components/DiagnosticPage.tsx` (a single finding section)
**Natural width:** 720px
**Natural height:** ~300px
**Used for:** Diagnostic report carousels and "here's what we found" slides.

## Slots

| Slot | Type | Example | Notes |
|------|------|---------|-------|
| `{{FIX_NUMBER}}` | string | "03" | Zero-padded fix number displayed in the gold eyebrow. |
| `{{FINDING_TITLE}}` | string | "Your opening line introduces you. It should sell you." | Fraunces 700 headline. |
| `{{BEFORE_TEXT}}` | string | "I am a results-driven marketing professional with 5 years of experience..." | Displayed italic in a red-tinted quote box. |
| `{{AFTER_TEXT}}` | string | "Drove $2.3M in pipeline at Atlassian by rebuilding the SMB outbound motion from scratch." | Displayed 500 weight in a green-tinted quote box. |
| `{{EXPLANATION}}` | string | "The 'after' version names the company, quantifies impact, and states the action you took." | Caption below the grid, separated by border-top. |

## Visual notes

- Uses lifted shadow (the strongest of the three shadow tokens).
- Before/After columns use colour-coded borders (danger red for Before, success green for After).
- Quote boxes use alt-fill background with tinted borders, not full-colour backgrounds.

## Last verified against real UI

Date: 2026-05-24
