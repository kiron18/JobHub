import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';

vi.mock('../../index', () => ({ prisma: {} }));

import { verifySvixSignature } from './resendWebhook';

const SECRET = 'whsec_' + Buffer.from('a-test-signing-key-32-bytes-long').toString('base64');
const sign = (id: string, ts: string, body: string) =>
  'v1,' + crypto.createHmac('sha256', Buffer.from(SECRET.slice(6), 'base64')).update(`${id}.${ts}.${body}`).digest('base64');

describe('verifySvixSignature', () => {
  const now = 1_760_000_000;
  const ts = String(now);
  const body = '{"type":"email.delivered","data":{"email_id":"x"}}';

  it('accepts a correctly signed event', () => {
    expect(verifySvixSignature(body, { id: 'msg_1', timestamp: ts, signature: sign('msg_1', ts, body) }, SECRET, now)).toBe(true);
  });

  it('accepts when one of several signatures matches (a key roll)', () => {
    const sig = `v1,bm9wZQ== ${sign('msg_1', ts, body)}`;
    expect(verifySvixSignature(body, { id: 'msg_1', timestamp: ts, signature: sig }, SECRET, now)).toBe(true);
  });

  it('refuses a changed body', () => {
    expect(verifySvixSignature(body + ' ', { id: 'msg_1', timestamp: ts, signature: sign('msg_1', ts, body) }, SECRET, now)).toBe(false);
  });

  it('refuses an old event', () => {
    expect(verifySvixSignature(body, { id: 'msg_1', timestamp: ts, signature: sign('msg_1', ts, body) }, SECRET, now + 600)).toBe(false);
  });

  it('refuses everything when no secret is set', () => {
    expect(verifySvixSignature(body, { id: 'msg_1', timestamp: ts, signature: sign('msg_1', ts, body) }, '', now)).toBe(false);
  });
});
