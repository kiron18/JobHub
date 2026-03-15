# Typography Reference

## Scale & Rhythm
- Vertical rhythm using line-height as base spacing unit
- Modular scale with maximum 5 font sizes
- `ch` units for character-based line measure (45–75ch for body)
- Fluid typography with `clamp()` — no fixed px sizes for responsive text

## Font Choices
- Avoid: Inter, Roboto, system-ui as the "safe" default
- Prefer: Instrument Sans, Plus Jakarta Sans (modern sans); Fraunces (expressive serif)
- One well-chosen family in multiple weights > two competing typefaces
- `font-display: swap` with fallback metric matching to prevent layout shift

## Rules
- Minimum 16px body text on mobile — never smaller
- Semantic token naming: `--text-body` not `--font-size-16`
- rem/em units only — respect user browser settings
- Never disable zoom
- OpenType features where supported: tabular numbers for metrics, small caps for labels
- Weight contrast: pair 300/700 or 400/800 — avoid 400/500 (invisible difference)
