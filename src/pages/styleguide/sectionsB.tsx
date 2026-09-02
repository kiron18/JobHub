import { useState } from 'react';
import { warm } from '../../lib/theme/warmTokens';
import { StepRail } from '../../components/shared/StepRail';
import { Button } from '../../components/shared/Button';
import { Input } from '../../components/shared/Input';
import { Checkbox, Toggle } from '../../components/shared/FormControls';
import { SkeletonCard } from '../../components/shared/Skeleton';
import { celebrate } from '../../lib/feedback';
import { proposed as P } from './proposed';
import { Section, Item, Pin, Spec, Stage, CHROME } from './kit';
import { NextButton, Spinner } from './specimens';

/* ── 06 · Cards and surfaces ────────────────────────────────────────── */

export function SectionCards() {
  return (
    <Section
      n="06"
      title="Cards and surfaces"
      lead="The shared Card is imported by 43 files, which makes it the most successful shared component in the codebase. It only has one problem: it has no idea what it is for, so callers override its padding and shadow constantly."
    >
      <Item
        n="06.1"
        title="The base card"
        note="Left is the shared Card exactly as it renders. Right adds a header and footer slot so the 43 callers stop hand-building those."
        verdict="Padding becomes 20px, radius stays 14, and the card gets header, body and footer slots."
        now={
          <Stage tint={CHROME.page}>
            <div style={{
              background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
              borderRadius: warm.radius.card, padding: 24, boxShadow: warm.shadow.soft,
            }}>
              <h4 style={{ margin: '0 0 8px', fontFamily: warm.type.fontBody, fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary }}>
                Senior Data Analyst
              </h4>
              <p style={{ margin: 0, fontFamily: warm.type.fontBody, fontSize: 13, lineHeight: 1.6, color: warm.colors.textSecondary }}>
                Woolworths Group, Sydney. Applied 3 days ago.
              </p>
            </div>
          </Stage>
        }
        next={
          <Stage tint={CHROME.page}>
            <div style={{
              background: P.colors.surface, border: `1px solid ${P.colors.hairline}`,
              borderRadius: P.radius.lg, boxShadow: P.shadow.soft, overflow: 'hidden',
            }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${P.colors.hairline}` }}>
                <h4 style={{ margin: 0, fontFamily: P.font, ...P.text.h3, color: P.colors.ink }}>Senior Data Analyst</h4>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <p style={{ margin: 0, fontFamily: P.font, ...P.text.small, color: P.colors.body }}>
                  Woolworths Group, Sydney. Applied 3 days ago.
                </p>
              </div>
              <div style={{ padding: '12px 20px', borderTop: `1px solid ${P.colors.hairline}`, background: P.colors.subtle }}>
                <NextButton size="sm" variant="ghost" label="Open" />
              </div>
            </div>
          </Stage>
        }
      />

      <Item
        n="06.2"
        title="Surface hierarchy"
        note="How to say 'this is more important' without inventing a new shadow. Today the answer is usually a blue glow, which reads as selected rather than as primary."
        verdict="Four levels, and only the top one is allowed a shadow: flat, hairline, bordered, deep."
        now={
          <Stage tint={CHROME.page}>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ padding: 12, background: '#fff', border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 14, fontSize: 12.5, color: warm.colors.textSecondary }}>card</div>
              <div style={{ padding: 12, background: '#fff', borderRadius: 14, boxShadow: `0 8px 32px ${warm.colors.accentPetrol}40`, fontSize: 12.5, color: warm.colors.textSecondary }}>glow, used for emphasis</div>
              <div style={{ padding: 12, background: warm.colors.bgDeep, borderRadius: 14, fontSize: 12.5, color: '#fff' }}>deep</div>
            </div>
          </Stage>
        }
        next={
          <Stage tint={CHROME.page}>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ padding: 14, background: 'transparent', fontSize: 13, color: P.colors.body, fontFamily: P.font }}>flat, no container at all</div>
              <div style={{ padding: 14, background: P.colors.subtle, borderRadius: P.radius.lg, fontSize: 13, color: P.colors.body, fontFamily: P.font }}>subtle fill, for grouping</div>
              <div style={{ padding: 14, background: '#fff', border: `1px solid ${P.colors.hairline}`, borderRadius: P.radius.lg, boxShadow: P.shadow.soft, fontSize: 13, color: P.colors.body, fontFamily: P.font }}>card, the default</div>
              <div style={{ padding: 14, background: P.colors.deep, borderRadius: P.radius.lg, fontSize: 13, color: '#fff', fontFamily: P.font }}>deep, one per screen</div>
            </div>
          </Stage>
        }
      />
    </Section>
  );
}

/* ── 07 · Badges and status ─────────────────────────────────────────── */

function NextBadge({ tone, label }: { tone: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'; label: string }) {
  const map = {
    neutral: [P.colors.subtle, P.colors.body],
    accent:  [P.colors.accentSoft, P.colors.accent],
    success: [P.colors.successSoft, P.colors.success],
    warning: [P.colors.goldSoft, P.colors.gold],
    danger:  [P.colors.dangerSoft, P.colors.danger],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
      background: bg, color: fg, borderRadius: P.radius.sm,
      fontFamily: P.font, fontSize: 12, fontWeight: P.weight.semibold, lineHeight: 1, whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

export function SectionBadges() {
  return (
    <Section
      n="07"
      title="Badges, pills and status"
      lead="Status is everywhere in JobHub: application stage, fit verdict, sponsor status, document state, plan tier. Every one of them was styled separately."
    >
      <Item
        n="07.1"
        title="Status badges"
        note="Left is a sample of real badges from the tracker, the fit check and the sponsor list. Note the four different radii and three different text sizes."
        verdict="One badge, five tones, fixed 22px height. Soft fill and a matching text colour, never a solid fill, so a row of badges does not shout."
        now={
          <Stage>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ background: '#34d39920', color: '#34d399', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, fontFamily: warm.type.fontBody }}>Interviewing</span>
              <span style={{ background: 'transparent', color: warm.colors.accentGold, borderRadius: 8, padding: '4px 10px', fontSize: 10, fontWeight: 800, fontFamily: warm.type.fontBody, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Needs work</span>
              <span style={{ background: warm.colors.accentPetrol, color: '#fff', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 700, fontFamily: warm.type.fontBody }}>Sponsor</span>
              <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 4, padding: '2px 8px', fontSize: 9, fontWeight: 800, fontFamily: warm.type.fontBody }}>DRAFT</span>
            </div>
            <Spec>{`r=6  fs=11 fw=700   soft green on soft green
r=8  fs=10 fw=800   gold, no fill, uppercase
r=999 fs=11 fw=700  solid blue, white text
r=4  fs=9  fw=800   grey, uppercase`}</Spec>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <NextBadge tone="success" label="Interviewing" />
              <NextBadge tone="warning" label="Needs work" />
              <NextBadge tone="accent" label="Sponsor" />
              <NextBadge tone="neutral" label="Draft" />
              <NextBadge tone="danger" label="Closed" />
            </div>
            <Spec>{`One height (22), one radius (sm),
one size (12 / 600). Tone carries
the meaning, nothing else varies.`}</Spec>
          </Stage>
        }
      />

      <Item
        n="07.2"
        title="Score and verdict"
        note="The fit score is the most looked-at number in the product. It currently renders at three different sizes on three different screens."
        verdict="One score block. The number is the loud thing, the label is quiet, and the colour is the verdict."
        now={
          <Stage>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontFamily: warm.type.fontBody, fontSize: 26, fontWeight: 800, color: warm.colors.success }}>82%</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Match</div>
              </div>
              <div>
                <div style={{ fontFamily: warm.type.fontBody, fontSize: 18, fontWeight: 700, color: warm.colors.accentGold }}>61%</div>
                <div style={{ fontSize: 9, fontWeight: 800, color: warm.colors.textMuted }}>MATCH</div>
              </div>
            </div>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end' }}>
              {[[82, P.colors.success, 'Strong fit'], [61, P.colors.gold, 'Worth a look'], [34, P.colors.danger, 'Weak fit']].map(([n, c, l]) => (
                <div key={String(n)}>
                  <div style={{ fontFamily: P.font, fontSize: 34, lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.025em', color: c as string }}>
                    {n}<span style={{ fontSize: 18, fontWeight: 600 }}>%</span>
                  </div>
                  <div style={{ fontFamily: P.font, ...P.text.micro, color: P.colors.muted, marginTop: 4 }}>{l as string}</div>
                </div>
              ))}
            </div>
          </Stage>
        }
      />
    </Section>
  );
}

/* ── 08 · Overlays ──────────────────────────────────────────────────── */

export function SectionOverlays() {
  return (
    <Section
      n="08"
      title="Modals and overlays"
      lead="The shared Modal is imported by 22 files and is structurally sound. Two things are wrong with it: its scrim is built from the retired brown, and it has no footer, so every caller invents its own button row."
    >
      <Item
        n="08.1"
        title="Modal"
        note="Rendered inline here rather than as a real overlay so both can be compared at once."
        verdict={<>Scrim moves from <code style={{ fontFamily: CHROME.mono, fontSize: 12 }}>rgba(26,24,20,0.36)</code>, a leftover brown, to a neutral slate. A footer slot is added, right aligned, secondary then primary.</>}
        now={
          <Stage tint="rgba(26, 24, 20, 0.36)">
            <div style={{
              background: warm.colors.bgSurface, borderRadius: warm.radius.card, padding: 28,
              boxShadow: warm.shadow.lifted, maxWidth: 400,
            }}>
              <h2 style={{ margin: '0 0 20px', fontFamily: warm.type.fontBody, fontSize: '1.25rem', fontWeight: 600, color: warm.colors.textPrimary }}>
                Delete this resume?
              </h2>
              <p style={{ margin: '0 0 20px', fontFamily: warm.type.fontBody, fontSize: 13, lineHeight: 1.6, color: warm.colors.textSecondary }}>
                This cannot be undone. Any applications built from it stay in your tracker.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ background: warm.colors.accentPetrol, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, fontFamily: warm.type.fontBody, cursor: 'pointer' }}>Delete</button>
                <button style={{ background: 'transparent', color: warm.colors.textPrimary, border: `1px solid ${warm.colors.borderDefined}`, borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, fontFamily: warm.type.fontBody, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </Stage>
        }
        next={
          <Stage tint="rgba(15, 32, 56, 0.42)">
            <div style={{
              background: P.colors.surface, borderRadius: P.radius.lg, boxShadow: P.shadow.lifted,
              maxWidth: 400, overflow: 'hidden',
            }}>
              <div style={{ padding: '20px 22px 16px' }}>
                <h2 style={{ margin: '0 0 8px', fontFamily: P.font, ...P.text.h2, color: P.colors.ink }}>Delete this resume?</h2>
                <p style={{ margin: 0, fontFamily: P.font, ...P.text.body, color: P.colors.body }}>
                  This cannot be undone. Any applications built from it stay in your tracker.
                </p>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: 8,
                padding: '12px 22px', borderTop: `1px solid ${P.colors.hairline}`, background: P.colors.subtle,
              }}>
                <NextButton variant="ghost" label="Cancel" />
                <NextButton variant="danger" label="Delete" />
              </div>
            </div>
          </Stage>
        }
      />
    </Section>
  );
}

/* ── 09 · Loading ───────────────────────────────────────────────────── */

export function SectionLoading() {
  return (
    <Section
      n="09"
      title="Loading and progress"
      lead="JobHub waits a lot: resume parsing, fit checks, generation, interview prep. Loading is a first class state here, not an afterthought, and right now it is handled six different ways."
    >
      <Item
        n="09.1"
        title="The waiting states"
        note="Today: a text swap to 'Loading…', a full page ProcessingScreen, a bespoke GenerationProgress, and several inline spinners."
        verdict="Four defined waits, chosen by how long the wait is: inline spinner (under 1s), button loading (1 to 3s), skeleton (3 to 10s), narrated progress (over 10s)."
        now={
          <Stage>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <button disabled style={{ background: `${warm.colors.accentPetrol}80`, color: '#fff', border: 'none', borderRadius: 10, padding: '14px 28px', fontSize: '0.9375rem', fontWeight: 600, fontFamily: warm.type.fontBody }}>Loading…</button>
              </div>
              <div style={{ fontSize: 12.5, color: '#B3261E', lineHeight: 1.6 }}>
                No skeleton exists anywhere in the app. Long waits show either a spinner
                or a blank screen until the data lands.
              </div>
            </div>
          </Stage>
        }
        next={
          <div style={{ display: 'grid', gap: 18 }}>
            <Pin label="under 1s · inline spinner" wide>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: P.font, fontSize: 13, color: P.colors.muted }}>
                <Spinner size={13} color={P.colors.muted} /> Checking
              </span>
            </Pin>
            <Pin label="1 to 3s · button" wide><NextButton state="loading" /></Pin>
            <Pin label="3 to 10s · skeleton" wide>
              <div style={{ width: '100%', maxWidth: 300 }}>
                {[100, 76, 88].map((w, i) => (
                  <div key={i} style={{
                    height: 11, width: `${w}%`, borderRadius: 4, marginBottom: 8,
                    background: `linear-gradient(90deg, ${P.colors.subtle} 25%, #EDF1F6 37%, ${P.colors.subtle} 63%)`,
                    backgroundSize: '400% 100%', animation: 'sg-shimmer 1.4s ease infinite',
                  }} />
                ))}
              </div>
            </Pin>
            <Pin label="over 10s · narrated" wide>
              <div style={{ width: '100%', maxWidth: 300 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, fontFamily: P.font, fontSize: 13, color: P.colors.ink }}>
                  <span>Reading the job description</span>
                  <span style={{ color: P.colors.muted, fontFamily: CHROME.mono, fontSize: 12 }}>2 of 4</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: P.colors.subtle, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '50%', background: P.colors.accent, borderRadius: 999 }} />
                </div>
              </div>
            </Pin>
          </div>
        }
      />
    </Section>
  );
}

