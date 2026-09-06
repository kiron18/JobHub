/**
 * The whole contact pipeline, run over the 20-ad corpus, with every call priced.
 *
 * This is the harness step 1 of `docs/hunter-test-plan.md` asks for, and it runs
 * the REAL services rather than a reimplementation of them: `readJdContact`,
 * `pickCompanyDomain`, `pickMailableDomain`, `fetchDirectory`, `pickFromDirectory`
 * and `verifySlots` are the same functions the application calls. A harness that
 * reimplements the pipeline measures the harness.
 *
 * Two things make it safe to run repeatedly.
 *
 * A DISK CACHE under `docs/hunter-test/cache/`, keyed on the call and its
 * arguments. Every SerpApi search and every Hunter response is written there, so
 * the second run of a 40-search, 14-credit pass costs nothing at all. This is the
 * single largest source of avoidable waste the plan names, and it is why the
 * script can be re-run after a picker change without asking for more money.
 *
 * STAGES, because the domain is the known failure. `--stage=free` stops before a
 * single credit moves: it resolves domains, gates them on MX, and asks Hunter's
 * free `/email-count` whether it has ever heard of the employer. `--stage=paid`
 * continues into `/domain-search`, and only for the employers that survived.
 * `--stage=verify` adds the verification pass, which bills to a separate bucket.
 *
 * The account is read before and after, and the delta is printed. That delta is
 * the ground truth on spend, not this script's own counting.
 *
 * Usage:
 *   npx tsx src/scripts/hunter_corpus.ts --stage=free
 *   npx tsx src/scripts/hunter_corpus.ts --stage=paid
 *   npx tsx src/scripts/hunter_corpus.ts --stage=verify
 *   npx tsx src/scripts/hunter_corpus.ts --stage=free --only="NSW Police"
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';

import { readJdContact, isSufficient, type JdContact } from '../services/jdContact';
import { resolveEmployerDomain, type DomainSearchers } from '../services/employerDomain';
import { searchGoogle, searchMaps } from '../services/serpapi';
import { mxOverHttps } from '../services/mailDomain';
import { fetchDirectory, hunterDepartmentForRole, type Directory } from '../services/hunterDirectory';
import { verifySlots } from '../services/verifySlots';
import { pickFromDirectory, type Slots } from '../services/directoryPick';
import { findSiteContact, type SiteContact } from '../services/siteContact';

const CORPUS = process.env.CORPUS_PATH || 'C:\\Users\\Kiron\\Desktop\\JObs samples.txt';
const ROOT = path.resolve(__dirname, '../../..');
const CACHE_DIR = path.join(ROOT, 'docs', 'hunter-test', 'cache');
const OUT = path.join(ROOT, 'docs', 'hunter-test');

const arg = (name: string): string | null =>
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? null;

const STAGE = (arg('stage') ?? 'free') as 'free' | 'paid' | 'verify';
const ONLY = arg('only');

// ---------------------------------------------------------------------------
// The cache. Every priced call goes through it, so a re-run is free.
// ---------------------------------------------------------------------------

let cacheHits = 0;
let cacheMisses = 0;

function cachePath(kind: string, key: unknown): string {
    const h = crypto.createHash('sha1').update(JSON.stringify(key)).digest('hex').slice(0, 16);
    return path.join(CACHE_DIR, `${kind}_${h}.json`);
}

/**
 * Run `fn` unless its answer is already on disk.
 *
 * A null answer is cached too. "Hunter holds nothing for this domain" is a real
 * result that cost a call to learn, and re-learning it costs the same again.
 */
async function cached<T>(kind: string, key: unknown, fn: () => Promise<T>): Promise<T> {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const file = cachePath(kind, key);
    if (fs.existsSync(file)) {
        cacheHits++;
        return JSON.parse(fs.readFileSync(file, 'utf8')).value as T;
    }
    cacheMisses++;
    const value = await fn();
    fs.writeFileSync(file, JSON.stringify({ key, value, at: new Date().toISOString() }, null, 1));
    return value;
}

// ---------------------------------------------------------------------------
// The corpus. Header block ends in `View all jobs`; the company is the nearest
// non-empty line above it, skipping a bare star rating; the title is the line
// above that.
// ---------------------------------------------------------------------------

