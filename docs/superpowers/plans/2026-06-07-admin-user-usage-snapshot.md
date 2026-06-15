# Admin User-Usage Snapshot — Spec + Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (or subagent-driven-development). Steps use checkbox (`- [ ]`) syntax.

**Goal:** A basic admin-only table showing per-user usage (applications sent, documents generated, edits, trial day, last active) so the founder can prep weekly evaluation calls.

**Scope:** Read-only. No charts, no fancy UI. One endpoint + one table page. Reuses existing admin auth and router.

**Tech Stack:** Express, TypeScript, Prisma, React, react-query.

**Rules:** Build exactly this. No em dashes ([[feedback_no_em_dashes]]). Reuse `requireAdmin` + `EXEMPT_EMAILS` (do not invent new auth). STOP-and-report if a referenced field is missing.

---

## Spec (brief)

**Data per user (one row):** name, email, plan/planStatus, trial day (X of 7 if on trial), signed-up date, last-active, applications started, applications sent (APPLIED), resumes generated, cover letters generated, documents edited.

**Sources (all existing):**
- `CandidateProfile`: `userId, name, email, plan, planStatus, trialEndDate, createdAt`.
- `JobApplication`: `userId, status, createdAt` → started = total count; sent = count where `status='APPLIED'`.
- `Document`: `userId, type (RESUME|COVER_LETTER|...), createdAt, updatedAt` → resumes/cover letters = count by type; edited = count where `updatedAt > createdAt`.
- last-active = most recent of (latest `JobApplication.createdAt`, latest `Document.updatedAt`, `profile.createdAt`).

**Endpoint:** `GET /api/admin/funnel/user-usage` (admin-only) → `{ users: UserUsageRow[] }`, newest signups first.

**UI:** route `/admin/users`, a plain table. Admin-only data (the endpoint 403s non-admins).

---

## Task 1: Backend endpoint `GET /user-usage`

**Files:** Modify `server/src/routes/admin-funnel.ts` (add the route; it already has `requireAdmin`, `authenticate`, `prisma`, `EXEMPT_EMAILS`).

- [ ] **Step 1: Add the route** (place after the existing `/trials` route)

```typescript
// GET /api/admin/funnel/user-usage — per-user usage snapshot for evaluation calls.
router.get('/user-usage', authenticate, requireAdmin, async (_req, res) => {
  try {
    const now = Date.now();

    const profiles = await prisma.candidateProfile.findMany({
      select: { userId: true, name: true, email: true, plan: true, planStatus: true, trialEndDate: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Application counts per user (total + applied).
    const appsAll = await prisma.jobApplication.groupBy({ by: ['userId'], _count: { _all: true } });
    const appsApplied = await prisma.jobApplication.groupBy({ by: ['userId'], where: { status: 'APPLIED' }, _count: { _all: true } });
    const latestApp = await prisma.jobApplication.findMany({
      select: { userId: true, createdAt: true }, orderBy: { createdAt: 'desc' },
    });

    // Document counts per user (by type) + edited (updatedAt > createdAt) + latest activity.
    const docs = await prisma.document.findMany({
      select: { userId: true, type: true, createdAt: true, updatedAt: true },
    });

    const totalApps = new Map<string, number>();
    for (const a of appsAll) totalApps.set(a.userId, a._count._all);
    const sentApps = new Map<string, number>();
    for (const a of appsApplied) sentApps.set(a.userId, a._count._all);
    const lastAppAt = new Map<string, number>();
    for (const a of latestApp) if (!lastAppAt.has(a.userId)) lastAppAt.set(a.userId, a.createdAt.getTime());

    const resumes = new Map<string, number>();
    const covers = new Map<string, number>();
    const edited = new Map<string, number>();
    const lastDocAt = new Map<string, number>();
    for (const d of docs) {
      if (d.type === 'RESUME') resumes.set(d.userId, (resumes.get(d.userId) ?? 0) + 1);
      if (d.type === 'COVER_LETTER') covers.set(d.userId, (covers.get(d.userId) ?? 0) + 1);
      if (d.updatedAt.getTime() > d.createdAt.getTime() + 1000) edited.set(d.userId, (edited.get(d.userId) ?? 0) + 1);
      const t = d.updatedAt.getTime();
      if (t > (lastDocAt.get(d.userId) ?? 0)) lastDocAt.set(d.userId, t);
    }

    const users = profiles.map(p => {
      const trialDay = p.trialEndDate
        ? 7 - Math.max(0, Math.ceil((p.trialEndDate.getTime() - now) / (1000 * 60 * 60 * 24)))
        : null;
      const lastActive = Math.max(
        p.createdAt.getTime(),
        lastAppAt.get(p.userId) ?? 0,
        lastDocAt.get(p.userId) ?? 0,
      );
      return {
        userId: p.userId,
        name: p.name ?? null,
        email: p.email ?? null,
        plan: p.plan ?? 'free',
        planStatus: p.planStatus ?? 'active',
        trialDay: trialDay !== null && trialDay >= 1 && trialDay <= 7 ? trialDay : null,
        signedUpAt: p.createdAt.toISOString(),
        lastActiveAt: new Date(lastActive).toISOString(),
        applicationsStarted: totalApps.get(p.userId) ?? 0,
        applicationsSent: sentApps.get(p.userId) ?? 0,
        resumesGenerated: resumes.get(p.userId) ?? 0,
        coverLettersGenerated: covers.get(p.userId) ?? 0,
        documentsEdited: edited.get(p.userId) ?? 0,
      };
    });

    res.json({ users });
  } catch (err: any) {
    console.error('[admin/user-usage]', err?.message ?? err);
    res.status(500).json({ error: 'Failed to load user usage' });
  }
});
```

