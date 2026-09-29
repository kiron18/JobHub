import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { onCelebrate } from '../../lib/feedback';
import { useDailyTarget, DAILY_TARGET_KEY } from '../../hooks/useDailyTarget';
import { PostApplicationPopup } from './PostApplicationPopup';
import { CelebrationHost } from '../shared/Celebration';
import { useAuth } from '../../contexts/AuthContext';

/* ── PostApplicationHost ───────────────────────────────────────────────
   Listens for a filed application and shows the one popup.

   It subscribes to the same event StepperWorkspace already fires when an
   application lands (lib/feedback's celebrate), so nothing new had to be
   plumbed through the apply flow — the event was already there, the
   sidebar pill was simply the only thing listening to it.

   This REPLACES components/shared/Celebration.tsx rather than joining it.
   Two things firing off one event is the pile-up this whole pass existed
   to remove; whichever is mounted, exactly one thing happens.

   Mounted once, globally, for the same reason CelebrationHost was: the
   application can be filed from more than one screen, and the moment
   belongs to the application rather than to whichever page was open.
*/

export function PostApplicationHost() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  // Mounted on every page, public ones included. Same gate as DailyCloseOut.
  const { user } = useAuth();
  const signedIn = !!user && !(user as { is_anonymous?: boolean }).is_anonymous;
  const { data } = useDailyTarget(signedIn);
  // The streak pill wants the real number, and this is the same query the
  // dashboard strip already holds, so it is usually a cache read.
  const { data: summary } = useQuery({
    queryKey: ['tracker-engagement'],
    queryFn: async () => (await api.get('/tracker/engagement')).data as { streak: number },
    staleTime: 60_000,
    retry: false,
    enabled: signedIn,
  });

  useEffect(() => onCelebrate(() => {
    // The count in the popup has to be the server's, not a local tally —
    // "7 of 10" has to survive a refresh and a second device.
    qc.invalidateQueries({ queryKey: DAILY_TARGET_KEY });
    qc.invalidateQueries({ queryKey: ['tracker-engagement'] });
    setOpen(true);
  }), [qc]);

  /* No daily-target data means the popup cannot say "7 of 10", so the old
     sidebar pill takes the moment instead. Filing an application must
     always be acknowledged by something; the one thing this must never do
     is fail quietly and leave the act unmarked. */
  if (!data) return <CelebrationHost />;

  return (
    <PostApplicationPopup
      open={open}
      onClose={() => setOpen(false)}
      count={data.filedToday}
      goal={data.target}
      streak={summary?.streak ?? 0}
    />
  );
}
