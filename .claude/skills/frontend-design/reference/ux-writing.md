# UX Writing Reference

## Button Labels
- Action-oriented and specific
- ✅ "Save changes" — ❌ "Submit"
- ✅ "Create account" — ❌ "OK"
- ✅ "Delete achievement" — ❌ "Confirm"
- ✅ "Regenerate resume" — ❌ "Try again"

## Error Messages
Format: what happened + why it happened + how to fix it
- ✅ "Job description is too short — paste at least 50 characters to continue."
- ❌ "Invalid input"
- ✅ "Couldn't save your document — check your connection and try again."
- ❌ "Error 500"

## Empty States
Empty states are onboarding opportunities — never dead ends.
- Explain what belongs here
- Show a clear CTA
- Add visual interest (illustration or icon)
- ✅ "No achievements yet. Upload your resume to discover them automatically."
- ❌ "No data found."

## Toasts (Sonner in JobHub)
- Success: brief — "Saved" / "Achievement added"
- Info: specific — "3 gaps still to fill — click the amber tags"
- Warning: actionable — "Profile incomplete. Some sections may have placeholders."
- Error: specific cause + recovery — "Generation failed. Try again or check your connection."
- Duration: success/info 3s, warning 5s, error persists until dismissed

## Consistency Rules
- Choose one term and stick to it: "Delete" OR "Remove" — never both
- Capitalisation: sentence case for UI labels (not Title Case)
- Avoid jargon: "Achievement bank" is fine; "vector namespace" is not
- German needs ~30% more space — design with localization in mind

## Microcopy Audit
Before shipping, check every string for:
1. Does it tell the user what to do next?
2. Is it the shortest it can be without losing meaning?
3. Does it feel like a human wrote it?
