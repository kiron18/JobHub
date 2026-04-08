# Sub-project 4: Selection Criteria Instructions
*Design spec — April 8 2026*

---

## Overview

Selection criteria are almost always in a separate PDF attached to the job listing, not in the JD text itself. Rather than attempting fragile PDF extraction, we surface clear step-by-step instructions inside the existing `CriteriaInputPanel` so users know exactly where to find them.

This is a single-file UI change. No backend changes. No new routes. No new components.

---

## Change

**File:** `src/components/CriteriaInputPanel.tsx`

Replace the current blue info callout (`<div className="flex items-start gap-2.5 p-3 bg-blue-500/5...">`) with a numbered instruction block:

```tsx
<div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/30 space-y-2">
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">How to find your selection criteria</p>
    <ol className="space-y-1.5">
        {[
            'Go back to the job listing',
            'Look for any attached Position Description or Application Pack PDF',
            'Find the selection criteria section',
            'Copy and paste it below',
        ].map((step, i) => (
            <li key={i} className="flex items-start gap-2">
                <span className="text-[10px] font-black text-purple-400 shrink-0 mt-0.5">{i + 1}.</span>
                <span className="text-[11px] text-slate-400 leading-snug">{step}</span>
            </li>
        ))}
    </ol>
</div>
```

The `company` prop reference inside the old callout (`For ${company} roles...`) is removed — no longer needed.

---

## What Is Not Changing

- The textarea, parsed criteria preview, framework badge, and all other panel logic stay exactly as-is
- No backend changes
- No new components
- No framework-specific branching
