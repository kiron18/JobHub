import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Save, Loader2, AlertCircle, CheckCircle, RefreshCw, TrendingUp, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';

interface Achievement {
  id: string;
  title: string;
  description: string;
  metric?: string | null;
  metricType?: string | null;
  skills?: string | null;
  coachingTips?: string | null;
}

// Client-side quality scoring — no extra API calls
// Max 5 points: metric(2) + long description(1) + skills(1) + substantive title(1)
function getQualityScore(a: Achievement): {
  score: number;
  label: 'STRONG' | 'GOOD' | 'WEAK';
  missing: string[];
} {
  let score = 0;
  const missing: string[] = [];

  if (a.metric) {
    score += 2;
  } else {
    missing.push('Add a metric (%, $, number)');
  }

  if (a.description && a.description.length > 100) {
    score += 1;
  } else {
    missing.push('Expand the description (situation → action → outcome)');
  }

  if (a.skills && a.skills.trim().length > 0) {
    score += 1;
  } else {
    missing.push('Tag relevant skills');
  }

  if (a.title && a.title.length > 20) {
    score += 1;
  } else {
    missing.push('Make the title more specific');
  }

  const label = score >= 4 ? 'STRONG' : score >= 2 ? 'GOOD' : 'WEAK';
  return { score, label, missing };
}

// Derives a coaching hint from achievement data — quality score takes priority
function getMicroHint(a: Achievement): string | null {
  if (a.coachingTips) return a.coachingTips;
  const { missing } = getQualityScore(a);
  return missing.length > 0 ? missing[0] : null;
}

