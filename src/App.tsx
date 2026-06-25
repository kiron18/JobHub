import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { motion } from 'framer-motion';

// Components — layout/gate loaded eagerly, page-level components lazy
import { DashboardLayout } from './layouts/DashboardLayout';
import { OnboardingGate } from './components/OnboardingGate';
import { ErrorBoundary } from './components/ErrorBoundary';

const ApplicationTracker   = React.lazy(() => import('./components/ApplicationTracker').then(m => ({ default: m.ApplicationTracker })));
const ProfileBank          = React.lazy(() => import('./components/ProfileBank').then(m => ({ default: m.ProfileBank })));
const DocumentLibrary      = React.lazy(() => import('./components/DocumentLibrary').then(m => ({ default: m.DocumentLibrary })));
const EmailTemplatesLibrary = React.lazy(() => import('./components/EmailTemplatesLibrary').then(m => ({ default: m.EmailTemplatesLibrary })));
const LinkedInPage         = React.lazy(() => import('./pages/LinkedInPage').then(m => ({ default: m.LinkedInPage })));
const FridayBriefPage = React.lazy(() =>
  import('./pages/FridayBriefPage').then(m => ({ default: m.FridayBriefPage }))
);
const AdminDashboard = React.lazy(() =>
  import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard }))
);
const AdminFunnel = React.lazy(() =>
  import('./pages/AdminFunnel').then(m => ({ default: m.AdminFunnel }))
);
const AdminUserUsage = React.lazy(() =>
  import('./pages/AdminUserUsage').then(m => ({ default: m.AdminUserUsage }))
);
const AdminContacts = React.lazy(() =>
  import('./pages/AdminContacts').then(m => ({ default: m.default }))
);
const AdminContactDetail = React.lazy(() =>
  import('./pages/AdminContactDetail').then(m => ({ default: m.default }))
);
const AdminBroadcasts = React.lazy(() =>
  import('./pages/AdminBroadcasts').then(m => ({ default: m.default }))
);
const EmailAnalytics = React.lazy(() =>
  import('./pages/EmailAnalytics').then(m => ({ default: m.default }))
);
const MindsetPage = React.lazy(() =>
  import('./pages/MindsetPage').then(m => ({ default: m.MindsetPage }))
);
const DiagnosticPage = React.lazy(() =>
  import('./components/DiagnosticPage').then(m => ({ default: m.DiagnosticPage }))
);
const FromScratchCapture = React.lazy(() =>
  import('./components/FromScratchCapture').then(m => ({ default: m.FromScratchCapture }))
);
const StrategyHub = React.lazy(() =>
  import('./pages/StrategyHub').then(m => ({ default: m.StrategyHub }))
);
const StepperWorkspace = React.lazy(() =>
  import('./pages/StepperWorkspace').then(m => ({ default: m.StepperWorkspace }))
);
const VisaSponsorsPage = React.lazy(() =>
  import('./pages/VisaSponsorsPage').then(m => ({ default: m.VisaSponsorsPage }))
);
const SkippedJobsPage = React.lazy(() =>
  import('./pages/SkippedJobsPage').then(m => ({ default: m.SkippedJobsPage }))
);
const MockLandingPage = React.lazy(() =>
  import('./pages/MockLandingPage').then(m => ({ default: m.MockLandingPage }))
);
const BookCallPage = React.lazy(() =>
  import('./pages/BookCallPage').then(m => ({ default: m.BookCallPage }))
);
const AnimationTest = React.lazy(() =>
  import('./pages/AnimationTest').then(m => ({ default: m.AnimationTest }))
);

// Auth & Context
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthPage } from './pages/AuthPage';
import { AuthCallback } from './components/AuthCallback';
// PAYMENTS PAUSED: pricing page hidden during pricing rework
// import { PricingPage } from './pages/PricingPage';
import { LegalPage } from './pages/LegalPage';

// Lib
import api from './lib/api';
import { isEssentiallyEmptyProfile } from './lib/parseQuality';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // refetchOnWindowFocus was firing a full-app refetch storm on every
      // focus/visibility event (react-query onFocus → refetch), repainting the
      // whole dashboard every few seconds. Disable it and set a sane default
      // staleTime so queries without explicit options don't refetch on mount.
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      retry: 1,
    },
  },
});

// --- Sub-components (could be moved to separate files later) ---

// Legacy Dashboard removed — replaced by StrategyHub on `/`. Pipeline /
// MatchEngine logic remains reachable via git history if needed.


// Workspace Component — now hosts ProfileBank
const Workspace = () => {
  return <ProfileBank />;
};

