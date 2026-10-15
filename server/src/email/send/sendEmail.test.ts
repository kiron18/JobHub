import { describe, it, expect, afterEach } from 'vitest';
import { trackingBaseUrl, injectEmailTracking } from './sendEmail';
import { withScheme } from '../../lib/appUrl';

const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

describe('withScheme', () => {
  it('adds https to a bare host, the way production had it set', () => {
    expect(withScheme('www.aussiegradcareers.com.au')).toBe('https://www.aussiegradcareers.com.au');
  });
  it('leaves a full URL alone and drops a trailing slash', () => {
    expect(withScheme('https://www.aussiegradcareers.com.au/')).toBe('https://www.aussiegradcareers.com.au');
  });
});

describe('trackingBaseUrl', () => {
  it('uses API_URL when set', () => {
    expect(trackingBaseUrl(env({ API_URL: 'https://api.example.com/api' }))).toBe('https://api.example.com/api');
  });
  it('falls back to the Railway public domain', () => {
    expect(trackingBaseUrl(env({ RAILWAY_PUBLIC_DOMAIN: 'jobhub-production-f138.up.railway.app' })))
      .toBe('https://jobhub-production-f138.up.railway.app/api');
  });
  it('never returns localhost', () => {
    expect(trackingBaseUrl(env({ API_URL: 'http://localhost:3002/api' }))).toBeNull();
    expect(trackingBaseUrl(env({}))).toBeNull();
  });
});

describe('injectEmailTracking', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('sends the email untouched when there is no public tracker', () => {
    delete process.env.API_URL;
    delete process.env.RAILWAY_PUBLIC_DOMAIN;
    const html = '<a href="https://www.aussiegradcareers.com.au/">Start here</a>';
    expect(injectEmailTracking(html, 'id1')).toBe(html);
  });

  it('routes our own links through the tracker and leaves others alone', () => {
    process.env.API_URL = 'https://api.example.com/api';
    const out = injectEmailTracking(
      '<a href="https://www.aussiegradcareers.com.au/">a</a><a href="https://hunter.io">b</a>', 'id1');
    expect(out).toContain('href="https://api.example.com/api/email/track/click/id1?url=');
    expect(out).toContain('href="https://hunter.io"');
    expect(out).toContain('src="https://api.example.com/api/email/track/open/id1"');
    expect(out).not.toContain('localhost');
  });
});
