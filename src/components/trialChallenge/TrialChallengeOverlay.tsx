import { useTrialChallengeState, useBeginTrialDay } from '../../lib/trialChallenge';
import { ruleForDay } from '../../lib/trialChallengeRules';
import { TrialDayIntro } from './TrialDayIntro';
import { TrialDayPassScreen } from './TrialDayPassScreen';
import { TrialWindowBar } from './TrialWindowBar';
import { TrialDayEndScreen } from './TrialDayEndScreen';

/**
 * Mounted once, globally (see App.tsx, next to DailyCloseOut) — same reasoning
 * as that component: whichever page the trial state changes on, this is what
 * renders, so FitCheckPage's goToApply only has to check whether a window is
 * live, not render any of this itself.
 *
 * Replaces ApplyPreviewGate for free users. ApplyPreviewGate.tsx itself is
 * left in place, unused, in case it's wanted elsewhere later.
 */
export function TrialChallengeOverlay() {
  const { data } = useTrialChallengeState();
  const begin = useBeginTrialDay();

  if (!data || !data.eligible) return null;

  switch (data.status) {
    case 'not_started': {
      const rule = ruleForDay(1)!;
      return (
        <TrialDayIntro
          windowMinutes={rule.windowMinutes}
          minimum={rule.minimum}
          onBegin={() => begin.mutate()}
          beginning={begin.isPending}
        />
      );
    }
    case 'day_passed_waiting':
      if (!data.forfeitureDeadline) return null;
      return (
        <TrialDayPassScreen
          passedDay={data.currentDay}
          forfeitureDeadline={data.forfeitureDeadline}
          onBegin={() => begin.mutate()}
          beginning={begin.isPending}
          whatsappOptInLink={data.whatsappOptInLink}
        />
      );
    case 'day_in_progress':
      if (!data.windowEndsAt) return null;
      return (
        <TrialWindowBar
          windowEndsAt={data.windowEndsAt}
          appliedThisWindow={data.appliedThisWindow}
          minimumRequired={data.minimumRequired}
          linkedinUnlocked={data.linkedinUnlocked}
        />
      );
    case 'day_failed':
    case 'forfeited':
    case 'completed':
      return (
        <TrialDayEndScreen
          variant={data.status}
          currentDay={data.currentDay}
          appliedThisWindow={data.appliedThisWindow}
          minimumRequired={data.minimumRequired}
        />
      );
    default:
      return null;
  }
}
