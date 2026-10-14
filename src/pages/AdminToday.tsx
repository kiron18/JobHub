/**
 * AdminToday: the first thing on screen, at /admin/today.
 *
 * One list of things to do, top to bottom, in the order they are worth doing:
 * the calls, the day's own tasks, then the people who need something from
 * you. Two sources behind it:
 *
 *   /api/admin/today   worked out from the data (calls, follow-ups, quiet
 *                      clients, payments)
 *   /api/admin/daily   the hand-ticked checklist, from src/config/dailyTasks.ts
 *
 * A row is one line. Everything else about a person is a click away on their
 * own page, which is the point: this page answers "what next", not "tell me
 * about them".
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import api from '../lib/api';
import { AdminShell } from '../components/admin/AdminShell';
import { personPath, timeOf, whatsappLink } from '../components/admin/people';
import {
  POST_OF_THE_DAY, tasksFor, weekdayOf, isDone,
  type DailyTask, type DoneMap,
} from '../config/dailyTasks';

interface TodayResponse {
  calls: {
    meetingId: string; leadId: string; name: string; startsAt: string; minutes: number;
    meetLink: string | null; kind: string; about: string | null; finished: boolean;
  }[];
  followUps: { leadId: string; name: string; why: string; action: 'message' | 'book' }[];
  followUpsTotal: number;
  quiet: { userId: string; name: string; days: number; never: boolean; phone: string | null; email: string | null }[];
  quietTotal: number;
  money: { kind: 'failed' | 'unmatched'; userId: string | null; name: string; why: string; invoiceUrl: string | null; email: string | null }[];
  moneyTotal: number;
}

interface Signup { userId: string; name: string | null; email: string | null; joinedAt: string; welcomedOn: string | null }

interface DailyResponse {
  today: string;
  date: string;
  log: { done: DoneMap; welcomed: string[]; note: string };
  signups: Signup[];
}

const longDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export default function AdminToday() {
  const qc = useQueryClient();
  const feed = useQuery({
    queryKey: ['admin-today'],
    queryFn: async () => (await api.get('/admin/today')).data as TodayResponse,
    refetchOnWindowFocus: true,
  });
  const daily = useQuery({
    queryKey: ['admin-daily', 'today'],
    queryFn: async () => (await api.get('/admin/daily')).data as DailyResponse,
  });

  const [done, setDone] = useState<DoneMap>({});
  const [welcomed, setWelcomed] = useState<string[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const dirty = useRef(false);

  // Load the day into local state once, so a background refetch never wipes a
  // tick that has not finished saving.
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!daily.data || loadedFor.current === daily.data.date) return;
    loadedFor.current = daily.data.date;
    setDone(daily.data.log.done);
    setWelcomed(daily.data.log.welcomed);
  }, [daily.data]);

  // Save shortly after the last change. The note is sent back as it was: this
  // page does not edit it, and the endpoint replaces the whole day.
  useEffect(() => {
    if (!daily.data || !dirty.current) return;
    const { date, log } = daily.data;
    const t = setTimeout(async () => {
      try {
        await api.put(`/admin/daily/${date}`, { done, welcomed, note: log.note });
        dirty.current = false;
        setSaveFailed(false);
        qc.invalidateQueries({ queryKey: ['admin-daily'] });
      } catch {
        setSaveFailed(true);
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, welcomed]);

  const change = <T,>(set: (fn: (prev: T) => T) => void, fn: (prev: T) => T) => { dirty.current = true; set(fn); };

  const date = daily.data?.date;
  const tasks = date ? tasksFor(date) : [];
  const tasksLeft = tasks.filter((t) => !isDone(t, done)).length;
  const post = date ? POST_OF_THE_DAY[weekdayOf(date)] : null;
  const toWelcome = (daily.data?.signups ?? []).filter((s) => !s.welcomedOn || s.welcomedOn === date || welcomed.includes(s.userId));
  const welcomeLeft = toWelcome.filter((s) => !welcomed.includes(s.userId)).length;

  const f = feed.data;
  const left = (f ? f.calls.filter((c) => !c.finished).length + f.followUpsTotal + f.quietTotal + f.moneyTotal : 0) + tasksLeft + welcomeLeft;

  return (
    <AdminShell
      title="Today"
      subtitle={<>
        {date ? `${longDate(date)}. ` : ''}
        {feed.isLoading || daily.isLoading ? 'Loading…' : left === 0 ? 'Nothing left to do.' : `${left} thing${left === 1 ? '' : 's'} to do.`}
        {saveFailed && <span className="adm-error"> Your last tick was not saved. Check your connection.</span>}
      </>}
    >
      {(feed.error || daily.error) && <p className="adm-error">Some of today could not be loaded. Refresh to try again.</p>}

      <h2>Calls today</h2>
      <div className="adm-card">
        {!f?.calls.length && <div className="adm-empty">{feed.isLoading ? 'Loading…' : 'No calls today.'}</div>}
        {f?.calls.map((c) => (
          <div key={c.meetingId} className={`adm-row${c.finished ? ' done' : ''}`}>
            <div className="adm-time">{timeOf(c.startsAt)}</div>
            <Link to={personPath({ leadId: c.leadId })} className="adm-grow" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="adm-name">{c.name}</div>
              <div className="adm-meta">{c.kind}{c.about ? `. ${c.about}` : ''}</div>
            </Link>
            {c.meetLink && !c.finished && (
              <a className="adm-btn" href={c.meetLink} target="_blank" rel="noopener noreferrer">Join</a>
            )}
            <Link className="adm-btn ghost" to={personPath({ leadId: c.leadId })}>Open</Link>
          </div>
        ))}
      </div>

      {post && <>
        <h2>Your tasks <span>{tasks.length - tasksLeft} of {tasks.length} done</span></h2>
        <div className="adm-card">
          <div className="adm-row" style={{ background: '#F2F8FC' }}>
            <div className="adm-grow">
              <div className="adm-meta" style={{ marginTop: 0 }}>Today’s post</div>
              <div className="adm-name">{post.name}</div>
              <div className="adm-meta">{post.what}</div>
            </div>
          </div>
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
      </>}

      {!!f?.followUps.length && <>
        <h2>Follow up {f.followUpsTotal > f.followUps.length && <span>showing {f.followUps.length} of {f.followUpsTotal}</span>}</h2>
        <div className="adm-card">
          {f.followUps.map((p) => (
            <Link key={p.leadId} to={personPath({ leadId: p.leadId })} className="adm-row">
              <div className="adm-grow">
                <div className="adm-name">{p.name}</div>
                <div className="adm-meta">{p.why}</div>
              </div>
              <span className="adm-btn ghost">{p.action === 'book' ? 'Book a call' : 'Open'}</span>
            </Link>
          ))}
        </div>
      </>}

      {!!f?.quiet.length && <>
        <h2>Clients gone quiet {f.quietTotal > f.quiet.length && <span>showing {f.quiet.length} of {f.quietTotal}</span>}</h2>
        <div className="adm-card">
          {f.quiet.map((p) => {
            const wa = whatsappLink(p.phone, p.name);
            return (
              <div key={p.userId} className="adm-row">
                <span className={`adm-dot ${p.days >= 7 ? 'red' : 'amber'}`} />
                <Link to={personPath({ userId: p.userId })} className="adm-grow" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <div className="adm-name">{p.name}</div>
                  <div className="adm-meta">
                    {p.never ? `Paying for ${p.days} days and has not used the app.` : `No activity for ${p.days} days.`}
                  </div>
                </Link>
                {wa
                  ? <a className="adm-btn ghost" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                  : p.email && <a className="adm-btn ghost" href={`mailto:${p.email}`}>Email</a>}
              </div>
            );
          })}
        </div>
      </>}

      {!!f?.money.length && <>
        <h2>Money</h2>
        <div className="adm-card">
          {f.money.map((m, i) => (
            <div key={`${m.kind}:${m.userId ?? m.email ?? i}`} className="adm-row">
              <span className={`adm-dot ${m.kind === 'failed' ? 'red' : 'amber'}`} />
              <div className="adm-grow">
                <div className="adm-name">{m.name}</div>
                <div className="adm-meta">{m.why}</div>
              </div>
              {m.invoiceUrl && <a className="adm-btn ghost" href={m.invoiceUrl} target="_blank" rel="noopener noreferrer">Open invoice</a>}
              {m.userId && <Link className="adm-btn ghost" to={personPath({ userId: m.userId })}>Open</Link>}
            </div>
          ))}
        </div>
      </>}

      {toWelcome.length > 0 && <>
        <h2>New signups to welcome <span>until this is automated</span></h2>
        <div className="adm-card">
          {toWelcome.map((s) => {
            const on = welcomed.includes(s.userId);
            return (
              <button
                key={s.userId}
                className={`adm-row${on ? ' done' : ''}`}
                aria-pressed={on}
                onClick={() => change(setWelcomed, (w) => (on ? w.filter((id) => id !== s.userId) : [...w, s.userId]))}
              >
                <Tick on={on} />
                <div className="adm-grow">
                  <div className="adm-name">{s.name || s.email || 'No name yet'}</div>
                  <div className="adm-meta">
                    {s.name && s.email ? `${s.email}. ` : ''}Joined {new Date(s.joinedAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}.
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </>}
    </AdminShell>
  );
}

function Tick({ on }: { on: boolean }) {
  return <span className={`adm-check${on ? ' on' : ''}`} aria-hidden>{on && <Check size={14} strokeWidth={3} />}</span>;
}

function TaskRow({ task, done, onTick, onCount }: {
  task: DailyTask;
  done: DoneMap;
  onTick: () => void;
  onCount: (key: string, n: number) => void;
}) {
  const finished = isDone(task, done);

  if (task.kind === 'count') {
    const n = typeof done[task.id] === 'number' ? (done[task.id] as number) : 0;
    return (
      <div className={`adm-row${finished ? ' done' : ''}`}>
        <Tick on={finished} />
        <div className="adm-grow">
          <div className="adm-name">{task.label}</div>
          {task.hint && <div className="adm-meta">{task.hint}</div>}
        </div>
        <span className="adm-step">
          <button aria-label="One fewer" onClick={() => onCount(task.id, n - 1)}>−</button>
          {n} / {task.target}
          <button aria-label="One more" onClick={() => onCount(task.id, n + 1)}>+</button>
        </span>
      </div>
    );
  }

  const askKey = `${task.id}_n`;
  const asked = typeof done[askKey] === 'number' ? (done[askKey] as number) : 0;
  return (
    <div className={`adm-row click${finished ? ' done' : ''}`} onClick={onTick} role="checkbox" aria-checked={finished} tabIndex={0}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onTick(); } }}>
      <Tick on={finished} />
      <div className="adm-grow">
        <div className="adm-name">{task.label}</div>
        {task.hint && <div className="adm-meta">{task.hint}</div>}
      </div>
      {task.ask && finished && (
        <span className="adm-step" onClick={(e) => e.stopPropagation()}>
          <button aria-label="One fewer" onClick={() => onCount(askKey, asked - 1)}>−</button>
          {asked} {task.ask}
          <button aria-label="One more" onClick={() => onCount(askKey, asked + 1)}>+</button>
        </span>
      )}
    </div>
  );
}
