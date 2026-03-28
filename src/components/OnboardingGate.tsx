import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { OnboardingIntake } from './OnboardingIntake';

interface OnboardingGateProps {
  children: React.ReactNode;
}

export function OnboardingGate({ children }: OnboardingGateProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [claiming, setClaiming] = useState(false);

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/profile');
      return data;
    },
    staleTime: 0,          // always fetch fresh — userId can change between sessions
    refetchOnMount: true,
    retry: 1,
    retryDelay: 1000,
  });

  // When a returning user logs in via magic link they get a new userId.
  // Attempt to claim their previous profile (matched by email) before
  // falling through to onboarding.
  useEffect(() => {
    if (isLoading || claiming) return;
    if (profile?.hasCompletedOnboarding) return;
    if (!user?.email) return;

    let cancelled = false;
    async function tryClaim() {
      setClaiming(true);
      try {
        const { data } = await api.post('/profile/claim');
        // 'claimed' = migrated from old userId; 'already_exists' = profile already on
        // this userId but cache may be stale null from the anonymous session — invalidate either way
        if (!cancelled && (data.status === 'claimed' || data.status === 'already_exists')) {
          // Clear the "report seen" flag so a returning user always sees their
          // report on first login from a new device/session.
          localStorage.removeItem('jobhub_report_seen');
          await queryClient.invalidateQueries({ queryKey: ['profile'] });
          await queryClient.invalidateQueries({ queryKey: ['report'] });
        }
      } catch {
        // claim failed — fall through to onboarding
      } finally {
        if (!cancelled) setClaiming(false);
      }
    }
    tryClaim();
    return () => { cancelled = true; };
  }, [isLoading, profile?.hasCompletedOnboarding, user?.email]);

  if (isLoading || claiming) {
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
