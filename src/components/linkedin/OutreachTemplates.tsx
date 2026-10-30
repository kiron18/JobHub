import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Copy, Check, ChevronDown, ChevronUp, UserCheck, ArrowRight, Send } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../lib/api';
import { warm, ACTION } from '../../lib/theme/warmTokens';
import { NetworkingGuide } from './NetworkingGuide';
import { OutreachDueNudges } from './OutreachTracker';
import type { OutreachData } from './types';

const COACHING_TIPS: Record<keyof Omit<OutreachData, 'questionSuggestions'>, string> = {
  connectionNote: 'The specificity of the reference is what makes it work. Generic openers get ignored. No ask here: the connection request is already an ask.',
  firstMessage: 'This is the one that gets the call. It says plainly what you are after and asks for the 15 minutes in the same breath, so nothing about it feels like a bait and switch later.',
  afterConversationFollowUp: 'Shows you were paying attention. Plants a seed of reciprocity without being transactional.',
  directAsk: 'Your second run at the call, for when the first message did not land it. Reference something from the conversation so it does not read as a copy-paste, and make the ask explicitly.',
  reContact: 'The one that actually produces referrals. It lands weeks later, asks for nothing, and proves you did something with their advice. Most referrals happen the week a role opens and you are the person they happen to be thinking about.',
};

const TEMPLATE_LABELS: Record<keyof Omit<OutreachData, 'questionSuggestions'>, string> = {
  connectionNote: 'Connection Request Note',
  firstMessage: 'First Message After Connecting (asks for the call)',
  afterConversationFollowUp: 'After-Conversation Follow-Up',
  directAsk: 'Ask Again for the Call (if the first message did not land it)',
  reContact: 'The 3-4 Week Follow-Up (where referrals come from)',
};

/* LinkedIn caps the connection note at 200 characters on a free account and 300
   on Premium. We generate and count to 200 so the note sends on either, and
   just tell the user both numbers rather than asking which account they have. */
const NOTE_LIMIT_FREE = 200;

