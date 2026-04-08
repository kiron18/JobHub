# Match Grade Dashboard Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sort the Job Applications dashboard by match score by default and add a grade filter so users see their best-fit jobs at the top.

**Architecture:** Four frontend-only changes. No backend changes — `GET /api/jobs` already returns `matchScore` and `overallGrade` from Prisma. The `JobApplication` type gets two new optional fields, the sort system gains a `'match'` option, a grade filter row is added above the job list, and `JobCard` gets a colour-coded grade badge.

**Tech Stack:** React/TypeScript, Tailwind CSS, Framer Motion (existing patterns)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/components/tracker/types.ts` | Add `matchScore?` and `overallGrade?` to `JobApplication` |
| Modify | `src/components/tracker/SortControls.tsx` | Add `'match'` to `SortBy`, render "Match" button |
| Modify | `src/components/ApplicationTracker.tsx` | Default sort → `'match'`, add match sort case, add grade filter chips |
| Modify | `src/components/tracker/JobCard.tsx` | Add colour-coded grade badge in the badges row |

---

## Task 1: Extend JobApplication Type

**Files:**
- Modify: `src/components/tracker/types.ts`

- [ ] **Step 1: Add the two optional fields**

Open `src/components/tracker/types.ts`. The current `JobApplication` interface ends with `createdAt: string;`. Add two optional fields after `createdAt`:

```typescript
export interface JobApplication {
    id: string;
    title: string;
    company: string;
    description: string;
    status: ApplicationStatus;
    dateApplied: string | null;
    closingDate: string | null;
    notes: string | null;
    priority: JobPriority;
    documents: TrackerDocument[];
    createdAt: string;
    matchScore?: number;     // 0–100 weighted composite from 10-dimension scoring
    overallGrade?: string;   // "A" | "B" | "C" | "D" | "F"
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from the repo root:
```bash
cd /e/AntiGravity/JobHub && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors (there may be pre-existing errors — note them but don't fix them).

- [ ] **Step 3: Commit**

```bash
git add src/components/tracker/types.ts
git commit -m "feat(types): add matchScore and overallGrade to JobApplication"
```

---

## Task 2: Add Match Sort Option

**Files:**
- Modify: `src/components/tracker/SortControls.tsx`

- [ ] **Step 1: Add `'match'` to the SortBy type and render the button**

Replace the entire file content with:

```typescript
import React from 'react';

export type SortBy = 'recent' | 'priority' | 'company' | 'deadline' | 'match';

interface SortControlsProps {
    sortBy: SortBy;
    onSortChange: (sort: SortBy) => void;
}

export const SortControls: React.FC<SortControlsProps> = ({ sortBy, onSortChange }) => {
    return (
        <div className="ml-auto flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-1 py-0.5">
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider px-1">Sort</span>
            {(['match', 'recent', 'priority', 'deadline', 'company'] as const).map(s => (
                <button
                    key={s}
                    onClick={() => onSortChange(s)}
                    className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${
                        sortBy === s ? 'bg-slate-700 text-slate-200' : 'text-slate-600 hover:text-slate-400'
                    }`}
                >
                    {s === 'match' ? 'Match' : s === 'recent' ? 'Newest' : s === 'priority' ? 'Priority' : s === 'deadline' ? 'Deadline' : 'A–Z'}
                </button>
            ))}
        </div>
    );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /e/AntiGravity/JobHub && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tracker/SortControls.tsx
git commit -m "feat(tracker): add Match sort option to SortControls"
```

---

## Task 3: Default Sort + Grade Filter in ApplicationTracker

**Files:**
- Modify: `src/components/ApplicationTracker.tsx`

- [ ] **Step 1: Change default sort and add grade filter state**

Open `src/components/ApplicationTracker.tsx`. Find line 32:
```typescript
    const [sortBy, setSortBy] = useState<SortBy>('recent');
```

Replace with:
```typescript
    const [sortBy, setSortBy] = useState<SortBy>('match');
    const [gradeFilter, setGradeFilter] = useState<'ALL' | 'AB' | 'C' | 'DF'>('ALL');
```

- [ ] **Step 2: Add match sort case and grade filtering**

Find the `filteredJobs` block (lines 138–154):
```typescript
    const filteredJobs = [...(filterStatus === 'ALL' ? jobs : jobs.filter(j => j.status === filterStatus))].sort((a, b) => {
        if (sortBy === 'priority') {
            const pa = a.priority ? (PRIORITY_ORDER[a.priority] ?? 3) : 3;
            const pb = b.priority ? (PRIORITY_ORDER[b.priority] ?? 3) : 3;
            if (pa !== pb) return pa - pb;
        }
        if (sortBy === 'company') {
            return (a.company || '').localeCompare(b.company || '');
        }
        if (sortBy === 'deadline') {
            const da = a.closingDate ? new Date(a.closingDate).getTime() : Infinity;
            const db = b.closingDate ? new Date(b.closingDate).getTime() : Infinity;
            return da - db;
        }
        // default: recent
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
```

Replace with:
```typescript
    const statusFiltered = filterStatus === 'ALL' ? jobs : jobs.filter(j => j.status === filterStatus);

    const gradeFiltered = gradeFilter === 'ALL' ? statusFiltered
        : gradeFilter === 'AB' ? statusFiltered.filter(j => j.overallGrade === 'A' || j.overallGrade === 'B')
        : gradeFilter === 'C'  ? statusFiltered.filter(j => j.overallGrade === 'C')
        : statusFiltered.filter(j => j.overallGrade === 'D' || j.overallGrade === 'F');

    const filteredJobs = [...gradeFiltered].sort((a, b) => {
        if (sortBy === 'match') {
            const aScore = a.matchScore ?? -1;
            const bScore = b.matchScore ?? -1;
            return bScore - aScore;
        }
        if (sortBy === 'priority') {
            const pa = a.priority ? (PRIORITY_ORDER[a.priority] ?? 3) : 3;
            const pb = b.priority ? (PRIORITY_ORDER[b.priority] ?? 3) : 3;
            if (pa !== pb) return pa - pb;
        }
        if (sortBy === 'company') {
            return (a.company || '').localeCompare(b.company || '');
        }
        if (sortBy === 'deadline') {
            const da = a.closingDate ? new Date(a.closingDate).getTime() : Infinity;
            const db = b.closingDate ? new Date(b.closingDate).getTime() : Infinity;
            return da - db;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
```

- [ ] **Step 3: Add grade filter chips to the UI**

Find the `{/* Filters + Sort */}` section (around line 316). It currently has one `<div className="flex flex-wrap items-center gap-2">` row with status filters and sort controls. Add a second row immediately after it for the grade filter:

```tsx
            {/* Filters + Sort */}
            <div className="flex flex-wrap items-center gap-2">
                {(['ALL', ...STATUS_FLOW] as const).map(status => {
                    const count = counts[status];
                    const config = status === 'ALL' ? null : STATUS_CONFIG[status];
                    return (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                                filterStatus === status
                                    ? (config ? config.color : 'bg-slate-700 border-slate-600 text-slate-200')
                                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                            }`}
                        >
                            {config && <config.icon size={10} />}
                            {status === 'ALL' ? 'All' : STATUS_CONFIG[status].label}
                            <span className="ml-1 opacity-60">{count}</span>
                        </button>
                    );
                })}
                <SortControls sortBy={sortBy} onSortChange={setSortBy} />
            </div>