/* ── 10 · Empty and error ───────────────────────────────────────────── */

export function SectionEmpty() {
  return (
    <Section
      n="10"
      title="Empty and error states"
      lead="A new client sees empty states before they see anything else: no applications, no documents, no answers banked. These are the first impression of the product and they are currently the least designed screens in it."
    >
      <Item
        n="10.1"
        title="Empty state"
        verdict="One shape: a quiet line of text, one sentence of why it is empty, and exactly one action. No illustration, no icon circle."
        now={
          <Stage>
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <p style={{ margin: 0, fontFamily: warm.type.fontBody, fontSize: 13, color: warm.colors.textMuted }}>
                No applications yet.
              </p>
            </div>
            <Spec>{`Most empty states in the app are a
single muted sentence with no action,
or nothing at all.`}</Spec>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ textAlign: 'center', padding: '26px 12px' }}>
              <h4 style={{ margin: '0 0 6px', fontFamily: P.font, ...P.text.h3, color: P.colors.ink }}>Nothing tracked yet</h4>
              <p style={{ margin: '0 auto 16px', fontFamily: P.font, ...P.text.small, color: P.colors.muted, maxWidth: 300 }}>
                Applications you run through Fit Check land here automatically, with their score and status.
              </p>
              <NextButton size="sm" label="Run your first check" />
            </div>
          </Stage>
        }
      />

      <Item
        n="10.2"
        title="Inline error"
        note="What the user sees when a generation fails or the server is unreachable."
        verdict="A bordered strip in danger tone with a stated cause and a retry. Never a bare red sentence."
        now={
          <Stage>
            <p style={{ margin: 0, fontFamily: warm.type.fontBody, fontSize: 13, color: warm.colors.danger }}>
              Something went wrong. Please try again.
            </p>
          </Stage>
        }
        next={
          <Stage>
            <div style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              background: P.colors.dangerSoft, border: `1px solid #F2C9C5`,
              borderRadius: P.radius.md, padding: '12px 14px',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: P.font, fontSize: 13.5, fontWeight: P.weight.semibold, color: '#7E1B15', marginBottom: 3 }}>
                  We could not read that job ad
                </div>
                <div style={{ fontFamily: P.font, ...P.text.small, color: '#7E1B15' }}>
                  The page needed a login. Paste the description text instead.
                </div>
              </div>
              <NextButton size="sm" variant="secondary" label="Retry" />
            </div>
          </Stage>
        }
      />
    </Section>
  );
}

