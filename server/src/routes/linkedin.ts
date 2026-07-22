import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { callClaude } from '../services/llm';
import { parseLLMJson } from '../utils/parseLLMResponse';
import { EXEMPT_EMAILS } from './stripe';

async function requirePaid(_req: AuthRequest, _res: any): Promise<boolean> {
  // PAYMENTS PAUSED: unlimited access for all users during pricing rework
  // (mirrors accessControl.ts#checkAccess, which every other gate already uses).
  // This gate was missed when payments were paused, so free/unpaid accounts like
  // Mayank's got a 402 here while every other feature stayed unlocked.
  return true;

  /* ORIGINAL CODE - restore when payments resume
  const email = (req.user?.email ?? '').toLowerCase();
  if (EXEMPT_EMAILS.includes(email)) return true;
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId: req.user!.id },
    select: { plan: true, planStatus: true, accessExpiresAt: true },
  });
  const plan = profile?.plan ?? 'free';
  const planStatus = profile?.planStatus ?? 'active';
  const isPaid = plan !== 'free' && (planStatus === 'active' || planStatus === 'trialing' || planStatus === 'past_due');
  const isThreeMonth = plan === 'three_month' && profile?.accessExpiresAt && profile.accessExpiresAt > new Date();
  if (!isPaid && !isThreeMonth) {
    res.status(402).json({
      error: 'upgrade_required',
      message: 'LinkedIn generation requires a paid plan.',
      upgradeUrl: '/pricing',
    });
    return false;
  }
  return true;
  */
}
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../lib/supabase';
import fs from 'fs';
import path from 'path';

const router = Router();

const MAX_DAILY_HEADSHOTS = parseInt(process.env.MAX_DAILY_HEADSHOTS || '3', 10);

// Backgrounds rotate so each generation looks distinct.
const HEADSHOT_BACKGROUNDS = [
  'a soft gradient grey studio background',
  'a clean white studio background with soft shadows',
  'a warm charcoal studio background',
  'a soft navy blue studio background',
  'a blurred modern office background',
  'a soft sage green studio background',
];

function buildHeadshotPrompt(): string {
  const bg = HEADSHOT_BACKGROUNDS[Math.floor(Math.random() * HEADSHOT_BACKGROUNDS.length)];
  return `A hyper-realistic professional headshot portrait, DSLR-style realism, ${bg}, high quality studio lighting, sharp focus, clean and professional. Keep the person's face, features, and identity faithful to the reference photo.`;
}

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WebP images are accepted'));
    }
  },
});

function readRules(fileName: string): string {
  try {
    return fs.readFileSync(path.join(__dirname, '../../rules', fileName), 'utf-8');
  } catch {
    console.warn(`[linkedin] Rules file not found: ${fileName}`);
    return '';
  }
}

/** Pure rate-limit check — exported for testing */
export function checkHeadshotRateLimit(
  storedCount: number,
  lastDate: Date | null,
  limit: number
): { allowed: boolean; usedToday: number } {
  const today = new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' });
  const lastDateStr = lastDate
    ? new Date(lastDate).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })
    : null;
  const usedToday = lastDateStr === today ? storedCount : 0;
  return { allowed: usedToday < limit, usedToday };
}

