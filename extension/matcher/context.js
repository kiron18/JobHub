// Who is this application to, and for what job?
//
// Two placeholders in the bank need filling before an answer can be pasted:
// {{company}} and {{role}}. Getting them from the page beats asking, because the
// candidate is applying to twenty-five of these a week and every prompt is a
// reason to stop.
//
// The applicant-tracking systems are the reliable half: their URLs carry the
// employer's own slug, and that slug is right even when the page title is
// "Job Application". Everything else falls back to reading the title.
//
// Pure functions over plain data, so the whole thing is testable without a
// browser: the content script gathers url/title/headings and hands them over.

const ATS = [
  {
    id: 'greenhouse',
    host: /(^|\.)greenhouse\.io$/,
    // Embedded boards carry the employer in ?for=, not in the path.
    company: (u) => u.searchParams.get('for') || (seg(u, 0) === 'embed' ? null : seg(u, 0)),
  },
  { id: 'lever', host: /(^|\.)lever\.co$/, company: (u) => seg(u, 0) },
  { id: 'workable', host: /(^|\.)workable\.com$/, company: (u) => seg(u, 0) },
  { id: 'smartrecruiters', host: /(^|\.)smartrecruiters\.com$/, company: (u) => seg(u, 0) },
  { id: 'jobvite', host: /(^|\.)jobvite\.com$/, company: (u) => seg(u, 0) },
  { id: 'ashby', host: /(^|\.)ashbyhq\.com$/, company: (u) => seg(u, 0) },
  { id: 'bamboohr', host: /\.bamboohr\.com$/, company: (u) => sub(u, 0) },
  { id: 'workday', host: /\.myworkdayjobs\.com$/, company: (u) => sub(u, 0) },
  { id: 'recruitee', host: /\.recruitee\.com$/, company: (u) => sub(u, 0) },
  { id: 'teamtailor', host: /\.teamtailor\.com$/, company: (u) => sub(u, 0) },
  { id: 'livehire', host: /(^|\.)livehire\.com$/, company: () => null },
  { id: 'pageuppeople', host: /(^|\.)pageuppeople\.com$/, company: (u) => sub(u, 0) },
  // Job boards: the URL says the board, never the employer. Read the page.
  { id: 'seek', host: /(^|\.)seek\.com\.au$/, company: () => null, board: true },
  { id: 'indeed', host: /(^|\.)indeed\.com(\.au)?$/, company: () => null, board: true },
  { id: 'linkedin', host: /(^|\.)linkedin\.com$/, company: () => null, board: true },
];

const seg = (u, i) => u.pathname.split('/').filter(Boolean)[i] || null;
const sub = (u, i) => u.hostname.split('.')[i] || null;

/** Subdomains that name the function, not the employer. */
const FUNCTION_LABEL = /^(www|careers?|jobs?|apply|application|boards?|job-boards?|talent|recruiting|recruitment|hiring|work|join|people|hr|my|secure|portal|erecruit|employment)$/i;

const TLD = /^(com|net|org|edu|gov|io|co|ai|app|dev|au|nz|uk|us|ca|sg|in|info|biz|group|global|health|careers?|jobs?)$/i;

/**
 * Words a page title uses that are never part of a company or a role. The job
 * boards are in here because "Graduate Analyst - Canva - SEEK" would otherwise
 * have every candidate applying to SEEK.
 */
