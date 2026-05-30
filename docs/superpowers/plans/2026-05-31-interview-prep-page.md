# Interview Prep — Dedicated Page + Calm Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing (orphaned) interview-prep generation into a dedicated `/interview/:jobId` page, reached from a pill on the INTERVIEW tracker card, and add the missing calm layer (mindset anchors, on-the-day, final checklist) as static copy.

**Architecture:** Reuse the live `POST /generate/interview-prep` endpoint and the existing `InterviewPrepView` renderer. Persist the result as a new `INTERVIEW_PREP` document type linked to the job. A thin new page loads the job, generates-or-fetches, and renders `InterviewPrepView`. `InterviewPrepView` is extended to render three new static copy sections and a small generated "Your Edge" header. Delete the unused `InterviewQuestionsPanel` and dead routes.

**Tech Stack:** React + TypeScript + Vite, react-router-dom, @tanstack/react-query, framer-motion, Express + Prisma (Postgres), warm design tokens (`src/lib/theme/warmTokens`).

---

## ⛔ Rules for the implementing engineer (READ FIRST — non-negotiable)

This plan was written deliberately. You are implementing it **exactly as written**. You do not have design latitude.

1. **Make NO decisions.** Every file path, every string, every style value is specified. If something appears to be a choice, it is not — use exactly what is written.
2. **Make NO assumptions.** If a step seems to conflict with the codebase (a line number moved, a function renamed, an import missing), **STOP and report it**. Do not "fix it your way", do not invent a workaround, do not create a parallel file.
3. **Do NOT create alternative files or components.** Do not duplicate `InterviewPrepView`, do not make a second page, do not "refactor while you're here". The single source of truth for the renderer is `src/components/InterviewPrepView.tsx`. The single page is `src/pages/InterviewPrepWorkspace.tsx`. Nothing else.
4. **Copy the exact text.** All static copy (mindset anchors, on-the-day, checklist) is written out in full in this plan. Reproduce it verbatim. Do not paraphrase, rewrite, "improve", or add to it.
5. **Anchored edits:** where a step says "find this exact block", search for that literal text. If you cannot find it verbatim, STOP and report. Do not edit by approximate location.
6. **Run the verification command at the end of every task.** Do not proceed to the next task until the stated command passes with the stated output.
7. **One commit per task**, using the exact commit message given.

If you ever feel the urge to "use your judgment", that is the signal to stop and ask. The single biggest failure mode this plan prevents is a second, divergent implementation appearing alongside the first.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `server/prisma/schema.prisma` | Modify | Add `INTERVIEW_PREP` to `DocumentType` enum |
| `server/prisma/migrations/20260531000001_add_interview_prep_doc_type/migration.sql` | Create | Enum migration |
| `server/src/routes/generate.ts` | Modify | Map `interview-prep` → `INTERVIEW_PREP` doc type |
| `server/rules/interview_prep_rules.md` | Modify | Emit a `### Your Edge` block (Why You + 1 personalised anchor) |
| `server/src/routes/ai-tools.ts` | Modify | Delete the unused `/interview-questions` route |
| `src/components/tracker/types.ts` | Modify | Add `INTERVIEW_PREP` to `TrackerDocument['type']` |
| `src/components/interview/MindsetAnchors.tsx` | Create | Static "Before You Walk In" section |
| `src/components/interview/OnTheDay.tsx` | Create | Static "On The Day" section |
| `src/components/interview/FinalChecklist.tsx` | Create | Static "Final Checklist" section + affirmation |
| `src/components/InterviewPrepView.tsx` | Modify | Parse "Your Edge"; render header + 3 static sections in order |
| `src/pages/InterviewPrepWorkspace.tsx` | Create | Page: load job, generate-or-fetch, render `InterviewPrepView` |
| `src/App.tsx` | Modify | Add lazy route `/interview/:jobId` |
| `src/components/tracker/JobCard.tsx` | Modify | Pill on INTERVIEW card → page; badge label for new doc type |
| `src/components/InterviewQuestionsPanel.tsx` | Delete | Consolidate to one module |
| `src/components/MatchEngine.tsx` | Modify | Remove dead `/application-workspace` navigations |

---

## Task 1: Add the `INTERVIEW_PREP` document type (schema + migration)

**Files:**
- Modify: `server/prisma/schema.prisma:309-314`
- Create: `server/prisma/migrations/20260531000001_add_interview_prep_doc_type/migration.sql`

- [ ] **Step 1: Edit the enum**

Find this exact block in `server/prisma/schema.prisma`:

```prisma
enum DocumentType {
  RESUME
  COVER_LETTER
  STAR_RESPONSE
  BASELINE_RESUME
}
```

Replace it with:

```prisma
enum DocumentType {
  RESUME
  COVER_LETTER
  STAR_RESPONSE
  BASELINE_RESUME
  INTERVIEW_PREP
}
```

- [ ] **Step 2: Create the migration file**

