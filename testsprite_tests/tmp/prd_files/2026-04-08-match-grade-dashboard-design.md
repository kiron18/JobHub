# Sub-project 2: Match Grade Dashboard Ranking
*Design spec — April 8 2026*

---

## Overview

Surfaces the 10-dimension match scores (from Sub-project 1) in the Job Applications dashboard. Jobs are sorted best-match-first by default, and a grade filter lets users quickly focus on their strongest opportunities. No new backend logic — all data already returns from `GET /api/jobs`.

---

## Changes

### 1. `src/components/tracker/types.ts`

Add two optional fields to `JobApplication`:

```typescript
matchScore?: number;     // 0–100 weighted composite
overallGrade?: string;   // "A" | "B" | "C" | "D" | "F"
```

Jobs added before Sub-project 1 will have these as `undefined` — treated as unscored and sorted to the bottom.

---

### 2. `src/components/tracker/SortControls.tsx`

Add `'match'` to `SortBy`:

```typescript
export type SortBy = 'recent' | 'priority' | 'company' | 'deadline' | 'match';
```

Add "Best Match" button to the sort controls. Label: `Match`.

---

### 3. `src/components/ApplicationTracker.tsx`

**Default sort:** Change `useState<SortBy>('recent')` to `useState<SortBy>('match')`.

**Sort case for `match`:**
```typescript
if (sortBy === 'match') {
    const aScore = a.matchScore ?? -1;
    const bScore = b.matchScore ?? -1;
    return bScore - aScore;
}
```
Unscored jobs (`matchScore` undefined) get `-1` and fall to the bottom.

**Grade filter:** Add state `const [gradeFilter, setGradeFilter] = useState<'ALL' | 'AB' | 'C' | 'DF'>('ALL')`.

Apply after status filter and before sort:
```typescript
const gradeFiltered = gradeFilter === 'ALL' ? statusFiltered
    : gradeFilter === 'AB' ? statusFiltered.filter(j => j.overallGrade === 'A' || j.overallGrade === 'B')
    : gradeFilter === 'C'  ? statusFiltered.filter(j => j.overallGrade === 'C')
    : statusFiltered.filter(j => j.overallGrade === 'D' || j.overallGrade === 'F');
```

**Grade filter chips UI:** Render above the job list, alongside the existing status filter row:
```
[ All ]  [ A–B ]  [ C ]  [ D–F ]
```
Active chip uses `bg-slate-700 text-slate-200`. Inactive uses `text-slate-500 hover:text-slate-400`.

---

### 4. `src/components/tracker/JobCard.tsx`

Add a grade badge when `overallGrade` is present. Colour mapping:

| Grade | Colour |
|---|---|
| A | `text-emerald-400 bg-emerald-400/10` |
| B | `text-brand-400 bg-brand-400/10` |
| C | `text-amber-400 bg-amber-400/10` |
| D | `text-orange-400 bg-orange-400/10` |
| F | `text-red-400 bg-red-400/10` |

Badge format: `B  87` (grade letter + score). Shown as a small pill in the top-right of the card, or inline with the company/title row. Consistent with the `DimensionsIsland` grade colours from Sub-project 1.

---

## What Is Not Changing

- Backend: no route changes, no DB migrations
- The `GET /api/jobs` response already includes `matchScore` and `overallGrade` via Prisma's default scalar field return
- `ApplicationWorkspace` and `DimensionsIsland` — no changes

---

## Out of Scope

- Side-by-side comparison table
- Filtering by specific dimension scores
- Score history / score changes over time
