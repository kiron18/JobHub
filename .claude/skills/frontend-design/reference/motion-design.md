# Motion Design Reference

## Timing System
- 100–150ms: instant feedback (button press, toggle)
- 200–300ms: state changes (tab switch, dropdown open)
- 300–500ms: layout shifts (panel expand, reorder)
- 500–800ms: entrance animations (page load, modal)
- Exit animations: ~75% of entrance duration

## Easing
- Entering elements: `ease-out` (fast start, decelerates into place)
- Exiting elements: `ease-in` (slow start, accelerates out)
- Bidirectional: `ease-in-out`
- Target curve: `cubic-bezier(0.25, 1, 0.5, 1)` — exponential feel
- **Never**: bounce, elastic, spring with high stiffness — "tacky and amateurish"

## Framer Motion (JobHub stack)
```tsx
// Entrance / exit
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
    />
  )}
</AnimatePresence>

// Slide-in drawer (AchievementSelector pattern)
initial={{ x: '100%' }}
animate={{ x: 0 }}
exit={{ x: '100%' }}
transition={{ type: 'spring', damping: 25, stiffness: 200 }}
```

## Performance
- Only animate `transform` and `opacity` — these are GPU-accelerated
- Use `will-change: transform` only when animation is imminent (not as a default)
- Intersection Observer for scroll-triggered animations — not scroll event listeners

## Accessibility
- `prefers-reduced-motion` is **not optional**
- Wrap all non-essential animations: `@media (prefers-reduced-motion: reduce) { ... }`
- In Framer Motion: check `useReducedMotion()` hook