/* ── 11 · Tables and lists ──────────────────────────────────────────── */

const ROWS = [
  ['Senior Data Analyst', 'Woolworths Group', 'Interviewing', '82%'],
  ['Business Analyst', 'NAB', 'Applied', '74%'],
  ['Reporting Analyst', 'Telstra', 'Closed', '41%'],
];

export function SectionTables() {
  return (
    <Section
      n="11"
      title="Tables and lists"
      lead="The tracker, the document library and the sponsor list are all tables, and none of them share a single line of styling."
    >
      <Item
        n="11.1"
        title="Data table"
        verdict="Header uses the micro type step on the subtle fill, rows are hairline separated with no vertical rules, and the row hover is a subtle fill rather than a border change."
        now={
          <Stage>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: warm.type.fontBody }}>
              <thead>
                <tr style={{ background: warm.colors.bgAlt }}>
                  {['Role', 'Company', 'Status', 'Fit'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 800, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${warm.colors.borderWhisper}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(r => (
                  <tr key={r[0]}>
                    {r.map((c, i) => (
                      <td key={i} style={{ padding: '9px 10px', fontSize: 12, color: i === 0 ? warm.colors.textPrimary : warm.colors.textSecondary, fontWeight: i === 0 ? 700 : 400, borderBottom: `1px solid ${warm.colors.borderWhisper}` }}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Stage>
        }
        next={
          <Stage>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: P.font }}>
              <thead>
                <tr style={{ background: P.colors.subtle }}>
                  {['Role', 'Company', 'Status', 'Fit'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 12px', ...P.text.micro, color: P.colors.muted, borderBottom: `1px solid ${P.colors.hairline}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, ri) => (
                  <tr key={r[0]} style={{ background: ri === 1 ? P.colors.subtle : 'transparent' }}>
                    {r.map((c, i) => (
                      <td key={i} style={{
                        padding: '11px 12px', fontSize: 14,
                        color: i === 0 ? P.colors.ink : P.colors.body,
                        fontWeight: i === 0 ? P.weight.semibold : P.weight.regular,
                        borderBottom: `1px solid ${P.colors.hairline}`,
                      }}>
                        {i === 2 ? <NextBadge tone={c === 'Interviewing' ? 'success' : c === 'Closed' ? 'neutral' : 'accent'} label={c} /> : c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <Spec>{`Row 2 shows the hover fill pinned.`}</Spec>
          </Stage>
        }
      />
    </Section>
  );
}

/* ── 12 · Navigation ────────────────────────────────────────────────── */

export function SectionNav() {
  const items = ['Strategy', 'Fit Check', 'Apply', 'Tracker', 'Documents'];
  return (
    <Section
      n="12"
      title="Navigation"
      lead="The sidebar in DashboardLayout is the one piece of chrome a client sees on every screen, so its active state sets the tone for the whole product."
    >
      <Item
        n="12.1"
        title="Sidebar item"
        verdict="Active becomes an accentSoft fill with accent text, not a solid blue bar. Solid blue is reserved for buttons, so nav stops competing with the action on the page."
        now={
          <Stage>
            <div style={{ width: 190 }}>
              {items.map((it, i) => (
                <div key={it} style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 10,
                  background: i === 1 ? warm.colors.accentPetrol : 'transparent',
                  color: i === 1 ? '#fff' : warm.colors.textSecondary,
                  fontFamily: warm.type.fontBody, fontSize: 13, fontWeight: i === 1 ? 700 : 500, marginBottom: 2,
                }}>{it}</div>
              ))}
            </div>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ width: 190 }}>
              {items.map((it, i) => (
                <div key={it} style={{
                  display: 'flex', alignItems: 'center', gap: 9, height: 36, padding: '0 12px', borderRadius: P.radius.md,
                  background: i === 1 ? P.colors.accentSoft : i === 3 ? P.colors.subtle : 'transparent',
                  color: i === 1 ? P.colors.accent : P.colors.body,
                  fontFamily: P.font, fontSize: 14, fontWeight: i === 1 ? P.weight.semibold : P.weight.medium, marginBottom: 2,
                }}>{it}</div>
              ))}
            </div>
            <Spec>{`Row 2 is active. Row 4 is hover, pinned.`}</Spec>
          </Stage>
        }
      />

      <Item
        n="12.2"
        title="Tabs"
        verdict="One tab pattern: an underline on the active tab. The pill style and the boxed style both go."
        now={
          <Stage>
            <div style={{ display: 'flex', gap: 6 }}>
              {['Resume', 'Cover letter', 'Outreach'].map((t, i) => (
                <button key={t} style={{
                  background: i === 0 ? warm.colors.bgAlt : 'transparent',
                  border: `1px solid ${i === 0 ? warm.colors.borderDefined : 'transparent'}`,
                  borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: i === 0 ? 700 : 600,
                  color: i === 0 ? warm.colors.textPrimary : '#6b7280', fontFamily: warm.type.fontBody, cursor: 'pointer',
                }}>{t}</button>
              ))}
            </div>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ display: 'flex', gap: 22, borderBottom: `1px solid ${P.colors.hairline}` }}>
              {['Resume', 'Cover letter', 'Outreach'].map((t, i) => (
                <button key={t} style={{
                  background: 'none', border: 'none', padding: '0 0 10px', cursor: 'pointer',
                  fontFamily: P.font, fontSize: 14, fontWeight: i === 0 ? P.weight.semibold : P.weight.medium,
                  color: i === 0 ? P.colors.ink : P.colors.muted,
                  boxShadow: i === 0 ? `inset 0 -2px 0 ${P.colors.accent}` : 'none',
                }}>{t}</button>
              ))}
            </div>
          </Stage>
        }
      />
    </Section>
  );
}

/* ── 13 · Toasts ────────────────────────────────────────────────────── */

export function SectionToasts() {
  return (
    <Section
      n="13"
      title="Toasts"
      lead={
        <>
          One line in <code style={{ fontFamily: CHROME.mono, fontSize: 12.5 }}>App.tsx</code> configures every toast in the product:{' '}
          <code style={{ fontFamily: CHROME.mono, fontSize: 12.5 }}>&lt;Toaster richColors position="top-right" theme="dark" /&gt;</code>.
          It is set to dark, on a white product.
        </>
      }
    >
      <Item
        n="13.1"
        title="Toast"
        verdict={<>Change <code style={{ fontFamily: CHROME.mono, fontSize: 12 }}>theme="dark"</code> to light and move to bottom-right, so a toast never lands on the sidebar or the page title. One line changed, every toast fixed.</>}
        now={
          <Stage tint={CHROME.page}>
            <div style={{
              background: '#18181b', color: '#fafafa', borderRadius: 8, padding: '13px 16px',
              fontFamily: warm.type.fontBody, fontSize: 13, maxWidth: 300, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
              Resume saved
            </div>
            <Spec>{`Dark chrome on a white product,
top-right, where it covers the
page heading.`}</Spec>
          </Stage>
        }
        next={
          <Stage tint={CHROME.page}>
            <div style={{ display: 'grid', gap: 8, maxWidth: 300 }}>
              {[
                ['Resume saved', P.colors.success],
                ['Could not reach the server', P.colors.danger],
              ].map(([msg, fg]) => (
                <div key={msg} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#fff', border: `1px solid ${P.colors.line}`, borderLeft: `3px solid ${fg}`,
                  borderRadius: P.radius.md, padding: '11px 14px', boxShadow: P.shadow.lifted,
                  fontFamily: P.font, fontSize: 14, color: P.colors.ink,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: fg, flexShrink: 0 }} />
                  {msg}
                </div>
              ))}
            </div>
          </Stage>
        }
      />
    </Section>
  );
}

/* ── 14 · Stepper ───────────────────────────────────────────────────── */

const RAIL_STEPS = [
  { id: 'job', label: 'Job' },
  { id: 'fit', label: 'Fit' },
  { id: 'resume', label: 'Resume' },
  { id: 'letter', label: 'Letter' },
  { id: 'track', label: 'Track' },
];

export function SectionStepper() {
  const [i, setI] = useState(2);
  const steps = ['Job', 'Fit', 'Resume', 'Letter', 'Send'];

  return (
    <Section
      n="14"
      title="The apply stepper"
      lead="StepperWorkspace is where a client spends most of their time, and its progress indicator is the thing that tells them how much is left. Numbers and circles are kept. What changed is that colour now carries state instead of decorating it."
    >
      <Item
        n="14.1"
        title="Step rail"
        note="Live. Step through it with the buttons underneath: the gold disc is a single element with a shared layout id, so it travels between circles rather than blinking off one and onto the next."
        verdict={
          <>
            <strong style={{ color: '#C9901A' }}>Gold</strong> is where you are, one per rail.{' '}
            <strong style={{ color: '#1257C4' }}>Blue</strong> is banked, with the tick stroked on and the connector
            filled left to right. Grey is not yet. The arrival pulse plays twice and stops.
          </>
        }
        now={
          <Stage>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {steps.map((s, idx) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: idx <= 1 ? warm.colors.accentPetrol : '#F5F7FA',
                    color: idx <= 1 ? '#fff' : '#6B7280',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, fontFamily: P.font,
                  }}>{idx + 1}</div>
                  {idx < steps.length - 1 && <div style={{ width: 18, height: 2, background: '#E5E9F0' }} />}
                </div>
              ))}
            </div>
            <Spec>{`No labels, so the numbers mean nothing
until you have counted them. Nothing
distinguishes "done" from "not yet"
except fill, and the fill is the same
blue as every button on the screen.`}</Spec>
          </Stage>
        }
        next={
          <Stage>
            <StepRail
              steps={RAIL_STEPS}
              currentIndex={i}
              onSelect={setI}
              canSelect={() => true}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Button size="sm" variant="secondary" label="Back" onClick={() => setI(v => Math.max(0, v - 1))} />
              <Button size="sm" label="Next step" onClick={() => setI(v => Math.min(RAIL_STEPS.length - 1, v + 1))} />
            </div>
          </Stage>
        }
      />
    </Section>
  );
}

