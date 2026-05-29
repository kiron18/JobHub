# email-template-card recipe

**Mirrors:** `src/components/EmailTemplatesLibrary.tsx`
**Natural width:** 720px
**Natural height:** ~280px
**Used for:** Template library carousels and "ready-to-use email templates" feature previews.

## Slots

| Slot | Type | Example | Notes |
|------|------|---------|-------|
| `{{CATEGORY_LABEL}}` | string | "Follow-up &middot; After application" | Shown in a petrol-tinted category pill. |
| `{{TEMPLATE_TITLE}}` | string | "Polite 7-day follow-up" | Fraunces 600 heading below the top row. |
| `{{EMAIL_BODY}}` | string (may contain `\n`) | "Hi {Hiring Manager},\n\nI applied for..." | Rendered in alt-fill preview box with `white-space: pre-line`. |
| `{{PERSONALISE_NOTE}}` | string | "Personalisable &middot; 3 fields to fill" | Footer note in muted colour. |

## Visual notes

- Category pill uses `rgba(45,90,110,0.10)` background with `#2D5A6E` text.
- Copy button icon in top-right is decorative (non-interactive).
- Email body preview box has alt-fill background with 10px radius.
- The `white-space: pre-line` style means literal `\n` in the slot value render as line breaks.

## Last verified against real UI

Date: 2026-05-24
