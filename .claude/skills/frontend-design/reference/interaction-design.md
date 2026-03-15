# Interaction Design Reference

## Eight States Every Interactive Element Needs
1. **Default** — resting state
2. **Hover** — pointer over (desktop only, check `@media (hover: hover)`)
3. **Focus** — keyboard navigation — use `:focus-visible`, not `:focus`
4. **Active** — pressed/clicking
5. **Disabled** — unavailable, reduced opacity, `cursor: not-allowed`
6. **Loading** — async operation in progress
7. **Error** — validation failure or request error
8. **Success** — operation completed

## Focus Management
- `:focus-visible` for keyboard-specific rings — not shown to mouse users
- Focus rings: 3:1 contrast minimum, 2–3px thick, offset (not overlapping content)
- Modal/drawer: trap focus with `inert` attribute on background or native `<dialog>`
- After close: return focus to the trigger element

## Form Interactions
- Validate on **blur**, not while typing — typing validation is hostile
- Visible `<label>` elements — never rely on placeholder text alone
- Error messages inline below the field, not in a toast
- Success confirmation should be brief: "Saved" not "Your changes have been successfully saved"

## Confirmations
- **Prefer undo** over confirmation dialogs
- Reserve "Are you sure?" dialogs for truly irreversible, high-stakes actions
- Destructive actions: red button, clear consequence statement

## Keyboard Navigation
- All interactive functionality reachable by keyboard
- Skip links for keyboard users navigating long pages
- Roving `tabindex` for component groups (button toolbars, tab lists)
- Visible focus outline — never `outline: none` without a replacement

## Gestures & Discoverability
- Hidden gestures require coaching hints or visible alternatives
- Swipe-to-dismiss: always provide a visible close button too
- Drag targets: show affordance (handle icon, hover state)
