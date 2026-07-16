# Reverting Coach Dashboard to Real Data

## What Was Changed

The `/admin/coach` page (`src/pages/CoachDashboard.tsx`) was temporarily modified to display **mock demo data** instead of fetching real member data from the API.

### Changes Made:
1. Added a `generateMockData()` function that creates 27 fictional members
2. Modified the `useQuery` hook to use `generateMockData()` instead of calling the API
3. Modified mutations (`pauseMutation`, `overrideMutation`) to show toast messages without making API calls
4. **Removed:** The DEMO MODE banner (already removed in commit `205af7e`)

## How to Revert to Real Data

### Option 1: Simple Revert (Recommended)

Replace the mock query and mutations with the original API calls:

**Find this block (around line 230-257):**

```typescript
// TEMPORARY: Use mock data for demo (100% safe - no API calls, no DB writes)
const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['coach-overview'],
    queryFn: async () => generateMockData(),
});

// TEMPORARY: Mock mutations that just show toast (no API calls)
const pauseMutation = useMutation({
    mutationFn: async (_body: { userId: string; weekStart: string; remove?: boolean }) => {
        await new Promise(r => setTimeout(r, 300));
        return { success: true };
    },
    onSuccess: (_d, vars) => {
        toast.success(vars.remove ? 'Pause removed (demo)' : 'Pause week granted (demo)');
    },
    onError: () => toast.error('Could not update pause week'),
});

const overrideMutation = useMutation({
    mutationFn: async (_body: { userId: string }) => {
        await new Promise(r => setTimeout(r, 300));
        return { success: true };
    },
    onSuccess: () => {
        toast.success('Goals overridden — applies immediately (demo)');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Override failed'),
});
```

**Replace with the original code:**

```typescript
const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['coach-overview'],
    queryFn: async () => (await api.get('/admin/coach/overview')).data as CoachData,
});

const pauseMutation = useMutation({
    mutationFn: async (body: { userId: string; weekStart: string; remove?: boolean }) =>
        (await api.post('/admin/coach/pause', { ...body, reason: 'coach granted' })).data,
    onSuccess: (_d, vars) => {
        queryClient.invalidateQueries({ queryKey: ['coach-overview'] });
        toast.success(vars.remove ? 'Pause removed' : 'Pause week granted');
    },
    onError: () => toast.error('Could not update pause week'),
});

const overrideMutation = useMutation({
    mutationFn: async (body: { userId: string }) =>
        (await api.post('/admin/coach/goals', { ...body, ...override, note: 'coach override' })).data,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['coach-overview'] });
        toast.success('Goals overridden — applies immediately');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Override failed'),
});
```

### Option 2: Full Cleanup

To completely remove all mock data code:

1. **Remove the mock data arrays** (lines 38-54):
   - `MOCK_NAMES`
   - `MOCK_EMAILS`

2. **Remove the `generateMockData()` function** (lines 56-216)

3. **Restore the original query and mutations** (as shown in Option 1)

4. **Remove `queryClient` from the destructuring** (line 225) if not used elsewhere:
   ```typescript
   // Change from:
   const queryClient = useQueryClient();
   // To: remove this line entirely
   ```

5. **Add back the `useQueryClient` import** if it's not already imported:
   ```typescript
   import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
   ```

## Verification After Revert

After making changes:

```bash
# Typecheck
npx tsc -b

# Build
npm run build

# Test the page
# - Should show real member data from your database
# - Pause/override buttons should actually modify data
# - Page should work exactly as before the demo changes
```

## Commit Message

```bash
git add src/pages/CoachDashboard.tsx
git commit -m "revert(coach): restore real data API calls, remove mock data"
```

## Related Commits (for reference)

| Commit | Description |
|--------|-------------|
| `2385f61` | Original mock data implementation |
| `205af7e` | Removed demo mode banner |
| *your revert* | Restore real data (create this commit) |

---

**Note:** The mock data was 100% frontend-only and never touched the database. Reverting simply restores the API calls to fetch real member data.
