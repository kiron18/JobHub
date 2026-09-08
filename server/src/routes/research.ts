import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { searchSerper, scrapeUrl, snippetsToText, type SerperResult } from '../services/serper';
import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { parseLLMJson } from '../utils/parseLLMResponse';
import { fillSlots, filterContact, type OutreachRole } from '../services/contactFilter';
import { fetchDirectoryTargeted, fetchSharedInbox } from '../services/hunterDirectory';
import { pickFromDirectory, type Pick, type Slots } from '../services/directoryPick';
import { findSiteContact } from '../services/siteContact';
import { verifySlots } from '../services/verifySlots';
import { readJdContact, isSufficient } from '../services/jdContact';
import { resolveEmployerDomain, stateOf } from '../services/employerDomain';
import { pickMailableDomain } from '../services/mailDomain';
import { resolveEntityName } from '../services/abnLookup';

const router = Router();

// ── Hiring-contact discovery ─────────────────────────────────────────────────

type Confidence = 'high' | 'medium' | 'low';

interface Candidate {
    name: string;
    title: string | null;
    confidence: Confidence;
    sourceUrl: string | null;
    /** "Greater Sydney Area", "Perth, WA". The state gate reads this. */
    location: string | null;
}

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

/**
 * Derive a discipline + the LinkedIn-side titles that typically hold the
 * hiring-decision authority for that discipline. The titles drive the
 * Pass 1 LinkedIn search query.
 */
function deriveDiscipline(role: string): { discipline: string; titles: string[] } {
    const r = (role || '').toLowerCase();
    const m = (...keys: string[]) => keys.some(k => r.includes(k));

    if (m('engineer', 'developer', 'sde', 'software', 'devops', 'platform', 'sre')) {
        return { discipline: 'engineering', titles: ['Head of Engineering', 'Engineering Director', 'Director of Engineering', 'VP Engineering', 'CTO', 'Engineering Manager'] };
    }
    if (m('data scientist', 'data engineer', 'machine learning', 'ml engineer', 'analytics engineer')) {
        return { discipline: 'data', titles: ['Head of Data', 'Director of Data', 'VP Data', 'Chief Data Officer', 'Head of Analytics'] };
    }
    if (m('marketing', 'growth', 'brand', 'demand gen', 'content marketer')) {
        return { discipline: 'marketing', titles: ['Head of Marketing', 'Marketing Director', 'Director of Marketing', 'VP Marketing', 'CMO', 'Head of Growth'] };
    }
    if (m('sales', 'account executive', 'business development', 'bdm', 'bdr', 'sdr')) {
        return { discipline: 'sales', titles: ['Head of Sales', 'Sales Director', 'Director of Sales', 'VP Sales', 'Chief Revenue Officer', 'CRO'] };
    }
    if (m('product manager', 'product owner', 'product lead', 'head of product')) {
        return { discipline: 'product', titles: ['Head of Product', 'Director of Product', 'VP Product', 'CPO', 'Chief Product Officer'] };
    }
    if (m('designer', 'design', 'ux', 'ui', 'visual designer')) {
        return { discipline: 'design', titles: ['Head of Design', 'Design Director', 'Director of Design', 'VP Design', 'Chief Design Officer'] };
    }
    if (m('finance', 'accountant', 'controller', 'fp&a', 'financial analyst')) {
        return { discipline: 'finance', titles: ['Head of Finance', 'Finance Director', 'Director of Finance', 'CFO', 'Chief Financial Officer'] };
    }
    if (m('hr ', 'people ', 'human resources', 'talent partner', 'people operations', 'p&c')) {
        return { discipline: 'people', titles: ['Head of People', 'HR Director', 'Director of People', 'VP People', 'Chief People Officer', 'CHRO'] };
    }
    if (m('operations', 'ops manager', 'coo', 'supply chain', 'logistics')) {
        return { discipline: 'operations', titles: ['Head of Operations', 'Operations Director', 'Director of Operations', 'VP Operations', 'COO'] };
    }
    if (m('legal', 'lawyer', 'solicitor', 'paralegal', 'counsel')) {
        return { discipline: 'legal', titles: ['Head of Legal', 'General Counsel', 'Legal Director', 'Director of Legal'] };
    }
    if (m('customer success', 'cs manager', 'csm', 'customer experience', 'support manager')) {
        return { discipline: 'customer-success', titles: ['Head of Customer Success', 'Director of Customer Success', 'VP Customer Success'] };
    }
    if (m('nurse', 'clinical', 'midwife', 'allied health')) {
        return { discipline: 'clinical', titles: ['Director of Nursing', 'Nurse Unit Manager', 'Clinical Director'] };
    }
    if (m('teacher', 'lecturer', 'educator', 'academic', 'principal')) {
        return { discipline: 'education', titles: ['Head of School', 'Principal', 'Department Head', 'Dean'] };
    }
    if (m('project manager', 'program manager', 'pmo')) {
        return { discipline: 'delivery', titles: ['Head of Delivery', 'Program Director', 'PMO Director', 'Director of Programs'] };
    }

    return { discipline: 'leadership', titles: ['Director', 'Head', 'Manager', 'General Manager'] };
}

