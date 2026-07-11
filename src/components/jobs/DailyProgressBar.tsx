import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';

export function DailyProgressBar() {
  const { data } = useQuery({
    queryKey: ['tracker-goal'],
    queryFn: async () => (await api.get('/tracker/goal')).data as { goalType: 'daily' | 'weekly'; goal: number; applied: number },
    staleTime: 30_000,
  });
  const applied = data?.applied ?? 0;
  const goal = data?.goal ?? 5;
  const pct = Math.min(applied / goal, 1) * 100;
  const over = applied > goal;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: warm.colors.textSecondary }}>
        <span>{data?.goalType === 'weekly' ? "This week's applications" : "Today's applications"}</span>
        <span style={{ fontWeight: 700, color: warm.colors.textPrimary }}>
          {applied} of {goal}{over ? ` ✓ +${applied - goal}` : ''}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 6, background: warm.colors.borderWhisper, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: warm.colors.accentPetrol, borderRadius: 6, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}
