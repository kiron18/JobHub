import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { motion } from 'framer-motion';

// Components — layout/gate loaded eagerly, page-level components lazy
import { DashboardLayout } from './layouts/DashboardLayout';
import { OnboardingGate } from './components/OnboardingGate';
import { ProfileGate } from './components/ProfileGate';
import { ErrorBoundary } from './components/ErrorBoundary';

const MatchEngine          = React.lazy(() => import('./components/MatchEngine').then(m => ({ default: m.MatchEngine })));
const ApplicationWorkspace = React.lazy(() => import('./components/ApplicationWorkspace').then(m => ({ default: m.ApplicationWorkspace })));
const ApplicationTracker   = React.lazy(() => import('./components/ApplicationTracker').then(m => ({ default: m.ApplicationTracker })));
const ProfileBank          = React.lazy(() => import('./components/ProfileBank').then(m => ({ default: m.ProfileBank })));
const DocumentLibrary      = React.lazy(() => import('./components/DocumentLibrary').then(m => ({ default: m.DocumentLibrary })));
const EmailTemplatesLibrary = React.lazy(() => import('./components/EmailTemplatesLibrary').then(m => ({ default: m.EmailTemplatesLibrary })));
const LinkedInPage         = React.lazy(() => import('./pages/LinkedInPage').then(m => ({ default: m.LinkedInPage })));
const ReportExperience     = React.lazy(() => import('./components/ReportExperience').then(m => ({ default: m.ReportExperience })));
const JobFeedPage = React.lazy(() =>
  import('./pages/JobFeedPage').then(m => ({ default: m.JobFeedPage }))
);
const FridayBriefPage = React.lazy(() =>
  import('./pages/FridayBriefPage').then(m => ({ default: m.FridayBriefPage }))
);
const AdminDashboard = React.lazy(() =>
  import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard }))
);
const SetupWizard = React.lazy(() =>
  import('./pages/SetupWizard').then(m => ({ default: m.SetupWizard }))
);
const MindsetPage = React.lazy(() =>
  import('./pages/MindsetPage').then(m => ({ default: m.MindsetPage }))
);
const StrategyHub = React.lazy(() =>
  import('./pages/StrategyHub').then(m => ({ default: m.StrategyHub }))
);

// Auth & Context
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthPage } from './pages/AuthPage';
import { AuthCallback } from './components/AuthCallback';
import { PricingPage } from './pages/PricingPage';
import { LegalPage } from './pages/LegalPage';

// Lib
import api from './lib/api';

const queryClient = new QueryClient();

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
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400 font-medium animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// --- Dashboard access gate ---

import { UpgradeModal, type UpgradeTrigger } from './components/UpgradeModal';

// Global event bus for triggering the upgrade modal from anywhere in the app
export function showUpgradeModal(trigger: UpgradeTrigger) {
  window.dispatchEvent(new CustomEvent('show-upgrade', { detail: trigger }));
}

function FreeBanner({ profile }: { profile: any }) {
  const navigate = useNavigate();
  const genLeft = Math.max(0, 5 - (profile?.freeGenerationsUsed ?? 0));
  const anaLeft = Math.max(0, 5 - (profile?.freeAnalysesUsed ?? 0));
  const allGone = genLeft === 0 && anaLeft === 0;

  return (
    <div style={{
      background: allGone
        ? 'linear-gradient(90deg, rgba(220,38,38,0.12), rgba(220,38,38,0.06))'
        : 'linear-gradient(90deg, rgba(15,118,110,0.10), rgba(15,118,110,0.04))',
      borderBottom: `1px solid ${allGone ? 'rgba(220,38,38,0.2)' : 'rgba(15,118,110,0.15)'}`,
      padding: '9px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap' as const,
    }}>
      <p style={{ margin: 0, fontSize: 12, color: allGone ? '#fca5a5' : '#6ee7b7', fontWeight: 600 }}>
        Free tier — {genLeft} document {genLeft === 1 ? 'generation' : 'generations'} · {anaLeft} {anaLeft === 1 ? 'analysis' : 'analyses'} remaining
      </p>
      <button
        onClick={() => navigate('/pricing')}
        style={{
          background: 'linear-gradient(135deg, #0F766E, #134E4A)',
          color: 'white', border: 'none', borderRadius: 8,
          padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
          whiteSpace: 'nowrap' as const,
        }}
      >
        View plans →
      </button>
    </div>
  );
}

