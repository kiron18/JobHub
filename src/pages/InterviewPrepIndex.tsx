import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';
import { rise, stagger, EASE, DUR, t } from '../lib/theme/motion';
import { Button } from '../components/shared/Button';
import { Badge } from '../components/shared/Badge';
import { EmptyState } from '../components/shared/EmptyState';
import { SkeletonRow } from '../components/shared/Skeleton';

/* ── Interview prep ────────────────────────────────────────────────────
   The way in to the per-job prep at /interview/:jobId, which had no
   index: you could only reach it from a tracker row, so unless you went
   looking you did not know it existed.

   The list is the jobs you have actually sent. A job you saved and never
   applied to cannot produce an interview, and showing it here would
   invite the click that says otherwise.

   Claiming an interview asks for the date rather than yes or no. That is
   the gate. A real interviewee answers it without thinking and somebody
   inventing one has to make something up, which is a materially higher
   bar than a warning nobody reads. It also earns its keep twice over:
   the prep knows whether it is writing for tomorrow or for a fortnight,
   and the date is worth reminding you about.

   It says plainly that confirming moves your tracker and your leaderboard
   position, and it is reversible, because a gate with no way back just
   means people avoid the button.
*/

interface Job {
  id: string;
  title: string;
  company: string | null;
  agency: string | null;
  status: 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'REJECTED' | 'OFFER';
  dateApplied: string | null;
  interviewAt: string | null;
}

const SENT = new Set(['APPLIED', 'INTERVIEW', 'OFFER']);

