import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { hasPendingOnboarding } from '../lib/pendingOnboarding';
import { OnboardingIntake, type IntakeVariant } from './OnboardingIntake';

// Paid-client onboarding uses different (non-diagnostic) messaging. The flag is
// set by the set-password page the coaching email link lands on, and mirrored
// into the ?flow=client query param. Either source flips the variant.
function resolveIntakeVariant(): IntakeVariant {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('flow');
    if (fromUrl === 'client') return 'client';
    if (localStorage.getItem('jobhub_onboarding_variant') === 'client') return 'client';
  } catch { /* non-browser / storage blocked */ }
  return 'diagnostic';
}

interface OnboardingGateProps {
  children: React.ReactNode;
}

const PENDING_KEY = 'jobhub_pending_onboarding';
const RESTORED_KEY = 'jobhub_restored_onboarding';

export function savePendingOnboarding(answers: Record<string, any>) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(answers));
}

export function loadPendingOnboarding(): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingOnboarding() {
  localStorage.removeItem(PENDING_KEY);
}

export function OnboardingGate({ children }: OnboardingGateProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [claiming, setClaiming] = useState(false);
  // Has the returning-user claim attempt finished (or been ruled out)? Until it has,
  // a brand-new userId legitimately has no profile row yet (GET /profile returns
  // null), so we must keep the spinner up — NOT flash the onboarding intake.
  const [claimSettled, setClaimSettled] = useState(false);
  // Track whether an in-progress report exists. Checked here (during the loading
  // gate spinner) so OnboardingIntake never has to fire its own API call and risk
  // a mid-step state jump.
  const [reportStatus, setReportStatus] = useState<'checking' | 'processing' | 'failed' | 'none'>('checking');
  // BUG FIX: Prevent re-render loop. Without this ref, the claim effect re-fires whenever
  // isLoading toggles (which happens on every invalidateQueries call), causing an infinite
  // cycle of: claim → invalidate → isLoading flips → claim again.
  const claimFiredRef = useRef(false);

  const isAuthenticated = !!user && !(user as any).is_anonymous;

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      console.log('[OnboardingGate] fetching profile...');
      const { data } = await api.get('/profile');
      console.log('[OnboardingGate] profile fetched — hasCompletedOnboarding:', data?.hasCompletedOnboarding, '| userId:', data?.userId);
      return data;
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
    retry: 1,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });

  // Check for an existing in-progress report once profile is loaded and onboarding is incomplete.
  // Done here (behind the loading spinner) so OnboardingIntake never races against this check.
  useEffect(() => {
    if (!isAuthenticated || isLoading || profile?.hasCompletedOnboarding) {
      setReportStatus('none');
      return;
    }
    let cancelled = false;
    api.get('/onboarding/report')
      .then(({ data }) => {
        if (cancelled) return;
        if (data.status === 'PROCESSING') setReportStatus('processing');
        else if (data.status === 'FAILED') setReportStatus('failed');
        else setReportStatus('none');
      })
      .catch(() => { if (!cancelled) setReportStatus('none'); });
    return () => { cancelled = true; };
  }, [isAuthenticated, isLoading, profile?.hasCompletedOnboarding]);

  // When a returning user logs in via magic link they get a new userId.
  // Attempt to claim their previous profile (matched by email) before
  // falling through to onboarding.
  useEffect(() => {
    console.log('[OnboardingGate] claim effect — isLoading:', isLoading, '| claiming:', claiming, '| claimFired:', claimFiredRef.current, '| email:', user?.email, '| hasCompletedOnboarding:', profile?.hasCompletedOnboarding);

    // Detect post-Google-OAuth redirect and restore pending onboarding answers
    const pending = loadPendingOnboarding();
    if (pending && user && !profile?.hasCompletedOnboarding) {
      clearPendingOnboarding();
      localStorage.setItem(RESTORED_KEY, JSON.stringify(pending));
    }

    if (isLoading || claiming) return;
    if (!user?.email) { setClaimSettled(true); return; }
    // Only claim when there is definitively no profile for this userId.
    // The server handles zombie detection; the client just needs the trigger.
    if (profile?.hasCompletedOnboarding) return;
    // Guard: only fire once per component mount to prevent the invalidateQueries
    // cycle from re-triggering this effect repeatedly.
    if (claimFiredRef.current) {
      // If we already fired but got here again, claim is settled (no need to re-claim)
      setClaimSettled(true);
      return;
    }

    claimFiredRef.current = true;
    let cancelled = false;
    async function tryClaim() {
      setClaiming(true);
      // Pass location/targetRole from profile if available (user may have updated them in modal)
      const claimBody: any = {};
      if (profile?.targetCity || profile?.location) {
        claimBody.location = profile.targetCity || profile.location;
      }
      if (profile?.targetRole) {
        claimBody.targetRole = profile.targetRole;
      }
      if (profile?.targetRoles && Array.isArray(profile.targetRoles)) {
        claimBody.targetRoles = profile.targetRoles;
      }
      console.log('[OnboardingGate] firing claim POST /profile/claim for email:', user?.email, 'body:', claimBody);
      try {
        const { data } = await api.post('/profile/claim', claimBody);
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
        if (!cancelled) { setClaiming(false); setClaimSettled(true); }
      }
    }
    tryClaim();
    return () => { cancelled = true; };
  // isLoading IS included: the claim must re-evaluate when the profile query
  // finishes (loading true -> false). The claimFiredRef guard above prevents the
  // invalidate loop, so watching isLoading is safe and avoids the deadlock where a
  // null-profile new user strands the spinner (deps never change after load).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.hasCompletedOnboarding, user?.email, isLoading]);

  // NUCLEAR BYPASS: If profile has actual data from CV scan, allow through immediately.
  // This must come BEFORE the spinner check to prevent CV-first users from being stuck.
  // CV scan always sets resumeRawText; extraction may also populate experience/achievements.
  // Also bypass if there was an API error but we have cached profile data — stale cache
  // with real data is better than stranding the user on a broken onboarding screen.
  const hasRealProfileData = profile?.experience?.length > 0
    || profile?.achievements?.length > 0
    || profile?.professionalSummary
    || profile?.resumeRawText; // Fallback: CV was uploaded even if extraction incomplete
  if (hasRealProfileData) {
    console.log('[OnboardingGate] BYPASS: Profile has real data - allowing through');
    return <>{children}</>;
  }

  // Show spinner while profile is loading, while the returning-user claim is still
  // resolving (stops the onboarding intake flashing on a fresh userId whose profile
  // hasn't been claimed yet), OR while we're checking report status.
  const claimPending = isAuthenticated && !isError && !profile?.hasCompletedOnboarding && !claimSettled;
  if (isLoading || claimPending || (isAuthenticated && !profile?.hasCompletedOnboarding && reportStatus === 'checking')) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF7F2' }}>
        <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(45,90,110,0.2)', borderTopColor: '#2D5A6E' }} />
      </div>
    );
  }

  // API error or no profile row yet — show onboarding.
  // If the user is authenticated AND has pending onboarding data in localStorage
  // (placed there before a Google OAuth redirect), resume mode auto-submits.
  if (isError || !profile?.hasCompletedOnboarding) {
    const resumeMode = !!user && hasPendingOnboarding();
    // Pass the pre-checked report status so OnboardingIntake doesn't need to re-check.
    // If there's already a processing/failed report, start at step 5 immediately.
    const initialStep = (reportStatus === 'processing' || reportStatus === 'failed') ? 5 : undefined;
    return <OnboardingIntake resumeMode={resumeMode} initialStep={initialStep} variant={resolveIntakeVariant()} />;
  }

  return <>{children}</>;
}
