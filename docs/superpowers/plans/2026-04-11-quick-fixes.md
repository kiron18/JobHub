# Quick Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 independent issues: profile section CRUD, analyse-profile rate limit, SC tab cleanup, document preview typography, tracker optimistic updates, and sidebar LinkedIn Coming Soon.

**Architecture:** Server changes first (endpoints + schema), then frontend task by task. Each task is independent after Task 1 and 2 are done.

**Tech Stack:** React, TypeScript, React Query, Prisma, Express, Framer Motion, Vite/Tailwind

---

## File Map

| File | Action |
|---|---|
| `server/prisma/schema.prisma` | Add `profileAdvisorCallsToday`, `profileAdvisorCallsDate` to CandidateProfile |
| `server/src/routes/profile/education.ts` | Add `POST /education` and `DELETE /education/:id` |
| `server/src/routes/profile/certifications.ts` | New — full CRUD |
| `server/src/routes/profile/volunteering.ts` | New — full CRUD |
| `server/src/routes/profile/index.ts` | Register certifications and volunteering routers |
| `server/src/routes/ai-tools.ts` | Add daily rate limit to `/profile-advisor` |
| `server/rules/selection_criteria_rules.md` | Update Section 7.1 heading format to `##` |
| `src/components/ProfileBank.tsx` | Add CRUD UI for Education, Certifications, Volunteering; Skills tag editor |
| `src/components/ProfileAdvisorPanel.tsx` | 429 handling + smart gate UI |
| `src/components/ApplicationWorkspace.tsx` | Remove LinkedIn Optimiser, GapAnalysis, SalaryInsight, FeedbackBar; fix SC auto-gen; fix typography |
| `src/components/ApplicationTracker.tsx` | Optimistic status updates |
| `src/layouts/DashboardLayout.tsx` | LinkedIn Coming Soon nav item |

---

### Task 1: Server — profile section CRUD endpoints

**Files:**
- Modify: `server/src/routes/profile/education.ts`
- Create: `server/src/routes/profile/certifications.ts`
- Create: `server/src/routes/profile/volunteering.ts`
- Modify: `server/src/routes/profile/index.ts`

- [ ] **Step 1: Add POST and DELETE to education.ts**

Current file has only `PATCH /education/:id`. Add after it, before `export default router`:

```ts
// POST /api/education
router.post('/education', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { institution, degree, field, year } = req.body;
  if (!institution || !degree) return res.status(400).json({ error: 'institution and degree required' });
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const edu = await prisma.education.create({
      data: { institution, degree, field: field || null, year: year || null, candidateProfileId: profile.id },
    });
    return res.status(201).json(edu);
  } catch {
    return res.status(500).json({ error: 'Failed to create education' });
  }
});

// DELETE /api/education/:id
router.delete('/education/:id', authenticate, async (req, res) => {
  const { id } = req.params as any;
  const userId = (req as any).user.id;
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    await prisma.education.delete({ where: { id, candidateProfileId: profile.id } });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to delete education' });
  }
});
```

- [ ] **Step 2: Create `server/src/routes/profile/certifications.ts`**

```ts
import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.post('/certifications', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { name, issuingBody, year } = req.body;
  if (!name || !issuingBody) return res.status(400).json({ error: 'name and issuingBody required' });
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const cert = await prisma.certification.create({
      data: { name, issuingBody, year: year || null, candidateProfileId: profile.id },
    });
    return res.status(201).json(cert);
  } catch {
    return res.status(500).json({ error: 'Failed to create certification' });
  }
});

router.patch('/certifications/:id', authenticate, async (req, res) => {
  const { id } = req.params as any;
  const userId = (req as any).user.id;
  const { name, issuingBody, year } = req.body;
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const cert = await prisma.certification.update({
      where: { id, candidateProfileId: profile.id },
      data: { ...(name && { name }), ...(issuingBody && { issuingBody }), ...(year !== undefined && { year: year || null }) },
    });
    return res.json(cert);
  } catch {
    return res.status(500).json({ error: 'Failed to update certification' });
  }
});

router.delete('/certifications/:id', authenticate, async (req, res) => {
  const { id } = req.params as any;
  const userId = (req as any).user.id;
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    await prisma.certification.delete({ where: { id, candidateProfileId: profile.id } });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to delete certification' });
  }
});

export default router;
```

- [ ] **Step 3: Create `server/src/routes/profile/volunteering.ts`**

