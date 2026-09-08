import React, { useState } from 'react';
import { Check, Plus, Briefcase, FileText, MessagesSquare, Trophy, BookOpen, ChevronLeft, ChevronRight, ClipboardPaste } from 'lucide-react';
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

/** Step 1: the whole input, which is one paste. */
export function MockPaste() {
  return (
    <div style={{ fontFamily: typeTokens.body }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: ui.ink, marginBottom: 4 }}>Paste the job ad</div>
      <div style={{ fontSize: 12, color: ui.ink3, marginBottom: 12 }}>
        The whole ad, straight off SEEK or LinkedIn. Nothing to fill in.
      </div>

      <div
        style={{
          border: `1px solid ${ui.line}`,
          borderRadius: 10,
          padding: '13px 14px',
          background: '#FCFBF9',
          fontSize: 12,
          lineHeight: 1.6,
          color: ui.ink2,
          minHeight: 118,
        }}
      >
        <div style={{ fontWeight: 700, color: ui.ink }}>Graduate Business Analyst</div>
        <div style={{ color: ui.ink3, marginBottom: 8 }}>Transport Accident Commission &middot; Geelong VIC</div>
        You will work alongside senior analysts to gather requirements, map current-state processes and report on
        delivery. We are looking for strong SQL, confident stakeholder communication and&hellip;
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 1.5,
            height: 13,
            marginLeft: 2,
            verticalAlign: 'text-bottom',
            background: ui.accent,
          }}
        />
      </div>

      <div
        style={{
          marginTop: 14,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 18px',
          background: ui.accent,
          color: colors.textOnDeep,
          borderRadius: 9,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <ClipboardPaste size={14} /> Check the fit
      </div>
    </div>
  );
}

/**
 * The tab strip the three document mocks share.
 *
 * Three nowrap tabs came to ~318px inside a 288px mock on a phone, so the
 * rightmost one — usually the one the mock is pointing at — was clipped off the
 * right edge. The sizes below are fixed, not vw-clamped: this mock sits in a
 * padded card far narrower than the viewport, so a vw unit here describes the
 * wrong box and still overflowed.
 */
