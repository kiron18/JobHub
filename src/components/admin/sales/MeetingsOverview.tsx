/* The week or the month at a glance: how many calls are on which day.

   One series, one colour. The question this answers is "how full is my week",
   which is a count per day and nothing else, so it is a plain bar per day with
   the count written on it. There is no second measure sharing the axis and no
   legend, because the heading already says what the bars are.

   The bars are also the way in: hovering a day names who it is, and clicking
   one pins that day's list underneath, where each name opens that person's row
   on the board. */
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { C, isFinished, timeLabel, type MeetingDot } from './shared';

type View = 'week' | 'month';

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Monday, because a working week that starts on Sunday splits the weekend
 *  across both ends of the chart. */
function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  return addDays(day, -((day.getDay() + 6) % 7));
}

function periodStart(view: View, d: Date): Date {
  return view === 'week' ? startOfWeek(d) : new Date(d.getFullYear(), d.getMonth(), 1);
}

function shift(view: View, start: Date, by: number): Date {
  return view === 'week' ? addDays(start, 7 * by) : new Date(start.getFullYear(), start.getMonth() + by, 1);
}

/** The scale never tops out below this, so a week with one call in it shows a
 *  short bar rather than a full-height one that reads as "packed". */
const MIN_SCALE = 4;
const PLOT_HEIGHT = 96;

