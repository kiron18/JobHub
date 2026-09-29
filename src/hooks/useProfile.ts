import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { CandidateProfile } from '../types';

export function useProfile() {
  // Mounted on public pages too (TrialChallengeOverlay sits beside the
  // routes). Signed out there is no profile to fetch, so do not ask: it was
  // two 401s on every public page view.
  const { user } = useAuth();
  const { data: profile, isLoading, isError } = useQuery<CandidateProfile>({
    enabled: !!user,
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/profile');
      return data as CandidateProfile;
    },
    staleTime: 30_000,
    retry: 1,
  });

  return { profile: profile ?? null, isLoading, isError };
}
