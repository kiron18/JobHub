import React from 'react';
import { Check, Plus, Briefcase, FileText, MessagesSquare, Trophy, BookOpen } from 'lucide-react';
import { colors, type as typeTokens } from '../tokens';

/* ── Mockups of the product, drawn rather than screenshotted ─────────────────
   These are representations of real screens, not photographs of them. They are
   drawn in the landing page's own tokens so they sit inside the page instead of
   fighting it, and every label in them is a string the product actually shows:
   the sidebar is the seven items in DashboardLayout.tsx, the verdict wording is
   VERDICT in components/fit/FitReportView.tsx, the tracker statuses are the
   statuses ApplicationTracker.tsx uses.

   That constraint is the point. A mockup that invents a screen is a promise the
   product has to keep later, so if a label here stops being true in the app it
   comes out of here in the same change.                                       */

const NAV = [
  { icon: Plus, label: 'New application' },
  { icon: Plus, label: 'New outreach' },
  { icon: Briefcase, label: 'Your tracker', divider: true },
  { icon: FileText, label: 'Your profile' },
  { icon: MessagesSquare, label: 'Interview prep' },
  { icon: Trophy, label: 'Leaderboard', divider: true },
  { icon: BookOpen, label: 'Resources' },
] as const;

const ui = {
  bg: '#FFFFFF',
  rail: '#F7F5F1',
  line: 'rgba(26,24,20,0.10)',
  lineSoft: 'rgba(26,24,20,0.06)',
  ink: colors.textPrimary,
  ink2: colors.textSecondary,
  ink3: colors.textMuted,
  accent: colors.accentPetrol,
  good: colors.success,
} as const;

/** A window chrome, so it reads as software and not as a content card. */
export function MockWindow({
  children,
  label,
  withRail = false,
}: {
  children: React.ReactNode;
  label: string;
  withRail?: boolean;
}) {
  return (
    <figure
      style={{
        margin: 0,
        borderRadius: 14,
        overflow: 'hidden',
        background: ui.bg,
        border: `1px solid ${colors.borderDefined}`,
        boxShadow: '0 1px 2px rgba(26,24,20,0.05), 0 22px 50px -26px rgba(26,24,20,0.40)',
      }}
      aria-label={label}
    >
      {/* Title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 14px',
          background: ui.rail,
          borderBottom: `1px solid ${ui.line}`,
        }}
      >
        {['#E5A0A0', '#E7CE9A', '#A9CDB4'].map(c => (
          <span key={c} style={{ width: 8, height: 8, borderRadius: 99, background: c, display: 'block' }} />
        ))}
        <span
          style={{
            marginLeft: 10,
            fontFamily: typeTokens.body,
            fontSize: 11,
            letterSpacing: '0.04em',
            color: ui.ink3,
          }}
        >
          {label}
        </span>
      </div>

      <div style={{ display: 'flex', minHeight: 0 }}>
        {withRail && (
          <nav
            aria-hidden
            style={{
              flexShrink: 0,
              width: 168,
              background: ui.rail,
              borderRight: `1px solid ${ui.line}`,
              padding: '16px 10px',
              display: 'none',
            }}
            className="mock-rail"
          >
            {NAV.map((n, i) => {
              const Icon = n.icon;
              return (
                <div
                  key={n.label + i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '7px 9px',
                    borderRadius: 7,
                    marginTop: 'divider' in n && n.divider ? 12 : 2,
                    borderTop: 'divider' in n && n.divider ? `1px solid ${ui.line}` : 'none',
                    paddingTop: 'divider' in n && n.divider ? 12 : 7,
                    background: i === 0 ? 'rgba(45,90,110,0.10)' : 'transparent',
                    color: i === 0 ? ui.accent : ui.ink2,
                    fontFamily: typeTokens.body,
                    fontSize: 12,
                    fontWeight: i === 0 ? 600 : 500,
                  }}
                >
                  <Icon size={13} style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap' }}>{n.label}</span>
                </div>
              );
            })}
          </nav>
        )}
        <div style={{ flex: 1, minWidth: 0, padding: 'clamp(16px, 3vw, 26px)' }}>{children}</div>
      </div>

      {/* The rail is real structure on a wide screen and pure noise on a phone. */}
      <style>{`@media (min-width: 700px) { .mock-rail { display: block !important; } }`}</style>
    </figure>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: typeTokens.body,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: ui.ink3,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

/** Step 2: the ad has been read, and this is the answer. */
export function MockFitReport() {
  return (
    <div style={{ fontFamily: typeTokens.body, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ fontSize: 'clamp(17px, 2.4vw, 21px)', fontWeight: 800, letterSpacing: '-0.02em', color: ui.ink }}>
          Graduate Business Analyst
        </div>
        <div style={{ fontSize: 13, color: ui.ink3, marginTop: 2 }}>Transport Accident Commission, Geelong VIC</div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '15px 17px',
          background: 'rgba(42,157,111,0.07)',
          border: '1px solid rgba(42,157,111,0.28)',
          borderRadius: 12,
        }}
      >
        <span
          style={{
            flexShrink: 0,
            marginTop: 1,
            width: 24,
            height: 24,
            borderRadius: 99,
            background: ui.good,
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={14} strokeWidth={3.5} />
        </span>
        <span>
          <span style={{ display: 'block', fontSize: 'clamp(16px, 2.2vw, 19px)', fontWeight: 800, letterSpacing: '-0.02em', color: ui.ink }}>
            Worth applying
          </span>
          <span style={{ display: 'block', marginTop: 3, fontSize: 13.5, lineHeight: 1.5, color: ui.ink2 }}>
            Once the resume is written for this ad.
          </span>
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 26 }}>
        <div style={{ flex: '1 1 210px', minWidth: 0 }}>
          <Label>What to lean on</Label>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'Two years of stakeholder reporting, which is the first thing this ad asks for.',
              'The requirements work on the vehicle venture maps onto their process discovery.',
            ].map(t => (
              <li key={t} style={{ fontSize: 13, lineHeight: 1.5, color: ui.ink2, paddingLeft: 11, borderLeft: `2px solid ${ui.good}44` }}>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ flex: '1 1 210px', minWidth: 0 }}>
          <Label>What is missing</Label>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'They name SQL twice. Your resume never says it once.',
              'No Australian workplace named above the fold.',
            ].map(t => (
              <li key={t} style={{ fontSize: 13, lineHeight: 1.5, color: ui.ink2, paddingLeft: 11, borderLeft: `2px solid ${colors.accentGold}66` }}>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        style={{
          display: 'inline-flex',
          alignSelf: 'flex-start',
          alignItems: 'center',
          gap: 8,
          padding: '11px 20px',
          background: ui.accent,
          color: colors.textOnDeep,
          borderRadius: 9,
          fontSize: 13.5,
          fontWeight: 700,
        }}
      >
        Write my application
      </div>
    </div>
  );
}