export const AchievementBank: React.FC = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Achievement>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [expandedHints, setExpandedHints] = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [polishingId, setPolishingId] = useState<string | null>(null);
  const [polishReasoning, setPolishReasoning] = useState<string | null>(null);

  const { data: achievements, isLoading, error } = useQuery<Achievement[]>({
    queryKey: ['achievements'],
    queryFn: async () => {
      const { data } = await api.get('/achievements');
      return data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const updateMutation = useMutation({
    mutationFn: async (achievement: Achievement) => {
      await api.patch(`/achievements/${achievement.id}`, achievement);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      queryClient.invalidateQueries({ queryKey: ['achievements', 'count'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/achievements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      queryClient.invalidateQueries({ queryKey: ['achievements', 'count'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (achievement: Partial<Achievement>) => {
      await api.post('/achievements', achievement);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      queryClient.invalidateQueries({ queryKey: ['achievements', 'count'] });
      setIsCreating(false);
      setEditForm({});
    },
  });

  const handleSave = () => {
    if (editingId && editingId !== 'new') {
      updateMutation.mutate(editForm as Achievement);
    } else {
      createMutation.mutate(editForm);
    }
  };

  const handlePolish = async (id: string) => {
    setPolishingId(id);
    setPolishReasoning(null);
    try {
      const { data } = await api.post('/analyze/polish-achievement', {
        title: editForm.title,
        description: editForm.description,
        metric: editForm.metric,
        skills: editForm.skills,
      });
      setEditForm(f => ({
        ...f,
        title: data.polishedTitle || f.title,
        description: data.polishedDescription || f.description,
        metric: data.suggestedMetric || f.metric,
      }));
      setPolishReasoning(data.reasoning || null);
    } catch {
      // silently fail — user still has the original
    } finally {
      setPolishingId(null);
    }
  };

  const toggleHint = (id: string) => {
    setExpandedHints(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '32px 0', color: '#6b7280' }}>
        <Loader2 size={16} className="animate-spin" />
        <span style={{ fontSize: 13 }}>Loading achievements...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13 }}>
        Could not load achievements. Check your connection.
      </div>
    );
  }

  // Completeness metrics
  const total = achievements?.length ?? 0;
  const strongCount = achievements?.filter(a => getQualityScore(a).label === 'STRONG').length ?? 0;
  const weakCount = achievements?.filter(a => getQualityScore(a).label === 'WEAK').length ?? 0;
  const strongPct = total > 0 ? Math.round((strongCount / total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
              {total} achievement{total !== 1 ? 's' : ''}
            </p>
            {total > 0 && (
              <>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981' }}>
                  {strongCount} strong
                </span>
                {weakCount > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>
                    {weakCount} need work
                  </span>
                )}
              </>
            )}
          </div>
          {total > 0 && (
            <div style={{ width: 160, height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${strongPct}%` }}
                transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
                style={{ height: '100%', borderRadius: 99, background: strongPct >= 60 ? '#10b981' : strongPct >= 30 ? '#f59e0b' : '#ef4444' }}
              />
            </div>
          )}
        </div>
        <button
          onClick={() => { setIsCreating(true); setEditForm({}); }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#818cf8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{ borderRadius: 14, padding: 16, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <input
              autoFocus
              placeholder="Title — e.g. Reduced costs by 22% through supplier renegotiation"
              value={editForm.title ?? ''}
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#f3f4f6', fontSize: 13, fontWeight: 600, boxSizing: 'border-box' }}
            />
            <textarea
              placeholder="Describe the situation, your action, and the outcome..."
              rows={3}
              value={editForm.description ?? ''}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#d1d5db', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
            />
            <input
              placeholder="Metric — e.g. 22%, $1.2M, 40 people"
              value={editForm.metric ?? ''}
              onChange={e => setEditForm(f => ({ ...f, metric: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#f3f4f6', fontSize: 12, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setIsCreating(false)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'transparent', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={handleSave}
                disabled={createMutation.isPending}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                <Save size={12} /> Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Achievement list */}
      <AnimatePresence mode="popLayout">
        {achievements?.map(achievement => {
          const hint = getMicroHint(achievement);
          const hintOpen = expandedHints.has(achievement.id);
          const isEditing = editingId === achievement.id;
          const hasMetric = !!achievement.metric;
          const quality = getQualityScore(achievement);

          return (
            <motion.div
              key={achievement.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              style={{
                borderRadius: 14,
                border: `1px solid ${isEditing ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)'}`,
                background: isEditing ? 'rgba(99,102,241,0.05)' : 'rgba(255,255,255,0.02)',
                overflow: 'hidden',
              }}
            >
              {isEditing ? (
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    autoFocus
                    value={editForm.title ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#f3f4f6', fontSize: 13, fontWeight: 600, boxSizing: 'border-box' }}
                  />
                  <textarea
                    rows={3}
                    value={editForm.description ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#d1d5db', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <input
                    placeholder="Metric (e.g. 22%, $1.2M)"
                    value={editForm.metric ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, metric: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#f3f4f6', fontSize: 12, boxSizing: 'border-box' }}
                  />
                  {polishingId === achievement.id && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#818cf8' }}>
                      <Loader2 size={11} className="animate-spin" /> Polishing with AI...
                    </div>
                  )}
                  {polishReasoning && editingId === achievement.id && (
                    <div style={{ fontSize: 11, color: '#6ee7b7', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 8, padding: '6px 10px', lineHeight: 1.5 }}>
                      {polishReasoning}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      onClick={() => handlePolish(achievement.id)}
                      disabled={polishingId === achievement.id}
                      title="Rewrite as a polished STAR bullet with metrics"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.07)', color: '#818cf8', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: polishingId === achievement.id ? 0.5 : 1 }}
                    >
                      <Sparkles size={11} /> Polish with AI
                    </button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setEditingId(null); setPolishReasoning(null); }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'transparent', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                      <button
                        onClick={handleSave}
                        disabled={updateMutation.isPending}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        <Save size={12} /> Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Quality badge + title row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                            padding: '2px 7px', borderRadius: 99, flexShrink: 0,
                            background: quality.label === 'STRONG' ? 'rgba(16,185,129,0.12)' : quality.label === 'GOOD' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.10)',
                            color: quality.label === 'STRONG' ? '#34d399' : quality.label === 'GOOD' ? '#fbbf24' : '#f87171',
                            border: `1px solid ${quality.label === 'STRONG' ? 'rgba(16,185,129,0.25)' : quality.label === 'GOOD' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.2)'}`,
                          }}>
                            {[1,2,3,4,5].map(n => (
                              <span key={n} style={{
                                width: 4, height: 4, borderRadius: '50%', display: 'inline-block',
                                background: n <= quality.score
                                  ? (quality.label === 'STRONG' ? '#34d399' : quality.label === 'GOOD' ? '#fbbf24' : '#f87171')
                                  : 'rgba(255,255,255,0.12)',
                              }} />
                            ))}
                            <span style={{ marginLeft: 2 }}>{quality.label}</span>
                          </span>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#f3f4f6', margin: 0, lineHeight: 1.4 }}>{achievement.title}</p>
                        </div>
                        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, lineHeight: 1.55 }}>{achievement.description}</p>
                        {achievement.metric && (
                          <span style={{ display: 'inline-block', marginTop: 8, fontSize: 11, fontWeight: 700, color: '#34d399', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(16,185,129,0.2)' }}>
                            {achievement.metric}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => { setEditingId(achievement.id); setEditForm(achievement); }}
                          style={{ padding: 6, borderRadius: 7, border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(achievement.id)}
                          style={{ padding: 6, borderRadius: 7, border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Coaching section — shown when not STRONG */}
                  {quality.label !== 'STRONG' && quality.missing.length > 0 && (
                    <div style={{
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                      background: quality.label === 'WEAK' ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.03)',
                    }}>
                      <button
                        onClick={() => toggleHint(achievement.id)}
                        style={{ width: '100%', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}
                      >
                        <TrendingUp size={10} color={quality.label === 'WEAK' ? '#f87171' : '#fbbf24'} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: quality.label === 'WEAK' ? '#f87171' : '#d97706', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          {quality.missing.length} improvement{quality.missing.length !== 1 ? 's' : ''} to reach Strong
                        </span>
                        <span style={{ fontSize: 10, color: '#4b5563', marginLeft: 'auto' }}>{hintOpen ? '▲' : '▼'}</span>
                      </button>
                      <AnimatePresence>
                        {hintOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <ul style={{ margin: 0, padding: '0 16px 12px 16px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {quality.missing.map((tip, i) => (
                                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                  <span style={{ color: quality.label === 'WEAK' ? '#f87171' : '#fbbf24', fontSize: 10, marginTop: 2, flexShrink: 0 }}>→</span>
                                  <span style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {(!achievements || achievements.length === 0) && !isCreating && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#4b5563' }}>
          <p style={{ fontSize: 13, marginBottom: 16 }}>No achievements found. Click below to extract them from your resume.</p>
          <button
            disabled={extracting}
            onClick={async () => {
              setExtracting(true);
              try {
                const { data } = await api.post('/onboarding/backfill-achievements');
                if (data.status === 'started') {
                  // Poll until achievements appear
                  let attempts = 0;
                  const poll = setInterval(async () => {
                    attempts++;
                    await queryClient.invalidateQueries({ queryKey: ['achievements'] });
                    await queryClient.invalidateQueries({ queryKey: ['achievements', 'count'] });
                    const res = await api.get('/achievements');
                    if (res.data.length > 0 || attempts >= 20) {
                      clearInterval(poll);
                      setExtracting(false);
                    }
                  }, 5000);
                } else {
                  setExtracting(false);
                }
              } catch {
                setExtracting(false);
              }
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 10,
              border: '1px solid rgba(99,102,241,0.3)',
              background: 'rgba(99,102,241,0.08)',
              color: extracting ? '#6b7280' : '#818cf8',
              fontSize: 13, fontWeight: 700, cursor: extracting ? 'default' : 'pointer',
            }}
          >
            {extracting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {extracting ? 'Extracting… this takes ~60 seconds' : 'Extract from resume'}
          </button>
        </div>
      )}
    </div>
  );
};
