/* ────────────────────────────────────────────────────────────────────────────
   AdminWorkshop — /admin/workshop

   The prep console. At 4pm on workshop day this page turns a roster and a
   pasted Skool thread into a run sheet plus a fact sheet on everyone in the
   room, with their resume one click away.

   Two things it deliberately does not do.

   It does not pull the Skool thread. Skool has no API, so the thread is pasted
   in by hand, once. That is the only manual step left and no amount of building
   removes it.

   And it does not close the thread. The header goes red at T-60 and says to,
   because knowing when is the part that gets forgotten; the closing itself
   happens in Skool, by hand, deliberately.
   ──────────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Copy, Check, FileText, Loader2, Sparkles, ExternalLink, AlertTriangle,
  Users, MessageSquareText, BookOpenText, ArrowLeft,
} from 'lucide-react';
import api from '../lib/api';
import {
  BEATS, CUT_RULE, RULES, QUESTION_BUDGET, SILENT_WINDOW_LINE,
  OFFER_NOTES, BEFORE_THE_CALL, AFTER_THE_CALL,
  offerScript, deadlineFor, beatTime, formatClock, formatDeadline, formatSessionDate,
  gapLabel,
} from '../config/runsheet';

// ── Types, mirroring what the route returns ──────────────────────────────────

interface CoachBrief {
  who: string;
  stuck: string;
  question: string;
  gap: 1 | 2 | 3 | 4 | null;
  nameCallout: string;
  resumeLine: string | null;
  temperature: 'Hot' | 'Warm' | 'Cold';
  temperatureReason: string;
}

interface Person {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  registeredAt: string;
  attendedAt: string | null;
  question: string | null;
  coachBrief: CoachBrief | null;
  coachBriefAt: string | null;
  hasResume: boolean;
  resumeFilename: string | null;
  resumeSkipReason: string | null;
  answers: Record<string, unknown> | null;
  questionSchema: { id: string; label: string; type: string }[] | null;
  /** The sales board id, which is what the existing resume endpoint is keyed on. */
  leadId: string | null;
  stage: string | null;
  paid: boolean;
}

interface SessionMeta {
  sessionKey: string;
  startsAt: string | null;
  isNext: boolean;
  durationMinutes: number;
  timeZone: string;
  slotLabel: string;
  title: string;
  meetLink: string;
  skoolUrl: string;
  claimUrl: string;
}

interface FloorQuestion { id: string; poster: string | null; question: string }

interface Payload {
  session: SessionMeta;
  sessions: { sessionKey: string; count: number }[];
  counts: { registered: number; resumes: number; questions: number; briefs: number; attended: number; floor: number };
  floorQuestions: FloorQuestion[];
  roster: Person[];
}

interface ThreadMatch {
  poster: string;
  question: string;
  registrationId: string | null;
  note: string;
}

// The offer, as it currently stands. Kept here rather than in runsheet.ts
// because the price is a business decision that changes without the shape of
// the sheet changing.
const OFFER = { price: 750, perMonth: 250, months: 3 };

const C = {
  bg: '#FFFFFF', alt: '#F7FAFC', line: '#E3EAF0', lineStrong: '#CBD7E1',
  ink: '#0F1E2B', ink2: '#4A5A68', ink3: '#8496A4',
  blue: '#1857A0', green: '#1E7A56', amber: '#8A6420', danger: '#B4432F',
};

const TEMP_COLOR: Record<string, { bg: string; fg: string }> = {
  Hot: { bg: '#FBE7E2', fg: '#B4432F' },
  Warm: { bg: '#FBF0DC', fg: '#8A6420' },
  Cold: { bg: '#EEF1F4', fg: '#5A6874' },
};

const FONT = "'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif";

// ── Bits ─────────────────────────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        });
      }}
      title={value}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        padding: '6px 11px', borderRadius: 7, fontSize: 12.5, fontWeight: 600,
        border: `1.5px solid ${done ? C.green : C.line}`,
        background: done ? C.green : C.bg, color: done ? '#fff' : C.ink2,
      }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
      {done ? 'Copied' : label}
    </button>
  );
}

