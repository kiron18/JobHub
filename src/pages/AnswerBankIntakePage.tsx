/**
 * The story intake.
 *
 * One question at a time, with the guidance shown BEFORE they start talking.
 * That ordering is the whole design. Asked cold, "tell me about a failure"
 * reliably produces a disguised strength; told first that a disguised strength
 * is the one thing to avoid, most people go and find a real one.
 *
 * Nothing on this page writes an answer for anybody. The follow-up questions
 * come from the server, which checks them for leading the witness before they
 * are ever shown, and the cleaning step is proven to have only removed. What
 * the candidate confirms is what goes in the bank.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic, Square, Loader2, Check, SkipForward, ChevronLeft, ChevronRight,
  Pencil, AlertTriangle, RotateCcw, Download, Lightbulb, Ban, MessageSquare, BookOpen,
} from 'lucide-react';
import api from '../lib/api';

type QuestionState = 'unanswered' | 'in_progress' | 'awaiting_confirmation' | 'approved';

/** One model answer, in the four beats the interviewer scores. */
interface WorkedExample {
  where: string;
  situation: string;
  action: string;
  obstacle: string;
  outcome: string;
}

interface Turn { asked: string; said: string; reason?: string | null; probeSource?: string; at: string }

interface IntakeQuestion {
  index: number;
  id: string;
  kind: 'seed' | 'gap';
  themes: string[];
  ask: string;
  hints: { reach: string; shape: string; avoid: string };
  /** Ways into the memory. Retrieval keys, never content. */
  cues: string[];
  /** Worked examples, from work the reader almost certainly does not do. */
  examples: WorkedExample[];
  beats: { key: keyof Omit<WorkedExample, 'where'>; label: string }[];
  probes: string[];
  state: QuestionState;
  /** Already answered by another story. */
  covered: boolean;
  coveredBy: { theme: string; questionId: string }[];
  /** Worth having, but not part of the promised session. */
  optional: boolean;
  turns: Turn[];
  spoken: string | null;
  cleaned: string | null;
  approved: string | null;
  variants: Record<string, string> | null;
  followUps: number;
  outcome: string | null;
}

interface Intake {
  id: string;
  cursor: number;
  total: number;
  answered: number;
  /** Questions genuinely left. `total` is what was planned before they spoke. */
  live: number;
  optional: number;
  retired: number;
  minutesLeft: number;
  /** True once the bank answers what forms actually ask. */
  enough: boolean;
  coreMissing: string[];
  questions: IntakeQuestion[];
  completedAt: string | null;
}

/** What the page is doing right now. Only one of these can be true at a time. */
type Phase = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'cleaning' | 'cutting';

const errorText = (e: unknown, fallback: string) => {
  const res = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return res || fallback;
};

