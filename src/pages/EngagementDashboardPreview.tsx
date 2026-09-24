/**
 * /dev/engagement-dashboard — the engagement pieces inside the REAL app
 * shell (DashboardLayout: actual sidebar, actual scroll container), laid
 * out where they'd actually sit on the real dashboard (StrategyHub),
 * replacing DailyProgressBar + WeekStrip with TodaysRitual + WeekRitualRow
 * in the same spot. This is "what a user would see," not a component kit —
 * see /dev/engagement-preview for the slider-driven version of each piece
 * in isolation.
 *
 * Still mock data + local state only — DashboardLayout's own /profile and
 * /jobs fetches will fail against a real API (expected, harmless, same as
 * every other /dev/* preview) and just render their empty-state fallbacks.
 *
 * Not linked from anywhere in the app's nav. Visit the URL directly.
 */
import { useState } from 'react';
import { Flame, Trophy, Sparkles as SparklesIcon, Search } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { warm } from '../lib/theme/warmTokens';
import { PulsingBrainIcon } from '../components/engagement/PulsingBrainIcon';
import { BrainPopup } from '../components/engagement/BrainPopup';
import { TodaysRitual, type RitualTask } from '../components/engagement/TodaysRitual';
import { type RitualDay } from '../components/engagement/WeekRitualRow';
import { MomentSplash } from '../components/engagement/MomentSplash';
import { QuickQuiz } from '../components/engagement/QuickQuiz';

const warmT = {
  text: warm.colors.textPrimary,
  textMuted: warm.colors.textSecondary,
  card: warm.colors.bgSurface,
  cardBorder: warm.colors.borderWhisper,
  inputBorder: warm.colors.borderDefined,
};

const TASKS: RitualTask[] = [
  { title: 'Apply to 3 roles matching your profile', detail: 'Pulled from your target-role list. Takes about 12 minutes.', ctaLabel: 'Browse matches' },
  { title: 'Send 2 outreach messages', detail: 'A short note to someone at a company you\'ve already applied to.', ctaLabel: 'Open templates' },
  { title: 'Update one resume bullet', detail: 'Pick the strongest thing you did this week and quantify it.', ctaLabel: 'Edit resume' },
];

const SPLASH_CONFIG = {
  streak: { icon: Flame, eyebrow: '7-DAY STREAK', title: 'Gold tier unlocked', subtitle: 'A full week without missing a day. That doesn\'t happen by accident.' },
  week: { icon: Trophy, eyebrow: 'WEEK COMPLETE', title: 'Week 4, done', subtitle: 'Every day at goal or better. Next week\'s target is already set.' },
  stage: { icon: SparklesIcon, eyebrow: 'TREE GREW', title: 'Full Canopy reached', subtitle: 'Day 58 of 90 — your tree just filled out. Fruit means interviews; it\'s been quiet on that front.' },
} as const;

export default function EngagementDashboardPreview() {
  // Mock account — stands in for /profile, /tracker/goal, /tracker/activity.
  const [applications] = useState(38);
  const [outreach] = useState(21);
  const [interviews] = useState(3);
  const [streak, setStreak] = useState(4);
  const [daysActive] = useState(24);
  const [programDay] = useState(58);
  const seed = 1337;

  const [popupOpen, setPopupOpen] = useState(false);
  const [taskIndex, setTaskIndex] = useState(0);
  const [taskDone, setTaskDone] = useState<boolean[]>([false, false, false]);
  const [week] = useState<RitualDay[]>([
    { label: 'S', tier: 'goal' },
    { label: 'M', tier: 'exceeded' },
    { label: 'T', tier: 'started' },
    { label: 'W', tier: 'goal', isToday: true },
    { label: 'T', tier: 'none', isFuture: true },
    { label: 'F', tier: 'none', isFuture: true },
    { label: 'S', tier: 'none', isFuture: true },
  ]);
  const [splash, setSplash] = useState<keyof typeof SPLASH_CONFIG | null>(null);
  const [quizKey, setQuizKey] = useState(0);

  const markTaskDone = () => {
    setTaskDone(td => td.map((v, i) => i === taskIndex ? true : v));
    if (taskIndex < TASKS.length - 1) {
      setTaskIndex(taskIndex + 1);
    } else {
      // Last task of the day, done — this is the natural moment a real
      // "day complete" celebration would fire. Simulated here since a mock
      // page can't actually cross a real streak threshold.
      setStreak(s => s + 1);
      setSplash('streak');
    }
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, padding: '8px 14px',
          borderRadius: 10, background: `${warm.colors.accentGoldBright}12`, border: `1px solid ${warm.colors.accentGoldBright}30`,
        }}>
          <span style={{ ...warm.text.micro, color: warm.colors.accentGoldBright }}>Preview</span>
          <span style={{ fontSize: 11.5, color: warmT.textMuted }}>
            Proposed engagement changes, shown in the real app shell. Mock data — nothing here is live.
          </span>
        </div>

        {/* ── HubHeader, as it exists today, plus the new brain icon ──────── */}
        <header style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: warmT.textMuted }}>
            Marketing Coordinator · Sydney
          </p>
          <PulsingBrainIcon streak={streak} onClick={() => setPopupOpen(true)} />
        </header>

        {/* ── Today's ritual + week strip, replacing DailyProgressBar + WeekStrip in this exact spot ── */}
        <div style={{ marginBottom: 32 }}>
          <TodaysRitual
            taskIndex={taskIndex}
            taskCount={TASKS.length}
            task={{ ...TASKS[taskIndex], done: taskDone[taskIndex] }}
            onAct={markTaskDone}
            week={week}
          />
        </div>

        {/* ── Paste/Apply section — visual stand-in only, unchanged by this work ── */}
        <div style={{
          marginBottom: 40, background: warmT.card, border: `1px solid ${warmT.cardBorder}`,
          borderRadius: 16, padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Search size={14} color={warmT.textMuted} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: warmT.textMuted }}>Paste a job ad or Seek link</span>
          </div>
          <div style={{
            height: 88, borderRadius: 10, border: `1px solid ${warmT.inputBorder}`,
            background: warm.colors.bgAlt, marginBottom: 12,
          }} />
          <div style={{ fontSize: 11, color: warmT.textMuted }}>
            Unchanged by this work — shown only to keep the layout honest.
          </div>
        </div>

        {/* ── Quick quiz, slotted into the feed where StaleApplicationsCard sits ── */}
        <div style={{ marginBottom: 32 }}>
          <QuickQuiz key={quizKey} onAnswered={() => setTimeout(() => setQuizKey(k => k + 1), 1400)} />
        </div>

        <p style={{ fontSize: 11, color: warmT.textMuted, textAlign: 'center' }}>
          Preview only — simulate a rarer milestone:{' '}
          <button onClick={() => setSplash('week')} style={{ background: 'none', border: 'none', padding: 0, color: warm.colors.accentPetrol, fontWeight: 700, cursor: 'pointer', fontSize: 11 }}>
            week complete
          </button>
          {' · '}
          <button onClick={() => setSplash('stage')} style={{ background: 'none', border: 'none', padding: 0, color: warm.colors.accentPetrol, fontWeight: 700, cursor: 'pointer', fontSize: 11 }}>
            tree stage-up
          </button>
        </p>
      </div>

      <BrainPopup
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        seed={seed}
        programDay={programDay}
        interviews={interviews}
        absenceDays={0}
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
    </DashboardLayout>
  );
}
