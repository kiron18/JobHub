/**
 * The admin area is six pages and this is the bar that joins them.
 *
 *   Growth  where visitors drop off on the way to paying (/admin/growth)
 *   People  every lead and client in one filterable list (/admin/people)
 *   Sales   resume intake, booked calls and the pipeline  (/admin/sales)
 *   Email   what went out, when, and how it did           (/admin/email)
 *   Coach   paying members' week                          (/admin/coach)
 *   Daily   Kiron's own checklist for the day             (/admin/daily)
 *
 * Everything else that used to live under /admin either redirects into one of
 * these (see App.tsx) or is a tool reached from inside one of them.
 */
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { warm } from '../../lib/theme/warmTokens';

const C = warm.colors;

const TABS = [
  { to: '/admin/growth', label: 'Growth' },
  { to: '/admin/people', label: 'People' },
  { to: '/admin/sales', label: 'Sales' },
  { to: '/admin/email', label: 'Email' },
  { to: '/admin/coach', label: 'Coach' },
  { to: '/admin/daily', label: 'Daily' },
];

export function AdminNav() {
  return (
    <nav aria-label="Admin" style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.borderWhisper}`, marginBottom: 24, overflowX: 'auto' }}>
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          style={({ isActive }) => ({
            ...warm.text.body,
            padding: '10px 14px',
            marginBottom: -1,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            fontWeight: isActive ? 600 : 400,
            color: isActive ? C.accentPetrol : C.textSecondary,
            borderBottom: `2px solid ${isActive ? C.accentPetrol : 'transparent'}`,
          })}
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AdminShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(12px, 4vw, 24px) 16px 80px', color: C.textPrimary }}>
      <AdminNav />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ ...warm.text.h1, margin: 0 }}>{title}</h1>
          {subtitle && <p style={{ ...warm.text.small, margin: '4px 0 0', color: C.textMuted, maxWidth: 720 }}>{subtitle}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** A small secondary link, for the tools that live inside a page (the sales
 * pipeline, the workshop console, the broadcast composer). */
export function AdminToolLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      style={{
        ...warm.text.small,
        padding: '6px 12px',
        borderRadius: 8,
        border: `1px solid ${C.borderDefined}`,
        color: C.textSecondary,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </NavLink>
  );
}
