import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { motion } from 'framer-motion';

// Components — layout/gate loaded eagerly, page-level components lazy
import { DashboardLayout } from './layouts/DashboardLayout';
import { OnboardingGate } from './components/OnboardingGate';
import { FirstVisitTip } from './components/FirstVisitTips';

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

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h2 className="text-4xl font-extrabold tracking-tight italic text-white">{(() => { const h = new Date().getHours(); return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'; })()}, {profile?.name || 'Candidate'}</h2>
        <p className="text-xl text-slate-400 font-medium">Here's your job application intelligence overview.</p>
      </header>

      {/* Collapsed report summary card */}
      <div style={{
        background: 'rgba(252,211,77,0.05)',
        border: '1px solid rgba(252,211,77,0.15)',
        borderRadius: 16,
        padding: '18px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#d97706', margin: 0 }}>Your Diagnosis</p>
          <p style={{ fontSize: 12, color: '#92400e', margin: '2px 0 0' }}>
            {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => setShowReport(true)}
          style={{
            background: 'rgba(252,211,77,0.12)',
            border: '1px solid rgba(252,211,77,0.3)',
            borderRadius: 10,
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 700,
            color: '#92400e',
            cursor: 'pointer',
          }}
        >
          View report →
        </button>
      </div>

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

      {/* Return-visit report overlay */}
      {showReport && (
        <>
          <button
            onClick={() => setShowReport(false)}
            style={{
              position: 'fixed', top: 16, left: 20, zIndex: 52,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 99, padding: '8px 16px',
              fontSize: 13, fontWeight: 700, color: '#d1d5db', cursor: 'pointer',
            }}
          >
            ← Back to dashboard
          </button>
          <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
            <React.Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" /></div>}>
              <ReportExperience onDone={() => setShowReport(false)} />
            </React.Suspense>
          </div>
        </>
      )}

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

        return (
          <div className="space-y-4">
            {/* Pipeline stats */}
            <div className="grid grid-cols-5 gap-3">
              {pipeline.map(p => {
                const count = (jobs || []).filter((j: any) => j.status === p.status).length;
                return (
                  <NavLink key={p.status} to="/tracker"
                    className="glass-card p-4 flex flex-col gap-2 hover:border-slate-700 transition-all no-underline"
                    style={{ borderColor: count > 0 ? p.border : undefined }}
                  >
                    <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: p.color }}>{p.label}</p>
                    <p className="text-3xl font-black tabular-nums" style={{ color: count > 0 ? p.color : '#374151' }}>{count}</p>
                  </NavLink>
                );
              })}
            </div>

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

// Workspace Component — now hosts ProfileBank
const Workspace = () => {
  return <ProfileBank />;
};

// Protected Route Guard
// - Returning users (have jobhub_auth_email in localStorage) → redirect to /auth to log in
// - New visitors (no stored email) → create anonymous session and start onboarding
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signingIn, setSigningIn] = useState(false);
  const prevUserIdRef = useRef<string | null>(null);

  // When the Supabase userId changes (magic-link login → new session), the old
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

  useEffect(() => {
    if (loading || user) return;
    if (signingIn) return;

    // If this page load is an OAuth callback, Supabase is still processing
    // the session from the URL hash/code — don't race it with signInAnonymously.
    // onAuthStateChange will fire shortly and set user, which re-runs this effect.
    const isOAuthCallback =
      window.location.hash.includes('access_token') ||
      window.location.hash.includes('error_description') ||
      window.location.search.includes('code=') ||
      window.location.search.includes('error=');
    if (isOAuthCallback) return;

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

// --- Dashboard access gate — shown when user hasn't paid for Premium ---

function DashboardGate({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/profile');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { signOut } = useAuth();
  const [requestState, setRequestState] = useState<'idle' | 'form' | 'submitting' | 'done'>('idle');
  const [skoolEmail, setSkoolEmail] = useState('');
  const [alreadyRequested, setAlreadyRequested] = useState(false);

  useEffect(() => {
    if (profile?.dashboardAccessRequested) setAlreadyRequested(true);
  }, [profile?.dashboardAccessRequested]);

  async function handleRequest() {
    setRequestState('submitting');
    try {
      await api.post('/webhooks/request-access', { skoolEmail: skoolEmail.trim() || undefined });
      setRequestState('done');
    } catch {
      setRequestState('form');
    }
  }

  if (isLoading) return null;
  if (profile?.dashboardAccess) return <>{children}</>;

  const TOOLS = [
    { icon: '🎯', label: 'Job Match Analyser', desc: 'Score any job against your profile and get ranked achievements in seconds' },
    { icon: '✉️', label: 'Cover Letter Generator', desc: 'Personalised cover letters written for the specific company and role' },
    { icon: '📊', label: 'Application Tracker', desc: 'Track every application, interview, and offer in one place' },
    { icon: '🧠', label: 'Achievement Bank', desc: 'Your experience organised for instant retrieval and tailoring' },
    { icon: '💼', label: 'Resume Versions', desc: 'Store and switch between targeted resume versions' },
    { icon: '📧', label: 'Email Templates', desc: 'Follow-up and networking templates that don\'t sound like templates' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, overflowY: 'auto',
      background: 'linear-gradient(160deg, #060b14 0%, #0a1628 50%, #060b14 100%)',
      padding: '48px 24px 80px',
    }}>
      {/* Sign-out escape hatch */}
      <button
        onClick={() => signOut()}
        style={{
          position: 'absolute', top: 20, right: 24,
          background: 'none', border: '1px solid rgba(255,255,255,0.10)',
          color: '#6b7280', borderRadius: 10, padding: '8px 14px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Sign out
      </button>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#4b5563', marginBottom: 16 }}>
              Aussie Grad Careers — Premium
            </p>
            <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 900, color: '#f3f4f6', lineHeight: 1.15, marginBottom: 16, letterSpacing: '-0.025em' }}>
              Your diagnosis is done.<br />
              <span style={{ color: '#FCD34D' }}>Now let's fix it.</span>
            </h1>
            <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.7, maxWidth: 480, margin: '0 auto' }}>
              The tools below turn your diagnosis into action. Every application, cover letter, and follow-up — built around your specific profile.
            </p>
          </div>

          {/* Locked tools grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 32 }}>
            {TOOLS.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.05 }}
                style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: '16px',
                  filter: 'grayscale(0.3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>{t.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>{t.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#374151', fontWeight: 700, background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '2px 6px' }}>locked</span>
                </div>
                <p style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.5, margin: 0 }}>{t.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* CTA card */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, padding: '32px',
          }}>
            {requestState === 'done' || alreadyRequested ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 22, fontWeight: 900, color: '#f3f4f6', marginBottom: 8 }}>Request received.</p>
                <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>
                  We'll verify your Premium membership and approve your access — usually within a few hours. You'll be able to log back in and access everything once it's confirmed.
                </p>
              </div>
            ) : requestState === 'form' ? (
              <div>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#f3f4f6', marginBottom: 6 }}>Confirm your membership</p>
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>
                  Enter the email you used to join Skool Premium below. We'll verify it and approve your access manually — usually within a few hours.
                </p>
                <input
                  type="email"
                  value={skoolEmail}
                  onChange={e => setSkoolEmail(e.target.value)}
                  placeholder="Skool email (leave blank if same as this account)"
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12, color: '#f3f4f6', fontSize: 14, padding: '13px 16px',
                    outline: 'none', marginBottom: 16, boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={handleRequest}
                  style={{
                    width: '100%', background: 'linear-gradient(135deg, #0F766E, #134E4A)',
                    color: 'white', border: 'none', borderRadius: 12, padding: '14px',
                    fontSize: 15, fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(15,118,110,0.25)',
                  }}
                >
                  Submit request →
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #0F766E22, #13224422)',
                    border: '1px solid rgba(45,212,191,0.2)',
                    borderRadius: 12, padding: '10px 14px', flex: 1,
                  }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#99F6E4' }}>Premium</p>
                    <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 900, color: 'white' }}>$67<span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>/month</span></p>
                  </div>
                  <div style={{ color: '#374151', fontWeight: 700, fontSize: 12 }}>or</div>
                  <div style={{
                    background: 'linear-gradient(135deg, #0F766E22, #13224422)',
                    border: '1px solid rgba(45,212,191,0.2)',
                    borderRadius: 12, padding: '10px 14px', flex: 1,
                  }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#99F6E4' }}>Annual</p>
                    <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 900, color: 'white' }}>$497<span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>/year</span></p>
                  </div>
                </div>
                <a
                  href="https://www.skool.com/aussiegradcareers/about"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block', textAlign: 'center', textDecoration: 'none',
                    background: 'linear-gradient(135deg, #0F766E, #134E4A)',
                    color: 'white', borderRadius: 14, padding: '15px',
                    fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
                    boxShadow: '0 6px 24px rgba(15,118,110,0.30)', marginBottom: 12,
                  }}
                >
                  Join Premium on Skool →
                </a>
                <button
                  onClick={() => setRequestState('form')}
                  style={{
                    width: '100%', background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#6b7280', borderRadius: 12, padding: '12px',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Already a Premium member? Request access
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// --- Report or Dashboard wrapper (first visit shows full-screen report) ---

function ReportOrDashboard() {
  const navigate = useNavigate();
  const [reportSeen, setReportSeen] = useState(
    () => localStorage.getItem('jobhub_report_seen') === 'true'
  );

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
        <React.Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" /></div>}>
          <ReportExperience onDone={handleDone} />
        </React.Suspense>
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
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/tracker" element={<ApplicationTracker />} />
                  <Route path="/application-workspace" element={<ApplicationWorkspace />} />
                  <Route path="/workspace" element={<Workspace />} />
                  <Route path="/documents" element={<DocumentLibrary />} />
                  <Route path="/email-templates" element={<EmailTemplatesLibrary />} />
                  <Route path="/linkedin" element={<LinkedInPage />} />
                  <Route path="/jobs" element={<JobFeedPage />} />
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