Create `server/prisma/migrations/20260531000001_add_interview_prep_doc_type/migration.sql` with exactly this content:

```sql
-- Add INTERVIEW_PREP to DocumentType enum
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'INTERVIEW_PREP';
```

- [ ] **Step 3: Apply the migration and regenerate the Prisma client**

Run from the `server` directory:

```bash
cd server && npm run migrate && npx prisma generate
```

Expected: migration applies without error; `prisma generate` prints "Generated Prisma Client".

> If `npm run migrate` cannot connect to a database in this environment, STOP and report. Do not skip, and do not hand-edit the generated client.

- [ ] **Step 4: Verify the server still builds**

Run:

```bash
cd server && npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add server/prisma/schema.prisma "server/prisma/migrations/20260531000001_add_interview_prep_doc_type/migration.sql"
git commit -m "feat(db): add INTERVIEW_PREP document type"
```

---

## Task 2: Persist interview-prep as `INTERVIEW_PREP` (not `STAR_RESPONSE`)

**Files:**
- Modify: `server/src/routes/generate.ts:156`

- [ ] **Step 1: Update the doc-type mapping**

Find this exact line in `server/src/routes/generate.ts` (line ~156):

```ts
        const docType = type === 'selection-criteria' || type === 'interview-prep' || type === 'followup-email' || type === 'teaching-philosophy' || type === 'research-statement' || type === 'offer-negotiation' || type === 'linkedin-profile' || type === 'cold-outreach' || type === 'rejection-response' ? 'STAR_RESPONSE' : (type === 'cover-letter' ? 'COVER_LETTER' : 'RESUME');
```

Replace it with (note: `interview-prep` is removed from the `STAR_RESPONSE` group and given its own branch):

```ts
        const docType = type === 'interview-prep' ? 'INTERVIEW_PREP' : (type === 'selection-criteria' || type === 'followup-email' || type === 'teaching-philosophy' || type === 'research-statement' || type === 'offer-negotiation' || type === 'linkedin-profile' || type === 'cold-outreach' || type === 'rejection-response' ? 'STAR_RESPONSE' : (type === 'cover-letter' ? 'COVER_LETTER' : 'RESUME'));
```

- [ ] **Step 2: Verify the server builds**

Run:

```bash
cd server && npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/generate.ts
git commit -m "feat(generate): store interview prep as INTERVIEW_PREP doc type"
```

---

## Task 3: Emit a generated "Your Edge" block from the rules

**Files:**
- Modify: `server/rules/interview_prep_rules.md`

This adds two small generated fields (a "Why You" fit statement and one personalised mindset anchor). Everything else in the calm layer is static frontend copy and is NOT generated.

- [ ] **Step 1: Add the "Your Edge" output section**

Find this exact block near the top of `server/rules/interview_prep_rules.md`:

```markdown
## Output Structure
Follow this exact structure with exact headings. The client parses these headings to build the UI.

---

### 1. Know the Stage
```

Replace it with:

```markdown
## Output Structure
Follow this exact structure with exact headings. The client parses these headings to build the UI.

---

### Your Edge
**Why You:** [2-3 sentences. Speak to the candidate directly. Name the specific overlap between this candidate's real background and what this role needs. Concrete, not flattering. Drawn from their actual profile, never invented.]
**Your Anchor:** [One short, calming, confidence-building sentence the candidate can carry into the room, grounded in their specific strength. Example shape: "Your years running X are not background experience, they are exactly the capability this team is missing." Personalise to this candidate. One or two sentences maximum.]

---

### 1. Know the Stage
```

- [ ] **Step 2: Relax the two constraints that would forbid the new block**

Find this exact block at the end of the file:

```markdown
- Do NOT include generic tips, meta-commentary, or caveats
- Do NOT add sections not listed above
```

Replace it with:

```markdown
- Do NOT include generic tips or meta-commentary inside the Know the Stage, Story Bank, Prove It, or Questions to Ask sections
- The ONLY sections you output are: Your Edge, 1. Know the Stage, 2. Story Bank, 3. Prove It, 4. Questions to Ask. Do NOT add any other sections.
```

- [ ] **Step 3: Verify (no build needed — this is a rules text file)**

Run:

```bash
git diff --stat server/rules/interview_prep_rules.md
```

Expected: shows `server/rules/interview_prep_rules.md` changed.

- [ ] **Step 4: Commit**

```bash
git add server/rules/interview_prep_rules.md
git commit -m "feat(rules): emit Your Edge block for interview prep"
```

---

## Task 4: Add `INTERVIEW_PREP` to the frontend document type

**Files:**
- Modify: `src/components/tracker/types.ts:6-12`

- [ ] **Step 1: Extend the union**

Find this exact block in `src/components/tracker/types.ts`:

```ts
export interface TrackerDocument {
    id: string;
    type: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE';
    content: string;
    title?: string;
    createdAt: string;
}
```

Replace it with:

