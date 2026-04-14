import * as Sentry from '@sentry/node';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
// Routers
import extractRouter from './routes/extract';
import analyzeRouter from './routes/analyze';
import aiToolsRouter from './routes/ai-tools';
import documentQaRouter from './routes/document-qa';
import generateRouter from './routes/generate';
import profileRouter from './routes/profile/index';
import documentsRouter from './routes/documents';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import onboardingRouter from './routes/onboarding';
import researchRouter from './routes/research';
import feedbackRouter from './routes/feedback';
import linkedinRouter from './routes/linkedin';
import { analyzeRateLimit } from './middleware/analyzeRateLimit';

dotenv.config();

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: !!process.env.SENTRY_DSN, // only active when DSN is set
  tracesSampleRate: 0.1,
});

process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

export const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3002;

const staticOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',').map(o => o.trim())
  : [];

const corsOptions = {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      // Allow server-to-server / curl (no Origin header)
      if (!origin) return cb(null, true);
      // Explicit allowlist from env
      if (staticOrigins.includes(origin)) return cb(null, true);
      // Allow any Vercel preview deployment
      if (/^https:\/\/[a-z0-9-]+-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/.test(origin)) return cb(null, true);
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return cb(null, true);
      // Allow production custom domain
      if (/^https?:\/\/(www\.)?aussiegradcareers\.com$/.test(origin)) return cb(null, true);
      // Allow localhost in any form
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
      cb(new Error(`CORS: origin not allowed — ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

const isDev = process.env.NODE_ENV !== 'production';

// In dev only: mirror console output to a local log file for easy tailing.
// In production Railway captures stdout natively; no file needed.
if (isDev) {
  const logFile = path.join(__dirname, '../server.log');
  const originalLog = console.log.bind(console);
  const originalErr = console.error.bind(console);

  const fileAppend = (msg: string) => {
    try { fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`); } catch {}
  };

  console.log = (...args: any[]) => {
    fileAppend(`[LOG] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
    originalLog(...args);
  };

  console.error = (...args: any[]) => {
    fileAppend(`[ERR] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
    originalErr(...args);
  };
}

// Request timing log (stdout only — works in both envs)
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        console.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
});

// Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/analyze', aiToolsRouter);
app.use('/api/analyze', documentQaRouter);
app.use('/api/extract', extractRouter);
app.use('/api/generate', generateRouter);
app.use('/api', profileRouter);
app.use('/api', documentsRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/research', researchRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/linkedin', linkedinRouter);

// Sentry error handler - must be before any other error handling middleware
Sentry.setupExpressErrorHandler(app);

// Final error handler - must be after all routes
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Server Error]', err.message, err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(PORT, () => {
    console.log(`Job Ready Backend running on http://localhost:${PORT}`);
});
