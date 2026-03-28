import { useEffect, useRef, useState } from 'react';
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
  // BUG FIX: Prevent re-render loop. Without this ref, the claim effect re-fires whenever
  // isLoading toggles (which happens on every invalidateQueries call), causing an infinite
  // cycle of: claim → invalidate → isLoading flips → claim again.
  const claimFiredRef = useRef(false);

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      console.log('[OnboardingGate] fetching profile...');
      const { data } = await api.get('/profile');
      console.log('[OnboardingGate] profile fetched — hasCompletedOnboarding:', data?.hasCompletedOnboarding, '| userId:', data?.userId);
      return data;
    },
    staleTime: 30_000,     // 30s — fresh enough without mid-onboarding refetch loops
    retry: 1,
    retryDelay: 1000,
  });

  // When a returning user logs in via magic link they get a new userId.
  // Attempt to claim their previous profile (matched by email) before
  // falling through to onboarding.
  useEffect(() => {
    console.log('[OnboardingGate] claim effect — isLoading:', isLoading, '| claiming:', claiming, '| claimFired:', claimFiredRef.current, '| email:', user?.email, '| hasCompletedOnboarding:', profile?.hasCompletedOnboarding);
    if (isLoading || claiming) return;
    if (!user?.email) return;
    // Only claim when there is definitively no profile for this userId.
    // The server handles zombie detection; the client just needs the trigger.
    if (profile?.hasCompletedOnboarding) return;
    // Guard: only fire once per component mount to prevent the invalidateQueries
    // cycle from re-triggering this effect repeatedly.
    if (claimFiredRef.current) return;

    claimFiredRef.current = true;
    let cancelled = false;
    async function tryClaim() {
      setClaiming(true);
      console.log('[OnboardingGate] firing claim POST /profile/claim for email:', user?.email);
      try {
        const { data } = await api.post('/profile/claim');
        console.log('[OnboardingGate] claim response:', data);
        // 'claimed' = migrated from old userId; 'already_exists' = profile already on
        // this userId but cache may be stale null from the anonymous session — invalidate either way
        if (!cancelled && (data.status === 'claimed' || data.status === 'already_exists')) {
          // Clear the "report seen" flag so a returning user always sees their
          // report on first login from a new device/session.
          localStorage.removeItem('jobhub_report_seen');
          console.log('[OnboardingGate] claim success — cleared reportSeen, invalidating profile+report');
          await queryClient.invalidateQueries({ queryKey: ['profile'] });
          await queryClient.invalidateQueries({ queryKey: ['report'] });
        } else {
          console.log('[OnboardingGate] claim returned status:', data.status, '— no invalidation needed');
        }
      } catch (err) {
        console.warn('[OnboardingGate] claim failed:', err);
        // claim failed — fall through to onboarding
      } finally {
        if (!cancelled) setClaiming(false);
      }
    }
    tryClaim();
    return () => { cancelled = true; };
  // Intentionally NOT including isLoading in deps — it toggles on every invalidate
  // and would re-trigger the claim. We gate on claimFiredRef instead.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.hasCompletedOnboarding, user?.email]);

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
