# linkedin-toolkit-card recipe

**Mirrors:** `src/components/linkedin/SectionCard.tsx`
**Natural width:** 360px
**Natural height:** ~220px
**Used for:** LinkedIn toolkit feature grid carousels (two cards side-by-side in a 2-column layout on a 720px canvas).

## Slots

| Slot | Type | Example | Notes |
|------|------|---------|-------|
| `{{ICON_SVG}}` | inline SVG | LinkedIn logo SVG | Rendered inside the 36x36 icon tile. Pass a complete `<svg>` element. |
| `{{CARD_TITLE}}` | string | "Outreach Templates" | Fraunces 600 heading. |
| `{{CARD_BODY}}` | string | "Pre-written messages for every networking stage..." | Geist body, max 2 lines visually. |

## Visual notes

- Narrow card (360px) designed to pair with an identical card in a flex row.
- Icon tile uses 10% petrol opacity background with petrol-coloured SVG.
- The "Open &rarr;" link is decorative (no `href` needed).

## Last verified against real UI

Date: 2026-05-24