/** Steps 3 and 4: the documents, written against that ad. */
export function MockDocuments() {
  const tabs = ['Resume', 'Cover letter', 'Selection criteria'];
  return (
    <div style={{ fontFamily: typeTokens.body }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${ui.line}`, marginBottom: 16 }}>
        {tabs.map((t, i) => (
          <div
            key={t}
            style={{
              padding: '8px 12px',
              fontSize: 12.5,
              fontWeight: i === 2 ? 700 : 500,
              color: i === 2 ? ui.accent : ui.ink3,
              borderBottom: `2px solid ${i === 2 ? ui.accent : 'transparent'}`,
              marginBottom: -1,
              whiteSpace: 'nowrap',
            }}
          >
            {t}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 13, color: ui.ink3, marginBottom: 12 }}>
        Criterion 2 of 4 &middot; Demonstrated ability to manage competing priorities
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          ['S', 'Two subjects, a 20 hour retail roster and a capstone client all landed in the same fortnight.'],
          ['T', 'I owned the capstone deliverable and could not drop the roster.'],
          ['A', 'Rebuilt the plan around the client’s two hard dates, moved the retail shifts, and put a Friday check-in on the calendar.'],
          ['R', 'Delivered a week early, and the client asked for a second scope.'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <span
              style={{
                flexShrink: 0,
                width: 20,
                height: 20,
                borderRadius: 5,
                background: 'rgba(45,90,110,0.10)',
                color: ui.accent,
                fontSize: 11,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {k}
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.55, color: ui.ink2 }}>{v}</span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: `1px solid ${ui.lineSoft}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 12,
          color: ui.ink3,
        }}
      >
        <Check size={13} style={{ color: ui.good }} />
        Written from your history, against this ad. 268 words.
      </div>
    </div>
  );
}

/** Step 5: the follow-up, already written, waiting on a date. */
export function MockFollowUp() {
  return (
    <div style={{ fontFamily: typeTokens.body }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: ui.ink }}>Follow-up to the hiring manager</div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: colors.accentGold,
            background: 'rgba(197,160,89,0.14)',
            padding: '4px 9px',
            borderRadius: 99,
          }}
        >
          Sends day 5
        </div>
      </div>

      <div style={{ border: `1px solid ${ui.line}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${ui.lineSoft}`, fontSize: 12.5, color: ui.ink3 }}>
          <span style={{ color: ui.ink2, fontWeight: 600 }}>Subject:</span> Graduate BA role, and the SQL question you raised
        </div>
        <div style={{ padding: '14px', fontSize: 13, lineHeight: 1.65, color: ui.ink2 }}>
          Hi Priya, I applied for the Graduate Business Analyst role on Monday. I noticed the ad puts real weight on SQL,
          so I spent the weekend rebuilding my capstone reporting in it and the query set is on my profile if it is useful.
          Happy to answer anything before you shortlist.
        </div>
      </div>
    </div>
  );
}

/** Step 6: nothing is quietly lost. */
export function MockTracker() {
  const rows = [
    { role: 'Graduate Business Analyst', co: 'TAC', status: 'Interview', tone: ui.good, day: 'Thu 2pm' },
    { role: 'Junior Data Analyst', co: 'Inlight', status: 'Follow-up due', tone: colors.accentGold, day: 'Today' },
    { role: 'Calibration Lab Technician', co: 'LAF Technologies', status: 'Applied', tone: ui.ink3, day: 'Day 2' },
    { role: 'Business Analyst', co: 'Bendigo Bank', status: 'Applied', tone: ui.ink3, day: 'Day 1' },
  ];
  return (
    <div style={{ fontFamily: typeTokens.body }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: ui.ink }}>Your tracker</span>
        <span style={{ fontSize: 12, color: ui.ink3 }}>47 this week &middot; 1 chase waiting on you</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.role}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '11px 0',
            borderTop: i === 0 ? 'none' : `1px solid ${ui.lineSoft}`,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: ui.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {r.role}
            </div>
            <div style={{ fontSize: 11.5, color: ui.ink3 }}>{r.co}</div>
          </div>
          <div style={{ fontSize: 11.5, color: ui.ink3, whiteSpace: 'nowrap' }}>{r.day}</div>
          <div
            style={{
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 700,
              color: r.tone,
              background: `${r.tone}1A`,
              padding: '4px 9px',
              borderRadius: 99,
              whiteSpace: 'nowrap',
            }}
          >
            {r.status}
          </div>
        </div>
      ))}
    </div>
  );
}
