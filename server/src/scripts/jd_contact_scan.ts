/**
 * How much contact data is sitting in the job descriptions we ALREADY have?
 * Pure DB scan, no API calls, no cost.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// A full address, e.g. jane.smith@acme.com.au
const FULL_EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
// Seek-style redaction: the local part is masked but the domain survives.
const REDACTED = /[•*x]{2,}\s*@\s*([A-Za-z0-9.-]+\.[A-Za-z]{2,})/gi;
// "please contact Jane Smith, Director of X"
const NAMED_CONTACT = /(?:contact|enquiries to|queries to|speak (?:to|with)|reach out to)\s+((?:[A-Z][a-z'’-]+\s+){1,2}[A-Z][a-z'’-]+)/g;
const PHONE = /(?:\+61|\(0\d\)|\b0\d)[\d\s()-]{7,}/g;

const GENERIC_LOCAL = /^(info|admin|hr|careers|jobs|recruitment|enquiries|contact|hello|office|support|apply|talent|people)$/i;
const NOISE_DOMAIN = /(seek\.com|linkedin|example\.|sentry\.|gravatar|w3\.org|schema\.org|\.png|\.jpg|googleapis|cloudfront)/i;

function uniq<T>(a: T[]): T[] { return [...new Set(a)]; }

async function main() {
  const rows = await prisma.jobApplication.findMany({
    select: { company: true, title: true, description: true },
  });
  console.log(`Scanning ${rows.length} job descriptions\n`);

  let anyDomain = 0, fullPersonal = 0, fullGeneric = 0, redactedOnly = 0, namedContact = 0, phone = 0;
  let nameAndDomain = 0;
  const samples: string[] = [];

  for (const r of rows) {
    const jd = r.description || '';

    const fulls = uniq([...jd.matchAll(FULL_EMAIL)].map(m => m[0]))
      .filter(e => !NOISE_DOMAIN.test(e));
    const personal = fulls.filter(e => !GENERIC_LOCAL.test(e.split('@')[0]));
    const generic = fulls.filter(e => GENERIC_LOCAL.test(e.split('@')[0]));
    const redacted = uniq([...jd.matchAll(REDACTED)].map(m => m[1]))
      .filter(d => !NOISE_DOMAIN.test(d));
    const names = uniq([...jd.matchAll(NAMED_CONTACT)].map(m => m[1]));
    const phones = uniq([...jd.matchAll(PHONE)].map(m => m[0].trim())).filter(p => p.replace(/\D/g, '').length >= 9);

    const domains = uniq([...fulls.map(e => e.split('@')[1]), ...redacted]);

    if (domains.length) anyDomain++;
    if (personal.length) fullPersonal++;
    else if (generic.length) fullGeneric++;
    if (!fulls.length && redacted.length) redactedOnly++;
    if (names.length) namedContact++;
    if (phones.length) phone++;
    if (names.length && domains.length) {
      nameAndDomain++;
      if (samples.length < 12) {
        samples.push(`  ${r.company} | ${r.title}\n     name: ${names[0]}   domain: ${domains[0]}   ${personal[0] ?? (redacted[0] ? '(local part redacted)' : '')}`);
      }
    }
  }

  const n = rows.length;
  const pct = (x: number) => `${String(Math.round((x / n) * 100)).padStart(3)}%`;
  console.log('WHAT IS ALREADY IN THE JOB DESCRIPTION');
  console.log(`  any employer email DOMAIN present     ${String(anyDomain).padStart(4)} / ${n}  ${pct(anyDomain)}`);
  console.log(`  a full PERSONAL address (jane@...)    ${String(fullPersonal).padStart(4)} / ${n}  ${pct(fullPersonal)}`);
  console.log(`  only a generic address (hr@, info@)   ${String(fullGeneric).padStart(4)} / ${n}  ${pct(fullGeneric)}`);
  console.log(`  domain only, local part redacted      ${String(redactedOnly).padStart(4)} / ${n}  ${pct(redactedOnly)}`);
  console.log(`  a named human contact                 ${String(namedContact).padStart(4)} / ${n}  ${pct(namedContact)}`);
  console.log(`  BOTH a name and a domain              ${String(nameAndDomain).padStart(4)} / ${n}  ${pct(nameAndDomain)}`);
  console.log(`  a phone number                        ${String(phone).padStart(4)} / ${n}  ${pct(phone)}`);
  console.log('\nSAMPLES (name + domain, no search API involved):');
  console.log(samples.join('\n'));
}

main().finally(() => prisma.$disconnect());
