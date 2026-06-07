/**
 * Second-pass enrichment: add a clean `field`, `occupationTags`, and normalized
 * `city/state` to the existing sponsors_enriched.json — for occupation+city search.
 *
 * This is CLASSIFICATION of text we already have (name + industry + blurb), not
 * fact-generation about companies, so hallucination surface is tiny. Guardrails:
 *   - `field` must be copied verbatim from a fixed list, else forced to "Other".
 *   - tags are validated to be short strings; capped at 8.
 *   - location parsing is fully deterministic (no model).
 *   - temperature 0.
 *
 * Uses DeepSeek V3 via OpenRouter (cheap). Run a sample first to inspect quality:
 *   npx tsx src/scripts/enrich_sponsor_fields.ts --limit 25 --dry
 * Full run (writes occupation/field/location back into the JSON):
 *   npx tsx src/scripts/enrich_sponsor_fields.ts
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { parseLLMJson } from '../utils/parseLLMResponse';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.ENRICH_MODEL || 'deepseek/deepseek-chat';
const DATA = path.join(__dirname, '..', '..', 'data', 'sponsors_enriched.json');

// Fixed, closed field taxonomy. The model MUST pick one of these verbatim.
const FIELDS = [
  'Technology / IT', 'Healthcare', 'Construction', 'Education', 'Manufacturing',
  'Government & Public Sector', 'Automotive', 'Financial Services', 'Mining & Resources',
  'Energy & Utilities', 'Insurance', 'Retail', 'Hospitality & Tourism', 'Agriculture',
  'Transport & Logistics', 'Food & Beverage', 'Real Estate & Property', 'Professional Services',
  'Engineering', 'Aviation', 'Sports & Recreation', 'Social & Community Services',
  'Media & Creative', 'Legal', 'Science & Research', 'Telecommunications', 'Other',
];
const FIELD_SET = new Set(FIELDS);

// ── Deterministic location parsing (no LLM) ──────────────────────────────────
const STATE_CANON: Record<string, string> = {
  'nsw': 'NSW', 'new south wales': 'NSW',
  'vic': 'VIC', 'victoria': 'VIC',
  'qld': 'QLD', 'queensland': 'QLD',
  'wa': 'WA', 'western australia': 'WA',
  'sa': 'SA', 'south australia': 'SA',
  'tas': 'TAS', 'tasmania': 'TAS',
  'act': 'ACT', 'australian capital territory': 'ACT',
  'nt': 'NT', 'northern territory': 'NT',
};
const CITY_STATE: Record<string, string> = {
  'sydney': 'NSW', 'newcastle': 'NSW', 'wollongong': 'NSW',
  'melbourne': 'VIC', 'geelong': 'VIC', 'bendigo': 'VIC', 'ballarat': 'VIC',
  'brisbane': 'QLD', 'gold coast': 'QLD', 'sunshine coast': 'QLD', 'cairns': 'QLD', 'townsville': 'QLD',
  'perth': 'WA', 'adelaide': 'SA', 'canberra': 'ACT', 'hobart': 'TAS', 'darwin': 'NT',
};

function parseLocation(raw: string): { city: string | null; state: string | null } {
  let s = raw.trim().replace(/,/g, ' ').replace(/\s+/g, ' ');
  if (!s) return { city: null, state: null };
  // Trailing state token (full or abbrev), case-insensitive.
  let state: string | null = null;
  const lower = s.toLowerCase();
  for (const [k, v] of Object.entries(STATE_CANON)) {
    const re = new RegExp(`(^|\\s)${k}$`, 'i');
    if (re.test(lower)) { state = v; s = s.replace(new RegExp(`(^|\\s)${k}$`, 'i'), '').trim(); break; }
  }
  const cityRaw = s.trim();
  const city = cityRaw && !STATE_CANON[cityRaw.toLowerCase()] ? cityRaw : null;
  if (!state && city && CITY_STATE[city.toLowerCase()]) state = CITY_STATE[city.toLowerCase()];
  return { city, state };
}

function normalizeLocations(locations: string[]): { cities: string[]; states: string[] } {
  const cities = new Set<string>();
  const states = new Set<string>();
  for (const loc of locations || []) {
    const { city, state } = parseLocation(loc);
    if (city) cities.add(city);
    if (state) states.add(state);
  }
  return { cities: [...cities], states: [...states] };
}

// ── DeepSeek classification (guardrailed) ─────────────────────────────────────
function buildPrompt(name: string, industry: string, blurb: string): string {
  return `You are categorising an EXISTING Australian employer record for a job-seeker search tool. You are NOT researching the company — only labelling the text below.

Name: "${name}"
Existing industry label: "${industry}"
Hiring blurb: "${blurb || '(none)'}"

Return ONLY this JSON:
{
  "field": "<one value copied EXACTLY from the list below>",
  "occupationTags": ["3-8 lowercase job titles a seeker might search, drawn from the blurb or standard for this field"]
}

Allowed "field" values (copy verbatim, pick the best fit):
${FIELDS.join(' | ')}

Rules:
- "field" MUST be one of the allowed values exactly. If none fit, use "Other".
- Do NOT invent facts about this specific company. Tags are typical roles for the field/blurb — not claims about current vacancies.
- If the blurb is empty and the field is unclear, return "Other" and [].
- No prose. JSON only.`;
}

async function classify(name: string, industry: string, blurb: string): Promise<{ field: string; occupationTags: string[] }> {
  const res = await axios.post(
    OPENROUTER_URL,
    {
      model: MODEL,
      temperature: 0,
      max_tokens: 400,
      messages: [
        { role: 'system', content: 'You classify records into a fixed taxonomy. Return ONLY valid JSON, no markdown, no prose.' },
        { role: 'user', content: buildPrompt(name, industry, blurb) },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://aussiegradcareers.com.au',
        'X-Title': 'JobHub-enrich',
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );
  const parsed = parseLLMJson(res.data.choices[0].message.content);
  // GUARDRAIL: field must be in the closed set, else "Other".
  const field = typeof parsed.field === 'string' && FIELD_SET.has(parsed.field.trim()) ? parsed.field.trim() : 'Other';
  const tags = Array.isArray(parsed.occupationTags)
    ? parsed.occupationTags.filter((t: any) => typeof t === 'string' && t.trim()).map((t: string) => t.trim().toLowerCase()).slice(0, 8)
    : [];
  return { field, occupationTags: tags };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!OPENROUTER_API_KEY) { console.error('OPENROUTER_API_KEY not set'); process.exit(1); }
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : null;
  const dry = process.argv.includes('--dry');

  const records: any[] = JSON.parse(fs.readFileSync(DATA, 'utf-8'));
  const batch = limit ? records.slice(0, limit) : records;
  console.log(`Model: ${MODEL} | ${batch.length} records${dry ? ' (DRY RUN — printing only)' : ''}\n`);

  let invalidField = 0;
  for (let i = 0; i < batch.length; i++) {
    const r = batch[i];
    const loc = normalizeLocations(r.locations);
    try {
      const { field, occupationTags } = await classify(r.cleanName, r.industry, r.hiringProfile);
      if (field === 'Other' && r.industry && r.industry !== 'Unknown') invalidField++;
      console.log(`[${i + 1}] ${r.cleanName}`);
      console.log(`     industry "${r.industry}" → field "${field}"`);
      console.log(`     tags: ${occupationTags.join(', ') || '(none)'}`);
      console.log(`     loc ${JSON.stringify(r.locations)} → cities=${loc.cities.join('/')||'-'} states=${loc.states.join('/')||'-'}`);
      if (!dry) { r.field = field; r.occupationTags = occupationTags; r.cities = loc.cities; r.states = loc.states; }
    } catch (err: any) {
      console.warn(`[${i + 1}] ${r.cleanName} — FAILED: ${err?.message ?? err}`);
    }
    await sleep(120);
  }

  if (!dry) {
    fs.writeFileSync(DATA, JSON.stringify(records, null, 2));
    console.log(`\nWrote field/tags/location back into ${DATA}`);
  }
  console.log(`\nDone. ${batch.length} processed.`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