- [ ] **Step 2: Typecheck** — Run `cd server && npx tsc --noEmit` (exit 0). If `document`/`jobApplication`/field names mismatch Prisma, STOP and report.

- [ ] **Step 3: Manual smoke** — as an admin (EXEMPT_EMAILS) session: `GET /api/admin/funnel/user-usage` returns `{ users: [...] }` with the fields above; as a non-admin it 403s.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/admin-funnel.ts
git commit -m "feat(admin): per-user usage snapshot endpoint"
```

---

## Task 2: Frontend table page `/admin/users`

**Files:** Create `src/pages/AdminUserUsage.tsx`; Modify `src/App.tsx` (add the lazy import + route next to the other `/admin/*` routes).

- [ ] **Step 1: Create the page**

```tsx
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

interface UserUsageRow {
  userId: string; name: string | null; email: string | null;
  plan: string; planStatus: string; trialDay: number | null;
  signedUpAt: string; lastActiveAt: string;
  applicationsStarted: number; applicationsSent: number;
  resumesGenerated: number; coverLettersGenerated: number; documentsEdited: number;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });

export function AdminUserUsage() {
  const { data, isLoading, isError } = useQuery<{ users: UserUsageRow[] }>({
    queryKey: ['admin-user-usage'],
    queryFn: async () => (await api.get('/admin/funnel/user-usage')).data,
  });

  if (isLoading) return <div style={{ padding: 32 }}>Loading…</div>;
  if (isError) return <div style={{ padding: 32 }}>Could not load (admin only).</div>;

  const users = data?.users ?? [];
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#666', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' };

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>User usage</h1>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>{users.length} users. For weekly evaluation calls.</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>User</th>
              <th style={th}>Plan</th>
              <th style={th}>Trial day</th>
              <th style={th}>Apps sent</th>
              <th style={th}>Apps started</th>
              <th style={th}>Resumes</th>
              <th style={th}>Cover letters</th>
              <th style={th}>Edits</th>
              <th style={th}>Last active</th>
              <th style={th}>Signed up</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.userId}>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{u.name || '(no name)'}</div>
                  <div style={{ color: '#888', fontSize: 11 }}>{u.email}</div>
                </td>
                <td style={td}>{u.plan}{u.planStatus !== 'active' ? ` (${u.planStatus})` : ''}</td>
                <td style={td}>{u.trialDay ? `${u.trialDay} of 7` : '—'}</td>
                <td style={{ ...td, fontWeight: 700 }}>{u.applicationsSent}</td>
                <td style={td}>{u.applicationsStarted}</td>
                <td style={td}>{u.resumesGenerated}</td>
                <td style={td}>{u.coverLettersGenerated}</td>
                <td style={td}>{u.documentsEdited}</td>
                <td style={td}>{fmt(u.lastActiveAt)}</td>
                <td style={td}>{fmt(u.signedUpAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

(The em dash in "Trial day" fallback above is an en/em-style glyph; use a plain hyphen "-" or the word, NOT "—". Render the fallback as the single character `-`.)

- [ ] **Step 2: Add the route in `src/App.tsx`**

Lazy import alongside the other admin pages:

```tsx
const AdminUserUsage = React.lazy(() =>
  import('./pages/AdminUserUsage').then(m => ({ default: m.AdminUserUsage }))
);
```

Add the route next to `/admin/funnel`:

```tsx
                <Route path="/admin/users" element={<AdminUserUsage />} />
```

- [ ] **Step 3: Typecheck** — Run (repo root) `npx tsc -p tsconfig.app.json --noEmit` (exit 0).

- [ ] **Step 4: Manual smoke** — Visit `/admin/users` as an admin: a table of users with the columns above renders.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AdminUserUsage.tsx src/App.tsx
git commit -m "feat(admin): basic per-user usage table at /admin/users"
```

---

## Self-Review

- [ ] Endpoint admin-gated (reuses `requireAdmin`/`EXEMPT_EMAILS`); read-only; uses only existing fields (`CandidateProfile`, `JobApplication`, `Document`).
- [ ] No em dashes in any rendered copy (use `-` for the fallback).
- [ ] "Edits" is approximated by `Document.updatedAt > createdAt`; if you later want exact edit events, that is the separate Tier 2 (a `UsageEvent` table), out of scope here.