export default function MeetingsOverview({
  meetings,
  onOpenLead,
}: {
  meetings: MeetingDot[];
  onOpenLead: (leadId: string) => void;
}) {
  const [view, setView] = useState<View>('week');
  const [start, setStart] = useState(() => periodStart('week', new Date()));
  const [picked, setPicked] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const today = startOfDay(new Date());
  const todayKey = dayKey(today);

  const days = useMemo(() => {
    const out: Date[] = [];
    const end = shift(view, start, 1);
    for (let d = start; d < end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [view, start]);

  const byDay = useMemo(() => {
    const map = new Map<string, MeetingDot[]>();
    for (const m of meetings) {
      const key = dayKey(new Date(m.startsAt));
      const list = map.get(key);
      if (list) list.push(m); else map.set(key, [m]);
    }
    return map;
  }, [meetings]);

  const inPeriod = days.flatMap((d) => byDay.get(dayKey(d)) ?? []);
  const toCome = inPeriod.filter((m) => !isFinished(m)).length;
  const scale = Math.max(MIN_SCALE, ...days.map((d) => byDay.get(dayKey(d))?.length ?? 0));

  const isCurrent = dayKey(periodStart(view, new Date())) === dayKey(start);
  const heading = view === 'week'
    ? `${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} to ${addDays(start, 6).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
    : start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  // The list under the chart: the pinned day, or failing that what is still to
  // come in this period, or everything in it once the period is in the past.
  const pickedDay = picked ? days.find((d) => dayKey(d) === picked) : undefined;
  const listed = pickedDay
    ? (byDay.get(picked!) ?? [])
    : (toCome ? inPeriod.filter((m) => !isFinished(m)) : inPeriod);
  const LIST_CAP = 8;

  const go = (next: Date, nextView: View = view) => {
    setView(nextView);
    setStart(next);
    setPicked(null);
    setHovered(null);
  };

  const navButton: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
    border: `1.5px solid ${C.line}`, background: C.bg, color: C.ink2,
  };

  return (
    <section
      aria-label="Meetings overview"
      style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 18px 16px', marginBottom: 18 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, color: C.ink3 }}>
            {isCurrent ? `Meetings this ${view}` : 'Meetings'} · {heading}
          </p>
          <p style={{ margin: '1px 0 0', fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {inPeriod.length}
            <span style={{ fontSize: 13, fontWeight: 500, color: C.ink2, marginLeft: 8 }}>
              {inPeriod.length === 0
                ? 'booked'
                : toCome === 0
                  ? 'all done'
                  : toCome === inPeriod.length ? 'still to come' : `${toCome} still to come`}
            </span>
          </p>
        </div>

        <div style={{ display: 'inline-flex', border: `1.5px solid ${C.line}`, borderRadius: 8, overflow: 'hidden' }}>
          {(['week', 'month'] as const).map((v) => (
            <button
              key={v}
              onClick={() => go(periodStart(v, isCurrent ? new Date() : start), v)}
              aria-pressed={view === v}
              style={{
                padding: '6px 13px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: view === v ? C.blue : C.bg, color: view === v ? '#fff' : C.ink2,
              }}
            >
              {v === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>

        <div style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
          <button onClick={() => go(shift(view, start, -1))} title={`Previous ${view}`} style={navButton}>
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => go(periodStart(view, new Date()))}
            disabled={isCurrent}
            style={{ ...navButton, width: 'auto', padding: '0 10px', fontSize: 12.5, fontWeight: 600, opacity: isCurrent ? 0.45 : 1 }}
          >
            Today
          </button>
          <button onClick={() => go(shift(view, start, 1))} title={`Next ${view}`} style={navButton}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* The plot. Each day is a full-height column so the whole strip is the
          hover and click target, not just the few pixels of a short bar. */}
      <div
        role="img"
        aria-label={`${inPeriod.length} meetings, ${heading}`}
        style={{ display: 'flex', gap: view === 'week' ? 10 : 3, marginTop: 14, alignItems: 'stretch' }}
      >
        {days.map((d) => {
          const key = dayKey(d);
          const list = byDay.get(key) ?? [];
          const n = list.length;
          const isToday = key === todayKey;
          const active = picked === key;
          const lit = hovered === key || active;
          const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
          return (
            <div
              key={key}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered((h) => (h === key ? null : h))}
              onClick={() => setPicked(active ? null : key)}
              style={{ flex: '1 1 0', minWidth: 0, position: 'relative', cursor: 'pointer' }}
            >
              <div style={{
                height: PLOT_HEIGHT, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                alignItems: 'center', borderBottom: `1px solid ${C.lineStrong}`,
                background: lit ? C.alt : 'transparent', borderRadius: '6px 6px 0 0',
              }}>
                {n > 0 && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: C.ink, marginBottom: 3, fontVariantNumeric: 'tabular-nums' }}>
                    {n}
                  </span>
                )}
                <div style={{
                  width: view === 'week' ? 'min(44px, 70%)' : '72%',
                  height: n ? Math.max(4, Math.round((n / scale) * (PLOT_HEIGHT - 22))) : 0,
                  background: C.blue, borderRadius: '4px 4px 0 0',
                  opacity: lit || !hovered ? 1 : 0.55, transition: 'opacity .12s',
                }} />
              </div>

              <div style={{
                marginTop: 5, textAlign: 'center', fontSize: view === 'week' ? 12 : 10.5, lineHeight: 1.25,
                color: isToday ? C.ink : C.ink3, fontWeight: isToday ? 700 : 500,
                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
              }}>
                {view === 'week' ? <>{weekday} {d.getDate()}</> : d.getDate()}
                {/* Today is marked with a rule as well as weight, so it does
                    not depend on telling bold from regular at 10px. */}
                <div style={{ height: 2, margin: '3px auto 0', width: view === 'week' ? 26 : '70%', borderRadius: 1, background: isToday ? C.ink : 'transparent' }} />
              </div>

              {hovered === key && (
                <div style={{
                  position: 'absolute', bottom: PLOT_HEIGHT + 34, left: '50%', transform: 'translateX(-50%)',
                  zIndex: 5, pointerEvents: 'none', whiteSpace: 'nowrap',
                  padding: '7px 10px', borderRadius: 8, background: C.ink, color: '#fff',
                  fontSize: 12, lineHeight: 1.5, boxShadow: '0 6px 18px rgba(15,30,43,.22)',
                }}>
                  <div style={{ fontWeight: 700 }}>
                    {d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
                  </div>
                  {n === 0
                    ? <div style={{ opacity: 0.75 }}>Nothing booked</div>
                    : list.slice(0, 6).map((m) => (
                        <div key={m.id}>{timeLabel(m.startsAt)} · {m.name}</div>
                      ))}
                  {n > 6 && <div style={{ opacity: 0.75 }}>and {n - 6} more</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* The same information as a list, so nothing here is only readable by
          hovering. */}
      <div style={{ marginTop: 12, fontSize: 13 }}>
        {pickedDay && (
          <p style={{ margin: '0 0 6px', fontSize: 12, color: C.ink3 }}>
            {pickedDay.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}
            <button
              onClick={() => setPicked(null)}
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: C.blue, fontWeight: 600, fontSize: 12 }}
            >
              show the whole {view}
            </button>
          </p>
        )}
        {listed.length === 0 ? (
          <p style={{ margin: 0, color: C.ink3 }}>
            {pickedDay ? 'Nothing booked that day.' : `Nothing booked ${isCurrent ? `this ${view}` : `that ${view}`}.`}
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 18px' }}>
            {listed.slice(0, LIST_CAP).map((m) => (
              <button
                key={m.id}
                onClick={() => onOpenLead(m.leadId)}
                title="Open their row"
                style={{
                  border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                  fontSize: 13, color: C.ink, textAlign: 'left', fontFamily: 'inherit',
                  opacity: isFinished(m) ? 0.6 : 1,
                }}
              >
                <span style={{ color: C.ink3, fontVariantNumeric: 'tabular-nums' }}>
                  {!pickedDay && `${new Date(m.startsAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}, `}
                  {timeLabel(m.startsAt)}
                </span>{' '}
                <span style={{ fontWeight: 600, color: C.blue }}>{m.name}</span>
              </button>
            ))}
            {listed.length > LIST_CAP && (
              <span style={{ color: C.ink3 }}>and {listed.length - LIST_CAP} more</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
