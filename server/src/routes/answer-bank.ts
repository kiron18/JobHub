/**
 * The story intake, and the bank it produces.
 *
 * Every route here obeys one rule: the model never writes an answer. It reads
 * what the candidate said and decides what to ask next, and it removes filler
 * from what they said. Both of those are verified after the fact rather than
 * merely instructed, in services/answerBank/interviewer.ts and clean.ts.
 *
 * The bank this builds feeds two things: the browser extension that fills in
 * application forms, and (next) the interview tab, which today generates
 * answers off the resume and should be selecting these instead.
 */
import { Router, Response } from 'express';
import multer from 'multer';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { callLLM } from '../services/llm';
import {
  planIntake, buildScaffold, hintsFor, cuesFor, describeSeed,
  type Plan, type Question, type Seed,
} from '../services/answerBank/intake';
import { examplesFor, BEATS } from '../services/answerBank/examples';
import {
  buildCoverage, isRedundant, isOptional, coreStatus, minutesFor,
  type BankedAnswer, type Coverage,
} from '../services/answerBank/coverage';
import {
  decideTurn, buildProbePrompt, chooseProbe, MAX_FOLLOW_UPS,
  type ProbeReason,
} from '../services/answerBank/interviewer';
import {
  stripFillers, checkSubtractive, checkVariant, CLEAN_PROMPT,
  buildVariantPrompt, VARIANT_SPEC, type VariantName,
} from '../services/answerBank/clean';
import {
  transcribe, transcriptionConfigured, TranscriptionUnavailable,
} from '../services/answerBank/transcribe';

const router = Router();

/**
 * Audio is held in memory and dropped as soon as it is transcribed. Nothing
 * writes a recording of somebody's voice to disk: the words are the deliverable
 * and the audio has no second use, so keeping it is only a liability.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

/** A turn of the exchange, appended to `turns` and never rewritten. */
interface Turn {
  asked: string;
  said: string;
  /** Why this follow-up was asked. Absent on the opening question. */
  reason?: ProbeReason;
  /** Whether the follow-up wording came from the model or the written fallback. */
  probeSource?: 'model' | 'fallback';
  at: string;
}

/** Anything the model produces is text. Guard against it not being. */
const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

async function loadIntake(userId: string) {
  return prisma.answerBankIntake.findUnique({
    where: { userId },
    include: { entries: { orderBy: { createdAt: 'asc' } } },
  });
}

function questionsOf(plan: unknown): Question[] {
  return ((plan as Plan)?.script?.questions) || [];
}

/**
 * The question text, re-derived rather than read back.
 *
 * A stored plan is immutable, so an intake started before the mid-word chop
 * was fixed would show `"...on Meta Ads by 90% through manual"` forever. The
 * wording is presentation, not identity: the question id is what answers are
 * filed against, and that is untouched. So the ask is rebuilt from the seed
 * the plan already holds, and everybody gets the fix without a reset.
 */
function askFor(plan: unknown, question: Question): string {
  if (question.kind !== 'seed' || !question.from) return question.ask;
  const seed = ((plan as Plan)?.seeds || []).find((s: Seed) => s.id === question.from);
  if (!seed) return question.ask;
  const where = seed.org || seed.role || seed.section;
  return `${describeSeed(seed)} at ${where}. Walk me through one specific time that happened. What was actually going on?`;
}

// ------------------------------------------------------------------- the plan

/**
 * Start the intake, or hand back the one already in progress.
 *
 * Deliberately refuses to rebuild a plan that already exists. Regenerating
 * would renumber the questions underneath answers already filed against them,
 * and an answer attached to the wrong question is worse than no answer.
 */
