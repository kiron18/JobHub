/**
 * /api/analyze — document quality-assurance tools
 *
 * POST /ats-coverage              Keyword coverage check against JD
 * POST /resume-score              5-dimension quality score for a resume
 * POST /cover-letter-personalisation  Personalisation score for a cover letter
 * POST /tone-rewrite              Rewrite text in a requested tone
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { analyzeRateLimit } from '../middleware/analyzeRateLimit';
import { callLLM } from '../services/llm';
import { parseLLMJson } from '../utils/parseLLMResponse';

const router = Router();
router.use(authenticate, analyzeRateLimit);

router.post('/ats-coverage', async (req: any, res: any) => {
    try {
        const { document, jobDescription, docType } = req.body;
        if (!document || !jobDescription) {
            return res.status(400).json({ error: 'document and jobDescription are required.' });
        }

        const prompt = `You are an ATS keyword expert for Australian employers.

DOCUMENT TYPE: ${docType || 'resume'}

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

SUBMITTED DOCUMENT:
${document.slice(0, 4000)}

Identify the most important ATS keywords from the JD and check whether they appear (verbatim or semantically equivalent) in the document.

Focus on: job title variants, required technical skills/tools, certifications, key action verbs, industry terminology, explicitly called-out soft skills.
Exclude: company name, salary details, location, generic filler words.

Return JSON:
{
  "score": <integer 0-100 representing % of key terms covered>,
  "matched": [<terms found in document — max 12>],
  "missing": [<important terms NOT found — max 10, prioritised by importance>],
  "quickFixes": [<2-3 specific sentence-level suggestions to add missing terms naturally>]
}

Return ONLY valid JSON.`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        return res.json({
            score: typeof result.score === 'number' ? Math.min(100, Math.max(0, result.score)) : 50,
            matched: Array.isArray(result.matched) ? result.matched.slice(0, 12) : [],
            missing: Array.isArray(result.missing) ? result.missing.slice(0, 10) : [],
            quickFixes: Array.isArray(result.quickFixes) ? result.quickFixes.slice(0, 3) : [],
        });

    } catch (err: any) {
        console.error('[ATS Coverage] Error:', err.message);
        res.status(500).json({ error: 'Failed to analyse ATS coverage.' });
    }
});

router.post('/resume-score', async (req: any, res: any) => {
    try {
        const { document, jobDescription } = req.body;
        if (!document) {
            return res.status(400).json({ error: 'document is required.' });
        }

        const prompt = `You are an expert Australian resume coach and ATS specialist.

RESUME:
${document.slice(0, 5000)}

${jobDescription ? `JOB DESCRIPTION:\n${jobDescription.slice(0, 2000)}` : ''}

Score this resume across 5 dimensions (0-20 points each, total out of 100):

1. Impact & Metrics — Do achievements use quantified outcomes?
2. Relevance — ${jobDescription ? 'How well does content align with the JD?' : 'Does content reflect a focused professional narrative?'}
3. ATS Compatibility — Are keywords naturally embedded? No ATS traps (tables, graphic headers)?
4. Clarity & Brevity — Concise and direct? No clichés or filler?
5. Structure & Completeness — All expected sections present? Clear hierarchy?

Return JSON:
{
  "total": <integer 0-100>,
  "dimensions": [
    { "name": "Impact & Metrics",        "score": <0-20>, "feedback": "<one specific observation>" },
    { "name": "Relevance",               "score": <0-20>, "feedback": "<one specific observation>" },
    { "name": "ATS Compatibility",       "score": <0-20>, "feedback": "<one specific observation>" },
    { "name": "Clarity & Brevity",       "score": <0-20>, "feedback": "<one specific observation>" },
    { "name": "Structure & Completeness","score": <0-20>, "feedback": "<one specific observation>" }
  ],
  "topFix": "<The single most important thing to fix — be specific>"
}

Return ONLY valid JSON.`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        return res.json({
            total: typeof result.total === 'number' ? Math.min(100, Math.max(0, result.total)) : 60,
            dimensions: Array.isArray(result.dimensions) ? result.dimensions.slice(0, 5) : [],
            topFix: result.topFix || '',
        });

    } catch (err: any) {
        console.error('[Resume Score] Error:', err.message);
        res.status(500).json({ error: 'Failed to score resume.' });
    }
});

router.post('/cover-letter-personalisation', async (req: any, res: any) => {
    try {
        const { document, jobDescription, company } = req.body;
        if (!document || !jobDescription) {
            return res.status(400).json({ error: 'document and jobDescription are required.' });
        }

        const prompt = `You are an expert Australian hiring consultant. Evaluate how well this cover letter is personalised to the specific company and role.

COMPANY: ${company || 'Unknown'}
JOB DESCRIPTION:
${jobDescription.slice(0, 2000)}

COVER LETTER:
${document.slice(0, 3000)}

Evaluate personalisation across 4 dimensions (0-25 each):

1. Company Specificity — Mentions company by name, references their products/values/culture? Generic = 0.
2. Role Alignment — Mirrors the job's specific language, skills, responsibilities? Generic "great fit" = 0.
3. Narrative Hook — Opening feels written for this employer, not boilerplate?
4. Value Proposition — Candidate's unique value tied to what THIS role needs?

Return JSON:
{
  "score": <integer 0-100>,
  "dimensions": [
    { "name": "Company Specificity", "score": <0-25>, "note": "<one specific observation>" },
    { "name": "Role Alignment",      "score": <0-25>, "note": "<one specific observation>" },
    { "name": "Narrative Hook",      "score": <0-25>, "note": "<one specific observation>" },
    { "name": "Value Proposition",   "score": <0-25>, "note": "<one specific observation>" }
  ],
  "topFix": "<The single most important personalisation change — be specific>"
}

Return ONLY valid JSON.`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        return res.json({
            score: typeof result.score === 'number' ? Math.min(100, Math.max(0, result.score)) : 50,
            dimensions: Array.isArray(result.dimensions) ? result.dimensions.slice(0, 4) : [],
            topFix: result.topFix || '',
        });

    } catch (err: any) {
        console.error('[Cover Letter Personalisation] Error:', err.message);
        res.status(500).json({ error: 'Failed to analyse personalisation.' });
    }
});

router.post('/tone-rewrite', async (req: any, res: any) => {
    try {
        const { text, tone, context } = req.body;
        if (!text || !tone) {
            return res.status(400).json({ error: 'text and tone are required.' });
        }

        const toneDescriptions: Record<string, string> = {
            confident: 'authoritative and self-assured, using strong active verbs, avoiding hedging language like "helped" or "assisted"',
            concise: 'tight and direct — cut every unnecessary word, no filler phrases, max impact per word',
            formal: 'professional Australian business register, suitable for government or corporate roles',
            warm: 'approachable and personable while remaining professional, slight conversational tone',
            technical: 'precise technical language appropriate for a specialist or engineering audience',
        };

        const toneDesc = toneDescriptions[tone] || tone;

        const prompt = `You are an expert Australian professional copywriter.

CONTEXT: ${context || 'Professional job application document'}
REQUESTED TONE: ${toneDesc}

ORIGINAL TEXT:
${text}

Rewrite in the requested tone. Keep all factual content, achievements, and claims intact — only change voice, word choice, and sentence structure.

Return JSON:
{
  "rewritten": "<rewritten text>",
  "changes": "<one sentence describing the key changes made>"
}

Return ONLY valid JSON.`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        return res.json({
            rewritten: result.rewritten || text,
            changes: result.changes || '',
        });

    } catch (err: any) {
        console.error('[Tone Rewrite] Error:', err.message);
        res.status(500).json({ error: 'Failed to rewrite tone.' });
    }
});

export default router;
