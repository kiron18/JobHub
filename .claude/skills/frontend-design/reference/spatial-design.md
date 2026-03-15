# Spatial Design Reference

## Spacing Scale
Base: 4pt grid — use 4, 8, 12, 16, 24, 32, 48, 64, 96px
Name by relationship: `--space-sm`, `--space-lg` — not `--spacing-8`
In Tailwind: p-1(4px), p-2(8px), p-3(12px), p-4(16px), p-6(24px), p-8(32px), p-12(48px)

## Layout Rules
- `gap` for sibling spacing — avoids margin collapse edge cases
- Self-adjusting grid: `repeat(auto-fit, minmax(280px, 1fr))`
- Named grid areas, redefined at breakpoints via Tailwind responsive prefixes
- Squint test: blur the design to verify visual hierarchy is readable

## Visual Hierarchy
- 3:1 size ratio creates strong hierarchy between heading and body
- White space is not empty — it's structure
- Increase internal padding before increasing component size

## Cards — Use Sparingly
Cards are overused. Spacing and alignment create visual grouping naturally.
**Reserve cards for**: truly distinct, actionable content units
**Never**: nest cards inside cards
**Instead**: use `border-b` separators, background shifts, or increased gap

## Touch Targets
- Minimum 44×44px for all interactive elements — non-negotiable
- Add padding to small icons rather than making the icon larger

## Z-Index
Use a semantic scale: modal(300) > dropdown(200) > sticky(100) > default(1)
Never use arbitrary z-index values like 9999
