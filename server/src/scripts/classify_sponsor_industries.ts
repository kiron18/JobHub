/**
 * Assign an industry to the ~33k standard-tier sponsors, from their name alone.
 *
 * Why not reuse enrich_sponsors.ts: that script runs a Serper (Google) search plus an
 * LLM call for every single company. It cost $5-25 for 3,800 accredited sponsors, so
 * the same treatment for 33k would run into the hundreds of dollars. This script does
 * no web search at all. It batches 40 company names into one cheap LLM call and asks
 * only for a category.
 *
 * Measured on a 200-company sample: $0.0049 and 5 seconds, so the full 33k lands
 * near $0.80 and about fifteen minutes. Run --limit 200 first and read the spend it
 * prints before committing to the rest.
 *
 * Two things dominate that number, both learned the hard way:
 *   - Model choice. Plain kimi-k2 is served only by Novita, where one 40-name call
 *     took four minutes. kimi-k2.5 has ten providers and answers in about two seconds.
 *   - Reply format. Asking for the division spelled out cost 5x the output tokens of
 *     asking for a numeric code, and output tokens are most of the bill.
 *
 * The trade-off is honest: this is inference from a company name, not researched fact.
 * "MINE POWER SOLUTIONS PTY LTD" is obviously Mining; plenty of others are not
 * obvious, and for those the model is told to answer Unknown rather than guess. Rows
 * that come back Unknown keep a null industry and simply do not appear under an
 * industry filter.
 *
 * Categories are the 19 ANZSIC divisions, so the filter list stays a fixed, standard
 * set instead of fragmenting into thousands of free-text values.
 *
 * Usage (from the `server/` folder):
 *   # Coverage test on 200 companies, prints cost, writes nothing to the DB:
 *   npx tsx src/scripts/classify_sponsor_industries.ts --limit 200
 *
 *   # Full run. Resumable: re-running skips anything already classified.
 *   npx tsx src/scripts/classify_sponsor_industries.ts
 *
 * Flags:
 *   --file <path>   Registry JSON (default: data/sponsor-source/sponsor_registry.json)
 *   --limit <n>     Only classify the first N unclassified companies
 *   --batch <n>     Companies per LLM call (default 40)
 *   --concurrency <n>  Batches in flight at once (default 6)
 *   --model <slug>  OpenRouter model (default: $SPONSOR_CLASSIFY_MODEL or Kimi K2)
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';


dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Deliberately not services/llm.ts::callLLM — that helper hardcodes the model to
// $FAST_MODEL for the whole app and takes no system message. This job wants a
// specific cheap model for itself without changing what every other caller gets.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function askModel(system: string, user: string, model: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await axios.post(
        OPENROUTER_URL,
        {
          model,
          temperature: 0,
          max_tokens: 4096,
          // Kimi K2 on OpenRouter defaults to a reasoning variant that burns ~500
          // thinking tokens on what is a lookup task. Leaving it on made each call
          // take 30s and cost 10x more. This is the single most important line here.
          reasoning: { enabled: false },
          // No response_format here: the cheap providers serving Kimi K2 reject
          // structured-outputs with a 400, and the reply is plain pairs anyway.
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://aussiegradcareers.com.au',
            'X-Title': process.env.OPENROUTER_APP_TITLE || 'JobHub',
          },
          timeout: 120_000,
        },
      );
      const content = res.data?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) {
        const usage = res.data?.usage;
        if (usage) {
          tokensIn += usage.prompt_tokens ?? 0;
          tokensOut += usage.completion_tokens ?? 0;
          // OpenRouter reports the actual charge per call, which beats estimating
          // from published rates when a run has a fixed budget.
          spend += usage.cost ?? 0;
          reasoningTokens += usage.completion_tokens_details?.reasoning_tokens ?? 0;
        }
        return content;
      }
      throw new Error(`no content in response: ${JSON.stringify(res.data).slice(0, 200)}`);
    } catch (err: any) {
      // Keep the provider's own message; "status code 400" alone is untraceable.
      const body = err?.response?.data;
      lastErr = body
        ? new Error(`${err.message}: ${JSON.stringify(body).slice(0, 400)}`)
        : err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastErr;
}

let tokensIn = 0;
let tokensOut = 0;
let spend = 0;
let reasoningTokens = 0;

// The 19 ANZSIC divisions. Kept verbatim so the values match what the ABS publishes
// and what a job seeker will recognise from other Australian sites.
const DIVISIONS = [
  'Agriculture, Forestry and Fishing',
  'Mining',
  'Manufacturing',
  'Electricity, Gas, Water and Waste Services',
  'Construction',
  'Wholesale Trade',
  'Retail Trade',
  'Accommodation and Food Services',
  'Transport, Postal and Warehousing',
  'Information Media and Telecommunications',
  'Financial and Insurance Services',
  'Rental, Hiring and Real Estate Services',
  'Professional, Scientific and Technical Services',
  'Administrative and Support Services',
  'Public Administration and Safety',
  'Education and Training',
  'Health Care and Social Assistance',
  'Arts and Recreation Services',
  'Other Services',
] as const;

interface Row {
  name: string;
  tier: string;
  industry: string | null;
  [k: string]: unknown;
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
}

// The reply format is deliberately terse. Asking for the division spelled out cost
// ~15 output tokens per company and pushed a 40-company call past five minutes on
// the cheap providers. Emitting a code costs ~4 and is just as unambiguous.
const SYSTEM = `You classify Australian businesses into ANZSIC industry divisions using only the company's registered name.

Codes:
${DIVISIONS.map((d, i) => `${i + 1}=${d}`).join('\n')}
0=Unknown

Rules:
- If the name does not clearly indicate an industry, answer 0. A wrong guess is worse than 0. Names that are just a person's name, an acronym, initials, or a holding/trust vehicle should almost always be 0.
- "Pty Ltd", "Pty. Ltd.", "Proprietary" are Australian legal suffixes and carry no industry meaning. Neither do "Group", "Holdings", "Enterprises", "Australia", "The Trustee for".
- Some lines carry "[was labelled: X]" from an earlier pass. Treat it as a strong hint and map it onto the closest division, but override it if the company name plainly contradicts it.
- Where a line shows "[registered as: ...]", the leading name is the trading name and is the one that tells you what the business does. Classify on it. The registered name is usually a trust or holding vehicle and should be ignored.
- Reply with one "line:code" pair per company, space separated, in order, and nothing else.
- Example for three companies: 1:8 2:5 3:0`;

const PAIR = /(\d+)\s*:\s*(\d+)/g;

/**
 * One line per company: the most informative name we hold, plus any prior label.
 *
 * For a business held in a trust the registered name is 'THE TRUSTEE FOR <X> TRUST',
 * which describes an ownership structure and not an industry. Where the ABR also
 * gave us the name it trades under, that goes first, because that is the one that
 * says what the business actually does.
 */
