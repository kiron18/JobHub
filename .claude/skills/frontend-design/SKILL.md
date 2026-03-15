---
name: frontend-design
description: Guides creation of distinctive, production-grade interfaces. Activates the full design reference system (typography, color, spatial, motion, interaction, responsive, UX writing).
---

# Frontend Design Skill

Guides creation of distinctive, production-grade interfaces avoiding generic AI aesthetics.

## Design Commitment
Choose a bold aesthetic and execute with precision. Do not produce generic output.

## Critical Guidelines

**Typography**: Use modular scales and distinctive fonts. Avoid Inter, Roboto, or monospace as body defaults.

**Color**: Use OKLCH. Tint neutrals with a subtle brand hue. Never pure black/white.

**Layout**: Visual rhythm, intentional asymmetry. Cards are overused — spacing and alignment create grouping naturally.

**Details to avoid**: glassmorphism, gradient text, sparklines, generic drop shadows, cyan-purple gradients, neon on dark.

**Motion**: Meaningful state changes only. Exponential easing (`cubic-bezier(0.25, 1, 0.5, 1)`). Never bounce or elastic.

**Interaction**: Progressive disclosure, optimistic UI updates, all 8 states (default/hover/focus/active/disabled/loading/error/success).

**Writing**: Specific action labels. Eliminate redundancy. Error messages = what happened + why + how to fix.

## The AI Slop Test
The interface should prompt "how was this made?" not "which AI made this?"

## JobHub Design Context
- **Theme**: Dark UI — `slate-950` background, `slate-900` cards, `slate-800` borders
- **Brand**: `brand-600` purple for CTAs, active states, and progress indicators
- **Typography**: Applied via Tailwind `prose prose-slate` in document preview areas
- **Motion library**: Framer Motion — `motion.div` + `AnimatePresence`
- **Avoid**: Adding new CSS files — Tailwind utilities only
- **Touch targets**: 44px minimum for all interactive elements
