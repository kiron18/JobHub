/**
 * /dev/engagement-preview — every new engagement piece in one place:
 * pulsing brain icon + growth-tree popup, today's-ritual next-action card,
 * the week's multi-level completion strip, milestone splash screens, and
 * the quick quiz. All mock data, all local state — nothing here calls the
 * real API or touches a real account, same intent as /dev/trial-preview.
 *
 * Not linked from anywhere in the app's nav. Visit the URL directly.
 */
import { useState } from 'react';
import { Flame, Trophy, Sparkles as SparklesIcon } from 'lucide-react';
import { warm } from '../lib/theme/warmTokens';
import { PulsingBrainIcon } from '../components/engagement/PulsingBrainIcon';
import { BrainPopup } from '../components/engagement/BrainPopup';
import { TreeAvatar } from '../components/engagement/TreeAvatar';
import { TodaysRitual, type RitualTask } from '../components/engagement/TodaysRitual';
import { type RitualDay } from '../components/engagement/WeekRitualRow';
import { MomentSplash } from '../components/engagement/MomentSplash';
import { QuickQuiz } from '../components/engagement/QuickQuiz';
import { type DayCompletionTier } from '../lib/dayCompletion';

const C = warm.colors;

const TASKS: RitualTask[] = [
  { title: 'Apply to 3 roles matching your profile', detail: 'Pulled from your target-role list. Takes about 12 minutes.', ctaLabel: 'Browse matches' },
  { title: 'Send 2 outreach messages', detail: 'A short note to someone at a company you\'ve already applied to.', ctaLabel: 'Open templates' },
  { title: 'Update one resume bullet', detail: 'Pick the strongest thing you did this week and quantify it.', ctaLabel: 'Edit resume' },
];

