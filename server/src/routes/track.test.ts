/**
 * /api/track is public, so what it refuses matters as much as what it keeps:
 * only allowlisted events and property keys, and who the event belongs to in
 * a fixed order (account, PostHog id, our visitor id).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/auth', () => ({
  optionalAuthenticate: (req: any, _res: any, next: any) => {
    if (req.headers.authorization) req.user = { id: 'user-1' };
    next();
  },
}));
vi.mock('../lib/posthogServer', () => ({ captureServerEvent: vi.fn() }));

import { captureServerEvent } from '../lib/posthogServer';
import { trackRouter } from './track';

const capture = captureServerEvent as any;
const app = express();
app.use(express.json());
app.use('/api/track', trackRouter);

const post = (body: unknown, auth = false) => {
  const r = request(app).post('/api/track').set('Origin', 'https://www.aussiegradcareers.com.au');
  return (auth ? r.set('Authorization', 'Bearer x') : r).send(body as object);
};

beforeEach(() => capture.mockClear());

describe('POST /api/track', () => {
  it('records an allowlisted event on the visitor id, with the live host', async () => {
    const res = await post({ event: 'welcome_step_viewed', vid: 'abc-123', props: { step: 'upload', step_index: 0 } });
    expect(res.status).toBe(204);
    expect(capture).toHaveBeenCalledWith({
      distinctId: 'visitor:abc-123',
      event: 'welcome_step_viewed',
      properties: expect.objectContaining({ step: 'upload', step_index: 0, $host: 'www.aussiegradcareers.com.au', posthog_blocked: true }),
    });
  });

  it('prefers the PostHog id over the visitor id, and the account over both', async () => {
    await post({ event: 'email_outcome', ph_id: 'ph-1', vid: 'v1', props: { outcome: 'new_account' } });
    expect(capture.mock.calls[0][0].distinctId).toBe('ph-1');
    expect(capture.mock.calls[0][0].properties.posthog_blocked).toBeUndefined();

    await post({ event: 'trial_offer_viewed', ph_id: 'ph-1', vid: 'v1', props: { day: 1 } }, true);
    expect(capture.mock.calls[1][0].distinctId).toBe('user-1');
  });

  it('ignores events that are not on the list', async () => {
    const res = await post({ event: 'payment_completed', vid: 'v1' });
    expect(res.status).toBe(204);
    expect(capture).not.toHaveBeenCalled();
  });

  it('drops property keys that are not on the list', async () => {
    await post({ event: 'email_submitted', vid: 'v1', props: { email_domain: 'gmail.com', email: 'a@gmail.com', $set: { admin: true } } });
    const props = capture.mock.calls[0][0].properties;
    expect(props.email_domain).toBe('gmail.com');
    expect(props.email).toBeUndefined();
    expect(props.$set).toBeUndefined();
  });

  it('records nothing when there is no way to say whose it is', async () => {
    await post({ event: 'welcome_step_viewed', vid: 'not a valid id!' });
    expect(capture).not.toHaveBeenCalled();
  });
});