router.post('/generate', authenticate, async (req: AuthRequest, res) => {
  if (!(await requirePaid(req, res))) return;
  const userId = req.user!.id;
  const { targetRole } = req.body as { targetRole?: string };

  try {
    const [profile, diagnostic] = await Promise.all([
      prisma.candidateProfile.findUnique({
        where: { userId },
        include: {
          experience: { orderBy: { startDate: 'desc' }, take: 3 },
          achievements: { take: 15 },
          education: true,
        },
      }),
      prisma.diagnosticReport.findUnique({
        where: { userId },
        select: { reportMarkdown: true },
      }),
    ]);

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const rules = readRules('linkedin_hub_profile_rules.md');

    const prompt = `${rules}

## Candidate Profile
Name: ${profile.name ?? 'Not provided'}
Title/Seniority: ${profile.seniority ?? ''} ${profile.targetRole ?? ''}
Location: ${profile.location ?? 'Not provided'}
Industry: ${profile.industry ?? 'Not provided'}
Skills: ${profile.skills ?? 'Not provided'}

## Work Experience
${profile.experience
  .map(e => `${e.role} at ${e.company} (${e.startDate} – ${e.endDate ?? 'Present'})\n${e.description ?? ''}`)
  .join('\n\n')}

## Top Achievements
${profile.achievements
  .slice(0, 10)
  .map(a => `• ${a.title}: ${a.description}${a.metric ? ` [${a.metric}]` : ''}`)
  .join('\n')}

## Education
${profile.education.map(e => `${e.degree} — ${e.institution}${e.year ? ` (${e.year})` : ''}`).join('\n')}

## Diagnostic Report (first 3000 chars)
${diagnostic?.reportMarkdown?.substring(0, 3000) ?? 'Not available'}

${targetRole ? `## Target Role\nThe candidate is targeting: ${targetRole}` : ''}

Return ONLY valid JSON matching the schema in the rules above.`;

    const { content } = await callClaude(prompt, true);
    const cleaned = content.replace(/\u2014/g, '-').replace(/\u2013/g, '-');
    const parsed = parseLLMJson(cleaned);
    // Hard-enforce character limits the LLM sometimes ignores
    if (parsed?.openToWork?.length > 150) parsed.openToWork = parsed.openToWork.slice(0, 147) + '...';
    if (parsed?.headline?.length > 220) parsed.headline = parsed.headline.slice(0, 220);
    return res.json(parsed);
  } catch (err: any) {
    console.error('[LinkedIn /generate]', err.message);
    return res.status(500).json({ error: 'Generation failed' });
  }
});

router.post('/outreach', authenticate, async (req: AuthRequest, res) => {
  if (!(await requirePaid(req, res))) return;
  const userId = req.user!.id;
  const { targetFirstName, targetCompany, targetTopicOrPost, specificQuestion } =
    req.body as {
      targetFirstName: string;
      targetCompany: string;
      targetTopicOrPost: string;
      specificQuestion?: string;
    };

  if (!targetFirstName || !targetCompany || !targetTopicOrPost) {
    return res.status(400).json({ error: 'targetFirstName, targetCompany, and targetTopicOrPost are required' });
  }

  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { name: true, targetRole: true, seniority: true, industry: true, location: true, skills: true },
    });

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const rules = readRules('linkedin_outreach_rules.md');

    const prompt = `${rules}

## Candidate Info (pre-fill into templates)
Name: ${profile.name ?? 'the candidate'}
Background: ${[profile.seniority, profile.industry].filter(Boolean).join(' ')} professional
Targeting: ${profile.targetRole ?? 'roles in their field'}
Location: ${profile.location ?? 'Australia'}
Key Skills: ${profile.skills ?? 'Not provided'}

## Target Person Details
First Name: ${targetFirstName}
Company: ${targetCompany}
What they work on / posted about: ${targetTopicOrPost}
${specificQuestion ? `Specific question candidate wants to ask: ${specificQuestion}` : ''}

Return ONLY valid JSON matching the schema in the rules above.`;

    const { content } = await callClaude(prompt, true);
    const cleaned = content.replace(/\u2014/g, '-').replace(/\u2013/g, '-');
    return res.json(parseLLMJson(cleaned));
  } catch (err: any) {
    console.error('[LinkedIn /outreach]', err.message);
    return res.status(500).json({ error: 'Generation failed' });
  }
});

router.post('/headshot', authenticate, upload.single('image'), async (req: AuthRequest, res) => {
  if (!(await requirePaid(req, res))) return;
  const userId = req.user!.id;
  if (!req.file) return res.status(400).json({ error: 'No image provided' });

  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { headshotGenerationsToday: true, headshotGenerationsDate: true },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const { allowed, usedToday } = checkHeadshotRateLimit(
      profile.headshotGenerationsToday,
      profile.headshotGenerationsDate,
      MAX_DAILY_HEADSHOTS
    );

    if (!allowed) {
      return res.status(429).json({
        error: 'Daily headshot limit reached',
        remainingToday: 0,
        limit: MAX_DAILY_HEADSHOTS,
      });
    }

    const base64Input = req.file.buffer.toString('base64');

    let genaiResult: any;
    try {
      genaiResult = await genai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: [
          {
            role: 'user',
            parts: [
              { text: buildHeadshotPrompt() },
              { inlineData: { mimeType: req.file.mimetype, data: base64Input } },
            ],
          },
        ],
        config: { responseModalities: ['IMAGE'] } as any,
      });
    } catch (genaiErr: any) {
      console.error('[headshot] Google GenAI call failed:', genaiErr.message);
      return res.status(500).json({ error: `Image generation error: ${genaiErr.message}` });
    }

    let imageData: string | undefined;
    let imageMime = 'image/png';
    for (const part of genaiResult?.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        imageData = part.inlineData.data;
        imageMime = part.inlineData.mimeType ?? 'image/png';
        break;
      }
    }

    if (!imageData) {
      console.error('[headshot] no image in GenAI response:', JSON.stringify(genaiResult));
      throw new Error('No image returned from Google GenAI');
    }

    const imgExt = imageMime.split('/')[1] ?? 'png';
    const storagePath = `headshots/${userId}_${Date.now()}.${imgExt}`;
    const imageBuffer = Buffer.from(imageData, 'base64');

    const { error: uploadError } = await supabase.storage
      .from('headshots')
      .upload(storagePath, imageBuffer, { contentType: imageMime, upsert: true });

    if (uploadError) {
      console.error('[headshot] Supabase upload error:', uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl: imageUrl } } = supabase.storage
      .from('headshots')
      .getPublicUrl(storagePath);

    const newUsed = usedToday + 1;
    await prisma.candidateProfile.update({
      where: { userId },
      data: { headshotGenerationsToday: newUsed, headshotGenerationsDate: new Date() },
    });

    return res.json({
      imageUrl,
      usedToday: newUsed,
      limit: MAX_DAILY_HEADSHOTS,
      remainingToday: MAX_DAILY_HEADSHOTS - newUsed,
    });
  } catch (err: any) {
    console.error('[headshot] unhandled error:', err.message);
    return res.status(500).json({ error: err.message ?? 'Headshot generation failed' });
  }
});

router.post('/headshot/save', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { imageUrl } = req.body as { imageUrl: string };
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });
  let parsedImageUrl: URL;
  try { parsedImageUrl = new URL(imageUrl); } catch {
    return res.status(400).json({ error: 'Invalid imageUrl format' });
  }
  if (!parsedImageUrl.hostname.endsWith('.supabase.co')) {
    return res.status(400).json({ error: 'imageUrl must be a Supabase storage URL' });
  }
  try {
    await prisma.candidateProfile.update({ where: { userId }, data: { headshotUrl: imageUrl } });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save headshot' });
  }
});

// ── Outreach log ("Connected") ──────────────────────────────────────────────
// One tap as soon as the connection request goes out. Free for all users —
// logging outreach must never be behind a paywall or students will stop
// tracking.
//
// Logging happens at connection-request time, not after the first message.
// LinkedIn makes you wait for the person to accept before you can send
// anything else, which can be days, so requiring both messages meant users
// with a batch of pending requests had nowhere to keep their drafts. All four
// generated templates are stored on the entry as drafts; a template only
// becomes an OutreachMessage once the user says they have actually sent it.

router.post('/outreach/log', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const {
    personName, company, topic, specificQuestion,
    firstMessage, connectionNote, followUpDraft, directAskDraft,
    firstMessageSent,
  } = req.body as {
    personName?: string; company?: string; topic?: string;
    specificQuestion?: string; firstMessage?: string; connectionNote?: string;
    followUpDraft?: string; directAskDraft?: string; firstMessageSent?: boolean;
  };

  if (!personName?.trim() || !company?.trim()) {
    return res.status(400).json({ error: 'personName and company are required' });
  }

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const log = await tx.outreachLog.create({
        data: {
          userId,
          personName: personName.trim(),
          company: company.trim(),
          topic: (topic ?? '').trim(),
          specificQuestion: (specificQuestion ?? '').trim(),
          firstMessage: (firstMessage ?? '').trim(),
          connectionNote: (connectionNote ?? '').trim(),
          followUpDraft: (followUpDraft ?? '').trim(),
          directAskDraft: (directAskDraft ?? '').trim(),
          draftsUpdatedAt: new Date(),
        },
      });

      // The connection note is the one thing definitely sent by this point.
      if (connectionNote?.trim()) {
        await tx.outreachMessage.create({
          data: { outreachLogId: log.id, touchNumber: 1, body: connectionNote.trim() },
        });
      }
      // The first message only counts as sent if the user says so — normally
      // it is still queued, waiting on the person to accept.
      if (firstMessageSent && firstMessage?.trim()) {
        await tx.outreachMessage.create({
          data: { outreachLogId: log.id, touchNumber: connectionNote?.trim() ? 2 : 1, body: firstMessage.trim() },
        });
      }

      return log;
    });
    return res.json({ ok: true, entry });
  } catch (err) {
    console.error('[outreach/log] create error:', err);
    return res.status(500).json({ error: 'Failed to log outreach' });
  }
});

// Save edits to the stored drafts. Called as the user tweaks a template so
// the wording they settled on survives a reload or a switch to another person.
router.patch('/outreach/:id/drafts', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const id = req.params.id as string;
  const { connectionNote, firstMessage, followUpDraft, directAskDraft } = req.body as {
    connectionNote?: string; firstMessage?: string;
    followUpDraft?: string; directAskDraft?: string;
  };

  const data: Record<string, string | Date> = {};
  if (typeof connectionNote === 'string') data.connectionNote = connectionNote;
  if (typeof firstMessage === 'string') data.firstMessage = firstMessage;
  if (typeof followUpDraft === 'string') data.followUpDraft = followUpDraft;
  if (typeof directAskDraft === 'string') data.directAskDraft = directAskDraft;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No draft fields supplied' });
  }
  data.draftsUpdatedAt = new Date();

  try {
    const existing = await prisma.outreachLog.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Outreach not found' });
    }
    const entry = await prisma.outreachLog.update({ where: { id }, data });
    return res.json({ ok: true, entry });
  } catch (err) {
    console.error('[outreach/drafts] update error:', err);
    return res.status(500).json({ error: 'Failed to save drafts' });
  }
});

router.get('/outreach/log', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const entries = await prisma.outreachLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ entries });
  } catch (err) {
    console.error('[outreach/log] list error:', err);
    return res.status(500).json({ error: 'Failed to load outreach log' });
  }
});

// Lets the sender correct the first message on record after the fact —
// what they typed in the generator isn't always exactly what they pasted.
router.patch('/outreach/log/:id', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const id = req.params.id as string;
  const { firstMessage } = req.body as { firstMessage?: string };

  if (typeof firstMessage !== 'string') {
    return res.status(400).json({ error: 'firstMessage is required' });
  }

  try {
    const existing = await prisma.outreachLog.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    const entry = await prisma.outreachLog.update({
      where: { id },
      data: { firstMessage: firstMessage.trim() },
    });
    return res.json({ ok: true, entry });
  } catch (err) {
    console.error('[outreach/log] update error:', err);
    return res.status(500).json({ error: 'Failed to update outreach log entry' });
  }
});

// ── Outreach Ladder (message log, uncapped — users self-select when to send
// the follow-up and the call ask, so the ladder just records whatever they've
// sent so far rather than enforcing a fixed number of touches) ─────────────

const OUTREACH_CADENCE = [0, 4, 6]; // days after previous touch; touch 4+ reuses the last entry
const CLOSING_WINDOW_DAYS = 7; // days of no reply before a stalled thread is flagged

function getNextTouchDate(lastTouchDate: Date, touchNumber: number): Date {
  const daysToAdd = OUTREACH_CADENCE[touchNumber - 1] ?? OUTREACH_CADENCE[OUTREACH_CADENCE.length - 1];
  return new Date(lastTouchDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
}

function isOverdue(nextTouchDate: Date): boolean {
  const now = new Date();
  return nextTouchDate <= now;
}

// POST /outreach/:id/copy - Log when a message is copied (upsert touch)
router.post('/outreach/:id/copy', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const outreachLogId = req.params.id as string;
  const { touchNumber, body } = req.body as { touchNumber?: number; body?: string };

  if (!touchNumber || touchNumber < 1 || touchNumber > 20) {
    return res.status(400).json({ error: 'touchNumber must be between 1 and 20' });
  }
  if (!body || typeof body !== 'string') {
    return res.status(400).json({ error: 'body is required' });
  }

  try {
    // Verify the outreach belongs to this user
    const outreach = await prisma.outreachLog.findFirst({
      where: { id: outreachLogId, userId },
    });
    if (!outreach) {
      return res.status(404).json({ error: 'Outreach not found' });
    }

    // Upsert the message (last copy wins)
    const message = await prisma.outreachMessage.upsert({
      where: {
        outreachLogId_touchNumber: {
          outreachLogId,
          touchNumber,
        },
      },
      create: {
        outreachLogId,
        touchNumber,
        body: body.trim(),
        copiedAt: new Date(),
      },
      update: {
        body: body.trim(),
        copiedAt: new Date(),
      },
    });

    // Return updated ladder state
    const messages = await prisma.outreachMessage.findMany({
      where: { outreachLogId },
      orderBy: { touchNumber: 'asc' },
    });

    const lastTouch = messages[messages.length - 1];
    const nextTouchNumber = lastTouch.touchNumber + 1;
    const nextTouchDue = getNextTouchDate(lastTouch.copiedAt, nextTouchNumber);

    return res.json({
      message,
      ladder: {
        touches: messages.map(m => ({
          touchNumber: m.touchNumber,
          copiedAt: m.copiedAt,
        })),
        nextTouchNumber,
        nextTouchDue,
        isClosed: outreach.status === 'CLOSED_NO_REPLY' || outreach.status === 'CLOSED_MANUAL',
      },
    });
  } catch (err) {
    console.error('[outreach/copy]', err);
    return res.status(500).json({ error: 'Failed to log copy' });
  }
});

// POST /outreach/:id/status - Update outreach status
router.post('/outreach/:id/status', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const outreachLogId = req.params.id as string;
  const { status } = req.body as { status?: string };

  const validStatuses = ['ACTIVE', 'REPLIED', 'CALL_BOOKED', 'REFERRAL', 'CLOSED_NO_REPLY', 'CLOSED_MANUAL'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const outreach = await prisma.outreachLog.findFirst({
      where: { id: outreachLogId, userId },
    });
    if (!outreach) {
      return res.status(404).json({ error: 'Outreach not found' });
    }

    // Validate state transitions
    const currentStatus = outreach.status;
    const allowedTransitions: Record<string, string[]> = {
      ACTIVE: ['REPLIED', 'CLOSED_MANUAL', 'CLOSED_NO_REPLY'],
      REPLIED: ['CALL_BOOKED', 'REFERRAL', 'CLOSED_MANUAL'],
      CALL_BOOKED: ['CLOSED_MANUAL'],
      REFERRAL: ['CLOSED_MANUAL'],
      CLOSED_NO_REPLY: [],
      CLOSED_MANUAL: [],
    };

    if (currentStatus !== status && !allowedTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({
        error: `Cannot transition from ${currentStatus} to ${status}`,
        allowed: allowedTransitions[currentStatus] ?? [],
      });
    }

    const updated = await prisma.outreachLog.update({
      where: { id: outreachLogId },
      data: { status: status as any },
    });

    return res.json({ ok: true, outreach: updated });
  } catch (err) {
    console.error('[outreach/status]', err);
    return res.status(500).json({ error: 'Failed to update status' });
  }
});

// GET /outreach/due - Get follow-ups that are due today or overdue
router.get('/outreach/due', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  try {
    // Get all active outreaches with their messages
    const outreaches = await prisma.outreachLog.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { messages: { orderBy: { touchNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    const due: Array<{
      id: string;
      personName: string;
      company: string;
      topic: string;
      specificQuestion: string;
      nextTouchNumber: number;
      daysSinceLastTouch: number;
      nextTouchDue: Date;
    }> = [];

    for (const outreach of outreaches) {
      const lastTouch = outreach.messages[outreach.messages.length - 1];
      if (!lastTouch) continue; // nothing sent yet, nothing to follow up on
      // A lone connection note means the request is still pending — LinkedIn
      // won't let them message until it's accepted, so nudging is useless
      // noise. Wait until a real message has gone out.
      if (outreach.messages.length < 2) continue;
      const nextTouchNumber = lastTouch.touchNumber + 1;

      const lastTouchDate = lastTouch.copiedAt;
      const nextTouchDue = getNextTouchDate(lastTouchDate, nextTouchNumber);

      // Include if due or overdue
      if (isOverdue(nextTouchDue)) {
        const daysSinceLastTouch = Math.floor(
          (Date.now() - lastTouchDate.getTime()) / (24 * 60 * 60 * 1000)
        );

        due.push({
          id: outreach.id,
          personName: outreach.personName,
          company: outreach.company,
          topic: outreach.topic,
          specificQuestion: outreach.specificQuestion,
          nextTouchNumber,
          daysSinceLastTouch,
          nextTouchDue,
        });
      }
    }

    return res.json({ due });
  } catch (err) {
    console.error('[outreach/due]', err);
    return res.status(500).json({ error: 'Failed to load due follow-ups' });
  }
});

// GET /outreach - List all outreaches with full ladder state
router.get('/outreach', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  try {
    const outreaches = await prisma.outreachLog.findMany({
      where: { userId },
      include: { messages: { orderBy: { touchNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const now = new Date();

    const enriched = outreaches.map(outreach => {
      const lastTouch = outreach.messages[outreach.messages.length - 1];
      const nextTouchNumber = lastTouch ? lastTouch.touchNumber + 1 : 1;
      const lastTouchDate = lastTouch ? lastTouch.copiedAt : outreach.createdAt;

      // Flag a stalled thread: still ACTIVE (no reply logged) and it's been
      // a while since the last message went out — regardless of how many
      // messages that was, since the user self-selects the sequence.
      let computedStatus = outreach.status;
      if (outreach.status === 'ACTIVE' && lastTouch) {
        const closeDate = new Date(lastTouchDate.getTime() + CLOSING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        if (closeDate <= now) {
          computedStatus = 'CLOSED_NO_REPLY';
        }
      }

      return {
        ...outreach,
        computedStatus,
        ladder: {
          touches: outreach.messages.map(m => ({
            touchNumber: m.touchNumber,
            copiedAt: m.copiedAt,
            body: m.body,
          })),
          nextTouchNumber,
          nextTouchDue: getNextTouchDate(lastTouchDate, nextTouchNumber),
          canAutoClose: computedStatus === 'CLOSED_NO_REPLY' && outreach.status === 'ACTIVE',
        },
      };
    });

    return res.json({ entries: enriched });
  } catch (err) {
    console.error('[outreach/list]', err);
    return res.status(500).json({ error: 'Failed to load outreaches' });
  }
});

export default router;
