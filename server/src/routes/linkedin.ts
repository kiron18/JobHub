import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { callClaude } from '../services/llm';
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
    return '';
  }
}

/** Pure rate-limit check — exported for testing */
export function checkHeadshotRateLimit(
  storedCount: number,
  lastDate: Date | null,
  limit: number
): { allowed: boolean; usedToday: number } {
  const today = new Date().toDateString();
  const usedToday = lastDate?.toDateString() === today ? storedCount : 0;
  return { allowed: usedToday < limit, usedToday };
}

export default router;
