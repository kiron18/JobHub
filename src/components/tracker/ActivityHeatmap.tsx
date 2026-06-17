import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { intensityLevel, HEATMAP_GREENS } from './heatmapGrid';

export function ActivityHeatmap() {
  const { data } = useQuery({
    queryKey: ['tracker-activity'],
    queryFn: async () => (await api.get('/tracker/activity')).data as Array<{ date: string; count: number }>,
    staleTime: 5 * 60_000,
  });
  const days = data ?? [];
  // Chunk into weeks (columns of 7).
  const weeks: Array<Array<{ date: string; count: number }>> = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>Application activity</p>
      <div style={{ display: 'flex', gap: 3, overflowX: 'auto' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {week.map(d => (
              <div key={d.date} title={`${d.date}: ${d.count} application${d.count === 1 ? '' : 's'}`}
                style={{ width: 11, height: 11, borderRadius: 2, background: HEATMAP_GREENS[intensityLevel(d.count)] }} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', fontSize: 11, color: warm.colors.textMuted }}>
        <span>Less</span>
        {HEATMAP_GREENS.map(c => <span key={c} style={{ width: 11, height: 11, borderRadius: 2, background: c }} />)}
        <span>More</span>
      </div>
    </div>
  );
}
