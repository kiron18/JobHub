# editor-with-rewrites recipe

**Mirrors:** `src/components/ApplicationWorkspace.tsx` + `src/components/AIRewriteBadge.tsx`
**Natural width:** 720px
**Natural height:** ~340px
**Used for:** Editor walkthrough carousels showing the AI-assisted writing experience.

## Slots

| Slot | Type | Example | Notes |
|------|------|---------|-------|
| `{{ACTIVE_TAB}}` | "resume", "cover", or "criteria" | "resume" | Drives which tab panel is visible via `data-active-tab`. |
| `{{BULLET_NORMAL}}` | string | "Led the migration of 14 legacy customer reporting workflows..." | Normal bullet point text. |
| `{{BULLET_REWRITTEN}}` | string | "Rebuilt the data ingestion pipeline, cutting client report turnaround from 14 days to under 6 hours." | Displayed with the gold AI badge prepended. |

## Visual notes

- Uses the hardcoded 3-variant tab pattern: all tab panels are pre-rendered; `data-active-tab` selects visibility via CSS.
- The AI badge is a gold-tinted pill (`rgba(197,160,89,0.18)`) with uppercase "AI" in 9px at 800 weight.
- Bullet markers are 6px rounded squares in petrol.
- Action buttons: ghost "Back" on the left, secondary "Review" + primary "Save & continue" on the right.

## Last verified against real UI

Date: 2026-05-24
