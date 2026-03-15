import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
// Routers
import extractRouter from './routes/extract';
import analyzeRouter from './routes/analyze';
import generateRouter from './routes/generate';
import profileRouter from './routes/profile';
import documentsRouter from './routes/documents';
import healthRouter from './routes/health';
import authRouter from './routes/auth';

dotenv.config();

process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

export const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

const logFile = path.join(__dirname, '../server.log');
const log = (msg: string) => {
    const entry = `${new Date().toISOString()} - ${msg}\n`;
    fs.appendFileSync(logFile, entry);
};

// Redirect console to file
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args: any[]) => {
    log(`[LOG] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
    originalConsoleLog(...args);
};

console.error = (...args: any[]) => {
    log(`[ERROR] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
    originalConsoleError(...args);
};

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        log(`${req.method} ${req.url} - Status: ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/extract', extractRouter);
app.use('/api/generate', generateRouter);
app.use('/api', profileRouter);
app.use('/api', documentsRouter);

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
