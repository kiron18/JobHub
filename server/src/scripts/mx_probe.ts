/**
 * Where the contact pipeline actually loses the employer.
 *
 * The bake-off recorded ACH Group as a Hunter blank, and that was read as
 * Hunter not knowing the employer. It is not. Their website is achgroup.org.au,
 * which the resolver picks correctly and which search returns at position 0.
 * Their mailboxes are at ach.org.au, a domain that appears in no search result
 * and on no page of their own site. We asked Hunter a question about the wrong
 * domain and then recorded the answer as missing data.
 *
 * So before buying a bigger plan, this measures how often that happens, using
 * only signals that cost nothing:
 *
 *   no MX at all       the domain cannot receive mail, so a directory lookup on
 *                      it is guaranteed to return nothing. darwinprivatehospital
 *                      .com.au is one of these, and its blank was correct.
 *   MX names a domain  Microsoft publishes the tenant's primary domain inside
 *                      the MX host (ac3-com-au.mail.protection.outlook.com), so
 *                      where mail lives elsewhere the record often says where.
 *   MX says nothing    Mimecast, Proofpoint and Google front the real domain, so
 *                      these stay unknown, and only a vendor that has observed
 *                      an address can settle them.
 *
 * Spends Firecrawl searches and free DNS. No Hunter credits, deliberately: the
 * point is to find out what a Hunter search would have been spent on.
 *
 * Usage:  npx tsx src/scripts/mx_probe.ts [--n=30]
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { pickCompanyDomain, type DomainCandidate } from '../services/companyDomain';

const prisma = new PrismaClient();
const N = Number(process.argv.find(a => a.startsWith('--n'))?.split('=')[1] ?? 0) || 30;
const OUT = process.env.MX_OUT || '.';

// Firecrawl rate-limits hard on this plan, so every query goes through one
// queue with a minimum gap, exactly as the bake-off does.
const MIN_GAP_MS = 3500;
let chain: Promise<unknown> = Promise.resolve();
let lastAt = 0;

function throttle<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
        const wait = Math.max(0, lastAt + MIN_GAP_MS - Date.now());
        if (wait) await new Promise(r => setTimeout(r, wait));
        lastAt = Date.now();
        return fn();
    });
    chain = run.catch(() => {});
    return run as Promise<T>;
}

async function search(q: string): Promise<string[]> {
    for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) await new Promise(r => setTimeout(r, 15000 * attempt));
        try {
            const data = await throttle(async () => {
                const res = await axios.post(
                    'https://api.firecrawl.dev/v1/search',
                    { query: q, limit: 8, location: 'Australia' },
                    { headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` }, timeout: 60000 },
                );
                return res.data;
            });
            return (data?.data ?? []).map((r: any) => r.url).filter(Boolean);
        } catch (err: any) {
            if (err?.response?.status === 429) continue;
        }
    }
    return [];
}

function hostOf(url: string): string | null {
    try {
        return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return null;
    }
}

/**
 * Microsoft encodes the tenant's primary domain in the MX host by swapping
 * dots for dashes. That is lossy for a domain containing a real hyphen, so a
 * decode is only believed once the decoded name has an MX of its own.
 */
export function decodeMicrosoftTenant(exchange: string): string | null {
    const m = /^([a-z0-9-]+)\.mail\.protection\.outlook\.com\.?$/i.exec(exchange);
    return m ? m[1].replace(/-/g, '.') : null;
}

type Verdict =
    | 'no-domain'
    | 'no-mx'
    | 'mx-reveals-other'
    | 'mx-names-parent'
    | 'mx-confirms-self'
    | 'mx-opaque';

/**
 * MX over HTTPS rather than through the resolver.
 *
 * `dns.resolveMx` talks UDP to port 53, which this environment refuses outright
 * (ECONNREFUSED on every name, including ones that plainly do receive mail).
 * A run built on it reported 30 of 30 employers as having no MX, which would
 * have been read as a finding rather than as a broken instrument.
 */
async function mxOf(domain: string): Promise<string[]> {
    try {
        const { data } = await axios.get('https://dns.google/resolve', {
            params: { name: domain, type: 'MX' },
            timeout: 10000,
        });
        if (data?.Status !== 0) return [];
        return (data.Answer ?? [])
            .filter((a: any) => a.type === 15)
            .map((a: any) => String(a.data))
            .sort((a: string, b: string) => Number(a.split(' ')[0]) - Number(b.split(' ')[0]))
            .map((d: string) => d.split(' ').slice(1).join(' ').toLowerCase().replace(/\.$/, ''));
    } catch {
        return [];
    }
}

