/* ────────────────────────────────────────────────────────────────────────────
   AdminSales — /admin/sales

   The sales board, moved off the local Python CRM.

   Two deliberate reductions from the board it replaces.

   Ten stages became five plus Dead. Every stage that had to be dragged by hand
   was a stage that went stale, so Registered, Attended, Pitched and Client are
   all derived from things the system already records. Only Dead is manual,
   because "not going to buy" is a judgement with no signal behind it.

   And the scoring is gone. Star ratings, pulse and the rest were a second
   opinion layered on top of facts, and the facts turned out to be better: what
   someone told you, whether they turned up, and whether they paid.

   ⚠️ THERE IS NO STAGE COLUMN, ON PURPOSE. There used to be, and it printed the
   word "Registered" in a row that already had a green "Registered" chip beside
   it, inside a tab called "Registered" — the same fact three times, which read
   like three different facts. The stage is derived from the chips, so the chips
   are the stage: Registered, Attended, Report sent (Pitched) and Paid (Client)
   in order. Dead is the one stage no chip can carry, so it rides next to the
   name. Do not put the badge back.

   ⚠️ SESSION IS A COLUMN BECAUSE THE STAGE DOES NOT EXPIRE. Someone who
   registered for a workshop two months ago and never turned up is still at
   stage Registered today, sitting in the same tab as tonight's sign-ups with
   nothing to tell them apart. The column, and the filter next to the search
   box, are what stop "25 registered" being read as "25 people coming tonight".
   ──────────────────────────────────────────────────────────────────────────── */
import { Fragment, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, FileText, ExternalLink, Loader2, ChevronDown, Archive, Trash2, X } from 'lucide-react';
import api from '../lib/api';

const STAGES = ['Lead', 'Registered', 'Attended', 'Pitched', 'Client', 'Dead'] as const;
type Stage = (typeof STAGES)[number];

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  headline: string | null;
  company: string | null;
  stage: Stage;
  source: string;
  sourceAsset: string | null;
  archived: boolean;
  registeredAt: string | null;
  /** A click through to the group, never a confirmed join. Skool has no API. */
  skoolClickedAt: string | null;
  attendedAt: string | null;
  reportSentAt: string | null;
  paidAt: string | null;
  hasResume: boolean;
  notes: string | null;
  nextBest: string | null;
  answers: Record<string, unknown> | null;
  questionSchema: { id: string; label: string; type: string }[] | null;
  resumeFilename: string | null;
  hasResumeText: boolean;
  /** Which workshop their registration is for. Null when they never registered. */
  sessionKey: string | null;
  reportToken: string | null;
  reportError: string | null;
}

const C = {
  bg: '#FFFFFF', alt: '#F7FAFC', line: '#E3EAF0', lineStrong: '#CBD7E1',
  ink: '#0F1E2B', ink2: '#4A5A68', ink3: '#8496A4', blue: '#1857A0', danger: '#B4432F',
};

/** `2026-08-18` as `18 Aug`. Split by hand: `new Date('2026-08-18')` is parsed
 *  as UTC midnight and renders as the 17th for anyone west of Greenwich. */
