import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Moon, Flame, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { Modal } from '../shared/Modal';
import { warm } from '../../lib/theme/warmTokens';

/* ── EveningCheckout ───────────────────────────────────────────────────
   "End my day": the close of a session (Kiron, 2026-09-29). Always one tap
   away in the sidebar, not only after the number is done, because the days
   people most need to close properly are the ones that went badly.

   Two groups of checkboxes and nothing to type:
     - how today went: the most likely outcomes, so ticking is faster than
       thinking, and "I ran out of good roles" or "life got in the way" are
       ordinary answers rather than confessions;
     - tomorrow: small, concrete plans. Ticking one is a promise made the
       night before, which is what brings people back in the morning.

   The ids are the server's (server/src/services/tracker/sessionLog.ts); the
   wording lives here. Never rename an id that has been saved.
*/

const OUTCOMES: Array<[string, string]> = [
  ['hit_number', 'I hit my number'],
  ['followed_up', 'I followed up on older applications'],
  ['reached_out', 'I messaged someone at a company I like'],
  ['heard_back', 'I heard back from an employer'],
  ['ran_out_of_roles', 'I ran out of good roles to apply for'],
  ['tailoring_slow', 'Tailoring took longer than I expected'],
  ['life_got_in_way', 'Life got in the way today'],
];

const TOMORROW: Array<[string, string]> = [
  ['same_time', 'Start at the same time'],
  ['follow_up_last_week', "Follow up on last week's applications"],
  ['new_source', 'Try a new job board or a careers page'],
  ['message_two', "Message 2 people at companies I've applied to"],
  ['beat_today', "Beat today's number"],
];

interface Entry { outcomes: string[]; tomorrow: string[]; savedAt: string | null }
interface Target { filedToday: number; target: number; done?: boolean }

function Box({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
        border: `1.5px solid ${checked ? warm.colors.accentPetrol : warm.colors.borderWhisper}`,
        background: checked ? warm.colors.accentPetrolSoft : '#fff',
        fontFamily: warm.type.fontBody, fontSize: 16, lineHeight: 1.4, color: warm.colors.textPrimary,
      }}
    >
      <span style={{
        width: 22, height: 22, flexShrink: 0, borderRadius: 6,
        border: `2px solid ${checked ? warm.colors.accentPetrol : warm.colors.borderDefined}`,
        background: checked ? warm.colors.accentPetrol : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <Check size={14} color="#fff" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

export function EveningCheckout({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [tomorrow, setTomorrow] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const { data: entry } = useQuery({
    queryKey: ['session-log'],
    queryFn: async () => (await api.get('/tracker/session-log')).data as Entry,
    enabled: open,
    staleTime: 0,
  });
  const { data: target } = useQuery({
    queryKey: ['tracker-daily-target'],
    queryFn: async () => (await api.get('/tracker/daily-target')).data as Target,
    enabled: open,
    retry: false,
  });
  const { data: engagement } = useQuery({
    queryKey: ['tracker-engagement'],
    queryFn: async () => (await api.get('/tracker/engagement')).data as { streak: number },
    enabled: open,
    retry: false,
  });

  /* Each opening starts from what was saved today, or, the first time, with
     "I hit my number" already ticked if they did. */
  useEffect(() => {
    if (!open) { setSaved(false); return; }
    if (entry?.savedAt) {
      setOutcomes(entry.outcomes);
      setTomorrow(entry.tomorrow);
    } else if (target) {
      setOutcomes(target.done || target.filedToday >= target.target ? ['hit_number'] : []);
      setTomorrow([]);
    }
  }, [open, entry, target]);

  const save = useMutation({
    mutationFn: async () => (await api.post('/tracker/session-log', { outcomes, tomorrow })).data as Entry,
    onSuccess: data => { qc.setQueryData(['session-log'], data); setSaved(true); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Could not save. Try again.'),
  });

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  const streak = engagement?.streak ?? 0;
  const firstPlan = TOMORROW.find(([id]) => tomorrow.includes(id))?.[1];

  return (
    <Modal open={open} onClose={onClose} maxWidth={520} title={saved ? undefined : 'End my day'}>
      {saved ? (
        <div style={{ textAlign: 'center', padding: '12px 4px 4px', fontFamily: warm.type.fontBody }}>
          <span style={{
            width: 56, height: 56, borderRadius: 99, background: warm.colors.accentPetrolSoft, color: warm.colors.accentPetrol,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Moon size={26} />
          </span>
          <h2 style={{ margin: '14px 0 8px', fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 30, color: warm.colors.textPrimary }}>
            See you tomorrow
          </h2>
          {streak > 0 && (
            <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#C4713A', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
              <Flame size={17} /> {streak}-day streak. One more day keeps it alive.
            </p>
          )}
          <p style={{ margin: '0 0 20px', fontSize: 16, lineHeight: 1.6, color: warm.colors.textSecondary }}>
            {firstPlan
              ? <>First thing tomorrow: <strong style={{ color: warm.colors.textPrimary }}>{firstPlan.toLowerCase()}</strong>. It's written down now, so it's already half done.</>
              : 'Rest properly tonight. Tomorrow starts with a number.'}
          </p>
          <button
            onClick={onClose}
            style={{ width: '100%', padding: '14px 18px', borderRadius: 12, border: 'none', background: warm.colors.accentPetrol, color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer' }}
          >
            Done
          </button>
        </div>
      ) : (
        <div style={{ fontFamily: warm.type.fontBody }}>
          <p style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700, color: warm.colors.textPrimary }}>How did today go?</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {OUTCOMES.map(([id, label]) => (
              <Box key={id} label={label} checked={outcomes.includes(id)} onToggle={() => toggle(outcomes, setOutcomes, id)} />
            ))}
          </div>

          <p style={{ margin: '22px 0 10px', fontSize: 17, fontWeight: 700, color: warm.colors.textPrimary }}>Tomorrow, I'll…</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {TOMORROW.map(([id, label]) => (
              <Box key={id} label={label} checked={tomorrow.includes(id)} onToggle={() => toggle(tomorrow, setTomorrow, id)} />
            ))}
          </div>

          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || (outcomes.length === 0 && tomorrow.length === 0)}
            style={{
              marginTop: 22, width: '100%', padding: '14px 18px', borderRadius: 12, border: 'none',
              background: warm.colors.accentPetrol, color: '#fff', fontSize: 17, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: outcomes.length === 0 && tomorrow.length === 0 ? 0.5 : 1,
            }}
          >
            {save.isPending && <Loader2 size={17} className="animate-spin" />}
            Close out today
          </button>
        </div>
      )}
    </Modal>
  );
}