export default function AnswerBankIntakePage() {
  const [intake, setIntake] = useState<Intake | null>(null);
  const [loading, setLoading] = useState(true);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  /** The text for the turn in progress, before it is submitted. */
  const [draft, setDraft] = useState('');
  /** The follow-up the server asked, if it asked one. */
  const [probe, setProbe] = useState<string | null>(null);
  /** The editable confirmation text, once cleaning has run. */
  const [confirmText, setConfirmText] = useState('');
  /**
   * Which way in they picked. It narrows the question and nothing else: no cue
   * text ever reaches their answer, because the moment we put words in the box
   * we are writing the story instead of them.
   */
  const [cue, setCue] = useState<string | null>(null);
  /** What the last confirmed answer made unnecessary. */
  const [retired, setRetired] = useState<{ id: string; themes: string[] }[]>([]);
  const [cleanNote, setCleanNote] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const question = intake?.questions[index] ?? null;

  // ------------------------------------------------------------------- loading

  const load = useCallback(async () => {
    try {
      const [{ data }, caps] = await Promise.all([
        api.get('/answer-bank'),
        api.get('/answer-bank/capabilities').catch(() => ({ data: { voice: false } })),
      ]);
      setVoiceAvailable(Boolean(caps.data?.voice));
      if (data.intake) {
        setIntake(data.intake);
        setIndex(Math.min(data.intake.cursor, data.intake.questions.length - 1));
      }
    } catch (e) {
      setError(errorText(e, 'Could not load your intake.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // When the question changes, the page starts clean. Carrying a half-typed
  // answer across to a different question is how an answer lands on the wrong one.
  useEffect(() => {
    setDraft('');
    setProbe(null);
    setCue(null);
    setCleanNote(null);
    setConfirmText(question?.approved || question?.cleaned || '');
  }, [question?.id]);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/answer-bank/start', {});
      setIntake(data.intake);
      setIndex(Math.min(data.intake.cursor, data.intake.questions.length - 1));
    } catch (e) {
      setError(errorText(e, 'Could not build your questions.'));
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------------- recording

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        await sendAudio(new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' }));
      };
      mr.start();
      recorder.current = mr;
      setPhase('recording');
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError('The microphone could not be opened. Check the browser permission, or type your answer instead.');
    }
  };

  const stopRecording = () => {
    recorder.current?.stop();
    recorder.current = null;
    setPhase('transcribing');
  };

  const sendAudio = async (blob: Blob) => {
    try {
      const form = new FormData();
      form.append('audio', blob, 'answer.webm');
      const { data } = await api.post('/answer-bank/transcribe', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Appended, never replaced: a second recording on the same turn is somebody
      // adding to what they said, not starting over.
      setDraft((d) => (d ? `${d} ${data.text}` : data.text));
    } catch (e) {
      setError(errorText(e, 'That recording could not be transcribed. You can type the answer instead.'));
    } finally {
      setPhase('idle');
    }
  };

  // ------------------------------------------------------------------ the turn

  const submitTurn = async () => {
    setRetired([]);
    if (!question || !draft.trim()) return;
    setPhase('thinking');
    setError(null);
    try {
      const { data } = await api.post('/answer-bank/answer', { questionId: question.id, text: draft });
      setDraft('');

      if (data.action === 'probe') {
        setProbe(data.probe);
        setPhase('idle');
        await refreshQuestion();
        return;
      }

      setProbe(null);
      await runClean();
    } catch (e) {
      setError(errorText(e, 'That answer could not be saved.'));
      setPhase('idle');
    }
  };

  const runClean = async () => {
    if (!question) return;
    setPhase('cleaning');
    try {
      const { data } = await api.post('/answer-bank/clean', { questionId: question.id });
      setConfirmText(data.cleaned);
      setCleanNote(
        data.rejected
          ? 'The tidy-up was rejected for changing your words, so you are seeing a plainer clean of exactly what you said.'
          : null,
      );
      await refreshQuestion();
    } catch (e) {
      setError(errorText(e, 'The tidy-up failed. Your words are safe, try again.'));
    } finally {
      setPhase('idle');
    }
  };

  const approve = async () => {
    if (!question || !confirmText.trim()) return;
    setPhase('cutting');
    setError(null);
    try {
      const { data } = await api.post('/answer-bank/approve', {
        questionId: question.id, text: confirmText,
      });
      await api.post('/answer-bank/variants', { questionId: question.id }).catch(() => null);
      const { data: fresh } = await api.get('/answer-bank');
      if (fresh.intake) setIntake(fresh.intake);
      // The server has already worked out which question is worth asking next,
      // stepping over anything this answer just covered. Following its cursor
      // rather than index + 1 is what stops somebody being asked about teamwork
      // ninety seconds after they described relying on their whole team.
      setRetired(data.retired || []);
      const next = typeof data.cursor === 'number' ? data.cursor : question.index + 1;
      setIndex(Math.min(next, (fresh.intake?.questions.length ?? 1) - 1));
    } catch (e) {
      setError(errorText(e, 'That answer could not be confirmed.'));
    } finally {
      setPhase('idle');
    }
  };

  const skip = async () => {
    if (!question) return;
    await api.post('/answer-bank/skip', { questionId: question.id }).catch(() => null);
    await load();
    setIndex((i) => Math.min(i + 1, (intake?.questions.length ?? 1) - 1));
  };

  const reopen = async () => {
    if (!question) return;
    setConfirmText(question.approved || question.cleaned || '');
  };

  const refreshQuestion = async () => {
    const { data } = await api.get('/answer-bank');
    if (data.intake) setIntake(data.intake);
  };

  const download = async () => {
    const { data } = await api.get('/answer-bank/export');
    const blob = new Blob([JSON.stringify(data.bank, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'answer-bank.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Measured against the work that remains, not the plan as first written.
  // A story that retires three questions has to move this bar by more than one
  // notch, or the number contradicts what the page just told them.
  const progress = useMemo(() => {
    if (!intake) return 0;
    const done = intake.answered + intake.retired;
    return Math.round((done / Math.max(done + intake.live, 1)) * 100);
  }, [intake]);

  const busy = phase !== 'idle' && phase !== 'recording';

  // ------------------------------------------------------------------ rendering

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  if (!intake) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold text-slate-900">Build your answer bank</h1>
        <p className="mt-4 text-slate-600 leading-relaxed">
          Application forms keep asking the same handful of open-ended questions, worded differently
          every time. This is the session where you tell those stories once, in your own words, so
          you never write them from scratch again.
        </p>
        <p className="mt-4 text-slate-600 leading-relaxed">
          It is a conversation, not a form. You talk, it asks you the follow-up a coach would ask,
          and you confirm the words before anything is saved. Nothing is written for you.
        </p>
        <p className="mt-4 text-slate-600 leading-relaxed">
          Most people are done in about fifteen minutes. It is usually five or six
          questions, because a good story answers several at once and the ones it
          covers get dropped as you go.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          You can stop at any point and pick up where you left off. A half-finished
          bank still fills in forms.
        </p>
        {error && <ErrorLine text={error} />}
        <button
          onClick={start}
          className="mt-8 rounded-lg bg-slate-900 px-5 py-3 text-white font-medium hover:bg-slate-800"
        >
          Start
        </button>
      </div>
    );
  }

  if (!question) return null;

  const showConfirm = confirmText.length > 0 && !probe;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* progress, counted forwards
          "Question 1 of 12" is a debt. It is also wrong the moment a story
          covers three themes at once, and it was the number people were
          looking at when they gave up. This counts what they have banked and
          what is honestly left, which shrinks faster than one a turn. */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">
          {intake.answered === 0
            ? `${intake.live} ${intake.live === 1 ? 'question' : 'questions'}, about ${intake.minutesLeft} minutes`
            : `${intake.answered} ${intake.answered === 1 ? 'story' : 'stories'} banked`}
        </span>
        <span className="text-slate-500">
          {intake.live === 0
            ? 'Nothing left to ask'
            : `${intake.live} to go, about ${intake.minutesLeft} min`}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
        <div className="h-1.5 rounded-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* what the last answer saved them */}
      {retired.length > 0 && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <span className="font-medium">That one covered more than it asked.</span>{' '}
          You also answered {readableList(retired.map((r) => r.themes[0]).filter(Boolean))}, so
          {retired.length === 1 ? ' that question is' : ' those questions are'} done.
        </div>
      )}

      {/* the finishing line, once the bank answers what forms actually ask */}
      {intake.enough && (
        <div className="mt-4 rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-700">
          <span className="font-medium text-slate-900">You have enough to work with.</span>{' '}
          Your bank now covers the questions application forms ask most often.
          {intake.optional > 0 && ` The ${intake.optional} left are worth having, but they can wait for another day.`}
        </div>
      )}

      {/* the question */}
      <div className="mt-8">
        {question.kind === 'gap' && question.themes[0] && (
          <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
            {question.themes[0]}
          </span>
        )}
        <h1 className="mt-3 text-xl font-semibold leading-snug text-slate-900">{question.ask}</h1>
      </div>

      {/* the way in
          The blank box is where this loses people, and the reason is search,
          not effort: scanning four years of work against an abstract category
          is hard, and the honest result is "I cannot think of one". A cue
          names a small set to look in. It never says what happened in it. */}
      {question.cues.length > 0 && question.state !== 'approved' && (
        <div className="mt-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Which one? Pick whichever comes to mind first
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {question.cues.map((c) => (
              <button
                key={c}
                onClick={() => setCue(cue === c ? null : c)}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                  cue === c
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 text-slate-700 hover:border-slate-500 hover:bg-slate-50'
                }`}
              >
                {c}
              </button>
            ))}
            <button
              onClick={() => setCue(null)}
              className="px-2 py-1.5 text-sm text-slate-400 hover:text-slate-700"
            >
              I have a different one
            </button>
          </div>
          {cue && (
            <p className="mt-3 text-sm text-slate-600">
              Good. Tell me about <span className="font-medium text-slate-900">{lowerFirst(cue)}</span>.
              Start wherever it starts.
            </p>
          )}
        </div>
      )}

      {/* the hints, before they speak, never after
          Collapsed by default for the warm-up questions: they carry the same
          three lines every time, so by the second screen they are wallpaper.
          A themed question's hints are written for it and stay open. */}
      <HintPanel key={question.id} hints={question.hints} openByDefault={question.kind === 'gap'} />

      {/* what one sounds like
          The hints say what to reach for. They do not help somebody who has
          never heard an answer of this kind and so has no idea of its SHAPE.
          Three of them, collapsed, from work the reader almost certainly does
          not do: close enough to copy the structure, too far to copy the story. */}
      {question.examples?.length > 0 && question.state !== 'approved' && (
        <Examples key={question.id} examples={question.examples} beats={question.beats} />
      )}

      {/* what has already been said this question */}
      {question.spoken && !showConfirm && (
        <div className="mt-6 rounded-xl border border-slate-200 p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">So far</div>
          <p className="mt-2 whitespace-pre-wrap text-slate-700 leading-relaxed">{question.spoken}</p>
        </div>
      )}

      {/* the follow-up */}
      {probe && (
        <div className="mt-6 rounded-xl border-l-4 border-slate-900 bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">One more thing</div>
          <p className="mt-2 text-lg leading-snug text-slate-900">{probe}</p>
        </div>
      )}

      {error && <ErrorLine text={error} />}

      {/* answering */}
      {!showConfirm && (
        <div className="mt-6">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={voiceAvailable
              ? 'Press record and talk, or type it here.'
              : 'Type your answer here.'}
            rows={7}
            className="w-full resize-y rounded-xl border border-slate-300 p-4 text-slate-800 leading-relaxed focus:border-slate-900 focus:outline-none"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {voiceAvailable && (phase === 'recording' ? (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 font-medium text-white hover:bg-red-700"
              >
                <Square size={16} /> Stop ({String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')})
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={busy}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-40"
              >
                <Mic size={16} /> {draft ? 'Add more by voice' : 'Record'}
              </button>
            ))}

            <button
              onClick={submitTurn}
              disabled={!draft.trim() || busy || phase === 'recording'}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              {phase === 'transcribing' ? 'Writing it down' : phase === 'thinking' ? 'Reading it' : phase === 'cleaning' ? 'Tidying' : 'Done answering'}
            </button>

            <button onClick={skip} className="flex items-center gap-2 px-2 py-2.5 text-sm text-slate-500 hover:text-slate-800">
              <SkipForward size={15} /> Nothing for this one
            </button>
          </div>

          {!voiceAvailable && (
            <p className="mt-3 text-xs text-slate-500">
              Voice answers are switched off on this server. Typing works exactly the same way.
            </p>
          )}
        </div>
      )}

      {/* confirming */}
      {showConfirm && (
        <div className="mt-6">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Pencil size={15} /> Your words, tidied. Change anything that is not right.
          </div>

          {cleanNote && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{cleanNote}</span>
            </div>
          )}

          <textarea
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            rows={10}
            className="mt-3 w-full resize-y rounded-xl border border-slate-300 p-4 text-slate-800 leading-relaxed focus:border-slate-900 focus:outline-none"
          />

          {question.spoken && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-800">
                See exactly what you said
              </summary>
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                {question.spoken}
              </p>
            </details>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={approve}
              disabled={!confirmText.trim() || busy}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              {phase === 'cutting' ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              {question.state === 'approved' ? 'Save changes' : 'This is right, save it'}
            </button>
            <button
              onClick={() => { setConfirmText(''); setDraft(question.spoken || ''); }}
              className="flex items-center gap-2 px-2 py-2.5 text-sm text-slate-500 hover:text-slate-800"
            >
              <RotateCcw size={15} /> Say it again
            </button>
          </div>
        </div>
      )}

      {/* moving around */}
      <div className="mt-10 flex items-center justify-between border-t border-slate-200 pt-6">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 disabled:opacity-30"
        >
          <ChevronLeft size={16} /> Previous
        </button>

        {question.state === 'approved' && !showConfirm && (
          <button onClick={reopen} className="text-sm text-slate-500 hover:text-slate-800">
            Edit this answer
          </button>
        )}

        <button
          onClick={() => setIndex((i) => Math.min(intake.questions.length - 1, i + 1))}
          disabled={index >= intake.questions.length - 1}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 disabled:opacity-30"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>

      {intake.answered > 0 && (
        <div className="mt-8 rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-slate-900">
                {intake.answered} {intake.answered === 1 ? 'story' : 'stories'} banked
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Load this into the form assistant extension to answer applications with it.
              </p>
            </div>
            <button
              onClick={download}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <Download size={15} /> Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The guidance, before they speak and never after.
 *
 * Open for a themed question, where the `avoid` line is load-bearing: told
 * cold, "tell me about a failure" reliably returns a disguised strength, and
 * warning them off it first is what stops that. Closed for the warm-ups, whose
 * three lines are identical every time and stop being read on sight.
 */
function HintPanel({ hints, openByDefault }: { hints: { reach: string; shape: string; avoid: string }; openByDefault: boolean }) {
  // Remounted per question by its `key`, so the open state resets with the
  // question rather than being pushed back by an effect.
  const [open, setOpen] = useState(openByDefault);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-5 text-sm text-slate-500 underline underline-offset-4 hover:text-slate-800"
      >
        How do I answer this?
      </button>
    );
  }

  return (
    <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
      <Hint icon={<Lightbulb size={15} />} label="Reach for" text={hints.reach} />
      <Hint icon={<MessageSquare size={15} />} label="How to say it" text={hints.shape} />
      <Hint icon={<Ban size={15} />} label="Avoid" text={hints.avoid} tone="warn" />
    </div>
  );
}

/**
 * Three worked answers, shut until asked for.
 *
 * Collapsed matters as much as the content. Somebody who knows what to say
 * should never be shown a model answer, because the one thing worse than a
 * blank is a blank filled with somebody else's story. Opening it is a
 * deliberate act by a person who is stuck.
 *
 * Shown in labelled beats rather than as a paragraph, because the beats ARE
 * the lesson. A paragraph invites copying; four labelled parts invite you to
 * fill them with your own. Each is a real answer that passes the same audit
 * the follow-up questions run, so nobody is shown a shape we would reject.
 */
function Examples({ examples, beats }: { examples: WorkedExample[]; beats: IntakeQuestion['beats'] }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(0);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-500 hover:bg-slate-50"
      >
        <BookOpen size={15} />
        Stuck? See what an answer like this sounds like
      </button>
    );
  }

  const example = examples[shown];

  return (
    <div className="mt-4 rounded-xl border border-slate-300 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          An example, from a different job
        </div>
        <button onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-700">
          Hide
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((e, i) => (
          <button
            key={e.where}
            onClick={() => setShown(i)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              i === shown
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 text-slate-600 hover:border-slate-500'
            }`}
          >
            {e.where}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {beats.map((beat) => (
          <div key={beat.key} className="grid grid-cols-[9rem_1fr] gap-3 max-sm:grid-cols-1 max-sm:gap-1">
            <div className="text-sm font-medium text-slate-500">{beat.label}</div>
            <p className="text-sm leading-relaxed text-slate-800">{example[beat.key]}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-500">
        Yours will be about something completely different. Copy the four parts, not the story.
      </p>
    </div>
  );
}

/** "failure, teamwork and conflict" rather than "failure,teamwork,conflict". */
function readableList(items: string[]): string {
  if (items.length <= 1) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Cues are written to start a sentence; here they sit mid-one. */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function Hint({ icon, label, text, tone }: { icon: React.ReactNode; label: string; text: string; tone?: 'warn' }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 shrink-0 ${tone === 'warn' ? 'text-amber-600' : 'text-slate-400'}`}>{icon}</span>
      <div className="text-sm leading-relaxed">
        <span className="font-medium text-slate-700">{label}: </span>
        <span className="text-slate-600">{text}</span>
      </div>
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
