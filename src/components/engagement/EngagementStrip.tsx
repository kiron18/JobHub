import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MorningCommit } from './MorningCommit';
import { ChallengeIntro } from './ChallengeIntro';
import { Modal } from '../shared/Modal';
import { warm } from '../../lib/theme/warmTokens';
import api from '../../lib/api';
import { useDailyTarget } from '../../hooks/useDailyTarget';
import { StreakHeading } from './StreakHeading';
import { TodaysRitual } from './TodaysRitual';
import { ApplicationSquares } from './ApplicationSquares';
import { DayCounter, type DayState } from './DayCounter';
import { BrainPopup } from './BrainPopup';
import { TargetCommitDialog, TargetUndoDialog } from './TargetDialogs';
import { DailyProgressBar } from '../jobs/DailyProgressBar';
import { WeekStrip } from '../jobs/WeekStrip';

/* ── EngagementStrip ───────────────────────────────────────────────────
   The top of the real dashboard: the streak heading with the brain in it,
   today's ritual and its target, the row of squares, and the day counter
   with this week beside it.

   This replaces the old HubHeader plus the centred "Today's applications
   X of 5" bar and the S M T W T F S squares. Those two numbers are not
   gone — the count became the square row and the week became the dots
   under the Day chip.

   Everything is live. /tracker/engagement supplies the streak, the
   program day, the week and the tree's figures; /tracker/daily-target
   supplies the target and its lock. Until both have loaded this renders
   nothing at all rather than a skeleton: it sits above the paste box,
   which is the thing people come here to use, and a block that changes
   height as it fills would shove that box down the page under them.
*/

export interface EngagementSummary {
  streak: number;
  /** False until the one-time 90-day intro is accepted. Optional: older server. */
  challengeStarted?: boolean;
  /** Optional so an older server build still renders. */
  streakFreezes?: number;
  streakTodayDone?: boolean;
  streakFloor?: number;
  programDay: number;
  programLength: number;
  applications: number;
  interviews: number;
  outreach: number;
  daysActive: number;
  week: DayState[];
  todayIndex: number;
  treeSeed: number;
}