const TIER_CYCLE: DayCompletionTier[] = ['none', 'started', 'goal', 'exceeded'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
  // ── Section 1: brain + tree ──
  const [seed, setSeed] = useState(1337);
  const [programDay, setProgramDay] = useState(58);
  const [applications, setApplications] = useState(38);
  const [outreach, setOutreach] = useState(21);
  const [interviews, setInterviews] = useState(3);
  const [streak, setStreak] = useState(4);
  const [absenceDays, setAbsenceDays] = useState(0);
  const [daysActive, setDaysActive] = useState(24);
  const [popupOpen, setPopupOpen] = useState(false);

  const slider = (value: number, set: (n: number) => void, min: number, max: number) => (
    <input type="range" min={min} max={max} value={value} onChange={e => set(Number(e.target.value))} style={{ width: '100%', accentColor: C.accentPetrol }} />
  );

  // ── Section 2: today's ritual + week strip ──
  const [taskIndex, setTaskIndex] = useState(0);
  const [taskDone, setTaskDone] = useState<boolean[]>([false, false, false]);
  const [week, setWeek] = useState<RitualDay[]>([
    { label: DAY_LABELS[0], tier: 'goal' },
    { label: DAY_LABELS[1], tier: 'exceeded' },
    { label: DAY_LABELS[2], tier: 'started' },
    { label: DAY_LABELS[3], tier: 'goal', isToday: true },
    { label: DAY_LABELS[4], tier: 'none', isFuture: true },
    { label: DAY_LABELS[5], tier: 'none', isFuture: true },
    { label: DAY_LABELS[6], tier: 'none', isFuture: true },
  ]);
  const cycleDay = (i: number) => setWeek(w => w.map((d, idx) => {
    if (idx !== i || d.isFuture) return d;
    const next = TIER_CYCLE[(TIER_CYCLE.indexOf(d.tier) + 1) % TIER_CYCLE.length];
    return { ...d, tier: next };
  }));
  const markTaskDone = () => {
    setTaskDone(td => td.map((v, i) => i === taskIndex ? true : v));
    if (taskIndex < TASKS.length - 1) setTaskIndex(taskIndex + 1);
  };

  // ── Section 3: moment splashes ──
  const [splash, setSplash] = useState<'streak' | 'week' | 'stage' | null>(null);
  const SPLASH_CONFIG = {
    streak: { icon: Flame, eyebrow: '7-DAY STREAK', title: 'Gold tier unlocked', subtitle: 'A full week without missing a day. That doesn\'t happen by accident.' },
    week: { icon: Trophy, eyebrow: 'WEEK COMPLETE', title: 'Week 4, done', subtitle: 'Every day at goal or better. Next week\'s target is already set.' },
    stage: { icon: SparklesIcon, eyebrow: 'TREE GREW', title: 'Full Canopy reached', subtitle: 'Day 58 of 90 — your tree just filled out. Fruit means interviews; it\'s been quiet on that front.' },
  } as const;

  // ── Section 4: quiz ──
  const [quizKey, setQuizKey] = useState(0);

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1000, margin: '0 auto', background: '#f4f4f4', minHeight: '100vh', fontFamily: warm.type.fontBody }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Engagement kit — every piece</h1>
      <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 32, maxWidth: 640 }}>
        Mock data + local state only. Nothing here calls the real API. All copy below is placeholder —
        flagged inline in the source — for you to review in one batch later.
      </p>

      {/* ── 1. Brain + tree ───────────────────────────────────────────── */}
      <SectionTitle>1. Pulsing brain → growth-tree popup</SectionTitle>
      <SectionNote>Daily (leaves today), medium (fruit + flowers), long-term (canopy stage) read off one visual.</SectionNote>
      <Panel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 14,
              background: C.bgAlt, border: `1px solid ${C.borderWhisper}`, marginBottom: 20,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, flex: 1 }}>Mock dashboard header</span>
              <span style={{ fontSize: 11, color: C.textMuted }}>Day {programDay} / 90</span>
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
            <button onClick={() => setPopupOpen(true)} style={{ width: '100%', marginTop: 6, padding: '10px 16px', borderRadius: 10, border: 'none', background: C.accentPetrol, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Open brain popup
            </button>
          </aside>
        </div>
      </Panel>

      {/* ── 2. Today's ritual ─────────────────────────────────────────── */}
      <SectionTitle>2. Today's ritual — the "never wonder what to do" card</SectionTitle>
      <SectionNote>One task, not a list. Click a day's dot in the week strip to cycle its completion level (none → started → goal → exceeded).</SectionNote>
      <Panel>
        <div style={{ maxWidth: 420 }}>
          <TodaysRitual
            taskIndex={taskIndex}
            taskCount={TASKS.length}
            task={{ ...TASKS[taskIndex], done: taskDone[taskIndex] }}
            onAct={markTaskDone}
            week={week}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {week.map((d, i) => (
              <button key={i} onClick={() => cycleDay(i)} disabled={d.isFuture} style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 6, border: `1px solid ${C.borderWhisper}`,
                background: '#fff', cursor: d.isFuture ? 'default' : 'pointer', opacity: d.isFuture ? 0.4 : 1,
              }}>
                cycle {d.label}
              </button>
            ))}
            <button onClick={() => { setTaskIndex(0); setTaskDone([false, false, false]); }} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: `1px solid ${C.borderWhisper}`, background: '#fff', cursor: 'pointer' }}>
              reset tasks
            </button>
          </div>
        </div>
      </Panel>

      {/* ── 3. Moment splashes ────────────────────────────────────────── */}
      <SectionTitle>3. Milestone splash screens (generalized from the trial's "Congrats!")</SectionTitle>
      <SectionNote>Same shell, three triggers. Each pulls a bonus tip from the shared no-repeat bank — refresh and reopen the same one to see it rotate.</SectionNote>
      <Panel>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setSplash('streak')} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: C.accentPetrol, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
            Trigger: streak milestone
          </button>
          <button onClick={() => setSplash('week')} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: C.accentPetrol, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
            Trigger: week complete
          </button>
          <button onClick={() => setSplash('stage')} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: C.accentPetrol, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
            Trigger: tree stage-up
          </button>
        </div>
      </Panel>

      {/* ── 4. Quick quiz ─────────────────────────────────────────────── */}
      <SectionTitle>4. Quick quiz</SectionTitle>
      <SectionNote>Under 10 seconds. Cadence (how often this shows, and whether it ramps up) isn't built — this is the component by itself.</SectionNote>
      <Panel>
        <div style={{ maxWidth: 420 }}>
          <QuickQuiz key={quizKey} />
          <button onClick={() => setQuizKey(k => k + 1)} style={{ marginTop: 10, padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.borderWhisper}`, background: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
            New question
          </button>
        </div>
      </Panel>

      <BrainPopup
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        seed={seed}
        programDay={programDay}
        interviews={interviews}
        absenceDays={absenceDays}
        stats={{ applications, outreach, daysActive, streak }}
      />

      {splash && (
        <MomentSplash
          open={!!splash}
          onContinue={() => setSplash(null)}
          icon={SPLASH_CONFIG[splash].icon}
          eyebrow={SPLASH_CONFIG[splash].eyebrow}
          title={SPLASH_CONFIG[splash].title}
          subtitle={SPLASH_CONFIG[splash].subtitle}
        />
      )}
    </div>
  );
}