function sessionLabel(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return key;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function AdminSales() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<Stage | 'All'>('All');
  const [sessionFilter, setSessionFilter] = useState<string>('All');
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['admin-sales', search, showArchived],
    queryFn: () =>
      api.get('/admin/sales', { params: { search, archived: showArchived } }).then((r) => r.data),
  });

  const patch = useMutation({
    mutationFn: (v: { id: string; body: Partial<Lead> }) => api.patch(`/admin/sales/${v.id}`, v.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sales'] }),
  });

  /** Selection is cleared on success rather than optimistically: a half-failed
   *  delete that left the checkboxes cleared would look like it worked. */
  const remove = useMutation({
    mutationFn: (ids: string[]) => api.post('/admin/sales/delete', { ids }).then((r) => r.data),
    onSuccess: () => {
      setSelected(new Set());
      setOpenId(null);
      qc.invalidateQueries({ queryKey: ['admin-sales'] });
    },
    // Loud, because the alternative is a board that silently still has them on
    // it and a second click that deletes twice as much next time.
    onError: (err: any) => {
      window.alert(`Nothing was deleted. ${err?.response?.data?.error ?? err?.message ?? 'The server refused it.'}`);
    },
  });

  const leads: Lead[] = data?.leads ?? [];
  const nextSessionKey: string | null = data?.nextSessionKey ?? null;

  /** Every session anyone on the board is registered for, newest first, plus
   *  the upcoming one even when nobody has signed up for it yet. */
  const sessions = useMemo(() => {
    const seen = new Map<string, number>();
    for (const l of leads) if (l.sessionKey) seen.set(l.sessionKey, (seen.get(l.sessionKey) ?? 0) + 1);
    if (nextSessionKey && !seen.has(nextSessionKey)) seen.set(nextSessionKey, 0);
    return [...seen.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [leads, nextSessionKey]);

  /** Session narrows first, so the stage counts on the tabs describe the same
   *  set of people the table is about to show. Counted here rather than taken
   *  from the server's, which cannot know about this filter. */
  const inSession = useMemo(
    () =>
      sessionFilter === 'All'
        ? leads
        : leads.filter((l) => (sessionFilter === 'none' ? !l.sessionKey : l.sessionKey === sessionFilter)),
    [leads, sessionFilter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of STAGES) c[s] = 0;
    for (const l of inSession) c[l.stage] = (c[l.stage] ?? 0) + 1;
    return c;
  }, [inSession]);

  const shown = stageFilter === 'All' ? inSession : inSession.filter((l) => l.stage === stageFilter);

  const shownSelected = shown.filter((l) => selected.has(l.id));
  const allShownSelected = shown.length > 0 && shownSelected.length === shown.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  /** Confirms by name, because the delete takes the workshop registration and
   *  the resume with it and there is no undo behind it. */
  const confirmDelete = (targets: Lead[]) => {
    if (!targets.length) return;
    const names = targets.slice(0, 12).map((l) => `  ${l.name}${l.email ? ` (${l.email})` : ''}`).join('\n');
    const more = targets.length > 12 ? `\n  …and ${targets.length - 12} more` : '';
    const ok = window.confirm(
      `Delete ${targets.length === 1 ? 'this person' : `these ${targets.length} people`} for good?\n\n` +
      `${names}${more}\n\n` +
      'This also removes their workshop registration and any resume on file. There is no undo.',
    );
    if (ok) remove.mutate(targets.map((l) => l.id));
  };

  const cell: React.CSSProperties = { padding: '11px 10px', verticalAlign: 'top' };
  const checkStyle: React.CSSProperties = { width: 15, height: 15, cursor: 'pointer', accentColor: C.blue };

  return (
    <div style={{
      height: '100vh', overflowY: 'auto', background: C.bg, color: C.ink,
      fontFamily: "'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif",
      padding: '24px clamp(14px, 3vw, 28px) 80px', boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Sales</h1>
          <a href="/admin/workshop" style={{ fontSize: 13, color: C.blue, fontWeight: 600 }}>
            Workshop prep
          </a>
          <span style={{ fontSize: 13, color: C.ink3 }}>
            {leads.length} on the board
            {data?.archivedCount ? ` · ${data.archivedCount} archived` : ''}
          </span>
        </div>

        {/* Stage filter. Counts are the pipeline, so the filter is also the
            summary and there is no separate stat row to keep in step. */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
          {(['All', ...STAGES] as const).map((s) => {
            const active = stageFilter === s;
            const n = s === 'All' ? inSession.length : (counts[s] ?? 0);
            return (
              <button
                key={s}
                onClick={() => setStageFilter(s as Stage | 'All')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '7px 13px', borderRadius: 999, cursor: 'pointer',
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  border: `1.5px solid ${active ? C.blue : C.line}`,
                  background: active ? C.blue : C.bg,
                  color: active ? '#fff' : C.ink2,
                }}
              >
                {s}
                <span style={{ opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <Search size={17} style={{ position: 'absolute', left: 12, top: 11, color: C.ink3 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email or company"
              style={{
                width: '100%', padding: '10px 12px 10px 36px', borderRadius: 9,
                border: `1.5px solid ${C.lineStrong}`, fontSize: 14, boxSizing: 'border-box',
              }}
            />
          </div>

          {/* One control rather than a second row of chips: which workshop is a
              question you ask occasionally, not one to keep on screen. */}
          <select
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${sessionFilter === 'All' ? C.line : C.blue}`,
              background: C.bg, color: sessionFilter === 'All' ? C.ink2 : C.blue,
            }}
          >
            <option value="All">Every session</option>
            {sessions.map(([key, n]) => (
              <option key={key} value={key}>
                {sessionLabel(key)}{key === nextSessionKey ? ' (next)' : ''} · {n}
              </option>
            ))}
            <option value="none">Never registered</option>
          </select>

          <button
            onClick={() => setShowArchived((v) => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 15px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              border: `1.5px solid ${showArchived ? C.blue : C.line}`,
              background: showArchived ? C.blue : C.bg, color: showArchived ? '#fff' : C.ink2,
            }}
          >
            <Archive size={15} />
            {showArchived ? 'Hiding nothing' : 'Show archived'}
          </button>
        </div>

        {isLoading ? (
          <p style={{ color: C.ink3, display: 'flex', gap: 9, alignItems: 'center' }}>
            <Loader2 size={16} className="animate-spin" /> Loading the board…
          </p>
        ) : !shown.length ? (
          <p style={{ color: C.ink3 }}>Nobody here yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: `2px solid ${C.line}`, color: C.ink3, fontSize: 12 }}>
                <th style={{ ...cell, width: 30, paddingRight: 0 }}>
                  <input
                    type="checkbox"
                    checked={allShownSelected}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (allShownSelected) shown.forEach((l) => next.delete(l.id));
                        else shown.forEach((l) => next.add(l.id));
                        return next;
                      })
                    }
                    title={allShownSelected ? 'Clear these' : 'Select everyone shown'}
                    style={checkStyle}
                  />
                </th>
                <th style={{ ...cell, width: '26%' }}>Who</th>
                <th style={{ ...cell }}>Progress</th>
                <th style={{ ...cell, width: 104 }}>Session</th>
                <th style={{ ...cell, width: 130 }}>Came from</th>
                <th style={{ ...cell, width: 90 }}>Resume</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => {
                const open = openId === l.id;
                const isSelected = selected.has(l.id);
                return (
                  <Fragment key={l.id}>
                    <tr
                      onClick={() => setOpenId(open ? null : l.id)}
                      style={{
                        borderBottom: `1px solid ${C.line}`, cursor: 'pointer',
                        background: isSelected ? '#EEF4FA' : open ? C.alt : undefined,
                        opacity: l.archived ? 0.55 : 1,
                      }}
                    >
                      <td style={{ ...cell, paddingRight: 0 }} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggle(l.id)} style={checkStyle} />
                      </td>

                      <td style={cell}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600 }}>
                          <ChevronDown
                            size={14}
                            style={{ color: C.ink3, transform: open ? 'none' : 'rotate(-90deg)', flex: '0 0 auto' }}
                          />
                          {l.name}
                          {/* The one stage no chip below can carry, because it is
                              a judgement rather than something that happened. */}
                          {l.stage === 'Dead' && (
                            <span style={{
                              fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                              background: '#F3F0EE', color: '#9A8F86',
                            }}>
                              Dead
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 3, paddingLeft: 21 }}>
                          {l.email || <span style={{ fontStyle: 'italic' }}>no email</span>}
                        </div>
                      </td>

                      {/* The facts, in funnel order. Filled means it happened,
                          which is the whole progress bar — and, read left to
                          right, it is also the stage.

                          "Group" is deliberately a different colour, because it
                          is a different kind of claim: they clicked through to
                          Skool, which is intent, not membership. Skool has no
                          API to confirm the join. Filling it green next to
                          "Paid" would quietly turn a maybe into a fact. */}
                      <td style={cell}>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          {([
                            ['Registered', l.registeredAt, false],
                            ['Group', l.skoolClickedAt, true],
                            ['Attended', l.attendedAt, false],
                            ['Report sent', l.reportSentAt, false],
                            ['Paid', l.paidAt, false],
                          ] as const).map(([label, at, soft]) => {
                            const on = soft ? '#2D5A6E' : '#1E7A56';
                            const hit = at
                              ? soft
                                ? `Clicked through to the group on ${new Date(at).toLocaleDateString()}. A click, not a confirmed join.`
                                : `${label}: ${new Date(at).toLocaleDateString()}`
                              : soft
                                ? 'Has not clicked through to the group'
                                : `Not ${label.toLowerCase()}`;
                            return (
                              <span
                                key={label}
                                title={hit}
                                style={{
                                  fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                                  background: at ? (soft ? 'transparent' : on) : C.alt,
                                  color: at ? (soft ? on : '#fff') : C.ink3,
                                  border: `1px solid ${at ? on : C.line}`,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* Which workshop, not when they signed up. The upcoming
                          one is called out because on a board where the stage
                          never expires, "is this person coming tonight" is the
                          question the Registered tab cannot answer on its own. */}
                      <td style={{ ...cell, fontSize: 12.5 }}>
                        {l.sessionKey ? (
                          <span
                            title={`Registered for the ${l.sessionKey} workshop`}
                            style={{
                              fontWeight: l.sessionKey === nextSessionKey ? 700 : 500,
                              color: l.sessionKey === nextSessionKey ? C.blue : C.ink2,
                            }}
                          >
                            {sessionLabel(l.sessionKey)}
                          </span>
                        ) : (
                          <span title="No workshop registration on file" style={{ color: C.ink3 }}>—</span>
                        )}
                      </td>

                      <td style={{ ...cell, fontSize: 12.5, color: C.ink2 }}>
                        {l.sourceAsset ? `/free/${l.sourceAsset}` : l.source}
                      </td>

                      <td style={cell}>
                        {l.hasResumeText ? (
                          <a
                            href={`/api/admin/sales/${l.id}/resume`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.blue, fontSize: 12.5, fontWeight: 600 }}
                          >
                            <FileText size={13} /> Open
                          </a>
                        ) : (
                          <span style={{ color: C.ink3, fontSize: 12.5 }}>none</span>
                        )}
                      </td>
                    </tr>

                    {open && (
                      <tr style={{ background: C.alt, borderBottom: `1px solid ${C.line}` }}>
                        <td colSpan={6} style={{ padding: '4px 14px 20px 51px' }}>
                          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>

                            {/* What they told us. The reason this board exists:
                                it is what gets read in the hour before a call. */}
                            <div style={{ flex: '1 1 380px', minWidth: 0 }}>
                              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.ink3, margin: '0 0 9px' }}>
                                What they told me
                              </p>
                              {l.answers && Object.keys(l.answers).length ? (
                                <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                                  {(l.questionSchema ?? []).map((q) => {
                                    const v = (l.answers as Record<string, unknown>)[q.id];
                                    if (v == null || String(v).trim() === '') return null;
                                    return (
                                      <div key={q.id}>
                                        <dt style={{ fontSize: 12, color: C.ink3 }}>{q.label}</dt>
                                        <dd style={{ margin: '2px 0 0', fontSize: 13.5, fontWeight: 500 }}>
                                          {Array.isArray(v) ? v.join(', ') : String(v)}
                                        </dd>
                                      </div>
                                    );
                                  })}
                                </dl>
                              ) : (
                                /* Two different silences, and telling them apart
                                   matters. One is a lead who never came through
                                   the funnel. The other is the funnel working as
                                   designed: the qualifying questions were taken
                                   off the signup form on purpose, and the
                                   question now gets posted in the Skool thread
                                   and pasted into /admin/workshop. */
                                <p style={{ fontSize: 13, color: C.ink3, margin: 0, lineHeight: 1.55 }}>
                                  {l.sessionKey
                                    ? 'The signup form no longer asks anything beyond name, email and resume. Their question lives in the Skool thread, so paste that thread into Workshop prep.'
                                    : 'Nothing on file. They came from the LinkedIn import, not the funnel.'}
                                </p>
                              )}
                            </div>

                            <div style={{ flex: '0 1 300px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                              {l.linkedinUrl && (
                                <a href={l.linkedinUrl} target="_blank" rel="noopener noreferrer"
                                   style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.blue, fontWeight: 600 }}>
                                  <ExternalLink size={13} /> LinkedIn profile
                                </a>
                              )}
                              {l.reportToken && (
                                <a href={`/report/${l.reportToken}`} target="_blank" rel="noopener noreferrer"
                                   style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.blue, fontWeight: 600 }}>
                                  <ExternalLink size={13} /> Their diagnostic
                                </a>
                              )}
                              {l.reportError && (
                                <p style={{ fontSize: 12.5, color: C.danger, margin: 0, lineHeight: 1.5 }}>
                                  Report failed: {l.reportError}
                                </p>
                              )}

                              <div>
                                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.ink3, margin: '0 0 6px' }}>
                                  Notes
                                </p>
                                <textarea
                                  defaultValue={l.notes ?? ''}
                                  onBlur={(e) => {
                                    if (e.target.value !== (l.notes ?? '')) {
                                      patch.mutate({ id: l.id, body: { notes: e.target.value } });
                                    }
                                  }}
                                  placeholder="Anything worth remembering before the next call"
                                  style={{
                                    width: '100%', boxSizing: 'border-box', minHeight: 70, resize: 'vertical',
                                    padding: '9px 11px', borderRadius: 8, border: `1.5px solid ${C.lineStrong}`,
                                    fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5,
                                  }}
                                />
                              </div>

                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {/* Dead is the only stage set by hand. Everything
                                    else follows the signals on its own. */}
                                <button
                                  onClick={() => patch.mutate({ id: l.id, body: { stage: l.stage === 'Dead' ? 'Lead' : 'Dead' } })}
                                  style={{
                                    padding: '7px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                                    border: `1.5px solid ${C.line}`, background: C.bg, color: C.ink2,
                                  }}
                                >
                                  {l.stage === 'Dead' ? 'Bring back' : 'Mark dead'}
                                </button>
                                <button
                                  onClick={() => patch.mutate({ id: l.id, body: { archived: !l.archived } })}
                                  style={{
                                    padding: '7px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                                    border: `1.5px solid ${C.line}`, background: C.bg, color: C.ink2,
                                  }}
                                >
                                  {l.archived ? 'Unarchive' : 'Archive'}
                                </button>
                                {/* Kept in the drawer rather than on the row, so
                                    the one destructive action costs a deliberate
                                    click to reach. The bulk bar is for clearing
                                    out test rows, which is the other real use. */}
                                <button
                                  onClick={() => confirmDelete([l])}
                                  disabled={remove.isPending}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    padding: '7px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                                    border: `1.5px solid ${C.line}`, background: C.bg, color: C.danger,
                                  }}
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Floats rather than sitting in the toolbar, so nothing on the page moves
          when a box is ticked and the board keeps its shape while you work down
          it. Absent entirely at zero selected: the minimal board was the point. */}
      {selected.size > 0 && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 22, transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 14, zIndex: 20,
          padding: '10px 12px 10px 18px', borderRadius: 12,
          background: C.ink, color: '#fff',
          boxShadow: '0 10px 30px rgba(15,30,43,.28)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {selected.size} selected
          </span>
          <button
            onClick={() => confirmDelete(leads.filter((l) => selected.has(l.id)))}
            disabled={remove.isPending}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '7px 13px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: remove.isPending ? 'wait' : 'pointer',
              border: 'none', background: C.danger, color: '#fff',
            }}
          >
            {remove.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
          <button
            onClick={() => setSelected(new Set())}
            title="Clear selection"
            style={{
              display: 'inline-flex', padding: 6, borderRadius: 8, cursor: 'pointer',
              border: 'none', background: 'transparent', color: '#A9BAC7',
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
