// The numbers for the 3-day trial challenge, in one place on purpose — every
// screen's copy and every backend check reads from here, so changing the
// shape of the challenge is a one-file edit.
export interface DayRule {
  day: 1 | 2 | 3;
  windowMinutes: number;
  /** 0 means no target — day 3 is an open window, always ends at "completed". */
  minimum: number;
}

export const DAY_RULES: readonly DayRule[] = [
  { day: 1, windowMinutes: 30, minimum: 2 },
  { day: 2, windowMinutes: 45, minimum: 5 },
  { day: 3, windowMinutes: 60, minimum: 0 },
];

export const DAY1_MINIMUM = DAY_RULES[0].minimum;
export const LAST_DAY = DAY_RULES[DAY_RULES.length - 1].day;

export function ruleForDay(day: number): DayRule | undefined {
  return DAY_RULES.find(r => r.day === day);
}

export type TrialChallengeStatus =
  | 'not_started'
  | 'day_in_progress'
  | 'day_passed_waiting'
  | 'day_failed'
  | 'forfeited'
  | 'completed';
