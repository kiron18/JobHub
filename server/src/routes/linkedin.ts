import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { callClaude } from '../services/llm';
import { parseLLMJson } from '../utils/parseLLMResponse';
import { EXEMPT_EMAILS } from './stripe';

async function requirePaid(req: AuthRequest, res: any): Promise<boolean> {
  const email = (req.user?.email ?? '').toLowerCase();
  if (EXEMPT_EMAILS.includes(email)) return true;
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId: req.user!.id },
    select: { dashboardAccess: true },
  });
  if (!profile?.dashboardAccess) {
    res.status(403).json({ error: 'LinkedIn features require an active subscription.' });
    return false;
  }
  return true;
}
import multer from 'multer';
import { fal } from '@fal-ai/client';
import fs from 'fs';
import path from 'path';

const router = Router();

const MAX_DAILY_HEADSHOTS = parseInt(process.env.MAX_DAILY_HEADSHOTS || '3', 10);
const HEADSHOT_PROMPT =
  'A hyper-realistic headshot portrait of the uploaded image in DSLR-style realism with a soft pastel teal studio background and high quality studio lighting. The result should look clean and professional';

fal.config({ credentials: process.env.FAL_AI_KEY });

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
    return res.json(parseLLMJson(cleaned));
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

    const base64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

    const result = await fal.subscribe('fal-ai/photomaker', {
      input: {
        images_data_url: [dataUrl],
        prompt: HEADSHOT_PROMPT,
        style: 'Photographic',
        negative_prompt: 'cartoon, illustration, anime, unrealistic, blurry, low quality',
        num_images: 1,
      } as any,
    });

    const imageUrl = (result as any).data?.images?.[0]?.url as string | undefined;
    if (!imageUrl) throw new Error('No image returned from fal.ai');

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
    // Surface fal.ai specific errors to help diagnose Railway config issues
    console.error('[LinkedIn /headshot] error:', err.message, err.body ?? err.response?.data ?? '');
    const isFalAuthError = err.message?.includes('401') || err.message?.toLowerCase().includes('unauthorized') || err.message?.toLowerCase().includes('credentials');
    if (isFalAuthError) {
      return res.status(500).json({ error: 'Headshot service not configured — FAL_AI_KEY may be missing or invalid in Railway environment variables.' });
    }
    return res.status(500).json({ error: 'Headshot generation failed — please try again.' });
  }
});

router.post('/headshot/save', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { imageUrl } = req.body as { imageUrl: string };
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });
  // Validate it's a fal.ai CDN URL to prevent arbitrary URL storage
  let parsedImageUrl: URL;
  try { parsedImageUrl = new URL(imageUrl); } catch {
    return res.status(400).json({ error: 'Invalid imageUrl format' });
  }
  if (!parsedImageUrl.hostname.endsWith('.fal.run') && !parsedImageUrl.hostname.endsWith('.fal.ai')) {
    return res.status(400).json({ error: 'imageUrl must be a fal.ai URL' });
  }
  try {
    await prisma.candidateProfile.update({ where: { userId }, data: { headshotUrl: imageUrl } });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save headshot' });
  }
});

export default router;
