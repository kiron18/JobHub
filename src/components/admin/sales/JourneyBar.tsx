/* One person's journey as a single line: how long they have been on the board,
   which funnel steps they have reached, and every point of contact since.

   The track runs from Day 1, the first time they showed up, to Day 10, 30 or
   90, whichever is the shortest that still holds today. Most of what happens
   to a lead happens in the first ten days, and on a fixed 90-day line those
   ten days are a smear at the left edge.

   Filled green is time that has passed. The dots on the track are the funnel
   steps on the day they happened. The ticks under it are the contacts: a short
   gold one per email sent, a taller blue one per call, hollow while the call
   is still to come.

   ⚠️ ONLY WHAT THE SYSTEM SENT OR BOOKED IS COUNTED. Emails come from the send
   log and calls from the meetings on this board. A WhatsApp or a LinkedIn
   message leaves no trace here, so "last contact 9 days ago" means "last
   contact this system knows about". */
import { C } from './shared';
import { DAY, daysAgo, plural, shortDate, type Journey } from './journey';

const GOLD = '#B8892B';

export default function JourneyBar({ journey: j, compact = false }: { journey: Journey; compact?: boolean }) {
  const now = j.now;
  const span = j.scaleDays * DAY;
  const pct = (t: number) => `${Math.min(100, Math.max(0, ((t - j.start) / span) * 100))}%`;
  const trackH = compact ? 6 : 14;
  const tickH = compact ? 5 : 9;
  const callH = compact ? 8 : 14;
  const doneCalls = j.calls.filter((c) => c.done).length;

  const plot = (
    <div style={{ position: 'relative', flex: '1 1 0', minWidth: 60, paddingBottom: callH + 3 }}>
      <div style={{ position: 'relative', height: trackH, borderRadius: 3, background: C.line, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, width: pct(now), background: C.good }} />
      </div>
      {j.steps.map((s) => (
        <span
          key={s.label}
          title={`${s.label}: ${shortDate(s.at)}`}
          style={{
            position: 'absolute', top: trackH / 2, left: pct(s.at), transform: 'translate(-50%, -50%)',
            width: compact ? 6 : 9, height: compact ? 6 : 9, borderRadius: '50%',
            background: '#fff', border: `2px solid ${C.ink}`, boxSizing: 'border-box',
          }}
        />
      ))}
      {j.emails.map((e, i) => (
        <span
          key={`e${i}`}
          title={`Email, ${shortDate(e.at)}: ${e.subject}`}
          style={{
            position: 'absolute', top: trackH + 3, left: pct(e.at), transform: 'translateX(-50%)',
            width: 2, height: tickH, background: GOLD,
          }}
        />
      ))}
      {j.calls.map((c, i) => (
        <span
          key={`c${i}`}
          title={`${c.done ? 'Call' : 'Call booked'}, ${shortDate(c.at)}`}
          style={{
            position: 'absolute', top: trackH + 3, left: pct(c.at), transform: 'translateX(-50%)',
            width: 4, height: callH, boxSizing: 'border-box', borderRadius: 1,
            background: c.done ? C.blue : '#fff', border: `1px solid ${C.blue}`,
          }}
        />
      ))}
    </div>
  );

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 7 }}>
        {plot}
        <span style={{ fontSize: 12, color: j.callDue ? C.danger : C.ink3, whiteSpace: 'nowrap', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          Day {j.day} · {j.emails.length} sent · {doneCalls ? plural(doneCalls, 'call') : 'no call'}
        </span>
      </div>
    );
  }

  const fact = (label: string, value: string, warn = false) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: C.ink3 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: warn ? C.danger : C.ink }}>{value}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.ink2, whiteSpace: 'nowrap', lineHeight: `${trackH}px` }}>Day 1</span>
        {plot}
        <span style={{ fontSize: 12, fontWeight: 600, color: C.ink2, whiteSpace: 'nowrap', lineHeight: `${trackH}px` }}>
          Day {j.scaleDays}{j.day > j.scaleDays ? '+' : ''}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '10px 26px', flexWrap: 'wrap', marginTop: 6 }}>
        {fact('Today is', `Day ${j.day}`)}
        {fact('Emails sent', String(j.emails.length))}
        {fact('Sales call', j.lastCallAt
          ? `Yes, ${shortDate(j.lastCallAt)}${doneCalls > 1 ? ` (${doneCalls} so far)` : ''}`
          : j.nextCallAt ? `Booked, ${shortDate(j.nextCallAt)}` : 'No')}
        {j.lastCallAt && fact('Since the call', plural(j.sinceCall, 'email'))}
        {fact('Last contact', j.lastContactAt ? daysAgo(j.lastContactAt, now) : 'Never')}
        {j.lastCallAt && fact('Next call', j.nextCallAt ? shortDate(j.nextCallAt) : j.callDue ? `Due. Last one was ${daysAgo(j.lastCallAt, now)}` : 'Not booked', j.callDue)}
      </div>

      {j.steps.length > 0 && (
        <p style={{ margin: '9px 0 0', fontSize: 12, color: C.ink3 }}>
          {j.steps.map((s) => `${s.label} ${shortDate(s.at)}`).join(' · ')}
        </p>
      )}
    </div>
  );
}