export default function InterviewPrepIndex() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [claiming, setClaiming] = useState<string | null>(null);
  const [date, setDate] = useState('');

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => (await api.get('/jobs')).data as Job[],
  });

  const setInterview = useMutation({
    mutationFn: async ({ id, when }: { id: string; when: string }) =>
      (await api.patch(`/jobs/${id}`, { status: 'INTERVIEW', interviewAt: when })).data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      setClaiming(null);
      setDate('');
      navigate(`/interview/${vars.id}`);
    },
    onError: () => toast.error('Could not save that. Try again.'),
  });

  const undoInterview = useMutation({
    mutationFn: async (id: string) =>
      (await api.patch(`/jobs/${id}`, { status: 'APPLIED' })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Put back to applied. The interview no longer counts.');
    },
    onError: () => toast.error('Could not undo that. Try again.'),
  });

  const sent = (jobs ?? []).filter(j => SENT.has(j.status));
  const interviewing = sent.filter(j => j.status === 'INTERVIEW' || j.status === 'OFFER');
  const applied = sent.filter(j => j.status === 'APPLIED');

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 6px', fontFamily: warm.type.fontBody, ...warm.text.h1, color: warm.colors.textPrimary }}>
          Interview prep
        </h1>
        <p style={{ margin: 0, fontFamily: warm.type.fontBody, ...warm.text.body, color: warm.colors.textSecondary }}>
          Pick the job you are interviewing for. We write the prep against that exact ad.
        </p>
      </header>

      {isLoading && (
        <div style={{ background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: warm.radius.card }}>
          <SkeletonRow /><SkeletonRow /><SkeletonRow />
        </div>
      )}

      {!isLoading && sent.length === 0 && (
        <EmptyState
          title="Nothing sent yet"
          body="Prep is written against a specific job ad, so this fills up as you apply. Send your first application and it will be here."
          actionLabel="Start an application"
          onAction={() => navigate('/')}
        />
      )}

      {!isLoading && interviewing.length > 0 && (
        <Group title="You are interviewing">
          {interviewing.map(j => (
            <Row
              key={j.id}
              job={j}
              onOpen={() => navigate(`/interview/${j.id}`)}
              onUndo={() => undoInterview.mutate(j.id)}
            />
          ))}
        </Group>
      )}

      {!isLoading && applied.length > 0 && (
        <Group title={interviewing.length > 0 ? 'Everything else you have sent' : 'What you have sent'}>
          {applied.map(j => (
            <Row
              key={j.id}
              job={j}
              claiming={claiming === j.id}
              date={date}
              onDate={setDate}
              onClaim={() => { setClaiming(j.id); setDate(''); }}
              onCancel={() => { setClaiming(null); setDate(''); }}
              onConfirm={() => setInterview.mutate({ id: j.id, when: date })}
              saving={setInterview.isPending}
            />
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{
        margin: '0 0 10px', fontFamily: warm.type.fontBody,
        ...warm.text.micro, color: warm.colors.textMuted,
      }}>
        {title}
      </h2>
      <motion.div variants={stagger(0.04)} initial="hidden" animate="show" style={{ display: 'grid', gap: 10 }}>
        {children}
      </motion.div>
    </section>
  );
}

function Row({
  job, claiming, date, onDate, onClaim, onCancel, onConfirm, onOpen, onUndo, saving,
}: {
  job: Job;
  claiming?: boolean;
  date?: string;
  onDate?: (v: string) => void;
  onClaim?: () => void;
  onCancel?: () => void;
  onConfirm?: () => void;
  onOpen?: () => void;
  onUndo?: () => void;
  saving?: boolean;
}) {
  const where = job.company ?? job.agency ?? 'Company not named';
  const ready = job.status === 'INTERVIEW' || job.status === 'OFFER';

  return (
    <motion.div
      variants={rise}
      style={{
        background: warm.colors.bgSurface,
        border: `1px solid ${claiming ? warm.colors.borderDefined : warm.colors.borderWhisper}`,
        borderRadius: warm.radius.card,
        boxShadow: warm.shadow.soft,
        overflow: 'hidden',
        transition: t(['border-color'], DUR.fast),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontFamily: warm.type.fontBody, ...warm.text.h3,
            color: warm.colors.textPrimary,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {job.title}
          </p>
          <p style={{
            margin: '2px 0 0', fontFamily: warm.type.fontBody, ...warm.text.small,
            color: warm.colors.textMuted,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {where}
            {job.interviewAt && ` · interview ${new Date(job.interviewAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}
          </p>
        </div>

        {ready ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Badge tone="success">Interviewing</Badge>
            <Button size="sm" label="Open prep" onClick={onOpen} iconAfter={<ArrowRight size={14} />} />
          </div>
        ) : (
          !claiming && (
            <Button size="sm" variant="secondary" label="I have an interview" onClick={onClaim} />
          )
        )}
      </div>

      {/* The gate. A date, and a plain sentence about what saying yes does. */}
      <AnimatePresence initial={false}>
        {claiming && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: DUR.base, ease: EASE.out }, opacity: { duration: DUR.fast } }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '14px 16px',
              borderTop: `1px solid ${warm.colors.borderWhisper}`,
              background: warm.colors.bgAlt,
            }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                fontFamily: warm.type.fontBody, fontSize: 13,
                fontWeight: warm.weight.semibold, color: warm.colors.textPrimary,
              }}>
                <CalendarDays size={15} style={{ color: warm.colors.textMuted }} />
                When is it?
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input
                  type="date"
                  value={date ?? ''}
                  onChange={e => onDate?.(e.target.value)}
                  style={{
                    height: 40, padding: '0 12px',
                    fontFamily: warm.type.fontBody, fontSize: warm.text.body.fontSize,
                    color: warm.colors.textPrimary, background: warm.colors.bgSurface,
                    border: `1px solid ${warm.colors.borderDefined}`,
                    borderRadius: warm.radius.input, outline: 'none',
                  }}
                />
                <Button
                  size="md"
                  label="Confirm and write my prep"
                  disabled={!date}
                  loading={saving}
                  onClick={onConfirm}
                />
                <Button size="md" variant="ghost" label="Cancel" onClick={onCancel} />
              </div>
              <p style={{
                margin: '10px 0 0', fontFamily: warm.type.fontBody,
                ...warm.text.small, color: warm.colors.textMuted, maxWidth: 460,
              }}>
                This moves the job to Interviewing in your tracker and counts on the leaderboard.
                Only confirm if it is real. You can undo it.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {ready && onUndo && (
        <div style={{ padding: '0 16px 12px' }}>
          <button
            onClick={onUndo}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontFamily: warm.type.fontBody, fontSize: 12, color: warm.colors.textMuted,
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}
          >
            Not actually interviewing
          </button>
        </div>
      )}
    </motion.div>
  );
}