function serperResultsToBlock(results: SerperResult[]): string {
    return results.map(r => `- ${r.title}\n  ${r.snippet}\n  URL: ${r.link}`).join('\n');
}

function dedupeAndRank(candidates: Candidate[]): Candidate[] {
    const seen = new Map<string, Candidate>();
    for (const c of candidates) {
        if (!c?.name) continue;
        const key = c.name.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!key) continue;
        const existing = seen.get(key);
        if (!existing || CONFIDENCE_RANK[c.confidence] > CONFIDENCE_RANK[existing.confidence]) {
            seen.set(key, c);
        }
    }
    return [...seen.values()]
        .sort((a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence])
        .slice(0, 3);
}

/**
 * Pass 0 — scan the JD text itself for an inline contact reference.
 * Highest-confidence signal when present (the listing literally says who).
 */
async function scanJdForContact(jdText: string, company: string, role: string): Promise<Candidate | null> {
    if (!jdText || jdText.length < 100) return null;
    const trimmed = jdText.slice(0, 6000);

    const prompt = `You are looking for a SPECIFIC PERSON mentioned in this job description who is identified as the hiring manager, the role's supervisor, the panel chair, the recruiting contact, or the person to contact for the application.

COMPANY: ${company}
ROLE: ${role}

JOB DESCRIPTION:
${trimmed}

Only return a result if the JD names a real person. Do NOT return a result for generic phrases like "the hiring manager" or "our team". The person must be named.

Return JSON:
{
  "name": "Full Name" or null,
  "title": "their stated title or relationship to the role, e.g. 'Head of Marketing', 'reporting manager', 'recruitment contact'" or null,
  "evidence": "the exact sentence from the JD that mentions them" or null
}

If no named person is mentioned, return { "name": null }.
Return ONLY valid JSON.`;

    try {
        const raw = await callLLMWithRetry(prompt, true);
        const parsed = parseLLMJson(raw) as { name?: string | null; title?: string | null };
        if (!parsed?.name || typeof parsed.name !== 'string' || parsed.name.length < 3) return null;
        return {
            name: parsed.name.trim(),
            title: parsed.title?.trim() ?? null,
            confidence: 'high',
            sourceUrl: null,
            location: null,
        };
    } catch (err: any) {
        console.warn('[research] JD scan failed:', err.message);
        return null;
    }
}

/**
 * Pass 1 — find the discipline head on LinkedIn. Usually the actual hiring
 * manager for a given role, not the recruiter that posts it.
 */
async function searchDisciplineHead(company: string, role: string): Promise<Candidate[]> {
    const { titles } = deriveDiscipline(role);
    const titlesClause = titles.map(t => `"${t}"`).join(' OR ');
    const query = `"${company}" (${titlesClause}) site:linkedin.com/in/`;

    const results = await searchSerper(query, 5);
    if (!results.length) return [];

    const prompt = `You are extracting potential hiring managers from LinkedIn search snippets.

COMPANY: ${company}
ROLE BEING HIRED: ${role}
TARGET TITLES we are looking for: ${titles.join(', ')}

SEARCH RESULTS:
${serperResultsToBlock(results)}

Return a JSON array of up to 3 plausible hiring managers. For each:
- name: full name as it appears in the result
- title: their current title at ${company} (or null if unclear)
- sourceUrl: the LinkedIn profile URL from the result
- location: the location shown in the result, verbatim, e.g. "Greater Sydney Area", "Perth, Western Australia" (or null if none is shown)

Exclusion rules:
- Skip people whose snippet clearly shows them at a different company.
- Skip people whose title is junior (analyst, associate, intern, coordinator without "senior").
- Skip recruiters and TA people for THIS pass (we'll find them separately).
- Skip if no name is identifiable.

Return ONLY a JSON array. If no plausible candidates: [].`;

    try {
        const raw = await callLLMWithRetry(prompt, true);
        const parsed = parseLLMJson(raw);
        const arr: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.candidates) ? parsed.candidates : [];
        return arr
            .filter(c => c && typeof c.name === 'string' && c.name.length >= 3)
            .slice(0, 3)
            .map(c => ({
                name: c.name.trim(),
                title: typeof c.title === 'string' ? c.title.trim() : null,
                confidence: 'medium' as Confidence,
                sourceUrl: typeof c.sourceUrl === 'string' ? c.sourceUrl : null,
                location: typeof c.location === 'string' ? c.location.trim() : null,
            }));
    } catch (err: any) {
        console.warn('[research] discipline-head extraction failed:', err.message);
        return [];
    }
}

