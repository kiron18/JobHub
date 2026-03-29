import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Copy, CheckCircle, Loader2, MessageSquare } from 'lucide-react';
import api from '../lib/api';

interface InterviewQuestion {
  question: string;
  type: 'behavioral' | 'situational' | 'role-specific' | 'motivation';
  talkingPoints: string[];
  why: string;
}

interface InterviewQuestionsPanelProps {
  jobDescription: string;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  behavioral:     { label: 'Behavioural', color: '#818cf8', bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.25)' },
  situational:    { label: 'Situational',  color: '#fbbf24', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
  'role-specific':{ label: 'Role-Specific',color: '#34d399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
  motivation:     { label: 'Motivation',   color: '#f9a8d4', bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.25)' },
};

export function InterviewQuestionsPanel({ jobDescription }: InterviewQuestionsPanelProps) {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const load = async () => {
    if (loading || !jobDescription) return;
    setLoading(true);
    try {
      const { data } = await api.post('/analyze/interview-questions', { jobDescription });
      setQuestions(data.questions || []);
      setLoaded(true);
      setExpandedIdx(0);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const copyQuestion = async (idx: number) => {
    const q = questions[idx];
    const text = `${q.question}\n\nTalking points:\n${q.talkingPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <MessageSquare size={12} color="#818cf8" />
          <span style={{ fontSize: 10, fontWeight: 800, color: '#818cf8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Likely Questions
          </span>
        </div>
        {!loaded && (
          <button
            onClick={load}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 6,
              border: '1px solid rgba(99,102,241,0.3)',
              background: 'rgba(99,102,241,0.08)',
              color: loading ? '#6b7280' : '#818cf8',
              fontSize: 10, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
            }}
          >
            {loading ? <Loader2 size={10} className="animate-spin" /> : null}
            {loading ? 'Analysing…' : 'Extract Questions'}
          </button>
        )}
        {loaded && (
          <button
            onClick={load}
            disabled={loading}
            style={{
              fontSize: 9, color: '#4b5563', background: 'none', border: 'none',
              cursor: 'pointer', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        )}
      </div>

      {/* Question list */}
      <AnimatePresence>
        {questions.map((q, idx) => {
          const cfg = TYPE_CONFIG[q.type] || TYPE_CONFIG.behavioral;
          const isOpen = expandedIdx === idx;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              style={{
                borderRadius: 10,
                border: `1px solid ${isOpen ? cfg.border : 'rgba(255,255,255,0.06)'}`,
                background: isOpen ? cfg.bg : 'rgba(255,255,255,0.02)',
                overflow: 'hidden',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <button
                onClick={() => setExpandedIdx(isOpen ? null : idx)}
                style={{
                  width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                  display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  flexShrink: 0, marginTop: 1,
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '2px 6px', borderRadius: 5, border: `1px solid ${cfg.border}`,
                  color: cfg.color, background: cfg.bg,
                  whiteSpace: 'nowrap',
                }}>
                  {cfg.label}
                </span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.45 }}>
                  {q.question}
                </span>
                <ChevronDown
                  size={13}
                  color="#4b5563"
                  style={{ flexShrink: 0, marginTop: 2, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                />
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ padding: '0 14px 12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Why asked */}
                      <p style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>
                        {q.why}
                      </p>
                      {/* Talking points */}
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {q.talkingPoints.map((point, pi) => (
                          <li key={pi} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                            <span style={{
                              flexShrink: 0, width: 16, height: 16, borderRadius: '50%',
                              background: cfg.bg, border: `1px solid ${cfg.border}`,
                              color: cfg.color, fontSize: 8, fontWeight: 800,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                            }}>
                              {pi + 1}
                            </span>
                            <span style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.55 }}>{point}</span>
                          </li>
                        ))}
                      </ul>
                      {/* Copy button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => copyQuestion(idx)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', borderRadius: 6,
                            border: '1px solid rgba(255,255,255,0.07)',
                            background: 'rgba(255,255,255,0.04)',
                            color: copiedIdx === idx ? '#34d399' : '#6b7280',
                            fontSize: 10, fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          {copiedIdx === idx ? <CheckCircle size={10} /> : <Copy size={10} />}
                          {copiedIdx === idx ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {!loaded && !loading && (
        <p style={{ fontSize: 10, color: '#4b5563', textAlign: 'center', padding: '8px 0', margin: 0 }}>
          Extract the 8 most likely questions for this role.
        </p>
      )}
    </div>
  );
}
