/**
 * Video cover letter (V1). The candidate shoots, edits and uploads it
 * themselves, following our steps. We only write the script.
 *
 * The first video is GENERIC and goes to any company. Line 1 is the only line
 * that changes per company: from a job ad (pasted, or one in their tracker) we
 * write a personalised opening of 3 lines, following the formula from Kiron's
 * own videos that got him hired (role and company, the job described back in
 * their words, one real proof point). Those clips swap into the saved edit. Easy-to-recreate
 * background and outfit is what makes that swap blend in.
 *
 * Keep the steps short. This is a baseline of simplicity, not a video course.
 * No AI in the video itself: the point of the video is the human part.
 */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Loader2, Square, Volume2 } from 'lucide-react';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';
import type { JobApplication } from '../types';

const STORAGE_KEY = 'jobhub.videoScript.v3';

/** Kiron's own job-hunt videos (unlisted on YouTube). Section hides while empty. */
const EXAMPLE_VIDEOS: { id: string; title: string; note: string }[] = [
  { id: 'csIgK70H18Q', title: 'Australia Events', note: 'The one that got me hired. Name, credentials, then the job described back in my own words.' },
  { id: 'xsLvfNfQsVI', title: 'Visionary Digital', note: 'Got me an interview. I picked one line from their ad and said why it mattered to me.' },
  { id: 'glImgA7eVfo', title: 'Edge Marketing', note: 'Shot simply at home. This is the level you need.' },
];

interface Script { firstName: string; lines: string[] }
interface Personalised { role: string; company: string; lines: string[] }

const BACKGROUND_TIPS = [
  'Clean background. Aesthetic is nice, a plain blank wall is enough.',
  'Face a window or a lamp. Never sit with the light behind you.',
  'Quiet room, nobody walking around.',
  'Got a mic? Use it. No mic is fine, Edits can clean up your audio.',
  'Pick a spot and outfit you can easily recreate, so you can reshoot line 1 for other companies later.',
];

const WARMUP_STEPS = [
  'Sit in your spot. Take a few deep breaths. Drink a glass of water.',
  'Read the whole script out loud, loudly and clearly, at least 10 times.',
  "You're not memorising it. You're warming your mouth up to say these exact words, loudly and confidently.",
];

const CAMERA_TIPS = [
  'Use your phone. A tripod is great, but anywhere steady works.',
  'Front or back camera, either is fine. Look into the lens, not at yourself.',
];

const PER_LINE_STEPS = [
  'Read the line. Say it out loud 2 or 3 times.',
  'Hit record. Pause for a second, say the line, pause again.',
  'Hit stop. That\'s one clip. Tick it off below and move to the next line.',
];

const EDIT_STEPS = [
  'Download Edits by Meta (free). Drop your clips in, in order.',
  'Use Cut Silences to remove the gaps between lines. That\'s your video.',
  'Optional: Captions to add subtitles automatically, voice enhancement to clean up the audio, and text or image overlays if you like.',
  'Keep the project in your drafts. That way you can swap in a personalised opening later.',
];

const SEND_STEPS = [
  'Upload to YouTube as Unlisted.',
  'Paste the link in your application email, cover letter or LinkedIn message.',
];

function loadSaved(): Script | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.firstName === 'string' && Array.isArray(parsed.lines) ? parsed : null;
  } catch {
    return null;
  }
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  return voices.find(v => v.lang === 'en-AU')
    ?? voices.find(v => v.lang.startsWith('en'))
    ?? null;
}