/**
 * Pass 2 — TA/recruiter fallback. Only runs when Pass 0 + 1 came up empty.
 * Lower confidence because recruiters are usually NOT the right person to
 * address a cover letter to, but better than nothing.
 */
async function searchRecruiter(company: string, role: string): Promise<Candidate[]> {
    const query = `"${company}" ("talent acquisition" OR "recruiter" OR "people partner") site:linkedin.com/in/`;
    const results = await searchSerper(query, 4);
    if (!results.length) return [];

    const prompt = `You are extracting recruiters / talent acquisition contacts from LinkedIn search snippets.

COMPANY: ${company}
ROLE BEING HIRED: ${role}

SEARCH RESULTS:
${serperResultsToBlock(results)}

Return a JSON array of up to 2 plausible recruiters. For each:
- name: full name
- title: their TA/recruiter title at ${company}
- sourceUrl: LinkedIn profile URL from the result
- location: the location shown in the result, verbatim (or null if none is shown)

Skip anyone clearly at a different company.

Return ONLY a JSON array. If no plausible candidates: [].`;

    try {
        const raw = await callLLMWithRetry(prompt, true);
        const parsed = parseLLMJson(raw);
        const arr: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.candidates) ? parsed.candidates : [];
        return arr
            .filter(c => c && typeof c.name === 'string' && c.name.length >= 3)
            .slice(0, 2)
            .map(c => ({
                name: c.name.trim(),
                title: typeof c.title === 'string' ? c.title.trim() : null,
                confidence: 'low' as Confidence,
                sourceUrl: typeof c.sourceUrl === 'string' ? c.sourceUrl : null,
                location: typeof c.location === 'string' ? c.location.trim() : null,
            }));
    } catch (err: any) {
        console.warn('[research] recruiter extraction failed:', err.message);
        return [];
    }
}

function salutationFor(candidate: { name?: string | null } | undefined): string {
    if (!candidate?.name) return 'Dear Hiring Manager,';
    const firstName = candidate.name.split(/\s+/)[0];
    return `Dear ${firstName},`;
}

/**
 * POST /api/research/company
 *
 * Multi-pass hiring-contact discovery + company highlights extraction.
 *
 * Passes (run in order, short-circuit when a high-confidence hit is found):
 *   Pass 0: scan the JD text itself for a named contact (confidence: high)
 *   Pass 1: LinkedIn search for the discipline head, e.g. "Head of Marketing"
 *           for a marketing role (confidence: medium) — usually the actual
 *           hiring manager.
 *   Pass 2: LinkedIn search for TA / recruiters at the company (confidence:
 *           low) — only runs if Passes 0 and 1 are empty.
 *
 * Always runs: a separate search for company highlights (culture / projects /
 * news) used downstream in cover-letter generation.
 *
 * Body: { company: string, role: string, jdText?: string }
 * Returns: {
 *   candidates: Candidate[],          // ranked by confidence, max 3
 *   hiringManager: string | null,      // top candidate name (backward compat)
 *   hiringManagerTitle: string | null, // top candidate title (backward compat)
 *   salutation: string,                // derived from top candidate
 *   highlights: string[],
 *   companySize: string,
 * }
 */
/**
 * Is the paid directory path switched on?
 *
 * Off by default, and deliberately so. This route is authenticated but
 * otherwise reachable, and the directory path spends Hunter credits on every
 * call. While the feature is parked, an accidental caller should cost nothing
 * rather than quietly draining a month's quota. Off does not disable contact
 * discovery: the search fallback still runs, exactly as it did before any of
 * this existed.
 *
 * Set COMPANY_RESEARCH_ENABLED=true to turn it on.
 */
function directoryEnabled(): boolean {
    return (process.env.COMPANY_RESEARCH_ENABLED ?? '').toLowerCase() === 'true';
}

/**
 * The company's own website, or null when nothing looks convincing enough.
 *
 * Returning null is the important half. `pickCompanyDomain` reports WHY it
 * chose a host, and a reason of 'position' means nothing matched the company's
 * name and it simply took the highest search result. That is how AC3 became a
 * procurement marketplace and PeopleConnect became Seek. A directory read off
 * the wrong domain is a directory of strangers, so an unconvincing domain is
 * treated as no domain at all.
 */