const TITLE_NOISE = /^(careers?|jobs?|job|apply|apply now|application|job application|employment|vacanc(y|ies)|opportunit(y|ies)|home|current openings?|open roles?|we are hiring|we're hiring|join us|hiring|seek|seek\.com\.au|indeed|indeed\.com(\.au)?|linkedin|glassdoor|jora|careerone|adzuna|workforce australia|job search)$/i;

const APPLY_PREFIX = /^(apply (?:now )?(?:for|to)?:?\s*|application for:?\s*|job application:?\s*|now hiring:?\s*|hiring:?\s*)/i;

/** `senior-data-analyst` -> `Senior Data Analyst`, leaving deliberate casing alone. */
export function humanise(slug) {
  if (!slug) return null;
  const words = String(slug).replace(/[_+]/g, '-').split(/[-\s.]+/).filter(Boolean);
  if (!words.length) return null;
  return words
    .map((w) => (/[A-Z]/.test(w.slice(1)) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Company from a plain corporate host: careers.canva.com -> Canva. */
function companyFromHost(hostname) {
  const labels = hostname.split('.').filter(Boolean);
  while (labels.length > 1 && FUNCTION_LABEL.test(labels[0])) labels.shift();
  while (labels.length > 1 && TLD.test(labels[labels.length - 1])) labels.pop();
  const name = labels[labels.length - 1];
  return name && !FUNCTION_LABEL.test(name) ? humanise(name) : null;
}

const splitTitle = (t) =>
  String(t || '')
    .split(/\s*[|·•]\s*|\s+[-–—]\s+|\s+@\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

const looksLikeRole = (s) =>
  !!s && s.length >= 3 && s.length <= 90 && !TITLE_NOISE.test(s) && !/^https?:/i.test(s);

/**
 * @param {object} page  { url, title, headings: string[], meta: {siteName, title} }
 * @returns {{company, role, ats, board, source: {company, role}}}
 */
export function pageContext(page = {}) {
  const { url = '', title = '', headings = [], meta = {} } = page;

  let u = null;
  try { u = new URL(url); } catch { /* about:blank and friends */ }

  let company = null;
  let companySource = null;
  let ats = null;
  let board = false;

  if (u) {
    const hit = ATS.find((a) => a.host.test(u.hostname));
    if (hit) {
      ats = hit.id;
      board = !!hit.board;
      const slug = hit.company(u);
      if (slug && !FUNCTION_LABEL.test(slug)) {
        company = humanise(slug);
        companySource = `${hit.id} url`;
      }
    }
  }

  if (!company && meta.siteName && !TITLE_NOISE.test(meta.siteName.trim())) {
    company = meta.siteName.trim();
    companySource = 'og:site_name';
  }

  // Only for a company's own site. On an ATS the hostname names the vendor, so
  // falling back to it would have half the country applying to Livehire.
  if (!company && u && !ats) {
    const fromHost = companyFromHost(u.hostname);
    if (fromHost) {
      company = fromHost;
      companySource = 'hostname';
    }
  }

  // A board page hides the employer in the title: "Graduate Analyst - Canva - SEEK".
  const parts = splitTitle(meta.title || title);
  if (!company && parts.length >= 2) {
    const candidates = parts.filter((p) => !TITLE_NOISE.test(p));
    if (candidates.length >= 2) {
      company = candidates[candidates.length - 1];
      companySource = 'page title';
    }
  }

  // ---- role ----
  let role = null;
  let roleSource = null;

  const sameAsCompany = (s) =>
    company && s.toLowerCase().replace(/[^a-z0-9]/g, '') === company.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const h of headings) {
    const clean = String(h || '').replace(APPLY_PREFIX, '').trim();
    if (looksLikeRole(clean) && !sameAsCompany(clean)) {
      role = clean;
      roleSource = 'heading';
      break;
    }
  }

  if (!role) {
    const usable = parts
      .map((p) => p.replace(APPLY_PREFIX, '').trim())
      .filter((p) => looksLikeRole(p) && !sameAsCompany(p));
    if (usable.length) {
      role = usable[0];
      roleSource = 'page title';
    }
  }

  // "Graduate Analyst at Canva" gives both halves away.
  if (role && / at /i.test(role)) {
    const [left, right] = role.split(/\s+at\s+/i);
    if (looksLikeRole(left)) {
      role = left.trim();
      if (!company && right) {
        company = right.trim();
        companySource = 'role line';
      }
    }
  }

  return {
    company: company || null,
    role: role || null,
    ats,
    board,
    source: { company: companySource, role: roleSource },
  };
}

/**
 * One context for a whole tab. The employer is most reliable in the ATS iframe,
 * the role is most reliable on the host page, so take the best of each rather
 * than trusting one frame.
 */
export function mergeContexts(contexts = []) {
  const rank = (src) => {
    if (!src) return 0;
    if (/url$/.test(src)) return 4;          // the employer's own ATS slug
    if (src === 'og:site_name') return 3;
    if (src === 'hostname') return 2;
    if (src === 'heading') return 3;
    return 1;                                 // page title, role line
  };

  const out = { company: null, role: null, ats: null, board: false, source: { company: null, role: null } };
  let best = { company: 0, role: 0 };

  for (const c of contexts) {
    if (!c) continue;
    if (!out.ats && c.ats) { out.ats = c.ats; out.board = c.board; }

    for (const key of ['company', 'role']) {
      const src = c.source ? c.source[key] : null;
      const score = c[key] ? rank(src) : 0;
      if (score > best[key]) {
        best[key] = score;
        out[key] = c[key];
        out.source[key] = src;
      }
    }
  }
  return out;
}
