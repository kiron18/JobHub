/**
 * The admin console is three pages and this is the frame around them.
 *
 *   Today     the list of things to do                  (/admin/today)
 *   People    every lead and client, one page each      (/admin/people)
 *   Business  money, the funnel and marketing email     (/admin/business)
 *
 * Tools (broadcasts, quality control, the leaderboard, the Friday brief) sit
 * at the bottom of the rail: reached for now and then, not read every day.
 *
 * `AdminFrame` is the layout route every /admin page renders inside (see
 * App.tsx). It is also the door: someone who is not on the owner list is sent
 * home before a page mounts. The server refuses them anyway; this is so they
 * are not shown an empty console on the way.
 *
 * The look is admin.css, scoped under `.adm`.
 */
import { Suspense, type ReactNode } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import './admin.css';

const MAIN = [
  { to: '/admin/today', label: 'Today' },
  { to: '/admin/people', label: 'People' },
  { to: '/admin/business', label: 'Business' },
];

const TOOLS = [
  { to: '/admin/broadcasts', label: 'Send a broadcast' },
  { to: '/admin/quality', label: 'Quality control' },
  { to: '/admin/leaderboard', label: 'Leaderboard' },
  { to: '/admin/friday-brief', label: 'Friday brief' },
];

/** Still here while the new pages are being checked against them. */
const OLD = [
  { to: '/admin/sales', label: 'Sales board' },
  { to: '/admin/coach', label: 'Coach' },
  { to: '/admin/email', label: 'Email' },
  { to: '/admin/daily', label: 'Daily' },
];

const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'on' : undefined);

export function AdminFrame() {
  // The same query the rest of the app keeps warm, so this is rarely a wait.
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/profile')).data,
    staleTime: 5 * 60 * 1000,
  });
  const { data: today } = useQuery({
    queryKey: ['admin-today'],
    queryFn: async () => (await api.get('/admin/today')).data as TodayCounts,
    enabled: !!profile?.isAdmin,
    staleTime: 60_000,
  });

  if (isLoading) return <div className="adm" />;
  if (!profile?.isAdmin) return <Navigate to="/" replace />;

  const waiting = today
    ? today.calls.filter((c) => !c.finished).length + today.followUpsTotal + today.quietTotal + today.moneyTotal
    : 0;

  return (
    <div className="adm">
      <nav className="adm-rail" aria-label="Admin">
        <div className="adm-brand">AGC Admin<small>Aussie Grad Careers</small></div>
        {MAIN.map((t) => (
          <NavLink key={t.to} to={t.to} className={linkClass}>
            {t.label}
            {t.to === '/admin/today' && waiting > 0 && <span className="adm-count">{waiting}</span>}
          </NavLink>
        ))}
        <div className="adm-rail-foot">
          <div className="adm-rail-label">Tools</div>
          {TOOLS.map((t) => <NavLink key={t.to} to={t.to} className={linkClass}>{t.label}</NavLink>)}
          <div className="adm-rail-label">Old pages</div>
          {OLD.map((t) => <NavLink key={t.to} to={t.to} className={linkClass}>{t.label}</NavLink>)}
          <NavLink to="/" style={{ marginTop: 8 }}>Back to the app</NavLink>
        </div>
      </nav>
      {/* Its own boundary, so a page loading does not blank the rail. */}
      <main className="adm-main"><Suspense fallback={null}><Outlet /></Suspense></main>
    </div>
  );
}

interface TodayCounts {
  calls: { finished: boolean }[];
  followUpsTotal: number;
  quietTotal: number;
  moneyTotal: number;
}

/** A page inside the frame: a title, a line under it, and room for buttons. */
export function AdminShell({
  title,
  subtitle,
  actions,
  wide,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** For the old full-width boards that were built to fill the screen. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? 'adm-page wide' : 'adm-page'}>
      <div className="adm-head">
        <div style={{ minWidth: 0 }}>
          <h1>{title}</h1>
          {subtitle ? <p className="adm-sub">{subtitle}</p> : <div style={{ height: 24 }} />}
        </div>
        {actions && <div className="adm-actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** The old pages drew their own tab bar with this. The rail does that job
 *  now, so it draws nothing; it is kept so those pages need no edits before
 *  they are retired. */
export function AdminNav() {
  return null;
}

/** A small secondary link, for a tool reached from inside a page. */
export function AdminToolLink({ to, children }: { to: string; children: ReactNode }) {
  return <NavLink to={to} className="adm-btn ghost">{children}</NavLink>;
}
