import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { CandidateProfile } from '../types';

export function useProfile() {
  const { data: profile, isLoading, isError } = useQuery<CandidateProfile>({
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
