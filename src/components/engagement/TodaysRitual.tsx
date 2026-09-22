import React from 'react';
import { ChevronRight, CheckCircle2 } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { WeekRitualRow, type RitualDay } from './WeekRitualRow';

/* ── TodaysRitual ──────────────────────────────────────────────────────
   The "never land on a dashboard wondering what to do" card. One task,
   not a list — journey (90-day program) -> challenge (this week, shown
   below as WeekRitualRow) -> routine (this one task). Extends the trial
   flow's "Today's Mission (1 of N)" idea past day 3, onto the real
   dashboard.

   Task content/ordering is real product logic (which task, in what
   order) — this component just renders whatever the caller decides is
   next. That decision isn't built yet; see the file this shipped with.
*/

export interface RitualTask {
  title: string;
  detail: string;
  ctaLabel: string;
  done?: boolean;
}

export interface TodaysRitualProps {
  taskIndex: number; // 0-based
  taskCount: number;
  task: RitualTask;
  onAct: () => void;
  week: RitualDay[];
}

export const TodaysRitual: React.FC<TodaysRitualProps> = ({ taskIndex, taskCount, task, onAct, week }) => (
  <div style={{
    background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
    borderRadius: 16, padding: '18px 20px',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
      <span style={{ ...warm.text.micro, color: warm.colors.accentPetrol }}>Today's ritual</span>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: warm.colors.textMuted }}>
        {taskIndex + 1} of {taskCount}
      </span>
    </div>

    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
      {task.done ? (
        <CheckCircle2 size={20} color={warm.colors.success} style={{ flexShrink: 0, marginTop: 2 }} />
      ) : (
        <div style={{
          width: 20, height: 20, borderRadius: '50%', border: `2px solid ${warm.colors.accentPetrol}`,
          flexShrink: 0, marginTop: 2,
        }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: warm.colors.textPrimary }}>
          {task.title}
        </h3>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: warm.colors.textSecondary }}>
          {task.detail}
        </p>
      </div>
    </div>

    {!task.done && (
      <button
        onClick={onAct}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%',
          padding: '11px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: warm.colors.accentPetrol, color: '#fff', fontSize: 13.5, fontWeight: 700, marginBottom: 16,
        }}
      >
        {task.ctaLabel} <ChevronRight size={15} />
      </button>
    )}

    <div style={{ paddingTop: task.done ? 0 : 4, borderTop: `1px solid ${warm.colors.borderWhisper}`, marginTop: task.done ? 0 : 2, paddingBottom: 2 }}>
      <p style={{ margin: '10px 0 8px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: warm.colors.textMuted }}>
        This week
      </p>
      <WeekRitualRow days={week} />
    </div>
  </div>
);