/* ── 17 · Feedback and celebration ──────────────────────────────────── */

export function SectionFeedback() {
  const [errored, setErrored] = useState('');
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(true);

  return (
    <Section
      n="17"
      title="Feedback, impact and celebration"
      lead="The rule the whole system runs on: good news overshoots, bad news does not. A success springs past its resting point and settles back, which reads as physical and warm. An error is lateral and damped, which reads as a wall. The two must never be confusable out of the corner of your eye."
    >
      <Item
        n="17.1"
        title="The celebration"
        note="Fires when an application is filed, and is reserved for things at roughly that weight. Press the button to play it."
        verdict="Light scrim rather than dark, because good news should brighten the page. The disc overshoots, the ring draws itself, the tick strokes on, a bloom ring carries the impact, and a chip flies out to wherever the thing landed."
        now={
          <Stage>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: '#B3261E' }}>
              Nothing. Finishing an application showed a static card headed "Nice work.
              This one is in your tracker." There was no moment, and nothing on screen
              connected the finish to the tracker it landed in.
            </p>
          </Stage>
        }
        next={
          <Stage>
            <Button
              label="Play the celebration"
              onClick={() => celebrate({
                title: 'Application filed',
                subtitle: 'Senior Data Analyst at Woolworths Group is in your tracker, dated today.',
                land: { label: 'Applications', target: 'tracker' },
              })}
            />
            <Spec>{`0.00  scrim brightens
0.05  disc springs in, overshoots
0.08  ring draws itself
0.24  tick strokes on
0.22  bloom ring expands and dies
0.44  headline rises
0.53  subtitle rises
1.25  chip flies to the sidebar
2.60  ends

Click anywhere to end it early.
Under prefers-reduced-motion it holds
as a still card for 1.6s instead.`}</Spec>
          </Stage>
        }
      />

      <Item
        n="17.2"
        title="Bad news"
        note="Type anything and clear it to trigger the error. The field shakes once, laterally, and stops."
        verdict="420ms, damped, no bounce. Colour and copy do the rest. An error that bounces reads as playful, which is the wrong feeling for a failed generation."
        now={
          <Stage>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: '#B3261E' }}>
              A red sentence appeared under the field. Nothing moved, so on a long
              form the error could appear off screen and never be noticed.
            </p>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ maxWidth: 300 }}>
              <Input
                label="Email"
                value={errored}
                onChange={setErrored}
                placeholder="you@example.com"
                error={errored.length > 0 && !errored.includes('@') ? 'Enter a valid email address' : undefined}
                hint="Type a few characters without an @ to see it."
              />
            </div>
          </Stage>
        }
      />

      <Item
        n="17.3"
        title="Tactile response"
        note="Every pressable surface in the product now presses. Hold the mouse down on any of these."
        verdict="0.97 on press, released on a stiff spring. Under 100ms of travel: enough to register contact, not enough to read as an animation. Buttons, cards, checkboxes, toggles and step circles all use the same spring."
        now={
          <Stage>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: '#B3261E' }}>
              Primary lifted 1px on hover and scaled 0.99 on press. Nothing else in
              the product responded to being pressed at all.
            </p>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <Button label="Primary" />
              <Button variant="secondary" label="Secondary" />
              <Button variant="ghost" label="Ghost" />
              <Button variant="danger" label="Delete" />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'center' }}>
              <Checkbox checked={checked} onChange={setChecked} label="Checkbox" />
              <Toggle on={on} onChange={setOn} label="Toggle" />
            </div>
          </Stage>
        }
      />

      <Item
        n="17.4"
        title="Waiting"
        note="Skeletons did not exist anywhere in the product. Long waits showed a spinner or a blank screen."
        verdict="A skeleton is a promise about the shape of what is coming, so these are sized to the real content rather than being generic bars. Shimmer runs in 1.4s: slower reads as broken, faster reads as anxious."
        now={
          <Stage>
            <Button loading label="Loading" />
            <Spec>{`This, or nothing.`}</Spec>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ display: 'grid', gap: 14, maxWidth: 320 }}>
              <Button loading label="Save" loadingLabel="Working" />
              <SkeletonCard lines={3} />
            </div>
          </Stage>
        }
      />
    </Section>
  );
}