export interface Ad {
    title: string;
    company: string;
    state: string | null;
    body: string;
}

const STATE = /\b(NSW|VIC|QLD|WA|SA|TAS|NT|ACT)\b/;

export function parseCorpus(text: string): Ad[] {
    const lines = text.split(/\r?\n/);
    const marks: number[] = [];
    lines.forEach((l, i) => { if (l.trim() === 'View all jobs') marks.push(i); });

    const ads: Ad[] = [];
    marks.forEach((mark, n) => {
        const above: string[] = [];
        for (let i = mark - 1; i >= 0 && above.length < 3; i--) {
            const t = lines[i].trim();
            if (!t) continue;
            if (/^\d+(\.\d+)?$/.test(t)) continue;   // a bare star rating
            above.push(t);
        }
        const company = above[0] ?? '';
        const title = above[1] ?? '';
        const end = n + 1 < marks.length ? marks[n + 1] - 4 : lines.length;
        const body = lines.slice(mark + 1, Math.max(mark + 1, end)).join('\n');
        ads.push({ title, company, state: body.slice(0, 600).match(STATE)?.[1] ?? null, body });
    });
    return ads;
}

// ---------------------------------------------------------------------------
// SerpApi. One paid search per call, and an empty result costs the same as a
// full one, which is the opposite of Hunter and worth remembering.
// ---------------------------------------------------------------------------

let serpSearches = 0;

export interface DomainAnswer {
    domain: string | null;
    source: JdContact['domainSource'] | 'KNOWLEDGE_GRAPH' | 'MAPS' | 'ORGANIC' | null;
    note: string;
    alternatives: string[];
}

/**
 * The domain ladder, called through the SAME service the product calls.
 *
 * `resolveEmployerDomain` lives in `services/employerDomain.ts` and is what
 * `research.ts` uses. The harness only supplies the search functions, wrapped
 * in the disk cache, so a re-run costs nothing and a change to the ladder shows
 * up here immediately. A harness with its own copy of the ladder measures the
 * copy.
 */
const cachedSearchers: DomainSearchers = {
    google: (q) => cached('serpapi_google', { q }, async () => { serpSearches++; return searchGoogle(q); }),
    maps: (q) => cached('serpapi_maps', { q }, async () => { serpSearches++; return searchMaps(q); }),
    mx: (d) => cached('mx', { d }, () => mxOverHttps(d)),
};

async function resolveDomain(ad: Ad, jd: JdContact): Promise<DomainAnswer> {
    // Rung 0: the ad said so itself. Free, and more authoritative than anything
    // the search ladder can infer.
    if (jd.domain && (jd.domainSource === 'JD_EMAIL' || jd.domainSource === 'JD_REDACTED')) {
        return { domain: jd.domain, source: jd.domainSource, note: 'printed in the ad', alternatives: [] };
    }

    const found = await resolveEmployerDomain(ad.company, ad.state, cachedSearchers);
    return { domain: found.domain, source: found.source, note: found.note, alternatives: [] };
}

// ---------------------------------------------------------------------------
// Hunter. `/email-count` is free and decides whether a credit is worth spending.
// ---------------------------------------------------------------------------

export interface Coverage {
    total: number;
    personal: number;
    generic: number;
    departments: Record<string, number>;
}

async function emailCount(domain: string): Promise<Coverage | null> {
    return cached('emailcount', { domain }, async () => {
        try {
            const { data } = await axios.get('https://api.hunter.io/v2/email-count', {
                params: { domain, api_key: process.env.HUNTER_API_KEY },
                timeout: 20000,
            });
            const d = data?.data;
            if (!d) return null;
            return {
                total: d.total ?? 0,
                personal: d.personal_emails ?? 0,
                generic: d.generic_emails ?? 0,
                departments: Object.fromEntries(
                    Object.entries(d.department ?? {}).filter(([, v]) => (v as number) > 0),
                ) as Record<string, number>,
            };
        } catch (err: any) {
            console.warn(`[email-count] ${domain}: ${err.message}`);
            return null;
        }
    });
}

/**
 * Which single department to buy.
 *
 * The current pipeline calls `/domain-search` twice per employer, blind: once
 * for `hr` and once for the vacancy's own department. The free coverage call
 * already says which of those Hunter actually holds anyone in, so the pair
 * collapses to one targeted call. Where it holds people in neither, an
 * untargeted call still returns the ten Hunter lists first, which is what the
 * old untargeted path did.
 */
