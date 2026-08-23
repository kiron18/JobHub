// Turning a Seek page into a tracker row. No browser in this file, on purpose.
//
// Why the extension exists at all: 36% of the tracker had no employer name,
// and not because the ads were anonymous. Seek renders the advertiser in the
// page header, in `advertiser-name`, which sits OUTSIDE the block a person
// selects when they copy a job description. So the name was never in the paste.
// Reading it here, in the page the candidate already has open, is the only
// place that costs nothing and asks no server to go fetch anything.
//
// The DOM half lives in collect.js. This half takes the strings it found and
// decides whether they amount to a job, which is the part worth testing.

/** Seek's own hooks. Stable, and what the server-side parser already uses. */
export const FIELDS = {
  title: 'job-detail-title',
  company: 'advertiser-name',
  description: 'jobAdDetails',
  location: 'job-detail-location',
  workType: 'job-detail-work-type',
  classification: 'job-detail-classifications',
};

/** Below this, whatever was read is not a job ad. Mirrors the server. */
export const MIN_DESCRIPTION_CHARS = 400;

/** How many a candidate can queue before sending. A shape check, not a quota. */
export const MAX_BASKET = 10;

const CANONICAL_HOST = 'https://au.seek.com';

/**
 * The job id out of any Seek URL shape: /job/123, /job/123?type=..., with or
 * without a locale segment. Null when the URL is not a job page.
 */
export function jobIdFromUrl(url) {
  const m = String(url || '').match(/\/job\/(\d{6,12})\b/);
  return m ? m[1] : null;
}

export function canonicalUrl(jobId) {
  return `${CANONICAL_HOST}/job/${jobId}`;
}

const squash = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

/**
 * Build a record from whatever the page gave up.
 *
 * `read` is a function from a data-automation name to a string or null, so the
 * tests can hand over a plain object and never need a DOM.
 *
 * Returns { ok: true, record } or { ok: false, reason } — a reason a person can
 * read, because it goes straight onto the button.
 */
export function buildRecord({ read, url }) {
  const jobId = jobIdFromUrl(url);
  if (!jobId) return { ok: false, reason: 'Open a job ad first' };

  const title = squash(read(FIELDS.title));
  if (!title) return { ok: false, reason: 'Could not read the job title' };

  // Deliberately not squashed: the paragraph breaks are what the generator
  // reads as bullet boundaries downstream.
  const description = String(read(FIELDS.description) || '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (description.length < MIN_DESCRIPTION_CHARS) {
    return { ok: false, reason: 'The ad body did not load — scroll it into view and retry' };
  }

  // The one field this whole feature is for. Absent is a real answer: some ads
  // genuinely are posted without an advertiser, and inventing one here would
  // put a wrong name into a follow-up email later.
  const company = squash(read(FIELDS.company)) || null;

  return {
    ok: true,
    record: {
      jobId,
      title,
      company,
      description,
      sourceUrl: canonicalUrl(jobId),
      location: squash(read(FIELDS.location)) || null,
      workType: squash(read(FIELDS.workType)) || null,
      classification: squash(read(FIELDS.classification)) || null,
      capturedAt: new Date().toISOString(),
    },
  };
}

/**
 * Add to the basket. Same job twice is a no-op rather than an error: clicking
 * Save on a job you already saved should feel like nothing happened, not like
 * a mistake.
 */
export function addToBasket(basket, record) {
  const list = Array.isArray(basket) ? basket : [];
  if (list.some((r) => r.jobId === record.jobId)) {
    return { basket: list, added: false, reason: 'Already saved' };
  }
  if (list.length >= MAX_BASKET) {
    return { basket: list, added: false, reason: `That is ${MAX_BASKET}. Send them first.` };
  }
  return { basket: [...list, record], added: true };
}

export function removeFromBasket(basket, jobId) {
  return (Array.isArray(basket) ? basket : []).filter((r) => r.jobId !== jobId);
}

/** What actually goes over the wire. The extras stay local. */
export function toPayload(basket) {
  return (Array.isArray(basket) ? basket : []).map((r) => ({
    title: r.title,
    company: r.company,
    description: r.description,
    sourceUrl: r.sourceUrl,
  }));
}