// Protected Route Guard
// - Returning users (have jobhub_auth_email in localStorage) → redirect to /auth to log in
// - New visitors (no stored email, no session) → render children; OnboardingGate handles
//   the unauthenticated case via the 401 on profile fetch and shows OnboardingIntake
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null>(null);

  // When the Supabase userId changes (e.g. magic-link login → new session), the old
  // ['profile'] cache belongs to a different user — clear it immediately so
  // OnboardingGate always fetches fresh data for the new userId.
  useEffect(() => {
    const newId = user?.id ?? null;
    if (prevUserIdRef.current !== null && prevUserIdRef.current !== newId) {
      queryClient.removeQueries({ queryKey: ['profile'] });
      queryClient.removeQueries({ queryKey: ['report'] });
    }
    prevUserIdRef.current = newId;
  }, [user?.id]);

  // Guard: only redirect to /auth when React state says no user AND Supabase confirms
  // no active session. This prevents a false redirect when React state lags one render
  // behind the auth event (e.g. immediately after navigate('/') from AuthPage).
  useEffect(() => {
    if (loading || user) return;
    const savedEmail = localStorage.getItem('jobhub_auth_email');
    if (!savedEmail) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate(`/auth?email=${encodeURIComponent(savedEmail)}`, { replace: true });
      }
    });
  }, [loading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF7F2' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(45,90,110,0.2)', borderTopColor: '#2D5A6E' }} />
          <p style={{ color: '#5C5750', fontWeight: 500, margin: 0 }}>Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// --- Dashboard access gate ---

// PAYMENTS PAUSED: upgrade modal disabled during pricing rework
// import { UpgradeModal, type UpgradeTrigger } from './components/UpgradeModal';

// Global event bus for triggering the upgrade modal from anywhere in the app
// export function showUpgradeModal(trigger: UpgradeTrigger) {
//   window.dispatchEvent(new CustomEvent('show-upgrade', { detail: trigger }));
// }

// PAYMENTS PAUSED: Banner components removed during pricing rework
// Original code preserved in git history - restore when payments resume

function DashboardGate({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: _profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => { const { data } = await api.get('/profile'); return data; },
    staleTime: 5 * 60 * 1000,
  });

  // PAYMENTS PAUSED: upgrade trigger disabled during pricing rework
  // const [upgradeTrigger, setUpgradeTrigger] = useState<UpgradeTrigger | null>(null);

  // Listen for upgrade events from any component - DISABLED
  // useEffect(() => {
  //   const handler = (e: Event) => setUpgradeTrigger((e as CustomEvent).detail as UpgradeTrigger);
  //   window.addEventListener('show-upgrade', handler);
  //   return () => window.removeEventListener('show-upgrade', handler);
  // }, []);

  // Post-payment polling: Stripe webhook may arrive slightly after redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'success') return;
    window.history.replaceState({}, '', '/');
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        await queryClient.invalidateQueries({ queryKey: ['profile'] });
        const fresh = queryClient.getQueryData<any>(['profile']);
        if (fresh?.plan !== 'free' || attempts >= 15) clearInterval(interval);
      } catch { if (attempts >= 15) clearInterval(interval); }
    }, 2000);
    return () => clearInterval(interval);
  }, [queryClient]);

  if (isLoading) return null;

  // PAYMENTS PAUSED: plan status checks removed during pricing rework
  // const planStatus: string = profile?.planStatus ?? 'active';
  // const isPastDue = planStatus === 'past_due';
  // const isTrialing = planStatus === 'trialing';
  // const isLapsed = planStatus === 'cancelled' || planStatus === 'expired';

  return (
    <>
      {/* PAYMENTS PAUSED: upgrade modal disabled during pricing rework
      {upgradeTrigger && (
        <UpgradeModal
          trigger={upgradeTrigger}
          onClose={() => setUpgradeTrigger(null)}
        />
      )}
      */}
      {/* PAYMENTS PAUSED: payment-related banners disabled during pricing rework
      {isPastDue && <PastDueBanner />}
      {isLapsed && <LapsedBanner />}
      {isTrialing && profile?.trialEndDate && <TrialBanner trialEndDate={profile.trialEndDate} />}
      */}
      {children}
    </>
  );
}

// --- Report or Dashboard wrapper (first visit shows full-screen report) ---

type ReportFlowStage = 'loading' | 'diagnostic' | 'from-scratch' | 'dashboard';

// --- Public landing route guard ---

function LandingPageOrExisting() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return (
    <React.Suspense fallback={null}>
      <MockLandingPage />
    </React.Suspense>
  );
  // Authenticated — render the existing protected route content
  return (
    <ProtectedRoute>
      <OnboardingGate>
        <ReportOrDashboard />
      </OnboardingGate>
    </ProtectedRoute>
  );
}

