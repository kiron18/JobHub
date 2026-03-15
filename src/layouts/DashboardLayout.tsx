import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Briefcase, Settings, PlusCircle, LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, signOut } = useAuth();
    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/tracker', icon: Briefcase, label: 'Applications' },
        { to: '/workspace', icon: FileText, label: 'Documents' },
        { to: '/settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <div className="flex h-screen bg-[#0d1117] text-slate-100 overflow-hidden w-screen">
            {/* Sidebar */}
            <aside className="w-64 border-r border-slate-800 flex flex-col p-6 flex-shrink-0">
                <div className="flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center font-bold text-xl shadow-lg shadow-brand-600/20">J</div>
                    <h1 className="text-2xl font-bold tracking-tight">JobReady</h1>
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
                                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                                }`
                            }
                        >
                            <item.icon size={20} />
                            <span className="font-medium">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="mt-auto space-y-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                                <User size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account</p>
                                <p className="text-sm font-medium text-slate-200 truncate">{user?.email}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => signOut()}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
                        >
                            <LogOut size={14} />
                            Sign Out
                        </button>
                    </div>

                    <button className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-brand-600 hover:bg-brand-500 rounded-2xl font-bold transition-all group shadow-lg shadow-brand-600/20 active:scale-95">
                        <PlusCircle size={20} className="group-hover:rotate-90 transition-transform" />
                        <span>New Application</span>
                    </button>
                </div>
            </aside>


            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-10 bg-[#0d1117]">
                <div className="max-w-5xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};
