import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ChevronDown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Components
import { DashboardLayout } from './layouts/DashboardLayout';
import { ResumeImporter } from './components/ResumeImporter';
import { MatchEngine } from './components/MatchEngine';
import { ProfileModal } from './components/ProfileModal';
import { ApplicationWorkspace } from './components/ApplicationWorkspace';
import { ApplicationTracker } from './components/ApplicationTracker';
import { AchievementBank } from './components/AchievementBank';
import { OnboardingGate } from './components/OnboardingGate';
import { ReportExperience } from './components/ReportExperience';
import { FirstVisitTip } from './components/FirstVisitTips';

// Auth & Context
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthPage } from './pages/AuthPage';

// Lib
import api from './lib/api';

const queryClient = new QueryClient();

// --- Sub-components (could be moved to separate files later) ---

// Dashboard View component
const Dashboard = () => {
  const [showReport, setShowReport] = useState(false);
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

  const achievementCount = countData?.count ?? profile?.achievements?.length ?? 0;

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

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h2 className="text-4xl font-extrabold tracking-tight italic text-white">{(() => { const h = new Date().getHours(); return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'; })()}, {profile?.name || 'Candidate'}</h2>
        <p className="text-xl text-slate-400 font-medium">Here's your job application intelligence overview.</p>
      </header>

      {/* Collapsed report summary card */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '18px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', margin: 0 }}>Your Diagnosis</p>
          <p style={{ fontSize: 12, color: '#4b5563', margin: '2px 0 0' }}>
            {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => setShowReport(true)}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 700,
            color: '#d1d5db',
            cursor: 'pointer',
          }}
        >
          View again
        </button>
      </div>

      {/* First-visit tips */}
      <FirstVisitTip tips={[
        { id: 'achievements', text: 'All your achievements are logged here. Hit Manage to edit them.' },
        { id: 'matcher',      text: 'Paste a job description here to get matched and start applying' },
      ]} />

      {/* Return-visit report overlay */}
      {showReport && (
        <>
          <button
            onClick={() => setShowReport(false)}
            style={{
              position: 'fixed', top: 16, right: 20, zIndex: 52,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 99, padding: '8px 16px',
              fontSize: 13, fontWeight: 700, color: '#d1d5db', cursor: 'pointer',
            }}
          >
            ← Back to dashboard
          </button>
          <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
            <ReportExperience onDone={() => setShowReport(false)} />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <MatchEngine />
        </div>

        <div className="space-y-8">
          <div className="glass-card p-8 flex flex-col justify-between h-56 relative overflow-hidden group border-b-4 border-b-brand-600">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-600/10 blur-3xl -mr-16 -mt-16 group-hover:bg-brand-600/20 transition-all"></div>
            <h3 className="font-bold text-slate-400 text-xs uppercase tracking-[0.2em]">Active Applications</h3>
            <div className="text-7xl font-black text-brand-400 tabular-nums">{applicationCount}</div>
            <p className="text-xs text-slate-500 font-bold tracking-wider">SYNCED WITH DATABASE</p>
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

// Workspace Component
const Workspace = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [coachDismissed, setCoachDismissed] = useState(
    () => localStorage.getItem('jobhub_coach_dismissed') === 'true'
  );

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => { const { data } = await api.get('/profile'); return data; },
    staleTime: 5 * 60 * 1000,
  });

  const { data: countData } = useQuery({
    queryKey: ['achievements', 'count'],
    queryFn: async () => { const { data } = await api.get('/achievements/count'); return data; },
    refetchOnMount: true,
    // Poll every 8s while bank is empty (picks up async auto-extract completing)
    refetchInterval: (query) => (query.state.data?.count ?? 0) === 0 ? 8000 : false,
  });

  const achievementCount: number = countData?.count ?? 0;

  // Macro coaching: derive from profile data
  const blocker = profile?.perceivedBlocker ?? '';
  const macroHint = (() => {
    if (achievementCount === 0) return null;
    if (blocker.toLowerCase().includes('cv') || blocker.toLowerCase().includes('resume')) {
      return 'Your resume is identified as a key blocker. Review each achievement below and ensure every one has a specific metric — a %, $, or number. That is what makes the difference at shortlisting.';
    }
    if (blocker.toLowerCase().includes('interview')) {
      return 'You are getting to interview but stalling. Your achievements need stronger "so what" framing. Each entry should answer: what was the business impact, not just what you did.';
    }
    if (achievementCount < 5) {
      return 'You have fewer than 5 achievements in your bank. The more concrete evidence you have, the stronger every document we write for you. Add more by uploading a detailed resume below.';
    }
    return `You have ${achievementCount} achievements ready. Before applying to any role, review each one: does it have a number? Does it say what changed because of you? Strengthen the weakest ones first.`;
  })();

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="space-y-2">
        <h2 className="text-4xl font-extrabold tracking-tight italic" style={{ color: 'inherit' }}>Achievement Bank</h2>
        <p className="text-lg font-medium" style={{ color: '#9ca3af' }}>
          Your career evidence — the raw material for every document we write.
        </p>
      </header>

      {/* Macro coaching card */}
      <AnimatePresence>
        {macroHint && !coachDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              position: 'relative',
              borderRadius: 14,
              padding: '18px 20px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))',
              border: '1px solid rgba(99,102,241,0.25)',
            }}
          >
            <button
              onClick={() => { localStorage.setItem('jobhub_coach_dismissed', 'true'); setCoachDismissed(true); }}
              style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
            >
              <X size={14} />
            </button>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Strategy advice</p>
            <p style={{ fontSize: 14, color: '#c7d2fe', lineHeight: 1.65, paddingRight: 20 }}>{macroHint}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extracting achievements loading state */}
      <AnimatePresence>
        {achievementCount === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 18px', borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div style={{ width: 16, height: 16, border: '2px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              Extracting your achievements from your resume. This takes about 30 seconds.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Achievement bank — main column */}
        <div className="lg:col-span-2">
          <AchievementBank />
        </div>

        {/* Sidebar: add more resume data */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
              Add more experience
            </p>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16, lineHeight: 1.6 }}>
              Upload an updated resume or paste experience manually to grow your bank.
            </p>
            <ResumeImporter />
          </div>
          <button
            onClick={() => setIsProfileOpen(true)}
            className="w-full px-4 py-3 bg-brand-600/10 text-brand-400 border border-brand-600/20 rounded-xl text-xs font-black uppercase tracking-[0.15em] hover:bg-brand-600/20 transition-all cursor-pointer"
          >
            Edit Profile Details
          </button>
        </div>
      </div>

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
};