function DocTabs({ active }: { active: 0 | 1 | 2 }) {
  const tabs = ['Resume', 'Cover letter', 'Selection criteria'];
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${ui.line}`, marginBottom: 16 }}>
      {tabs.map((t, i) => (
        <div
          key={t}
          style={{
            padding: '8px 6px',
            fontSize: 10.5,
            fontWeight: i === active ? 700 : 500,
            color: i === active ? ui.accent : ui.ink3,
            borderBottom: `2px solid ${i === active ? ui.accent : 'transparent'}`,
            marginBottom: -1,
            whiteSpace: 'nowrap',
          }}
        >
          {t}
        </div>
      ))}
    </div>
  );
}

/** The line every document mock ends on: where the words came from. */
function DocProvenance({ children }: { children: React.ReactNode }) {
  return (
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
      <Check size={13} style={{ color: ui.good, flexShrink: 0 }} />
      {children}
    </div>
  );
}

/** Step 3: the resume, rewritten against that one ad. */
export function MockResume() {
  return (
    <div style={{ fontFamily: typeTokens.body }}>
      <DocTabs active={0} />

      <div style={{ fontSize: 14, fontWeight: 800, color: ui.ink, letterSpacing: '-0.01em' }}>Aarav Menon</div>
      <div style={{ fontSize: 11.5, color: ui.ink3, marginBottom: 14 }}>
        Melbourne VIC &middot; Full working rights &middot; Graduate Business Analyst
      </div>

      <Label>Professional summary</Label>
      <p style={{ margin: '0 0 16px', fontSize: 12.5, lineHeight: 1.6, color: ui.ink2 }}>
        Business analyst with two years of stakeholder reporting and requirements work, now writing{' '}
        <mark style={{ background: colors.highlight, padding: '0 3px', color: ui.ink }}>SQL</mark> daily against
        operational data. Looking for a graduate analyst seat in a delivery team.
      </p>

      <Label>Experience</Label>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: ui.ink }}>Operations Analyst &middot; Vector Logistics</div>
      <div style={{ fontSize: 11.5, color: ui.ink3, marginBottom: 8 }}>Mar 2024 &ndash; present</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          <>
            Mapped the current-state despatch process across 4 depots and cut{' '}
            <mark style={{ background: colors.highlight, padding: '0 3px', color: ui.ink }}>hand-offs from 11 to 6</mark>.
          </>,
          <>
            Rebuilt the weekly delivery report in{' '}
            <mark style={{ background: colors.highlight, padding: '0 3px', color: ui.ink }}>SQL</mark>, replacing 3
            hours of manual collation with a scheduled query.
          </>,
          <>Ran fortnightly requirements sessions with 9 stakeholders across ops, finance and the depot floor.</>,
        ].map((t, i) => (
          <li
            key={i}
            style={{ fontSize: 12.5, lineHeight: 1.55, color: ui.ink2, paddingLeft: 11, borderLeft: `2px solid ${ui.accent}33` }}
          >
            {t}
          </li>
        ))}
      </ul>

      <DocProvenance>Every highlighted phrase is a word this ad used. 1 page.</DocProvenance>
    </div>
  );
}

/** Step 4: the cover letter, arguing from the same history. */
export function MockCoverLetter() {
  return (
    <div style={{ fontFamily: typeTokens.body }}>
      <DocTabs active={1} />

      <div style={{ fontSize: 12, color: ui.ink3, marginBottom: 12 }}>
        To the hiring team &middot; Transport Accident Commission
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          'I am applying for the Graduate Business Analyst role in Geelong. Your ad puts requirements gathering and SQL at the centre of the job, and those are the two things I have spent the last two years doing.',
          <>
            At Vector Logistics I mapped despatch across four depots and{' '}
            <mark style={{ background: colors.highlight, padding: '0 3px', color: ui.ink }}>
              cut the hand-offs from eleven to six
            </mark>
            . The reporting that made the case for it is a scheduled SQL query I wrote and still maintain.
          </>,
          'What draws me to TAC specifically is that the analysis has a person at the end of it. I would rather improve a claims process people actually depend on than shave a margin.',
        ].map((p, i) => (
          <p key={i} style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: ui.ink2 }}>
            {p}
          </p>
        ))}
      </div>

      <DocProvenance>One argument, three paragraphs, no filler. 214 words.</DocProvenance>
    </div>
  );
}

/** Step 5: the selection criteria, in STAR, which is how they are scored. */
export function MockCriteria() {
  return (
    <div style={{ fontFamily: typeTokens.body }}>
      <DocTabs active={2} />

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

      <DocProvenance>Written from your history, against this ad. 268 words.</DocProvenance>
    </div>
  );
}

/**
 * The three things one paste produces, one at a time.
 *
 * A carousel rather than three stacked windows because they are the same
 * object at three stages and the point is that they came out together. Stacked,
 * the reader scrolls past two of them; side by side at this width, none of them
 * is readable.
 *
 * No autoplay. Somebody reading a cover letter should never have it slide out
 * from under them, and the whole claim being made here is that these are worth
 * reading.
 */
export function MockDocumentCarousel() {
  const [i, setI] = useState(0);

  const CAROUSEL = [
    { label: 'Resume', window: 'Your resume, rewritten for this ad', body: <MockResume /> },
    { label: 'Cover letter', window: 'Your cover letter', body: <MockCoverLetter /> },
    { label: 'Follow-up mail', window: 'Follow-up', body: <MockFollowUp /> },
  ];

  const item = CAROUSEL[i];
  const go = (n: number) => setI(((n % CAROUSEL.length) + CAROUSEL.length) % CAROUSEL.length);

  return (
    <div>
      {/* The picker. Named, not dotted: these are three different documents,
          and a dot cannot say which one you are about to look at. */}
      <div
        role="tablist"
        aria-label="Sample documents"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}
      >
        {CAROUSEL.map((c, n) => (
          <button
            key={c.label}
            type="button"
            role="tab"
            aria-selected={n === i}
            onClick={() => setI(n)}
            style={{
              minHeight: 40,
              padding: '9px 16px',
              borderRadius: 99,
              cursor: 'pointer',
              fontFamily: typeTokens.body,
              fontSize: 13,
              fontWeight: 600,
              color: n === i ? colors.textOnDeep : colors.textSecondary,
              background: n === i ? ui.accent : 'transparent',
              border: `1px solid ${n === i ? ui.accent : colors.borderDefined}`,
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <MockWindow label={item.window}>{item.body}</MockWindow>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 }}>
        <CarouselArrow label="Previous document" onClick={() => go(i - 1)}>
          <ChevronLeft size={16} />
        </CarouselArrow>
        <span style={{ fontFamily: typeTokens.body, fontSize: 12.5, color: colors.textMuted, minWidth: 46, textAlign: 'center' }}>
          {i + 1} of {CAROUSEL.length}
        </span>
        <CarouselArrow label="Next document" onClick={() => go(i + 1)}>
          <ChevronRight size={16} />
        </CarouselArrow>
      </div>
    </div>
  );
}

function CarouselArrow({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 40,
        height: 40,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 99,
        cursor: 'pointer',
        color: colors.textSecondary,
        background: 'transparent',
        border: `1px solid ${colors.borderDefined}`,
      }}
    >
      {children}
    </button>
  );
}

/** Step 6: the follow-up, already written, waiting on a date. */
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
          Sends day 7
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