```ts
import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.post('/volunteering', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { organization, role, description } = req.body;
  if (!organization || !role) return res.status(400).json({ error: 'organization and role required' });
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const vol = await prisma.volunteering.create({
      data: { organization, role, description: description || null, candidateProfileId: profile.id },
    });
    return res.status(201).json(vol);
  } catch {
    return res.status(500).json({ error: 'Failed to create volunteering' });
  }
});

router.patch('/volunteering/:id', authenticate, async (req, res) => {
  const { id } = req.params as any;
  const userId = (req as any).user.id;
  const { organization, role, description } = req.body;
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const vol = await prisma.volunteering.update({
      where: { id, candidateProfileId: profile.id },
      data: { ...(organization && { organization }), ...(role && { role }), ...(description !== undefined && { description: description || null }) },
    });
    return res.json(vol);
  } catch {
    return res.status(500).json({ error: 'Failed to update volunteering' });
  }
});

router.delete('/volunteering/:id', authenticate, async (req, res) => {
  const { id } = req.params as any;
  const userId = (req as any).user.id;
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    await prisma.volunteering.delete({ where: { id, candidateProfileId: profile.id } });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to delete volunteering' });
  }
});

export default router;
```

- [ ] **Step 4: Register new routers in `server/src/routes/profile/index.ts`**

Add imports and `router.use(...)` calls for certifications and volunteering:

```ts
import { Router } from 'express';
import profileCoreRouter from './profile-core';
import experienceRouter from './experience';
import educationRouter from './education';
import achievementsRouter from './achievements';
import jobsRouter from './jobs';
import identityRouter from './identity';
import certificationsRouter from './certifications';
import volunteeringRouter from './volunteering';

const router = Router();

router.use(profileCoreRouter);
router.use(experienceRouter);
router.use(educationRouter);
router.use(achievementsRouter);
router.use(jobsRouter);
router.use(identityRouter);
router.use(certificationsRouter);
router.use(volunteeringRouter);

export default router;
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd E:/AntiGravity/JobHub/server && npx tsc --noEmit 2>&1 | tail -10`
Expected: no errors

- [ ] **Step 6: Run server tests**

Run: `cd E:/AntiGravity/JobHub/server && npx vitest run 2>&1 | tail -6`
Expected: all passing

- [ ] **Step 7: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/src/routes/profile/education.ts server/src/routes/profile/certifications.ts server/src/routes/profile/volunteering.ts server/src/routes/profile/index.ts
git commit -m "feat(profile): add POST/DELETE education, full CRUD for certifications and volunteering"
```

---

### Task 2: Server — profile-advisor rate limit + schema migration

**Files:**
- Modify: `server/prisma/schema.prisma`
- Modify: `server/src/routes/ai-tools.ts`

- [ ] **Step 1: Add fields to schema.prisma**

In `server/prisma/schema.prisma`, in the `CandidateProfile` model, add after `identityCardsUpdatedAt`:

```prisma
  profileAdvisorCallsToday  Int       @default(0)
  profileAdvisorCallsDate   DateTime?
```

- [ ] **Step 2: Push schema to database**

Run: `cd E:/AntiGravity/JobHub/server && npx prisma db push 2>&1 | tail -5`
Expected: `Your database is now in sync with your Prisma schema`

- [ ] **Step 3: Add rate limit logic to `/profile-advisor` in `server/src/routes/ai-tools.ts`**

At the top of the `router.post('/profile-advisor', ...)` handler, after `const profile = await prisma.candidateProfile.findUnique(...)` and `if (!profile) return ...`, insert this block:

```ts
        // ── Daily rate limit ─────────────────────────────────────────────
        const maxCalls = parseInt(process.env.MAX_DAILY_PROFILE_ANALYSES ?? '3', 10);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const lastDate = profile.profileAdvisorCallsDate;
        const isToday = lastDate && new Date(lastDate) >= today;
        const callsToday = isToday ? (profile as any).profileAdvisorCallsToday : 0;

        if (callsToday >= maxCalls) {
            return res.status(429).json({ error: 'DAILY_LIMIT_REACHED', callsToday, limit: maxCalls });
        }
        // ── End rate limit ───────────────────────────────────────────────
```

Then, after `return res.json({ overallGrade: ..., summary: ..., improvements: ... })`, replace it with:

```ts
        // Increment counter
        await prisma.candidateProfile.update({
            where: { userId },
            data: {
                profileAdvisorCallsToday: callsToday + 1,
                profileAdvisorCallsDate: new Date(),
            },
        });

        return res.json({
            overallGrade: result.overallGrade || 'C',
            summary: result.summary || '',
            improvements: Array.isArray(result.improvements) ? result.improvements.slice(0, 5) : [],
        });
