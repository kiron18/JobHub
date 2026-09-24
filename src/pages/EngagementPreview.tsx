/**
 * /dev/engagement-preview — each engagement piece on its own, with
 * controls, for checking states you can't easily reach in the real flow
 * (a 7-day absence, day 90, a 13th application). Mock data, local state,
 * no API calls.
 *
 * For how these look in place on the real dashboard, see
 * /dev/engagement-dashboard — that one is the product, this one is the
 * workbench.
 *
 * Not linked from anywhere in the app's nav. Visit the URL directly.
 */
import { useState } from 'react';
import { Flame } from 'lucide-react';
import { warm } from '../lib/theme/warmTokens';
import { PulsingBrainIcon } from '../components/engagement/PulsingBrainIcon';
import { BrainPopup } from '../components/engagement/BrainPopup';
import { TreeAvatar } from '../components/engagement/TreeAvatar';
import { TodaysRitual } from '../components/engagement/TodaysRitual';
import { PostApplicationPopup } from '../components/engagement/PostApplicationPopup';
import { MomentSplash } from '../components/engagement/MomentSplash';

const C = warm.colors;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px', color: C.textPrimary }}>{children}</h2>;
}
function SectionNote({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 16px', maxWidth: 560 }}>{children}</p>;
}
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: C.bgSurface, border: `1px solid ${C.borderWhisper}`, borderRadius: 16, padding: 20, marginBottom: 36 }}>
      {children}
    </div>
  );
}
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
      <label style={{ fontSize: 11.5, fontWeight: 700, color: C.textSecondary, display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        {hint && <span style={{ fontWeight: 500, color: C.textMuted }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

export default function EngagementPreview() {
  const [seed, setSeed] = useState(1337);
  const [programDay, setProgramDay] = useState(58);
  const [applications, setApplications] = useState(38);
  const [outreach, setOutreach] = useState(21);
  const [interviews, setInterviews] = useState(3);
  const [streak, setStreak] = useState(4);
  const [absenceDays, setAbsenceDays] = useState(0);
  const [daysActive, setDaysActive] = useState(24);
  const [popupOpen, setPopupOpen] = useState(false);

  const [count, setCount] = useState(1);
  const [postOpen, setPostOpen] = useState(false);
  const [splashOpen, setSplashOpen] = useState(false);

  const slider = (value: number, set: (n: number) => void, min: number, max: number) => (
    <input type="range" min={min} max={max} value={value} onChange={e => set(Number(e.target.value))} style={{ width: '100%', accentColor: C.accentPetrol }} />
  );

  return (
    <div style={{ height: '100dvh', overflowY: 'auto', overflowX: 'hidden', background: '#f4f4f4' }}>
      <div style={{ padding: '32px 24px', maxWidth: 1000, margin: '0 auto', fontFamily: warm.type.fontBody }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Engagement — the workbench</h1>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 32, maxWidth: 640 }}>
          Each piece on its own, with controls. For how they look in place, see /dev/engagement-dashboard.
          All quiz and tip copy is placeholder.
        </p>

        {/* ── 1. Brain + tree ─────────────────────────────────────────── */}
        <SectionTitle>1. Brain icon → growth-tree popup</SectionTitle>
        <SectionNote>Applications are leaves, interviews are fruit, streak grows flowers; seven days idle and it sleeps.</SectionNote>
        <Panel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 14,
                background: C.bgAlt, border: `1px solid ${C.borderWhisper}`, marginBottom: 20,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, flex: 1 }}>Header stand-in</span>
                <PulsingBrainIcon streak={streak} onClick={() => setPopupOpen(true)} />
              </div>
              <div style={{ padding: '28px 18px', borderRadius: 14, background: C.bgAlt, border: `1px solid ${C.borderWhisper}`, display: 'flex', justifyContent: 'center' }}>
                <TreeAvatar seed={seed} day={programDay} applications={applications} interviews={interviews} streak={streak} absenceDays={absenceDays} size={300} />
              </div>
            </div>
            <aside>
              <Row label="Seed" hint="shape + species + persona">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.borderWhisper}`, fontSize: 13 }} />
                  <button onClick={() => setSeed(Math.floor(Math.random() * 999999))} style={{ width: 34, borderRadius: 8, border: `1px solid ${C.borderWhisper}`, background: C.bgAlt, cursor: 'pointer' }}>🎲</button>
                </div>
              </Row>
              <Row label="Program day" hint={`${programDay} / 90`}>{slider(programDay, setProgramDay, 0, 90)}</Row>
              <Row label="Applications" hint={String(applications)}>{slider(applications, setApplications, 0, 200)}</Row>
              <Row label="Outreach" hint={String(outreach)}>{slider(outreach, setOutreach, 0, 200)}</Row>
              <Row label="Interviews" hint={String(interviews)}>{slider(interviews, setInterviews, 0, 20)}</Row>
              <Row label="Streak (days)" hint={String(streak)}>{slider(streak, setStreak, 0, 21)}</Row>
              <Row label="Days active" hint={String(daysActive)}>{slider(daysActive, setDaysActive, 0, 90)}</Row>
              <Row label="Days since last activity" hint={String(absenceDays)}>{slider(absenceDays, setAbsenceDays, 0, 14)}</Row>
            </aside>
          </div>
        </Panel>

        {/* ── 2. Ritual line ──────────────────────────────────────────── */}
        <SectionTitle>2. The ritual line</SectionTitle>
        <SectionNote>One line under the header. No button, no counter, no week strip — those already exist on the page.</SectionNote>
        <Panel>
          <TodaysRitual line="Apply to 5 roles matching your profile" detail="Paste a job ad below to start. About 12 minutes." />
        </Panel>

        {/* ── 3. The one popup ────────────────────────────────────────── */}
        <SectionTitle>3. The post-application popup</SectionTitle>
        <SectionNote>
          The only thing that fires when an application is filed. The congratulation line comes from the
          existing applause.ts ladder — drag the count to see it change at 5, 6, 10 and 13.
        </SectionNote>
        <Panel>
          <div style={{ maxWidth: 320 }}>
            <Row label="Applications filed today" hint={String(count)}>{slider(count, setCount, 1, 15)}</Row>
            <button onClick={() => setPostOpen(true)} style={{ width: '100%', padding: '10px 16px', borderRadius: 10, border: 'none', background: C.accentPetrol, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Fire the popup
            </button>
          </div>
        </Panel>

        {/* ── 4. Milestone splash ─────────────────────────────────────── */}
        <SectionTitle>4. Milestone splash <span style={{ fontWeight: 600, color: C.textMuted }}>· parked</span></SectionTitle>
        <SectionNote>
          Not on the dashboard — the dashboard has exactly one popup. Kept here for the rare
          milestones (a streak tier, a finished week) if you want it later.
        </SectionNote>
        <Panel>
          <button onClick={() => setSplashOpen(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${C.borderWhisper}`, background: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
            Preview it
          </button>
        </Panel>
      </div>

      <BrainPopup
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        seed={seed}
        programDay={programDay}
        interviews={interviews}
        absenceDays={absenceDays}
        stats={{ applications, outreach, daysActive, streak }}
      />

      <PostApplicationPopup
        open={postOpen}
        onClose={() => setPostOpen(false)}
        count={count}
        goal={5}
        streak={streak}
      />

      <MomentSplash
        open={splashOpen}
        onContinue={() => setSplashOpen(false)}
        icon={Flame}
        eyebrow="7-DAY STREAK"
        title="Gold tier unlocked"
        subtitle="A full week without missing a day. That doesn't happen by accident."
      />
    </div>
  );
}
