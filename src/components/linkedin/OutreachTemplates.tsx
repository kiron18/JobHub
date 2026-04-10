import React, { useState } from 'react';
import { Loader2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import type { OutreachData } from './types';

const COACHING_TIPS: Record<keyof Omit<OutreachData, 'questionSuggestions'>, string> = {
  connectionNote: 'The specificity of the reference is what makes it work. Generic openers get ignored.',
  firstMessage: 'A precise question about something they actually know is hard to walk away from.',
  afterCallFollowUp: 'Shows you were paying attention. Plants a seed of reciprocity without being transactional.',
  directAsk: 'Ask for a name or a direction — not a job. Small ask, high likelihood of yes.',
};

const TEMPLATE_LABELS: Record<keyof Omit<OutreachData, 'questionSuggestions'>, string> = {
  connectionNote: 'Connection Request Note',
  firstMessage: 'First Message After Connecting',
  afterCallFollowUp: 'After-Call Follow-Up',
  directAsk: 'Direct Ask for Help',
};

function TemplateCard({ label, content, tip, charLimit, editableNote }: {
  label: string; content: string; tip: string; charLimit?: number; editableNote?: string;
}) {
  const { T } = useAppTheme();
  const [copied, setCopied] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [editedContent, setEditedContent] = useState(content);

  const charCount = editedContent.length;
  const overLimit = charLimit ? charCount > charLimit : false;

  async function handleCopy() {
    await navigator.clipboard.writeText(editedContent);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0A66C2' }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {charLimit && (
            <span style={{ fontSize: 11, color: overLimit ? '#f87171' : T.textFaint, fontWeight: 600 }}>
              {charCount} / {charLimit}
            </span>
          )}
          <button
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
              border: `1px solid ${copied ? '#34d399' : T.cardBorder}`,
              background: copied ? 'rgba(52,211,153,0.1)' : 'transparent',
              color: copied ? '#34d399' : T.textMuted, cursor: 'pointer',
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {editableNote && (
        <p style={{ fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
          {editableNote}
        </p>
      )}

      <textarea
        value={editedContent}
        onChange={e => setEditedContent(e.target.value)}
        rows={5}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${overLimit ? '#f87171' : T.cardBorder}`,
          borderRadius: 8, padding: '10px 12px', fontSize: 13,
          color: T.text, resize: 'vertical', lineHeight: 1.6,
          fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
        }}
      />

      <button
        onClick={() => setShowTip(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
          color: T.textFaint, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginTop: 8, padding: 0,
        }}
      >
        {showTip ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Coaching tip
      </button>
      {showTip && (
        <p style={{ fontSize: 12, color: T.textMuted, marginTop: 8, lineHeight: 1.6, fontStyle: 'italic', borderLeft: '2px solid rgba(10,102,194,0.4)', paddingLeft: 10 }}>
          {tip}
        </p>
      )}
    </div>
  );
}

export const OutreachTemplates: React.FC = () => {
  const { T } = useAppTheme();
  const [targetFirstName, setTargetFirstName] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [targetTopicOrPost, setTargetTopicOrPost] = useState('');
  const [specificQuestion, setSpecificQuestion] = useState('');
  const [generating, setGenerating] = useState(false);
  const [outreach, setOutreach] = useState<OutreachData | null>(null);
  const [showPlaybook, setShowPlaybook] = useState(false);

  async function handleGenerate() {
    if (!targetFirstName || !targetCompany || !targetTopicOrPost || generating) return;
    setGenerating(true);
    try {
      const { data } = await api.post('/linkedin/outreach', {
        targetFirstName, targetCompany, targetTopicOrPost,
        specificQuestion: specificQuestion || undefined,
      });
      setOutreach(data);
    } catch {
      toast.error('Generation failed — try again.');
    } finally {
      setGenerating(false);
    }
  }

  const inputStyle = (theme: typeof T): React.CSSProperties => ({
    width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
    background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.cardBorder}`,
    color: theme.text, outline: 'none', boxSizing: 'border-box' as const,
  });

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: '#64748b', display: 'block', marginBottom: 6,
  };

  return (
    <div>
      {/* Playbook guide */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <button
          onClick={() => setShowPlaybook(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            color: T.text, fontWeight: 700, fontSize: 14,
          }}
        >
          Before you start — The 7-Step Networking Playbook
          {showPlaybook ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showPlaybook && (
          <div style={{ marginTop: 16, fontSize: 13, color: T.textMuted, lineHeight: 1.7 }}>
            <p style={{ fontWeight: 700, color: T.text }}>The one mindset shift that makes everything else work:</p>
            <blockquote style={{ borderLeft: '2px solid rgba(10,102,194,0.5)', paddingLeft: 12, margin: '8px 0 16px', fontStyle: 'italic' }}>
              LinkedIn networking is not about asking people for jobs. It is about becoming someone people are glad they know. Give before you ask.
            </blockquote>
            <ol style={{ paddingLeft: 20, margin: 0 }}>
              <li><strong>Find the right people</strong> — target professionals with 400–500 connections who post regularly. Avoid mega-accounts.</li>
              <li><strong>Comment before you connect</strong> — a genuine, specific comment makes you familiar before your request arrives.</li>
              <li><strong>Send a connection note</strong> — reference something real, keep it under 300 characters.</li>
              <li><strong>First message after connecting</strong> — research their company, ask one specific question.</li>
              <li><strong>Have the conversation</strong> — prepare 3 specific questions, listen more than you talk, do not ask for a job.</li>
              <li><strong>Stay on their radar</strong> — thoughtful comments 1–2x/month, share relevant articles.</li>
              <li><strong>Convert to opportunities</strong> — only make a direct ask after at least one meaningful exchange.</li>
            </ol>
          </div>
        )}
      </div>

      {/* Input form */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 16 }}>
          About the person you want to reach
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>First Name</label>
            <input value={targetFirstName} onChange={e => setTargetFirstName(e.target.value)} placeholder="Sarah" style={inputStyle(T)} />
          </div>
          <div>
            <label style={labelStyle}>Company</label>
            <input value={targetCompany} onChange={e => setTargetCompany(e.target.value)} placeholder="Atlassian" style={inputStyle(T)} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>What they work on / posted about</label>
          <input
            value={targetTopicOrPost}
            onChange={e => setTargetTopicOrPost(e.target.value)}
            placeholder="e.g. scaling engineering teams in fast-growth startups"
            style={inputStyle(T)}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>A specific question you want to ask (optional)</label>
          <input
            value={specificQuestion}
            onChange={e => setSpecificQuestion(e.target.value)}
            placeholder="e.g. What does your team look for when hiring graduates without AU work experience?"
            style={inputStyle(T)}
          />
          {outreach?.questionSuggestions?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {outreach.questionSuggestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setSpecificQuestion(q)}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 16,
                    border: '1px solid rgba(10,102,194,0.3)', background: 'rgba(10,102,194,0.08)',
                    color: '#60a5fa', cursor: 'pointer',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          onClick={handleGenerate}
          disabled={!targetFirstName || !targetCompany || !targetTopicOrPost || generating}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
            background: !targetFirstName || !targetCompany || !targetTopicOrPost || generating
              ? 'rgba(10,102,194,0.3)' : '#0A66C2',
            color: 'white', fontWeight: 700, fontSize: 14,
            cursor: (!targetFirstName || !targetCompany || !targetTopicOrPost || generating) ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {generating && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
          {generating ? 'Generating templates…' : 'Generate Outreach Templates'}
        </button>
      </div>

      {outreach && (
        <>
          <TemplateCard
            label={TEMPLATE_LABELS.connectionNote}
            content={outreach.connectionNote}
            tip={COACHING_TIPS.connectionNote}
            charLimit={300}
          />
          <TemplateCard
            label={TEMPLATE_LABELS.firstMessage}
            content={outreach.firstMessage}
            tip={COACHING_TIPS.firstMessage}
          />
          <TemplateCard
            label={TEMPLATE_LABELS.afterCallFollowUp}
            content={outreach.afterCallFollowUp}
            tip={COACHING_TIPS.afterCallFollowUp}
            editableNote="Fill in [THEIR_POINT] with something specific they actually said."
          />
          <TemplateCard
            label={TEMPLATE_LABELS.directAsk}
            content={outreach.directAsk}
            tip={COACHING_TIPS.directAsk}
            editableNote="Only use this after at least one meaningful exchange. Do not skip to this."
          />
        </>
      )}
    </div>
  );
};
