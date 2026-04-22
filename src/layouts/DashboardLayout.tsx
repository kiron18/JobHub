import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Briefcase, LogOut, User, Sun, Moon, Library, Mail, Linkedin, Sparkles, Radio } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { HuePicker } from '../components/HuePicker';
import api from '../lib/api';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, signOut } = useAuth();
    const { T, isDark, toggle } = useAppTheme();

    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: async () => {
            const { data } = await api.get('/profile');
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/jobs', icon: Sparkles, label: 'Job Feed' },
        { to: '/tracker', icon: Briefcase, label: 'Applications' },
        { to: '/documents', icon: Library, label: 'Documents' },
        { to: '/email-templates', icon: Mail, label: 'Email Templates' },
        { to: '/workspace', icon: FileText, label: 'Profile & Achievements' },
        ...(profile?.isAdmin ? [{ to: '/admin/friday-brief', icon: Radio, label: 'Friday Brief' }] : []),
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
                            <span className="font-medium">{item.label}</span>
                        </NavLink>
                    ))}
                    {/* LinkedIn — coming soon */}
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px', borderRadius: 12, opacity: 0.5,
                        cursor: 'not-allowed',
                      }}
                    >
                      <Linkedin size={20} color={T.textMuted} />
                      <span style={{ fontSize: 14, fontWeight: 500, color: T.textMuted, flex: 1 }}>LinkedIn</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        background: 'rgba(99,102,241,0.12)', color: '#818cf8',
                        padding: '2px 6px', borderRadius: 4,
                      }}>
                        Soon
                      </span>
                    </div>
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

                        {/* Theme toggle + Hue + Sign Out row */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggle}
                                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                                className="flex items-center justify-center rounded-lg transition-all"
                                style={{
                                    width: 36,
                                    height: 36,
                                    background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                                    color: isDark ? '#e5e7eb' : '#374151',
                                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}`,
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                }}
                            >
                                {isDark ? <Sun size={15} /> : <Moon size={15} />}
                            </button>
                            <HuePicker isDark={isDark} />
                            <button
                                onClick={() => signOut()}
                                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all border border-transparent hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-400"
                                style={{ color: T.textFaint }}
                            >
                                <LogOut size={14} />
                                Sign Out
                            </button>
                        </div>
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
