import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import api from '../lib/api';

interface Improvement {
  area: string;
  issue: string;
  fix: string;
  impact: string;
  priority: number;
}

interface AdvisorResult {
  overallGrade: 'A' | 'B' | 'C' | 'D';
  summary: string;
  improvements: Improvement[];
}

interface ProfileAdvisorPanelProps {
  targetRole?: string;
}

const GRADE_CONFIG = {
  A: { color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', label: 'Strong' },
  B: { color: '#818cf8', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)', label: 'Good' },
  C: { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', label: 'Needs Work' },
  D: { color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', label: 'Incomplete' },
};

const PRIORITY_COLOR: Record<number, string> = {
  1: '#f87171',
  2: '#fbbf24',
  3: '#fbbf24',
  4: '#94a3b8',
  5: '#64748b',
};

export function ProfileAdvisorPanel({ targetRole }: ProfileAdvisorPanelProps) {
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const run = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await api.post('/analyze/profile-advisor', { targetRole });
      setResult(data);
      setExpandedIdx(0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const grade = result ? GRADE_CONFIG[result.overallGrade] || GRADE_CONFIG.C : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Zap size={12} color="#818cf8" />
          <span style={{ fontSize: 10, fontWeight: 800, color: '#818cf8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Profile Advisor
          </span>
        </div>
        <button
          onClick={run}
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
          {loading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
          {loading ? 'Analysing…' : result ? 'Re-analyse' : 'Analyse Profile'}
        </button>
      </div>

      {/* Grade + summary */}
      {grade && result && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            borderRadius: 10, border: `1px solid ${grade.border}`,
            background: grade.bg,
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            border: `2px solid ${grade.color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 900, color: grade.color,
          }}>
            {result.overallGrade}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: grade.color, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              {grade.label} — Generation Readiness
            </p>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0', lineHeight: 1.45 }}>{result.summary}</p>
          </div>
        </motion.div>
      )}

      {/* Improvements */}
      <AnimatePresence>
        {result?.improvements.map((item, idx) => {
          const isOpen = expandedIdx === idx;
          const pColor = PRIORITY_COLOR[item.priority] || '#64748b';
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              style={{
                borderRadius: 10, overflow: 'hidden',
                border: `1px solid ${isOpen ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)'}`,
                background: isOpen ? 'rgba(99,102,241,0.05)' : 'rgba(255,255,255,0.02)',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <button
                onClick={() => setExpandedIdx(isOpen ? null : idx)}
                style={{
                  width: '100%', padding: '9px 12px', background: 'none', border: 'none',
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  flexShrink: 0, width: 16, height: 16, borderRadius: '50%',
                  background: `${pColor}18`, border: `1px solid ${pColor}40`,
                  color: pColor, fontSize: 8, fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.priority}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 6 }}>
                    {item.area}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>{item.issue}</span>
                </div>
                {isOpen ? <ChevronUp size={11} color="#4b5563" style={{ flexShrink: 0 }} /> : <ChevronDown size={11} color="#4b5563" style={{ flexShrink: 0 }} />}
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ padding: '0 12px 10px 36px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ padding: '6px 10px', background: 'rgba(99,102,241,0.08)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fix</p>
                        <p style={{ fontSize: 11, color: '#c7d2fe', margin: 0, lineHeight: 1.5 }}>{item.fix}</p>
                      </div>
                      <p style={{ fontSize: 10, color: '#4b5563', margin: 0 }}>
                        <span style={{ color: '#6b7280', fontWeight: 700 }}>Improves:</span> {item.impact}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {!result && !loading && (
        <p style={{ fontSize: 10, color: '#4b5563', textAlign: 'center', padding: '4px 0', margin: 0 }}>
          Get AI-powered advice on what's missing from your profile.
        </p>
      )}
    </div>
  );
}
