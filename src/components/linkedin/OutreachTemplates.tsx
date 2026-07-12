import React, { useState } from 'react';
import { Loader2, Copy, Check, ChevronDown, ChevronUp, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import type { OutreachData } from './types';

const COACHING_TIPS: Record<keyof Omit<OutreachData, 'questionSuggestions'>, string> = {
  connectionNote: 'The specificity of the reference is what makes it work. Generic openers get ignored.',
  firstMessage: 'A precise question about something they actually know is hard to walk away from.',
  afterConversationFollowUp: 'Shows you were paying attention. Plants a seed of reciprocity without being transactional.',
  directAsk: 'This is the highest-impact message in the sequence. Ask for a name or a direction — not a job — but make sure you actually ask. A conversation that ends without an ask is a lottery ticket you never scratched.',
};

const TEMPLATE_LABELS: Record<keyof Omit<OutreachData, 'questionSuggestions'>, string> = {
  connectionNote: 'Connection Request Note',
  firstMessage: 'First Message After Connecting',
  afterConversationFollowUp: 'After-Conversation Follow-Up',
  directAsk: 'Direct Ask for Help',
};

function TemplateCard({ label, content, tip, charLimit, editableNote }: {
  label: string; content: string; tip: string; charLimit?: number; editableNote?: string;
}) {
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
    <div style={{ background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0A66C2' }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {charLimit && (
            <span style={{ fontSize: 11, color: overLimit ? '#f87171' : warm.colors.textMuted, fontWeight: 600 }}>
              {charCount} / {charLimit}
            </span>
          )}
          <button
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
              border: `1px solid ${copied ? '#34d399' : warm.colors.borderWhisper}`,
              background: copied ? 'rgba(52,211,153,0.1)' : 'transparent',
              color: copied ? '#34d399' : warm.colors.textSecondary, cursor: 'pointer',
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
          border: `1px solid ${overLimit ? '#f87171' : warm.colors.borderWhisper}`,
          borderRadius: 8, padding: '10px 12px', fontSize: 13,
          color: warm.colors.textPrimary, resize: 'vertical', lineHeight: 1.6,
          fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
        }}
      />

      <button
        onClick={() => setShowTip(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
          color: warm.colors.textMuted, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginTop: 8, padding: 0,
        }}
      >
        {showTip ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Coaching tip
      </button>
      {showTip && (
        <p style={{ fontSize: 12, color: warm.colors.textSecondary, marginTop: 8, lineHeight: 1.6, fontStyle: 'italic', borderLeft: '2px solid rgba(10,102,194,0.4)', paddingLeft: 10 }}>
          {tip}
        </p>
      )}
    </div>
  );
}

