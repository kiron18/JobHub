/**
 * Deterministic resume sections: the parts the model was retyping.
 *
 * Education, certifications and the referees line are statements of fact the
 * profile already holds. Asking Claude to re-emit them costs output tokens at
 * the writing rate and, worse, gives it the opportunity to invent. Every hard
 * fabrication found in the model bake-off lived in a section like this.
 *
 * The rule this module lives by: splice a section only when the stored data can
 * render it AT LEAST as completely as the model would have. If a single
 * education entry is missing its dates, the whole section falls back to the
 * model, because a resume with dates on two degrees and not the third is worse
 * than one the model wrote. Nothing here degrades an output to save a token.
 *
 * Section ORDER is never decided here. The model places the heading where the
 * source resume had it (that order is the coach's call); this only fills the
 * body underneath.
 */

export type SectionKey = 'education' | 'certifications' | 'referees';

export interface ProfileSection {
  key: SectionKey;
  /** How the section is named if we have to write the heading ourselves. */
  heading: string;
  /** Recognises the heading the model actually wrote for this section. */
  matches: (heading: string) => boolean;
  body: string;
}

interface EducationRow {
  degree: string | null;
  field?: string | null;
  institution: string | null;
  location?: string | null;
  year?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface CertificationRow {
  name: string | null;
  issuingBody: string | null;
  year?: string | null;
}

export interface SectionSourceProfile {
  education?: EducationRow[];
  certifications?: CertificationRow[];
  resumeRawText?: string | null;
}

/**
 * A spliced fact is held to the same standard as a written one.
 *
 * Stored profile fields are extracted, not typed by the candidate, so a campus
 * or city can be inferred rather than read. If the resume does not contain it,
 * it does not go on the resume - the same rule the prompt gives the model.
 */
function groundedInResume(value: string, resumeRawText: string | null | undefined): boolean {
  if (!value) return false;
  const haystack = (resumeRawText ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const needle = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return needle.length > 2 && haystack.includes(needle);
}

/** What the prompt asks the model to write in place of a supplied section. */
export const SUPPLIED_MARKER = '[[SUPPLIED]]';

const clean = (s: string | null | undefined): string => (s ?? '').trim();

/**
 * Words that mean "this line is a qualification". Used to count what the resume
 * claims, not to parse it.
 */
const DEGREE_WORDS =
  /\b(bachelors?|masters?|doctorate|doctor of|phd|d\.?phil|mba|m\.?b\.?a|graduate diploma|postgraduate diploma|advanced diploma|diploma|associate degree|b\.?sc|b\.?a\b|b\.?e\b|b\.?tech|m\.?sc|m\.?a\b|m\.?tech|llb|llm)\b/gi;

/** A heading in an uploaded resume: a short line, usually shouted. */
const isHeadingLine = (t: string) => t.length > 0 && t.length < 60 && /^[A-Z][A-Z\s&/,.-]{3,}$/.test(t);

/**
 * The lines under the resume's own section heading, or null when there is no
 * such section. Null is decisive on its own: we neither add a section the
 * candidate never had, nor claim to have verified one we could not find.
 */
function resumeSection(resumeRawText: string | null | undefined, name: RegExp): string[] | null {
  const lines = (resumeRawText ?? '').split('\n');
  const start = lines.findIndex((l) => {
    const t = l.trim();
    return isHeadingLine(t) && name.test(t);
  });
  if (start === -1) return null;
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const t = line.trim();
    if (!t) continue;
    if (isHeadingLine(t)) break;
    body.push(t);
  }
  return body;
}

/**
 * Does the stored data account for everything the resume shows?
 *
 * This is the guard that matters. Extraction can miss an entry, and a splice
 * that renders two degrees over a resume that lists three does not look like a
 * bug: it looks like the candidate has one fewer qualification. Silently losing
 * a master's degree is far worse than any token this saves, so when the resume
 * appears to hold more than the profile does, the model keeps the section.
 *
 * Counted inside the education block only. A summary that mentions the degree
 * the candidate is studying is not a second degree.
 */
function resumeShowsMoreDegreesThan(rowCount: number, resumeRawText: string | null | undefined): boolean {
  const body = resumeSection(resumeRawText, /EDUCATION|QUALIFICATION|ACADEMIC/i);
  if (body === null) return true;
  const degreeLines = body.filter((l) => {
    DEGREE_WORDS.lastIndex = 0;
    return DEGREE_WORDS.test(l);
  });
  return degreeLines.length > rowCount;
}

/** How many certifications the resume's own block lists, or null if it has none. */
function certificationLineCount(resumeRawText: string | null | undefined): number | null {
  const body = resumeSection(resumeRawText, /CERTIFICAT|LICEN[CS]E|ACCREDITATION/i);
  return body === null ? null : body.length;
}

/**
 * The date span as the resume would show it. Returns '' when the row carries no
 * date at all, which is what disqualifies an education section from splicing.
 */
function educationDate(e: EducationRow): string {
  const year = clean(e.year);
  if (year) return year;
  const start = clean(e.startDate);
  const end = clean(e.endDate);
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

function renderEducation(rows: EducationRow[], resumeRawText: string | null | undefined): string | null {
  if (!rows.length) return null;
  // Completeness before all else: never render fewer qualifications than the
  // candidate has.
  if (resumeShowsMoreDegreesThan(rows.length, resumeRawText)) return null;

  const entries = rows.map((e) => {
    const degree = clean(e.degree);
    const institution = clean(e.institution);
    const date = educationDate(e);
    // Every entry must be complete. One thin entry disqualifies the section.
    if (!degree || !institution || !date) return null;

    const field = clean(e.field);
    // "Bachelor of Science" plus field "Chemistry" reads as one qualification,
    // but only when the degree does not already name the field.
    const title =
      field && !degree.toLowerCase().includes(field.toLowerCase())
        ? `${degree} (${field})`
        : degree;
    const location = clean(e.location);
    const place = [institution, groundedInResume(location, resumeRawText) ? location : '']
      .filter(Boolean)
      .join(', ');
    return `**${title}**  ·  ${date}\n${place}`;
  });

  if (entries.some((e) => e === null)) return null;
  return entries.join('\n\n');
}

function renderCertifications(
  rows: CertificationRow[],
  resumeRawText: string | null | undefined,
): string | null {
  if (!rows.length) return null;
  const inResume = certificationLineCount(resumeRawText);
  // No such section in the resume, or more entries there than we hold: leave it.
  if (inResume === null || inResume > rows.length) return null;

  const entries = rows.map((c) => {
    const name = clean(c.name);
    if (!name) return null;
    // Issuer and year are genuinely optional on a certification line, unlike a
    // degree's dates: plenty of real resumes list the certificate alone.
    const tail = [clean(c.issuingBody), clean(c.year)].filter(Boolean).join(', ');
    return tail ? `- ${name} (${tail})` : `- ${name}`;
  });
  if (entries.some((e) => e === null)) return null;
  return entries.join('\n');
}

/**
 * "Available upon request." is only ours to write when the candidate did not
 * name actual referees. If they did, the model keeps the section.
 */
function renderReferees(resumeRawText: string | null | undefined): string | null {
  const text = (resumeRawText ?? '').toLowerCase();
  const idx = text.search(/ref(?:e|f)r(?:ee|ees|ence|ences)\b/);
  if (idx === -1) return 'Available upon request.';
  const after = text.slice(idx, idx + 200);
  return /available\s+(?:up)?on\s+request/.test(after) ? 'Available upon request.' : null;
}

/**
 * Which sections can be rendered from stored data right now. Anything not
 * returned here stays the model's job, and the prompt is left untouched for it.
 */
export function buildProfileSections(profile: SectionSourceProfile): ProfileSection[] {
  const out: ProfileSection[] = [];

  const education = renderEducation(profile.education ?? [], profile.resumeRawText);
  if (education) {
    out.push({
      key: 'education',
      heading: '## Education',
      matches: (h) => /^education\b/i.test(h),
      body: education,
    });
  }

  const certifications = renderCertifications(profile.certifications ?? [], profile.resumeRawText);
  if (certifications) {
    out.push({
      key: 'certifications',
      heading: '## Certifications',
      // "Courses & Certifications", "Certifications & Eligibility" all mean this.
      matches: (h) => /certificat/i.test(h),
      body: certifications,
    });
  }

  const referees = renderReferees(profile.resumeRawText);
  if (referees) {
    out.push({
      key: 'referees',
      heading: '## Referees',
      matches: (h) => /^refer(?:ee|ence)/i.test(h),
      body: referees,
    });
  }

  return out;
}

const hasMarker = (block: string) => block.includes(SUPPLIED_MARKER);

export interface SpliceResult {
  content: string;
  applied: SectionKey[];
  appended: SectionKey[];
  orphanedMarkers: number;
}

/**
 * Fill the supplied sections in, leaving every heading exactly where the model
 * put it. Section order is the candidate's own and is never decided here.
 *
 * Four passes, in decreasing confidence:
 *   1. the heading says which section it is;
 *   2. the heading is unrecognised but carries the placeholder, so it is still
 *      a slot the model meant for us, matched to whatever is left;
 *   3. a placeholder with nothing to put in it is deleted, along with its
 *      heading if that leaves the section empty, because a stray "[[SUPPLIED]]"
 *      on a candidate's resume is the worst outcome available;
 *   4. a section whose heading never appeared is appended at the end. A wrong
 *      position is a visible defect; a trailing section is merely a plain one.
 */
export function spliceProfileSections(
  markdown: string,
  sections: ProfileSection[],
): SpliceResult {
  if (!sections.length) {
    // The model should never emit a marker when nothing was supplied, but a
    // hallucinated one must still not reach the candidate.
    return {
      content: markdown.split(SUPPLIED_MARKER).join('').trimEnd(),
      applied: [],
      appended: [],
      orphanedMarkers: 0,
    };
  }

  const applied: SectionKey[] = [];
  const used = new Set<SectionKey>();

  const headingOf = (block: string): string | null => {
    const m = block.match(/^## (.+?)\s*$/m);
    return m ? m[1].trim() : null;
  };

  const fill = (block: string, section: ProfileSection): string => {
    const heading = headingOf(block) ?? section.heading.replace(/^##\s*/, '');
    used.add(section.key);
    applied.push(section.key);
    // Keep the model's own heading wording; only the body is ours.
    return `## ${heading}\n\n${section.body}\n`;
  };

  let blocks = markdown.split(/\n(?=## )/);

  // Pass 1: the heading names the section.
  blocks = blocks.map((block) => {
    const heading = headingOf(block);
    if (!heading) return block;
    const section = sections.find((s) => !used.has(s.key) && s.matches(heading));
    return section ? fill(block, section) : block;
  });

  // Pass 2: a placeholder we could not name, matched to whatever is left.
  blocks = blocks.map((block) => {
    if (!hasMarker(block)) return block;
    const section = sections.find((s) => !used.has(s.key));
    return section ? fill(block, section) : block;
  });

  // Pass 3: no marker may survive.
  let orphanedMarkers = 0;
  blocks = blocks
    .map((block) => {
      if (!hasMarker(block)) return block;
      orphanedMarkers++;
      const withoutMarker = block
        .split('\n')
        .filter((l) => !l.includes(SUPPLIED_MARKER))
        .join('\n');
      const bodyOnly = withoutMarker.replace(/^## .+$/m, '').trim();
      // Nothing but the heading was there: drop the whole empty section.
      return bodyOnly.length ? withoutMarker.trimEnd() : '';
    })
    .filter((b) => b.trim().length > 0);

  let content = blocks.join('\n');

  // Pass 4: a section the model never made room for.
  const appended: SectionKey[] = [];
  for (const s of sections) {
    if (used.has(s.key)) continue;
    content = `${content.replace(/\s+$/, '')}\n\n${s.heading}\n\n${s.body}\n`;
    appended.push(s.key);
  }

  return { content, applied, appended, orphanedMarkers };
}
