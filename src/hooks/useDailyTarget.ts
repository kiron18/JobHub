import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../lib/api';

/* ── useDailyTarget ───────────────────────────────────────────────────
   Today's target, from the server rather than from component state.

   The rules all live in server/src/services/tracker/dailyTarget.ts —
   floor is the member's program goal, ceiling is ten, raises are
   automatic, lowering is never offered and there is exactly one undo a
   day. This hook deliberately re-derives none of them: a second copy of
   a rule is a second thing to get out of sync, and the server is the one
   that has to be right.
*/

export interface DailyTargetState {
  target: number;
  committed: number | null;
  locked: boolean;
  undoAvailable: boolean;
  filedToday: number;
  min: number;
  max: number;
  explainerSeen: boolean;
}

export const DAILY_TARGET_KEY = ['tracker-daily-target'];

export function useDailyTarget(enabled = true) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: DAILY_TARGET_KEY,
    queryFn: async () => (await api.get('/tracker/daily-target')).data as DailyTargetState,
    enabled,
    staleTime: 30_000,
    /* No retries. The only expected failure here is "not signed in", and
       retrying a 401 three times just leaves the UI insisting it is still
       checking for half a second per attempt. */
    retry: false,
  });

  /** The server returns the whole new state, so every mutation just adopts it. */
  const adopt = (data: DailyTargetState) => qc.setQueryData(DAILY_TARGET_KEY, data);

  const onError = (err: unknown, fallback: string) => {
    // The server sends a human-readable reason for every refusal it makes
    // on purpose (already set, below your goal, undo spent) — show that
    // rather than a generic failure.
    const payload = (err as { response?: { data?: { error?: string } } })?.response?.data;
    toast.error(payload?.error ?? fallback);
    // Whatever went wrong, the server's view is the true one.
    qc.invalidateQueries({ queryKey: DAILY_TARGET_KEY });
  };

  const setTarget = useMutation({
    mutationFn: async (target: number) =>
      (await api.post('/tracker/daily-target', { target })).data as DailyTargetState,
    onSuccess: adopt,
    onError: e => onError(e, 'Could not set today\'s target.'),
  });

  const useUndo = useMutation({
    mutationFn: async () =>
      (await api.post('/tracker/daily-target/undo')).data as DailyTargetState,
    onSuccess: adopt,
    onError: e => onError(e, 'Could not undo today\'s target.'),
  });

  const markExplainerSeen = useMutation({
    mutationFn: async () => (await api.post('/tracker/daily-target/explainer-seen')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: DAILY_TARGET_KEY }),
    // Silent on failure: the dialog has already been read, and nagging
    // about a bookkeeping call is worse than showing it once more.
    onError: () => { /* noop */ },
  });

  return { ...query, setTarget, useUndo, markExplainerSeen };
}
