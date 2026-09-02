import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    FileText,
    Briefcase,
    LogOut,
    Menu,
    X,
    Plus,
    Trophy,
    BookOpen,
    MessagesSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 240;
const INTRO_DURATION_MS = 2000;
const TOUCH_BREAKPOINT_PX = 768;

// Warm theme override — matches landing palette. ThemeContext preserved per spec §7.4.
const warmT = {
  bg: warm.colors.bgCanvas,
  dotColor: warm.colors.borderWhisper,
  text: warm.colors.textPrimary,
  textMuted: warm.colors.textSecondary,
  textFaint: warm.colors.textMuted,
  card: warm.colors.bgSurface,
  cardBorder: warm.colors.borderWhisper,
  cardShadow: warm.shadow.soft,
  accentSuccess: warm.colors.success,
};

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
    const isTouch = useIsTouch();
    const location = useLocation();

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

    /*
      Seven.

      Two verbs, then your own data, then the two things you look at rather
      than work in. There is no dashboard item because there was never a
      dashboard: /check calls itself "the one door: every application starts
      here", and the paste box on / ends every path in navigate('/check'), so
      New application IS home.

      Gone from here, deliberately:
        Networking      was the LinkedIn page under another name, and the only
                        thing anybody went there for is now its own entry.
        Your documents  documents live inside the job they were written for.
        Answer bank     hidden, not deleted. The route and the data stay, and
                        interviewPrepContext.ts still reads the bank to build
                        interview prep, so removing it would quietly make prep
                        worse. It comes back when Kiron wants it.
        Skipped jobs    the feed it belonged to is gone.

      `divider: true` draws a rule above an item. It is the only grouping in
      here: at this length, headings are more clutter than structure.
    */
    const navItems: Array<{
        to?: string;
        onClick?: () => void;
        icon: typeof LayoutDashboard;
        label: string;
        divider?: boolean;
    }> = [
        // The two verbs. Same icon, because they are the same kind of act.
        { to: '/', icon: Plus, label: 'New application' },
        { to: '/linkedin?tab=outreach', icon: Plus, label: 'New outreach' },

        // Yours.
        { to: '/tracker', icon: Briefcase, label: 'Your tracker', divider: true },
        { to: '/workspace', icon: FileText, label: 'Your profile' },
        { to: '/interview-prep', icon: MessagesSquare, label: 'Interview prep' },

        // Looked at, not worked in.
        { to: '/leaderboard', icon: Trophy, label: 'Leaderboard', divider: true },
        { to: '/resources', icon: BookOpen, label: 'Resources' },
    ];

    const sidebarContent = (showLabels: boolean) => (
        <>
            <div className="flex items-center gap-3 mb-10 px-2">
                <img
                    src="/Logo.svg"
                    alt="JobReady"
                    className="w-10 h-10 rounded-xl flex-shrink-0 object-contain"
                />
                <AnimatePresence>
                    {showLabels && (
                        <motion.h1
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15 }}
                            className="text-xl font-bold tracking-tight whitespace-nowrap"
                            style={{ color: warmT.text }}
                        >
                            JobReady
                        </motion.h1>
                    )}
                </AnimatePresence>
            </div>

            <nav className="flex-1 space-y-1.5">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const rule = item.divider ? (
                        <div
                            aria-hidden
                            style={{
                                height: 1, margin: '10px 12px 9px',
                                background: warm.colors.borderWhisper,
                            }}
                        />
                    ) : null;
                    const badge = item.to === '/tracker' && (followUpCount ?? 0) > 0
                        ? ((followUpCount ?? 0) > 9 ? '9+' : String(followUpCount))
                        : null;

                    const iconAndLabel = (
                        <>
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
                                    style={{ background: warmT.accentSuccess, color: warm.colors.bgCanvas }}
                                    aria-label={`${badge} applications need follow-up`}
                                >
                                    {showLabels ? badge : ''}
                                </span>
                            )}
                        </>
                    );

                    if (item.onClick) {
                        return (
                            <React.Fragment key={item.label}>
                            {rule}
                            <button
                                type="button"
                                onClick={() => { item.onClick!(); if (isTouch) setDrawerOpen(false); }}
                                className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-black/[0.04] text-left"
                                style={{ color: warmT.textMuted, background: 'transparent', border: '1px solid transparent' }}
                            >
                                {iconAndLabel}
                            </button>
                            </React.Fragment>
                        );
                    }

                    /* Two items point at /linkedin and only differ by the query
                       string, which NavLink ignores when it decides what is
                       active. Without this they both light up at once. */
                    const path = item.to!.split('?')[0];
                    const query = item.to!.includes('?') ? item.to!.split('?')[1] : '';
                    const selfActive = location.pathname === path
                        && (query ? location.search.includes(query) : !location.search);

                    return (
                        <React.Fragment key={item.to}>
                        {rule}
                        <NavLink
                            to={item.to!}
                            end={item.to === '/'}
                            onClick={() => isTouch && setDrawerOpen(false)}
                            {...(item.to === '/tracker'
                                // data-celebration-target is where the "application
                                // filed" chip flies to, and what pulses on arrival.
                                ? { 'data-process-nav': 'track', 'data-celebration-target': 'tracker' }
                                : {})}
                            className={() =>
                                `relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${selfActive ? '' : 'hover:bg-black/[0.04]'}`
                            }
                            /* Active nav is a soft accent fill with accent text, not a
                               bordered teal box left over from the retired palette.
                               Solid blue stays reserved for buttons, so the sidebar
                               never competes with the action on the page. */
                            style={() => ({
                                color: selfActive ? warm.colors.accentPetrol : warmT.textMuted,
                                background: selfActive ? warm.colors.accentPetrolSoft : 'transparent',
                                border: '1px solid transparent',
                                fontWeight: selfActive ? warm.weight.semibold : warm.weight.medium,
                            })}
                        >
                            {iconAndLabel}
                        </NavLink>
                        </React.Fragment>
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
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: warmT.textFaint }}>
                                Account
                            </p>
                            <p className="text-xs truncate" style={{ color: warmT.textMuted }}>{user?.email}</p>
                        </motion.div>
                    )}
                </AnimatePresence>
                <button
                    onClick={() => signOut()}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all border border-transparent hover:border-black/10 hover:bg-black/5"
                    style={{ color: warmT.textFaint }}
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
                backgroundColor: warmT.bg,
                backgroundImage: `radial-gradient(circle, ${warmT.dotColor} 1px, transparent 1px)`,
                backgroundSize: '22px 22px',
                color: warmT.text,
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
                        background: warmT.card,
                        borderRight: `1px solid ${warmT.cardBorder}`,
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
                        background: warmT.card,
                        border: `1px solid ${warmT.cardBorder}`,
                        color: warmT.text,
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
                            style={{ background: 'rgba(26, 24, 20, 0.36)' }}
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
                                background: warmT.card,
                                borderRight: `1px solid ${warmT.cardBorder}`,
                            }}
                        >
                            <button
                                onClick={() => setDrawerOpen(false)}
                                aria-label="Close navigation"
                                className="absolute top-4 right-3 w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ color: warmT.textMuted }}
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

                {/* The mindset link that used to sit here is gone. /mindset still
                    exists and is still linked from where it is relevant; on every
                    page it was a permanent reminder that things might be going
                    badly, under screens where they were going fine. */}
            </main>
        </div>
    );
};
