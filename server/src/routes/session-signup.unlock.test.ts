/**
 * The gate on the free resource pages.
 *
 * What is being defended here is a trade, and both halves of it matter: the
 * person must land on the sales board as a reachable lead, and they must get
 * their file no matter what goes wrong on our side of it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../index', () => ({
  prisma: {
    sessionRegistration: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    salesLead: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock('../services/salesLead', () => ({
  recordLeadSignal: vi.fn(),
  recordSkoolClick: vi.fn(),
}));

vi.mock('../services/email', () => ({ sendWorkshopConfirmationEmail: vi.fn() }));
vi.mock('../services/pdf', () => ({ extractTextFromBuffer: vi.fn() }));

import express from 'express';
import request from 'supertest';
import sessionSignupRouter from './session-signup';
import { recordLeadSignal } from '../services/salesLead';

const app = express();
app.use(express.json());
app.use('/api/session-signup', sessionSignupRouter);

const mockRecord = vi.mocked(recordLeadSignal);

describe('POST /api/session-signup/unlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecord.mockResolvedValue('lead_123');
  });

  it('puts them on the board and hands back the id the Skool link needs', async () => {
    const res = await request(app)
      .post('/api/session-signup/unlock')
      .send({ email: 'Grad@Example.com', sourceAsset: 'sponsors' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.leadId).toBe('lead_123');

    const arg = mockRecord.mock.calls[0][0];
    expect(arg.email).toBe('grad@example.com');
    expect(arg.source).toBe('free-resource');
    expect(arg.sourceAsset).toBe('sponsors');
  });

  /**
   * Taking a file is not a funnel stage. An empty signal set leaves them at
   * `Lead`, which is the honest answer: stamping `registeredAt` here would
   * inflate every registration number on the board with people who only ever
   * downloaded a PDF.
   */
  it('records no funnel signal, so the download cannot masquerade as a registration', async () => {
    await request(app).post('/api/session-signup/unlock').send({ email: 'grad@example.com' });

    expect(mockRecord.mock.calls[0][0].signals).toEqual({});
  });

  it('rejects an address that cannot receive anything', async () => {
    const res = await request(app).post('/api/session-signup/unlock').send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('rejects a missing address', async () => {
    const res = await request(app).post('/api/session-signup/unlock').send({});

    expect(res.status).toBe(400);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  /**
   * The half that has to hold. They have already given their email, so a
   * database having a bad minute must not cost them the file: the page releases
   * the download on a 200 and nothing else.
   */
  it('still releases the file when the board write fails', async () => {
    mockRecord.mockRejectedValue(new Error('db down'));

    const res = await request(app)
      .post('/api/session-signup/unlock')
      .send({ email: 'grad@example.com', sourceAsset: 'tracker' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.leadId).toBeNull();
  });

  it('does not let a hand-crafted sourceAsset run away with the column', async () => {
    await request(app)
      .post('/api/session-signup/unlock')
      .send({ email: 'grad@example.com', sourceAsset: 'x'.repeat(500) });

    expect(mockRecord.mock.calls[0][0].sourceAsset).toHaveLength(64);
  });

  it('treats a missing sourceAsset as unknown rather than empty string', async () => {
    await request(app).post('/api/session-signup/unlock').send({ email: 'grad@example.com' });

    expect(mockRecord.mock.calls[0][0].sourceAsset).toBeNull();
  });
});