export const OutreachTemplates: React.FC = () => {
  const [targetFirstName, setTargetFirstName] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [targetTopicOrPost, setTargetTopicOrPost] = useState('');
  const [specificQuestion, setSpecificQuestion] = useState('');
  const [generating, setGenerating] = useState(false);
  const [outreach, setOutreach] = useState<OutreachData | null>(null);
  const [genId, setGenId] = useState(0);
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [logging, setLogging] = useState(false);
  const [loggedThisGen, setLoggedThisGen] = useState(false);

  async function handleLogConnected() {
    if (logging || loggedThisGen || !outreach) return;
    setLogging(true);
    try {
      await api.post('/linkedin/outreach/log', {
        personName: targetFirstName,
        company: targetCompany,
        topic: targetTopicOrPost,
        specificQuestion,
        firstMessage: outreach.firstMessage,
      });
      setLoggedThisGen(true);
      toast.success(`Logged — ${targetFirstName} at ${targetCompany}`);
    } catch {
      toast.error('Could not log this outreach — try again.');
    } finally {
      setLogging(false);
    }
  }

  async function handleGenerate() {
    if (!targetFirstName || !targetCompany || !targetTopicOrPost || generating) return;
    setGenerating(true);
    try {
      const { data } = await api.post('/linkedin/outreach', {
        targetFirstName, targetCompany, targetTopicOrPost,
        specificQuestion: specificQuestion || undefined,
      });
      setOutreach(data);
      setGenId(g => g + 1);
      setLoggedThisGen(false);
    } catch (err: any) {
      if (err?.response?.status === 402) {
        // PAYMENTS PAUSED: no longer redirecting to pricing - unlimited access active
        toast.error('Service temporarily unavailable. Please try again later.');
      } else {
        toast.error('Generation failed — try again.');
      }
    } finally {
      setGenerating(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
    background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
    color: warm.colors.textPrimary, outline: 'none', boxSizing: 'border-box' as const,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: '#64748b', display: 'block', marginBottom: 6,
  };

  return (
    <div>
      {/* Brief strategy overview — always visible, sets up the playbook below */}
      <div style={{
        background: warm.colors.bgAlt,
        border: `1px solid ${warm.colors.borderWhisper}`,
        borderLeft: `3px solid ${warm.colors.accentPetrol}`,
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 14,
      }}>
        <p style={{
          margin: '0 0 6px',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: warm.colors.textSecondary,
        }}>
          The outreach strategy
        </p>
        <p style={{ margin: '0 0 6px', fontSize: 13, lineHeight: 1.6, color: warm.colors.textPrimary, fontWeight: 600 }}>
          Don't ask for a job. Become someone people are glad they know — then ask for a name or a direction.
        </p>
        <p style={{ margin: '0 0 6px', fontSize: 12.5, lineHeight: 1.6, color: warm.colors.textSecondary }}>
          Fill in the person you want to reach below. We'll generate four templates in sequence: a connection note, a first message after they accept, an after-conversation follow-up, and a small direct ask. Use them in that order — each one earns the right to send the next.
        </p>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: warm.colors.textSecondary }}>
          Stay curious and playful in these conversations — this is focused play and socialising, not a transaction. Think of it as relationship building, not career growth. The career growth is a byproduct of strong relationships.
        </p>
      </div>

      {/* Playbook guide */}
      <div style={{
        background: warm.colors.bgSurface,
        border: showPlaybook ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(239,68,68,0.35)',
        borderRadius: 14, padding: 16, marginBottom: 20,
        boxShadow: showPlaybook ? 'none' : '0 0 14px rgba(239,68,68,0.12)',
      }}>
        <button
          onClick={() => setShowPlaybook(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            color: showPlaybook ? warm.colors.textPrimary : '#f87171', fontWeight: 700, fontSize: 14,
          }}
        >
          Before you start — The 7-Step Networking Playbook
          {showPlaybook ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showPlaybook && (
          <div style={{ marginTop: 16, fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.7 }}>
            <p style={{ fontWeight: 700, color: warm.colors.textPrimary }}>The one mindset shift that makes everything else work:</p>
            <blockquote style={{ borderLeft: '2px solid rgba(10,102,194,0.5)', paddingLeft: 12, margin: '8px 0 16px', fontStyle: 'italic' }}>
              LinkedIn networking is not about asking people for jobs. It is about becoming someone people are glad they know. Give before you ask.
            </blockquote>
            <ol style={{ paddingLeft: 20, margin: 0 }}>
              <li><strong>Find the right people</strong> — target professionals with 400–500 connections who post regularly. Avoid mega-accounts.</li>
              <li><strong>Comment before you connect</strong> — a genuine, specific comment makes you familiar before your request arrives.</li>
              <li><strong>Send a connection note</strong> — reference something real, keep it under 200 characters.</li>
              <li><strong>First message after connecting</strong> — research their company, ask one specific question.</li>
              <li><strong>Have the conversation</strong> — prepare 3 specific questions, listen more than you talk, do not ask for a job.</li>
              <li><strong>Stay on their radar</strong> — thoughtful comments 1–2x/month, share relevant articles.</li>
              <li><strong>Convert to opportunities</strong> — only make a direct ask after at least one meaningful exchange.</li>
            </ol>
          </div>
        )}
      </div>

      {/* Input form */}
      <div style={{ background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary, marginBottom: 16 }}>
          About the person you want to reach
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label htmlFor="outFirstName" style={labelStyle}>First Name</label>
            <input id="outFirstName" value={targetFirstName} onChange={e => setTargetFirstName(e.target.value)} placeholder="Sarah" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="outCompany" style={labelStyle}>Company</label>
            <input id="outCompany" value={targetCompany} onChange={e => setTargetCompany(e.target.value)} placeholder="Atlassian" style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="outTopic" style={labelStyle}>What they work on / posted about</label>
          <input
            id="outTopic"
            value={targetTopicOrPost}
            onChange={e => setTargetTopicOrPost(e.target.value)}
            placeholder="e.g. scaling engineering teams in fast-growth startups"
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="outQuestion" style={labelStyle}>A specific question you want to ask (optional)</label>
          <input
            id="outQuestion"
            value={specificQuestion}
            onChange={e => setSpecificQuestion(e.target.value)}
            placeholder="e.g. What does your team look for when hiring graduates without AU work experience?"
            style={inputStyle}
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
          {/* Authenticity note */}
          <div style={{
            background: 'rgba(42,157,111,0.07)',
            border: '1px solid rgba(42,157,111,0.25)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 14,
          }}>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: warm.colors.textSecondary }}>
              <strong style={{ color: warm.colors.textPrimary }}>These are starting points, not scripts.</strong>{' '}
              Edit them until they sound like something you would actually say — a message in your own voice lands better than a polished one that isn't. Authenticity beats "perfection".
            </p>
          </div>

          <TemplateCard
            key={`${genId}-connectionNote`}
            label={TEMPLATE_LABELS.connectionNote}
            content={outreach.connectionNote}
            tip={COACHING_TIPS.connectionNote}
            charLimit={200}
          />
          <TemplateCard
            key={`${genId}-firstMessage`}
            label={TEMPLATE_LABELS.firstMessage}
            content={outreach.firstMessage}
            tip={COACHING_TIPS.firstMessage}
          />

          {/* Connected — one-tap outreach log */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 12, padding: '12px 16px', marginBottom: 14,
          }}>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: warm.colors.textSecondary }}>
              Sent the first message? Log it — one tap, and it lands in the Tracker tab above.
            </p>
            <button
              onClick={handleLogConnected}
              disabled={logging || loggedThisGen}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                border: `1px solid ${loggedThisGen ? '#34d399' : 'rgba(10,102,194,0.4)'}`,
                background: loggedThisGen ? 'rgba(52,211,153,0.1)' : '#0A66C2',
                color: loggedThisGen ? '#34d399' : 'white',
                cursor: logging || loggedThisGen ? 'default' : 'pointer',
              }}
            >
              {logging ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                : loggedThisGen ? <Check size={13} /> : <UserCheck size={13} />}
              {loggedThisGen ? 'Connected' : 'Mark as Connected'}
            </button>
          </div>

          <TemplateCard
            key={`${genId}-afterConversationFollowUp`}
            label={TEMPLATE_LABELS.afterConversationFollowUp}
            content={outreach.afterConversationFollowUp}
            tip={COACHING_TIPS.afterConversationFollowUp}
            editableNote="Send within 24 hours of any real exchange — a chat, a call, or a message thread. Fill in [THEIR_POINT] with something specific they actually said."
          />
          <TemplateCard
            key={`${genId}-directAsk`}
            label={TEMPLATE_LABELS.directAsk}
            content={outreach.directAsk}
            tip={COACHING_TIPS.directAsk}
            editableNote="Only use this after at least one meaningful exchange. Do not skip to this — but do not skip it either. Make the ask."
          />
        </>
      )}
    </div>
  );
};
