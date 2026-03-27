import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Save, Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';

interface Achievement {
  id: string;
  title: string;
  description: string;
  metric?: string | null;
  metricType?: string | null;
  coachingTips?: string | null;
}

// Derives a micro coaching hint from achievement data alone (no extra API call needed)
function getMicroHint(a: Achievement): string | null {
  if (a.coachingTips) return a.coachingTips;
  if (!a.metric) return 'Add a specific number, %, or $ to show the scale of impact.';
  if (a.description && a.description.length < 60) return 'Expand the context: what was at stake, what you specifically did, and what changed as a result?';
  return null;
}

export const AchievementBank: React.FC = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Achievement>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [expandedHints, setExpandedHints] = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState(false);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {achievements?.length ?? 0} achievement{achievements?.length !== 1 ? 's' : ''}
        </p>
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
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingId(null)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'transparent', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    <button
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      <Save size={12} /> Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          {hasMetric
                            ? <CheckCircle size={12} color="#10b981" style={{ flexShrink: 0 }} />
                            : <AlertCircle size={12} color="#f59e0b" style={{ flexShrink: 0 }} />
                          }
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#f3f4f6', margin: 0, lineHeight: 1.4 }}>{achievement.title}</p>
                        </div>
                        <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 0 20px', lineHeight: 1.55 }}>{achievement.description}</p>
                        {achievement.metric && (
                          <span style={{ display: 'inline-block', marginTop: 8, marginLeft: 20, fontSize: 11, fontWeight: 700, color: '#34d399', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(16,185,129,0.2)' }}>
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

                  {/* Micro coaching hint */}
                  {hint && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: hasMetric ? 'transparent' : 'rgba(245,158,11,0.04)' }}>
                      <button
                        onClick={() => toggleHint(achievement.id)}
                        style={{ width: '100%', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color: hasMetric ? '#6b7280' : '#d97706', letterSpacing: '0.05em' }}>
                          {hasMetric ? 'Coaching tip' : 'Needs attention'}
                        </span>
                        <span style={{ fontSize: 10, color: '#6b7280' }}>{hintOpen ? '▲' : '▼'}</span>
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
                            <p style={{ fontSize: 12, color: hasMetric ? '#9ca3af' : '#fcd34d', padding: '0 16px 12px', lineHeight: 1.6, margin: 0 }}>
                              {hint}
                            </p>
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
