// Generic "haven't heard back" nudge — shown in the Tracker's Follow-ups Due
// tab when a message has gone unanswered for a few days. Users self-select
// when to send their real follow-up/call-ask templates from the Outreach
// tab; this is just a lightweight bump for a thread that's gone quiet.

export const FOLLOW_UP_DUE_AFTER_DAYS = 4;

export function renderFollowUpNudge(params: { firstName: string; company: string; topic: string }): string {
  return `Hi ${params.firstName}, just floating this back up in case it got buried! Still keen to hear your take on ${params.topic} whenever you have a spare few minutes. No pressure at all if timing's not right.`;
}
