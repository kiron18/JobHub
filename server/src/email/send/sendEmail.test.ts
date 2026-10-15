import { describe, it, expect } from 'vitest';
import { tagEmailLinks, tagTextLinks, emailHasLinks } from './sendEmail';
import { withScheme } from '../../lib/appUrl';

const ID = '0b5c8a52-3f0e-4c3e-9a51-6f1d2b7e9c10';

describe('withScheme', () => {
  it('adds https to a bare host, the way production had it set', () => {
    expect(withScheme('www.aussiegradcareers.com.au')).toBe('https://www.aussiegradcareers.com.au');
  });
  it('leaves a full URL alone and drops a trailing slash', () => {
    expect(withScheme('https://www.aussiegradcareers.com.au/')).toBe('https://www.aussiegradcareers.com.au');
  });
});

describe('tagEmailLinks', () => {
  it('tags our own links and leaves every other link exactly as written', () => {
    const out = tagEmailLinks(
      '<a href="https://www.aussiegradcareers.com.au/">a</a><a href="https://hunter.io">b</a><a href="https://meet.google.com/abc-defg-hij">c</a>',
      ID,
    );
    expect(out).toContain(`href="https://www.aussiegradcareers.com.au/?e=${ID}"`);
    expect(out).toContain('href="https://hunter.io"');
    expect(out).toContain('href="https://meet.google.com/abc-defg-hij"');
  });

  it('never points anywhere but the original page: no redirect host, no localhost, no pixel', () => {
    const out = tagEmailLinks('<a href="https://www.aussiegradcareers.com.au/pricing">a</a>', ID);
    expect(out).not.toMatch(/localhost|railway|track\/click|<img/);
  });

  it('keeps the query the page relies on, and the fragment', () => {
    const out = tagEmailLinks('<a href="https://www.aussiegradcareers.com.au/?trial=continue#top">a</a>', ID);
    expect(out).toContain(`href="https://www.aussiegradcareers.com.au/?trial=continue&amp;e=${ID}#top"`);
  });

  it('reads an escaped ampersand as one', () => {
    const out = tagEmailLinks('<a href="https://aussiegradcareers.com.au/community?src=email&amp;x=1">a</a>', ID);
    expect(out).toContain(`href="https://aussiegradcareers.com.au/community?src=email&amp;x=1&amp;e=${ID}"`);
  });

  it('leaves a login-token email alone', () => {
    const html = '<a href="https://www.aussiegradcareers.com.au/set-password#token=abc">a</a>';
    expect(tagEmailLinks(html, ID, { trackLinks: false })).toBe(html);
  });
});

describe('tagTextLinks', () => {
  it('tags a bare link and keeps trailing punctuation outside it', () => {
    const out = tagTextLinks('Open https://aussiegradcareers.com.au/tracker. Or https://hunter.io', ID);
    expect(out).toBe(`Open https://aussiegradcareers.com.au/tracker?e=${ID}. Or https://hunter.io`);
  });
});

describe('emailHasLinks', () => {
  it('counts only links to our own site, since only those can be counted', () => {
    expect(emailHasLinks('<a href="https://hunter.io">x</a>')).toBe(false);
    expect(emailHasLinks('<a href="https://www.aussiegradcareers.com.au/">x</a>')).toBe(true);
  });
});