async function resolveCompanyDomain(company: string, jdText?: string | null): Promise<string | null> {
    // An acronym searches badly, so ask the companies register what the
    // business is actually called before spending the search on "BHL". The
    // register holds no website, so this only ever improves the search TERM;
    // when it is unavailable or unsure, `name` comes back as the ad's own
    // wording and everything below behaves exactly as it did before.
    const { name: searchName } = await resolveEntityName(company);

    // The ladder itself lives in `employerDomain.ts` and is the same code the
    // corpus harness measures, so a result seen in testing is a result the
    // product produces. It reads Google's knowledge panel first, falls to the
    // organic name match, and only then spends a second search on Maps, where
    // the returned address confirms the state.
    //
    // This replaced a Serper.dev call that had been returning `400 Not enough
    // credits` for every query. The failure was invisible: the client caught
    // it, warned, and returned an empty array, so every employer resolved to
    // "no domain" and the whole feature reported an honest-looking blank.
    const state = stateOf(jdText);

    let found = await resolveEmployerDomain(searchName, state);

    // Score against both names and keep whichever actually matches. A
    // registered name can be a numbered holding company that matches no host,
    // and the ad's name can be the acronym the host is built from, so neither
    // is reliably the better one to judge by.
    if (!found.domain && searchName !== company) {
        found = await resolveEmployerDomain(company, state);
    }

    if (!found.domain) {
        console.warn(`[research] ${company}: no domain (${found.note})`);
        return null;
    }
    if (found.corrected) {
        console.warn(`[research] ${company}: corrected to ${found.domain} (${found.note})`);
    }
    return found.domain;
}

/** Culture/news facts used downstream in the cover letter. Never blocking. */
async function companyHighlights(company: string): Promise<{ highlights: string[]; companySize: string }> {
    const companyResults = await searchSerper(
        `"${company}" culture OR "tech stack" OR "recent project" OR mission OR "company values" 2024 2025`,
        5
    );
    const companyText = snippetsToText(companyResults);
    if (!companyText) return { highlights: [], companySize: 'unknown' };

    const prompt = `Extract a few specific, verifiable facts about this company from the search snippets. Do NOT invent anything.

COMPANY: ${company}

SEARCH RESULTS:
${companyText}

Return JSON:
{
  "companySize": "startup" | "sme" | "enterprise" | "government" | "education" | "nfp" | "unknown",
  "highlights": string[]   // 2 to 4 facts. Each under 20 words.
}

Return ONLY valid JSON.`;

    try {
        const raw = await callLLMWithRetry(prompt, true);
        const parsed = parseLLMJson(raw) as { companySize?: string; highlights?: unknown };
        return {
            highlights: Array.isArray(parsed.highlights)
                ? (parsed.highlights as unknown[]).filter((h): h is string => typeof h === 'string')
                : [],
            companySize: typeof parsed.companySize === 'string' ? parsed.companySize : 'unknown',
        };
    } catch (err: any) {
        console.warn('[research] highlights extraction failed:', err.message);
        return { highlights: [], companySize: 'unknown' };
    }
}

/**
 * One line per contact lookup, in the shape `[fit]` already uses.
 *
 * This route used to log nothing at all about its result, only that it
 * returned 200. So a run that found a person and a run that found nobody were
 * indistinguishable in the logs, and the only way to tell them apart was to ask
 * the candidate what they saw on screen. On 8 Sep 2026 that cost a round trip
 * to work out whether contact discovery was broken or the employer was simply
 * not findable — the answer being visible on the server the whole time.
 *
 * Addresses are NOT logged. Which slots filled and where the answer came from
 * is enough to tell a fault from a miss, and the address belongs to a third
 * party who never asked to be in a log file.
 */
