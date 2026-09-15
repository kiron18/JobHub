import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';
import { useAuth } from '../contexts/AuthContext';

export type TrialChallengeStatus =
  | 'not_started'
  | 'day_in_progress'
  | 'day_passed_waiting'
  | 'day_failed'
  | 'forfeited'
  | 'completed';

export interface TrialChallengeState {
  eligible: boolean;
  status: TrialChallengeStatus;
  currentDay: number;
  windowEndsAt: string | null;
  minimumRequired: number;
  appliedThisWindow: number;
  linkedinUnlocked: boolean;
  forfeitureDeadline: string | null;
}

export const TRIAL_CHALLENGE_QUERY_KEY = ['trial-challenge-state'];

/**
 * Shared read of trial-challenge state. Both FitCheckPage (deciding whether to
 * navigate into /apply) and TrialChallengeOverlay (deciding what to render)
 * use this exact hook/query key, so there's one fetch, not two racing copies.
 */
export function useTrialChallengeState() {
  const { user } = useAuth();
  const isAuthenticated = !!user && !(user as any).is_anonymous;

  return useQuery({
    queryKey: TRIAL_CHALLENGE_QUERY_KEY,
    queryFn: async () => (await api.get('/trial-challenge/state')).data as TrialChallengeState,
    enabled: isAuthenticated,
    // Snappy while a window is actually running (the countdown/applied-count
    // needs to feel live); relaxed otherwise, same as DailyCloseOut's approach.
    refetchInterval: (query) => (query.state.data?.status === 'day_in_progress' ? 12_000 : 60_000),
    staleTime: 10_000,
  });
}

export function useBeginTrialDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post('/trial-challenge/begin')).data as TrialChallengeState,
    onSuccess: (data) => queryClient.setQueryData(TRIAL_CHALLENGE_QUERY_KEY, data),
  });
}

export function useTrialWhatsappOptIn() {
  return useMutation({
    mutationFn: async (payload: { whatsappNumber?: string; reminderTimePreferenceHour?: number }) =>
      (await api.post('/trial-challenge/whatsapp-opt-in', payload)).data,
  });
}
