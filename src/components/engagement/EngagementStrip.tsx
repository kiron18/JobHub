import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { useDailyTarget } from '../../hooks/useDailyTarget';
import { StreakHeading } from './StreakHeading';
import { TodaysRitual } from './TodaysRitual';
import { ApplicationSquares } from './ApplicationSquares';
import { DayCounter, type DayState } from './DayCounter';
import { BrainPopup } from './BrainPopup';
import { TargetCommitDialog, TargetUndoDialog } from './TargetDialogs';

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

  const { data: summary } = useQuery({
    queryKey: ['tracker-engagement'],
    queryFn: async () => (await api.get('/tracker/engagement')).data as EngagementSummary,
    staleTime: 60_000,
    retry: false,
  });
  const live = useDailyTarget();

  if (!summary || !live.data) return null;
  const t = live.data;

  // The stepper is a dial until Set commits it, so the pending value is
  // local and the committed one comes back from the server.
  const shown = pending ?? t.committed ?? t.min;
  const commit = () => live.setTarget.mutate(shown);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap', marginBottom: 32 }}>
      <div style={{ flex: '1 1 380px', minWidth: 0 }}>
        <StreakHeading streak={summary.streak} onBrainClick={() => setBrainOpen(true)} />

        <div style={{ marginBottom: 14 }}>
          <TodaysRitual
            target={t.target}
            filed={t.filedToday}
            locked={t.locked}
            undoAvailable={t.undoAvailable}
            onTargetChange={setPending}
            onSet={() => (t.explainerSeen ? commit() : setCommitDialog(true))}
            onUndo={() => setUndoDialog(true)}
            detail="Pulled from your target-role list."
          />
        </div>

        <ApplicationSquares filed={t.filedToday} target={t.target} />
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

      <TargetCommitDialog
        open={commitDialog}
        target={shown}
        onConfirm={() => { setCommitDialog(false); commit(); }}
      />
      <TargetUndoDialog
        open={undoDialog}
        onConfirm={() => { setUndoDialog(false); live.useUndo.mutate(); }}
        onCancel={() => setUndoDialog(false)}
      />
    </div>
  );
}