router.post('/start', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const existing = await loadIntake(userId);
  if (existing) {
    return res.json({ intake: shape(existing), resumed: true });
  }

  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: {
      id: true, name: true, email: true, phone: true, location: true,
      linkedin: true, industry: true, resumeRawText: true,
    },
  });

  if (!profile) return res.status(404).json({ error: 'No profile yet.' });
  if (!profile.resumeRawText || profile.resumeRawText.trim().length < 200) {
    return res.status(400).json({
      error: 'Your resume needs to be in JobHub before the intake can build your questions.',
      code: 'no_resume',
    });
  }

  const industry = (req.body?.industry as string) || profile.industry || null;
  const plan = planIntake(profile.resumeRawText, { industry });

  const created = await prisma.answerBankIntake.create({
    data: {
      userId,
      candidateProfileId: profile.id,
      resumeSnapshot: profile.resumeRawText,
      industry,
      plan: plan as unknown as object,
    },
    include: { entries: true },
  });

  return res.json({ intake: shape(created), resumed: false });
});

/** The intake as it stands, for resuming. */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const intake = await loadIntake(req.user!.id);
  if (!intake) return res.json({ intake: null });
  return res.json({ intake: shape(intake) });
});

/**
 * What the answers so far have covered.
 *
 * Only approved text counts. A half-told answer sitting in `spoken` has not
 * been confirmed by the person it belongs to, and letting it retire questions
 * would mean a draft they later rewrite silently shrank their own intake.
 */
function coverageOf(intake: NonNullable<Awaited<ReturnType<typeof loadIntake>>>): Coverage {
  const answers: BankedAnswer[] = intake.entries
    .filter((e) => e.approvedAt && e.approved)
    .map((e) => ({
      questionId: e.questionId,
      themes: (e.themes as string[]) || [],
      text: e.approved || '',
    }));

  return buildCoverage(answers, intake.industry);
}

/** Everything the page needs, with the answers folded in but nothing recomputed. */
function shape(intake: Awaited<ReturnType<typeof loadIntake>>) {
  if (!intake) return null;
  const questions = questionsOf(intake.plan);
  const byQuestion = new Map(intake.entries.map((e) => [e.questionId, e]));
  const coverage = coverageOf(intake);

  const shaped = questions.map((q, index) => {
    const entry = byQuestion.get(q.id);
    const state = !entry ? 'unanswered'
      : entry.approvedAt ? 'approved'
        : entry.cleaned ? 'awaiting_confirmation' : 'in_progress';

    // Only an untouched question can be retired. Once somebody has started
    // talking, taking the question away from them loses their work.
    const verdict = state === 'unanswered' && !entry ? isRedundant(q, coverage) : { redundant: false, by: [] };

    return {
      index,
      id: q.id,
      kind: q.kind,
      themes: q.themes,
      ask: askFor(intake.plan, q),
      hints: q.hints || hintsFor(q),
      /**
       * Three worked examples, sent collapsed. They are what somebody who has
       * gone blank at the question actually needs, and the reason they are
       * safe to send is in examples.ts: every one happens somewhere the reader
       * does not work, so the shape transfers and the content cannot.
       */
      examples: examplesFor(q),
      beats: BEATS,
      // Plans built before cues existed have none stored. Derive rather than
      // migrate: the plan is immutable, and a resumed intake must not lose them.
      cues: q.cues?.length ? q.cues : cuesFor(q),
      probes: q.probes,
      state,
      /** Already answered by another story, so not worth asking again. */
      covered: verdict.redundant,
      coveredBy: verdict.by,
      /** Worth having, but not part of the promised session. */
      optional: isOptional(q, intake.industry),
      turns: (entry?.turns as unknown as Turn[]) || [],
      spoken: entry?.spoken || null,
      cleaned: entry?.cleaned || null,
      approved: entry?.approved || null,
      variants: entry?.variants || null,
      followUps: entry?.followUps ?? 0,
      outcome: entry?.outcome || null,
    };
  });

  const answered = intake.entries.filter((e) => e.approvedAt).length;
  const outstanding = shaped.filter(
    (q) => q.state === 'unanswered' && !q.covered && q.outcome !== 'skipped',
  );
  // What the candidate was actually promised: the outstanding questions that
  // are not extras. Counting the optional ones in is how a session that is
  // genuinely finished still shows four questions to go.
  const live = outstanding.filter((q) => !q.optional).length;
  const core = coreStatus(coverage, intake.industry);

  return {
    id: intake.id,
    cursor: intake.cursor,
    industry: intake.industry,
    startedAt: intake.startedAt,
    completedAt: intake.completedAt,
    total: questions.length,
    answered,
    /** The only count worth showing. `total` is what was planned before they spoke. */
    live,
    optional: outstanding.filter((q) => q.optional).length,
    retired: shaped.filter((q) => q.covered).length,
    minutesLeft: minutesFor(live),
    /** True once the bank answers what forms actually ask. Extras may remain. */
    enough: core.enough && answered > 0,
    coreMissing: core.missing,
    themesCovered: [...coverage.keys()],
    questions: shaped,
  };
}

