import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check, X } from 'lucide-react';
import api from '../lib/api';

interface Question {
  achievementId: string;
  question: string;
  title: string;
  text: string;
}

interface ParsedAnswer {
  metric: string | null;
  rewrittenText: string;
}

interface EnrichmentPromptProps {
  jobDescription: string;
  achievementIds: string[];
  onComplete: () => void;
  onSkipAll: () => void;
}

export function EnrichmentPrompt({ jobDescription, achievementIds, onComplete, onSkipAll }: EnrichmentPromptProps) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [parsed, setParsed] = useState<ParsedAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.post('/enrichment/questions', { jobDescription, achievementIds })
      .then(({ data }) => { if (!cancelled) setQuestions(data?.questions ?? []); })
      .catch(() => { if (!cancelled) setError('Could not load enrichment questions.'); });
    return () => { cancelled = true; };
  }, [jobDescription, achievementIds]);

  if (error) {
    return (
      <div style={{ padding: 16, color: '#fca5a5', fontSize: 13 }}>
        {error}{' '}
        <button
          onClick={onSkipAll}
          style={{
            marginLeft: 8,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#e5e7eb',
            borderRadius: 8,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Generate anyway →
        </button>
      </div>
    );
  }
  if (!questions) {
    return <div style={{ padding: 16, color: '#9ca3af', fontSize: 13 }}>Preparing questions…</div>;
  }
  if (questions.length === 0) {
    onComplete();
    return null;
  }

  const current = questions[index];

  async function submitAnswer() {
    if (!current || !answer.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post('/enrichment/parse-answer', {
        achievementId: current.achievementId,
        question: current.question,
        userAnswer: answer,
      });
      setParsed({ metric: data?.metric ?? null, rewrittenText: data?.rewrittenText ?? '' });
    } catch {
      setError('Could not process your answer. Try rephrasing.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmAndAdvance() {
    const total = questions?.length ?? 0;
    if (!current || !parsed) return;
    setBusy(true);
    try {
      if (parsed.metric) {
        await api.patch(`/achievements/${current.achievementId}`, {
          metric: parsed.metric,
          description: parsed.rewrittenText,
        });
      }
      const next = index + 1;
      setParsed(null);
      setAnswer('');
      if (next >= total) {
        onComplete();
      } else {
        setIndex(next);
      }
    } finally {
      setBusy(false);
    }
  }

  function editParsed() {
    if (!parsed) return;
    setAnswer(parsed.rewrittenText);
    setParsed(null);
  }

  return (
    <div style={{
      background: 'rgba(99,102,241,0.06)',
      border: '1px solid rgba(99,102,241,0.2)',
      borderRadius: 16,
      padding: 24,
      marginTop: 16,
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: '#818cf8', textTransform: 'uppercase' }}>
        Sharpen for this role
      </p>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#a5b4fc' }}>
        Achievement {index + 1} of {questions.length} — answer in plain English
      </p>

      <AnimatePresence mode="wait">
        {!parsed ? (
          <motion.div
            key={`q-${index}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            <p style={{ margin: '0 0 8px', fontSize: 14, color: '#9ca3af' }}>
              <strong style={{ color: '#e5e7eb' }}>{current.title}:</strong> {current.text}
            </p>
            <p style={{ margin: '12px 0 12px', fontSize: 16, color: '#f3f4f6', fontWeight: 700, lineHeight: 1.45 }}>
              {current.question}
            </p>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Your answer…"
              rows={3}
              autoFocus
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                color: '#f3f4f6',
                fontSize: 14,
                padding: '11px 14px',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 12, marginTop: 14, alignItems: 'center' }}>
              <button
                onClick={submitAnswer}
                disabled={busy || !answer.trim()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#6366f1', color: '#fff',
                  border: 'none', borderRadius: 10, padding: '10px 18px',
                  fontSize: 13, fontWeight: 800, cursor: busy ? 'wait' : 'pointer',
                  opacity: (busy || !answer.trim()) ? 0.5 : 1,
                }}
              >
                {busy ? 'Working…' : 'Next'}
                {!busy && <ChevronRight size={14} />}
              </button>
              <button
                onClick={onSkipAll}
                style={{
                  background: 'transparent', color: '#9ca3af',
                  border: 'none', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', padding: '8px 12px',
                }}
              >
                Generate now with what we have →
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`c-${index}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#a5b4fc', fontWeight: 700 }}>
              I'll capture this as:
            </p>
            <p style={{
              margin: '0 0 16px',
              padding: 14,
              background: 'rgba(34,197,94,0.06)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 10,
              fontSize: 14,
              color: '#f3f4f6',
              lineHeight: 1.5,
            }}>
              {parsed.rewrittenText}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={confirmAndAdvance}
                disabled={busy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#22c55e', color: '#052e16',
                  border: 'none', borderRadius: 10, padding: '10px 18px',
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <Check size={14} /> Yes, save
              </button>
              <button
                onClick={editParsed}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'transparent', color: '#9ca3af',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 18px',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <X size={14} /> Edit
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