function TemplateCard({ label, content, tip, charLimit, editableNote, logEnabled, onLogCopy, onContentChange }: {
  label: string;
  content: string;
  tip: string;
  charLimit?: number;
  editableNote?: string;
  logEnabled?: boolean;
  onLogCopy?: (body: string) => Promise<void>;
  onContentChange?: (body: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [logging, setLogging] = useState(false);

  const charCount = editedContent.length;
  const overLimit = charLimit ? charCount > charLimit : false;

  function handleEdit(value: string) {
    setEditedContent(value);
    onContentChange?.(value);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(editedContent);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 1800);

    // Log the copy as the next message sent, if this card supports logging
    if (logEnabled && onLogCopy && !logging) {
      setLogging(true);
      try {
        await onLogCopy(editedContent);
      } catch (err) {
        console.error('Failed to log copy:', err);
      } finally {
        setLogging(false);
      }
    }
  }

  return (
    <div style={{ background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: warm.colors.accentPetrol }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {charLimit && (
            <span style={{ fontSize: 11, color: overLimit ? warm.colors.danger : warm.colors.textMuted, fontWeight: 600 }}>
              {charCount} / {charLimit}
            </span>
          )}
          <button
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
              border: `1px solid ${copied ? warm.colors.success : warm.colors.borderWhisper}`,
              background: copied ? 'rgba(52,211,153,0.1)' : 'transparent',
              color: copied ? warm.colors.success : warm.colors.textSecondary, cursor: 'pointer',
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {editableNote && (
        <p style={{ fontSize: 12, color: warm.colors.accentGold, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
          {editableNote}
        </p>
      )}

      <textarea
        value={editedContent}
        onChange={e => handleEdit(e.target.value)}
        rows={5}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${overLimit ? warm.colors.danger : warm.colors.borderWhisper}`,
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

const WARM_TEMPLATE = "Hey [name], I'm currently looking out for roles in [industry]. If you know of anything please let me know";

/* Start with people you already know: the fastest returns come from warm
   contacts, before any cold outreach to strangers. */
function WarmContactsCard() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(WARM_TEMPLATE);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div style={{ background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
      <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6, color: warm.colors.textPrimary }}>
        When networking in Australia your quickest returns will come from people you already know. Look through your
        existing contacts and reach out to people you already know that are working in your industry.
      </p>
      <p style={{ margin: '0 0 8px', fontSize: 13, color: warm.colors.textSecondary }}>Use this simple template:</p>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 10, padding: '12px 14px' }}>
        <p style={{ flex: 1, margin: 0, fontSize: 13.5, lineHeight: 1.6, color: warm.colors.textPrimary }}>
          {WARM_TEMPLATE}
        </p>
        <button
          onClick={handleCopy}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
            border: `1px solid ${copied ? warm.colors.success : warm.colors.borderWhisper}`,
            background: copied ? 'rgba(52,211,153,0.1)' : 'transparent',
            color: copied ? warm.colors.success : warm.colors.textSecondary, cursor: 'pointer',
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
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
  const [logging, setLogging] = useState(false);
  const [loggedThisGen, setLoggedThisGen] = useState(false);
  const [outreachLogId, setOutreachLogId] = useState<string | null>(null);
  // The connection note is touch 1, logged the moment the request goes out.
  // The first message can't be sent until the person accepts, so it and
  // everything after it log individually as the user actually sends them.
  const [nextTouchNumber, setNextTouchNumber] = useState(2);

  // Live draft bodies, mirrored from the template cards so edits are what
  // get persisted, not the original generated text.
  const draftsRef = useRef({ connectionNote: '', firstMessage: '', followUpDraft: '', directAskDraft: '', reContactDraft: '' });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  // Whether they have copied the connection note yet: the step between
  // "write it" and "I've sent it".
  const [noteCopied, setNoteCopied] = useState(false);

  /*
    The outreach loop (30 Oct 2026), the same shape as applying: one gold
    button in a bar at the bottom, and it is always the next thing to do.
      write  -> "Write my message"        (fill in who, then generate)
      copy   -> "Copy the connection note"
      send   -> "I've sent the request"   (logs it, counts toward today)
      next   -> "Next person"             (clears the form for the next one)
  */
  const formReady = !!(targetFirstName && targetCompany && targetTopicOrPost);
  const stage: 'write' | 'copy' | 'send' | 'next' = !outreach ? 'write'
    : loggedThisGen ? 'next' : noteCopied ? 'send' : 'copy';
  const queryClient = useQueryClient();
  const { data: goals } = useQuery({
    queryKey: ['tracker-goals'],
    queryFn: async () => (await api.get('/tracker/goals')).data as { outreach: { goal: number; done: number } },
    staleTime: 30_000,
  });

  async function copyNote() {
    const note = draftsRef.current.connectionNote || outreach?.connectionNote || '';
    try { await navigator.clipboard.writeText(note); } catch { /* the card's own Copy still works */ }
    setNoteCopied(true);
    toast.success('Copied. Paste it into your LinkedIn connection request, then come back and tick it off.');
  }

  function nextPerson() {
    setTargetFirstName(''); setTargetCompany(''); setTargetTopicOrPost(''); setSpecificQuestion('');
    setOutreach(null); setLoggedThisGen(false); setOutreachLogId(null); setNoteCopied(false);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 350);
  }

  // Jump to the drafts once they land. The form sits below the walkthrough and
  // the playbook, so on a laptop the results render well below the fold and it
  // reads as though nothing happened. Keyed on genId rather than outreach so a
  // regeneration scrolls back up to the new drafts too.
  useEffect(() => {
    if (!outreach || !resultsRef.current) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    resultsRef.current.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genId]);

  // Debounced draft save. Only runs once the outreach has been logged, since
  // before that there's no row to attach the drafts to.
  function queueDraftSave() {
    if (!outreachLogId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.patch(`/linkedin/outreach/${outreachLogId}/drafts`, draftsRef.current)
        .catch(() => { /* non-blocking: a failed autosave shouldn't interrupt writing */ });
    }, 900);
  }

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);


  function trackDraft(field: keyof typeof draftsRef.current) {
    return (body: string) => {
      draftsRef.current[field] = body;
      queueDraftSave();
    };
  }

  async function handleLogConnected() {
    if (logging || loggedThisGen || !outreach) return;
    setLogging(true);
    try {
      const { data } = await api.post('/linkedin/outreach/log', {
        personName: targetFirstName,
        company: targetCompany,
        topic: targetTopicOrPost,
        specificQuestion,
        ...draftsRef.current,
        firstMessageSent: false,
      });
      setOutreachLogId(data.entry.id);
      setLoggedThisGen(true);
      setNextTouchNumber(2);
      // Count it at once: the goals read takes a few seconds, and the bar
      // should tick the moment they say they sent it. The refetch confirms it.
      queryClient.setQueryData(['tracker-goals'], (g: any) => g?.outreach ? { ...g, outreach: { ...g.outreach, done: g.outreach.done + 1 } } : g);
      queryClient.invalidateQueries({ queryKey: ['tracker-goals'] });
      queryClient.invalidateQueries({ queryKey: ['tracker-goal'] });
      toast.success(`Saved: ${targetFirstName} at ${targetCompany}`);
    } catch {
      toast.error('Could not save this outreach. Try again.');
    } finally {
      setLogging(false);
    }
  }

  async function logNextTouch(body: string) {
    if (!outreachLogId) return;
    const touchNumber = nextTouchNumber;
    await api.post(`/linkedin/outreach/${outreachLogId}/copy`, { touchNumber, body });
    setNextTouchNumber(touchNumber + 1);
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
      draftsRef.current = {
        connectionNote: data.connectionNote ?? '',
        firstMessage: data.firstMessage ?? '',
        followUpDraft: data.afterConversationFollowUp ?? '',
        directAskDraft: data.directAsk ?? '',
        reContactDraft: data.reContact ?? '',
      };
      setGenId(g => g + 1);
      setNoteCopied(false);
      setLoggedThisGen(false);
      setOutreachLogId(null);
      setNextTouchNumber(2);
    } catch (err: any) {
      if (err?.response?.status === 402) {
        // PAYMENTS PAUSED: no longer redirecting to pricing - unlimited access active
        toast.error('Service temporarily unavailable. Please try again later.');
      } else {
        toast.error('Generation failed. Try again.');
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
    letterSpacing: '0.08em', color: warm.colors.textMuted, display: 'block', marginBottom: 6,
  };

  return (
    <div>
      {/*
        One guide, collapsed.

        Three blocks used to sit here: an annotated transcript, a strategy
        summary, and a seven step playbook. They said the same things three
        times in three voices, and between them they filled the screen above
        the tool people came here to use.
      */}

      {/* Input form: the one card on this tab the eye should land on. */}
      <div ref={formRef} style={{
        background: warm.colors.bgSurface, borderRadius: 18, padding: 24, marginBottom: 20, scrollMarginTop: 16,
        border: `2px solid ${stage === 'write' ? warm.colors.action : warm.colors.borderWhisper}`,
        boxShadow: stage === 'write' ? warm.shadow.focus : warm.shadow.card,
      }}>
        <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', color: warm.colors.textPrimary, margin: '0 0 4px' }}>
          Who are you reaching out to?
        </p>
        <p style={{ fontSize: 13.5, color: warm.colors.textMuted, margin: '0 0 16px' }}>
          Found someone above? Three details and we write the whole sequence.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label htmlFor="outFirstName" style={labelStyle}>First Name</label>
            <input id="outFirstName" ref={nameRef} value={targetFirstName} onChange={e => setTargetFirstName(e.target.value)} placeholder="Sarah" style={inputStyle} />
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
                    color: warm.colors.accentPetrol, cursor: 'pointer',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          className="agc-action"
          onClick={handleGenerate}
          disabled={!formReady || generating}
          style={{
            width: '100%', padding: '14px 0', minHeight: 50, borderRadius: 12,
            ...ACTION, border: 'none', fontWeight: 700, fontSize: 15.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {generating && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
          {generating ? 'Writing your messages…' : 'Write my message'}
        </button>
      </div>

      {outreach && (
        <>
          <div ref={resultsRef} aria-hidden style={{ scrollMarginTop: 16 }} />

          {/* Authenticity note */}
          <div style={{
            background: 'rgba(42,157,111,0.07)',
            border: '1px solid rgba(42,157,111,0.25)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 14,
          }}>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: warm.colors.textSecondary }}>
              <strong style={{ color: warm.colors.textPrimary }}>These are starting points, not scripts.</strong>{' '}
              Edit them until they sound like something you would actually say. A message in your own voice lands better than a polished one that isn't. Authenticity beats "perfection".
            </p>
          </div>

          <TemplateCard
            key={`${genId}-connectionNote`}
            label={TEMPLATE_LABELS.connectionNote}
            content={outreach.connectionNote}
            tip={COACHING_TIPS.connectionNote}
            charLimit={NOTE_LIMIT_FREE}
            onContentChange={trackDraft('connectionNote')}
          />

          {/* Written to 200 so it fits either account type without an edit. */}
          <p style={{
            margin: '-4px 0 14px', padding: '0 2px',
            fontSize: 11.5, lineHeight: 1.55, color: warm.colors.textMuted,
          }}>
            LinkedIn caps connection notes at <strong>200 characters</strong> on a free account
            and <strong>300</strong> on Premium. This one is written to 200, so it sends either way.
          </p>

          {/* Save point. Sits right after the connection note because that is
              the only message you can send before they accept. Everything
              below is a draft you'll come back to, sometimes days later. */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            background: loggedThisGen ? 'rgba(52,211,153,0.06)' : warm.colors.bgAlt,
            border: `1px solid ${loggedThisGen ? 'rgba(52,211,153,0.25)' : warm.colors.borderWhisper}`,
            borderRadius: 12, padding: '12px 16px', marginBottom: 14,
          }}>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: warm.colors.textSecondary }}>
              {loggedThisGen
                ? `Saved. All five drafts are stored against ${targetFirstName || 'this person'} in the Tracker tab. When they accept, open the Tracker to copy your first message. Edits here keep saving automatically.`
                : 'Sent the connection request? Save it now. All five drafts are stored so you can move on to the next person without losing this one.'}
            </p>
            <button
              onClick={handleLogConnected}
              disabled={logging || loggedThisGen}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                border: `1.5px solid ${loggedThisGen ? warm.colors.success : warm.colors.borderDefined}`,
                background: loggedThisGen ? 'rgba(52,211,153,0.1)' : '#FFFFFF',
                color: loggedThisGen ? warm.colors.success : warm.colors.accentPetrol,
                cursor: logging || loggedThisGen ? 'default' : 'pointer',
              }}
            >
              {logging ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                : loggedThisGen ? <Check size={13} /> : <UserCheck size={13} />}
              {loggedThisGen ? 'Saved' : "I've sent the request"}
            </button>
          </div>

          <TemplateCard
            key={`${genId}-firstMessage`}
            label={TEMPLATE_LABELS.firstMessage}
            content={outreach.firstMessage}
            tip={COACHING_TIPS.firstMessage}
            editableNote="You can't send this until they accept your request. Save the outreach above, then copy it from the Tracker tab once they do."
            logEnabled={loggedThisGen}
            onLogCopy={logNextTouch}
            onContentChange={trackDraft('firstMessage')}
          />
          <TemplateCard
            key={`${genId}-afterConversationFollowUp`}
            label={TEMPLATE_LABELS.afterConversationFollowUp}
            content={outreach.afterConversationFollowUp}
            tip={COACHING_TIPS.afterConversationFollowUp}
            editableNote="Send within 24 hours of any real exchange: a chat, a call, or a message thread. Fill in [THEIR_POINT] with something specific they actually said."
            logEnabled={loggedThisGen}
            onLogCopy={logNextTouch}
            onContentChange={trackDraft('followUpDraft')}
          />
          <TemplateCard
            key={`${genId}-directAsk`}
            label={TEMPLATE_LABELS.directAsk}
            content={outreach.directAsk}
            tip={COACHING_TIPS.directAsk}
            editableNote="Only needed if the first message didn't land the call. Wait until the conversation has moved on a bit, then ask again plainly. Zoom or Google Meet, never a phone number, and no reference to them not having replied."
            logEnabled={loggedThisGen}
            onLogCopy={logNextTouch}
            onContentChange={trackDraft('directAskDraft')}
          />
          <TemplateCard
            key={`${genId}-reContact`}
            label={TEMPLATE_LABELS.reContact}
            content={outreach.reContact}
            tip={COACHING_TIPS.reContact}
            editableNote="Diarise this for 3-4 weeks after your last exchange, whether or not they replied. Fill in [WHAT_I_DID] with something you actually did because of their advice. Attach no ask to it: that is the entire point."
            logEnabled={loggedThisGen}
            onLogCopy={logNextTouch}
            onContentChange={trackDraft('reContactDraft')}
          />
          {loggedThisGen && (
            <p style={{ fontSize: 11.5, color: warm.colors.textMuted, textAlign: 'center', margin: '4px 0 0' }}>
              Every message you copy from here on logs automatically to the Tracker tab.
            </p>
          )}
        </>
      )}

      {/* The warm-contacts template and the guide sit below the tool now, not
          above it: the form is step 2 straight after "find someone". */}
      <div style={{ marginTop: 28 }}>
        <WarmContactsCard />
        <NetworkingGuide />
      </div>

      {/* Follow-up reminders sit below the outreach tool, not above it. */}
      <div style={{ marginTop: 20 }}>
        <OutreachDueNudges compact />
      </div>

      {/* The action bar: today's count on the left, the one next step in gold. */}
      <div style={{
        position: 'sticky', bottom: 0, zIndex: 20, marginTop: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        padding: '12px 16px calc(12px + var(--safe-bottom, 0px))',
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        border: `1px solid ${warm.colors.borderDefined}`, borderRadius: 14,
        boxShadow: '0 -10px 24px -16px rgba(16,24,40,0.35)',
      }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: warm.colors.textSecondary }}>
          {goals ? `${goals.outreach.done} of ${goals.outreach.goal} outreach today` : ' '}
        </span>
        {stage === 'write' ? (
          <button className={formReady && !generating ? 'agc-action agc-action-live' : 'agc-action'}
            onClick={() => (formReady ? void handleGenerate() : nameRef.current?.focus())}
            disabled={generating}
            style={barBtn}>
            {generating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {generating ? 'Writing…' : formReady ? 'Write my message' : 'Fill in who they are'} {!generating && <ArrowRight size={16} />}
          </button>
        ) : stage === 'copy' ? (
          <button className="agc-action agc-action-live" onClick={() => void copyNote()} style={barBtn}>
            <Copy size={16} /> Copy the connection note
          </button>
        ) : stage === 'send' ? (
          <button className="agc-action agc-action-live" onClick={() => void handleLogConnected()} disabled={logging} style={barBtn}>
            {logging ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />} I've sent the request
          </button>
        ) : (
          <button className="agc-action agc-action-live" onClick={nextPerson} style={barBtn}>
            Next person <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

/** The bar's one button: gold, the biggest thing on the tab. */
const barBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 22px', minHeight: 48,
  ...ACTION, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
};
