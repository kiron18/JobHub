import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Briefcase, LogOut, User, Library, Mail, Linkedin, Sparkles, PenLine } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import api from '../lib/api';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, signOut } = useAuth();
    const { T, isDark } = useAppTheme();

    useQuery({
        queryKey: ['profile'],
        queryFn: async () => {
            const { data } = await api.get('/profile');
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: followUpCount } = useQuery({
        queryKey: ['follow-up-count'],
        queryFn: async () => {
            const { data } = await api.get('/jobs');
            const now = Date.now();
            return (data as any[]).filter(j => {
                if (j.status !== 'APPLIED' || !j.dateApplied) return false;
                const days = Math.floor((now - new Date(j.dateApplied).getTime()) / (1000 * 60 * 60 * 24));
                return days >= 7;
            }).length;
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
    });

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/jobs', icon: Sparkles, label: 'Job Feed' },
        { to: '/tracker', icon: Briefcase, label: 'Applications' },
        { to: '/application-workspace', icon: PenLine, label: 'Workspace' },
        { to: '/documents', icon: Library, label: 'Documents' },
        { to: '/email-templates', icon: Mail, label: 'Email Templates' },
        { to: '/workspace', icon: FileText, label: 'Profile & Achievements' },
        { to: '/linkedin', icon: Linkedin, label: 'LinkedIn' },
        // Friday Brief not in nav — access directly at /admin/friday-brief
    ];

    return (
        <div
            className="flex h-screen overflow-hidden w-screen"
            style={{
                backgroundColor: T.bg,
                backgroundImage: `radial-gradient(circle, ${T.dotColor} 1px, transparent 1px)`,
                backgroundSize: '22px 22px',
                transition: 'background-color 0.4s',
                color: T.text,
            }}
        >
            {/* Sidebar */}
            <aside
                className="w-64 flex flex-col p-6 flex-shrink-0"
                style={{
                    background: T.card,
                    borderRight: `1px solid ${T.cardBorder}`,
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    transition: 'background 0.4s, border-color 0.4s',
                }}
            >
                <div className="flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center font-bold text-xl shadow-lg shadow-brand-600/20 text-white">J</div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{ color: T.text }}>JobReady</h1>
                </div>

                <nav className="flex-1 space-y-2">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                                    ? 'bg-brand-600/10 text-brand-400 border border-brand-600/20'
                                    : 'hover:bg-white/5'
                                }`
                            }
                            style={({ isActive }) => isActive ? {} : { color: T.textMuted }}
                        >
                            <item.icon size={20} />
                            <span className="font-medium flex-1">{item.label}</span>
                            {item.to === '/tracker' && (followUpCount ?? 0) > 0 && (
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-[10px] font-black text-black leading-none">
                                    {(followUpCount ?? 0) > 9 ? '9+' : followUpCount}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                <div className="mt-auto space-y-3">
                    <div
                        className="p-4 rounded-2xl space-y-3"
                        style={{
                            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                            border: `1px solid ${T.cardBorder}`,
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', color: T.textMuted }}
                            >
                                <User size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Account</p>
                                <p className="text-sm font-medium truncate" style={{ color: T.textMuted }}>{user?.email}</p>
                            </div>
                        </div>

                        {/* Sign Out — theme toggle and hue picker hidden until Strategy Hub redesign settles */}
                        <button
                            onClick={() => signOut()}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all border border-transparent hover:border-white/10 hover:bg-white/5"
                            style={{ color: T.textFaint }}
                        >
                            <LogOut size={14} />
                            Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main
                className="flex-1 overflow-y-auto"
                style={{ background: 'transparent' }}
            >
                <div className="max-w-5xl mx-auto px-10 pt-10 pb-20">
                    {children}
                </div>
            </main>
        </div>
    );
};
