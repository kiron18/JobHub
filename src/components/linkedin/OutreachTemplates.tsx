import React, { useState } from 'react';
import { Loader2, Copy, Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import type { OutreachData } from './types';

const LINKEDIN_BLUE = '#0A66C2';
const SUCCESS_GREEN = '#2A9D6F';
const WARNING_RED = '#C0392B';

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

// Education content from outreach guide
const MINDSET_CONTENT = {
  title: 'Why Outreach Beats Applications',
  callout: 'Applications put you in a queue. Outreach puts you in a conversation.',
  outreach: [
    "I'm building relationships",
    "I'm learning about the industry",
    "I'm creating future opportunities",
    "I'm showing initiative",
    "I'm playing a long game",
  ],
  application: [
    "I'm waiting to hear back",
    "I applied to 50 jobs today",
    "Nobody replies to me",
    "I'll keep refreshing my email",
    "More applications = more chances",
  ],
};

const DAILY_HABIT = {
  target: '10 outreach actions per day. Consistent beats intense.',
  actions: [
    { action: 'LinkedIn connection requests (with note)', daily: '5', time: '15–20 min' },
    { action: 'LinkedIn follow-up messages', daily: '3', time: '10 min' },
    { action: 'Cold emails (with personalisation)', daily: '2', time: '20 min' },
  ],
  total: { daily: '10', time: '~45–50 min' },
};

const FOLLOW_UP_SEQUENCE = [
  { day: 'Day 1', action: 'Send the initial email or connection request with a personalized note.' },
  { day: 'Day 5–6', action: 'First follow-up (if no reply): "Hi [Name], just wanted to circle back in case my email got buried. Happy to keep it brief — even a quick reply would mean a lot. Thanks either way."' },
  { day: 'Day 12–14', action: 'Final touch: "Hi [Name], last one from me — I completely understand if the timing isn\'t right. I\'ll keep following your work and hope our paths cross at some point."' },
  { day: 'After that', action: 'Move on. Don\'t chase after 3 touches. Put them in "revisit in 3 months" and move to the next person.' },
];

const SUCCESS_MILESTONES = [
  { week: 'Week 1', milestone: '10–15 LinkedIn connections sent. 2–3 accepted. Profile gets viewed by targets.' },
  { week: 'Week 2', milestone: '3–5 replies to follow-up messages. First informational chat booked.' },
  { week: 'Week 4', milestone: '2–3 informational interviews completed. Active leads forming.' },
  { week: 'Week 8', milestone: 'Direct referrals and job leads starting to appear organically.' },
];

const WHAT_NOT_TO_DO = [
  'Sending a blank connection request with no message',
  'Asking for a job in the very first message',
  'Writing a long essay — keep it short and human',
  'Sending the exact same message to 50 people on the same day',
  'Giving up if they don\'t respond within 2 days',
  'Attaching your resume to the first message',
];

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
    <div style={{
      background: warm.colors.bgSurface,
      border: `1px solid ${warm.colors.borderWhisper}`,
      borderRadius: 14,
      padding: 20,
      marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{
          fontSize: 12,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: LINKEDIN_BLUE,
        }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {charLimit && (
            <span style={{
              fontSize: 11,
              color: overLimit ? '#f87171' : warm.colors.textMuted,
              fontWeight: 600,
            }}>
              {charCount} / {charLimit}
            </span>
          )}
          <button
            onClick={handleCopy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 6,
              border: `1px solid ${copied ? SUCCESS_GREEN : warm.colors.borderWhisper}`,
              background: copied ? 'rgba(42,157,111,0.1)' : 'transparent',
              color: copied ? SUCCESS_GREEN : warm.colors.textSecondary,
              cursor: 'pointer',
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {editableNote && (
        <p style={{
          fontSize: 12,
          color: '#f59e0b',
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 6,
          padding: '6px 10px',
          marginBottom: 10,
        }}>
          {editableNote}
        </p>
      )}

      <textarea
        value={editedContent}
        onChange={e => setEditedContent(e.target.value)}
        rows={5}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${overLimit ? '#f87171' : warm.colors.borderWhisper}`,
          borderRadius: 8,
          padding: '10px 12px',
          fontSize: 13,
          color: warm.colors.textPrimary,
          resize: 'vertical',
          lineHeight: 1.6,
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      <button
        onClick={() => setShowTip(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          color: warm.colors.textMuted,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          marginTop: 8,
          padding: 0,
        }}
      >
        {showTip ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Coaching tip
      </button>

      {showTip && (
        <p style={{
          fontSize: 12,
          color: warm.colors.textSecondary,
          marginTop: 8,
          lineHeight: 1.6,
          fontStyle: 'italic',
          borderLeft: '2px solid rgba(10,102,194,0.4)',
          paddingLeft: 10,
        }}>
          {tip}
        </p>
      )}
    </div>
  );
}

// Collapsible education module
function EducationModule({ title, children, defaultOpen = false }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      background: warm.colors.bgSurface,
      border: `1px solid ${warm.colors.borderWhisper}`,
      borderRadius: 14,
      marginBottom: 16,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          color: warm.colors.textPrimary,
        }}>
          {title}
        </span>
        {open ? <ChevronUp size={18} color={warm.colors.textMuted} /> : <ChevronDown size={18} color={warm.colors.textMuted} />}
      </button>

      {open && (
        <div style={{ padding: '0 20px 20px' }}>
          {children}
        </div>
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

  async function handleGenerate() {
    if (!targetFirstName || !targetCompany || !targetTopicOrPost || generating) return;
    setGenerating(true);
    try {
      const { data } = await api.post('/linkedin/outreach', {
        targetFirstName,
        targetCompany,
        targetTopicOrPost,
        specificQuestion: specificQuestion || undefined,
      });
      setOutreach(data);
      setGenId(g => g + 1);
    } catch (err: any) {
      if (err?.response?.status === 402) {
        toast.error('Service temporarily unavailable. Please try again later.');
      } else {
        toast.error('Generation failed — try again.');
      }
    } finally {
      setGenerating(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    fontSize: 14,
    background: warm.colors.bgAlt,
    border: `1px solid ${warm.colors.borderWhisper}`,
    color: warm.colors.textPrimary,
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#64748b',
    display: 'block',
    marginBottom: 6,
  };

  return (
    <div>
      {/* Core strategy banner — always visible */}
      <div style={{
        background: warm.colors.bgAlt,
        border: `1px solid ${warm.colors.borderWhisper}`,
        borderLeft: `3px solid ${warm.colors.accentPetrol}`,
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 20,
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
        <p style={{
          margin: '0 0 6px',
          fontSize: 13,
          lineHeight: 1.6,
          color: warm.colors.textPrimary,
          fontWeight: 600,
        }}>
          Don't ask for a job. Become someone people are glad they know — then ask for a name or a direction.
        </p>
        <p style={{
          margin: 0,
          fontSize: 12.5,
          lineHeight: 1.6,
          color: warm.colors.textSecondary,
        }}>
          Fill in the person you want to reach below. We'll generate four templates in sequence: a connection note, a first message after they accept, an after-call follow-up, and a small direct ask.
        </p>
      </div>

      {/* Education Modules — from outreach guide */}
      <EducationModule title="💡 Why Outreach Beats Applications">
        <div style={{
          background: warm.colors.bgDeep,
          color: warm.colors.textOnDeep,
          borderRadius: 10,
          padding: '14px 18px',
          marginBottom: 16,
        }}>
          <p style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.5,
          }}>
            {MINDSET_CONTENT.callout}
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}>
          <div style={{
            background: 'rgba(42,157,111,0.08)',
            border: '1px solid rgba(42,157,111,0.2)',
            borderRadius: 10,
            padding: 14,
          }}>
            <h4 style={{
              fontSize: 11,
              color: SUCCESS_GREEN,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              margin: '0 0 10px',
            }}>
              Outreach Mindset
            </h4>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              {MINDSET_CONTENT.outreach.map((item, i) => (
                <li key={i} style={{ fontSize: 12, marginBottom: 4, color: warm.colors.textSecondary }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div style={{
            background: 'rgba(184,92,92,0.08)',
            border: '1px solid rgba(184,92,92,0.2)',
            borderRadius: 10,
            padding: 14,
          }}>
            <h4 style={{
              fontSize: 11,
              color: WARNING_RED,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              margin: '0 0 10px',
            }}>
              Application Mindset
            </h4>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              {MINDSET_CONTENT.application.map((item, i) => (
                <li key={i} style={{ fontSize: 12, marginBottom: 4, color: warm.colors.textSecondary }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </EducationModule>

      <EducationModule title="🎯 Your Daily Outreach Habit">
        <div style={{
          background: `linear-gradient(135deg, ${warm.colors.accentPetrol} 0%, ${warm.colors.accentPetrolHover} 100%)`,
          color: warm.colors.textOnDeep,
          borderRadius: 10,
          padding: '14px 18px',
          marginBottom: 16,
        }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
            Target: {DAILY_HABIT.target}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.9 }}>
            10 per day × 5 days = 50 contacts per week
          </p>
        </div>

        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
        }}>
          <thead>
            <tr>
              <th style={{
                background: warm.colors.bgDeep,
                color: warm.colors.textOnDeep,
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 600,
              }}>Action</th>
              <th style={{
                background: warm.colors.bgDeep,
                color: warm.colors.textOnDeep,
                padding: '10px 12px',
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 600,
                width: 80,
              }}>Daily</th>
              <th style={{
                background: warm.colors.bgDeep,
                color: warm.colors.textOnDeep,
                padding: '10px 12px',
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 600,
                width: 100,
              }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {DAILY_HABIT.actions.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? warm.colors.bgSurface : warm.colors.bgAlt }}>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${warm.colors.borderWhisper}` }}>{row.action}</td>
                <td style={{
                  padding: '10px 12px',
                  borderBottom: `1px solid ${warm.colors.borderWhisper}`,
                  textAlign: 'center',
                  fontWeight: 600,
                }}>{row.daily}</td>
                <td style={{
                  padding: '10px 12px',
                  borderBottom: `1px solid ${warm.colors.borderWhisper}`,
                  textAlign: 'center',
                  color: warm.colors.textMuted,
                }}>{row.time}</td>
              </tr>
            ))}
            <tr style={{ background: warm.colors.bgAlt }}>
              <td style={{ padding: '10px 12px', fontWeight: 700 }}>Total</td>
              <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>{DAILY_HABIT.total.daily}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>{DAILY_HABIT.total.time}</td>
            </tr>
          </tbody>
        </table>
      </EducationModule>

      <EducationModule title="🔄 The Follow-Up Sequence">
        <p style={{
          fontSize: 13,
          color: warm.colors.textSecondary,
          margin: '0 0 16px',
          lineHeight: 1.5,
        }}>
          Most people don't reply to the first message. That's normal — not personal. Follow up once or twice before moving on.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FOLLOW_UP_SEQUENCE.map((step, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                background: warm.colors.bgAlt,
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: i === 3 ? SUCCESS_GREEN : warm.colors.accentPetrol,
                color: warm.colors.textOnDeep,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {i === 3 ? '✓' : i + 1}
              </div>
              <div>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: warm.colors.textPrimary,
                  marginBottom: 2,
                }}>
                  {step.day}
                </div>
                <div style={{
                  fontSize: 12,
                  color: warm.colors.textSecondary,
                  lineHeight: 1.5,
                }}>
                  {step.action}
                </div>
              </div>
            </div>
          ))}
        </div>
      </EducationModule>

      <EducationModule title="📈 What Success Looks Like">
        <p style={{
          fontSize: 13,
          color: warm.colors.textSecondary,
          margin: '0 0 16px',
          lineHeight: 1.5,
        }}>
          Reset expectations: most won't reply, it's a numbers game, not personal.
        </p>

        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
        }}>
          <thead>
            <tr>
              <th style={{
                background: warm.colors.bgDeep,
                color: warm.colors.textOnDeep,
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 600,
                width: 100,
              }}>Timeframe</th>
              <th style={{
                background: warm.colors.bgDeep,
                color: warm.colors.textOnDeep,
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 600,
              }}>Realistic Milestones</th>
            </tr>
          </thead>
          <tbody>
            {SUCCESS_MILESTONES.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? warm.colors.bgSurface : warm.colors.bgAlt }}>
                <td style={{
                  padding: '10px 12px',
                  borderBottom: `1px solid ${warm.colors.borderWhisper}`,
                  fontWeight: 700,
                  color: warm.colors.textPrimary,
                }}>{row.week}</td>
                <td style={{
                  padding: '10px 12px',
                  borderBottom: `1px solid ${warm.colors.borderWhisper}`,
                  color: warm.colors.textSecondary,
                }}>{row.milestone}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{
          background: warm.colors.bgDeep,
          color: warm.colors.textOnDeep,
          borderRadius: 10,
          padding: '14px 18px',
          marginTop: 16,
        }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            The goal of every first message is not a job. It's a <strong style={{ color: warm.colors.accentGold }}>conversation</strong>.
            The goal of every conversation is not an interview. It's a <strong style={{ color: warm.colors.accentGold }}>relationship</strong>.
            The relationship is what eventually leads to the role.
          </p>
        </div>
      </EducationModule>

      <EducationModule title="❌ What NOT to Do">
        <div style={{
          background: 'rgba(184,92,92,0.08)',
          border: '1px solid rgba(184,92,92,0.2)',
          borderRadius: 10,
          padding: 14,
        }}>
          <h4 style={{
            fontSize: 11,
            color: WARNING_RED,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            margin: '0 0 12px',
          }}>
            Avoid these mistakes
          </h4>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {WHAT_NOT_TO_DO.map((item, i) => (
              <li key={i} style={{
                fontSize: 13,
                marginBottom: 6,
                color: warm.colors.textSecondary,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <X size={14} color={WARNING_RED} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </EducationModule>

      {/* 7-Step Playbook — kept from original */}
      <div style={{
        background: warm.colors.bgSurface,
        border: showPlaybook ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(239,68,68,0.35)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
        boxShadow: showPlaybook ? 'none' : '0 0 14px rgba(239,68,68,0.12)',
      }}>
        <button
          onClick={() => setShowPlaybook(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: showPlaybook ? warm.colors.textPrimary : '#f87171',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          Before you start — The 7-Step Networking Playbook
          {showPlaybook ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showPlaybook && (
          <div style={{ marginTop: 16, fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.7 }}>
            <p style={{ fontWeight: 700, color: warm.colors.textPrimary }}>
              The one mindset shift that makes everything else work:
            </p>
            <blockquote style={{
              borderLeft: '2px solid rgba(10,102,194,0.5)',
              paddingLeft: 12,
              margin: '8px 0 16px',
              fontStyle: 'italic',
            }}>
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

      {/* Generator Form */}
      <div style={{
        background: warm.colors.bgSurface,
        border: `1px solid ${warm.colors.borderWhisper}`,
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
      }}>
        <p style={{
          fontSize: 13,
          fontWeight: 700,
          color: warm.colors.textPrimary,
          marginBottom: 16,
        }}>
          About the person you want to reach
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
          marginBottom: 14,
        }}>
          <div>
            <label htmlFor="outFirstName" style={labelStyle}>First Name</label>
            <input
              id="outFirstName"
              value={targetFirstName}
              onChange={e => setTargetFirstName(e.target.value)}
              placeholder="Sarah"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="outCompany" style={labelStyle}>Company</label>
            <input
              id="outCompany"
              value={targetCompany}
              onChange={e => setTargetCompany(e.target.value)}
              placeholder="Atlassian"
              style={inputStyle}
            />
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
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 16,
                    border: '1px solid rgba(10,102,194,0.3)',
                    background: 'rgba(10,102,194,0.08)',
                    color: '#60a5fa',
                    cursor: 'pointer',
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
            width: '100%',
            padding: '12px 0',
            borderRadius: 10,
            border: 'none',
            background: !targetFirstName || !targetCompany || !targetTopicOrPost || generating
              ? 'rgba(10,102,194,0.3)' : LINKEDIN_BLUE,
            color: 'white',
            fontWeight: 700,
            fontSize: 14,
            cursor: (!targetFirstName || !targetCompany || !targetTopicOrPost || generating) ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {generating && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
          {generating ? 'Generating templates…' : 'Generate Outreach Templates'}
        </button>
      </div>

      {/* Generated Templates */}
      {outreach && (
        <>
          <TemplateCard
            key={`${genId}-connectionNote`}
            label={TEMPLATE_LABELS.connectionNote}
            content={outreach.connectionNote}
            tip={COACHING_TIPS.connectionNote}
            charLimit={300}
          />
          <TemplateCard
            key={`${genId}-firstMessage`}
            label={TEMPLATE_LABELS.firstMessage}
            content={outreach.firstMessage}
            tip={COACHING_TIPS.firstMessage}
          />
          <TemplateCard
            key={`${genId}-afterCallFollowUp`}
            label={TEMPLATE_LABELS.afterCallFollowUp}
            content={outreach.afterCallFollowUp}
            tip={COACHING_TIPS.afterCallFollowUp}
            editableNote="Fill in [THEIR_POINT] with something specific they actually said."
          />
          <TemplateCard
            key={`${genId}-directAsk`}
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
