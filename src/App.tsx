import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { motion } from 'framer-motion';

// Components — layout/gate loaded eagerly, page-level components lazy
import { DashboardLayout } from './layouts/DashboardLayout';
import { OnboardingGate } from './components/OnboardingGate';
import { FirstVisitTip } from './components/FirstVisitTips';
import { ProfileGate } from './components/ProfileGate';

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

// Dashboard View component
const Dashboard = () => {
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/profile');
      return data;
    },
    refetchOnMount: true
  });

  const { data: jobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const { data } = await api.get('/jobs');
      return data;
    },
    refetchOnMount: true
  });

  const { data: countData } = useQuery({
    queryKey: ['achievements', 'count'],
    queryFn: async () => {
      const { data } = await api.get('/achievements/count');
      return data;
    },
    refetchOnMount: true
  });

  const { data: feedData } = useQuery({
    queryKey: ['job-feed', 0],
    queryFn: async () => {
      const { data } = await api.get('/job-feed/feed?offset=0');
      return data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!(profile?.dashboardAccess),
  });

  const achievementCount = countData?.count ?? profile?.achievements?.length ?? 0;

  console.log('[Dashboard] profile:', { userId: profile?.userId, hasCompleted: profile?.hasCompletedOnboarding, achievementsLength: profile?.achievements?.length });
  console.log('[Dashboard] achievementCount from /achievements/count:', countData?.count, '| fallback:', profile?.achievements?.length, '| final:', achievementCount);

  // Backfill achievement bank for users who completed onboarding before
  // auto-extraction was introduced. Runs once when count is 0 and profile exists.
  useEffect(() => {
    if (profile?.hasCompletedOnboarding && achievementCount === 0) {
      api.post('/onboarding/backfill-achievements')
        .then(({ data }) => {
          if (data.status === 'started') {
            // Poll briefly to pick up extracted achievements
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ['achievements', 'count'] });
            }, 15_000);
          }
        })
        .catch(() => {/* silent — backfill is best-effort */});
    }
  }, [profile?.hasCompletedOnboarding, achievementCount]);
  const applicationCount = jobs?.length || 0;

  const greeting = (() => {
    const h = new Date().getHours();
    const seed = new Date().toDateString().split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const morning = ['Good morning', 'Morning', 'Rise and shine'];
    const afternoon = ['Good afternoon', 'Afternoon', 'Good afternoon'];
    const evening = ['Good evening', 'Evening', 'Still at it'];
    const opts = h < 12 ? morning : h < 17 ? afternoon : evening;
    return opts[seed % opts.length];
  })();

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h2 className="text-4xl font-extrabold tracking-tight italic text-white">{greeting}, {profile?.name || 'Candidate'}</h2>
        <p className="text-xl text-slate-400 font-medium">Paste a job description. Get a matched resume in 3 minutes.</p>
      </header>

      {/* Job Feed widget */}
      {feedData?.total > 0 && (
        <NavLink
          to="/jobs"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 16,
            padding: '18px 24px',
            textDecoration: 'none',
            marginBottom: 0,
          }}
        >
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#818cf8', margin: 0 }}>
              ✦ {feedData.total} new jobs today
            </p>
            <p style={{ fontSize: 12, color: '#6366f1', margin: '2px 0 0', opacity: 0.8 }}>
              {profile?.targetRole} · {profile?.targetCity}
            </p>
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#818cf8' }}>View feed →</p>
        </NavLink>
      )}

      {/* First-visit tips */}
      <FirstVisitTip tips={[
        { id: 'achievements', text: 'All your achievements are logged here. Hit Manage to edit them.' },
        { id: 'matcher',      text: 'Paste a job description here to get matched and start applying' },
      ]} />

      {/* Pipeline at-a-glance */}
      {(() => {
        const pipeline = [
          { status: 'SAVED',     label: 'Saved',     color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)' },
          { status: 'APPLIED',   label: 'Applied',   color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)' },
          { status: 'INTERVIEW', label: 'Interview', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.2)' },
          { status: 'OFFER',     label: 'Offer',     color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.2)' },
          { status: 'REJECTED',  label: 'Rejected',  color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)' },
        ];
        const upcomingDeadlines = (jobs || []).filter((j: any) => {
          if (!j.closingDate) return false;
          const dLeft = Math.ceil((new Date(j.closingDate).getTime() - Date.now()) / 86_400_000);
          return dLeft >= 0 && dLeft <= 7;
        }).sort((a: any, b: any) => new Date(a.closingDate).getTime() - new Date(b.closingDate).getTime()).slice(0, 3);

        const totalCount = (jobs || []).length;

        return (
          <div className="space-y-4">
            {/* Pipeline stats — only shown once user has applications */}
            {totalCount > 0 && (
            <div className="grid grid-cols-5 gap-2">
              {pipeline.map(p => {
                const count = (jobs || []).filter((j: any) => j.status === p.status).length;
                return (
                  <NavLink key={p.status} to="/tracker"
                    className="p-3 flex flex-col gap-1.5 rounded-xl border border-slate-800/60 hover:border-slate-700 transition-all no-underline"
                    style={{ background: count > 0 ? p.bg : 'rgba(255,255,255,0.02)' }}
                  >
                    <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: count > 0 ? p.color : '#374151' }}>{p.label}</p>
                    <p className="text-xl font-black tabular-nums" style={{ color: count > 0 ? p.color : '#374151' }}>{count}</p>
                  </NavLink>
                );
              })}
            </div>
            )}

            {/* Upcoming deadlines */}
            {upcomingDeadlines.length > 0 && (
              <div className="glass-card p-4 border-l-4 border-l-red-500/60">
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3">Deadlines This Week</p>
                <div className="space-y-2">
                  {upcomingDeadlines.map((j: any) => {
                    const dLeft = Math.ceil((new Date(j.closingDate).getTime() - Date.now()) / 86_400_000);
                    return (
                      <NavLink key={j.id} to="/tracker" className="flex items-center justify-between gap-3 no-underline group">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-200 truncate group-hover:text-white transition-colors">{j.title}</p>
                          <p className="text-xs text-slate-500">{j.company}</p>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded border shrink-0 ${dLeft <= 1 ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
                          {dLeft === 0 ? 'Today' : dLeft === 1 ? 'Tomorrow' : `${dLeft}d`}
                        </span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <MatchEngine />
        </div>

        <div className="space-y-8">
          <div className="glass-card p-6 flex flex-col gap-3">
            <h3 className="font-bold text-slate-500 text-[10px] uppercase tracking-[0.2em]">Active Applications</h3>
            <div className="text-4xl font-black text-brand-400 tabular-nums">{applicationCount}</div>
          </div>

          <div className="glass-card p-8 border-l-4 border-l-emerald-500 space-y-4">
            <h3 className="font-bold text-slate-400 text-xs uppercase tracking-[0.2em]">Achievement Bank</h3>
            <p className="text-slate-300 leading-relaxed font-medium">
              You have <span className="text-emerald-400 font-black text-lg">{achievementCount}</span> saved achievements.
              {achievementCount === 0 ? " Import your resume to build your database." : " Ready for semantic matching."}
            </p>
            <NavLink to="/workspace" className="inline-flex items-center gap-2 font-bold text-brand-500 hover:text-brand-400 transition-colors uppercase text-xs tracking-[0.2em]">
              Manage Bank →
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
};

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
              <React.Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" /></div>}>
                <Routes>
                  <Route path="/" element={<ProfileGate><Dashboard /></ProfileGate>} />
                  <Route path="/tracker" element={<ApplicationTracker />} />
                  <Route path="/application-workspace" element={<ProfileGate><ApplicationWorkspace /></ProfileGate>} />
                  <Route path="/workspace" element={<Workspace />} />
                  <Route path="/documents" element={<DocumentLibrary />} />
                  <Route path="/email-templates" element={<EmailTemplatesLibrary />} />
                  <Route path="/linkedin" element={<LinkedInPage />} />
                  <Route path="/jobs" element={<ProfileGate><JobFeedPage /></ProfileGate>} />
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/friday-brief" element={<FridayBriefPage />} />
                  <Route path="*" element={<Dashboard />} />
                </Routes>
              </React.Suspense>
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
