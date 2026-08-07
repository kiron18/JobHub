import { describe, it, expect } from 'vitest';
import {
  parseSeekJobId,
  parseSeekJobPage,
  canonicalSeekUrl,
  SeekUrlError,
} from './seekJobUrl';

describe('parseSeekJobId', () => {
  it('reads the id off the split-view search URL, ignoring the slug', () => {
    // The slug says "social-media-marketing-coordinator" but job 93620753 is
    // actually a "Junior Marketing & Communications Coordinator". Trusting the
    // URL text would tailor the resume to the wrong role.
    expect(
      parseSeekJobId(
        'https://au.seek.com/social-media-marketing-coordinator-jobs/in-All-Sydney-NSW?jobId=93620753&type=promoted',
      ),
    ).toBe('93620753');
  });

  it('reads the canonical job URL', () => {
    expect(parseSeekJobId('https://www.seek.com.au/job/93620753')).toBe('93620753');
    expect(parseSeekJobId('https://www.seek.com.au/job/93620753?type=standout')).toBe('93620753');
  });

  it('accepts either Seek host and a missing scheme', () => {
    expect(parseSeekJobId('www.seek.com.au/job/93620753')).toBe('93620753');
    expect(parseSeekJobId('https://au.seek.com/job/93620753')).toBe('93620753');
  });

  it('is case-insensitive about the jobId param', () => {
    expect(parseSeekJobId('https://au.seek.com/jobs?jobid=93620753')).toBe('93620753');
  });

  it('rejects a search page with no job selected', () => {
    expect(() => parseSeekJobId('https://www.seek.com.au/business-analyst-jobs/in-All-Sydney-NSW'))
      .toThrow(/search results page/i);
  });

  it('rejects non-Seek links and non-links', () => {
    expect(() => parseSeekJobId('https://www.linkedin.com/jobs/view/4438464998')).toThrow(SeekUrlError);
    expect(() => parseSeekJobId('hello world')).toThrow(SeekUrlError);
    expect(() => parseSeekJobId('')).toThrow(SeekUrlError);
  });

  it('tags each rejection with a code the UI can branch on', () => {
    const codeOf = (url: string) => {
      try {
        parseSeekJobId(url);
        return 'no_error';
      } catch (e: any) {
        return e.code;
      }
    };
    expect(codeOf('https://www.seek.com.au/business-analyst-jobs/in-Sydney')).toBe('search_page');
    expect(codeOf('https://example.com/job/1')).toBe('not_seek');
    expect(codeOf('nonsense')).toBe('not_a_url');
  });
});

describe('canonicalSeekUrl', () => {
  it('always points at the canonical host', () => {
    expect(canonicalSeekUrl('93620753')).toBe('https://www.seek.com.au/job/93620753');
  });
});

describe('parseSeekJobPage', () => {
  const page = (details: string, title = 'Junior Marketing &amp; Communications Coordinator') => `
    <html><body>
      <h1 data-automation="job-detail-title">${title}</h1>
      <span data-automation="advertiser-name">Iscar Australia Pty Ltd</span>
      <span data-automation="job-detail-location">Norwest, Sydney NSW</span>
      <span data-automation="job-detail-work-type">Full time</span>
      <span data-automation="job-detail-classifications">Marketing Assistants/Coordinators</span>
      <div data-automation="jobAdDetails">${details}</div>
    </body></html>`;

  const longAd = `
    <p>Launch Your Marketing Career with Us!</p>
    <p>${'We are looking for a motivated coordinator to join our growing team. '.repeat(8)}</p>
    <ul><li>Create social content</li><li>Run email campaigns</li><li>Support events</li></ul>`;

  it('pulls title, company and metadata off the detail page', () => {
    const job = parseSeekJobPage(page(longAd), '93620753');
    expect(job.title).toBe('Junior Marketing & Communications Coordinator');
    expect(job.company).toBe('Iscar Australia Pty Ltd');
    expect(job.location).toBe('Norwest, Sydney NSW');
    expect(job.workType).toBe('Full time');
    expect(job.sourceUrl).toBe('https://www.seek.com.au/job/93620753');
  });

  it('keeps list items as separate bulleted lines', () => {
    const job = parseSeekJobPage(page(longAd), '93620753');
    const bullets = job.description.split('\n').filter((l) => l.startsWith('•'));
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toContain('Create social content');
  });

  it('strips scripts and styles out of the description', () => {
    const job = parseSeekJobPage(page(`${longAd}<script>alert(1)</script><style>.x{}</style>`), '1');
    expect(job.description).not.toContain('alert(1)');
    expect(job.description).not.toContain('.x{}');
  });

  it('rejects a too-short ad rather than passing it to generation', () => {
    expect(() => parseSeekJobPage(page('<p>Expired</p>'), '1')).toThrow(SeekUrlError);
    try {
      parseSeekJobPage(page('<p>Expired</p>'), '1');
    } catch (e: any) {
      expect(e.code).toBe('too_short');
    }
  });

  it('rejects a page with no title even when there is body text', () => {
    const html = `<html><body><div data-automation="jobAdDetails">${longAd}</div></body></html>`;
    expect(() => parseSeekJobPage(html, '1')).toThrow(SeekUrlError);
  });

  it('falls back to a placeholder company rather than failing', () => {
    const html = `
      <html><body>
        <h1 data-automation="job-detail-title">Analyst</h1>
        <div data-automation="jobAdDetails">${longAd}</div>
      </body></html>`;
    expect(parseSeekJobPage(html, '1').company).toBe('Unknown company');
  });
});