export function VideoCoverLetterPage() {
  const [script, setScript] = useState<Script | null>(loadSaved);
  const [adSource, setAdSource] = useState<'tracker' | 'paste'>('tracker');
  const [jobId, setJobId] = useState('');
  const [adText, setAdText] = useState('');
  const [personal, setPersonal] = useState<Personalised | null>(null);
  const [personalising, setPersonalising] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Voices load async in Chrome; touching getVoices early warms the list.
  useEffect(() => {
    if (!canSpeak) return;
    window.speechSynthesis.getVoices();
    return () => window.speechSynthesis.cancel();
  }, [canSpeak]);

  // Only jobs with a real ad in them can be personalised from.
  const { data: jobs = [] } = useQuery<JobApplication[]>({
    queryKey: ['jobs'],
    queryFn: async () => (await api.get('/jobs')).data,
    enabled: Boolean(script),
  });
  const jobsWithAds = jobs.filter(j => (j.description || '').trim().length >= 150);
  const source = jobsWithAds.length ? adSource : 'paste';

  // The opening: the personalised lines when there are some, otherwise the generic line 1.
  const opening = !script ? [] : personal
    ? personal.lines
    : [`Hi, I'm ${script.firstName}, and this is my video cover letter for this role.`];
  const allLines = script ? [...opening, ...script.lines] : [];

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<Script>('/analyze/video-script');
      setScript(data);
      setPersonal(null);
      setDone(new Set());
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* per-device convenience only */ }
    } catch (err: any) {
      setError(err?.response?.data?.error === 'NO_RESUME'
        ? 'We need your resume first. Upload it in your profile, then come back.'
        : 'Something went wrong writing your script. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  async function personalise() {
    if (!script) return;
    setPersonalising(true);
    setPersonalError(null);
    try {
      const body = source === 'tracker'
        ? { jobApplicationId: jobId, masterLines: script.lines }
        : { jobDescription: adText, masterLines: script.lines };
      const { data } = await api.post<Personalised>('/analyze/video-script/personalise', body);
      setPersonal(data);
      setDone(new Set());
    } catch (err: any) {
      setPersonalError(err?.response?.data?.error === 'NO_AD'
        ? 'That ad is too short to work from. Paste the full job ad.'
        : 'Something went wrong. Try again in a moment.');
    } finally {
      setPersonalising(false);
    }
  }

  function play(idx: number) {
    if (!canSpeak) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    if (speaking === idx) { setSpeaking(null); return; }
    const u = new SpeechSynthesisUtterance(allLines[idx]);
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.rate = 0.9;
    u.onend = () => setSpeaking(s => (s === idx ? null : s));
    u.onerror = () => setSpeaking(s => (s === idx ? null : s));
    setSpeaking(idx);
    synth.speak(u);
  }

  function toggleDone(idx: number) {
    setDone(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(allLines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked; the lines are on screen anyway */ }
  }

  const c = warm.colors;
  const card: React.CSSProperties = {
    border: `1px solid ${c.borderWhisper}`,
    borderRadius: warm.radius.card,
    padding: 20,
    marginBottom: 20,
    background: c.bgSurface,
  };
  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    minHeight: 44, padding: '0 18px',
    borderRadius: warm.radius.button, border: 'none',
    background: c.accentPetrol, color: '#fff',
    ...warm.text.body, fontWeight: 600, cursor: 'pointer',
  };
  const iconBtn: React.CSSProperties = {
    width: 40, height: 40, flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: warm.radius.button, cursor: 'pointer',
    border: `1px solid ${c.borderDefined}`, background: c.bgSurface, color: c.accentPetrol,
  };
  const input: React.CSSProperties = {
    flex: '1 1 180px', minWidth: 0, minHeight: 44, padding: '0 12px',
    borderRadius: warm.radius.input, border: `1px solid ${c.borderDefined}`,
    ...warm.text.body, color: c.textPrimary, background: c.bgSurface,
  };
  const linkBtn: React.CSSProperties = {
    ...warm.text.small, display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40,
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  };
  const lead: React.CSSProperties = { ...warm.text.body, margin: '0 0 12px', color: c.textSecondary };
  const needScript = <p style={{ ...warm.text.small, margin: '12px 0 0', color: c.textMuted }}>Generate your script in Step 2 first.</p>;

  const StepList = ({ items, ordered }: { items: string[]; ordered?: boolean }) => {
    const Tag = ordered ? 'ol' : 'ul';
    return (
      <Tag style={{ margin: 0, paddingLeft: 20, ...warm.text.body, color: c.textSecondary }}>
        {items.map((t, i) => <li key={i} style={{ marginBottom: 6 }}>{t}</li>)}
      </Tag>
    );
  };

  const StepHeading = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <h2 style={{ ...warm.text.h3, margin: '0 0 12px', color: c.textPrimary }}>
      <span style={{ color: c.accentPetrol }}>Step {n}.</span> {children}
    </h2>
  );

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 4px 80px' }}>
      <Link
        to="/"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          ...warm.text.small, color: c.textSecondary, textDecoration: 'none',
          padding: '10px 0', margin: '0 0 22px', minHeight: 40,
        }}
      >
        <ArrowLeft size={14} />
        Back to dashboard
      </Link>

      <h1 style={{ ...warm.text.h1, margin: '0 0 12px', color: c.textPrimary }}>
        Your video cover letter
      </h1>
      <p style={lead}>
        A video cover letter is a great way to stand out from the crowd. It's one of the methods I used
        to land my first job. Once I was hired, my employers told me this single thing stood out and
        piqued their interest, and I've had several interviews simply because I did it.
      </p>
      <p style={lead}>
        It's powerful, but it can take a lot of time and effort. Here's how to do it efficiently:
        a result that impresses, and that you can personalise when a role is worth it.
      </p>
      <p style={lead}>
        <strong style={{ color: c.textPrimary }}>We start with one generic video you can send to any company.</strong>{' '}
        It's better to have something than to endlessly build systems that give you nothing.
        Line 1 is the one line you'll swap later to personalise it.
      </p>
      <p style={{ ...warm.text.small, margin: '0 0 24px', padding: '10px 14px', borderRadius: warm.radius.input, background: c.accentGoldSoft, color: c.textPrimary }}>
        This is extracurricular. Do your outreach and applications first, then spend time on this.
      </p>

      {EXAMPLE_VIDEOS.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ ...warm.text.h3, margin: '0 0 6px', color: c.textPrimary }}>Examples from my own job hunt</h2>
          <p style={{ ...warm.text.small, margin: '0 0 14px', color: c.textMuted }}>
            Mine run close to two minutes, and I was a video producer, so there's editing you don't need.
            Aim for one minute and a plain talking head.
          </p>
          {EXAMPLE_VIDEOS.map(v => (
            <div key={v.id} style={{ marginBottom: 18 }}>
              <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: warm.radius.card, overflow: 'hidden', background: c.bgAlt }}>
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${v.id}?rel=0`}
                  title={`Example video cover letter: ${v.title}`}
                  loading="lazy"
                  allow="encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                />
              </div>
              <p style={{ ...warm.text.small, margin: '8px 0 0', color: c.textSecondary }}>
                <strong style={{ color: c.textPrimary }}>{v.title}.</strong> {v.note}
              </p>
            </div>
          ))}
        </section>
      )}

      <section style={card}>
        <StepHeading n={1}>Set your background</StepHeading>
        <StepList items={BACKGROUND_TIPS} />
      </section>

      <section style={card}>
        <StepHeading n={2}>Get your script</StepHeading>
        <p style={lead}>Written from your resume, under a minute, one sentence per line.</p>

        {!script && (
          <button style={btn} onClick={generate} disabled={loading}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Writing your script...' : 'Generate my script'}
          </button>
        )}

        {error && <p style={{ ...warm.text.small, color: c.danger, margin: '12px 0 0' }}>{error}</p>}

        {script && (
          <>
            <ol style={{ margin: 0, paddingLeft: 22, ...warm.text.body, color: c.textPrimary }}>
              {allLines.map((line, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  {line}
                  {i < opening.length && (
                    <span style={{ ...warm.text.micro, color: c.accentGold, marginLeft: 8, whiteSpace: 'nowrap' }}>
                      {personal ? 'Personalised' : 'Swappable'}
                    </span>
                  )}
                </li>
              ))}
            </ol>

            <div style={{ background: c.bgAlt, borderRadius: warm.radius.input, padding: 14, margin: '16px 0 0' }}>
              {personal ? (
                <>
                  <p style={{ ...warm.text.small, margin: 0, color: c.textPrimary }}>
                    <strong>Personalised for {personal.role} at {personal.company}.</strong> Shoot the
                    first {personal.lines.length} lines as new clips and swap them in for line 1 in your saved edit.
                  </p>
                  <button onClick={() => { setPersonal(null); setDone(new Set()); }} style={{ ...linkBtn, color: c.textSecondary }}>
                    Back to the generic version
                  </button>
                </>
              ) : (
                <>
                  <p style={{ ...warm.text.small, margin: '0 0 4px', color: c.textPrimary }}>
                    <strong>Want to personalise it for a job you really want?</strong>
                  </p>
                  <p style={{ ...warm.text.small, margin: '0 0 10px', color: c.textSecondary }}>
                    We'll swap line 1 for three lines: the role and company, what the job involves in
                    your words, and one real thing from your resume that matches. That "I read your ad"
                    part is what got my videos noticed.
                  </p>
                  {jobsWithAds.length > 0 && (
                    <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                      {(['tracker', 'paste'] as const).map(k => (
                        <button
                          key={k}
                          onClick={() => setAdSource(k)}
                          style={{ ...linkBtn, color: source === k ? c.accentPetrol : c.textSecondary, fontWeight: source === k ? 600 : 400 }}
                        >
                          {k === 'tracker' ? 'A job in my tracker' : 'Paste a job ad'}
                        </button>
                      ))}
                    </div>
                  )}
                  {source === 'tracker' ? (
                    <select style={{ ...input, width: '100%' }} value={jobId} onChange={e => setJobId(e.target.value)}>
                      <option value="">Choose a job...</option>
                      {jobsWithAds.map(j => <option key={j.id} value={j.id}>{j.title} at {j.company}</option>)}
                    </select>
                  ) : (
                    <textarea
                      style={{ ...input, width: '100%', minHeight: 120, padding: 12, resize: 'vertical' }}
                      placeholder="Paste the full job ad here"
                      value={adText}
                      onChange={e => setAdText(e.target.value)}
                    />
                  )}
                  <button
                    style={{ ...btn, marginTop: 10 }}
                    onClick={personalise}
                    disabled={personalising || (source === 'tracker' ? !jobId : adText.trim().length < 150)}
                  >
                    {personalising && <Loader2 size={16} className="animate-spin" />}
                    {personalising ? 'Writing your opening...' : 'Personalise my opening'}
                  </button>
                  {personalError && <p style={{ ...warm.text.small, color: c.danger, margin: '8px 0 0' }}>{personalError}</p>}
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
              <button onClick={copyScript} style={{ ...linkBtn, color: c.accentPetrol }}>
                <Copy size={14} /> {copied ? 'Copied' : 'Copy script'}
              </button>
              <button onClick={generate} disabled={loading} style={{ ...linkBtn, color: c.textSecondary }}>
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Rewriting...' : 'Write a new version'}
              </button>
            </div>
          </>
        )}
      </section>

      <section style={card}>
        <StepHeading n={3}>Warm up</StepHeading>
        <StepList items={WARMUP_STEPS} />
      </section>

      <section style={card}>
        <StepHeading n={4}>Shoot, one line at a time</StepHeading>
        <StepList items={CAMERA_TIPS} />
        <p style={{ ...warm.text.body, margin: '14px 0 8px', color: c.textPrimary, fontWeight: 600 }}>For every line:</p>
        <StepList items={PER_LINE_STEPS} ordered />

        {!script ? needScript : (
          <>
            <p style={{ ...warm.text.small, margin: '16px 0 4px', color: c.textMuted }}>
              {canSpeak ? 'Stuck on a line? Press play to hear it.' : 'Stuck on a line? Have a friend read it to you.'}
            </p>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {allLines.map((line, i) => {
                const isDone = done.has(i);
                return (
                  <li key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 0',
                    borderTop: i ? `1px solid ${c.borderWhisper}` : 'none',
                  }}>
                    {canSpeak && (
                      <button style={iconBtn} onClick={() => play(i)} aria-label={speaking === i ? 'Stop' : `Play line ${i + 1}`}>
                        {speaking === i ? <Square size={14} /> : <Volume2 size={16} />}
                      </button>
                    )}
                    <span style={{
                      flex: 1, ...warm.text.body,
                      color: isDone ? c.textMuted : c.textPrimary,
                      textDecoration: isDone ? 'line-through' : 'none',
                    }}>
                      <span style={{ color: c.textMuted, marginRight: 6 }}>{i + 1}.</span>{line}
                    </span>
                    <button
                      style={{ ...iconBtn, ...(isDone ? { background: c.success, borderColor: c.success, color: '#fff' } : { color: c.textMuted }) }}
                      onClick={() => toggleDone(i)}
                      aria-label={isDone ? `Unmark line ${i + 1}` : `Mark line ${i + 1} as shot`}
                    >
                      <Check size={16} />
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>

      <section style={card}>
        <StepHeading n={5}>Edit</StepHeading>
        <StepList items={EDIT_STEPS} />
      </section>

      <section style={card}>
        <StepHeading n={6}>Send it</StepHeading>
        <StepList items={SEND_STEPS} />
      </section>
    </div>
  );
}
