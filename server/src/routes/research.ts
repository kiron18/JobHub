import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { searchSerper, snippetsToText } from '../services/serper';
import { callLLM } from '../services/llm';

const router = Router();

/**
 * POST /api/research/company
 * Runs two Serper searches (hiring manager + company highlights) and uses
 * the LLM to extract structured context for cover letter generation.
 *
 * Body: { company: string, role: string }
 * Returns: { hiringManager, salutation, highlights, companySize }
 */
router.post('/company', authenticate, async (req, res) => {
    const { company, role } = req.body as { company?: string; role?: string };

    if (!company || company.length < 2) {
        return res.status(400).json({ error: 'company is required' });
    }

    try {
        // Search 1 — hiring manager / recruiter contact
        const contactResults = await searchSerper(
            `"${company}" "${role || ''}" hiring manager OR recruiter OR "talent acquisition" site:linkedin.com`,
            4
        );

        // Search 2 — company culture, projects, tech, news
        const companyResults = await searchSerper(
            `"${company}" culture OR "tech stack" OR "recent project" OR mission OR "company values" 2024 2025`,
            5
        );

        const contactText = snippetsToText(contactResults);
        const companyText = snippetsToText(companyResults);

        const hasData = contactText.length > 0 || companyText.length > 0;

        if (!hasData) {
            return res.json({
                hiringManager: null,
                salutation: 'Dear Hiring Manager,',
                highlights: [],
                companySize: 'unknown',
                raw: '',
            });
        }

        const extractionPrompt = `
You are extracting structured company research from web search snippets. Be conservative — only extract what the evidence actually supports. Do NOT invent anything.

COMPANY: ${company}
ROLE BEING APPLIED FOR: ${role || 'unknown'}

CONTACT/HIRING SEARCH RESULTS:
${contactText || '(no results)'}

COMPANY CULTURE/NEWS SEARCH RESULTS:
${companyText || '(no results)'}

Extract the following JSON. If a field cannot be determined from the evidence, use null or an empty array.

{
  "hiringManagerName": string | null,           // Full name if clearly identified as hiring manager or recruiter for this role
  "hiringManagerTitle": string | null,           // Their title e.g. "Head of Marketing", "Talent Acquisition Manager"
  "companySize": "startup" | "sme" | "enterprise" | "government" | "education" | "nfp" | "unknown",
  "highlights": string[],                        // 2-4 specific, verifiable facts: recent projects, tech stack, culture, awards, values — each under 20 words
  "suggestedSalutation": string                  // e.g. "Dear Sarah Chen," or "Dear Hiring Manager," — use full name if found, otherwise generic
}

Return ONLY valid JSON. No preamble.
`;

        const raw = await callLLM(extractionPrompt, true);

        let parsed: any = {};
        try {
            const clean = raw.replace(/```json|```/g, '').trim();
            parsed = JSON.parse(clean);
        } catch {
            console.warn('[research] LLM returned non-JSON:', raw.slice(0, 200));
        }

        return res.json({
            hiringManager: parsed.hiringManagerName ?? null,
            hiringManagerTitle: parsed.hiringManagerTitle ?? null,
            salutation: parsed.suggestedSalutation ?? 'Dear Hiring Manager,',
            highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
            companySize: parsed.companySize ?? 'unknown',
        });

    } catch (err: any) {
        console.error('[research] Error:', err.message);
        return res.status(500).json({ error: 'Research failed', details: err.message });
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

        const raw = await callLLM(prompt, true);
        let parsed: any = { framework: 'general', context: '' };
        try {
            parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
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

        const raw = await callLLM(prompt, true);
        let parsed: any = { min: null, max: null, formatted: 'No salary data found' };
        try {
            parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
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