```

Also update the `findUnique` call to include the new fields:

```ts
        const profile = await prisma.candidateProfile.findUnique({
            where: { userId },
            include: {
                achievements: { select: { id: true, title: true, metric: true, description: true } },
                experience: { select: { role: true, company: true, startDate: true, endDate: true, isCurrent: true, description: true } },
                education: { select: { institution: true, degree: true } },
                certifications: { select: { name: true } },
            }
        });
```

The `profileAdvisorCallsToday` and `profileAdvisorCallsDate` are scalar fields and are automatically selected — no change to `include` needed. But add them to the `select` by switching from `include` to plain select, OR just cast with `(profile as any).profileAdvisorCallsToday` as already done in the rate limit block.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd E:/AntiGravity/JobHub/server && npx tsc --noEmit 2>&1 | tail -10`
Expected: no errors

- [ ] **Step 5: Run server tests**

Run: `cd E:/AntiGravity/JobHub/server && npx vitest run 2>&1 | tail -6`
Expected: all passing

- [ ] **Step 6: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/prisma/schema.prisma server/src/routes/ai-tools.ts
git commit -m "feat(profile-advisor): daily rate limit (3/day), schema fields profileAdvisorCallsToday/Date"
```

---

### Task 3: ProfileBank — CRUD UI for Education, Certifications, Volunteering + Skills tag editor

**Files:**
- Modify: `src/components/ProfileBank.tsx`

This task converts the three read-only Island components to editable ones and adds a tag editor to Skills.

- [ ] **Step 1: Read the current file**

Read `src/components/ProfileBank.tsx` to see the full current state.

- [ ] **Step 2: Replace `EducationIsland` with editable version**

The current `EducationIsland` (around line 629) has edit-by-id but no add/delete. Replace the entire component with:

```tsx
const EducationIsland: React.FC<{ education: Education[]; isDark: boolean }> = ({ education, isDark }) => {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, { institution: string; degree: string; field: string; year: string }>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ institution: '', degree: '', field: '', year: '' });

  const inp = inputStyle(isDark);

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, string> }) => api.patch(`/education/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setEditingId(null); toast.info('Education updated.'); },
    onError: () => toast.error('Failed to save.'),
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof addForm) => api.post('/education', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setIsAdding(false); setAddForm({ institution: '', degree: '', field: '', year: '' }); toast.success('Education added.'); },
    onError: () => toast.error('Failed to add education.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/education/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.info('Education removed.'); },
    onError: () => toast.error('Failed to remove.'),
  });

  return (
    <Island isDark={isDark}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionHeader icon={<GraduationCap size={13} />} title="Education" isDark={isDark} />
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
            + Add
          </button>
        )}
      </div>

      {/* Add form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div key="add" {...slideIn} style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
              {(['institution', 'degree', 'field', 'year'] as const).map(f => (
                <div key={f}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </span>
                  <input style={inp} value={addForm[f]} onChange={e => setAddForm(p => ({ ...p, [f]: e.target.value }))} />
                </div>
              ))}
            </div>
            <SaveCancelButtons onSave={() => addMutation.mutate(addForm)} onCancel={() => setIsAdding(false)} saving={addMutation.isPending} isDark={isDark} />
          </motion.div>
        )}
      </AnimatePresence>

      {education.length === 0 && !isAdding && (
        <p style={{ fontSize: 13, color: isDark ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>No education records found.</p>
      )}

      {education.map(edu => {
        const hint = hintForEducation(edu);
        const isEditing = editingId === edu.id;
        const form = forms[edu.id] ?? { institution: edu.institution, degree: edu.degree, field: edu.field ?? '', year: edu.year ?? '' };
        return (
          <div key={edu.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <AnimatePresence mode="wait">
                  {isEditing ? (
                    <motion.div key="edit" {...slideIn}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
                        {(['institution', 'degree', 'field', 'year'] as const).map(f => (
                          <div key={f}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>
                              {f.charAt(0).toUpperCase() + f.slice(1)}
                            </span>
                            <input style={inp} value={form[f]} onChange={e => setForms(prev => ({ ...prev, [edu.id]: { ...form, [f]: e.target.value } }))} />
                          </div>
                        ))}
                      </div>
                      <SaveCancelButtons onSave={() => editMutation.mutate({ id: edu.id, data: form })} onCancel={() => setEditingId(null)} saving={editMutation.isPending} isDark={isDark} />
                    </motion.div>
                  ) : (
                    <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e5e7eb' : '#1f2937' }}>{edu.degree}{edu.field && ` in ${edu.field}`}</p>
                      <p style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280' }}>{edu.institution}{edu.year && ` · ${edu.year}`}</p>
                      {hint && <CoachHint hint={hint} />}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {!isEditing && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <EditButton onClick={() => { setForms(prev => ({ ...prev, [edu.id]: { institution: edu.institution, degree: edu.degree, field: edu.field ?? '', year: edu.year ?? '' } })); setEditingId(edu.id); }} isDark={isDark} />
                  <button onClick={() => deleteMutation.mutate(edu.id)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#6b7280' : '#9ca3af' }}>
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </Island>
  );
};
```

Make sure `X` is imported from `lucide-react` (check existing imports first and add if missing).

- [ ] **Step 3: Replace `SkillsIsland` with tag-editable version**

Replace the current read-only `SkillsIsland` with an editable one. Skills are stored as JSON (`{ technical: [...], industryKnowledge: [...], soft: [...], softSkills: [...] }`). For editing, flatten all into one list; save as `{ technical: [...all] }`.

```tsx
const SkillsIsland: React.FC<{ skills: string | null; isDark: boolean }> = ({ skills, isDark }) => {
  const qc = useQueryClient();
  const parsed = parseSkills(skills);
  const allSkills: string[] = [
    ...(parsed.technical ?? []),
    ...(parsed.industryKnowledge ?? []),
    ...(parsed.soft ?? []),
    ...(parsed.softSkills ?? []),
  ];
  const [editing, setEditing] = useState(false);
  const [localSkills, setLocalSkills] = useState<string[]>(allSkills);
  const [inputVal, setInputVal] = useState('');

  const mutation = useMutation({
    mutationFn: (skillList: string[]) => api.patch('/profile', { skills: JSON.stringify({ technical: skillList }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setEditing(false); toast.info('Skills updated.'); },
    onError: () => toast.error('Failed to save skills.'),
  });

  function openEdit() { setLocalSkills(allSkills); setInputVal(''); setEditing(true); }
  function addSkill() {
    const s = inputVal.trim();
    if (s && !localSkills.includes(s)) setLocalSkills(p => [...p, s]);
    setInputVal('');
  }
  function removeSkill(s: string) { setLocalSkills(p => p.filter(x => x !== s)); }

  const inp = inputStyle(isDark);

  return (
    <Island isDark={isDark}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionHeader icon={<Wrench size={13} />} title="Skills" isDark={isDark} />
        {!editing && <EditButton onClick={openEdit} isDark={isDark} />}
      </div>

      {editing ? (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {localSkills.map(s => (
              <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
                {s}
                <button onClick={() => removeSkill(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#818cf8' }}><X size={10} /></button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              style={{ ...inp, flex: 1 }}
              value={inputVal}
              placeholder="Type a skill and press Enter"
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
            />
            <button onClick={addSkill} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#818cf8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Add</button>
          </div>
          <SaveCancelButtons onSave={() => mutation.mutate(localSkills)} onCancel={() => setEditing(false)} saving={mutation.isPending} isDark={isDark} />
        </div>
      ) : (
        <>
          {allSkills.length === 0 ? (
            <p style={{ fontSize: 13, color: isDark ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>No skills found.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allSkills.map((skill, i) => (
                <span key={i} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', color: isDark ? '#d1d5db' : '#374151', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
                  {skill}
                </span>
              ))}
            </div>
          )}
          {allSkills.length < 5 && (
            <CoachHint hint={{ type: 'warn', message: `Only ${allSkills.length} skills listed. Add at least 5 to improve profile strength.` }} />
          )}
        </>
      )}
    </Island>
  );
};
```

- [ ] **Step 4: Replace `CertificationsIsland` with editable version**

Replace the current stateless functional component (lines ~765–780):

```tsx
const CertificationsIsland: React.FC<{ certifications: Certification[]; isDark: boolean }> = ({ certifications, isDark }) => {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, { name: string; issuingBody: string; year: string }>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', issuingBody: '', year: '' });

  const inp = inputStyle(isDark);

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, string> }) => api.patch(`/certifications/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setEditingId(null); toast.info('Certification updated.'); },
    onError: () => toast.error('Failed to save.'),
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof addForm) => api.post('/certifications', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setIsAdding(false); setAddForm({ name: '', issuingBody: '', year: '' }); toast.success('Certification added.'); },
    onError: () => toast.error('Failed to add certification.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/certifications/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.info('Certification removed.'); },
    onError: () => toast.error('Failed to remove.'),
  });

  return (
    <Island isDark={isDark}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionHeader icon={<Award size={13} />} title="Certifications" isDark={isDark} />
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
            + Add
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div key="add" {...slideIn} style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '10px 14px' }}>
              {(['name', 'issuingBody', 'year'] as const).map(f => (
                <div key={f}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>
                    {f === 'issuingBody' ? 'Issuing Body' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </span>
                  <input style={inp} value={addForm[f]} onChange={e => setAddForm(p => ({ ...p, [f]: e.target.value }))} />
                </div>
              ))}
            </div>
            <SaveCancelButtons onSave={() => addMutation.mutate(addForm)} onCancel={() => setIsAdding(false)} saving={addMutation.isPending} isDark={isDark} />
          </motion.div>
        )}
      </AnimatePresence>

      {certifications.length === 0 && !isAdding && (
        <p style={{ fontSize: 13, color: isDark ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>No certifications on record.</p>
      )}

      {certifications.map(cert => {
        const isEditing = editingId === cert.id;
        const form = forms[cert.id] ?? { name: cert.name, issuingBody: cert.issuingBody, year: cert.year ?? '' };
        return (
          <div key={cert.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <AnimatePresence mode="wait">
                  {isEditing ? (
                    <motion.div key="edit" {...slideIn}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '10px 14px' }}>
                        {(['name', 'issuingBody', 'year'] as const).map(f => (
                          <div key={f}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>
                              {f === 'issuingBody' ? 'Issuing Body' : f.charAt(0).toUpperCase() + f.slice(1)}
                            </span>
                            <input style={inp} value={form[f]} onChange={e => setForms(prev => ({ ...prev, [cert.id]: { ...form, [f]: e.target.value } }))} />
                          </div>
                        ))}
                      </div>
                      <SaveCancelButtons onSave={() => editMutation.mutate({ id: cert.id, data: form })} onCancel={() => setEditingId(null)} saving={editMutation.isPending} isDark={isDark} />
                    </motion.div>
                  ) : (
                    <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e5e7eb' : '#1f2937' }}>{cert.name}</p>
                      <p style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280' }}>{cert.issuingBody}{cert.year && ` · ${cert.year}`}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {!isEditing && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <EditButton onClick={() => { setForms(prev => ({ ...prev, [cert.id]: { name: cert.name, issuingBody: cert.issuingBody, year: cert.year ?? '' } })); setEditingId(cert.id); }} isDark={isDark} />
                  <button onClick={() => deleteMutation.mutate(cert.id)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#6b7280' : '#9ca3af' }}>
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </Island>
  );
};
```

- [ ] **Step 5: Replace `VolunteeringIsland` with editable version**

Replace the current stateless component (lines ~789–802):

```tsx
const VolunteeringIsland: React.FC<{ volunteering: Volunteering[]; isDark: boolean }> = ({ volunteering, isDark }) => {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, { organization: string; role: string; description: string }>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ organization: '', role: '', description: '' });

  const inp = inputStyle(isDark);

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, string> }) => api.patch(`/volunteering/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setEditingId(null); toast.info('Volunteering updated.'); },
    onError: () => toast.error('Failed to save.'),
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof addForm) => api.post('/volunteering', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setIsAdding(false); setAddForm({ organization: '', role: '', description: '' }); toast.success('Volunteering added.'); },
    onError: () => toast.error('Failed to add volunteering.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/volunteering/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.info('Volunteering removed.'); },
    onError: () => toast.error('Failed to remove.'),
  });

  return (
    <Island isDark={isDark}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionHeader icon={<Heart size={13} />} title="Volunteering" isDark={isDark} />
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
            + Add
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div key="add" {...slideIn} style={{ marginBottom: 16 }}>
            {(['organization', 'role'] as const).map(f => (
              <div key={f} style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </span>
                <input style={inp} value={addForm[f]} onChange={e => setAddForm(p => ({ ...p, [f]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>Description (optional)</span>
              <textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={addForm.description} onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <SaveCancelButtons onSave={() => addMutation.mutate(addForm)} onCancel={() => setIsAdding(false)} saving={addMutation.isPending} isDark={isDark} />
          </motion.div>
        )}
      </AnimatePresence>

      {volunteering.length === 0 && !isAdding && (
        <p style={{ fontSize: 13, color: isDark ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>No volunteering records.</p>
      )}

      {volunteering.map(vol => {
        const isEditing = editingId === vol.id;
        const form = forms[vol.id] ?? { organization: vol.organization, role: vol.role, description: vol.description ?? '' };
        return (
          <div key={vol.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <AnimatePresence mode="wait">
                  {isEditing ? (
                    <motion.div key="edit" {...slideIn}>
                      {(['organization', 'role'] as const).map(f => (
                        <div key={f} style={{ marginBottom: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                          </span>
                          <input style={inp} value={form[f]} onChange={e => setForms(prev => ({ ...prev, [vol.id]: { ...form, [f]: e.target.value } }))} />
                        </div>
                      ))}
                      <div style={{ marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>Description (optional)</span>
                        <textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={form.description} onChange={e => setForms(prev => ({ ...prev, [vol.id]: { ...form, description: e.target.value } }))} />
                      </div>
                      <SaveCancelButtons onSave={() => editMutation.mutate({ id: vol.id, data: form })} onCancel={() => setEditingId(null)} saving={editMutation.isPending} isDark={isDark} />
                    </motion.div>
                  ) : (
                    <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e5e7eb' : '#1f2937' }}>{vol.role}</p>
                      <p style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: vol.description ? 4 : 0 }}>{vol.organization}</p>
                      {vol.description && <p style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280', lineHeight: 1.6 }}>{vol.description}</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {!isEditing && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <EditButton onClick={() => { setForms(prev => ({ ...prev, [vol.id]: { organization: vol.organization, role: vol.role, description: vol.description ?? '' } })); setEditingId(vol.id); }} isDark={isDark} />
                  <button onClick={() => deleteMutation.mutate(vol.id)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#6b7280' : '#9ca3af' }}>
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </Island>
  );
};
```

- [ ] **Step 6: Ensure `X` is imported from lucide-react**

Check the existing import line (around line 1–20) for lucide-react. If `X` is not already imported, add it to the destructure list.

- [ ] **Step 7: Verify TypeScript and build**

Run: `cd E:/AntiGravity/JobHub && npm run build 2>&1 | tail -10`
Expected: clean

- [ ] **Step 8: Commit**

```bash
cd E:/AntiGravity/JobHub
git add src/components/ProfileBank.tsx
git commit -m "feat(profile-bank): add/edit/delete for education, certifications, volunteering; skills tag editor"
```

---

### Task 4: ProfileAdvisorPanel — rate limit UI + smart gate

**Files:**
- Modify: `src/components/ProfileAdvisorPanel.tsx`

- [ ] **Step 1: Read the current file**

Read `src/components/ProfileAdvisorPanel.tsx` — the full file is 189 lines.

- [ ] **Step 2: Add state and updated `run` function**

Add `analysisCount` and `limitReached` state. Update `run` to handle 429 and track count:

```tsx
const [result, setResult] = useState<AdvisorResult | null>(null);
const [loading, setLoading] = useState(false);
const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
const [analysisCount, setAnalysisCount] = useState(0);
const [limitReached, setLimitReached] = useState(false);
const [bypassGate, setBypassGate] = useState(false);
```

Replace the `run` function:

```tsx
const run = async () => {
  if (loading) return;
  setLoading(true);
  setBypassGate(false);
  try {
    const { data } = await api.post('/analyze/profile-advisor', { targetRole });
    setResult(data);
    setAnalysisCount(c => c + 1);
    setExpandedIdx(0);
  } catch (err: any) {
    if (err?.response?.status === 429) {
      setLimitReached(true);
    }
    // other errors: silent
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 3: Add smart gate and limit UI**

Compute the gate condition after the state declarations:

```tsx
const grade = result ? GRADE_CONFIG[result.overallGrade] || GRADE_CONFIG.C : null;
const isStrongAndAnalysed = result && (result.overallGrade === 'A' || result.overallGrade === 'B') && analysisCount >= 1;
const showGate = isStrongAndAnalysed && !bypassGate;
```

In the JSX, add these two blocks between the header and the grade display:

**Daily limit message** (show when `limitReached`):
```tsx
{limitReached && (
  <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 11, color: '#fbbf24', lineHeight: 1.5 }}>
    You've analysed your profile 3 times today. Come back tomorrow, or make manual edits and check back then.
  </div>
)}
```

**Smart gate message** (show when `showGate`):
```tsx
{showGate && (
  <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 11, color: '#34d399', lineHeight: 1.5 }}>
    Your profile already scores {result?.overallGrade}. Another pass gives diminishing returns — consider editing your achievements first.{' '}
    <button onClick={() => setBypassGate(true)} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', fontSize: 11, fontWeight: 700, textDecoration: 'underline', padding: 0 }}>
      Analyse anyway
    </button>
  </div>
)}
```

Update the Analyse button to be disabled when `limitReached` or `showGate`:

```tsx
<button
  onClick={run}
  disabled={loading || limitReached || showGate}
  style={{
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', borderRadius: 6,
    border: '1px solid rgba(99,102,241,0.3)',
    background: 'rgba(99,102,241,0.08)',
    color: (loading || limitReached || showGate) ? '#6b7280' : '#818cf8',
    fontSize: 10, fontWeight: 700,
    cursor: (loading || limitReached || showGate) ? 'default' : 'pointer',
    opacity: (limitReached || showGate) ? 0.5 : 1,
  }}