// Protected Route Guard
// - Returning users (have jobhub_auth_email in localStorage) → redirect to /auth to log in
// - New visitors (no stored email) → create anonymous session and start onboarding
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (loading || user) return;
    if (signingIn) return;

    const savedEmail = localStorage.getItem('jobhub_auth_email');
    if (savedEmail) {
      // Returning user — send to auth page with email pre-filled
      navigate(`/auth?email=${encodeURIComponent(savedEmail)}`, { replace: true });
    } else {
      // New visitor — create anonymous session
      setSigningIn(true);
      supabase.auth.signInAnonymously().finally(() => setSigningIn(false));
    }
  }, [loading, user]);

  if (loading || signingIn || !user) {
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

// --- Report or Dashboard wrapper (first visit shows full-screen report) ---

function ReportOrDashboard() {
  const navigate = useNavigate();
  const [reportSeen, setReportSeen] = useState(
    () => localStorage.getItem('jobhub_report_seen') === 'true'
  );

  function handleDone() {
    localStorage.setItem('jobhub_report_seen', 'true');
    localStorage.setItem('jobhub_tips_seen', 'false');
    setReportSeen(true);
    // First-time users go straight to achievement bank to review and improve their profile
    navigate('/workspace', { replace: true });
  }

  if (!reportSeen) {
    return <ReportExperience onDone={handleDone} />;
  }

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0, 0, 1] }}
    >
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tracker" element={<ApplicationTracker />} />
          <Route path="/application-workspace" element={<ApplicationWorkspace />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </DashboardLayout>
    </motion.div>
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
              {/* Public/Auth Routes */}
              <Route path="/auth" element={<AuthPage />} />

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