function Stat({ n, of, label, warn }: { n: number; of?: number; label: string; warn?: boolean }) {
  return (
    <div style={{ minWidth: 88 }}>
      <div style={{
        fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        color: warn ? C.danger : C.ink, lineHeight: 1.1,
      }}>
        {n}{of != null && <span style={{ color: C.ink3, fontWeight: 500 }}> / {of}</span>}
      </div>
      <div style={{ fontSize: 11.5, color: C.ink3, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h2 style={{
      display: 'flex', alignItems: 'center', gap: 9,
      fontSize: 12, fontWeight: 700, letterSpacing: '.11em', textTransform: 'uppercase',
      color: C.ink3, margin: '0 0 12px',
    }}>
      {icon}{children}
    </h2>
  );
}

/**
 * The resume, fetched rather than linked.
 *
 * The endpoint is behind `authenticate`, which reads a bearer token, and a plain
 * anchor navigation carries no Authorization header at all. So the bytes come
 * through the same axios client as everything else and open as an object URL.
 */
function ResumeButton({ person }: { person: Person }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!person.hasResume) {
    return (
      <span style={{ fontSize: 12.5, color: C.ink3 }}>
        No resume{person.resumeSkipReason ? `: ${person.resumeSkipReason}` : ''}
      </span>
    );
  }
  if (!person.leadId) {
    return <span style={{ fontSize: 12.5, color: C.amber }}>Resume on file, no board row to serve it from</span>;
  }

  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        setErr(null);
        try {
          const r = await api.get(`/admin/sales/${person.leadId}/resume`, { responseType: 'blob' });
          const url = URL.createObjectURL(r.data as Blob);
          window.open(url, '_blank', 'noopener');
          // Revoked late: revoking immediately races the new tab reading it.
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch {
          setErr('Could not open it');
        } finally {
          setBusy(false);
        }
      }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: busy ? 'wait' : 'pointer',
        padding: '7px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 600,
        border: `1.5px solid ${C.line}`, background: C.bg, color: err ? C.danger : C.blue,
      }}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
      {err ?? (person.resumeFilename || 'Open resume')}
    </button>
  );
}

function BriefCard({ brief, big }: { brief: CoachBrief; big?: boolean }) {
  const size = big ? 16.5 : 13.5;
  const tc = TEMP_COLOR[brief.temperature] ?? TEMP_COLOR.Warm;
  const row = (label: string, body: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
      <span style={{
        flex: `0 0 ${big ? 96 : 78}px`, fontSize: big ? 12 : 10.5, fontWeight: 700,
        letterSpacing: '.07em', textTransform: 'uppercase', color: C.ink3,
      }}>
        {label}
      </span>
      <span style={{ fontSize: size, lineHeight: 1.5, minWidth: 0 }}>{body}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 10 : 7 }}>
      {row('Who', brief.who)}
      {row('Stuck', brief.stuck)}
      {row('Asked', (
        <>
          {brief.question}{' '}
          <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: 999, marginLeft: 4,
            fontSize: big ? 12 : 10.5, fontWeight: 700, background: '#E7F0F8', color: C.blue,
            whiteSpace: 'nowrap',
          }}>
            {gapLabel(brief.gap)}
          </span>
        </>
      ))}
      {row('Say', <strong style={{ fontWeight: 600 }}>{brief.nameCallout}</strong>)}
      {row('Rewrite live', brief.resumeLine
        ? <em style={{ color: C.ink2 }}>"{brief.resumeLine}"</em>
        : <span style={{ color: C.ink3 }}>No quotable line on file</span>)}
      {row('Read', (
        <>
          <span style={{
            display: 'inline-block', padding: '2px 9px', borderRadius: 999,
            fontSize: big ? 12.5 : 11, fontWeight: 700, background: tc.bg, color: tc.fg,
          }}>
            {brief.temperature}
          </span>
          <span style={{ marginLeft: 9, color: C.ink2 }}>{brief.temperatureReason}</span>
        </>
      ))}
    </div>
  );
}

// ── The page ─────────────────────────────────────────────────────────────────