/**
 * The next question actually worth asking, from `from` onwards.
 *
 * Falls back to the plain next index when everything ahead is covered, so the
 * cursor can still run off the end and complete the intake.
 */
function nextLiveIndex(
  questions: Question[],
  coverage: Coverage,
  answeredIds: Set<string>,
  from: number,
  industry: string | null,
): number {
  const usable = (q: Question) => !answeredIds.has(q.id) && !isRedundant(q, coverage).redundant;

  // The questions that count come first, wherever they sit in the plan. An
  // extra offered before a core theme is still missing spends the candidate's
  // remaining patience on the least valuable thing left.
  for (let i = from; i < questions.length; i += 1) {
    if (usable(questions[i]) && !isOptional(questions[i], industry)) return i;
  }
  for (let i = from; i < questions.length; i += 1) {
    if (usable(questions[i])) return i;
  }
  return questions.length;
}

/** Whether the record button can work at all, so the page can say so up front. */
router.get('/capabilities', authenticate, async (_req: AuthRequest, res: Response) => {
  res.json({ voice: transcriptionConfigured() });
});

/**
 * Audio in, words out. Nothing is saved here.
 *
 * Kept separate from /answer so that a transcription failure never costs the
 * candidate their recording: the page holds the text, shows it to them, and
 * only then submits it. Somebody who has just spoken for two minutes should
 * never lose it to a network error.
 */
router.post('/transcribe', authenticate, upload.single('audio'), async (req: AuthRequest, res: Response) => {
  if (!req.file?.buffer?.length) return res.status(400).json({ error: 'No audio arrived.' });

  const intake = await loadIntake(req.user!.id);

  try {
    const text = await transcribe(req.file.buffer, intake?.resumeSnapshot);
    if (!text) {
      return res.status(422).json({
        error: 'Nothing could be heard in that recording. Check the microphone and try again.',
      });
    }
    return res.json({ text });
  } catch (error) {
    if (error instanceof TranscriptionUnavailable) {
      return res.status(503).json({ error: error.message, code: 'transcription_unavailable' });
    }
    console.error('[answer-bank] transcription failed', error);
    return res.status(502).json({ error: 'The transcription service did not respond. Type the answer instead.' });
  }
});

// ------------------------------------------------------------------ answering

/**
 * Take what was said, and either bank it or ask one more thing.
 *
 * The audit that decides which is deterministic and runs with no model. The
 * model is consulted only to phrase the follow-up against what they actually
 * said, and its wording is thrown away if it leads, praises, or bundles three
 * questions into one. An LLM outage degrades this to a plainer follow-up, never
 * to a fabricated one.
 */
