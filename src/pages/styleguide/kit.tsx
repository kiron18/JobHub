import React, { useState } from 'react';

/* ── Guide chrome ──────────────────────────────────────────────────────
   Deliberately neutral. The chrome must not compete with the two columns
   it frames, or you end up judging the guide instead of the product.
   Nothing in here is a JobHub component and nothing in here is proposed
   for the app: it is scaffolding for the review.
*/

export const CHROME = {
  ink:      '#0B1220',
  body:     '#3F4A5A',
  muted:    '#7A8698',
  faint:    '#A5AEBC',
  line:     '#E3E7ED',
  hairline: '#EEF1F5',
  page:     '#F7F8FA',
  card:     '#FFFFFF',
  mono:     "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  sans:     "'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif",
};

/** The quotable number. Every reviewable thing on this page has one. */
export function Num({ n, tone = 'default' }: { n: string; tone?: 'default' | 'section' }) {
  const isSection = tone === 'section';
  return (
    <span
      style={{
        fontFamily: CHROME.mono,
        fontSize: isSection ? 13 : 11,
        fontWeight: 600,
        letterSpacing: '0.02em',
        color: isSection ? '#FFFFFF' : CHROME.muted,
        background: isSection ? CHROME.ink : '#F1F3F7',
        border: isSection ? 'none' : `1px solid ${CHROME.line}`,
        borderRadius: 5,
        padding: isSection ? '3px 9px' : '2px 7px',
        display: 'inline-block',
        whiteSpace: 'nowrap',
        userSelect: 'all',
      }}
    >
      {n}
    </span>
  );
}

export function Section({
  n, title, lead, children,
}: { n: string; title: string; lead?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={`s${n}`} style={{ scrollMarginTop: 24, marginBottom: 64 }}>
      <div
        style={{
          display: 'flex', alignItems: 'baseline', gap: 12,
          paddingBottom: 12, marginBottom: 8,
          borderBottom: `2px solid ${CHROME.ink}`,
        }}
      >
        <Num n={n} tone="section" />
        <h2 style={{ margin: 0, fontFamily: CHROME.sans, fontSize: 22, fontWeight: 700, letterSpacing: '-0.015em', color: CHROME.ink }}>
          {title}
        </h2>
      </div>
      {lead && (
        <p style={{ margin: '0 0 28px', fontSize: 14, lineHeight: 1.6, color: CHROME.body, maxWidth: 760 }}>
          {lead}
        </p>
      )}
      {children}
    </section>
  );
}

/** One reviewable item: what is on the site now, beside what I propose. */
export function Item({
  n, title, note, verdict, now, next: nextEl, stack,
}: {
  n: string;
  title: string;
  note?: React.ReactNode;
  /** One line naming the actual change. This is the thing to agree or reject. */
  verdict?: React.ReactNode;
  now: React.ReactNode;
  next: React.ReactNode;
  /** Force the two panels to stack rather than sit side by side. */
  stack?: boolean;
}) {
  return (
    <div
      id={`i${n}`}
      style={{
        scrollMarginTop: 24,
        marginBottom: 28,
        background: CHROME.card,
        border: `1px solid ${CHROME.line}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${CHROME.hairline}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Num n={n} />
          <h3 style={{ margin: 0, fontFamily: CHROME.sans, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: CHROME.ink }}>
            {title}
          </h3>
        </div>
        {note && (
          <p style={{ margin: '7px 0 0', fontSize: 13, lineHeight: 1.55, color: CHROME.body, maxWidth: 820 }}>
            {note}
          </p>
        )}
        {verdict && (
          <p
            style={{
              margin: '9px 0 0', fontSize: 12.5, lineHeight: 1.5, color: CHROME.ink,
              background: '#F1F3F7', border: `1px solid ${CHROME.line}`, borderRadius: 7,
              padding: '7px 10px', display: 'inline-block', maxWidth: 820,
            }}
          >
            <strong style={{ fontWeight: 700 }}>Change:</strong> {verdict}
          </p>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: stack ? '1fr' : 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 1,
          background: CHROME.hairline,
        }}
      >
        <Panel label="Before" tone="now">{now}</Panel>
        <Panel label="Built" tone="next">{nextEl}</Panel>
      </div>
    </div>
  );
}

function Panel({ label, tone, children }: { label: string; tone: 'now' | 'next'; children: React.ReactNode }) {
  return (
    <div style={{ background: CHROME.card, padding: '16px 18px 20px' }}>
      <div
        style={{
          fontFamily: CHROME.mono, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: tone === 'now' ? CHROME.faint : '#1257C4',
          marginBottom: 14,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

/** A labelled cell for one pinned state, so no hovering is needed to review. */
export function Pin({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: wide ? 200 : undefined }}>
      <span
        style={{
          fontFamily: CHROME.mono, fontSize: 9.5, fontWeight: 600,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: CHROME.faint,
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>{children}</div>
    </div>
  );
}

/** Row of pinned states. */
export function Pins({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 22px', alignItems: 'flex-start' }}>
      {children}
    </div>
  );
}

/** Free-standing note under a panel, for spec text. */
export function Spec({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: '14px 0 0', fontFamily: CHROME.mono, fontSize: 11, lineHeight: 1.7,
        color: CHROME.muted, whiteSpace: 'pre-wrap',
      }}
    >
      {children}
    </p>
  );
}

/** Marks a count that came out of the inventory scan. */
export function Count({ n, of }: { n: number | string; of: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
      <strong style={{ fontFamily: CHROME.mono, fontSize: 13, fontWeight: 700, color: CHROME.ink }}>{n}</strong>
      <span style={{ fontSize: 12.5, color: CHROME.body }}>{of}</span>
    </span>
  );
}

export function Swatch({
  hex, name, token, note,
}: { hex: string; name: string; token?: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(hex); setCopied(true); setTimeout(() => setCopied(false), 900); }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 0, width: 132,
        border: `1px solid ${CHROME.line}`, borderRadius: 9, overflow: 'hidden',
        background: CHROME.card, padding: 0, cursor: 'pointer', textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ height: 52, background: hex, borderBottom: `1px solid ${CHROME.hairline}` }} />
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: CHROME.ink, lineHeight: 1.3 }}>{name}</div>
        <div style={{ fontFamily: CHROME.mono, fontSize: 10.5, color: CHROME.muted, marginTop: 3 }}>
          {copied ? 'copied' : hex}
        </div>
        {token && (
          <div style={{ fontFamily: CHROME.mono, fontSize: 9.5, color: CHROME.faint, marginTop: 2 }}>{token}</div>
        )}
        {note && (
          <div style={{ fontSize: 10.5, color: CHROME.muted, marginTop: 5, lineHeight: 1.4 }}>{note}</div>
        )}
      </div>
    </button>
  );
}

export function SwatchRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{children}</div>;
}

/** A neutral stage to sit a component on, so the panel edge is not read as part of it. */
export function Stage({ children, tint }: { children: React.ReactNode; tint?: string }) {
  return (
    <div
      style={{
        background: tint || '#FFFFFF',
        border: `1px dashed ${CHROME.line}`,
        borderRadius: 10,
        padding: 18,
      }}
    >
      {children}
    </div>
  );
}
