import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    FileText,
    Briefcase,
    LogOut,
    Library,
    Mail,
    Linkedin,
    Sparkles,
    Menu,
    X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import api from '../lib/api';

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 240;
const INTRO_DURATION_MS = 2000;
const TOUCH_BREAKPOINT_PX = 768;

function useIsTouch(): boolean {
    const [isTouch, setIsTouch] = useState<boolean>(() =>
        typeof window === 'undefined' ? false : window.matchMedia(`(max-width: ${TOUCH_BREAKPOINT_PX}px)`).matches
    );
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia(`(max-width: ${TOUCH_BREAKPOINT_PX}px)`);
        const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);
    return isTouch;
}

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, signOut } = useAuth();
    const { T } = useAppTheme();
    const isTouch = useIsTouch();

    // Profile prefetch — used implicitly by downstream queries
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

    // Sidebar state — desktop:
    //   - introVisible: starts true, flips to false after 2s. Shows labels briefly
    //     on mount so users learn the icon set, then collapses to icons-only.
    //   - hovered: temporary expand when the user mouses over the sidebar.
    //   - expanded = introVisible || hovered
    // Touch:
    //   - drawerOpen: tap hamburger to toggle a slide-in drawer.
    const [introVisible, setIntroVisible] = useState(true);
    const [hovered, setHovered] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (isTouch) {
            setIntroVisible(false);
            return;
        }
        // Reset the intro on every mount + restart timer
        setIntroVisible(true);
        introTimerRef.current = setTimeout(() => setIntroVisible(false), INTRO_DURATION_MS);
        return () => {
            if (introTimerRef.current) clearTimeout(introTimerRef.current);
        };
    }, [isTouch]);

    // Pause the auto-collapse if user is actively hovering during the intro
    useEffect(() => {
        if (hovered && introTimerRef.current) {
            clearTimeout(introTimerRef.current);
            introTimerRef.current = null;
        }
    }, [hovered]);

    const expanded = !isTouch && (introVisible || hovered);

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/tracker', icon: Briefcase, label: 'Applications' },
        { to: '/documents', icon: Library, label: 'Documents' },
        { to: '/workspace', icon: FileText, label: 'Profile' },
        { to: '/jobs', icon: Sparkles, label: 'Job Feed' },
        { to: '/linkedin', icon: Linkedin, label: 'LinkedIn' },
        { to: '/email-templates', icon: Mail, label: 'Email Templates' },
    ];

    const sidebarContent = (showLabels: boolean) => (
        <>
            <div className="flex items-center gap-3 mb-10 px-2">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl flex-shrink-0"
                    style={{ background: '#2D5A6E', color: T.text }}
                >
                    J
                </div>
                <AnimatePresence>
                    {showLabels && (
                        <motion.h1
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15 }}
                            className="text-xl font-bold tracking-tight whitespace-nowrap"
                            style={{ color: T.text }}
                        >
                            JobReady
                        </motion.h1>
                    )}
                </AnimatePresence>
            </div>

            <nav className="flex-1 space-y-1.5">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const badge = item.to === '/tracker' && (followUpCount ?? 0) > 0
                        ? ((followUpCount ?? 0) > 9 ? '9+' : String(followUpCount))
                        : null;

                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            onClick={() => isTouch && setDrawerOpen(false)}
                            className={({ isActive }) =>
                                `relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isActive ? '' : 'hover:bg-white/[0.04]'}`
                            }
                            style={({ isActive }) => ({
                                color: isActive ? T.text : T.textMuted,
                                background: isActive ? 'rgba(45,90,110,0.18)' : 'transparent',
                                border: isActive ? '1px solid rgba(45,90,110,0.35)' : '1px solid transparent',
                            })}
                        >
                            <Icon size={18} className="flex-shrink-0" />
                            <AnimatePresence>
                                {showLabels && (
                                    <motion.span
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -8 }}
                                        transition={{ duration: 0.15 }}
                                        className="font-medium text-sm whitespace-nowrap flex-1"
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                            {badge !== null && (
                                <span
                                    className={`flex items-center justify-center text-[10px] font-black leading-none ${showLabels ? 'w-5 h-5 rounded-full' : 'absolute top-1 right-1 w-3.5 h-3.5 rounded-full'}`}
                                    style={{ background: T.accentSuccess, color: '#1A1C1E' }}
                                    aria-label={`${badge} applications need follow-up`}
                                >
                                    {showLabels ? badge : ''}
                                </span>
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            <div className="mt-auto pt-4 space-y-2">
                <AnimatePresence>
                    {showLabels && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="px-3 py-2"
                        >
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: T.textFaint }}>
                                Account
                            </p>
                            <p className="text-xs truncate" style={{ color: T.textMuted }}>{user?.email}</p>
                        </motion.div>
                    )}
                </AnimatePresence>
                <button
                    onClick={() => signOut()}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all border border-transparent hover:border-white/10 hover:bg-white/5"
                    style={{ color: T.textFaint }}
                    title="Sign Out"
                >
                    <LogOut size={14} className="flex-shrink-0" />
                    {showLabels && <span>Sign Out</span>}
                </button>
            </div>
        </>
    );

    return (
        <div
            className="flex h-screen overflow-hidden w-screen"
            style={{
                backgroundColor: T.bg,
                backgroundImage: `radial-gradient(circle, ${T.dotColor} 1px, transparent 1px)`,
                backgroundSize: '22px 22px',
                color: T.text,
            }}
        >
            {/* Desktop sidebar */}
            {!isTouch && (
                <motion.aside
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                    initial={false}
                    animate={{ width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="flex flex-col py-6 px-3 flex-shrink-0"
                    style={{
                        background: T.card,
                        borderRight: `1px solid ${T.cardBorder}`,
                    }}
                >
                    {sidebarContent(expanded)}
                </motion.aside>
            )}

            {/* Touch hamburger */}
            {isTouch && (
                <button
                    onClick={() => setDrawerOpen(true)}
                    aria-label="Open navigation"
                    className="fixed top-4 left-4 z-30 w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                        background: T.card,
                        border: `1px solid ${T.cardBorder}`,
                        color: T.text,
                    }}
                >
                    <Menu size={18} />
                </button>
            )}

            {/* Touch drawer */}
            <AnimatePresence>
                {isTouch && drawerOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-40"
                            style={{ background: 'rgba(0,0,0,0.5)' }}
                            onClick={() => setDrawerOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: -EXPANDED_WIDTH }}
                            animate={{ x: 0 }}
                            exit={{ x: -EXPANDED_WIDTH }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            className="fixed top-0 left-0 bottom-0 z-50 flex flex-col py-6 px-3"
                            style={{
                                width: EXPANDED_WIDTH,
                                background: T.card,
                                borderRight: `1px solid ${T.cardBorder}`,
                            }}
                        >
                            <button
                                onClick={() => setDrawerOpen(false)}
                                aria-label="Close navigation"
                                className="absolute top-4 right-3 w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ color: T.textMuted }}
                            >
                                <X size={16} />
                            </button>
                            {sidebarContent(true)}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto" style={{ background: 'transparent' }}>
                <div
                    className="max-w-5xl mx-auto px-6 md:px-10 pt-10 pb-6"
                    style={{ paddingTop: isTouch ? 64 : 40 }}
                >
                    {children}
                </div>

                {/* Quiet mindset link — visible on every dashboard page */}
                <div className="max-w-5xl mx-auto px-6 md:px-10 pb-12 pt-4">
                    <Link
                        to="/mindset"
                        className="inline-block text-xs transition-colors"
                        style={{ color: T.textFaint, textDecoration: 'none' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = T.textMuted)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = T.textFaint)}
                    >
                        Dealing with silence? Quick-ref mindset tips →
                    </Link>
                </div>
            </main>
        </div>
    );
};