export function departmentToBuy(cov: Coverage, role: string): string | null {
    const own = hunterDepartmentForRole(role);
    const has = (d: string | null) => !!d && (cov.departments[d] ?? 0) > 0;
    if (has('hr')) return 'hr';
    if (has(own)) return own;
    const biggest = Object.entries(cov.departments).sort((a, b) => b[1] - a[1])[0];
    return biggest ? biggest[0] : null;
}

// ---------------------------------------------------------------------------

interface Row {
    company: string;
    title: string;
    jdEmail: string | null;
    jdName: string | null;
    domain: string | null;
    domainSource: string | null;
    domainNote: string;
    mx: 'pass' | 'corrected' | 'no-mail' | 'skipped';
    coverage: Coverage | null;
    department: string | null;
    directoryTotal: number | null;
    slots: Slots | null;
    site: SiteContact | null;
    outcome: string;
}

async function main() {
    if (!fs.existsSync(CORPUS)) throw new Error(`corpus not found: ${CORPUS}`);
    let ads = parseCorpus(fs.readFileSync(CORPUS, 'utf8'));
    if (ONLY) ads = ads.filter(a => a.company.toLowerCase().includes(ONLY.toLowerCase()));

    const before = await account();
    console.log(`\ncorpus: ${ads.length} ads   stage: ${STAGE}`);
    console.log(`hunter before: searches ${before.searches} left, verifications ${before.verifications} left\n`);

    const rows: Row[] = [];

    for (const ad of ads) {
        const jd = readJdContact(ad.body);
        const row: Row = {
            company: ad.company, title: ad.title,
            jdEmail: jd.email, jdName: jd.personName,
            domain: null, domainSource: null, domainNote: '',
            mx: 'skipped', coverage: null, department: null,
            directoryTotal: null, slots: null, site: null, outcome: '',
        };

        // The ad printed an address. Nothing below can beat it, and it costs nothing.
        if (isSufficient(jd)) {
            row.outcome = `JD contact: ${jd.email}${jd.personName ? ` (${jd.personName})` : ''}`;
            row.domain = jd.domain; row.domainSource = jd.domainSource; row.domainNote = 'printed in the ad';
            rows.push(row); report(row); continue;
        }

        const d = await resolveDomain(ad, jd);
        row.domainSource = d.source; row.domainNote = d.note;
        row.domain = d.domain;
        // The MX gate now runs inside the ladder, so a null domain here already
        // means either nothing bore the name or nothing that did receives mail.
        row.mx = d.domain ? 'pass' : 'no-mail';

        if (!d.domain) { row.outcome = `no domain: ${d.note}`; rows.push(row); report(row); continue; }
        const mailable = { domain: d.domain };

        row.coverage = await emailCount(mailable.domain);
        if (!row.coverage || row.coverage.total === 0) {
            // Hunter has never indexed this employer. Their own contact page
            // still exists, and reading it costs nothing.
            row.site = await findSiteContact(mailable.domain);
            row.outcome = row.site
                ? `site contact: ${row.site.email} (${row.site.sourceUrl})`
                : 'Hunter holds nothing, and the site publishes no address either';
            rows.push(row); report(row); continue;
        }

        row.department = departmentToBuy(row.coverage, ad.title);

        if (STAGE === 'free') {
            row.outcome = `would buy: ${row.department ?? 'untargeted'} (${row.coverage.total} known)`;
            rows.push(row); report(row); continue;
        }

        const dir = await cached<Directory | null>(
            'domainsearch', { domain: mailable.domain, department: row.department },
            () => fetchDirectory(mailable.domain!, row.department ? { department: row.department } : {}),
        );
        row.directoryTotal = dir?.total ?? null;

        if (!dir || !dir.people.length) {
            row.site = await findSiteContact(mailable.domain);
            row.outcome = row.site ? `directory empty; site contact: ${row.site.email}` : 'directory empty';
            rows.push(row); report(row); continue;
        }

        let slots = pickFromDirectory(dir, { role: ad.title });

        if (STAGE === 'verify') {
            slots = await cached('verify', { emails: Object.values(slots).map(s => s?.email ?? null) },
                () => verifySlots(slots));
        }

        row.slots = slots;
        const filled = Object.entries(slots).filter(([, v]) => v).map(([k]) => k);
        if (!filled.length) {
            row.site = await findSiteContact(mailable.domain);
            row.outcome = row.site
                ? `nobody in the directory fits; site contact: ${row.site.email}`
                : 'directory had nobody who fits, and the site publishes no address';
        } else {
            row.outcome = `filled: ${filled.join(', ')}`;
        }
        rows.push(row); report(row);
    }

    const after = await account();
    summarise(rows, before, after);
}

