# tracker-pipeline recipe

**Mirrors:** `src/components/ApplicationTracker.tsx` rendering `src/components/tracker/JobCard.tsx` (collapsed card)
**Natural width:** 720px
**Natural height:** ~440px
**Used for:** Dashboard preview carousels and "see your pipeline at a glance" slides.

## Slots

| Slot | Type | Example | Notes |
|------|------|---------|-------|
| `{{JOB1_STATUS}}` | string | "SAVED" | Uppercase status; drives the colour-coded pill via CSS class. |
| `{{JOB1_AGE}}` | string | "Started 2 days ago" | Timestamp shown top-right. |
| `{{JOB1_TITLE}}` | string | "Senior Marketing Manager" | Fraunces heading. |
| `{{JOB1_COMPANY}}` | string | "Atlassian &middot; Sydney" | Company and location on one line. |
| `{{JOB2_STATUS}}` | string | "APPLIED" | |
| `{{JOB2_AGE}}` | string | "Applied 5 days ago" | |
| `{{JOB2_TITLE}}` | string | "Graduate Data Analyst" | |
| `{{JOB2_COMPANY}}` | string | "Canva &middot; Sydney" | |
| `{{JOB3_STATUS}}` | string | "INTERVIEW" | |
| `{{JOB3_AGE}}` | string | "Interview next week" | |
| `{{JOB3_TITLE}}` | string | "Product Design Graduate" | |
| `{{JOB3_COMPANY}}` | string | "Atlassian &middot; Sydney" | |

## Visual notes

- Three cards stacked with 12px gaps. Each card has 18px border-radius.
- Status pill colours: SAVED = alt-fill bg + muted text; APPLIED = green-tinted bg + green text; INTERVIEW = gold-tinted bg + gold text.
- Detail row uses file/clock/dollar inline SVG icons with muted text.

## Last verified against real UI

Date: 2026-05-24