function describe(row: Row, i: number): string {
  const trading = typeof row.tradingName === 'string' ? row.tradingName.trim() : '';
  const hint = typeof row.industryHint === 'string' ? row.industryHint.trim() : '';

  let line = `${i + 1}. ${trading || row.name}`;
  if (trading) line += ` [registered as: ${row.name}]`;
  if (hint) line += ` [was labelled: ${hint}]`;
  return line;
}

async function classifyBatch(rows: Row[], model: string): Promise<(string | null)[]> {
  const names = rows; // indices below are into this array
  const numbered = rows.map(describe).join('\n');
  const raw = await askModel(SYSTEM, numbered, model);

  const out: (string | null)[] = new Array(names.length).fill(null);
  for (const m of raw.matchAll(PAIR)) {
    const idx = Number(m[1]) - 1;
    const code = Number(m[2]);
    if (!Number.isInteger(idx) || idx < 0 || idx >= names.length) continue;
    // 0 is Unknown, and anything outside 1..19 is a malformed answer. Both stay null.
    if (code >= 1 && code <= DIVISIONS.length) out[idx] = DIVISIONS[code - 1];
  }
  return out;
}

async function main() {
  const file = arg('--file')
    ?? path.join(__dirname, '..', '..', 'data', 'sponsor-source', 'sponsor_registry.json');
  const limit = Number(arg('--limit') ?? 0);
  const batchSize = Number(arg('--batch') ?? 40);
  const concurrency = Number(arg('--concurrency') ?? 6);
  const model = arg('--model')
    ?? process.env.SPONSOR_CLASSIFY_MODEL
    // k2.5 rather than plain k2: k2 and k2-0905 are served only by Novita, where a
    // 40-name call took four minutes. k2.5 has ten providers and returns in ~2s.
    ?? 'moonshotai/kimi-k2.5';

  const rows: Row[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const todo = rows.filter((r) => !r.industry);
  const target = limit > 0 ? todo.slice(0, limit) : todo;

  console.log(`[classify] ${rows.length.toLocaleString()} rows, ${todo.length.toLocaleString()} without an industry`);
  console.log(`[classify] classifying ${target.length.toLocaleString()} via ${model}, ${batchSize} per call, ${concurrency} in flight`);
  if (target.length === 0) return;

  // Split into batches up front, then run several in flight at once. Sequentially
  // this is ~800 calls at ~3s each, which is 40 minutes of mostly waiting on the
  // network; a small pool brings it under ten.
  const batches: Row[][] = [];
  for (let i = 0; i < target.length; i += batchSize) {
    batches.push(target.slice(i, i + batchSize));
  }

  let done = 0;
  let assigned = 0;
  let failedBatches = 0;
  let next = 0;
  let sinceCheckpoint = 0;
  // Only the main thread writes the file, and only between awaits, so the JSON can
  // never be observed half-written.
  const checkpoint = () => fs.writeFileSync(file, JSON.stringify(rows, null, 1), 'utf-8');

  async function worker() {
    while (next < batches.length) {
      const idx = next++;
      const batch = batches[idx];
      try {
        const results = await classifyBatch(batch, model);
        batch.forEach((row, j) => {
          if (results[j]) {
            row.industry = results[j];
            assigned++;
          }
        });
      } catch (err: any) {
        // One bad batch must not cost us the whole run; those rows stay null and a
        // re-run will pick them up again.
        failedBatches++;
        console.error(`[classify] batch ${idx} failed: ${err?.message ?? err}`);
      }
      done += batch.length;
      sinceCheckpoint++;

      // Checkpoint periodically. This job costs real money, so a crash must never
      // throw away work already paid for.
      if (sinceCheckpoint >= concurrency) {
        sinceCheckpoint = 0;
        checkpoint();
        console.log(`[classify] ${done.toLocaleString()}/${target.length.toLocaleString()} | assigned ${assigned.toLocaleString()} | failed ${failedBatches}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  checkpoint();

  const unknown = done - assigned;
  console.log(`\n[classify] done. assigned ${assigned.toLocaleString()}, left unknown ${unknown.toLocaleString()} (${(unknown / done * 100).toFixed(0)}%)`);
  console.log(`[classify] tokens: ${tokensIn.toLocaleString()} in, ${tokensOut.toLocaleString()} out`);
  console.log(`[classify] spend: $${spend.toFixed(4)}`);
  if (reasoningTokens > 0) {
    console.log(`[classify] WARNING: ${reasoningTokens.toLocaleString()} reasoning tokens billed. The model ignored reasoning.enabled=false; try another model or provider before running the full set.`);
  }
  if (target.length < todo.length) {
    console.log(`[classify] projected for the remaining ${todo.length.toLocaleString()}: $${(spend / done * todo.length).toFixed(2)}`);
  }
  console.log(`[classify] wrote ${file}`);
  console.log('[classify] re-run to retry the unknowns, or seed now.');
}

main().catch((err) => {
  console.error('[classify] fatal:', err);
  process.exit(1);
});