```ts
export interface TrackerDocument {
    id: string;
    type: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' | 'INTERVIEW_PREP';
    content: string;
    title?: string;
    createdAt: string;
}
```

- [ ] **Step 2: Verify the frontend typechecks**

Run from the repo root:

```bash
npx tsc -b
```

Expected: this will now report an error in `src/components/tracker/JobCard.tsx` about `BADGE_COLORS` missing the `INTERVIEW_PREP` key. **That is expected** — it is fixed in Task 9. Confirm the ONLY new error is that `BADGE_COLORS` Record key error. If any other error appears, STOP and report.

- [ ] **Step 3: Commit**

```bash
git add src/components/tracker/types.ts
git commit -m "feat(types): add INTERVIEW_PREP to TrackerDocument type"
```

---

## Task 5: Create the static "Before You Walk In" section

**Files:**
- Create: `src/components/interview/MindsetAnchors.tsx`

This renders mindset anchors 1–4 (static, verbatim below) plus a 5th slot for the generated `anchor` prop.

- [ ] **Step 1: Create the file**

Create `src/components/interview/MindsetAnchors.tsx` with exactly this content:

```tsx
import { warm } from '../../lib/theme/warmTokens';

const ANCHORS: { title: string; body: string }[] = [
    {
        title: 'You are not auditioning. You are having a conversation.',
        body: "You have already been selected for interview. They read your application and thought: this person could be the one. Walk in as someone deciding whether this role is right for you, not only whether you are right for it. That energy is felt across the table.",
    },
    {
        title: 'Pause before you answer. Always.',
        body: 'After a question is asked, take one breath before you speak. This is not hesitation, it is precision. A composed start signals someone who thinks before they speak, which is exactly the capability they are hiring for.',
    },
    {
        title: 'Use CAR: Context, Action, Result.',
        body: 'Every behavioural answer has three parts. One sentence of context, the specific things you did, and the result. Do not skip the result. It is where the value lives.',
    },
    {
        title: 'Address them as a peer who brings something they need.',
        body: 'You are not asking for a favour. You bring a set of capabilities aligned to a specific problem they have. Everything you say should come from: I understand what you are trying to do, and here is how I help you do it.',
    },
];

export function MindsetAnchors({ anchor }: { anchor?: string }) {
    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: warm.colors.accentGold }}>
                    Before You Walk In
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: warm.colors.textMuted, lineHeight: 1.6 }}>
                    Read these before you get dressed. Carry them in.
                </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ANCHORS.map((a, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex',
                            gap: 14,
                            padding: '16px 18px',
                            background: warm.colors.bgSurface,
                            border: `1px solid ${warm.colors.borderWhisper}`,
                            borderRadius: 14,
                        }}
                    >
                        <span style={{ fontSize: 20, fontWeight: 800, color: warm.colors.accentGold, lineHeight: 1, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {i + 1}
                        </span>
                        <div>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: warm.colors.textPrimary, lineHeight: 1.4 }}>{a.title}</p>
                            <p style={{ margin: '6px 0 0', fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.6 }}>{a.body}</p>
                        </div>
                    </div>
                ))}
                {anchor && anchor.trim().length > 0 && (
                    <div
                        style={{
                            display: 'flex',
                            gap: 14,
                            padding: '16px 18px',
                            background: 'rgba(197,160,89,0.06)',
                            border: '1px solid rgba(197,160,89,0.30)',
                            borderRadius: 14,
                        }}
                    >
                        <span style={{ fontSize: 20, fontWeight: 800, color: warm.colors.accentGold, lineHeight: 1, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            5
                        </span>
                        <div>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: warm.colors.textPrimary, lineHeight: 1.4 }}>
                                This one is yours.
                            </p>
                            <p style={{ margin: '6px 0 0', fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.6 }}>{anchor}</p>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
```

- [ ] **Step 2: Verify it typechecks**

Run:

```bash
npx tsc -b
```

Expected: no NEW errors from `MindsetAnchors.tsx` (the pre-existing `BADGE_COLORS` error from Task 4 is still present and still expected).

- [ ] **Step 3: Commit**

```bash
git add src/components/interview/MindsetAnchors.tsx
git commit -m "feat(interview): add static MindsetAnchors section"
```

---

## Task 6: Create the static "On The Day" section

**Files:**
- Create: `src/components/interview/OnTheDay.tsx`

- [ ] **Step 1: Create the file**

Create `src/components/interview/OnTheDay.tsx` with exactly this content:

```tsx
import { warm } from '../../lib/theme/warmTokens';

const ITEMS: { label: string; body: string }[] = [
    {
        label: 'Dress',
        body: 'Polished, considered, professional. Dress at the level of the role you are stepping into, not the environment you expect to find.',
    },
    {
        label: 'Arrive',
        body: 'Ten minutes early, minimum. Use the time to read your notes calmly, not to take in new information. Your preparation is done. Breathe.',
    },
    {
        label: 'The pause',
        body: 'After every question, take one breath before you begin. Non-negotiable, even when the answer is immediate. It signals composure and precision.',
    },
    {
        label: 'Eye contact',
        body: 'Sustained, warm, direct. You are speaking to people, not delivering a presentation. Engage everyone in the room, not only whoever asked the question.',
    },
    {
        label: 'First sentence',
        body: 'Open every answer with a sentence that frames what it is about, then go into the story. "In my time at that organisation, I led a piece of work that maps directly to this."',
    },
    {
        label: 'The smile',
        body: 'A genuine smile at the start, when you agree with something they say, and at the close. Not a performance. A signal that you enjoy this work and this conversation.',
    },
];

export function OnTheDay() {
    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: warm.colors.accentGold }}>
                    On The Day
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: warm.colors.textMuted, lineHeight: 1.6 }}>
                    Presence and delivery. The small things that carry the big ones.
                </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ITEMS.map((it, i) => (
                    <div
                        key={i}
                        style={{
                            padding: '14px 18px',
                            background: warm.colors.bgSurface,
                            border: `1px solid ${warm.colors.borderWhisper}`,
                            borderRadius: 14,
                        }}
                    >
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: warm.colors.accentPetrol }}>{it.label}</p>
                        <p style={{ margin: '6px 0 0', fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.6 }}>{it.body}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
```

- [ ] **Step 2: Verify it typechecks**

Run:

```bash
npx tsc -b
```

Expected: no NEW errors from `OnTheDay.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/interview/OnTheDay.tsx
git commit -m "feat(interview): add static OnTheDay section"
```

---

## Task 7: Create the static "Final Checklist" section

**Files:**
- Create: `src/components/interview/FinalChecklist.tsx`

The `company` prop is interpolated into one checklist item. If empty, a neutral fallback is used (specified below — do not invent your own).

- [ ] **Step 1: Create the file**

Create `src/components/interview/FinalChecklist.tsx` with exactly this content:

```tsx
import { warm } from '../../lib/theme/warmTokens';

export function FinalChecklist({ company }: { company?: string }) {
    const org = company && company.trim().length > 0 ? company.trim() : 'the organisation';

    const groups: { heading: string; items: string[] }[] = [
        {
            heading: 'The night before',
            items: [
                'Practise each CAR answer out loud. Once each. Record yourself if it helps.',
                'Write down three things you are proud of from your work. Read them before you sleep.',
                'Confirm the interview time, location, and the names of the panel.',
                'Lay out what you are wearing. Decide now, not in the morning.',
                `Read ${org}'s current priorities. Know one thing they are working on right now.`,
            ],
        },
        {
            heading: 'The morning of',
            items: [
                'Eat something. Do not arrive hungry.',
                'Re-read the five mindset anchors.',
                'Put your phone on silent before you enter the building.',
                'When they offer you water, say yes. It gives you a pause mechanism.',
            ],
        },
        {
            heading: 'In the room',
            items: [
                'Pause before every answer. One breath.',
                'Context, Action, Result. Name the outcome every time.',
                'If a question lands unexpectedly: "That is a great question, let me take a moment." Then take it.',
                'End with your two questions. The last impression matters as much as the first.',
            ],
        },
    ];

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: warm.colors.accentGold }}>
                    Final Checklist
                </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {groups.map((g, gi) => (
                    <div key={gi}>
                        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: warm.colors.accentPetrol }}>{g.heading}</p>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {g.items.map((item, ii) => (
                                <li key={ii} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <span style={{ flexShrink: 0, marginTop: 7, width: 5, height: 5, borderRadius: '50%', background: warm.colors.accentGold }} />
                                    <span style={{ fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.6 }}>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <div
                style={{
                    padding: '18px 20px',
                    background: 'rgba(197,160,89,0.06)',
                    border: '1px solid rgba(197,160,89,0.30)',
                    borderRadius: 14,
                }}
            >
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary, lineHeight: 1.5 }}>
                    You are ready for this.
                </p>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                    Your experience, your values, and your track record are exactly what this role was written for. Walk in knowing that.
                </p>
            </div>
        </section>
    );
}
```

- [ ] **Step 2: Verify it typechecks**

Run:

```bash
npx tsc -b
```

Expected: no NEW errors from `FinalChecklist.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/interview/FinalChecklist.tsx
git commit -m "feat(interview): add static FinalChecklist section"
```

---

## Task 8: Extend `InterviewPrepView` — parse "Your Edge" + render header and static sections in order

**Files:**
- Modify: `src/components/InterviewPrepView.tsx`

`InterviewPrepView` becomes the single full-page renderer: header (Role · Org · Why You) → MindsetAnchors → existing generated sections → OnTheDay → FinalChecklist.

- [ ] **Step 1: Add imports**

Find this exact line at the top of `src/components/InterviewPrepView.tsx`:

```tsx
import { ChevronDown, ChevronRight, Eye, EyeOff, Lightbulb } from 'lucide-react';
```

Immediately AFTER it, add:

```tsx
import { MindsetAnchors } from './interview/MindsetAnchors';
import { OnTheDay } from './interview/OnTheDay';
import { FinalChecklist } from './interview/FinalChecklist';
```

- [ ] **Step 2: Add the two new fields to the data interface**

Find this exact block:

```tsx
interface InterviewPrepData {
    companyIntelligence: string[];
    lookingFor: string;
    watchOuts: string[];
    storyBank: StoryCard[];
    proveIt: QuestionType[];
    questionsToAsk: string[];
}
```

Replace it with:

```tsx
interface InterviewPrepData {
    whyYou: string;
    anchor: string;
    companyIntelligence: string[];
    lookingFor: string;
    watchOuts: string[];
    storyBank: StoryCard[];
    proveIt: QuestionType[];
    questionsToAsk: string[];
}
```

- [ ] **Step 3: Initialise the two new fields in the parser**

Find this exact block:

```tsx
    const result: InterviewPrepData = {
        companyIntelligence: [],
        lookingFor: '',
        watchOuts: [],
        storyBank: [],
        proveIt: [],
        questionsToAsk: [],
    };
