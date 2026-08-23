/**
 * Backfill employer / agency on applications that never got one.
 *
 * 36% of the tracker held the literal 'Unknown company', which the
 * 20260822000002 migration turned into a real null. That is honest but empty.
 * A sample showed roughly a third of those ads DO name the recruitment agency
 * that posted them, and on an agency listing the recruiter is the right person
 * to follow up with. This reads each ad once and fills in whichever of the two
 * it can actually find.
 *
 * Never guesses: the prompt is the production /job-facts prompt, which is built
 * to return null rather than invent a name.
 *
 * Usage: npx tsx src/scripts/backfill_job_facts.ts [--limit 500] [--dry]
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { callLLM } from '../services/llm';
import { parseLLMJson } from '../utils/parseLLMResponse';

const prisma = new PrismaClient();
const LIMIT = Number(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? 1000);
const DRY = process.argv.includes('--dry');
const CONCURRENCY = 4;

const prompt = (jd: string) => `Read this job advertisement and return the role title and the employer.

Rules:
- Use ONLY what the advertisement actually says. Never infer, complete or guess a name.
- "title" is the advertised role, exactly as written, with no seniority or department invented.
- "company" is the ORGANISATION HIRING. It is not the recruitment agency posting on their behalf, not a location, not a venue, not a client the role serves, and not a generic noun that happened to follow the word "at".
- Many ads genuinely do not name the employer, for example when a recruiter lists it confidentially. That is normal and expected. Return null for company in that case.
- "agency" is the recruitment agency or consultancy that posted the ad, when the ad names one. Most ads have none, and an ad posted by the employer directly has none. If the ad names the agency but hides the employer, that is exactly the case this field exists for. Return null when no agency is named.
- Return null for anything the ad does not state. A null is correct and useful; a plausible guess is worse than nothing because it will be sent to that employer in an email.

Return JSON only:
{ "title": "<the role, or null>", "company": "<the hiring organisation, or null>", "agency": "<the recruitment agency that posted it, or null>" }

JOB ADVERTISEMENT:
"""
${jd.slice(0, 12000)}
"""`;

const clean = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || t.length > 120) return null;
  if (/^(null|none|n\/a|not (stated|specified|provided|listed)|unknown|confidential)$/i.test(t)) return null;
  return t;
};

async function mapLimit<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

(async () => {
  const rows = await prisma.jobApplication.findMany({
    where: { company: null, agency: null, description: { not: '' } },
    select: { id: true, title: true, description: true },
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
  });
  console.log(`${rows.length} application(s) with no employer and no agency${DRY ? ' (DRY RUN)' : ''}\n`);

  let company = 0, agency = 0, neither = 0, failed = 0, titleFixed = 0;

  await mapLimit(rows, CONCURRENCY, async (r) => {
    if (r.description.length < 100) { failed++; return; }
    try {
      const out = parseLLMJson(await callLLM(prompt(r.description), true));
      const c = clean(out.company);
      const a = clean(out.agency);
      const t = clean(out.title);
      const data: Record<string, string> = {};
      if (c) data.company = c;
      if (a) data.agency = a;
      // "Untitled role" is the same placeholder problem in the title column.
      if (!c && !a && !t) { neither++; return; }
      if (t && r.title === 'Untitled role') { data.title = t; titleFixed++; }
      if (c) company++; else if (a) agency++; else neither++;
      if (Object.keys(data).length && !DRY) {
        await prisma.jobApplication.update({ where: { id: r.id }, data });
      }
    } catch (e: any) {
      failed++;
      console.error('  failed', r.id, e?.message?.slice(0, 80));
    }
  });

  const n = rows.length || 1;
  console.log('\n=== backfill result ===');
  console.log(`employer recovered : ${company} (${Math.round(company / n * 100)}%)`);
  console.log(`agency recovered   : ${agency} (${Math.round(agency / n * 100)}%)`);
  console.log(`still nothing      : ${neither} (${Math.round(neither / n * 100)}%)`);
  console.log(`titles repaired    : ${titleFixed}`);
  console.log(`failed             : ${failed}`);
})().finally(() => prisma.$disconnect());
