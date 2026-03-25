import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { OnboardingIntake } from './OnboardingIntake';

interface OnboardingGateProps {
  children: React.ReactNode;
}

export function OnboardingGate({ children }: OnboardingGateProps) {
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/profile');
      return data;
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,          // fail fast — don't spin for 30s retrying a broken API URL
    retryDelay: 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  // API error or no profile row yet — show onboarding
  if (isError || !profile?.hasCompletedOnboarding) {
    return <OnboardingIntake />;
  }

  return <>{children}</>;
}
