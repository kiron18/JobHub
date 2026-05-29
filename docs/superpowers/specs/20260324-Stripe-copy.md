# 3-Month Bundle — Pricing Copy & Placement

**Date:** 2026-05-27
**Status:** Draft v2

## Pricing

| | Monthly | 3-Month Bundle |
|---|---|---|
| Per month | $97 | $65 |
| Total for 90 days | $291 | $197 |
| Savings | — | $94 (32% off) |

Afterpay and Zip are live on Stripe. $197 split via Afterpay = ~$49.25 per fortnight × 4.

## Core copy (used everywhere)

**Pricing card sub-line** (`PricingPage.tsx`, `UpgradeModal.tsx`):
> Three months for $197. That's $65 a month — $94 less than paying monthly.
> Afterpay and Zip both work at checkout.

**FAQ entry** (`PricingPage.tsx`):
> **Can I use Afterpay or Zip for the 3-Month Bundle?**
> Yes. Both are supported at checkout. Afterpay splits $197 into four fortnightly payments. No interest, no ongoing commitment.

## Tone rules

These keep the voice consistent with the landing redesign and the diagnostic positioning:

- Lead with the dollar figure. Don't hedge with "~" or "from".
- The diagnostic is a gift. Pricing copy never appears before a user has seen value.
- Afterpay gets mentioned once per surface, max. It's a feature, not the headline.
- No "less than a coffee a day", no "unlock", no "Want the edge?". State the offer.
- One line per placement. Two if the second is structural (e.g., the Afterpay disclosure).

## Placement — ranked

### Tier 1 — ship first

**Diagnostic report end-state.** Highest-intent moment in the product. User has just received their free diagnostic; they're warm and the gap between current state and desired state is open.

> *Banner below the report:*
> Your diagnostic is yours to keep, free. If you want to act on what it found, three months of full access is $197 — Afterpay splits that into four payments.

**Pricing card.** Already exists; just add the sub-line above.

### Tier 2 — ship second

**Match Engine — post-score.** User just saw how well they fit a role. Quiet, factual, no hype.

> Tailored documents for this role unlock with 3-Month Access. $65 a month.

**Landing risk-reversal section.** A single line near the existing "free to try" message. Establishes price anchor without crowding the page.

> Diagnostic stays free. Full access is $197 for 90 days — Afterpay available.

**Pricing link in landing nav + footer.** Currently missing. Bare `/pricing` link, no copy needed.

### Tier 3 — passive surfaces

Lower-intent placements where a quiet card or footer line earns visibility without interrupting flow:

| Surface | Line |
|---|---|
| Dashboard sidebar card | **3-Month Access** — $65 a month • $197 total |
| Strategy Hub after analysis result | Run unlimited analyses with 3-Month Access — $65 a month. |
| LinkedIn page after generation | Keep your documents and profile updated with 3-Month Access. |

### Explicitly NOT added

- **Welcome screen post-signup.** Conflicts with the diagnostic-as-gift positioning. Showing pricing before the user has received any value undercuts trust. Keep the welcome screen pricing-free.
- **Job feed cards.** Too low-intent. Pricing on browse surfaces reads as a paywall, not an offer.
- **JobCard "limited lookups" replacement.** Too small a surface for the copy lift required.

## Implementation order

1. **Pricing card sub-line + FAQ entry** — two-line change, ships in one PR.
2. **Diagnostic report banner** — most leverage. Needs a `<PricingTeaser />` component since the same banner will be reused in Tier 2/3.
3. **Match Engine + landing nav link** — same banner component, different positioning props.
4. **Tier 3 surfaces** — reuse the component once the design is settled.

The shared component takes a `variant` prop (`full | compact | inline`) so all surfaces use the same copy lines and same Afterpay treatment. One place to edit when pricing changes.

## Success metric

Track conversion rate from each surface separately (PostHog event `pricing_teaser_click` with `source` property). Within 14 days, kill any surface converting below 1% of impressions and double down on the rest.
