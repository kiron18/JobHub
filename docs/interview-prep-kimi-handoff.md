# Interview Prep — Build Handoff (for Kimi)

**Goal:** Make the built-but-orphaned interview-prep module live: a `/interview/:jobId`
page reached from a pill on the INTERVIEW tracker card.

## How to work
Implement the existing plan **`docs/superpowers/plans/2026-05-31-interview-prep-page.md`**
task-by-task, exactly as written (one commit per task, run each task's verification
command), **with the four overrides below**. The plan says "STOP on any anchor mismatch";
these overrides exist because the code moved since the plan was written, so where an
override covers a task, the override wins and you do not stop.

Rules: no new/duplicate files beyond what's specified. Australian English. **No em dashes
anywhere** (use commas, colons, full stops). The plan's line numbers have drifted — match
on quoted **text**, not line numbers. If a text anchor genuinely doesn't exist and no
override covers it, stop and report.

---

## OVERRIDE A — Task 3 is a CREATE, not a modify
`server/rules/interview_prep_rules.md` does **not** exist (deleted in a past cleanup; this
is why interview-prep generation currently throws at runtime). Ignore Task 3's find/replace
steps. **Create** the file with exactly this content, then
`git commit -m "feat(rules): restore interview prep rules with Your Edge block"`:

~~~markdown
# Interview Preparation Rules

## Purpose
Build a targeted interview preparation guide from the candidate's actual profile and achievements. This is coaching material, not a script, not generic advice. Every section must reference what this specific candidate has actually done.

## Framework: CAR (not STAR)
Interview answers are spoken. STAR wastes 30% of delivery time on setup. Use CAR:
- **C (Context):** One sentence. Sets the scene, establishes stakes.
- **A (Action):** 3-4 specific things the candidate did. First-person. This is 70% of the answer.
- **R (Result):** Quantified where possible. Impact on team, organisation, or customer.

## Output Structure
Follow this exact structure with exact headings. The client parses these headings to build the UI.

---

