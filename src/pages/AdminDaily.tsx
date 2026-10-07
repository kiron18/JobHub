/**
 * AdminDaily: Kiron's own checklist for the day, at /admin/daily.
 *
 * One screen, top to bottom: what goes out today, the tasks, the new signups
 * waiting on a personal welcome, a note, and the last two weeks at a glance.
 * Every tap saves. The task list is src/config/dailyTasks.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Minus, Plus } from 'lucide-react';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';
import { AdminShell } from '../components/admin/AdminShell';
import {
  POST_OF_THE_DAY, tasksFor, weekdayOf, isDone, doneCount,
  type DailyTask, type DoneMap,
} from '../config/dailyTasks';

const C = warm.colors;

interface Signup {
  userId: string;
  name: string | null;
  email: string | null;
  joinedAt: string;
  /** The day this person was ticked as welcomed, if ever. */
  welcomedOn: string | null;
}

interface DailyResponse {
  today: string;
  date: string;
  log: { done: DoneMap; welcomed: string[]; note: string };
  history: { date: string; done: DoneMap; welcomed: number }[];
  signups: Signup[];
}

const longDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function shift(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AdminDaily() {
  const [params, setParams] = useSearchParams();
  const picked = params.get('date') ?? undefined;
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-daily', picked ?? 'today'],
    queryFn: async () => (await api.get('/admin/daily', { params: picked ? { date: picked } : {} })).data as DailyResponse,
  });

  const [done, setDone] = useState<DoneMap>({});
  const [welcomed, setWelcomed] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const dirty = useRef(false);

  // Load the day into local state once per day viewed, so a background
  // refetch never wipes a tick that has not finished saving.
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!data || loadedFor.current === data.date) return;
    loadedFor.current = data.date;
    setDone(data.log.done);
    setWelcomed(data.log.welcomed);
    setNote(data.log.note);
    dirty.current = false;
    setSaveState('idle');
  }, [data]);

  // Save shortly after the last change, whatever it was.
  useEffect(() => {
    if (!data || !dirty.current) return;
    const date = data.date;
    setSaveState('saving');
    const t = setTimeout(async () => {
      try {
        await api.put(`/admin/daily/${date}`, { done, welcomed, note });
        dirty.current = false;
        setSaveState('saved');
        qc.invalidateQueries({ queryKey: ['admin-daily'] });
      } catch {
        setSaveState('failed');
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, welcomed, note]);

  const change = <T,>(set: (fn: (prev: T) => T) => void, fn: (prev: T) => T) => { dirty.current = true; set(fn); };

  if (isLoading) return <AdminShell title="Daily"><p style={{ ...warm.text.body, color: C.textMuted }}>Loading…</p></AdminShell>;
  if (error || !data) return <AdminShell title="Daily"><p style={{ ...warm.text.body, color: C.danger }}>Could not load today. Refresh to try again.</p></AdminShell>;

  const { date, today } = data;
  const tasks = tasksFor(date);
  const progress = doneCount(date, done);
  const post = POST_OF_THE_DAY[weekdayOf(date)];
  const isToday = date === today;
  // Someone welcomed on another day is finished; they only show on the day they were ticked.
  const toWelcome = data.signups.filter((s) => !s.welcomedOn || s.welcomedOn === date || welcomed.includes(s.userId));

  const goTo = (d: string) => setParams(d === today ? {} : { date: d });

  return (
    <AdminShell
      title={isToday ? 'Today' : longDate(date)}
      subtitle={isToday ? longDate(date) : undefined}
      actions={<>
        <span style={{ ...warm.text.small, color: saveState === 'failed' ? C.danger : C.textMuted }} aria-live="polite">
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'failed' ? 'Not saved. Check your connection.' : ''}
        </span>
        {!isToday && <button onClick={() => goTo(today)} style={linkButton}>Back to today</button>}
      </>}
    >
      <div style={{ maxWidth: 640 }}>
        <section style={{ ...card, background: C.accentPetrolSoft, borderColor: C.accentPetrolSoft }}>
          <div style={{ ...warm.text.micro, color: C.accentPetrol }}>{isToday ? 'Today’s post' : 'That day’s post'}</div>
          <div style={{ ...warm.text.body, fontSize: 18, fontWeight: 600, marginTop: 4 }}>{post.name}</div>
          <div style={{ ...warm.text.body, color: C.textSecondary, marginTop: 2 }}>{post.what}</div>
        </section>

        <h2 style={heading}>Tasks <span style={{ color: C.textMuted, fontWeight: 400 }}>{progress.done} of {progress.total} done</span></h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              done={done}
              onTick={() => change(setDone, (d) => ({ ...d, [t.id]: d[t.id] !== true }))}
              onCount={(key, n) => change(setDone, (d) => ({ ...d, [key]: Math.max(0, n) }))}
            />
          ))}
        </div>

        <h2 style={heading}>Welcome new signups</h2>
        {toWelcome.length === 0 ? (
          <p style={{ ...warm.text.body, color: C.textMuted, margin: 0 }}>Nobody new in the last 7 days is waiting on you.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {toWelcome.map((s) => {
              const on = welcomed.includes(s.userId);
              return (
                <button
                  key={s.userId}
                  onClick={() => change(setWelcomed, (w) => (on ? w.filter((id) => id !== s.userId) : [...w, s.userId]))}
                  aria-pressed={on}
                  style={{ ...row, cursor: 'pointer', textAlign: 'left', background: on ? C.successSoft : C.bgSurface }}
                >
                  <Box on={on} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ ...warm.text.body, fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name || s.email || 'No name yet'}</span>
                    <span style={{ ...warm.text.small, color: C.textMuted, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name && s.email ? `${s.email} · ` : ''}joined {new Date(s.joinedAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <h2 style={heading}>Note</h2>
        <textarea
          value={note}
          onChange={(e) => { const v = e.target.value; change(setNote, () => v); }}
          placeholder="Anything worth remembering about today."
          rows={3}
          style={{ ...warm.text.body, width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: warm.radius.input, border: `1px solid ${C.borderDefined}`, color: C.textPrimary, resize: 'vertical', fontFamily: 'inherit' }}
        />

        <h2 style={heading}>Last 14 days</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Array.from({ length: 14 }, (_, i) => shift(today, i - 13)).map((d) => {
            const h = d === date ? { done } : data.history.find((x) => x.date === d);
            const p = doneCount(d, h?.done ?? {});
            const full = p.total > 0 && p.done === p.total;
            return (
              <button
                key={d}
                onClick={() => goTo(d)}
                title={`${longDate(d)}: ${p.done} of ${p.total}`}
                aria-label={`${longDate(d)}: ${p.done} of ${p.total} done`}
                style={{
                  width: 40, padding: '6px 0', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                  border: `1px solid ${d === date ? C.accentPetrol : C.borderWhisper}`,
                  background: full ? C.success : p.done > 0 ? C.successSoft : C.bgAlt,
                  color: full ? C.textOnDeep : C.textSecondary,
                }}
              >
                <span style={{ ...warm.text.micro, display: 'block', letterSpacing: 0 }}>{'SMTWTFS'[weekdayOf(d)]}</span>
                <span style={{ ...warm.text.small, display: 'block', fontWeight: 600 }}>{p.done}/{p.total}</span>
              </button>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}

function TaskRow({ task, done, onTick, onCount }: {
  task: DailyTask;
  done: DoneMap;
  onTick: () => void;
  onCount: (key: string, n: number) => void;
}) {
  const on = isDone(task, done);
  const label = (
    <span style={{ minWidth: 0, flex: 1 }}>
      <span style={{ ...warm.text.body, fontWeight: 600, display: 'block' }}>{task.label}</span>
      {task.hint && <span style={{ ...warm.text.small, color: C.textMuted, display: 'block' }}>{task.hint}</span>}
    </span>
  );

  if (task.kind === 'count') {
    const n = typeof done[task.id] === 'number' ? (done[task.id] as number) : 0;
    return (
      <div style={{ ...row, background: on ? C.successSoft : C.bgSurface, flexWrap: 'wrap' }}>
        <Box on={on} />
        {label}
        <Stepper value={n} label={task.label} suffix={`of ${task.target}`} onChange={(v) => onCount(task.id, v)} jump={5} />
      </div>
    );
  }

  const askKey = `${task.id}_n`;
  const asked = typeof done[askKey] === 'number' ? (done[askKey] as number) : 0;
  return (
    <div style={{ ...row, background: on ? C.successSoft : C.bgSurface, flexWrap: 'wrap' }}>
      <button onClick={onTick} aria-pressed={on} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', color: 'inherit' }}>
        <Box on={on} />
        {label}
      </button>
      {task.ask && <Stepper value={asked} label={task.ask} suffix={task.ask} onChange={(v) => onCount(askKey, v)} />}
    </div>
  );
}

function Stepper({ value, label, suffix, onChange, jump }: {
  value: number; label: string; suffix: string; onChange: (n: number) => void; jump?: number;
}) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={() => onChange(value - 1)} aria-label={`One fewer: ${label}`} style={stepButton}><Minus size={16} /></button>
      <span style={{ ...warm.text.body, fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{value}</span>
      <button onClick={() => onChange(value + 1)} aria-label={`One more: ${label}`} style={stepButton}><Plus size={16} /></button>
      {jump && <button onClick={() => onChange(value + jump)} aria-label={`${jump} more: ${label}`} style={{ ...stepButton, width: 'auto', padding: '0 10px', ...warm.text.small, fontWeight: 600 }}>+{jump}</button>}
      <span style={{ ...warm.text.small, color: C.textMuted, whiteSpace: 'nowrap' }}>{suffix}</span>
    </span>
  );
}

function Box({ on }: { on: boolean }) {
  return (
    <span aria-hidden style={{
      width: 24, height: 24, flexShrink: 0, borderRadius: 7, display: 'grid', placeItems: 'center',
      border: `2px solid ${on ? C.success : C.borderDefined}`, background: on ? C.success : C.bgSurface, color: C.textOnDeep,
    }}>
      {on && <Check size={16} strokeWidth={3} />}
    </span>
  );
}

const card = { border: `1px solid ${C.borderWhisper}`, borderRadius: warm.radius.card, padding: 16 } as const;
const row = { ...card, display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '10px 14px', color: C.textPrimary } as const;
const heading = { ...warm.text.body, fontWeight: 700, margin: '28px 0 10px', display: 'flex', gap: 10, alignItems: 'baseline' } as const;
const stepButton = {
  width: 36, height: 36, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer',
  border: `1px solid ${C.borderDefined}`, background: C.bgSurface, color: C.textSecondary,
} as const;
const linkButton = {
  ...warm.text.small, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
  border: `1px solid ${C.borderDefined}`, background: C.bgSurface, color: C.textSecondary,
} as const;
