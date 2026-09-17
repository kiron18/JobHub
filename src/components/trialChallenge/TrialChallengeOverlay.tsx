import { useLocation } from 'react-router-dom';
import { useTrialChallengeState, useBeginTrialDay, useResetTrialChallenge } from '../../lib/trialChallenge';
import { useProfile } from '../../hooks/useProfile';
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
 *
 * Excluded on /dev/* : those are copy/layout preview pages for work in
 * progress, and a real account's real trial state has no business covering
 * them with a fixed overlay — that's what sent someone reviewing an unrelated
 * dev preview straight into their own stuck "day failed" screen.
 *
 * Also excluded until onboarding is complete: this is a sibling of <Routes>
 * so it renders on every page including the OnboardingGate/intake screens,
 * and trial eligibility only checks plan/payment status, not onboarding
 * state. Without this, a brand-new free account can see the Day 1 intro (or
 * a stuck day-end screen) stacked on top of the "complete your profile" form
 * before they've so much as entered a resume.
 */
export function TrialChallengeOverlay() {
  const { pathname } = useLocation();
  const { data } = useTrialChallengeState();
  const { profile } = useProfile();
  const begin = useBeginTrialDay();
  const reset = useResetTrialChallenge();

  if (pathname.startsWith('/dev/')) return null;
  if (!profile?.hasCompletedOnboarding) return null;
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
          currentDay={data.currentDay}
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
          resetUsed={data.resetUsed}
          onReset={() => reset.mutate()}
          resetting={reset.isPending}
        />
      );
    default:
      return null;
  }
}
