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
import JSZip from 'jszip';
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

    // fal-ai/photomaker now requires image_archive_url (a zip uploaded to fal storage).
    // images_data_url was removed from the API.
    const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const zip = new JSZip();
    zip.file(`image.${ext}`, req.file.buffer);
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
    const zipBlob = new Blob([zipBuffer], { type: 'application/zip' });
    const imageArchiveUrl = await fal.storage.upload(zipBlob);
    console.log('[headshot] uploaded zip to fal storage:', imageArchiveUrl);

    let result: any;
    try {
      result = await fal.subscribe('fal-ai/photomaker', {
        input: {
          image_archive_url: imageArchiveUrl,
          prompt: HEADSHOT_PROMPT,
          style: 'Photographic',
          negative_prompt: 'cartoon, illustration, anime, unrealistic, blurry, low quality',
          num_images: 1,
        } as any,
      });
    } catch (falErr: any) {
      // Log every detail fal.ai sends back so it appears in Railway logs
      console.error('[headshot] fal.ai call failed');
      console.error('  message:', falErr.message);
      console.error('  status:', falErr.status);
      console.error('  body:', JSON.stringify(falErr.body ?? falErr.detail ?? falErr.response?.data ?? falErr));
      const statusCode = falErr.status ?? falErr.statusCode;
      if (statusCode === 401 || statusCode === 403) {
        return res.status(500).json({ error: 'fal.ai auth failed (401/403) — FAL_AI_KEY may be wrong. Check Railway logs.' });
      }
      if (statusCode === 422) {
        return res.status(500).json({ error: 'fal.ai rejected the request (422) — model input may be invalid. Check Railway logs.' });
      }
      return res.status(500).json({ error: `fal.ai error ${statusCode ?? 'unknown'}: ${falErr.message}` });
    }

    console.log('[headshot] raw result keys:', Object.keys(result ?? {}));

    // fal client v1.x wraps in .data; some models return top-level
    const images = result?.data?.images ?? result?.images;
    const imageUrl = images?.[0]?.url as string | undefined;
    if (!imageUrl) {
      console.error('[headshot] no imageUrl in result:', JSON.stringify(result));
      throw new Error('No image returned from fal.ai');
    }

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
