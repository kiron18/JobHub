import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { intensityLevel, HEATMAP_GREENS } from '../tracker/heatmapGrid';

/**
 * This week at a glance, Sunday to Saturday.
 *
 * The tracker already has a full year heatmap. This is the seven squares that
 * matter today, sitting on the dashboard where the decision to apply gets made
 * rather than on the page you visit after applying. Seven is deliberate: a year
 * of squares is a record, a week of squares is a nudge.
 *
 * Days that have not arrived yet are drawn as an empty outline rather than a
 * zero, so an untouched Friday on a Tuesday never reads as a day you missed.
 */

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** yyyy-mm-dd in Sydney, matching the keys /tracker/activity returns. */
const DAY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Australia/Sydney',
  year: 'numeric', month: '2-digit', day: '2-digit',
});

/** The seven dates of the calendar week containing today, Sunday first. */
export function currentWeekDates(now: Date = new Date()): string[] {
  const todayKey = DAY_FMT.format(now);
  // Parsed back as UTC midnight so the arithmetic below cannot be dragged into
  // a neighbouring day by the local timezone of whoever is looking.
  const today = new Date(`${todayKey}T00:00:00Z`);
  const sunday = new Date(today.getTime() - today.getUTCDay() * 86400000);
  return Array.from({ length: 7 }, (_, i) =>
    new Date(sunday.getTime() + i * 86400000).toISOString().slice(0, 10),
  );
}

export function WeekStrip() {
  const { data } = useQuery({
    queryKey: ['tracker-activity'],
    queryFn: async () => (await api.get('/tracker/activity')).data as Array<{ date: string; count: number }>,
    staleTime: 5 * 60_000,
  });

  const counts = new Map((data ?? []).map((d) => [d.date, d.count]));
  const week = currentWeekDates();
  const todayKey = DAY_FMT.format(new Date());

  return (
    <div
      style={{ display: 'flex', gap: 4 }}
      aria-label="Applications this week"
    >
      {week.map((date, i) => {
        const future = date > todayKey;
        const count = counts.get(date) ?? 0;
        return (
          <div key={date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{
              fontSize: 9.5, fontWeight: 700, lineHeight: 1,
              color: date === todayKey ? warm.colors.textPrimary : warm.colors.textMuted,
            }}>
              {LETTERS[i]}
            </span>
            <span
              title={future ? date : `${date}: ${count} application${count === 1 ? '' : 's'}`}
              style={{
                width: 13, height: 13, borderRadius: 3,
                background: future ? 'transparent' : HEATMAP_GREENS[intensityLevel(count)],
                border: future
                  ? `1px dashed ${warm.colors.borderDefined}`
                  : date === todayKey
                    ? `1px solid ${warm.colors.accentPetrol}`
                    : '1px solid transparent',
                boxSizing: 'border-box',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
