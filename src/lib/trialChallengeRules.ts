// Mirrors server/src/services/trialChallenge/rules.ts — kept in sync by hand,
// same as the split between client/server validation elsewhere in this app.
// Used only to render "here's what day N looks like" before that day's window
// has actually started (the live window's own numbers come from the server).
export interface DayRule {
  day: 1 | 2 | 3;
  windowMinutes: number;
  minimum: number;
}

export const DAY_RULES: readonly DayRule[] = [
  { day: 1, windowMinutes: 30, minimum: 2 },
  { day: 2, windowMinutes: 45, minimum: 5 },
  { day: 3, windowMinutes: 60, minimum: 0 },
];

export function ruleForDay(day: number): DayRule | undefined {
  return DAY_RULES.find(r => r.day === day);
}