            {/* Grade filter */}
            <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Grade</span>
                {([
                    { key: 'ALL', label: 'All' },
                    { key: 'AB',  label: 'A – B' },
                    { key: 'C',   label: 'C' },
                    { key: 'DF',  label: 'D – F' },
                ] as const).map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setGradeFilter(key)}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                            gradeFilter === key
                                ? 'bg-slate-700 border-slate-600 text-slate-200'
                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /e/AntiGravity/JobHub && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ApplicationTracker.tsx
git commit -m "feat(tracker): default sort by match grade, add grade filter chips"
```

---

## Task 4: Grade Badge on JobCard

**Files:**
- Modify: `src/components/tracker/JobCard.tsx`

- [ ] **Step 1: Add the grade badge colour map and badge element**

Open `src/components/tracker/JobCard.tsx`. Find the badges row inside `JobCard` (around line 487–510). It currently shows the status badge and priority badge in a `<div className="flex items-center gap-2 mb-1 flex-wrap">`. 

Add the grade badge after the priority `<div className="relative">...</div>` block and before the closing of the flex wrapper. The grade badge is read-only (no click handler):

```tsx
                        {/* Grade badge */}
                        {job.overallGrade && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${
                                job.overallGrade === 'A' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' :
                                job.overallGrade === 'B' ? 'text-brand-400 bg-brand-400/10 border-brand-400/20' :
                                job.overallGrade === 'C' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' :
                                job.overallGrade === 'D' ? 'text-orange-400 bg-orange-400/10 border-orange-400/20' :
                                                           'text-red-400 bg-red-400/10 border-red-400/20'
                            }`}>
                                {job.overallGrade}
                                {job.matchScore != null && (
                                    <span className="opacity-60 font-bold">{job.matchScore}</span>
                                )}
                            </span>
                        )}
```

To locate the exact insertion point: find the closing `</div>` of the `relative` div wrapping the priority button (the one with `setPriorityMenuOpen`), then insert the grade badge JSX immediately after it, still inside the outer `flex items-center gap-2 mb-1 flex-wrap` div.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /e/AntiGravity/JobHub && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tracker/JobCard.tsx
git commit -m "feat(tracker): add colour-coded grade badge to JobCard"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ `matchScore?` and `overallGrade?` added to `JobApplication` — Task 1
- ✅ `'match'` added to `SortBy` — Task 2
- ✅ Default sort changed to `'match'` — Task 3
- ✅ Match sort case (unscored jobs to bottom) — Task 3
- ✅ Grade filter chips `All / A–B / C / D–F` — Task 3
- ✅ Grade badge on JobCard with colour coding — Task 4
- ✅ No backend changes (spec: `GET /api/jobs` already returns the fields)

**Placeholder scan:** None found.

**Type consistency:** `SortBy` defined in Task 2, consumed in Task 3 (same file import). `JobApplication.overallGrade` and `matchScore` defined in Task 1, consumed in Tasks 3 and 4.
