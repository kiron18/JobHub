import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import healthRouter from '../routes/health';

const app = express();
app.use('/api/health', healthRouter);

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('includes a timestamp in the response', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).toHaveProperty('timestamp');
    expect(typeof res.body.timestamp).toBe('string');
  });
});
