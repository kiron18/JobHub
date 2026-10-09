/**
 * Reads the contact details off a resume, for the upload at the top of the
 * sales board.
 *
 * The model does the reading. A resume puts its name in a header, its phone
 * number in six formats and its job title wherever the template felt like, and
 * a regex gets the easy half and silently mangles the rest. The regex below is
 * only the net under the model: if the call fails, an email address and a
 * phone number are still better than an empty form.
 *
 * Nothing here is invented. Every field is "what the document says, or null",
 * and the prompt says so, because a guessed phone number on a sales board is a
 * call to a stranger.
 */
import { callLLM } from './llm';

/**
 * The buckets the board groups by.
 *
 * Fixed and short on purpose. The job title on a resume is different on every
 * row ("Graduate Data Analyst", "Junior BI Developer", "Reporting Analyst"),
 * so sorting by it arranges nothing. These are broad enough that a list of
 * forty people falls into a handful of groups.
 */
export const PROFESSIONS = [
  'Software & IT',
  'Data & Analytics',
  'Engineering',
  'Accounting & Finance',
  'Business & Project',
  'Marketing & Sales',
  'Healthcare',
  'Science & Research',
  'Supply Chain & Logistics',
  'HR & Admin',
  'Design & Creative',
  'Education',
  'Hospitality & Trades',
  'Other',
] as const;

export interface ResumeContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  jobTitle: string | null;
  profession: string | null;
  company: string | null;
  linkedinUrl: string | null;
  visaStatus: string | null;
  education: string | null;
}

export const EMPTY_CONTACT: ResumeContact = {
  name: null, email: null, phone: null, location: null, jobTitle: null,
  profession: null, company: null, linkedinUrl: null, visaStatus: null, education: null,
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
/** Australian mobiles and landlines first, then anything long enough with a +. */
const PHONE_RE = /(?:\+?61[\s-]?|\(?0)[2-478]\)?(?:[\s-]?\d){8}|\+\d[\d\s().-]{8,16}\d/;

/** The net under the model. Email and phone only: the rest cannot be guessed. */
export function fallbackContact(text: string): ResumeContact {
  return {
    ...EMPTY_CONTACT,
    email: EMAIL_RE.exec(text)?.[0]?.toLowerCase() ?? null,
    phone: PHONE_RE.exec(text)?.[0]?.replace(/\s+/g, ' ').trim() ?? null,
  };
}

function clean(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  if (!s || /^(null|none|n\/a|unknown|not (stated|specified|provided|found))$/i.test(s)) return null;
  return s.slice(0, max);
}

/** Turn whatever the model returned into the shape above, trusting none of it. */
export function normaliseContact(raw: any, text: string): ResumeContact {
  const net = fallbackContact(text);

  const email = clean(raw?.email)?.toLowerCase() ?? null;
  const profession = clean(raw?.profession);
  let linkedin = clean(raw?.linkedinUrl, 300);
  if (linkedin && !/linkedin\.com/i.test(linkedin)) linkedin = null;
  if (linkedin && !/^https?:\/\//i.test(linkedin)) linkedin = `https://${linkedin.replace(/^\/+/, '')}`;

  return {
    name: clean(raw?.name, 120),
    // An address the model returned that is not shaped like one is worse than
    // the one the regex found in the document itself.
    email: email && EMAIL_RE.test(email) ? email : net.email,
    phone: clean(raw?.phone, 40) ?? net.phone,
    location: clean(raw?.location, 120),
    jobTitle: clean(raw?.jobTitle, 120),
    profession: profession && (PROFESSIONS as readonly string[]).includes(profession) ? profession : (profession ? 'Other' : null),
    company: clean(raw?.company, 120),
    linkedinUrl: linkedin,
    visaStatus: clean(raw?.visaStatus, 120),
    education: clean(raw?.education, 200),
  };
}

function prompt(text: string): string {
  return [
    'Read the contact details off this resume. Return ONE JSON object with exactly these keys:',
    '',
    '  name         the person\'s full name, in normal capitalisation',
    '  email        their email address',
    '  phone        their phone number, as written',
    '  location     where they live now, as "Suburb or City, State" (for example "Parramatta, NSW")',
    '  jobTitle     the title of their current or most recent job. If they have never worked, the role they say they are after',
    `  profession   the ONE best fit from this list, copied exactly: ${PROFESSIONS.join(' | ')}`,
    '  company      the employer for that current or most recent job',
    '  linkedinUrl  their LinkedIn profile URL',
    '  visaStatus   their visa or work rights, ONLY if the resume states it (for example "485 Graduate visa, full work rights")',
    '  education    their highest qualification and where, as "Master of Data Science, UNSW (2024)"',
    '',
    'Rules:',
    '- Use only what is written in the resume. Use null for anything it does not say. Never guess.',
    '- profession is a judgement about their field, from the work and study described. It is the one key that is never null.',
    '',
    'RESUME:',
    // The details asked for are all in the first page or two. The cap keeps a
    // twelve-page academic CV from costing ten times what a normal one does.
    text.slice(0, 14_000),
  ].join('\n');
}

/**
 * Parse a resume's text into contact details.
 *
 * Never throws. `parsed` says whether the model actually read it, so the
 * caller can tell "this resume has no phone number" from "the reader fell over
 * and these are regex scraps".
 */
export async function parseResumeContact(text: string): Promise<{ contact: ResumeContact; parsed: boolean }> {
  const body = (text || '').trim();
  if (!body) return { contact: { ...EMPTY_CONTACT }, parsed: false };

  try {
    const out = await callLLM(prompt(body), true, 0, 700);
    const json = typeof out === 'string'
      ? JSON.parse(out.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim())
      : out;
    return { contact: normaliseContact(json, body), parsed: true };
  } catch (err) {
    console.error('[resumeContact] model read failed, falling back to email and phone only', err);
    return { contact: fallbackContact(body), parsed: false };
  }
}
