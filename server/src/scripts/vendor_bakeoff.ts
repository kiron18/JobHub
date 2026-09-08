/**
 * SerpApi vs Serper, over the same twenty employers, through the real ladder.
 *
 * The question this answers is not "does Serper work" — it does — but "what
 * does dropping SerpApi cost the domain step". They are not interchangeable:
 * SerpApi's /search carries `knowledge_graph.website` and Serper's carries no
 * knowledge panel at all, and on the recorded corpus run that rung resolved 7
 * of 20 employers on its own. Whether those 7 survive on the rungs below is a
 * measurement, not a guess, and this is the measurement.
 *
 * It calls `resolveEmployerDomain` — the real ladder, the same function
 * research.ts calls — and only swaps the DomainSearchers under it, so what is
 * compared is the vendor and nothing else.
 *
 * Costs about 25 searches per vendor. Hunter is never touched: this stops at
 * the domain, which is the only thing the vendor can affect.
 *
 *   npx tsx src/scripts/vendor_bakeoff.ts
 *   npx tsx src/scripts/vendor_bakeoff.ts --vendor=serper   (one side only)
 *
 * Result, 8 Sep 2026, over the twenty-ad corpus:
 *
 *   same 16   lost 0   gained 4   different 0
 *
 * Every one of the 7 employers SerpApi resolved from the knowledge panel,
 * Serper resolved to the SAME domain one rung down on organic results, so the
 * rung Serper cannot see turned out not to be load-bearing. Serper resolved 4
 * more and spent fewer searches doing it, because resolving at rung 2 skips the
 * second Maps call.
 *
 * Two of those 4 are not wins. "Speed" resolved to gangcalledspeed.com where
 * the recorded baseline says prospeedracing.com.au, and "WA Country Health
 * Service" to ruralhealthwest.com.au, a different organisation — its real
 * domain was found and then dropped for taking no mail, and the next candidate
 * scored a name match on the words "health" and "west". Neither is caused by
 * the vendor: it is the ORGANIC rung's name gate being looser than the MAPS
 * one, which better coverage exposes rather than creates. See mapsNameStrengthMin
 * in employerDomain.ts for the shape the fix would take.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

import { resolveEmployerDomain, type DomainSearchers } from '../services/employerDomain';
import { mxOverHttps } from '../services/mailDomain';
import * as serpapi from '../services/serpapi';
import * as serper from '../services/serper';

const ROOT = path.resolve(__dirname, '../../..');
const BASELINE = path.join(ROOT, 'docs', 'hunter-test', 'corpus_free.json');
const OUT = path.join(ROOT, 'docs', 'hunter-test', 'vendor_bakeoff.json');

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=')[1] ?? null;
const ONLY_VENDOR = arg('vendor');

/**
 * The employers, taken from the recorded corpus run rather than re-parsed from
 * the ads, so both sides answer exactly the question the baseline answered.
 * `state` matters: it is what the Maps rung gates on.
 */
interface BaselineRow {
    company: string;
    domain: string | null;
    domainSource: string | null;
    state?: string | null;
}

const searchersFor = (vendor: 'serpapi' | 'serper'): DomainSearchers => vendor === 'serpapi'
    ? { google: (q) => serpapi.searchGoogle(q), maps: (q) => serpapi.searchMaps(q), mx: mxOverHttps }
    : { google: (q) => serper.searchGoogle(q), maps: (q) => serper.searchMaps(q), mx: mxOverHttps };

async function runVendor(vendor: 'serpapi' | 'serper', rows: BaselineRow[]) {
    const searchers = searchersFor(vendor);
    const out: Record<string, { domain: string | null; source: string | null; note: string; searches: number }> = {};
    let searches = 0;

    for (const row of rows) {
        try {
            const r = await resolveEmployerDomain(row.company, row.state ?? null, searchers);
            out[row.company] = { domain: r.domain, source: r.source, note: r.note, searches: r.searches };
            searches += r.searches;
        } catch (err: any) {
            out[row.company] = { domain: null, source: null, note: `ERROR ${err.message}`, searches: 0 };
        }
    }
    console.log(`${vendor}: ${searches} searches spent`);
    return out;
}

async function main() {
    if (!fs.existsSync(BASELINE)) throw new Error(`no baseline at ${BASELINE}`);
    const rows: BaselineRow[] = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).rows;
    console.log(`${rows.length} employers from the recorded corpus run\n`);

    const results: Record<string, any> = {};
    for (const vendor of ['serpapi', 'serper'] as const) {
        if (ONLY_VENDOR && ONLY_VENDOR !== vendor) continue;
        results[vendor] = await runVendor(vendor, rows);
    }

    if (!results.serpapi || !results.serper) {
        fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
        return;
    }

    console.log();
    console.log('employer'.padEnd(34) + 'serpapi'.padEnd(26) + 'serper'.padEnd(26) + 'verdict');
    console.log('-'.repeat(104));

    let same = 0, lost = 0, gained = 0, differ = 0;
    for (const row of rows) {
        const a = results.serpapi[row.company];
        const b = results.serper[row.company];
        let verdict: string;
        if (a.domain === b.domain) { verdict = a.domain ? 'same' : 'both none'; same++; }
        else if (a.domain && !b.domain) { verdict = 'LOST'; lost++; }
        else if (!a.domain && b.domain) { verdict = 'gained'; gained++; }
        else { verdict = 'DIFFERENT'; differ++; }

        console.log(
            row.company.slice(0, 33).padEnd(34) +
            `${a.domain ?? '-'} (${a.source ?? '-'})`.slice(0, 25).padEnd(26) +
            `${b.domain ?? '-'} (${b.source ?? '-'})`.slice(0, 25).padEnd(26) +
            verdict
        );
    }

    console.log('-'.repeat(104));
    console.log(`same ${same}   lost ${lost}   gained ${gained}   different ${differ}   of ${rows.length}`);

    const rungs = (r: Record<string, any>) => {
        const by: Record<string, number> = {};
        for (const v of Object.values(r)) by[v.source ?? 'none'] = (by[v.source ?? 'none'] ?? 0) + 1;
        return by;
    };
    console.log('\nrung mix  serpapi', JSON.stringify(rungs(results.serpapi)));
    console.log('rung mix  serper ', JSON.stringify(rungs(results.serper)));

    fs.writeFileSync(OUT, JSON.stringify({ rows, results }, null, 2));
    console.log(`\n→ ${path.relative(ROOT, OUT)}`);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