export function EngagementStrip() {
  const [brainOpen, setBrainOpen] = useState(false);
  const [commitDialog, setCommitDialog] = useState(false);
  const [undoDialog, setUndoDialog] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const [swapDialog, setSwapDialog] = useState(false);
  const qc = useQueryClient();
  const startChallenge = useMutation({
    mutationFn: async () => (await api.post('/tracker/challenge/start')).data as EngagementSummary,
    onSuccess: data => qc.setQueryData(['tracker-engagement'], data),
  });

  const { data: summary, isError: summaryFailed } = useQuery({
    queryKey: ['tracker-engagement'],
    queryFn: async () => (await api.get('/tracker/engagement')).data as EngagementSummary,
    staleTime: 60_000,
    // Only skip retries for an actual auth failure — see useDailyTarget.ts
    // for why a blanket retry:false turns one slow request into a
    // permanent fallback until something unrelated refetches it.
    retry: (count, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return false;
      return count < 2;
    },
  });
  const live = useDailyTarget();

  /* If either query fails — most plausibly because a migration has not
     reached this database — fall back to the bar and week strip this
     replaced rather than rendering nothing. Without this, a missing
     DailyTarget table silently removes today's progress from every
     dashboard, which is a worse outcome than the feature simply not
     being there yet. Loading renders nothing, because a flash of the old
     bar before the new strip is its own kind of broken. */
  const failed = live.isError || summaryFailed;
  if (failed) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 20, flexWrap: 'wrap', marginBottom: 32,
      }}>
        <div style={{ flex: '0 1 240px', minWidth: 180 }}>
          <DailyProgressBar />
        </div>
        <WeekStrip />
      </div>
    );
  }
  if (!summary || !live.data) return null;
  const t = live.data;

  /* The stepper is a dial until Set commits it: `pending` holds what the
     member has dialled, the server holds what they have committed to.

     The displayed number MUST be the dialled one while unlocked. An
     earlier version rendered the server's value here and wired the
     buttons to `pending`, so pressing + changed state nothing was showing
     and the stepper looked broken.

     Once locked there is nothing to dial and the server's effective
     target — already auto-raised past what has been sent — is the truth.
     While unlocked the same raise is applied locally so the number can
     never sit below work already done. */
  const dialled = pending ?? t.committed ?? t.min;
  const shown = t.locked
    ? t.target
    : Math.min(t.max, Math.max(dialled, t.filedToday));

  // Drop the dial once the server has taken the value, so a stale local
  // number cannot survive a commit or an undo.
  const clearPending = () => setPending(null);
  const commit = () => live.setTarget.mutate(shown, { onSuccess: clearPending });

  /* First visit ever: the 90-day intro, which makes today Day 1. */
  if (summary.challengeStarted === false) {
    return <ChallengeIntro busy={startChallenge.isPending} onStart={() => startChallenge.mutate()} />;
  }

  /* Morning: nothing on the dashboard until today has a number. Trial
     accounts too (Kiron, 2026-09-30); the trial's own day-start screen waits
     for this, see TrialChallengeOverlay. */
  if (!t.locked) {
    return (
      <MorningCommit
        min={t.min}
        max={t.max}
        initial={t.committed ?? t.target}
        filedToday={t.filedToday}
        streak={summary.streak}
        programDay={summary.programDay}
        programLength={summary.programLength}
        busy={live.setTarget.isPending}
        onCommit={n => live.setTarget.mutate(n, { onSuccess: clearPending })}
      />
    );
  }

  const canSwap = t.locked && t.swapped === false && t.done === false && t.filedToday < t.target;
  const missing = Math.max(0, t.target - t.filedToday);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap', marginBottom: 32 }}>
      <div style={{ flex: '1 1 380px', minWidth: 0 }}>
        <StreakHeading
          streak={summary.streak}
          freezes={summary.streakFreezes}
          todayDone={summary.streakTodayDone}
          floor={summary.streakFloor}
          onBrainClick={() => setBrainOpen(true)}
        />

        <div style={{ marginBottom: 14 }}>
          <TodaysRitual
            target={shown}
            filed={t.filedToday}
            locked={t.locked}
            undoAvailable={t.undoAvailable}
            busy={live.setTarget.isPending ? 'set' : live.useUndo.isPending ? 'undo' : null}
            onTargetChange={setPending}
            onSet={() => (t.explainerSeen ? commit() : setCommitDialog(true))}
            onUndo={() => setUndoDialog(true)}
            detail="Pulled from your target-role list."
          />
        </div>

        <ApplicationSquares filed={t.filedToday} target={shown} />

        {/* Option B: no more good roles today. */}
        {canSwap && (
          <button
            onClick={() => setSwapDialog(true)}
            style={{
              marginTop: 10, padding: 0, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, color: warm.colors.textMuted,
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}
          >
            Run out of good roles today?
          </button>
        )}
        {t.swapped && (
          <p style={{ margin: '10px 0 0', fontSize: 15, color: warm.colors.textSecondary }}>
            {t.done
              ? <strong style={{ color: warm.colors.success }}>Done for today, with outreach. </strong>
              : <>Outreach instead: <strong style={{ color: warm.colors.textPrimary }}>{t.outreachToday ?? 0} of {t.outreachNeeded ?? 0}</strong> messages. </>}
            <Link to="/tracker?tab=outreach" style={{ color: warm.colors.accentPetrol, fontWeight: 600 }}>
              Log outreach →
            </Link>
          </p>
        )}
      </div>

      <div style={{ paddingTop: 4 }}>
        <DayCounter
          day={summary.programDay}
          of={summary.programLength}
          week={summary.week}
          todayIndex={summary.todayIndex}
        />
      </div>

      <BrainPopup
        open={brainOpen}
        onClose={() => setBrainOpen(false)}
        seed={summary.treeSeed}
        programDay={summary.programDay}
        interviews={summary.interviews}
        absenceDays={0}
        stats={{
          applications: summary.applications,
          outreach: summary.outreach,
          daysActive: summary.daysActive,
          streak: summary.streak,
        }}
      />

      <Modal
        open={swapDialog}
        onClose={() => setSwapDialog(false)}
        title="No more good roles today?"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setSwapDialog(false)}
              style={{ padding: '11px 16px', borderRadius: 10, border: `1px solid ${warm.colors.borderWhisper}`, background: 'transparent', fontSize: 15, fontWeight: 600, color: warm.colors.textSecondary, cursor: 'pointer' }}
            >
              Keep looking
            </button>
            <button
              onClick={() => { setSwapDialog(false); live.swap.mutate(); }}
              style={{ padding: '11px 16px', borderRadius: 10, border: 'none', background: warm.colors.accentPetrol, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              Switch to outreach
            </button>
          </div>
        }
      >
        <p style={{ margin: '0 0 12px', fontSize: 16, lineHeight: 1.6, color: warm.colors.textSecondary }}>
          Some days there just aren't enough roles worth a tailored application. That's fine, as long as the effort still goes somewhere.
        </p>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: warm.colors.textPrimary }}>
          Switch the {missing} application{missing === 1 ? '' : 's'} left for <strong>{missing * 2} outreach messages</strong> to people at companies you'd like to work for.
          Send them and today still counts, streak included. You can only do this once a day.
        </p>
      </Modal>

      <TargetCommitDialog
        open={commitDialog}
        target={shown}
        busy={live.setTarget.isPending}
        onConfirm={() => { setCommitDialog(false); commit(); }}
      />
      <TargetUndoDialog
        open={undoDialog}
        busy={live.useUndo.isPending}
        onConfirm={() => { setUndoDialog(false); live.useUndo.mutate(undefined, { onSuccess: clearPending }); }}
        onCancel={() => setUndoDialog(false)}
      />
    </div>
  );
}