function ReportOrDashboard() {
  const queryClient = useQueryClient();

  // Profile is needed for the parse-quality decision and the DiagnosticPage
  // greeting. isFetching is critical here — the
  // empty-profile check below must NOT fire on stale cached data while a
  // refetch is in flight, or users whose autoExtract just finished get
  // wrongly routed into the FromScratchCapture fallback.
  const { data: profile, isLoading: profileLoading, isFetching: profileFetching } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => { const { data } = await api.get('/profile'); return data; },
    staleTime: 5 * 60 * 1000,
  });

  const [stage, setStage] = useState<ReportFlowStage>(() => {
    // Email link uses ?view=report to force the report to show even for returning users.
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'report') {
      window.history.replaceState({}, '', '/');
      localStorage.removeItem('jobhub_report_seen');
      return 'dashboard';
    }
    if (localStorage.getItem('jobhub_report_seen') === 'true') return 'dashboard';
    return 'loading';
  });

  // Once profile resolves, decide between from-scratch and the diagnostic page.
  useEffect(() => {
    if (stage !== 'loading' || profileLoading || profileFetching) return;
    if (isEssentiallyEmptyProfile(profile) && !profile?.hasCompletedOnboarding) {
      setStage('from-scratch');
    } else {
      setStage('dashboard');
    }
  }, [stage, profileLoading, profileFetching, profile]);

  // Listen for "show-diagnostic" events fired by the sidebar Diagnostic link
  useEffect(() => {
    const handler = () => setStage('diagnostic');
    window.addEventListener('show-diagnostic', handler);
    return () => window.removeEventListener('show-diagnostic', handler);
  }, []);

  function markReportSeen() {
    localStorage.setItem('jobhub_report_seen', 'true');
    localStorage.setItem('jobhub_tips_seen', 'false');
  }

  function handleDiagnosticDone() {
    markReportSeen();
    setStage('dashboard');
  }

  function handleFromScratchDone() {
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    setStage('diagnostic');
  }

  const spinner = (
    <div style={{ minHeight: '100vh', background: '#FAF7F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(45,90,110,0.2)', borderTopColor: '#2D5A6E' }} />
    </div>
  );

  if (stage === 'loading') return spinner;

  if (stage === 'from-scratch') {
    return (
      <React.Suspense fallback={spinner}>
        <FromScratchCapture onDone={handleFromScratchDone} />
      </React.Suspense>
    );
  }

  if (stage === 'diagnostic') {
    return (
      <React.Suspense fallback={spinner}>
        <DiagnosticPage profile={profile} onDone={handleDiagnosticDone} />
      </React.Suspense>
    );
  }

  // stage === 'dashboard'
  return (
    <DashboardGate>
      <motion.div
        key="dashboard"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
      >
        <DashboardLayout>
          <ErrorBoundary>
            <React.Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}><div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(45,90,110,0.2)', borderTopColor: '#2D5A6E' }} /></div>}>
              <Routes>
                <Route path="/" element={<StrategyHub />} />
                <Route path="/tracker" element={<ApplicationTracker />} />
                <Route path="/apply" element={<StepperWorkspace />} />
                <Route path="/workspace" element={<Workspace />} />
                <Route path="/documents" element={<DocumentLibrary />} />
                <Route path="/email-templates" element={<EmailTemplatesLibrary />} />
                <Route path="/linkedin" element={<LinkedInPage />} />
                <Route path="/skipped" element={<SkippedJobsPage />} />
                {/* Job feed removed — app runs on pasted jobs. Stray links to /jobs land on the dashboard. */}
                <Route path="/jobs" element={<Navigate to="/" replace />} />
                <Route path="/mindset" element={<MindsetPage />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/funnel" element={<AdminFunnel />} />
                <Route path="/admin/users" element={<AdminUserUsage />} />
                <Route path="/admin/friday-brief" element={<FridayBriefPage />} />
                <Route path="/admin/contacts" element={<AdminContacts />} />
                <Route path="/admin/contacts/new" element={<AdminContactDetail />} />
                <Route path="/admin/contacts/:id" element={<AdminContactDetail />} />
                <Route path="/admin/broadcasts" element={<AdminBroadcasts />} />
                <Route path="/admin/email-analytics" element={<EmailAnalytics />} />
                <Route path="*" element={<StrategyHub />} />
              </Routes>
            </React.Suspense>
          </ErrorBoundary>
        </DashboardLayout>
      </motion.div>
    </DashboardGate>
  );
}

// --- Main App Component ---

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              {/* PAYMENTS PAUSED: pricing route hidden during pricing rework
              <Route path="/pricing" element={<PricingPage />} />
              */}
              <Route path="/legal/:policy" element={<LegalPage />} />
              <Route path="/legal" element={<LegalPage />} />
              <Route path="/visa-sponsors" element={
                <React.Suspense fallback={null}>
                  <VisaSponsorsPage />
                </React.Suspense>
              } />
              <Route path="/anim-test" element={
                <React.Suspense fallback={null}>
                  <AnimationTest />
                </React.Suspense>
              } />
              <Route path="/mock-landing" element={
                <React.Suspense fallback={null}>
                  <MockLandingPage />
                </React.Suspense>
              } />
              <Route path="/book-a-call" element={
                <React.Suspense fallback={null}>
                  <BookCallPage />
                </React.Suspense>
              } />

              {/* Public Landing — unauth sees new landing, auth preserves existing behaviour */}
              <Route path="/" element={<LandingPageOrExisting />} />

              {/* Protected Application Routes */}
              <Route path="/*" element={
                <ProtectedRoute>
                  <OnboardingGate>
                    <ReportOrDashboard />
                  </OnboardingGate>
                </ProtectedRoute>
              } />
            </Routes>
          </Router>
          <Toaster richColors position="top-right" theme="dark" />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