### Your Edge
**Why You:** [2-3 sentences. Speak to the candidate directly. Name the specific overlap between this candidate's real background and what this role needs. Concrete, not flattering. Drawn from their actual profile, never invented.]
**Your Anchor:** [One short, calming, confidence-building sentence the candidate can carry into the room, grounded in their specific strength. Example shape: "Your years running X are not background experience, they are exactly the capability this team is missing." Personalise to this candidate. One or two sentences maximum.]

---

### 1. Know the Stage

#### Company Intelligence
3-5 bullet facts drawn from what the job ad reveals:
- What the organisation does and who they serve
- Scale or context signals (team size, locations, volume)
- Values or cultural signals from the ad
- What makes this role exist right now

Keep it factual. No padding.

#### What They're Looking For
2-3 sentences on what the interviewer is actually assessing. What does this role exist to do? What kind of person succeeds here? What are the hidden criteria behind the listed requirements?

#### Watch-Outs
2-3 potential gaps between the candidate's profile and this role. Be honest. Give a reframe strategy for each. If the profile is strong, keep this short. Do not invent gaps.

---

### 2. Story Bank

Select 4 achievements from the candidate's profile that best cover the competencies this role requires. Choose the 4 most distinct and relevant. For each, build a CAR story card.

Format each story exactly as follows:

#### Story: [Short descriptive title, 4-6 words]
**Hook:** [One sentence. Action-first. Result-anchored. This is the line the candidate memorises and opens with in the room. Make it specific enough to be real, brief enough to say in one breath.]
**C:** [Context hint, one sentence max. Sets scene without over-explaining.]
**A:** [3-4 action beats as short bullet phrases, what they specifically did]
**R:** [Result, specific, quantified if possible. What changed because of their actions.]
**Covers:** [comma-separated competency list, e.g. stakeholder management, process improvement, leadership]

Write 5-6 story blocks. Prioritise variety across competencies. Draw details from the candidate's actual achievements, do not invent.

---

### 3. Prove It

Generate 3 questions per type. Each question must be genuinely likely for this specific role, not generic. Map each type to the most relevant Story Bank entry.

#### Behavioural
**What these are:** Past behaviour predicts future performance. Expect "Tell me about a time when..."
**Use:** [Story title most relevant to this type]
1. [Question specific to this role]
2. [Question]
3. [Question]

#### Situational
**What these are:** Hypothetical scenarios testing judgment under pressure. Expect "What would you do if..."
**Use:** [Story title]
1. [Question]
2. [Question]
3. [Question]

#### Motivation
**What these are:** Why you, why this role, why this organisation. Expect "What draws you to..." or "Why are you leaving your current role?"
**Use:** [Story title]
1. [Question]
2. [Question]
3. [Question]

#### Role-Specific
**What these are:** Technical and functional fit, drawn directly from JD requirements.
**Use:** [Story title]
1. [Question]
2. [Question]
3. [Question]

---

### 4. Questions to Ask
4-5 intelligent questions the candidate can ask the interviewer. Specific to this role and organisation. They must signal strategic thinking, not just preparation. No generic questions.

---

## Tone and Format Rules
- Second person throughout ("You..." / "Your...")
- Every story Hook must be specific enough to be real, no vague generalisations
- Action beats use short phrases, not full sentences
- Results must name the impact, avoid "successfully improved" with no number or outcome
- Australian English throughout
- Do NOT include generic tips or meta-commentary inside the Know the Stage, Story Bank, Prove It, or Questions to Ask sections
- The ONLY sections you output are: Your Edge, 1. Know the Stage, 2. Story Bank, 3. Prove It, 4. Questions to Ask. Do NOT add any other sections.
- Do NOT use em dashes, use commas, colons, or full stops instead
~~~

---

## OVERRIDE B — JobCard.tsx (replaces Task 10 Steps 1 & 3, and Task 11 Step 1)
`InterviewQuestionsPanel` was wired into `src/components/tracker/JobCard.tsx` after the plan
was written, so its anchors don't match and `ChevronRight` isn't imported. Do Task 10 Step 2
(add `INTERVIEW_PREP` to `BADGE_COLORS`) as written, then make these exact edits:

1. In the `lucide-react` import block: remove `MessageSquare,` (becomes unused) and add `ChevronRight,`.
2. Delete the line `import { InterviewQuestionsPanel } from '../InterviewQuestionsPanel';`.
3. After `import { motion, AnimatePresence } from 'framer-motion';` add: `import { Link } from 'react-router-dom';`.
4. Delete the state line `const [interviewPrepOpen, setInterviewPrepOpen] = useState(false);`.
5. Delete the entire existing inline block: the two adjacent comment lines
   (`{/* Post-interview thank-you email */}` and the `{/* Interview prep... */}` comment)
   plus the whole `{job.description && job.description.length >= 50 && ( ... )}` block that
   renders `<InterviewQuestionsPanel .../>`. It ends at the `)}` sitting directly above
   `{job.status === 'INTERVIEW' && (` (the thank-you block). Replace that deleted region with:

```tsx
                                {/* Interview prep, links to the dedicated page */}
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

Leave the following `{job.status === 'INTERVIEW' && ( ... )}` thank-you block intact. Run
`npx tsc -b` (must exit 0, no unused/missing-import errors), then
`git commit -m "feat(tracker): replace inline questions panel with interview prep pill"`.

Task 11's other steps proceed as written (delete `src/components/InterviewQuestionsPanel.tsx`,
remove the `/interview-questions` route in `server/src/routes/ai-tools.ts`, repoint the two
`/application-workspace` navigations in `src/components/MatchEngine.tsx` to `/apply`) — after
the edits above, `InterviewQuestionsPanel` is imported nowhere.

---

## OVERRIDE C — Migration naming (Task 1)
Do **not** use the plan's folder name `20260531000001_...` (it sorts before migrations already
applied). Name the migration folder **`20260716000002_add_interview_prep_doc_type`** so it
sorts last. Its `migration.sql` is exactly:

```sql
-- Add INTERVIEW_PREP to DocumentType enum
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'INTERVIEW_PREP';
```

Use this name in the commit path too.

---

## OVERRIDE D — Safe DB migration procedure (Task 1 Step 3) — READ FULLY
The database is a hosted Supabase Postgres with live data. Follow this exactly.

**Allowed command (safe):**
```bash
cd server && npm run migrate && npx prisma generate
```
`npm run migrate` runs `prisma migrate deploy`, which only applies committed migration files
that haven't run yet. It never resets, never drops, never rewrites data.

**Never run** `prisma migrate dev`, `prisma migrate reset`, `prisma db push`, or anything
containing `reset`/`--force`. Those can wipe the database. If you think you need one, STOP and
report instead.

**Why this migration is low risk:** it is a single additive, idempotent statement. Adding an
enum value cannot delete or corrupt existing rows, and `IF NOT EXISTS` makes re-runs harmless.

**Important — exit 0 does NOT mean success.** `scripts/migrate-safe.js` deliberately swallows
errors (DB unreachable, pooler/pgbouncer, timeout) and exits 0 so the app can still boot. You
MUST verify the value actually landed:

```bash
cd server && npx prisma migrate status
```
Expect it to report the DB is up to date / the new migration applied. Then confirm the enum
value definitively:
```bash
cd server && node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$queryRawUnsafe(\"SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='DocumentType'\").then(r=>{console.log(r.map(x=>x.enumlabel));const ok=r.some(x=>x.enumlabel==='INTERVIEW_PREP');console.log(ok?'OK: INTERVIEW_PREP present':'MISSING');process.exit(ok?0:1)}).catch(e=>{console.error(e);process.exit(1)})"
```
If `INTERVIEW_PREP` is **not** present, STOP and report. Do NOT try `migrate dev` or any reset
to "fix" it. Likely cause is a pooler connection (errors mentioning `prepared statement`,
`42P05`, or pgbouncer) — that means `DIRECT_URL` (session mode, port 5432) needs to be set;
report it rather than forcing anything.

`npx prisma generate` works even if the DB is unreachable and is what fixes the server TS
build — but the feature will fail at runtime until the enum value is confirmed present by the
check above.

---

## Definition of done
All plan tasks + overrides applied; `npm run build` (frontend) and `cd server && npm run build`
both exit 0; `npx prisma migrate status` clean and the enum check prints `OK`;
`git grep -n "InterviewQuestionsPanel"` and `git grep -n "application-workspace"` return
nothing in `src`. Report every verification result and the list of commits. Do not do manual
click-through QA yourself.