/* ── 15 · Motion ────────────────────────────────────────────────────── */

export function SectionMotion() {
  return (
    <Section
      n="15"
      title="Motion"
      lead="32 distinct transition declarations are in use, from 'all 0.15s' to bespoke cubic beziers. Framer Motion is loaded and used for page and modal transitions, which is right. Everything else should be CSS."
    >
      <Item
        n="15.1"
        title="Durations and curve"
        verdict="Three durations and one curve. 'transition: all' is banned, since it animates layout properties by accident and is the usual cause of a janky hover."
        now={
          <Stage>
            <Spec>{`'all 0.15s'              9 uses
'border-color 0.15s'     6
'color 180ms ease'       4
'background 0.15s'       4
'all 150ms'              3
'transform 0.15s'        3
... 26 more`}</Spec>
          </Stage>
        }
        next={
          <Stage>
            <Spec>{`fast  ${P.motion.fast}   hover, focus, colour changes
base  ${P.motion.base}   panels opening, tabs, toasts
slow  ${P.motion.slow}   route changes, modals

ease  ${P.motion.ease}

Always name the property:
  transition: background 120ms <ease>
Never:
  transition: all 150ms`}</Spec>
          </Stage>
        }
      />
    </Section>
  );
}

/* ── 16 · Icons ─────────────────────────────────────────────────────── */

