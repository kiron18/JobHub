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
   ──────────────────────────────────────────────────────────────────────────── */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, FileText, ExternalLink, Loader2, ChevronDown, Archive } from 'lucide-react';
import api from '../lib/api';

const STAGES = ['Lead', 'Registered', 'Attended', 'Pitched', 'Client', 'Dead'] as const;
type Stage = (typeof STAGES)[number];

/** Colour carries stage, so a row's position in the funnel reads without text. */
const STAGE_COLOR: Record<Stage, { bg: string; fg: string }> = {
  Lead: { bg: '#EEF1F4', fg: '#5A6874' },
  Registered: { bg: '#E7F0F8', fg: '#1A5C93' },
  Attended: { bg: '#E6F1EC', fg: '#1E7A56' },
  Pitched: { bg: '#FBF0DC', fg: '#8A6420' },
  Client: { bg: '#1E7A56', fg: '#FFFFFF' },
  Dead: { bg: '#F3F0EE', fg: '#9A8F86' },
};

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
  reportToken: string | null;
  reportError: string | null;
}

const C = {
  bg: '#FFFFFF', alt: '#F7FAFC', line: '#E3EAF0', lineStrong: '#CBD7E1',
  ink: '#0F1E2B', ink2: '#4A5A68', ink3: '#8496A4', blue: '#1857A0', danger: '#B4432F',
};

export default function AdminSales() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<Stage | 'All'>('All');
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-sales', search, showArchived],
    queryFn: () =>
      api.get('/admin/sales', { params: { search, archived: showArchived } }).then((r) => r.data),
  });

  const patch = useMutation({
    mutationFn: (v: { id: string; body: Partial<Lead> }) => api.patch(`/admin/sales/${v.id}`, v.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sales'] }),
  });

  const leads: Lead[] = data?.leads ?? [];
  const counts: Record<string, number> = data?.counts ?? {};
  const shown = stageFilter === 'All' ? leads : leads.filter((l) => l.stage === stageFilter);

  const cell: React.CSSProperties = { padding: '11px 10px', verticalAlign: 'top' };

  return (
    <div style={{
      height: '100vh', overflowY: 'auto', background: C.bg, color: C.ink,
      fontFamily: "'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif",
      padding: '24px clamp(14px, 3vw, 28px) 80px', boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Sales</h1>
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
            const n = s === 'All' ? leads.length : (counts[s] ?? 0);
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
                <th style={{ ...cell, width: '26%' }}>Who</th>
                <th style={{ ...cell, width: 108 }}>Stage</th>
                <th style={{ ...cell }}>Progress</th>
                <th style={{ ...cell, width: 130 }}>Came from</th>
                <th style={{ ...cell, width: 90 }}>Resume</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => {
                const open = openId === l.id;
                const sc = STAGE_COLOR[l.stage] ?? STAGE_COLOR.Lead;
                return (
                  <>
                    <tr
                      key={l.id}
                      onClick={() => setOpenId(open ? null : l.id)}
                      style={{
                        borderBottom: `1px solid ${C.line}`, cursor: 'pointer',
                        background: open ? C.alt : undefined,
                        opacity: l.archived ? 0.55 : 1,
                      }}
                    >
                      <td style={cell}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600 }}>
                          <ChevronDown
                            size={14}
                            style={{ color: C.ink3, transform: open ? 'none' : 'rotate(-90deg)', flex: '0 0 auto' }}
                          />
                          {l.name}
                        </div>
                        <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 3, paddingLeft: 21 }}>
                          {l.email || <span style={{ fontStyle: 'italic' }}>no email</span>}
                        </div>
                      </td>

                      <td style={cell}>
                        <span style={{
                          display: 'inline-block', padding: '4px 10px', borderRadius: 999,
                          fontSize: 11.5, fontWeight: 700, background: sc.bg, color: sc.fg,
                        }}>
                          {l.stage}
                        </span>
                      </td>

                      {/* The four facts, in funnel order. Filled means it happened,
                          which is the whole progress bar. */}
                      <td style={cell}>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          {([
                            ['Registered', l.registeredAt],
                            ['Attended', l.attendedAt],
                            ['Report sent', l.reportSentAt],
                            ['Paid', l.paidAt],
                          ] as const).map(([label, at]) => (
                            <span
                              key={label}
                              title={at ? `${label}: ${new Date(at).toLocaleDateString()}` : `Not ${label.toLowerCase()}`}
                              style={{
                                fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                                background: at ? '#1E7A56' : C.alt,
                                color: at ? '#fff' : C.ink3,
                                border: `1px solid ${at ? '#1E7A56' : C.line}`,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
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
                      <tr key={`${l.id}-open`} style={{ background: C.alt, borderBottom: `1px solid ${C.line}` }}>
                        <td colSpan={5} style={{ padding: '4px 14px 20px 31px' }}>
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
                                <p style={{ fontSize: 13, color: C.ink3, margin: 0 }}>
                                  Nothing on file. They came from the LinkedIn import, not the funnel.
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
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