```

Replace it with:

```tsx
    const result: InterviewPrepData = {
        whyYou: '',
        anchor: '',
        companyIntelligence: [],
        lookingFor: '',
        watchOuts: [],
        storyBank: [],
        proveIt: [],
        questionsToAsk: [],
    };
```

- [ ] **Step 4: Detect the "Your Edge" section heading**

Find this exact block:

```tsx
        // Top-level section detection
        if (/^#{1,3}\s*1\.\s*know the stage/i.test(line)) { section = 'know'; subSection = ''; continue; }
```

Replace it with:

```tsx
        // Top-level section detection
        if (/^#{1,4}\s*your edge/i.test(line)) { section = 'edge'; subSection = ''; continue; }
        if (/^#{1,3}\s*1\.\s*know the stage/i.test(line)) { section = 'know'; subSection = ''; continue; }
```

- [ ] **Step 5: Parse the "Your Edge" fields**

Find this exact block (it is the start of the "Know the Stage" sub-section parsing):

```tsx
        // Sub-sections within "Know the Stage"
        if (section === 'know') {
```

Immediately BEFORE it, insert:

```tsx
        // "Your Edge" fields
        if (section === 'edge') {
            const whyMatch = line.match(/^\*{0,2}why you[:\s]+\*{0,2}\s*(.+)/i);
            const anchorMatch = line.match(/^\*{0,2}your anchor[:\s]+\*{0,2}\s*(.+)/i);
            if (whyMatch) { result.whyYou = whyMatch[1].replace(/\*+/g, '').trim(); }
            else if (anchorMatch) { result.anchor = anchorMatch[1].replace(/\*+/g, '').trim(); }
            continue;
        }

```

- [ ] **Step 6: Render the header + MindsetAnchors at the top of the output**

Find this exact block (the opening of the main returned JSX):

```tsx
    return (
        <div className="w-full max-w-3xl space-y-4">

            {/* Section 1, Know the Stage */}
```

Replace it with:

```tsx
    return (
        <div className="w-full max-w-3xl space-y-8">

            {/* Header — Role · Organisation · Why You */}
            <div className="space-y-3">
                <div>
                    <p className="text-[9px] font-black text-[#8B847B] uppercase tracking-widest">Interview Prep</p>
                    <h1 className="text-2xl font-bold text-[#1A1814] leading-tight mt-1">
                        {role || 'Your interview'}{company ? ` · ${company}` : ''}
                    </h1>
                </div>
                {data.whyYou && (
                    <div className="rounded-xl border border-brand-600/30 bg-brand-600/5 p-4">
                        <p className="text-[9px] font-black text-brand-400 uppercase tracking-widest">Why You</p>
                        <p className="text-[13px] text-[#1A1814] leading-relaxed mt-1.5">{data.whyYou}</p>
                    </div>
                )}
            </div>

            {/* Before You Walk In — mindset anchors */}
            <MindsetAnchors anchor={data.anchor} />

            {/* Section 1, Know the Stage */}
```

- [ ] **Step 7: Render OnTheDay + FinalChecklist at the end of the output**

Find this exact block (the close of the main returned JSX — the Questions to Ask section followed by the closing tags):

```tsx
            )}
        </div>
    );
}
```

> Note: there are multiple `)}` / `</div>` sequences in this file. The correct one is the FINAL occurrence — the very end of the `InterviewPrepView` function's `return`, immediately after the "Section 4, Questions to Ask" block. Confirm the lines directly above it are the Questions to Ask `CollapsibleSection`. If unsure, STOP and report rather than editing the wrong block.

Replace that final block with:

```tsx
            )}

            {/* On The Day — static */}
            <OnTheDay />

            {/* Final Checklist — static */}
            <FinalChecklist company={company} />
        </div>
    );
}
```

- [ ] **Step 8: Verify it typechecks**

Run:

```bash
npx tsc -b
```

Expected: no NEW errors from `InterviewPrepView.tsx` (the `BADGE_COLORS` error from Task 4 is still expected until Task 9).

- [ ] **Step 9: Commit**

```bash
git add src/components/InterviewPrepView.tsx
git commit -m "feat(interview): render Your Edge header + calm sections in InterviewPrepView"
```

---

## Task 9: Create the page and wire the route

**Files:**
- Create: `src/pages/InterviewPrepWorkspace.tsx`
- Modify: `src/App.tsx` (lazy import block near line 44; route list near line 400)

- [ ] **Step 1: Create the page**

Create `src/pages/InterviewPrepWorkspace.tsx` with exactly this content:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import type { JobApplication } from '../components/tracker/types';
import { InterviewPrepView } from '../components/InterviewPrepView';
import { warm } from '../lib/theme/warmTokens';

const LOADING_LINES = [
    'Building your prep from your real experience…',
    'Mapping your stories to the questions they will ask…',
    'Almost there — your guide is nearly ready.',
];

export function InterviewPrepWorkspace() {
    const { jobId } = useParams<{ jobId: string }>();
    const queryClient = useQueryClient();
    const [generating, setGenerating] = useState(false);
    const [loadingLine, setLoadingLine] = useState(0);

    const { data: jobs = [], isLoading } = useQuery<JobApplication[]>({
        queryKey: ['jobs'],
        queryFn: async () => {
            const { data } = await api.get('/jobs');
            return data;
        },
    });

    const job = useMemo(() => jobs.find(j => j.id === jobId), [jobs, jobId]);
    const prepDoc = useMemo(() => job?.documents.find(d => d.type === 'INTERVIEW_PREP') ?? null, [job]);

    // Rotate the calm loading copy while generating.
    useEffect(() => {
        if (!generating) return;
        const t = setInterval(() => setLoadingLine(i => (i + 1) % LOADING_LINES.length), 2600);
        return () => clearInterval(t);
    }, [generating]);

    const generate = async () => {
        if (!job || generating) return;
        setGenerating(true);
        try {
            await api.post('/generate/interview-prep', {
                jobDescription: job.description || `${job.title} at ${job.company}`,
                selectedAchievementIds: [],
                jobApplicationId: job.id,
                analysisContext: { tone: 'Professional, polished, direct.', competencies: [] },
            });
            await queryClient.invalidateQueries({ queryKey: ['jobs'] });
        } catch (err: any) {
            const status = err?.response?.status;
            toast.error(status === 402 ? 'Generation limit reached.' : 'Could not build your prep. Please retry.');
        } finally {
            setGenerating(false);
        }
    };

    const backLink = (
        <Link
            to="/tracker"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: warm.colors.textMuted, textDecoration: 'none' }}
        >
            <ArrowLeft size={14} /> Back to Applications
        </Link>
    );

    return (
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 20px 80px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {backLink}

            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <Loader2 size={28} className="animate-spin" style={{ color: warm.colors.accentPetrol }} />
                </div>
            ) : !job ? (
                <div style={{ padding: '64px 0', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: warm.colors.textSecondary }}>Application not found</p>
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: warm.colors.textMuted }}>It may have been removed. Head back to your tracker.</p>
                </div>
            ) : prepDoc ? (
                <InterviewPrepView doc={prepDoc.content} company={job.company} role={job.title} />
            ) : generating ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '80px 0' }}>
                    <Loader2 size={28} className="animate-spin" style={{ color: warm.colors.accentGold }} />
                    <p style={{ margin: 0, fontSize: 14, color: warm.colors.textSecondary, fontWeight: 500 }}>{LOADING_LINES[loadingLine]}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '48px 0', textAlign: 'center', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: warm.colors.textPrimary }}>
                            {job.title}{job.company ? ` · ${job.company}` : ''}
                        </h1>
                        <p style={{ margin: '8px 0 0', fontSize: 14, color: warm.colors.textMuted, lineHeight: 1.6, maxWidth: 480 }}>
                            A calm, complete guide for this interview — your stories, the questions they will ask, and how to walk in steady. Built from your real profile.
                        </p>
                    </div>
                    <button
                        onClick={generate}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px',
                            background: warm.colors.accentPetrol, color: '#FFFFFF',
                            fontSize: 13, fontWeight: 700, borderRadius: 12, border: 'none', cursor: 'pointer',
                        }}
                    >
                        <Sparkles size={15} /> Build my interview prep
                    </button>
                </div>
            )}

            {/* Regenerate affordance — only when a doc already exists */}
            {prepDoc && !generating && (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
                    <button
                        onClick={generate}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                            background: 'transparent', color: warm.colors.textMuted,
                            fontSize: 11, fontWeight: 700, borderRadius: 10,
                            border: `1px solid ${warm.colors.borderWhisper}`, cursor: 'pointer',
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}
                    >
                        <Sparkles size={11} /> Regenerate
                    </button>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Add the lazy import to `App.tsx`**

Find this exact block in `src/App.tsx` (near line 44):

```tsx
const StepperWorkspace = React.lazy(() =>
  import('./pages/StepperWorkspace').then(m => ({ default: m.StepperWorkspace }))
);
```

Immediately AFTER it, add:

```tsx
const InterviewPrepWorkspace = React.lazy(() =>
  import('./pages/InterviewPrepWorkspace').then(m => ({ default: m.InterviewPrepWorkspace }))
);
```

- [ ] **Step 3: Add the route to `App.tsx`**

Find this exact line in `src/App.tsx` (near line 400):

```tsx
                <Route path="/apply" element={<StepperWorkspace />} />