export function SectionIcons() {
  return (
    <Section
      n="16"
      title="Icons"
      lead="lucide-react is already the icon set and it is a good one. The only rule missing is size."
    >
      <Item
        n="16.1"
        title="Icon sizing"
        verdict="Three sizes: 14 beside small text, 16 beside body text and in buttons, 20 standalone. Icons take the colour of the text they sit with, never their own."
        now={
          <Stage>
            <Spec>{`Sizes found inline: 11, 12, 13, 14, 15,
16, 17, 18, 20, 22, 24, 28, 32, 36, 40, 44.

Several are coloured independently of
their label, which is why some rows read
as two-tone.`}</Spec>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
              {[[14, 'small'], [16, 'body'], [20, 'standalone']].map(([sz, l]) => (
                <div key={String(l)} style={{ textAlign: 'center' }}>
                  <svg width={sz as number} height={sz as number} viewBox="0 0 24 24" fill="none" stroke={P.colors.body} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <div style={{ fontFamily: CHROME.mono, fontSize: 10, color: CHROME.faint, marginTop: 6 }}>{sz as number}</div>
                  <div style={{ fontSize: 10.5, color: CHROME.muted }}>{l as string}</div>
                </div>
              ))}
            </div>
          </Stage>
        }
      />
    </Section>
  );
}
