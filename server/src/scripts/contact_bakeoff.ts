/**
 * Contact-discovery bake-off.
 *
 * Measures, on REAL jobs from the production DB, how often we can actually get
 * from "company name in a job ad" to "a named human with an email address".
 *
 * Stages measured
 *   S0  company name usable at all
 *   S1  Australian domain resolved for that company
 *   S2  a contact NAME found (which pass produced it)
 *   S3  that contact is verifiably in Australia
 *   S4  an EMAIL for that contact (Hunter; skipped when HUNTER_API_KEY absent)
 *
 * Stage 2 runs TWICE: query A is the LinkedIn search exactly as production has
 * it today (no geography), query B adds Australia. The delta is the point.
 *
 * Results are cached to JSON so stage 4 can be re-run alone once a Hunter key
 * exists, without paying for stages 0-3 again.
 *
 * Usage:  npx tsx src/scripts/contact_bakeoff.ts [--n 40] [--emails-only]
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { type SerperResult } from '../services/serper';
import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { parseLLMJson } from '../utils/parseLLMResponse';
import { pickCompanyDomain, type DomainCandidate } from '../services/companyDomain';

const prisma = new PrismaClient();

const OUT_DIR =
  process.env.BAKEOFF_OUT ||
  'C:\\Users\\Kiron\\AppData\\Local\\Temp\\claude\\E--AntiGravity-Daekwon\\5fe07aa8-6f26-44dc-8567-e3df5115f105\\scratchpad';
const CACHE_PATH = path.join(OUT_DIR, 'bakeoff-cache.json');

const argN = Number(process.argv.find(a => a.startsWith('--n'))?.split('=')[1] ?? 0);
const N = argN || 40;
const EMAILS_ONLY = process.argv.includes('--emails-only');
const CONCURRENCY = 3;

// The production search vendor (Serper) is at a zero balance, so this harness
// runs on Firecrawl's /search, which honours the same Google operators.
// Swap SEARCH_VENDOR back to serper once Serper is topped up.
let searchCalls = 0;
let searchFails = 0;
let llmCalls = 0;
let hunterCredits = 0;

const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;

// Firecrawl's search endpoint rate-limits aggressively on this plan, so every
// query goes through one global queue with a minimum gap. Job-level concurrency
// still helps because the LLM calls overlap with the waiting.
const MIN_GAP_MS = 3500;
let searchChain: Promise<unknown> = Promise.resolve();
let lastSearchAt = 0;

function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = searchChain.then(async () => {
    const wait = Math.max(0, lastSearchAt + MIN_GAP_MS - Date.now());
    if (wait) await new Promise(r => setTimeout(r, wait));
    lastSearchAt = Date.now();
    return fn();
  });
  searchChain = run.catch(() => {});
  return run as Promise<T>;
}

async function search(q: string, num = 6): Promise<SerperResult[]> {
  searchCalls++;
  const backoff = [0, 15000, 45000];
  for (let attempt = 0; attempt < backoff.length; attempt++) {
    if (backoff[attempt]) await new Promise(r => setTimeout(r, backoff[attempt]));
    try {
      const data = await throttle(async () => {
        const res = await axios.post(
          'https://api.firecrawl.dev/v1/search',
          { query: q, limit: num, location: 'Australia' },
          { headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' }, timeout: 60000 }
        );
        return res.data;
      });
      return (data?.data ?? []).map((r: any) => ({
        title: r.title || '',
        snippet: r.description || '',
        link: r.url || '',
      }));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) continue;
      if (attempt === backoff.length - 1) {
        searchFails++;
        console.error(`\n  ! search failed (${status ?? err.message}): ${q.slice(0, 70)}`);
        return [];
      }
    }
  }
  searchFails++;
  console.error(`\n  ! search rate-limited out: ${q.slice(0, 70)}`);
  return [];
}
async function llm(prompt: string): Promise<string> {
  llmCalls++;
  return callLLMWithRetry(prompt, true);
}

// ── company classification ───────────────────────────────────────────────────

type OrgType = 'government' | 'health' | 'education' | 'agency' | 'corporate';

function classify(company: string): OrgType {
  const c = company.toLowerCase();
  if (/university|tafe|\bschool\b|college|institute of technology/.test(c)) return 'education';
  if (/health network|hospital|health service|\bhealth\b|medical centre/.test(c)) return 'health';
  if (/department of|ministry|commission|\bcouncil\b|\bgov\b|city of|shire of|regional council|public sector|authority/.test(c))
    return 'government';
  if (/recruit|talent|\bhays\b|randstad|davidson|robert half|michael page|hudson|people2people|launch |allura|chandler macleod/.test(c))
    return 'agency';
  return 'corporate';
}

// ── S1: company name → the company's own website ─────────────────────────────
//
// The ranking used to be `(N - position) * auRank`, where auRank handed
// `.gov.au` the top weight. That is what put Scania on vehiclerecalls.gov.au
// and Hudson on finance.gov.au. It now lives in services/companyDomain.ts,
// which is tested against those exact failures.

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

interface DomainResult {
  domain: string | null;
  isAu: boolean;
  alternatives: string[];
  reason: string;
}

async function resolveDomain(company: string): Promise<DomainResult> {
  const results = await search(`"${company}" Australia official website`, 8);
  const candidates: DomainCandidate[] = [];
  results.forEach((r, position) => {
    const host = hostOf(r.link);
    if (host) candidates.push({ host, position });
  });
  return pickCompanyDomain(candidates, company);
}

// ── S2: contact discovery (mirrors routes/research.ts) ───────────────────────

type Confidence = 'high' | 'medium' | 'low';
interface Candidate {
  name: string;
  title: string | null;
  location: string | null;
  confidence: Confidence;
  sourceUrl: string | null;
  pass: 'jd' | 'linkedin' | 'recruiter';
}

function deriveTitles(role: string): string[] {
  const r = (role || '').toLowerCase();
  const m = (...keys: string[]) => keys.some(k => r.includes(k));
  if (m('engineer', 'developer', 'software', 'devops', 'platform'))
    return ['Head of Engineering', 'Engineering Manager', 'CTO', 'Director of Engineering'];
  if (m('data', 'analytics', 'business intelligence', ' bi '))
    return ['Head of Data', 'Data Manager', 'Head of Analytics', 'Chief Data Officer', 'Analytics Manager'];
  if (m('business analyst', 'process improvement', 'systems analyst'))
    return ['Head of Transformation', 'Business Analysis Manager', 'Head of Business Improvement', 'PMO Manager', 'Program Director'];
  if (m('marketing', 'growth', 'brand', 'communications'))
    return ['Head of Marketing', 'Marketing Manager', 'Marketing Director', 'CMO', 'Communications Manager'];
  if (m('sales', 'account executive', 'business development'))
    return ['Head of Sales', 'Sales Director', 'Sales Manager', 'CRO'];
  if (m('finance', 'accountant', 'commercial analyst'))
    return ['Head of Finance', 'Finance Manager', 'CFO', 'Financial Controller'];
  if (m('policy', 'program officer', 'project officer'))
    return ['Director', 'Executive Director', 'Manager', 'Assistant Director'];
  if (m('chemist', 'laboratory', 'quality control', 'scientist'))
    return ['Laboratory Manager', 'Quality Manager', 'Head of Quality', 'Technical Manager'];
  if (m('nurse', 'clinical', 'pharmacy'))
    return ['Director of Nursing', 'Nurse Unit Manager', 'Clinical Director', 'Pharmacy Manager'];
  if (m('hr ', 'people', 'human resources'))
    return ['Head of People', 'HR Manager', 'HR Director', 'People and Culture Manager'];
  if (m('operations', 'logistics', 'supply chain'))
    return ['Head of Operations', 'Operations Manager', 'Operations Director', 'COO'];
  return ['Director', 'Head', 'Manager', 'General Manager'];
}

function block(results: SerperResult[]): string {
  return results.map(r => `- ${r.title}\n  ${r.snippet}\n  URL: ${r.link}`).join('\n');
}

async function scanJd(jd: string, company: string, role: string): Promise<Candidate | null> {
  if (!jd || jd.length < 100) return null;
  const prompt = `You are looking for a SPECIFIC NAMED PERSON in this job description who is identified as the hiring manager, the role's supervisor, the panel chair, or the contact for the application.

COMPANY: ${company}
ROLE: ${role}

JOB DESCRIPTION:
${jd.slice(0, 6000)}

Only return a result if the JD names a real person. Do NOT return a result for generic phrases like "the hiring manager". The person must be named.

Return JSON: { "name": "Full Name" or null, "title": "their title" or null, "email": "their email if the JD states one" or null }
If no named person, return { "name": null }. Return ONLY valid JSON.`;
  try {
    const parsed = parseLLMJson(await llm(prompt)) as any;
    if (!parsed?.name || typeof parsed.name !== 'string' || parsed.name.length < 3) return null;
    return {
      name: parsed.name.trim(),
      title: parsed.title?.trim() ?? null,
      location: 'Australia (from JD)',
      confidence: 'high',
      sourceUrl: parsed.email ? `mailto:${parsed.email}` : null,
      pass: 'jd',
    };
  } catch {
    return null;
  }
}

async function searchLinkedIn(company: string, role: string, geo: boolean): Promise<Candidate[]> {
  const titles = deriveTitles(role);
  const titlesClause = titles.map(t => `"${t}"`).join(' OR ');
  // Query A = production today. Query B adds the geography constraint.
  const query = geo
    ? `"${company}" (${titlesClause}) Australia site:linkedin.com/in/`
    : `"${company}" (${titlesClause}) site:linkedin.com/in/`;

  const results = await search(query, 6);
  if (!results.length) return [];

  const prompt = `You are extracting potential hiring managers from LinkedIn search snippets.

COMPANY: ${company}
ROLE BEING HIRED: ${role}
TARGET TITLES: ${titles.join(', ')}

SEARCH RESULTS:
${block(results)}

Return a JSON array of up to 3 plausible hiring managers. For each:
- name: full name
- title: their current title at ${company}, or null
- location: the location shown in the snippet (e.g. "Sydney, New South Wales, Australia"), or null if not shown
- sourceUrl: the LinkedIn profile URL

Exclusion rules:
- Skip anyone whose snippet shows them at a DIFFERENT company.
- Skip junior titles (analyst, associate, intern, coordinator).
- Skip recruiters and talent acquisition for this pass.
${geo ? '- Skip anyone whose location is clearly OUTSIDE Australia (e.g. London, Mumbai, Singapore, New York).' : ''}

Return ONLY a JSON array. If none: [].`;
  try {
    const parsed = parseLLMJson(await llm(prompt));
    const arr: any[] = Array.isArray(parsed) ? parsed : Array.isArray((parsed as any)?.candidates) ? (parsed as any).candidates : [];
    return arr
      .filter(c => c && typeof c.name === 'string' && c.name.length >= 3)
      .slice(0, 3)
      .map(c => ({
        name: c.name.trim(),
        title: typeof c.title === 'string' ? c.title.trim() : null,
        location: typeof c.location === 'string' ? c.location.trim() : null,
        confidence: 'medium' as Confidence,
        sourceUrl: typeof c.sourceUrl === 'string' ? c.sourceUrl : null,
        pass: 'linkedin' as const,
      }));
  } catch {
    return [];
  }
}

async function searchRecruiter(company: string): Promise<Candidate[]> {
  const results = await search(
    `"${company}" ("talent acquisition" OR "recruiter" OR "people and culture") Australia site:linkedin.com/in/`,
    4
  );
  if (!results.length) return [];
  const prompt = `Extract recruiters / talent acquisition contacts from these LinkedIn snippets.

COMPANY: ${company}

SEARCH RESULTS:
${block(results)}

Return a JSON array of up to 2. Fields: name, title, location, sourceUrl.
Skip anyone clearly at a different company or clearly outside Australia.
Return ONLY a JSON array. If none: [].`;
  try {
    const parsed = parseLLMJson(await llm(prompt));
    const arr: any[] = Array.isArray(parsed) ? parsed : [];
    return arr
      .filter(c => c && typeof c.name === 'string' && c.name.length >= 3)
      .slice(0, 2)
      .map(c => ({
        name: c.name.trim(),
        title: typeof c.title === 'string' ? c.title.trim() : null,
        location: typeof c.location === 'string' ? c.location.trim() : null,
        confidence: 'low' as Confidence,
        sourceUrl: typeof c.sourceUrl === 'string' ? c.sourceUrl : null,
        pass: 'recruiter' as const,
      }));
  } catch {
    return [];
  }
}

const NON_AU = /(london|united kingdom|\buk\b|india|mumbai|bengaluru|bangalore|delhi|singapore|new york|san francisco|manila|philippines|dubai|toronto|auckland|new zealand|ireland|dublin|germany|france|japan|china|hong kong|malaysia|vietnam|texas|california)/i;
const AU = /(australia|sydney|melbourne|brisbane|perth|adelaide|canberra|hobart|darwin|new south wales|victoria|queensland|western australia|south australia|tasmania|\bnsw\b|\bvic\b|\bqld\b|\bact\b)/i;

function isAustralian(c: Candidate): boolean | null {
  // Strongest free signal: LinkedIn serves Australian profiles from the au.
  // subdomain, so the URL settles it without reading the snippet at all.
  if (c.sourceUrl && /^https?:\/\/au\.linkedin\.com/i.test(c.sourceUrl)) return true;
  if (c.sourceUrl && /^https?:\/\/([a-z]{2})\.linkedin\.com/i.test(c.sourceUrl)) return false;
  if (!c.location) return null; // unknown, not a pass and not a fail
  if (NON_AU.test(c.location)) return false;
  if (AU.test(c.location)) return true;
  return null;
}

// ── S4: Hunter ───────────────────────────────────────────────────────────────

interface HunterResult {
  email: string | null;
  score: number | null;
  verification: string | null;
  sourceCount: number;
  pattern: string | null;
  error: string | null;
}

async function hunterFind(name: string, domain: string): Promise<HunterResult> {
  const key = process.env.HUNTER_API_KEY;
  const empty: HunterResult = { email: null, score: null, verification: null, sourceCount: 0, pattern: null, error: null };
  if (!key) return { ...empty, error: 'NO_KEY' };

  const [first, ...rest] = name.split(/\s+/);
  const last = rest.join(' ');
  try {
    const { data } = await axios.get('https://api.hunter.io/v2/email-finder', {
      params: { domain, first_name: first, last_name: last, api_key: key },
      timeout: 15000,
    });
    const d = data?.data ?? {};
    if (d.email) hunterCredits += 1; // Hunter charges only on a result
    return {
      email: d.email ?? null,
      score: typeof d.score === 'number' ? d.score : null,
      verification: d.verification?.status ?? null,
      sourceCount: Array.isArray(d.sources) ? d.sources.length : 0,
      pattern: null,
      error: null,
    };
  } catch (err: any) {
    return { ...empty, error: err?.response?.status ? `HTTP ${err.response.status}` : err.message };
  }
}

// ── driver ───────────────────────────────────────────────────────────────────

interface Row {
  company: string;
  title: string;
  orgType: OrgType;
  jdLen: number;
  domain: string | null;
  domainIsAu: boolean;
  domainReason: string;
  domainAlts: string[];
  jdContact: string | null;
  aNames: string[];
  bNames: string[];
  bTop: Candidate | null;
  bTopAu: boolean | null;
  recruiterUsed: boolean;
  hunter: HunterResult | null;
}

async function processJob(job: { company: string; title: string; description: string }): Promise<Row> {
  const { company, title, description } = job;
  const orgType = classify(company);

  const [domainRes, jdHit, aHits, bHits] = await Promise.all([
    resolveDomain(company),
    scanJd(description, company, title),
    searchLinkedIn(company, title, false),
    searchLinkedIn(company, title, true),
  ]);

  let bList = bHits;
  let recruiterUsed = false;
  if (!jdHit && bList.length === 0) {
    bList = await searchRecruiter(company);
    recruiterUsed = bList.length > 0;
  }

  const bTop = jdHit ?? bList[0] ?? null;

  let hunter: HunterResult | null = null;
  if (bTop && domainRes.domain) {
    hunter = await hunterFind(bTop.name, domainRes.domain);
  }

  return {
    company,
    title,
    orgType,
    jdLen: description.length,
    domain: domainRes.domain,
    domainIsAu: domainRes.isAu,
    domainReason: domainRes.reason,
    domainAlts: domainRes.alternatives,
    jdContact: jdHit?.name ?? null,
    aNames: aHits.map(c => `${c.name}${c.location ? ` [${c.location}]` : ''}`),
    bNames: bList.map(c => `${c.name}${c.location ? ` [${c.location}]` : ''}`),
    bTop,
    bTopAu: bTop ? isAustralian(bTop) : null,
    recruiterUsed,
    hunter,
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        try {
          out[i] = await fn(items[i], i);
        } catch (err: any) {
          console.error(`  ! job ${i} failed: ${err.message}`);
          out[i] = null as any;
        }
        process.stdout.write('.');
      }
    })
  );
  return out.filter(Boolean);
}

function pct(n: number, d: number): string {
  return d === 0 ? '  -  ' : `${String(Math.round((n / d) * 100)).padStart(3)}%`;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // ── emails-only re-run against the cache ──────────────────────────────────
  if (EMAILS_ONLY) {
    if (!fs.existsSync(CACHE_PATH)) throw new Error('No cache. Run a full pass first.');
    const rows: Row[] = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    console.log(`Re-running Hunter over ${rows.length} cached rows...`);
    for (const r of rows) {
      if (r.bTop && r.domain) r.hunter = await hunterFind(r.bTop.name, r.domain);
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify(rows, null, 2));
    report(rows);
    return;
  }

  // ── sample ────────────────────────────────────────────────────────────────
  const totalWithCompany = await prisma.jobApplication.count();
  // Unknown is now a real null rather than a magic string, so this is a fact
  // about the data instead of a list of placeholder spellings to keep in sync.
  const unknownCount = await prisma.jobApplication.count({ where: { company: null } });
  const agencyOnlyCount = await prisma.jobApplication.count({
    where: { company: null, agency: { not: null } },
  });

  const pool = await prisma.jobApplication.findMany({
    where: {
      company: { not: null },
      description: { not: '' },
    },
    orderBy: { createdAt: 'desc' },
    take: 400,
    select: { company: true, title: true, description: true },
  });

  // One job per company, so the sample measures companies not duplicates.
  const seen = new Set<string>();
  const unique = pool.filter(j => {
    const k = (j.company ?? '').toLowerCase().trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return j.description.length > 500;
  });

  // Stratify so government and health are not drowned out by corporate.
  const byType = new Map<OrgType, typeof unique>();
  for (const j of unique) {
    const t = classify(j.company ?? '');
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(j);
  }
  const quota: Record<OrgType, number> = {
    corporate: Math.round(N * 0.4),
    government: Math.round(N * 0.25),
    health: Math.round(N * 0.1),
    education: Math.round(N * 0.1),
    agency: Math.round(N * 0.15),
  };
  const sample: typeof unique = [];
  for (const [t, q] of Object.entries(quota) as [OrgType, number][]) {
    sample.push(...(byType.get(t) ?? []).slice(0, q));
  }
  // Top up from whatever is left if a bucket was short.
  for (const j of unique) {
    if (sample.length >= N) break;
    if (!sample.includes(j)) sample.push(j);
  }

  console.log(`\nCorpus: ${totalWithCompany} applications, ${unknownCount} with no usable company name (${pct(unknownCount, totalWithCompany)})`);
  console.log(`Sampling ${sample.length} unique companies:`);
  for (const [t, arr] of byType) console.log(`  ${t}: ${arr.length} available`);
  console.log(`Hunter key: ${process.env.HUNTER_API_KEY ? 'present' : 'ABSENT (stage 4 skipped)'}`);
  console.log('\nRunning...');

  const named = sample.map(j => ({ ...j, company: j.company as string }));
  const rows = await mapLimit(named, CONCURRENCY, processJob);
  console.log('\n');

  fs.writeFileSync(CACHE_PATH, JSON.stringify(rows, null, 2));
  report(rows, { totalWithCompany, unknownCount, agencyOnlyCount });
}

function report(rows: Row[], corpus?: { totalWithCompany: number; unknownCount: number; agencyOnlyCount?: number }) {
  const n = rows.length;
  const lines: string[] = [];
  const p = (s: string) => { console.log(s); lines.push(s); };

  p('='.repeat(78));
  p('CONTACT DISCOVERY BAKE-OFF');
  p('='.repeat(78));
  if (corpus) {
    p(`Corpus: ${corpus.totalWithCompany} real applications`);
    p(`No employer named: ${corpus.unknownCount} (${pct(corpus.unknownCount, corpus.totalWithCompany)})`);
    if (corpus.agencyOnlyCount !== undefined) {
      p(`  ... but an agency IS named: ${corpus.agencyOnlyCount} (${pct(corpus.agencyOnlyCount, corpus.unknownCount)} of those)`);
    }
  }
  p(`Sample: ${n} unique companies`);
  p('');

  // Funnel
  const withDomain = rows.filter(r => r.domain);
  const withAuDomain = rows.filter(r => r.domainIsAu);
  const withJd = rows.filter(r => r.jdContact);
  const withA = rows.filter(r => r.aNames.length > 0);
  const withB = rows.filter(r => r.bNames.length > 0);
  const withAny = rows.filter(r => r.bTop);
  const auConfirmed = rows.filter(r => r.bTopAu === true);
  const auRejected = rows.filter(r => r.bTopAu === false);
  const auUnknown = rows.filter(r => r.bTop && r.bTopAu === null);
  const withEmail = rows.filter(r => r.hunter?.email);
  const hunterNoKey = rows.filter(r => r.hunter?.error === 'NO_KEY').length;

  p('FUNNEL');
  p(`  S0  company name usable             ${String(n).padStart(3)} / ${n}   ${pct(n, n)}`);
  p(`  S1  domain resolved                 ${String(withDomain.length).padStart(3)} / ${n}   ${pct(withDomain.length, n)}`);
  p(`      ... and it is an .au domain     ${String(withAuDomain.length).padStart(3)} / ${n}   ${pct(withAuDomain.length, n)}`);
  p(`  S2  contact name found (any pass)   ${String(withAny.length).padStart(3)} / ${n}   ${pct(withAny.length, n)}`);
  p(`      ... named in the JD itself      ${String(withJd.length).padStart(3)} / ${n}   ${pct(withJd.length, n)}`);
  p(`  S3  contact confirmed Australian    ${String(auConfirmed.length).padStart(3)} / ${n}   ${pct(auConfirmed.length, n)}`);
  p(`      ... location unknown            ${String(auUnknown.length).padStart(3)} / ${n}   ${pct(auUnknown.length, n)}`);
  p(`      ... rejected as overseas        ${String(auRejected.length).padStart(3)} / ${n}   ${pct(auRejected.length, n)}`);
  if (hunterNoKey) {
    p(`  S4  email found                     SKIPPED (no HUNTER_API_KEY)`);
  } else {
    p(`  S4  email found                     ${String(withEmail.length).padStart(3)} / ${n}   ${pct(withEmail.length, n)}`);
  }
  p('');

  // Geo A/B
  p('LINKEDIN QUERY: production (no geo) vs geo-filtered');
  p(`  A  returned any candidate           ${String(withA.length).padStart(3)} / ${n}   ${pct(withA.length, n)}`);
  p(`  B  returned any candidate           ${String(withB.length).padStart(3)} / ${n}   ${pct(withB.length, n)}`);
  const aOverseas = rows.filter(r => r.aNames.some(x => NON_AU.test(x))).length;
  const bOverseas = rows.filter(r => r.bNames.some(x => NON_AU.test(x))).length;
  p(`  A  returned an OVERSEAS person      ${String(aOverseas).padStart(3)} / ${n}   ${pct(aOverseas, n)}`);
  p(`  B  returned an OVERSEAS person      ${String(bOverseas).padStart(3)} / ${n}   ${pct(bOverseas, n)}`);
  p('');

  // By org type
  p('BY ORGANISATION TYPE');
  p('  type          n   domain   .au    name   AU-conf   email');
  const types: OrgType[] = ['corporate', 'government', 'health', 'education', 'agency'];
  for (const t of types) {
    const g = rows.filter(r => r.orgType === t);
    if (!g.length) continue;
    p(
      `  ${t.padEnd(12)} ${String(g.length).padStart(2)}   ` +
      `${pct(g.filter(r => r.domain).length, g.length)}   ` +
      `${pct(g.filter(r => r.domainIsAu).length, g.length)}  ` +
      `${pct(g.filter(r => r.bTop).length, g.length)}   ` +
      `${pct(g.filter(r => r.bTopAu === true).length, g.length)}    ` +
      `${hunterNoKey ? '  -  ' : pct(g.filter(r => r.hunter?.email).length, g.length)}`
    );
  }
  p('');

  // Which pass produced the winner
  p('WHICH PASS PRODUCED THE CONTACT');
  for (const pass of ['jd', 'linkedin', 'recruiter'] as const) {
    const c = rows.filter(r => r.bTop?.pass === pass).length;
    p(`  ${pass.padEnd(10)} ${String(c).padStart(3)} / ${n}   ${pct(c, n)}`);
  }
  p('');

  p('COST');
  p(`  Search calls: ${searchCalls} (Firecrawl), ${searchFails} failed`);
  p(`  LLM calls:    ${llmCalls}`);
  p(`  Hunter credits consumed: ${hunterCredits}`);
  p('');

  // Per-row detail for eyeballing
  p('='.repeat(78));
  p('PER-JOB DETAIL (for manual accuracy check)');
  p('='.repeat(78));
  for (const r of rows) {
    p(`\n[${r.orgType}] ${r.company} - ${r.title}`);
    p(`  domain: ${r.domain ?? 'NONE'} [${r.domainReason}]${r.domainIsAu ? ' (.au)' : r.domain ? ' (NOT .au)' : ''}${r.domainAlts.length ? `   alts: ${r.domainAlts.join(', ')}` : ''}`);
    p(`  A (no geo): ${r.aNames.length ? r.aNames.join(' | ') : 'none'}`);
    p(`  B (geo):    ${r.bNames.length ? r.bNames.join(' | ') : 'none'}${r.recruiterUsed ? '  [recruiter fallback]' : ''}`);
    if (r.jdContact) p(`  JD names:   ${r.jdContact}`);
    if (r.bTop) p(`  PICK: ${r.bTop.name} - ${r.bTop.title ?? '?'} (${r.bTop.pass}, AU=${r.bTopAu})`);
    if (r.hunter && r.hunter.error !== 'NO_KEY') {
      p(`  hunter: ${r.hunter.email ?? 'none'} score=${r.hunter.score ?? '-'} verif=${r.hunter.verification ?? '-'} sources=${r.hunter.sourceCount}${r.hunter.error ? ` err=${r.hunter.error}` : ''}`);
    }
  }

  const reportPath = path.join(OUT_DIR, 'bakeoff-report.txt');
  fs.writeFileSync(reportPath, lines.join('\n'));
  console.log(`\n\nReport written to ${reportPath}`);
  console.log(`Cache written to ${CACHE_PATH}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
