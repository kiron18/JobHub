/**
 * How often does the ad simply tell us the domain?
 *
 * Every other route to an employer's domain is inference. A search result is a
 * guess about which host belongs to the name, the ABN register improves the
 * search term without naming a website, and the MX gate can only reject a
 * domain rather than find one. `readJdContact` is the one path that is not
 * inference at all: an address the employer printed in their own ad is the
 * employer telling us where they receive mail.
 *
 * So this measures the ceiling on certainty. For every real ad in the corpus:
 *
 *   JD_EMAIL     a full address is printed. Nothing outranks this.
 *   JD_REDACTED  Seek masked the local part and left the domain. Still theirs.
 *   JD_URL       a link in the body, on a host that is not a board or an ATS.
 *   none         the ad says nothing, and the search pipeline is the only way.
 *
 * The first two are sovereign. The third is not: a link in an ad body can be
 * to an industry association, a funding body, or the client of a recruiter, so
 * it is reported separately rather than counted as a win.
 *
 * Reads the database and nothing else. No search, no model, no credit.
 *
 * Usage:  npx tsx src/scripts/jd_domain_rate.ts [--n=500]
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readJdContact, isSufficient } from '../services/jdContact';
import { nameMatchStrength } from '../services/companyDomain';

const prisma = new PrismaClient();
const N = Number(process.argv.find(a => a.startsWith('--n'))?.split('=')[1] ?? 0) || 500;

/**
 * Does the ad's domain look like it belongs to the employer the ad names?
 *
 * A cheap containment check, deliberately not the full name matcher: the point
 * is to separate "the ad handed us the employer's own domain" from "the ad
 * handed us somebody's domain", and a recruiter's ad for a client company
 * prints the recruiter's address every time.
 */
function agreesWithCompany(domain: string, company: string): boolean {
    const core = domain.toLowerCase().split('.')[0].replace(/[^a-z0-9]/g, '');
    const words = company.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4);
    return words.some(w => core.includes(w) || w.includes(core));
}

async function main() {
    const ads = await prisma.jobApplication.findMany({
        where: { description: { not: '' } },
        orderBy: { createdAt: 'desc' },
        take: N,
        select: { company: true, title: true, description: true },
    });

    const rows = ads.map(a => {
        const c = readJdContact(a.description);
        return {
            company: a.company,
            jdLen: a.description.length,
            ...c,
            agrees: c.domain && a.company ? agreesWithCompany(c.domain, a.company) : null,
        };
    });

    const n = rows.length;
    const pct = (x: number) => `${String(Math.round((x / n) * 100)).padStart(3)}%`;
    const by = (s: string) => rows.filter(r => r.domainSource === s);

    const email = by('JD_EMAIL');
    const redacted = by('JD_REDACTED');
    const url = by('JD_URL');
    const none = rows.filter(r => !r.domainSource);
    const sovereign = email.length + redacted.length;

    console.log('='.repeat(72));
    console.log(`WHAT THE AD ITSELF TELLS US        ${n} real ads from the corpus`);
    console.log('='.repeat(72));
    console.log(`  full address printed      ${String(email.length).padStart(4)} / ${n}  ${pct(email.length)}`);
    console.log(`  domain, local part masked ${String(redacted.length).padStart(4)} / ${n}  ${pct(redacted.length)}`);
    console.log(`  ${'-'.repeat(52)}`);
    console.log(`  DOMAIN KNOWN FOR CERTAIN  ${String(sovereign).padStart(4)} / ${n}  ${pct(sovereign)}`);
    console.log('');
    console.log(`  a link in the body only   ${String(url.length).padStart(4)} / ${n}  ${pct(url.length)}   inference, not proof`);
    console.log(`  the ad says nothing       ${String(none.length).padStart(4)} / ${n}  ${pct(none.length)}   search is the only route`);
    console.log('');

    const enough = rows.filter(r => isSufficient(r as any));
    const personal = email.filter(r => !r.emailIsGeneric);
    console.log(`  ... and of the addresses, ${personal.length} reach a NAMED PERSON, ${email.length - personal.length} a role inbox`);
    console.log(`  ads that skip the paid pipeline entirely: ${enough.length} / ${n}  ${pct(enough.length)}`);
    console.log(`  ads that also name a person: ${rows.filter(r => r.personName).length} / ${n}  ${pct(rows.filter(r => r.personName).length)}`);
    console.log('');

    const checked = rows.filter(r => r.agrees !== null);
    const agree = checked.filter(r => r.agrees);
    console.log(`  domain agrees with the employer named in the ad: ${agree.length} / ${checked.length}`);
    console.log(`  (the rest are mostly recruiters advertising a client, which is a real answer, just not the employer's)`);
    console.log('');

    // The sharpest question in here. `nameMatchStrength` is the whole basis of
    // the search route: a host wins because it looks like the employer's name.
    // So a JD domain scoring zero against the employer is a domain the search
    // route could never have chosen, no matter how good the search results.
    // Western Health's mail is at wh.org.au, and their site is westernhealth
    // .org.au. That is the ACH Group failure, and the ad simply states it.
    const unreachable = [...email, ...redacted].filter(
        r => r.company && r.domain && r.agrees === false && nameMatchStrength(r.domain, r.company) === 0,
    );
    console.log(`  of the ${sovereign} certain domains, ${unreachable.length} score ZERO on name match,`);
    console.log(`  so no name-based search could ever have found them:`);
    for (const r of unreachable.slice(0, 12)) {
        console.log(`    ${String(r.company).slice(0, 38).padEnd(38)} -> ${r.domain}`);
    }
    console.log('');

    console.log('SAMPLE OF SOVEREIGN DOMAINS');
    for (const r of [...email, ...redacted].slice(0, 20)) {
        console.log(`  ${String(r.company).slice(0, 34).padEnd(34)} ${String(r.domain).padEnd(30)} ${r.domainSource}${r.agrees ? '' : '  (differs from company name)'}`);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
