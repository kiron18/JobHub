import 'dotenv/config';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const OUT = 'E:\\AntiGravity\\JobHub\\JD-EXPORT.txt';

const FULL_EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const REDACTED = /[•*x]{2,}\s*@\s*([A-Za-z0-9.-]+\.[A-Za-z]{2,})/gi;
const NOISE = /(seek\.com|linkedin|example\.|sentry\.|gravatar|w3\.org|schema\.org|\.png|\.jpg|googleapis|cloudfront)/i;
const uniq = <T,>(a: T[]) => [...new Set(a)];

async function main() {
  const rows = await prisma.jobApplication.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, userId: true, company: true, title: true, description: true,
      sourceUrl: true, createdAt: true, status: true,
    },
  });

  // Provenance: who saved these, and do any carry a source URL?
  const byUser = new Map<string, number>();
  let withUrl = 0;
  const urlHosts = new Map<string, number>();
  for (const r of rows) {
    byUser.set(r.userId, (byUser.get(r.userId) ?? 0) + 1);
    if (r.sourceUrl) {
      withUrl++;
      try {
        const h = new URL(r.sourceUrl).hostname.replace(/^www\./, '');
        urlHosts.set(h, (urlHosts.get(h) ?? 0) + 1);
      } catch { /* ignore */ }
    }
  }

  const profiles = await prisma.candidateProfile.findMany({
    where: { userId: { in: [...byUser.keys()] } },
    select: { userId: true, name: true, email: true },
  });
  const nameOf = new Map(profiles.map(p => [p.userId, `${p.name ?? '?'} <${p.email ?? '?'}>`]));

  const out: string[] = [];
  const p = (s = '') => out.push(s);

  p('='.repeat(100));
  p('JOB DESCRIPTION EXPORT - JobHub JobApplication table');
  p(`Generated ${new Date().toISOString()}`);
  p('='.repeat(100));
  p();
  p(`Total saved applications: ${rows.length}`);
  p(`Date range: ${rows[rows.length - 1]?.createdAt.toISOString().slice(0, 10)} to ${rows[0]?.createdAt.toISOString().slice(0, 10)}`);
  p(`Records carrying a sourceUrl: ${withUrl} / ${rows.length}`);
  if (urlHosts.size) {
    p('Source hosts:');
    [...urlHosts.entries()].sort((a, b) => b[1] - a[1]).forEach(([h, c]) => p(`   ${String(c).padStart(4)}  ${h}`));
  }
  p();
  p('WHO SAVED THEM');
  [...byUser.entries()].sort((a, b) => b[1] - a[1]).forEach(([uid, c]) => {
    p(`   ${String(c).padStart(4)}  ${nameOf.get(uid) ?? uid}`);
  });
  p();

  p('='.repeat(100));
  p('INDEX  (line = date | company | title | contact data found in the JD text)');
  p('='.repeat(100));
  rows.forEach((r, i) => {
    const jd = r.description || '';
    const fulls = uniq([...jd.matchAll(FULL_EMAIL)].map(m => m[0])).filter(e => !NOISE.test(e));
    const red = uniq([...jd.matchAll(REDACTED)].map(m => m[1])).filter(d => !NOISE.test(d));
    const flag = fulls.length ? `EMAIL: ${fulls.slice(0, 2).join(', ')}` : red.length ? `DOMAIN: ${red.slice(0, 2).join(', ')}` : '';
    p(`#${String(i + 1).padStart(3)} | ${r.createdAt.toISOString().slice(0, 10)} | ${(r.company || '?').slice(0, 38).padEnd(38)} | ${(r.title || '?').slice(0, 45).padEnd(45)} | ${flag}`);
  });
  p();

  p('='.repeat(100));
  p('FULL TEXT');
  p('='.repeat(100));
  rows.forEach((r, i) => {
    p();
    p('#'.repeat(100));
    p(`#${i + 1}  ${r.company || '?'}  |  ${r.title || '?'}`);
    p(`saved ${r.createdAt.toISOString().slice(0, 16)} by ${nameOf.get(r.userId) ?? r.userId}  |  status ${r.status}  |  url: ${r.sourceUrl || '(none)'}`);
    p('#'.repeat(100));
    p(r.description || '(empty)');
  });

  fs.writeFileSync(OUT, out.join('\n'), 'utf8');
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`Wrote ${OUT}  (${rows.length} jobs, ${kb} KB)`);
  console.log(`sourceUrl present: ${withUrl}/${rows.length}`);
  console.log('Users:');
  [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([uid, c]) => console.log(`  ${String(c).padStart(4)}  ${nameOf.get(uid) ?? uid}`));
}

main().finally(() => prisma.$disconnect());