router.post('/answer', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { questionId, text } = req.body as { questionId?: string; text?: string };

  if (!questionId || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'A question id and some text are required.' });
  }

  const intake = await loadIntake(userId);
  if (!intake) return res.status(404).json({ error: 'No intake started.' });

  const question = questionsOf(intake.plan).find((q) => q.id === questionId);
  if (!question) return res.status(404).json({ error: 'That question is not in your intake.' });

  const existing = intake.entries.find((e) => e.questionId === questionId);
  if (existing?.approvedAt) {
    return res.status(409).json({ error: 'That answer is already confirmed. Reopen it to change it.' });
  }

  const priorTurns = (existing?.turns as unknown as Turn[]) || [];
  const followUps = existing?.followUps ?? 0;
  // Follow-ups extend the same story rather than replacing it, so the whole
  // exchange is judged together. Judging only the latest reply would ask for the
  // scene again immediately after they had just given it.
  const spoken = [existing?.spoken, text.trim()].filter(Boolean).join('\n\n');

  const decision = decideTurn(spoken, followUps);

  const askedThisTurn = priorTurns.length
    ? priorTurns[priorTurns.length - 1].asked
    : question.ask;
  const turns: Turn[] = [...priorTurns, { asked: askedThisTurn, said: text.trim(), at: new Date().toISOString() }];

  let probe: string | null = null;
  let probeSource: 'model' | 'fallback' | undefined;

  if (decision.action === 'probe' && decision.reason && decision.reason !== null) {
    let modelProbe: string | null = null;
    try {
      const raw = await callLLM(
        buildProbePrompt(question, spoken, decision.reason),
        false, 0.4, 300,
      );
      modelProbe = asText(raw).trim();
    } catch {
      // Written fallback below. The intake does not stall on the model.
      modelProbe = null;
    }
    const chosen = chooseProbe(modelProbe, decision.reason);
    probe = chosen.probe;
    probeSource = chosen.source;
    turns.push({ asked: probe, said: '', reason: decision.reason, probeSource, at: new Date().toISOString() });
  }

  const entry = await prisma.answerBankEntry.upsert({
    where: { intakeId_questionId: { intakeId: intake.id, questionId } },
    create: {
      intakeId: intake.id,
      questionId,
      questionText: question.ask,
      themes: question.themes || [],
      turns: turns as unknown as object,
      spoken,
      followUps: decision.action === 'probe' ? followUps + 1 : followUps,
      outcome: decision.action === 'probe' ? null : decision.action,
    },
    update: {
      turns: turns as unknown as object,
      spoken,
      followUps: decision.action === 'probe' ? followUps + 1 : followUps,
      outcome: decision.action === 'probe' ? null : decision.action,
    },
  });

  return res.json({
    action: decision.action,
    probe,
    probeSource,
    // The audit is returned so the page can show what is still missing. It is
    // description, not instruction: the candidate is never told to write a
    // particular thing, only which part of their own story has not landed yet.
    audit: {
      missing: decision.audit.missing,
      hidesBehindWe: decision.audit.hidesBehindWe,
      wordCount: decision.audit.wordCount,
      score: decision.audit.score,
    },
    followUpsLeft: Math.max(0, MAX_FOLLOW_UPS - entry.followUps),
    spoken: entry.spoken,
  });
});

// ------------------------------------------------------------------- cleaning

/**
 * Tidy the transcript, and prove the tidying only removed.
 *
 * A model clean that adds anything is discarded in favour of the mechanical
 * one, and the candidate is told that happened. Silently keeping a clean that
 * failed the check would be worse than not checking.
 */
router.post('/clean', authenticate, async (req: AuthRequest, res: Response) => {
  const { questionId } = req.body as { questionId?: string };
  const intake = await loadIntake(req.user!.id);
  if (!intake) return res.status(404).json({ error: 'No intake started.' });

  const entry = intake.entries.find((e) => e.questionId === questionId);
  if (!entry?.spoken) return res.status(404).json({ error: 'Nothing has been said for that question yet.' });

  const mechanical = stripFillers(entry.spoken);
  let cleaned = mechanical;
  let source: 'model' | 'mechanical' = 'mechanical';
  let rejected: string | undefined;

  try {
    const raw = asText(await callLLM(
      `${CLEAN_PROMPT}\n\nThe transcript:\n"""\n${entry.spoken}\n"""`,
      false, 0, 2000,
    )).trim();

    const check = checkSubtractive(entry.spoken, raw);
    if (check.ok) {
      cleaned = raw;
      source = 'model';
    } else {
      rejected = check.problem;
      console.warn('[answer-bank] clean rejected', {
        questionId, problem: check.problem,
        invented: check.invented.slice(0, 10), numbers: check.inventedNumbers,
      });
    }
  } catch {
    // Mechanical clean stands. It is genuinely usable on its own.
  }

  await prisma.answerBankEntry.update({
    where: { id: entry.id },
    data: { cleaned },
  });

  return res.json({
    spoken: entry.spoken,
    cleaned,
    source,
    // Surfaced rather than hidden: if the model keeps trying to embellish a
    // particular answer, that is worth knowing about.
    rejected,
  });
});