function logLookup(
    company: string,
    source: string,
    domain: string | null,
    slots: Record<string, unknown>,
    startedAt: number,
) {
    const filled = Object.entries(slots)
        .filter(([, v]) => Boolean(v))
        .map(([k]) => k);
    console.log(
        `[company] "${company}" source=${source} domain=${domain ?? 'none'} ` +
        `slots=${filled.length ? filled.join('+') : 'NONE'} ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
    );
}

router.post('/company', authenticate, async (req, res) => {
    const startedAt = Date.now();
    const { company, role, jdText, location } = req.body as {
        company?: string;
        role?: string;
        jdText?: string;
        /** The job's location as the ad gave it. Drives the state gate. */
        location?: string;
    };

    if (!company || company.length < 2) {
        return res.status(400).json({ error: 'company is required' });
    }
    if (company.length > 200 || (role && role.length > 300)) {
        return res.status(400).json({ error: 'company or role value is too long' });
    }
    if (jdText && jdText.length > 20000) {
        return res.status(400).json({ error: 'jdText is too long' });
    }

    try {
        // ── Ask the employer's own directory first ────────────────────────
        //
        // This is the inversion. The search passes below guess at a plausible
        // name and then guess at an address for it; Hunter's directory reports
        // people whose addresses it has actually observed, each one arriving
        // with a department and a title already attached. Where Hunter knows
        // the employer this is strictly better, cheaper and deterministic. It
        // is a first choice rather than a replacement because Hunter's
        // Australian coverage runs out at private hospitals, small not-for-
        // profits and small agencies, and the search passes still reach those.
        //
        // Everything downstream depends on the domain being right, which is why
        // a domain chosen purely on search position is discarded: that is how
        // AC3 resolved to a procurement marketplace and PeopleConnect to Seek,
        // and a directory read off the wrong domain is a directory of strangers.
        //
        // Step 0, and it costs nothing: read the ad.
        //
        // A contact printed in the job ad was chosen BY THE EMPLOYER as the
        // person to ask about this role, which is a stronger claim than
        // anything a directory or a search snippet can make, and the bake-off
        // found one in 30% of ads. This used to run last, as one of three
        // fallback passes, AFTER the domain search and both Hunter calls had
        // already been paid for. Running it first makes the most accurate
        // answer also the cheapest one.
        const fromAd = readJdContact(jdText);
        const adSlot: Pick | null = isSufficient(fromAd)
            ? {
                name: fromAd.personName ?? (fromAd.emailIsGeneric ? `${company} recruitment` : fromAd.email!),
                email: fromAd.email!,
                position: fromAd.personTitle,
                department: null,
                // Printed by the employer, so nothing to verify against and
                // nothing that a verification could improve on.
                verification: 'jd',
                why: [
                    fromAd.emailIsGeneric
                        ? 'The address the job ad gives for applications.'
                        : 'Named in the job ad as the contact for this role.',
                    ...(fromAd.personTitle ? [`The ad describes them as ${fromAd.personTitle}.`] : []),
                ],
            }
            : null;

        // The ad's own domain beats a searched one and costs nothing, so the
        // search only runs when the ad gave us nothing to go on.
        const domain = adSlot
            ? fromAd.domain
            : (fromAd.domain ?? (directoryEnabled() ? await resolveCompanyDomain(company, jdText) : null));

        // With a contact already in hand there is nothing for the directory to
        // add that is worth a credit and a verification.
        //
        // `fetchDirectoryTargeted` asks the free coverage endpoint first and
        // then buys exactly one department, instead of buying `hr` and the
        // role's department blind. Same slots filled, half the credits, and an
        // employer Hunter has never heard of now costs nothing to rule out.
        const directory = (!adSlot && domain && directoryEnabled())
            ? await fetchDirectoryTargeted(domain, role || '')
            : null;
        const directorySlots = adSlot
            ? { talent: fromAd.emailIsGeneric ? adSlot : null, hiring_manager: fromAd.emailIsGeneric ? null : adSlot, team_insider: null } as Slots
            : (directory ? pickFromDirectory(directory, { role: role || '' }) : null);
        const directoryFilled = directorySlots
            ? Object.values(directorySlots).filter(Boolean).length
            : 0;

        if (directorySlots && directoryFilled > 0) {
            // Confirm the mailboxes before we hand them over, skipping any
            // Hunter has already tested. Half a credit each, and it is the
            // difference between "found published online" and "checked".
            const verified = await verifySlots(directorySlots);
            const { highlights, companySize } = await companyHighlights(company);
            const lead = verified.hiring_manager ?? verified.talent ?? verified.team_insider;
            const directoryOut = {
                talent: verified.talent,
                hiringManager: verified.hiring_manager,
                teamInsider: verified.team_insider,
            };
            logLookup(company, 'directory', domain, directoryOut, startedAt);
            return res.json({
                source: 'directory',
                domain,
                slots: directoryOut,
                rejected: [],
                candidates: [verified.hiring_manager, verified.talent, verified.team_insider]
                    .filter(Boolean)
                    .map(p => ({ name: p!.name, title: p!.position, confidence: 'high', sourceUrl: null, location: null })),
                hiringManager: lead?.name ?? null,
                hiringManagerTitle: lead?.position ?? null,
                salutation: salutationFor(lead ? { name: lead.name } : undefined),
                highlights,
                companySize,
            });
        }

        // ── The employer's own contact page ───────────────────────────────
        //
        // Runs only when the directory gave us nothing, and before we spend a
        // search on the passes below. Four of the twenty corpus ads resolved to
        // a correct website that Hunter holds zero addresses for: one-location
        // Australian businesses that no directory has ever indexed. Every one
        // of them publishes an address on their own contact page.
        //
        // It costs nothing. No search vendor, no directory vendor, just a GET
        // of a page the employer wrote to be read. An address here is usually a
        // shared inbox, which is why it sits below the directory and above the
        // searches rather than at the top.
        if (domain) {
            const site = await findSiteContact(domain);
            if (site) {
                const { highlights, companySize } = await companyHighlights(company);
                const slot: Pick = {
                    name: site.generic ? `${company}` : site.email.split('@')[0],
                    email: site.email,
                    position: null,
                    department: null,
                    // Published by the employer on their own site. There is no
                    // status to refresh and nothing a verification would add.
                    verification: 'site',
                    why: [
                        site.generic
                            ? 'The address the company publishes on its own contact page.'
                            : 'Published on the company\'s own contact page.',
                        'No directory holds anyone at this company, so this is the address they chose to publish.',
                    ],
                };
                const siteOut = {
                    talent: site.generic ? slot : null,
                    hiringManager: site.generic ? null : slot,
                    teamInsider: null,
                };
                logLookup(company, 'site', domain, siteOut, startedAt);
                return res.json({
                    source: 'site',
                    domain,
                    slots: siteOut,
                    rejected: [],
                    candidates: [{ name: slot.name, title: null, confidence: 'low', sourceUrl: site.sourceUrl, location: null }],
                    hiringManager: site.generic ? null : slot.name,
                    hiringManagerTitle: null,
                    salutation: salutationFor(site.generic ? undefined : { name: slot.name }),
                    highlights,
                    companySize,
                });
            }
        }

        // ── Passes 0, 1 and 2, all at once ────────────────────────────────
        //
        // These used to run as a fallback chain, where the recruiter search
        // only fired if the first two found nothing. That made the recruiter a
        // consolation prize, when in fact a talent partner is the contact most
        // likely to reply and belongs in the output regardless of whether we
        // also found a manager. Running them together also means one slow pass
        // no longer delays the others, and it costs at most one extra search.
        const [jdCandidate, disciplineHits, recruiterHits] = await Promise.all([
            jdText && jdText.length >= 100
                ? scanJdForContact(jdText, company, role || '')
                : Promise.resolve(null),
            searchDisciplineHead(company, role || ''),
            searchRecruiter(company, role || ''),
        ]);

        const candidates: Candidate[] = [
            ...(jdCandidate ? [jdCandidate] : []),
            ...disciplineHits,
            ...recruiterHits,
        ];

        const rankedCandidates = dedupeAndRank(candidates);

        // ── The gate ──────────────────────────────────────────────────────
        //
        // Everything above is discovery, and discovery has never been the
        // problem: measured over 31 real applications it returned a name every
        // single time. It returned the WRONG name often enough to matter, and
        // the step after this one will happily mint a deliverable address for a
        // wrong person at a catch-all domain, where nothing bounces and nobody
        // finds out. So nothing leaves this route until it has passed
        // contactFilter, and a company with no survivors returns none.
        const target = { company, role: role || '', location: location ?? null };
        const slots = fillSlots(rankedCandidates, target);

        // Why each discarded name was discarded, so a bad drop is debuggable
        // and so the UI can eventually show its work.
        const rejected = rankedCandidates
            .map(c => ({ candidate: c, verdict: filterContact(c, target) }))
            .filter(r => !r.verdict.pass)
            .map(r => ({
                name: r.candidate.name,
                title: r.candidate.title,
                reasons: r.verdict.rejections,
                notes: r.verdict.notes,
            }));

        // The single-contact fields the existing callers read. They now point
        // at a SURVIVOR rather than at the highest-confidence raw hit, which is
        // the entire point: the old `top` is what addressed a graduate
        // application to a Director General in the wrong state.
        const preferred: OutreachRole[] = ['hiring_manager', 'talent', 'team_insider'];
        const top = preferred.map(slot => slots[slot]?.candidate).find(Boolean) ?? undefined;

        const { highlights, companySize } = await companyHighlights(company);

        // The three slots PostApplyOutreach shows. Any of them may be null, and
        // fewer than three is the intended outcome rather than a degraded one:
        // a missing contact beats a confidently wrong one.
        const searchOut = {
            talent: slots.talent
                ? { ...slots.talent.candidate, why: slots.talent.notes }
                : null,
            hiringManager: slots.hiring_manager
                ? { ...slots.hiring_manager.candidate, why: slots.hiring_manager.notes }
                : null,
            teamInsider: slots.team_insider
                ? { ...slots.team_insider.candidate, why: slots.team_insider.notes }
                : null,
        };

        /*
          The last resort, and the difference between a dead end and a send.

          Everything above hunts for a PERSON, and when every pass comes back
          empty this route had nothing to offer at all: the search path's
          candidates carry a name and a title and NO ADDRESS, so a card built
          from them has no send button on it, only three boxes to copy out by
          hand. Meanwhile the employer very often has a staffed inbox sitting on
          the domain we already resolved. Real case, 8 Sep 2026 — Brisbane
          Convention and Exhibition Centre: thirteen addresses at bcec.com.au,
          nobody in HR or marketing so every slot came back empty, and
          `recruit@bcec.com.au` was one call away.

          It returns as its own source rather than being folded into the search
          result, for the same reason `site` does: this is an ADDRESS, and the
          search slots are a different shape that cannot hold one.

          It goes in `talent`, the slot the frontend labels as the
          reach-a-recruiter one, and it is named for what it is rather than
          dressed up as a person. PostApplyOutreach greets a generic address
          with "Dear Hiring Manager" on purpose, and confidenceNote('generic')
          tells the candidate plainly that a shared inbox is certain to be read
          and less likely to be answered personally.

          One search, spent only where the alternative was showing nothing.
        */
        const foundNobody = !searchOut.talent && !searchOut.hiringManager && !searchOut.teamInsider;
        if (foundNobody && domain && directoryEnabled()) {
            const inbox = await fetchSharedInbox(domain);
            if (inbox) {
                const slot: Pick = {
                    name: `${company} enquiries`,
                    email: inbox.email,
                    position: null,
                    department: inbox.department,
                    verification: inbox.verification,
                    why: [
                        'A shared inbox at this employer, not a person.',
                        'Nobody here could be matched to a name, so this is the address most likely to be read.',
                    ],
                };
                const inboxOut = { talent: slot, hiringManager: null, teamInsider: null };
                logLookup(company, 'inbox', domain, inboxOut, startedAt);
                return res.json({
                    source: 'inbox',
                    domain,
                    slots: inboxOut,
                    rejected,
                    candidates: [],
                    hiringManager: null,
                    hiringManagerTitle: null,
                    // Never a name: nobody is called Recruitment.
                    salutation: salutationFor(undefined),
                    highlights,
                    companySize,
                });
            }
        }

        logLookup(company, 'search', domain, searchOut, startedAt);

        return res.json({
            // Reached only when the directory was empty or the domain was not
            // convincing enough to trust. Named so the caller can tell a
            // directory-backed contact from an inferred one.
            source: 'search',
            domain,
            slots: searchOut,
            rejected,
            // Survivors only. `candidates` used to be every raw hit; anything
            // reading it was reading unfiltered discovery output.
            candidates: [slots.hiring_manager, slots.talent, slots.team_insider]
                .filter(Boolean)
                .map(s => s!.candidate),
            hiringManager: top?.name ?? null,
            hiringManagerTitle: top?.title ?? null,
            salutation: salutationFor(top),
            highlights,
            companySize,
        });

    } catch (err: any) {
        console.error('[research] Error:', err.message);
        return res.status(500).json({ error: 'Research failed' });
    }
});

/**
 * POST /api/research/employer-framework
 * For selection criteria: looks up what framework/approach this employer uses.
 *
 * Body: { company: string, role: string, criteriaHeadings: string[] }
 */
router.post('/employer-framework', authenticate, async (req, res) => {
    const { company, role, criteriaHeadings } = req.body as {
        company?: string;
        role?: string;
        criteriaHeadings?: string[];
    };

    if (!company || company.length < 2) {
        return res.status(400).json({ error: 'company is required' });
    }

    try {
        const frameworkResults = await searchSerper(
            `"${company}" selection criteria assessment framework "${role || ''}" APS OR government OR university`,
            4
        );

        const snippets = snippetsToText(frameworkResults);
        if (!snippets) {
            return res.json({ framework: 'general', context: '' });
        }

        const prompt = `
Identify what assessment/selection criteria framework this employer uses based on these search results.

EMPLOYER: ${company}
ROLE: ${role || 'unknown'}
CRITERIA HEADINGS PROVIDED BY CANDIDATE: ${(criteriaHeadings || []).join(', ') || 'none'}

SEARCH RESULTS:
${snippets}

Respond with JSON:
{
  "framework": "aps_ils" | "qld_lc4q" | "nsw_capability" | "vic_vpsc" | "university_academic" | "university_professional" | "general",
  "level": string | null,       // e.g. "APS5", "EL1", "HEW7" if detectable
  "wordCountPerCriterion": number | null,   // target words per criterion if specified
  "keyEmphasis": string[]       // 2-3 things this employer particularly values based on evidence
}

Return ONLY valid JSON.
`;

        const raw = await callLLMWithRetry(prompt, true);
        let parsed: any = { framework: 'general', context: '' };
        try {
            parsed = parseLLMJson(raw);
        } catch {
            console.warn('[research] framework LLM non-JSON:', raw.slice(0, 200));
        }

        return res.json(parsed);

    } catch (err: any) {
        console.error('[research] employer-framework error:', err.message);
        return res.status(500).json({ error: 'Framework research failed' });
    }
});

/**
 * POST /api/research/job-url
 * Scrapes a job listing URL (Seek, LinkedIn, company career page) and extracts
 * the clean job description text using the Serper scraper.
 *
 * Body: { url: string }
 * Returns: { jobDescription: string, title: string | null, company: string | null }
 */
router.post('/job-url', authenticate, async (req, res) => {
    const { url } = req.body as { url?: string };

    if (!url || !url.startsWith('http')) {
        return res.status(400).json({ error: 'A valid URL is required.' });
    }

    // Parse hostname to prevent SSRF via substring bypass (e.g. evil.com/seek.com.au)
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(url);
    } catch {
        return res.status(400).json({ error: 'Invalid URL format.' });
    }
    if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: 'URL must use http or https.' });
    }
    const allowedHostPatterns = [
        /^(www\.)?seek\.com\.au$/,
        /^(www\.)?linkedin\.com$/,
        /^(www\.)?indeed\.com$/,
        /^(www\.)?jora\.com$/,
        /^(www\.)?apsjobs\.gov\.au$/,
        /^[a-z0-9-]+\.lever\.co$/,
        /^[a-z0-9-]+\.greenhouse\.io$/,
        /^[a-z0-9-]+\.workday\.com$/,
        /^[a-z0-9-]+\.smartrecruiters\.com$/,
        /^careers\.[a-z0-9.-]+$/,
        /^jobs\.[a-z0-9.-]+$/,
        /^ats\.[a-z0-9.-]+$/,
    ];
    const isAllowed = allowedHostPatterns.some(p => p.test(parsedUrl.hostname));
    if (!isAllowed) {
        return res.status(400).json({ error: 'URL must be from a job board or career site.' });
    }

    try {
        const rawText = await scrapeUrl(url);

        if (!rawText || rawText.length < 100) {
            return res.status(422).json({ error: 'Could not extract content from this URL. Try copying the job description manually.' });
        }

        // Use LLM to extract clean job description from scraped text
        const prompt = `Extract the job description from this scraped web page text. Return ONLY the relevant job posting content (role overview, responsibilities, requirements, about company). Remove navigation, headers, footers, cookie notices, and any non-job content.

Also extract the job title and company name if visible.

SCRAPED TEXT:
${rawText}

Return JSON:
{
  "jobDescription": "clean job description text",
  "title": "Job Title or null",
  "company": "Company Name or null"
}

Return ONLY valid JSON.`;

        const raw = await callLLMWithRetry(prompt, true);
        let parsed: any = { jobDescription: rawText, title: null, company: null };
        try {
            parsed = parseLLMJson(raw);
        } catch {
            // Fall back to raw text if LLM fails
            parsed.jobDescription = rawText.slice(0, 4000);
        }

        return res.json({
            jobDescription: parsed.jobDescription || rawText.slice(0, 4000),
            title: parsed.title || null,
            company: parsed.company || null,
        });

    } catch (err: any) {
        console.error('[research] job-url error:', err.message);
        return res.status(500).json({ error: 'URL extraction failed. Please paste the job description manually.' });
    }
});

/**
 * POST /api/research/salary
 * Looks up salary range for a role in a given city using Serper web search.
 *
 * Body: { role: string, company?: string, location?: string }
 * Returns: { min, max, currency, source, formatted }
 */
router.post('/salary', authenticate, async (req, res) => {
    const { role, company, location } = req.body as { role?: string; company?: string; location?: string };

    if (!role || role.length < 2) {
        return res.status(400).json({ error: 'role is required' });
    }

    const city = location || 'Australia';

    try {
        const query = `"${role}" salary${company ? ` "${company}"` : ''} ${city} 2024 2025 AUD OR "$"`;
        const results = await searchSerper(query, 6);
        const snippets = snippetsToText(results);

        if (!snippets) {
            return res.json({ min: null, max: null, currency: 'AUD', formatted: 'No salary data found', source: null });
        }

        const prompt = `Extract salary range from these web search results for the role: "${role}" in ${city}.

SEARCH RESULTS:
${snippets}

Return JSON:
{
  "min": number | null,      // lower bound in AUD (no commas, no symbols)
  "max": number | null,      // upper bound in AUD
  "currency": "AUD",
  "period": "annual" | "hourly" | "daily",
  "formatted": string,       // human-readable e.g. "$90,000 – $115,000 per year"
  "context": string,          // 1 sentence: seniority level or conditions this range applies to
  "source": string | null    // website name if identifiable (e.g. "Seek", "Glassdoor")
}

If no reliable salary data found, return { "min": null, "max": null, "formatted": "No salary data found" }.
Return ONLY valid JSON.`;

        const raw = await callLLMWithRetry(prompt, true);
        let parsed: any = { min: null, max: null, formatted: 'No salary data found' };
        try {
            parsed = parseLLMJson(raw);
        } catch {
            console.warn('[research] salary LLM non-JSON:', raw.slice(0, 100));
        }

        return res.json(parsed);

    } catch (err: any) {
        console.error('[research] salary error:', err.message);
        return res.status(500).json({ error: 'Salary lookup failed' });
    }
});

export default router;