>
  {loading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
  {loading ? 'Analysing…' : result ? 'Re-analyse' : 'Analyse Profile'}
</button>
```

- [ ] **Step 4: Verify TypeScript and build**

Run: `cd E:/AntiGravity/JobHub && npm run build 2>&1 | tail -10`
Expected: clean

- [ ] **Step 5: Commit**

```bash
cd E:/AntiGravity/JobHub
git add src/components/ProfileAdvisorPanel.tsx
git commit -m "feat(profile-advisor): daily rate limit UI (429 handling) and smart gate for strong profiles"
```

---

### Task 5: ApplicationWorkspace — remove panels, fix SC auto-gen, fix typography

**Files:**
- Modify: `src/components/ApplicationWorkspace.tsx`

This is the largest task. Read the file before starting (it's 1449 lines).

- [ ] **Step 1: Read the file**

Read `src/components/ApplicationWorkspace.tsx` — focus on:
- Lines ~30–45 (imports)
- Lines ~230–260 (state declarations)
- Lines ~550–560 (SC auto-gen useEffect)
- Lines ~806–833 (SC tab left panel)
- Lines ~920–965 (LinkedIn Optimiser panel)
- Lines ~960–985 (Salary Insight panel)
- Lines ~975–990 (Profile Gap Analysis panel)
- Lines ~1039–1080 (LinkedIn viewer modal)
- Lines ~1320–1340 (document preview article element)
- Lines ~1360–1380 (FeedbackBar)

- [ ] **Step 2: Add `scConfirmed` state and fix auto-gen useEffect**

Add after `const [selectionCriteriaText, setSelectionCriteriaText] = useState('');` (line ~230):
```tsx
const [scConfirmed, setScConfirmed] = useState(false);
```

Find the SC auto-gen `useEffect` (the one with `selectionCriteriaText` in its deps array, around line 550). Change the `scReady` line from:
```tsx
const scReady = state.activeTab !== 'selection-criteria' || selectionCriteriaText.trim().length > 20;
```
To:
```tsx
const scReady = state.activeTab !== 'selection-criteria' || (selectionCriteriaText.trim().length > 20 && scConfirmed);
```

Add `scConfirmed` to the `useEffect` dependency array.

Add a reset effect for when the user leaves the SC tab. Find the existing `useEffect` that responds to `state.activeTab` changes, or add a new one:
```tsx
useEffect(() => {
  if (state.activeTab !== 'selection-criteria') setScConfirmed(false);
}, [state.activeTab]);
```

- [ ] **Step 3: Update SC generate button to set `scConfirmed`**

Find the "Generate SC Responses" button (around line 823):
```tsx
{selectionCriteriaText.trim().length > 20 && !state.documents['selection-criteria'] && !state.isGenerating && (
  <button
    onClick={() => handleGenerate('selection-criteria')}
    ...
  >
```
Change `onClick={() => handleGenerate('selection-criteria')}` to `onClick={() => setScConfirmed(true)}`. The `useEffect` will then trigger generation automatically.

- [ ] **Step 4: Remove LinkedIn Optimiser — state and JSX**

Remove these state declarations (around lines 244–247):
```tsx
const [linkedInDoc, setLinkedInDoc] = useState('');
const [generatingLinkedIn, setGeneratingLinkedIn] = useState(false);
const [linkedInViewerOpen, setLinkedInViewerOpen] = useState(false);
```

Remove the `handleGenerateLinkedIn` function (around lines 584–601).

Remove the LinkedIn Optimiser card JSX (the block starting with `{/* LinkedIn Profile Generator — always available when JD is loaded */}`, around lines 926–960).

Remove the LinkedIn viewer modal JSX (the block containing `linkedInViewerOpen`, around lines 1039–1080).

Remove the `import { SalaryInsightPanel }` line and the `<SalaryInsightPanel ...>` usage (around line 964).

Remove the `import { GapAnalysisPanel }` line and the `<GapAnalysisPanel ...>` usage (around line 975).

Remove the `import { FeedbackBar }` line and the `<FeedbackBar ...>` usage (around line 1367).

- [ ] **Step 5: Fix document preview typography**

Find the article element for the document preview (around line 1324):
```tsx
<article id="resume-preview-content" className="prose prose-slate max-w-none [&_p]:my-0.5 [&_ul]:my-1 [&_li]:my-0 [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:mt-2 [&_h3]:mb-0.5">
```

Replace the className with:
```tsx
<article id="resume-preview-content" className="prose prose-slate max-w-none [&_p]:my-0.5 [&_ul]:my-1 [&_li]:my-0 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:mt-2 [&_h3]:mb-0.5">
```

- [ ] **Step 6: Verify TypeScript and build**

Run: `cd E:/AntiGravity/JobHub && npm run build 2>&1 | tail -10`
Expected: clean

- [ ] **Step 7: Commit**

```bash
cd E:/AntiGravity/JobHub
git add src/components/ApplicationWorkspace.tsx
git commit -m "fix(workspace): remove LinkedIn optimiser, salary insight, gap analysis, feedback bar; SC manual trigger; fix typography"
```

---

### Task 6: Update SC rules heading format

**Files:**
- Modify: `server/rules/selection_criteria_rules.md`

- [ ] **Step 1: Update Section 7.1 document structure**

Find Section 7.1 (around line 177). The current template shows:
```
Criterion 1: [Paste full criterion text from JD]
```

Update it to:
```
## Criterion 1: [Paste full criterion text from JD]
```

Update all criterion examples in that code block to use `##` prefix. The full block should become:

```
## Criterion 1: [Paste full criterion text from JD]

[STAR response — prose, no bullet points unless multi-example]

---

## Criterion 2: [Paste full criterion text from JD]

[STAR response]

---
```

- [ ] **Step 2: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/rules/selection_criteria_rules.md
git commit -m "fix(sc-rules): use ## for criterion headings so preview renders at readable size"
```

---

### Task 7: ApplicationTracker — optimistic status updates

**Files:**
- Modify: `src/components/ApplicationTracker.tsx`

- [ ] **Step 1: Read the mutation block**

Read lines 46–57 of `src/components/ApplicationTracker.tsx` (the `updateJobMutation`).

- [ ] **Step 2: Replace `updateJobMutation` with optimistic version**

Replace the existing mutation:

```ts
const updateJobMutation = useMutation({
    mutationFn: async ({ id, status, dateApplied }: { id: string; status: ApplicationStatus; dateApplied?: string }) => {
        const { data } = await api.patch(`/jobs/${id}`, { status, dateApplied });
        return data;
    },
    onMutate: async ({ id, status, dateApplied }) => {
        await queryClient.cancelQueries({ queryKey: ['jobs'] });
        const previous = queryClient.getQueryData<JobApplication[]>(['jobs']);
        queryClient.setQueryData<JobApplication[]>(['jobs'], old =>
            old?.map(j => j.id === id
                ? { ...j, status, ...(dateApplied !== undefined ? { dateApplied } : {}) }
                : j
            ) ?? []
        );
        return { previous };
    },
    onError: (_err, _vars, context: any) => {
        if (context?.previous) queryClient.setQueryData(['jobs'], context.previous);
        toast.error('Failed to update status');
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
});
```

Note: remove the old `onSuccess` (just `invalidateQueries`) and old `onError` (just `toast.error`) — those are replaced.

- [ ] **Step 3: Verify TypeScript and build**

Run: `cd E:/AntiGravity/JobHub && npm run build 2>&1 | tail -10`
Expected: clean

- [ ] **Step 4: Commit**

```bash
cd E:/AntiGravity/JobHub
git add src/components/ApplicationTracker.tsx
git commit -m "fix(tracker): optimistic status updates for instant UI response"
```

---

### Task 8: DashboardLayout — LinkedIn Coming Soon nav item

**Files:**
- Modify: `src/layouts/DashboardLayout.tsx`

- [ ] **Step 1: Read the nav section**

Read `src/layouts/DashboardLayout.tsx` lines 1–70.

- [ ] **Step 2: Add LinkedIn Coming Soon item**

Add `Linkedin` to the lucide-react import line. Then, in the JSX, after the `{navItems.map(...)}` block that renders the nav links (after the closing `</nav>` tag of the mapped items), add the LinkedIn item:

```tsx
{/* LinkedIn — coming soon */}
<div
  style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px', borderRadius: 12, opacity: 0.5,
    cursor: 'not-allowed',
  }}
>
  <Linkedin size={20} color={T.textMuted} />
  <span style={{ fontSize: 14, fontWeight: 500, color: T.textMuted, flex: 1 }}>LinkedIn</span>
  <span style={{
    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
    textTransform: 'uppercase',
    background: 'rgba(99,102,241,0.12)', color: '#818cf8',
    padding: '2px 6px', borderRadius: 4,
  }}>
    Soon
  </span>
</div>
```

Place this inside the `<nav>` element, after the `navItems.map(...)` block — so it appears after "Email Templates" in the list.

- [ ] **Step 3: Verify TypeScript and build**

Run: `cd E:/AntiGravity/JobHub && npm run build 2>&1 | tail -10`
Expected: clean

- [ ] **Step 4: Commit**

```bash
cd E:/AntiGravity/JobHub
git add src/layouts/DashboardLayout.tsx
git commit -m "feat(nav): add LinkedIn Coming Soon item to sidebar"
```