/**
 * The candidate's confirmed text.
 *
 * Whatever they send is taken as written. They are allowed to add things the
 * model may not, because it is their story and their memory. `spoken` is left
 * untouched underneath so nothing is ever lost.
 */
router.post('/approve', authenticate, async (req: AuthRequest, res: Response) => {
  const { questionId, text } = req.body as { questionId?: string; text?: string };
  if (!text || !text.trim()) return res.status(400).json({ error: 'Confirmed text is required.' });

  const userId = req.user!.id;
  const intake = await loadIntake(userId);
  if (!intake) return res.status(404).json({ error: 'No intake started.' });

  const entry = intake.entries.find((e) => e.questionId === questionId);
  if (!entry) return res.status(404).json({ error: 'Nothing has been said for that question yet.' });

  const updated = await prisma.answerBankEntry.update({
    where: { id: entry.id },
    data: { approved: text.trim(), approvedAt: new Date() },
  });

  // Re-read coverage WITH this answer in it, then step the cursor over
  // everything it just made unnecessary. This is where a twelve question plan
  // collapses: one account of a bad week can retire failure, pressure,
  // teamwork and change in a single move.
  const after = await loadIntake(userId);
  const questions = questionsOf(after!.plan);
  const coverage = coverageOf(after!);
  const answeredIds = new Set(after!.entries.filter((e) => e.approvedAt).map((e) => e.questionId));

  const index = questions.findIndex((q) => q.id === questionId);
  let cursor = intake.cursor;
  if (index >= 0 && index >= intake.cursor) {
    cursor = nextLiveIndex(questions, coverage, answeredIds, index + 1, after!.industry);
    await prisma.answerBankIntake.update({
      where: { id: intake.id },
      data: { cursor },
    });
  }

  const retired = questions
    .filter((q, i) => i > index && !answeredIds.has(q.id) && isRedundant(q, coverage).redundant)
    .map((q) => ({ id: q.id, themes: q.themes }));

  return res.json({
    approved: updated.approved,
    approvedAt: updated.approvedAt,
    cursor,
    /**
     * What this answer just made unnecessary. Shown to the candidate, because
     * questions silently disappearing from a list they were counting down is
     * unnerving, and being told "that also answered three others" is the best
     * moment this intake has to offer.
     */
    retired,
  });
});

/** Move past a question with nothing to say for it. A thin bank beats a false one. */
router.post('/skip', authenticate, async (req: AuthRequest, res: Response) => {
  const { questionId } = req.body as { questionId?: string };
  const intake = await loadIntake(req.user!.id);
  if (!intake) return res.status(404).json({ error: 'No intake started.' });

  const questions = questionsOf(intake.plan);
  const index = questions.findIndex((q) => q.id === questionId);
  if (index < 0) return res.status(404).json({ error: 'That question is not in your intake.' });

  await prisma.answerBankEntry.upsert({
    where: { intakeId_questionId: { intakeId: intake.id, questionId: questionId! } },
    create: {
      intakeId: intake.id,
      questionId: questionId!,
      questionText: questions[index].ask,
      themes: questions[index].themes || [],
      outcome: 'skipped',
    },
    update: { outcome: 'skipped' },
  });

  await prisma.answerBankIntake.update({
    where: { id: intake.id },
    data: { cursor: Math.min(index + 1, questions.length) },
  });

  return res.json({ ok: true });
});