function PastDueBanner() {
  const [loading, setLoading] = React.useState(false);
  async function handlePortal() {
    setLoading(true);
    try {
      const { data } = await api.post('/stripe/portal');
      window.location.href = data.url;
    } catch { setLoading(false); }
  }
  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(220,38,38,0.12), rgba(220,38,38,0.06))',
      borderBottom: '1px solid rgba(220,38,38,0.2)',
      padding: '9px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <p style={{ margin: 0, fontSize: 12, color: '#fca5a5', fontWeight: 600 }}>
        Your last payment failed — update your card to keep access.
      </p>
      <button
        onClick={handlePortal}
        disabled={loading}
        style={{
          background: '#dc2626', color: 'white', border: 'none',
          borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {loading ? '...' : 'Update payment →'}
      </button>
    </div>
  );
}

function TrialBanner({ trialEndDate }: { trialEndDate: string }) {
  const end = new Date(trialEndDate);
  const daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(15,118,110,0.10), rgba(15,118,110,0.04))',
      borderBottom: '1px solid rgba(15,118,110,0.15)',
      padding: '9px 20px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <p style={{ margin: 0, fontSize: 12, color: '#6ee7b7', fontWeight: 600 }}>
        Free trial — {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining` : 'ends today'}. Your card will be charged after the trial.
      </p>
    </div>
  );
}

function DashboardGate({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => { const { data } = await api.get('/profile'); return data; },
    staleTime: 5 * 60 * 1000,
  });

  const [upgradeTrigger, setUpgradeTrigger] = useState<UpgradeTrigger | null>(null);

  // Listen for upgrade events from any component
  useEffect(() => {
    const handler = (e: Event) => setUpgradeTrigger((e as CustomEvent).detail as UpgradeTrigger);
    window.addEventListener('show-upgrade', handler);
    return () => window.removeEventListener('show-upgrade', handler);
  }, []);

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

  const plan: string = profile?.plan ?? 'free';
  const planStatus: string = profile?.planStatus ?? 'active';
  const isPastDue = planStatus === 'past_due';
  const isTrialing = planStatus === 'trialing';
  const isFree = plan === 'free';

  return (
    <>
      {upgradeTrigger && (
        <UpgradeModal
          trigger={upgradeTrigger}
          onClose={() => setUpgradeTrigger(null)}
        />
      )}
      {isPastDue && <PastDueBanner />}
      {isTrialing && profile?.trialEndDate && <TrialBanner trialEndDate={profile.trialEndDate} />}
      {isFree && !isPastDue && <FreeBanner profile={profile} />}
      {children}
    </>
  );
}

// --- Report or Dashboard wrapper (first visit shows full-screen report) ---

function ReportOrDashboard() {
  const navigate = useNavigate();
  const [reportSeen, setReportSeen] = useState(() => {
    // Email link uses ?view=report to force the report to show even for returning users
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'report') {
      window.history.replaceState({}, '', '/');
      localStorage.removeItem('jobhub_report_seen');
      return false;
    }
    return localStorage.getItem('jobhub_report_seen') === 'true';
  });
  function handleDone() {
    console.log('[ReportOrDashboard] handleDone — marking report seen, navigating to /workspace');
    localStorage.setItem('jobhub_report_seen', 'true');
    localStorage.setItem('jobhub_tips_seen', 'false');
    setReportSeen(true);
    navigate('/workspace', { replace: true });
  }

  console.log('[ReportOrDashboard] render — reportSeen:', reportSeen);

  return (
    <>
      {!reportSeen ? (
        <>
          <React.Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" /></div>}>
            <ReportExperience onDone={handleDone} />
          </React.Suspense>
        </>
      ) : (
        <DashboardGate>
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
          >
            <DashboardLayout>
              <ErrorBoundary>
              <React.Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" /></div>}>
                <Routes>
                  <Route path="/" element={<StrategyHub />} />
                  <Route path="/tracker" element={<ApplicationTracker />} />
                  <Route path="/application-workspace" element={<ApplicationWorkspace />} />
                  <Route path="/workspace" element={<Workspace />} />
                  <Route path="/documents" element={<DocumentLibrary />} />
                  <Route path="/email-templates" element={<EmailTemplatesLibrary />} />
                  <Route path="/linkedin" element={<LinkedInPage />} />
                  <Route path="/jobs" element={<JobFeedPage />} />
                  <Route path="/mindset" element={<MindsetPage />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/friday-brief" element={<FridayBriefPage />} />
                  <Route path="*" element={<StrategyHub />} />
                </Routes>
              </React.Suspense>
              </ErrorBoundary>
            </DashboardLayout>
          </motion.div>
        </DashboardGate>
      )}
    </>
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
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/legal/:policy" element={<LegalPage />} />
              <Route path="/legal" element={<LegalPage />} />

              {/* Setup wizard — full-screen, authenticated, no sidebar */}
              <Route path="/setup" element={
                <ProtectedRoute>
                  <React.Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" /></div>}>
                    <SetupWizard />
                  </React.Suspense>
                </ProtectedRoute>
              } />

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