async function account(): Promise<{ searches: number; verifications: number }> {
    const { data } = await axios.get('https://api.hunter.io/v2/account', {
        params: { api_key: process.env.HUNTER_API_KEY }, timeout: 20000,
    });
    const r = data.data.requests;
    return {
        searches: r.searches.available - r.searches.used,
        verifications: r.verifications.available - r.verifications.used,
    };
}

function report(r: Row) {
    console.log(`${r.company}  |  ${r.title}`);
    console.log(`   domain   ${r.domain ?? '(none)'}  [${r.domainSource ?? '-'}]  ${r.domainNote}`);
    if (r.mx !== 'skipped') console.log(`   mx       ${r.mx}`);
    if (r.coverage) console.log(`   hunter   ${r.coverage.total} addresses (${r.coverage.personal} personal)  ${JSON.stringify(r.coverage.departments)}`);
    if (r.slots) for (const [k, v] of Object.entries(r.slots)) if (v) console.log(`   ${k.padEnd(8)} ${v.email}  ${v.name}  ${v.position ?? ''}  [${v.verification ?? 'unchecked'}]`);
    if (r.site) console.log(`   site     ${r.site.email}  ${r.site.generic ? '(shared inbox)' : '(a person)'}  ${r.site.sourceUrl}`);
    console.log(`   ->       ${r.outcome}\n`);
}

function summarise(rows: Row[], before: { searches: number; verifications: number }, after: { searches: number; verifications: number }) {
    const n = rows.length || 1;
    const jd = rows.filter(r => r.jdEmail).length;
    const gotDomain = rows.filter(r => r.domain).length;
    const covered = rows.filter(r => (r.coverage?.total ?? 0) > 0).length;
    const filled = rows.filter(r => r.slots && Object.values(r.slots).some(Boolean)).length;
    const fromSite = rows.filter(r => r.site).length;

    console.log('='.repeat(72));
    console.log(`ads                        ${rows.length}`);
    console.log(`contact printed in the ad  ${jd}  (${Math.round(100 * jd / n)}%, no call at all)`);
    console.log(`domain resolved            ${gotDomain}`);
    console.log(`Hunter has coverage        ${covered}`);
    if (STAGE !== 'free') console.log(`at least one slot filled   ${filled}`);
    console.log(`address off the company site ${fromSite}   (free, no vendor)`);
    console.log(`ANY contact at all         ${rows.filter(r => r.jdEmail || r.site || (r.slots && Object.values(r.slots).some(Boolean))).length}`);
    console.log('');
    console.log(`serpapi searches spent     ${serpSearches}   (cache: ${cacheHits} hits, ${cacheMisses} misses)`);
    console.log(`hunter searches spent      ${before.searches - after.searches}   (${after.searches} left)`);
    console.log(`hunter verifications spent ${before.verifications - after.verifications}   (${after.verifications} left)`);
    console.log('='.repeat(72));

    const file = path.join(OUT, `corpus_${STAGE}.json`);
    fs.writeFileSync(file, JSON.stringify({ stage: STAGE, at: new Date().toISOString(), before, after, rows }, null, 1));
    console.log(`\nwritten: ${path.relative(ROOT, file)}`);
}

/**
 * Only run when invoked directly.
 *
 * `parseCorpus` is exported so a test can check the parse without touching the
 * network, and without this guard importing it ran the whole priced pass. That
 * mistake cost 20 SerpApi searches before anyone noticed.
 */
if (process.argv[1] && /hunter_corpus\.(ts|js)$/.test(process.argv[1])) {
    main().catch(e => { console.error(e); process.exit(1); });
}