// ------------------------------------------------------------------- variants

/**
 * Cut the four lengths from the approved text.
 *
 * Same rule as cleaning, checked the same way, except that a variant is meant
 * to be far shorter than its source so only invention is disqualifying. Any
 * length the model fails on falls back to the approved text truncated at a
 * sentence boundary, which is honest if inelegant.
 */
router.post('/variants', authenticate, async (req: AuthRequest, res: Response) => {
  const { questionId } = req.body as { questionId?: string };
  const intake = await loadIntake(req.user!.id);
  if (!intake) return res.status(404).json({ error: 'No intake started.' });

  const entry = intake.entries.find((e) => e.questionId === questionId);
  if (!entry?.approved) return res.status(400).json({ error: 'Confirm the answer before cutting it to length.' });

  const approved = entry.approved;
  const names: VariantName[] = ['headline', 'short', 'medium', 'full'];
  const variants: Record<string, string> = {};
  const fellBack: string[] = [];

  for (const name of names) {
    // The longest variant is the approved text. Asking a model to "shorten to
    // 400 words" text that is already 200 words invites it to pad.
    if (name === 'full') { variants.full = approved; continue; }

    let text = '';
    try {
      text = asText(await callLLM(buildVariantPrompt(approved, name), false, 0, 1500)).trim();
    } catch {
      text = '';
    }

    if (!text || !checkVariant(approved, text).ok) {
      text = truncateAtSentence(approved, VARIANT_SPEC[name].words);
      fellBack.push(name);
    }
    variants[name] = text;
  }

  await prisma.answerBankEntry.update({
    where: { id: entry.id },
    data: { variants: variants as unknown as object },
  });

  return res.json({ variants, fellBack });
});

/** Cut to roughly a word budget without ending mid-sentence. */
function truncateAtSentence(text: string, budget: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  const kept: string[] = [];
  let count = 0;
  for (const sentence of sentences) {
    const length = (sentence.match(/\S+/g) || []).length;
    if (count && count + length > budget) break;
    kept.push(sentence.trim());
    count += length;
  }
  return kept.join(' ').trim() || text.trim();
}

// ----------------------------------------------------------------- the export

/**
 * The bank, in the shape the extension loads.
 *
 * Only approved answers are included. An unconfirmed answer is a draft, and a
 * draft pasted into a real application is the thing this whole design exists to
 * prevent.
 */
router.get('/export', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const intake = await loadIntake(userId);
  if (!intake) return res.status(404).json({ error: 'No intake started.' });

  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { name: true, email: true, phone: true, location: true, linkedin: true, industry: true },
  });

  const plan = intake.plan as unknown as Plan;
  const scaffold = buildScaffold(plan, {
    profile: {
      name: profile?.name || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      location: profile?.location || '',
      linkedin: profile?.linkedin || '',
      industry: intake.industry || profile?.industry || '',
    },
  });

  const approved = new Map(
    intake.entries.filter((e) => e.approvedAt && e.approved).map((e) => [e.questionId, e]),
  );
  const questions = questionsOf(intake.plan);

  scaffold.stories = scaffold.stories
    .map((story, index) => {
      const entry = approved.get(questions[index]?.id);
      if (!entry) return null;
      const variants = (entry.variants as unknown as Record<string, string>) || {};
      return {
        ...story,
        raw: entry.approved!,
        variants: {
          headline: variants.headline || '',
          short: variants.short || '',
          medium: variants.medium || '',
          full: variants.full || entry.approved!,
        },
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return res.json({
    bank: scaffold,
    stories: scaffold.stories.length,
    // The extension refuses a bank with empty slots, so say plainly what is
    // missing rather than letting the download fail on the other side.
    unanswered: questions.length - scaffold.stories.length,
  });
});

export default router;
