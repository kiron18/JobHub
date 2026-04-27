import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Send, FileText, Users, Trophy, Calendar } from 'lucide-react';
import api from '../lib/api';
import { useAppTheme } from '../contexts/ThemeContext';

interface JobApplication {
  id: string;
  title: string;
  company: string;
  status: 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'REJECTED' | 'OFFER';
  dateApplied: string | null;
  createdAt: string;
}

interface Document {
  id: string;
  type: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE';
  createdAt: string;
}

const STATUS_ORDER: Record<string, number> = {
  SAVED: 0, APPLIED: 1, INTERVIEW: 2, OFFER: 3, REJECTED: 1,
};

const STATUS_LABEL: Record<string, string> = {
  SAVED: 'Saved', APPLIED: 'Applied', INTERVIEW: 'Interviewing', OFFER: 'Offered', REJECTED: 'Rejected',
};

const STATUS_COLOUR: Record<string, { bg: string; text: string; dot: string }> = {
  SAVED:     { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', dot: '#64748b' },
  APPLIED:   { bg: 'rgba(59,130,246,0.10)',  text: '#60a5fa', dot: '#3b82f6' },
  INTERVIEW: { bg: 'rgba(45,212,191,0.10)',  text: '#2dd4bf', dot: '#0d9488' },
  OFFER:     { bg: 'rgba(34,197,94,0.10)',   text: '#4ade80', dot: '#16a34a' },
  REJECTED:  { bg: 'rgba(239,68,68,0.08)',   text: '#f87171', dot: '#ef4444' },
};

function isWithinDays(dateStr: string, days: number): boolean {
  return Date.now() - new Date(dateStr).getTime() < days * 86_400_000;
}

export function ActivityWidget() {
  const { isDark } = useAppTheme();

  const { data: jobs } = useQuery<JobApplication[]>({
    queryKey: ['jobs'],
    queryFn: async () => {
      const { data } = await api.get('/jobs');
      return data;
    },
    staleTime: 60_000,
  });

  const { data: documents } = useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data } = await api.get('/documents');
      return data;
    },
    staleTime: 60_000,
  });

  const metrics = useMemo(() => {
    const allJobs = jobs ?? [];
    const allDocs = documents ?? [];

    const appliedThisWeek = allJobs.filter(j => {
      const ref = j.dateApplied ?? j.createdAt;
      return isWithinDays(ref, 7) && j.status !== 'SAVED';
    });

    const docsThisWeek = allDocs.filter(d => isWithinDays(d.createdAt, 7));

    const pipeline = {
      APPLIED:   allJobs.filter(j => j.status === 'APPLIED').length,
      INTERVIEW: allJobs.filter(j => j.status === 'INTERVIEW').length,
      OFFER:     allJobs.filter(j => j.status === 'OFFER').length,
      REJECTED:  allJobs.filter(j => j.status === 'REJECTED').length,
    };

    const bestStatus = allJobs.reduce<string | null>((best, j) => {
      if (!best) return j.status;
      return (STATUS_ORDER[j.status] ?? 0) > (STATUS_ORDER[best] ?? 0) ? j.status : best;
    }, null);

    const responseRate = pipeline.APPLIED + pipeline.INTERVIEW + pipeline.OFFER + pipeline.REJECTED > 0
      ? Math.round(((pipeline.INTERVIEW + pipeline.OFFER) / (pipeline.APPLIED + pipeline.INTERVIEW + pipeline.OFFER + pipeline.REJECTED)) * 100)
      : null;

    return { appliedThisWeek, docsThisWeek, pipeline, bestStatus, responseRate };
  }, [jobs, documents]);

  const cardBg   = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
  const border   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const subText  = isDark ? '#64748b' : '#94a3b8';
  const mainText = isDark ? '#f1f5f9' : '#111827';
  const dimText  = isDark ? '#94a3b8' : '#6b7280';

  const noActivity = metrics.appliedThisWeek.length === 0 && metrics.docsThisWeek.length === 0;

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Section label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <TrendingUp size={13} style={{ color: '#2dd4bf' }} />
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: subText }}>
          Activity
        </span>
      </div>

      {/* Top stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
        {/* Apps this week */}
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Send size={12} style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: subText }}>
              Sent this week
            </span>
          </div>
          <p style={{ fontSize: 28, fontWeight: 900, color: mainText, lineHeight: 1, margin: 0 }}>
            {metrics.appliedThisWeek.length}
          </p>
          <p style={{ fontSize: 11, color: subText, marginTop: 4 }}>applications</p>
        </div>

        {/* Docs this week */}
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <FileText size={12} style={{ color: '#8b5cf6' }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: subText }}>
              Docs generated
            </span>
          </div>
          <p style={{ fontSize: 28, fontWeight: 900, color: mainText, lineHeight: 1, margin: 0 }}>
            {metrics.docsThisWeek.length}
          </p>
          <p style={{ fontSize: 11, color: subText, marginTop: 4 }}>this week</p>
        </div>

        {/* Active interviews */}
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Users size={12} style={{ color: '#2dd4bf' }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: subText }}>
              Interviewing
            </span>
          </div>
          <p style={{ fontSize: 28, fontWeight: 900, color: mainText, lineHeight: 1, margin: 0 }}>
            {metrics.pipeline.INTERVIEW}
          </p>
          <p style={{ fontSize: 11, color: subText, marginTop: 4 }}>active</p>
        </div>

        {/* Best stage / response rate */}
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Trophy size={12} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: subText }}>
              Response rate
            </span>
          </div>
          <p style={{ fontSize: 28, fontWeight: 900, color: mainText, lineHeight: 1, margin: 0 }}>
            {metrics.responseRate !== null ? `${metrics.responseRate}%` : '—'}
          </p>
          <p style={{ fontSize: 11, color: subText, marginTop: 4 }}>
            {metrics.bestStatus ? `Best: ${STATUS_LABEL[metrics.bestStatus]}` : 'no data yet'}
          </p>
        </div>
      </div>

      {/* Pipeline strip */}
      <div style={{
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap',
        marginBottom: metrics.appliedThisWeek.length > 0 ? 10 : 0,
      }}>
        <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: subText, flexShrink: 0 }}>
          Pipeline
        </span>
        {(['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'] as const).map(s => {
          const count = metrics.pipeline[s];
          const colours = STATUS_COLOUR[s];
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: colours.dot, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: count > 0 ? colours.text : subText }}>
                {count}
              </span>
              <span style={{ fontSize: 11, color: subText }}>{STATUS_LABEL[s]}</span>
            </div>
          );
        })}
      </div>

      {/* Roles applied this week */}
      {metrics.appliedThisWeek.length > 0 && (
        <div style={{
          background: cardBg,
          border: `1px solid ${border}`,
          borderRadius: 12,
          padding: '12px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Calendar size={11} style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: subText }}>
              Roles this week
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {metrics.appliedThisWeek.map(j => {
              const colours = STATUS_COLOUR[j.status] ?? STATUS_COLOUR.APPLIED;
              return (
                <span
                  key={j.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    fontWeight: 700,
                    color: colours.text,
                    background: colours.bg,
                    borderRadius: 8,
                    padding: '4px 10px',
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: colours.dot, flexShrink: 0 }} />
                  {j.title}
                  {j.company && <span style={{ fontWeight: 500, color: dimText }}>· {j.company}</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {noActivity && (
        <p style={{ fontSize: 12, color: subText, textAlign: 'center', padding: '8px 0' }}>
          No applications sent this week yet. Start applying to see your activity here.
        </p>
      )}
    </div>
  );
}
