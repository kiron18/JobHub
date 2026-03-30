import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Must mock BEFORE importing the router
vi.mock('../index', () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
    },
    documentFeedback: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
    },
  },
}));

// Mock the auth middleware to inject a consistent test user id regardless of
// the DEV_BYPASS_AUTH env var (which injects a different hardcoded UUID).
vi.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  },
}));

import feedbackRouter from '../routes/feedback';
import { prisma } from '../index';

const app = express();
app.use(express.json());
app.use('/api/feedback', feedbackRouter);

describe('POST /api/feedback/document', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 if documentId is missing', async () => {
    const res = await request(app)
      .post('/api/feedback/document')
      .set('Authorization', 'Bearer test-token')
      .send({ rating: 4 });
    expect(res.status).toBe(400);
  });

  it('returns 400 if rating is out of range', async () => {
    (prisma.document.findUnique as any).mockResolvedValue({
      id: 'doc-1',
      userId: 'test-user-id',
      type: 'RESUME',
    });
    const res = await request(app)
      .post('/api/feedback/document')
      .set('Authorization', 'Bearer test-token')
      .send({ documentId: 'doc-1', rating: 6 });
    expect(res.status).toBe(400);
  });

  it('returns 403 if document belongs to another user', async () => {
    (prisma.document.findUnique as any).mockResolvedValue({
      id: 'doc-1',
      userId: 'other-user',
      type: 'RESUME',
    });
    const res = await request(app)
      .post('/api/feedback/document')
      .set('Authorization', 'Bearer test-token')
      .send({ documentId: 'doc-1', rating: 4 });
    expect(res.status).toBe(403);
  });

  it('creates feedback and returns success', async () => {
    (prisma.document.findUnique as any).mockResolvedValue({
      id: 'doc-1',
      userId: 'test-user-id',
      type: 'RESUME',
    });
    (prisma.documentFeedback.create as any).mockResolvedValue({ id: 'fb-1' });

    const res = await request(app)
      .post('/api/feedback/document')
      .set('Authorization', 'Bearer test-token')
      .send({ documentId: 'doc-1', rating: 4, weakSection: 'evidence' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(prisma.documentFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: 'doc-1',
          userId: 'test-user-id',
          rating: 4,
          documentType: 'RESUME',
          weakSection: 'evidence',
        }),
      })
    );
  });

  it('returns 400 for invalid weakSection', async () => {
    (prisma.document.findUnique as any).mockResolvedValue({
      id: 'doc-1',
      userId: 'test-user-id',
      type: 'RESUME',
    });
    const res = await request(app)
      .post('/api/feedback/document')
      .set('Authorization', 'Bearer test-token')
      .send({ documentId: 'doc-1', rating: 3, weakSection: 'invalid_section' });
    expect(res.status).toBe(400);
  });
});
