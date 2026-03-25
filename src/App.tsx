import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
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

// Auth & Context
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthPage } from './pages/AuthPage';

// Lib
import api from './lib/api';

const queryClient = new QueryClient();

// --- Sub-components (could be moved to separate files later) ---

// Dashboard View component
const Dashboard = () => {
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
  const applicationCount = jobs?.length || 0;

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h2 className="text-4xl font-extrabold tracking-tight italic text-white">{(() => { const h = new Date().getHours(); return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'; })()}, {profile?.name || 'Candidate'}</h2>
        <p className="text-xl text-slate-400 font-medium">Here's your job application intelligence overview.</p>
      </header>

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
  const [isBannerDismissed, setIsBannerDismissed] = useState(
    () => localStorage.getItem('jobhub_onboarding_dismissed') === 'true'
  );

  const { data: countData } = useQuery({
    queryKey: ['achievements', 'count'],
    queryFn: async () => {
      const { data } = await api.get('/achievements/count');
      return data;
    },
    refetchOnMount: true
  });

  const achievementCount: number = countData?.count ?? 0;
  const showBanner = !isBannerDismissed && achievementCount === 0;

  const dismissBanner = () => {
    localStorage.setItem('jobhub_onboarding_dismissed', 'true');
    setIsBannerDismissed(true);
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
             {/* Alpha V2 removed */}
          </div>
          <button
            id="achievements-pill-btn"
            onClick={() => setIsProfileOpen(true)}
            className="px-5 py-2 bg-brand-600/10 text-brand-400 border border-brand-600/20 rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:bg-brand-600/20 transition-all cursor-pointer shadow-lg shadow-brand-600/5 active:scale-95"
          >
            Achievements
          </button>
        </div>
        <h2 className="text-5xl font-black tracking-tighter text-white">Profile Workspace</h2>
        <p className="text-xl text-slate-400 font-medium max-w-2xl">
          Build your career profile through intelligent extraction and achievement management.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence>
            {showBanner && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="relative rounded-xl p-6 bg-gradient-to-br from-indigo-950/60 to-purple-950/60 border border-indigo-800/30"
                role="banner"
                aria-label="Onboarding welcome message"
              >
                <button
                  onClick={dismissBanner}
                  aria-label="Dismiss welcome banner"
                  className="absolute top-4 right-4 p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
                <div className="space-y-2 pr-8">
                  <h3 className="text-xl font-black text-white tracking-tight">
                    Let's build your career story
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed max-w-lg">
                    Upload your resume and our AI will find the achievements hidden in your experience.
                    The more detail you give us, the more powerfully we can write for you.
                  </p>
                </div>
                <div className="mt-5 flex justify-center">
                  <motion.div
                    animate={{ y: [0, 6, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    aria-hidden="true"
                  >
                    <ChevronDown size={22} className="text-indigo-400/70" />
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <ResumeImporter />
        </div>
        <div className="glass-card p-6">
          <AchievementBank />
        </div>
      </div>

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
};

// Protected Route Guard
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400 font-medium animate-pulse">Initializing JobHub...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <AuthPage />;
  }
  
  return <>{children}</>;
};

// --- Main App Component ---

function App() {
  return (
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
                  <DashboardLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/tracker" element={<ApplicationTracker />} />
                      <Route path="/application-workspace" element={<ApplicationWorkspace />} />
                      <Route path="/workspace" element={<Workspace />} />
                      {/* Fallback to dashboard */}
                      <Route path="*" element={<Dashboard />} />
                    </Routes>
                  </DashboardLayout>
                </OnboardingGate>
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
        <Toaster richColors position="top-right" theme="dark" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