```

Immediately AFTER it, add:

```tsx
                <Route path="/interview/:jobId" element={<InterviewPrepWorkspace />} />
```

- [ ] **Step 4: Verify it typechecks**

Run:

```bash
npx tsc -b
```

Expected: still only the `BADGE_COLORS` error from Task 4 (fixed in the next task). No errors from the page or `App.tsx`. If any other error, STOP and report.

- [ ] **Step 5: Commit**

```bash
git add src/pages/InterviewPrepWorkspace.tsx src/App.tsx
git commit -m "feat(interview): add /interview/:jobId page and route"
```

---

## Task 10: Add the pill on the INTERVIEW tracker card + fix the badge map

**Files:**
- Modify: `src/components/tracker/JobCard.tsx` (imports near line 1-30; `BADGE_COLORS` near line 40; INTERVIEW block near line 1056)

- [ ] **Step 1: Import `Link`**

Find this exact line near the top of `src/components/tracker/JobCard.tsx`:

```tsx
import { motion, AnimatePresence } from 'framer-motion';
```

Immediately AFTER it, add:

```tsx
import { Link } from 'react-router-dom';
```

- [ ] **Step 2: Add the badge entry for the new doc type**

Find this exact block:

```tsx
const BADGE_COLORS: Record<TrackerDocument['type'], { label: string; color: string }> = {
    RESUME: { label: 'Resume', color: '#7DA67D' },
    COVER_LETTER: { label: 'Cover Letter', color: '#C5A059' },
    STAR_RESPONSE: { label: 'Selection Criteria', color: '#2D5A6E' },
};
```

Replace it with:

```tsx
const BADGE_COLORS: Record<TrackerDocument['type'], { label: string; color: string }> = {
    RESUME: { label: 'Resume', color: '#7DA67D' },
    COVER_LETTER: { label: 'Cover Letter', color: '#C5A059' },
    STAR_RESPONSE: { label: 'Selection Criteria', color: '#2D5A6E' },
    INTERVIEW_PREP: { label: 'Interview Prep', color: '#818cf8' },
};
```

- [ ] **Step 3: Add the prep pill above the thank-you block**

Find this exact block (near line 1055):

```tsx
                                {/* Post-interview thank-you email */}
                                {job.status === 'INTERVIEW' && (
```

Immediately BEFORE it, insert:

```tsx
                                {/* Interview prep — links to the dedicated page */}
                                {job.status === 'INTERVIEW' && (
                                    <Link
                                        to={`/interview/${job.id}`}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                                            padding: '12px 16px', borderRadius: 12,
                                            border: '1px solid rgba(129,140,248,0.35)',
                                            background: 'rgba(129,140,248,0.08)',
                                            textDecoration: 'none',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Sparkles size={13} style={{ color: '#818cf8' }} />
                                            <span style={{ fontSize: 12, fontWeight: 700, color: '#818cf8' }}>
                                                {job.documents.some(d => d.type === 'INTERVIEW_PREP')
                                                    ? 'Open your interview prep'
                                                    : 'Prepare for your interview'}
                                            </span>
                                        </div>
                                        <ChevronRight size={14} style={{ color: 'rgba(129,140,248,0.7)' }} />
                                    </Link>
                                )}

```

> Note: `Sparkles` and `ChevronRight` are already imported at the top of this file (used elsewhere in the card). Do not add duplicate imports. If either is somehow not imported, STOP and report rather than guessing.

- [ ] **Step 4: Verify the whole frontend typechecks clean**

Run:

```bash
npx tsc -b
```

Expected: **exits 0 with NO errors.** The `BADGE_COLORS` error from Task 4 is now resolved. If any error remains, STOP and report.

- [ ] **Step 5: Commit**

```bash
git add src/components/tracker/JobCard.tsx
git commit -m "feat(tracker): add interview prep pill on INTERVIEW card"
```

---

## Task 11: Delete the orphaned module and dead navigations

**Files:**
- Delete: `src/components/InterviewQuestionsPanel.tsx`
- Modify: `server/src/routes/ai-tools.ts` (remove `/interview-questions` route, lines ~77-127)
- Modify: `src/components/MatchEngine.tsx:238,246` (remove dead `/application-workspace` navigations)

- [ ] **Step 1: Confirm `InterviewQuestionsPanel` is unused, then delete it**

Run:

```bash
git grep -n "InterviewQuestionsPanel" -- src
```

Expected: matches ONLY inside `src/components/InterviewQuestionsPanel.tsx` itself. If it is imported anywhere else, STOP and report.

Then delete the file:

```bash
git rm src/components/InterviewQuestionsPanel.tsx
```

- [ ] **Step 2: Remove the `/interview-questions` route**

Open `server/src/routes/ai-tools.ts`. Find the route handler that begins:

```ts
router.post('/interview-questions', async (req: any, res: any) => {
```

Delete the entire handler from that line down to and including its closing `});` (it ends just before the next `router.post('/email-cover-letter', ...)` handler near line 129). Also delete its doc-comment line near the top of the file:

```ts
 * POST /interview-questions     Generate 8 likely interview Qs with talking points
```

> If the handler's exact boundaries are not obvious, STOP and report. Do not delete adjacent handlers.

- [ ] **Step 3: Repoint the two dead `/application-workspace` navigations to `/apply`**

The canonical flow is `StepperWorkspace` at `/apply`, which reads `location.state` of shape `{ jobDescription?, sc?, company?, role?, feedItemId?, sourceUrl?, sourcePlatform? }` (see `src/pages/StepperWorkspace.tsx:346-354`). The old state passed `analysis` and `initialTab`, which `StepperWorkspace` does not read. We repoint to `/apply` and pass only `jobDescription` (the one field it consumes). Make these two exact edits in `src/components/MatchEngine.tsx`.

Find this exact block:

```tsx
        navigate('/application-workspace', {
            state: { jobDescription, analysis: result, initialTab: type }
        });
```

Replace it with:

```tsx
        navigate('/apply', {
            state: { jobDescription }
        });
```

Find this exact block:

```tsx
            navigate('/application-workspace', {
                state: { jobDescription, analysis: result, initialTab: pendingNavType }
            });
```

Replace it with:

```tsx
            navigate('/apply', {
                state: { jobDescription }
            });
```

Then confirm nothing else references the old route:

```bash
git grep -n "application-workspace" -- src
```

Expected: NO matches. If any remain, STOP and report.

- [ ] **Step 4: Verify both builds**

Run:

```bash
npx tsc -b && cd server && npm run build && cd ..
```

Expected: both exit 0, no errors.

- [ ] **Step 5: Run server tests**

Run:

```bash
cd server && npm run test && cd ..
```

Expected: all tests pass. If any test referenced `/interview-questions`, STOP and report (do not edit tests without flagging).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(interview): remove orphaned InterviewQuestionsPanel and dead routes"
```

---

## Task 12: Final full-build verification

- [ ] **Step 1: Full frontend build**

Run:

```bash
npm run build
```

Expected: `tsc -b && vite build` completes, exit 0.

- [ ] **Step 2: Lint**

Run:

```bash
npm run lint
```

Expected: no new errors in the files this plan created or modified. (Pre-existing repo lint warnings unrelated to these files are acceptable — do not fix them.)

- [ ] **Step 3: Report completion**

Report back: confirm every task's verification command passed, and list the commits created. **Do not perform any manual click-through QA yourself** — that is the reviewer's job (see Manual QA below). Stop here.

---

## Manual QA (reviewer runs this — NOT the implementing engineer)

Run the app (`npm run dev` + server) and confirm:

1. Tracker → expand a card → set status to **INTERVIEW**. A pill **"Prepare for your interview →"** appears immediately, with no network call and no generation.
2. Click the pill → lands on `/interview/:jobId` → shows the intro + "Build my interview prep" button.
3. Click build → calm rotating loading copy → page renders: header (Role · Org · Why You), the five mindset anchors (4 static + 1 personalised), Know the Stage, Story Bank, Prove It, Questions to Ask, On The Day, Final Checklist ending in "You are ready for this."
4. Go back to the tracker → the pill now reads **"Open your interview prep →"**.
5. Re-open the page → it renders the saved doc immediately with NO regeneration.
6. The card's document badges show **"Interview Prep"** (indigo), not "Selection Criteria".
7. `git grep -n "InterviewQuestionsPanel"` and `git grep -n "application-workspace"` both return nothing in `src`.
8. Generation-failure path: with the server stopped mid-generate, the toast shows and the page does not crash.

---

## Notes for the reviewer (Claude)

- **Out of scope (do not let the engineer add):** rewriting Part 2 into fully-written answers; multi-role comparison; Profile Bank persistence; dashboard surfacing. These are listed in the spec's "Out of scope".
- The only newly-generated content is `Why You` + `Your Anchor`. Everything else in the calm layer is static and must match the verbatim copy in Tasks 5–7.
- If the engineer reports ANY "I had to decide / assume / it didn't match" — treat that task as not-done and review before continuing.