export default function AdminWorkshop() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const sessionParam = params.get('session') ?? '';
  const readMode = params.get('read') === '1';

  // A fresh object every time: mutating the one `useSearchParams` handed back
  // and passing it straight to the setter passes an unchanged reference, which
  // React is entitled to skip.
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value == null) next.delete(key);
    else next.set(key, value);
    setParams(next);
  };

  const [thread, setThread] = useState('');
  const [proposal, setProposal] = useState<ThreadMatch[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // The countdown is the only live thing on the page, and it is what the T-60
  // chip hangs off. Once a minute is plenty and costs nothing.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading } = useQuery<Payload>({
    queryKey: ['admin-workshop', sessionParam],
    queryFn: () =>
      api.get('/admin/workshop', { params: sessionParam ? { session: sessionParam } : {} })
        .then((r) => r.data),
  });

  const match = useMutation({
    mutationFn: () =>
      api.post('/admin/workshop/questions/match', { session: data?.session.sessionKey, thread })
        .then((r) => r.data as { matches: ThreadMatch[] }),
    onSuccess: (r) => setProposal(r.matches),
  });

  const commit = useMutation({
    mutationFn: (assignments: ThreadMatch[]) =>
      api.post('/admin/workshop/questions', { session: data?.session.sessionKey, assignments })
        .then((r) => r.data),
    onSuccess: () => {
      setProposal(null);
      setThread('');
      qc.invalidateQueries({ queryKey: ['admin-workshop'] });
    },
  });

  const briefOne = useMutation({
    mutationFn: (id: string) => api.post(`/admin/workshop/brief/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-workshop'] }),
  });

  const briefAll = useMutation({
    mutationFn: (force: boolean) =>
      api.post('/admin/workshop/brief-all', { session: data?.session.sessionKey, force })
        .then((r) => r.data as { generated: number; skipped: number; failures: { name: string; error: string }[] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-workshop'] }),
  });

  const session = data?.session;
  const roster = data?.roster ?? [];
  const counts = data?.counts;

  const start = useMemo(
    () => (session?.startsAt && session.isNext ? new Date(session.startsAt) : null),
    [session?.startsAt, session?.isNext],
  );
  const minutesToStart = start ? Math.round((start.getTime() - now) / 60_000) : null;
  const closeThreadNow = minutesToStart != null && minutesToStart <= 60;

  // ── The read ───────────────────────────────────────────────────────────────
  // The only tab open during the call: the run sheet, then every fact sheet, in
  // one scroll at a size that can be read while talking.
  if (readMode && session) {
    return (
      <div style={{
        minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: FONT,
        padding: '28px clamp(16px, 4vw, 44px) 120px',
      }}>
        <div style={{ maxWidth: 940, margin: '0 auto' }}>
          <button
            onClick={() => setParam('read', null)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 22,
              padding: '8px 13px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              border: `1.5px solid ${C.line}`, background: C.bg, color: C.ink2,
            }}
          >
            <ArrowLeft size={14} /> Back to the console
          </button>

          <RunSheet session={session} roster={roster} floor={data?.floorQuestions ?? []} big />

          <h2 style={{ fontSize: 26, fontWeight: 700, margin: '52px 0 6px' }}>The room</h2>
          <p style={{ fontSize: 15, color: C.ink3, margin: '0 0 26px' }}>
            {roster.length} registered. Read down. Names first.
          </p>

          {roster.map((p) => (
            <section key={p.id} style={{
              borderTop: `2px solid ${C.line}`, padding: '24px 0 26px',
            }}>
              <h3 style={{ fontSize: 25, fontWeight: 700, margin: '0 0 4px' }}>{p.name}</h3>
              <p style={{ fontSize: 14, color: C.ink3, margin: '0 0 16px' }}>
                {p.email}{p.paid ? ' · already a client' : ''}
              </p>
              {p.coachBrief
                ? <BriefCard brief={p.coachBrief} big />
                : (
                  <p style={{ fontSize: 16, color: C.amber, margin: 0 }}>
                    No fact sheet generated.{p.question ? ` They asked: "${p.question}"` : ' They asked nothing.'}
                  </p>
                )}
            </section>
          ))}
        </div>
      </div>
    );
  }

  // ── The console ────────────────────────────────────────────────────────────
  return (
    <div style={{
      height: '100vh', overflowY: 'auto', background: C.bg, color: C.ink, fontFamily: FONT,
      padding: '24px clamp(14px, 3vw, 28px) 90px', boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 4 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Workshop</h1>
          <a href="/admin/sales" style={{ fontSize: 13, color: C.blue, fontWeight: 600 }}>Sales board</a>
        </div>

        {isLoading || !session || !counts ? (
          <p style={{ color: C.ink3, display: 'flex', gap: 9, alignItems: 'center', marginTop: 24 }}>
            <Loader2 size={16} className="animate-spin" /> Loading the room...
          </p>
        ) : (
          <>
            {/* ── Header strip ──────────────────────────────────────────── */}
            <div style={{
              border: `1.5px solid ${closeThreadNow ? C.danger : C.line}`, borderRadius: 12,
              padding: '18px 20px', margin: '14px 0 26px', background: C.alt,
            }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 260 }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {start ? formatSessionDate(start, session.timeZone) : session.sessionKey}
                  </div>
                  <div style={{ fontSize: 13, color: C.ink2, marginTop: 3 }}>
                    {start
                      ? `${formatClock(start, session.timeZone)} ${session.timeZone} · ${session.slotLabel}`
                      : 'A past session, read only'}
                  </div>
                  {minutesToStart != null && (
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: minutesToStart < 0 ? C.green : C.ink, marginTop: 7 }}>
                      {minutesToStart < 0
                        ? `Live now, started ${Math.abs(minutesToStart)} min ago`
                        : minutesToStart > 120
                          ? `Starts in ${Math.round(minutesToStart / 60)} hours`
                          : `Starts in ${minutesToStart} min`}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                  <Stat n={counts.registered} label="registered" />
                  <Stat n={counts.resumes} of={counts.registered} label="resumes in" warn={counts.resumes < counts.registered} />
                  <Stat n={counts.questions} of={counts.registered} label="questions in" warn={!counts.questions} />
                  <Stat n={counts.briefs} of={counts.registered} label="fact sheets" warn={counts.briefs < counts.registered} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16, alignItems: 'center' }}>
                <CopyButton value={session.meetLink} label="Meet link" />
                <CopyButton value={session.claimUrl} label="Claim link" />
                <a href={session.skoolUrl} target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px',
                  borderRadius: 7, fontSize: 12.5, fontWeight: 600, color: C.ink2,
                  border: `1.5px solid ${C.line}`,
                }}>
                  <ExternalLink size={13} /> Skool thread
                </a>

                {data.sessions.length > 1 && (
                  <select
                    value={session.sessionKey}
                    onChange={(e) => setParam('session', e.target.value)}
                    style={{
                      padding: '6px 10px', borderRadius: 7, fontSize: 12.5, fontWeight: 600,
                      border: `1.5px solid ${C.line}`, background: C.bg, color: C.ink2, fontFamily: FONT,
                    }}
                  >
                    {data.sessions.map((s) => (
                      <option key={s.sessionKey} value={s.sessionKey}>
                        {s.sessionKey} ({s.count})
                      </option>
                    ))}
                  </select>
                )}

                <div style={{ flex: 1 }} />

                <button
                  onClick={() => setParam('read', '1')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '9px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13.5, fontWeight: 700,
                    border: 'none', background: C.ink, color: '#fff',
                  }}
                >
                  <BookOpenText size={15} /> Open the read
                </button>
              </div>

              {closeThreadNow && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 9, marginTop: 14,
                  padding: '10px 13px', borderRadius: 8, background: '#FBE7E2', color: C.danger,
                  fontSize: 13.5, fontWeight: 700,
                }}>
                  <AlertTriangle size={16} />
                  Close the thread now. Paste it in below before you do anything else.
                </div>
              )}
            </div>

            {/* ── Paste box ─────────────────────────────────────────────── */}
            <section style={{ marginBottom: 34 }}>
              <SectionTitle icon={<MessageSquareText size={14} />}>The thread</SectionTitle>

              {!proposal ? (
                <>
                  <textarea
                    value={thread}
                    onChange={(e) => setThread(e.target.value)}
                    placeholder="Select the whole Skool thread, copy it, paste it here. Interface noise and all, it gets stripped."
                    style={{
                      width: '100%', boxSizing: 'border-box', minHeight: 150, resize: 'vertical',
                      padding: '13px 15px', borderRadius: 10, border: `1.5px solid ${C.lineStrong}`,
                      fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.55,
                    }}
                  />
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                    <button
                      disabled={thread.trim().length < 20 || match.isPending}
                      onClick={() => match.mutate()}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px', borderRadius: 9, fontSize: 14, fontWeight: 700,
                        cursor: thread.trim().length < 20 ? 'not-allowed' : 'pointer', border: 'none',
                        background: thread.trim().length < 20 ? C.lineStrong : C.blue, color: '#fff',
                      }}
                    >
                      {match.isPending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                      Match to the roster
                    </button>
                    {match.isError && (
                      <span style={{ fontSize: 13, color: C.danger }}>
                        {(match.error as any)?.response?.data?.error ?? 'That did not go through.'}
                      </span>
                    )}
                    {counts.questions > 0 && (
                      <span style={{ fontSize: 13, color: C.ink3 }}>
                        {counts.questions} question{counts.questions === 1 ? '' : 's'} already saved.
                        Pasting again replaces all of them.
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13.5, color: C.ink2, margin: '0 0 12px', lineHeight: 1.55 }}>
                    {proposal.length} question{proposal.length === 1 ? '' : 's'} found. Fix any wrong name in the
                    dropdown, then save. Anything left on "Nobody" survives as a floor question and still gets answered.
                  </p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: `2px solid ${C.line}`, color: C.ink3, fontSize: 11.5 }}>
                        <th style={{ padding: '9px 8px', width: 150 }}>Posted as</th>
                        <th style={{ padding: '9px 8px' }}>Question</th>
                        <th style={{ padding: '9px 8px', width: 210 }}>Who that is</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proposal.map((m, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.line}`, verticalAlign: 'top' }}>
                          <td style={{ padding: '11px 8px', fontWeight: 600 }}>
                            {m.poster}
                            {m.note && <div style={{ fontSize: 11.5, color: C.ink3, fontWeight: 400, marginTop: 3 }}>{m.note}</div>}
                          </td>
                          <td style={{ padding: '11px 8px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{m.question}</td>
                          <td style={{ padding: '11px 8px' }}>
                            <select
                              value={m.registrationId ?? ''}
                              onChange={(e) => {
                                const next = [...proposal];
                                next[i] = { ...m, registrationId: e.target.value || null };
                                setProposal(next);
                              }}
                              style={{
                                width: '100%', padding: '7px 9px', borderRadius: 7, fontSize: 13,
                                fontFamily: FONT, background: C.bg,
                                border: `1.5px solid ${m.registrationId ? C.line : C.amber}`,
                                color: m.registrationId ? C.ink : C.amber,
                              }}
                            >
                              <option value="">Nobody (floor question)</option>
                              {roster.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                    <button
                      disabled={commit.isPending}
                      onClick={() => commit.mutate(proposal)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px', borderRadius: 9, fontSize: 14, fontWeight: 700,
                        cursor: 'pointer', border: 'none', background: C.green, color: '#fff',
                      }}
                    >
                      {commit.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      Save to the roster
                    </button>
                    <button
                      onClick={() => setProposal(null)}
                      style={{
                        padding: '10px 16px', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                        border: `1.5px solid ${C.line}`, background: C.bg, color: C.ink2,
                      }}
                    >
                      Start over
                    </button>
                  </div>
                </>
              )}

              {data.floorQuestions.length > 0 && !proposal && (
                <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 10, background: C.alt, border: `1.5px solid ${C.line}` }}>
                  <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.ink3, margin: '0 0 9px' }}>
                    Floor questions ({data.floorQuestions.length})
                  </p>
                  <p style={{ fontSize: 12.5, color: C.ink3, margin: '0 0 11px' }}>
                    Nobody on the roster. Answer these to the room, not to a name.
                  </p>
                  {data.floorQuestions.map((f) => (
                    <div key={f.id} style={{ fontSize: 13.5, lineHeight: 1.55, marginBottom: 9 }}>
                      <span style={{ whiteSpace: 'pre-wrap' }}>{f.question}</span>
                      {f.poster && <span style={{ color: C.ink3 }}> ({f.poster})</span>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Roster ────────────────────────────────────────────────── */}
            <section style={{ marginBottom: 34 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
                <SectionTitle icon={<Users size={14} />}>The room</SectionTitle>
                <div style={{ flex: 1 }} />
                <button
                  disabled={briefAll.isPending || !roster.length}
                  onClick={() => briefAll.mutate(false)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12,
                    padding: '9px 17px', borderRadius: 8, fontSize: 13.5, fontWeight: 700,
                    cursor: briefAll.isPending ? 'wait' : 'pointer', border: 'none',
                    background: C.blue, color: '#fff', opacity: roster.length ? 1 : 0.5,
                  }}
                >
                  {briefAll.isPending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  Generate all
                </button>
                {counts.briefs > 0 && (
                  <button
                    disabled={briefAll.isPending}
                    onClick={() => briefAll.mutate(true)}
                    title="Regenerate every fact sheet, including ones that already exist. Do this after pasting the thread."
                    style={{
                      marginBottom: 12, padding: '9px 15px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', border: `1.5px solid ${C.line}`, background: C.bg, color: C.ink2,
                    }}
                  >
                    Redo all
                  </button>
                )}
              </div>

              {briefAll.data && (
                <p style={{ fontSize: 13, color: briefAll.data.failures.length ? C.danger : C.green, margin: '0 0 14px' }}>
                  {briefAll.data.generated} generated
                  {briefAll.data.skipped ? `, ${briefAll.data.skipped} already had one` : ''}
                  {briefAll.data.failures.length
                    ? `. Failed: ${briefAll.data.failures.map((f) => f.name).join(', ')}`
                    : '.'}
                </p>
              )}

              {!roster.length ? (
                <p style={{ color: C.ink3 }}>Nobody has registered for {session.sessionKey} yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                  {roster.map((p) => (
                    <div key={p.id} style={{
                      border: `1.5px solid ${C.line}`, borderRadius: 11, padding: '16px 18px',
                      background: C.bg,
                    }}>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 12 }}>
                        <span style={{ fontSize: 16.5, fontWeight: 700 }}>{p.name}</span>
                        {p.paid && (
                          <span style={{
                            padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                            background: C.green, color: '#fff',
                          }}>
                            Client
                          </span>
                        )}
                        <span style={{ fontSize: 12.5, color: C.ink3 }}>
                          {p.email} · registered {new Date(p.registeredAt).toLocaleDateString()}
                        </span>
                        <div style={{ flex: 1 }} />
                        <ResumeButton person={p} />
                        <button
                          disabled={briefOne.isPending}
                          onClick={() => briefOne.mutate(p.id)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                            padding: '7px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 600,
                            border: `1.5px solid ${C.line}`, background: C.bg, color: C.ink2,
                          }}
                        >
                          {briefOne.isPending && briefOne.variables === p.id
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Sparkles size={13} />}
                          {p.coachBrief ? 'Redo fact sheet' : 'Fact sheet'}
                        </button>
                      </div>

                      {/* Question first, verbatim. It is the reason the card exists. */}
                      {p.question ? (
                        <blockquote style={{
                          margin: '0 0 14px', padding: '10px 14px', borderLeft: `3px solid ${C.blue}`,
                          background: C.alt, borderRadius: '0 8px 8px 0',
                          fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                        }}>
                          {p.question}
                        </blockquote>
                      ) : (
                        <p style={{ fontSize: 13, color: C.ink3, margin: '0 0 14px' }}>
                          Nothing in the thread from them. Ask them live at S3.
                        </p>
                      )}

                      {p.coachBrief
                        ? <BriefCard brief={p.coachBrief} />
                        : <p style={{ fontSize: 13, color: C.ink3, margin: 0 }}>No fact sheet yet.</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Run sheet ─────────────────────────────────────────────── */}
            <RunSheet session={session} roster={roster} floor={data.floorQuestions} />
          </>
        )}
      </div>
    </div>
  );
}

// ── The run sheet ────────────────────────────────────────────────────────────

function RunSheet({
  session, roster, floor, big,
}: {
  session: SessionMeta;
  roster: Person[];
  floor: FloorQuestion[];
  big?: boolean;
}) {
  // Falls back to the next start for a past session, so the timings table still
  // renders something usable rather than blanking out.
  const start = session.startsAt ? new Date(session.startsAt) : null;
  const deadline = start ? deadlineFor(start) : null;
  const base = big ? 15 : 13.5;

  const th: React.CSSProperties = {
    textAlign: 'left', padding: '8px 10px', fontSize: big ? 12.5 : 11.5,
    color: C.ink3, borderBottom: `2px solid ${C.line}`, fontWeight: 700,
    letterSpacing: '.06em', textTransform: 'uppercase',
  };
  const td: React.CSSProperties = {
    padding: '9px 10px', borderBottom: `1px solid ${C.line}`, fontSize: base, lineHeight: 1.5,
    verticalAlign: 'top',
  };

  return (
    <section>
      <h2 style={{ fontSize: big ? 26 : 19, fontWeight: 700, margin: '0 0 4px' }}>Run sheet</h2>
      <p style={{ fontSize: big ? 15 : 13, color: C.ink3, margin: '0 0 22px' }}>
        {start ? `${formatSessionDate(start, session.timeZone)}, ${formatClock(start, session.timeZone)} ${session.timeZone}` : session.sessionKey}
        {' · '}{session.title}
      </p>

      {/* The room, at a glance: who asked what, and which gap it lands in. */}
      <h3 style={{ fontSize: big ? 19 : 15, fontWeight: 700, margin: '0 0 10px' }}>The room</h3>
      <p style={{ fontSize: base, color: C.ink2, margin: '0 0 12px' }}>
        {roster.length} registered, {roster.filter((p) => p.hasResume).length} resumes in,
        {' '}{roster.filter((p) => p.question).length} questions in.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 30 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: '24%' }}>Name</th>
            <th style={th}>What they asked</th>
            <th style={{ ...th, width: 150 }}>Lands in</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((p) => (
            <tr key={p.id}>
              <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
              <td style={td}>
                {p.coachBrief?.question && p.coachBrief.question !== 'No question asked.'
                  ? p.coachBrief.question
                  : p.question
                    ? p.question.split('\n')[0]
                    : <strong style={{ color: C.danger }}>Nothing asked. Ask them live at S3.</strong>}
              </td>
              <td style={td}>{gapLabel(p.coachBrief?.gap ?? null)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {floor.length > 0 && (
        <>
          <h3 style={{ fontSize: big ? 19 : 15, fontWeight: 700, margin: '0 0 10px' }}>Floor questions</h3>
          <ul style={{ margin: '0 0 30px', paddingLeft: 20, fontSize: base, lineHeight: 1.65 }}>
            {floor.map((f) => <li key={f.id}>{f.question}{f.poster ? ` (${f.poster})` : ''}</li>)}
          </ul>
        </>
      )}

      {/* Timings, derived from the real start rather than typed. */}
      <h3 style={{ fontSize: big ? 19 : 15, fontWeight: 700, margin: '0 0 10px' }}>Timings</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 90 }}>Time</th>
            <th style={{ ...th, width: 100 }}>Slide</th>
            <th style={th}>Beat</th>
          </tr>
        </thead>
        <tbody>
          {BEATS.map((b) => (
            <tr key={b.slide + b.offset}>
              <td style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: b.hard ? 700 : 500 }}>
                {start ? formatClock(beatTime(start, b.offset), session.timeZone) : `T${b.offset >= 0 ? '+' : ''}${b.offset}`}
              </td>
              <td style={{ ...td, color: C.ink3 }}>{b.slide}</td>
              <td style={{ ...td, fontWeight: b.hard ? 700 : 400 }}>{b.beat}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: base, fontWeight: 700, color: C.danger, margin: '0 0 8px' }}>
        {start
          ? CUT_RULE.replace('T+88', formatClock(beatTime(start, 88), session.timeZone))
          : CUT_RULE}
      </p>
      <p style={{ fontSize: base - 1, color: C.ink3, margin: '0 0 30px' }}>
        The invite promises {session.durationMinutes} minutes and this runs to{' '}
        {start ? formatClock(beatTime(start, 118), session.timeZone) : 'T+118'}. That is on purpose:
        the demo and the offer land after the promised end, and the people still in the room then are
        the ones who buy.
      </p>

      {/* Name check. Ticking is the mechanism, so it is a real checkbox. */}
      <h3 style={{ fontSize: big ? 19 : 15, fontWeight: 700, margin: '0 0 10px' }}>Name everyone</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 22px', marginBottom: 30 }}>
        {roster.map((p) => (
          <label key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: base, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 17, height: 17, accentColor: C.green }} />
            {p.name}
          </label>
        ))}
      </div>

      <h3 style={{ fontSize: big ? 19 : 15, fontWeight: 700, margin: '0 0 10px' }}>Your rules</h3>
      <ol style={{ margin: '0 0 30px', paddingLeft: 22, fontSize: base, lineHeight: 1.75 }}>
        {RULES.map((r) => <li key={r} style={{ marginBottom: 5 }}>{r}</li>)}
      </ol>

      <h3 style={{ fontSize: big ? 19 : 15, fontWeight: 700, margin: '0 0 10px' }}>Question budget</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 150 }}>Window</th>
            <th style={{ ...th, width: 230 }}>How many</th>
            <th style={th}>Why</th>
          </tr>
        </thead>
        <tbody>
          {QUESTION_BUDGET.map((q) => (
            <tr key={q.window}>
              <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                {start
                  ? q.window.replace(/T\+(\d+)/, (_, n) => formatClock(beatTime(start, Number(n)), session.timeZone))
                  : q.window}
              </td>
              <td style={{ ...td, fontWeight: 700 }}>{q.howMany}</td>
              <td style={td}>{q.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: base, color: C.ink2, margin: '0 0 30px' }}>{SILENT_WINDOW_LINE}</p>

      <h3 style={{ fontSize: big ? 19 : 15, fontWeight: 700, margin: '0 0 10px' }}>The offer, verbatim</h3>
      <div style={{
        borderLeft: `3px solid ${C.ink}`, padding: '4px 0 4px 18px', marginBottom: 14,
      }}>
        {offerScript({ ...OFFER, deadline, timeZone: session.timeZone })
          .map((para, i) => (
            <p key={i} style={{ fontSize: big ? 17 : 14.5, lineHeight: 1.65, margin: '0 0 13px' }}>{para}</p>
          ))}
      </div>
      {deadline && (
        <p style={{ fontSize: base, color: C.amber, fontWeight: 700, margin: '0 0 8px' }}>
          Deadline as generated: {formatDeadline(deadline, session.timeZone)}. Confirm it against a calendar before you say it.
        </p>
      )}
      <ul style={{ margin: '0 0 30px', paddingLeft: 22, fontSize: base, lineHeight: 1.7, color: C.ink2 }}>
        {OFFER_NOTES.map((n) => <li key={n} style={{ marginBottom: 5 }}>{n}</li>)}
      </ul>

      <h3 style={{ fontSize: big ? 19 : 15, fontWeight: 700, margin: '0 0 10px' }}>Before you start</h3>
      <ol style={{ margin: '0 0 30px', paddingLeft: 22, fontSize: base, lineHeight: 1.7 }}>
        {BEFORE_THE_CALL.map((b) => <li key={b} style={{ marginBottom: 5 }}>{b}</li>)}
      </ol>

      <h3 style={{ fontSize: big ? 19 : 15, fontWeight: 700, margin: '0 0 10px' }}>Tonight, after</h3>
      <ol style={{ margin: 0, paddingLeft: 22, fontSize: base, lineHeight: 1.7 }}>
        {AFTER_THE_CALL.map((a) => <li key={a} style={{ marginBottom: 5 }}>{a}</li>)}
      </ol>
    </section>
  );
}