async function classify(domain: string): Promise<{ verdict: Verdict; mailDomain: string | null; mx: string }> {
    const mx = await mxOf(domain);
    if (!mx.length) return { verdict: 'no-mx', mailDomain: null, mx: '-' };

    const tenant = decodeMicrosoftTenant(mx[0]);
    if (tenant === domain) return { verdict: 'mx-confirms-self', mailDomain: domain, mx: mx[0] };
    if (tenant) {
        // A decode with no dot in it is not a domain. Sportsbet's MX reads
        // `paddypowergroup`, which names the parent group without saying where
        // its mail sits. That is a lead for a human, not an address to query.
        if (!tenant.includes('.')) return { verdict: 'mx-names-parent', mailDomain: null, mx: mx[0] };
        const confirmed = (await mxOf(tenant)).length > 0;
        if (confirmed) return { verdict: 'mx-reveals-other', mailDomain: tenant, mx: mx[0] };
    }
    return { verdict: 'mx-opaque', mailDomain: null, mx: mx[0] };
}

/**
 * Re-run the DNS half against domains a previous run already resolved.
 *
 * The search half is the expensive half, and the first run of this script
 * resolved all 30 domains correctly before failing on DNS. Re-spending 30
 * Firecrawl searches to re-derive answers already on disk would be waste.
 */
async function fromCache(cachePath: string) {
    const prior: any[] = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    console.log(`Re-checking DNS for ${prior.length} domains already resolved.\n`);
    const rows: any[] = [];
    for (const r of prior) {
        const c = r.domain ? await classify(r.domain) : { verdict: 'no-domain' as Verdict, mailDomain: null, mx: '-' };
        rows.push({ ...r, ...c });
        console.log(`${r.company.slice(0, 34).padEnd(34)} ${String(r.domain).slice(0, 30).padEnd(30)} ${c.verdict}${c.mailDomain && c.mailDomain !== r.domain ? `  -> ${c.mailDomain}` : ''}`);
    }
    return rows;
}

async function main() {
    const cachePath = path.join(OUT, 'mx-probe.json');
    if (process.argv.includes('--from-cache') && fs.existsSync(cachePath)) {
        report(await fromCache(cachePath), cachePath);
        return;
    }

    const pool = await prisma.jobApplication.findMany({
        where: { company: { not: null }, description: { not: '' } },
        orderBy: { createdAt: 'desc' },
        take: 400,
        select: { company: true },
    });

    const seen = new Set<string>();
    const companies = pool
        .map(j => j.company as string)
        .filter(c => {
            const k = c.toLowerCase().trim();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        })
        .slice(0, N);

    console.log(`Probing ${companies.length} unique employers from the production corpus.\n`);

    const rows: any[] = [];
    for (const company of companies) {
        const urls = await search(`"${company}" Australia official website`);
        const candidates: DomainCandidate[] = [];
        urls.forEach((u, position) => {
            const h = hostOf(u);
            if (h) candidates.push({ host: h, position });
        });
        const pick = pickCompanyDomain(candidates, company);

        const c = pick.domain
            ? await classify(pick.domain)
            : { verdict: 'no-domain' as Verdict, mailDomain: null, mx: '-' };

        rows.push({ company, ...pick, ...c });

        const flag =
            c.verdict === 'no-mx' ? '  <- a Hunter search here is guaranteed empty'
            : c.verdict === 'mx-reveals-other' ? `  <- ask Hunter about ${c.mailDomain}`
            : '';
        console.log(
            `${company.slice(0, 34).padEnd(34)} ${String(pick.domain).slice(0, 30).padEnd(30)} ${c.verdict}${flag}`,
        );
    }

    report(rows, path.join(OUT, 'mx-probe.json'));
}

function report(rows: any[], outPath: string) {
    const n = rows.length;
    const count = (v: Verdict) => rows.filter(r => r.verdict === v).length;
    const pct = (x: number) => `${String(Math.round((x / n) * 100)).padStart(3)}%`;

    console.log('\n' + '='.repeat(72));
    console.log(`  no domain resolved       ${String(count('no-domain')).padStart(3)} / ${n}  ${pct(count('no-domain'))}`);
    console.log(`  no MX, mail impossible   ${String(count('no-mx')).padStart(3)} / ${n}  ${pct(count('no-mx'))}   free to skip`);
    console.log(`  MX names another domain  ${String(count('mx-reveals-other')).padStart(3)} / ${n}  ${pct(count('mx-reveals-other'))}   free to correct`);
    console.log(`  MX names a parent group  ${String(count('mx-names-parent')).padStart(3)} / ${n}  ${pct(count('mx-names-parent'))}   a lead, not a domain`);
    console.log(`  MX confirms this domain  ${String(count('mx-confirms-self')).padStart(3)} / ${n}  ${pct(count('mx-confirms-self'))}`);
    console.log(`  MX opaque (relay)        ${String(count('mx-opaque')).padStart(3)} / ${n}  ${pct(count('mx-opaque'))}`);
    console.log('='.repeat(72));

    const fixable = count('no-mx') + count('mx-reveals-other');
    console.log(`\nSearches saved or corrected for free: ${fixable} of ${n}  (${pct(fixable)})`);

    fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));
    console.log(`Rows written to ${outPath}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
