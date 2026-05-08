import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { checkAccess } from '../middleware/accessControl';
import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { callClaude } from '../services/llm';
import { DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT, DOCUMENT_GENERATION_PROMPT, buildSearchContextBlock } from '../services/prompts';
import { generateBlueprint } from '../services/strategy';
import { setCachedBlueprint } from '../services/blueprint-cache';
import { buildPerCriterionAchievements } from '../services/generation';
import { reviewDocument } from '../services/quality-gate';
import fs from 'fs';
import path from 'path';

const router = Router();

const MAX_DAILY_GENERATIONS = parseInt(process.env.MAX_DAILY_GENERATIONS || '10', 10);
const QUALITY_GATE_ENABLED = process.env.QUALITY_GATE_ENABLED !== 'false';

// Llama pricing (OpenRouter)
const LLAMA_INPUT_COST_PER_M = 0.12;
const LLAMA_OUTPUT_COST_PER_M = 0.30;

async function getRuleBase(type: string) {
    try {
        let fileName = 'resume_rules.md';
        if (type === 'cover-letter') fileName = 'cover_letter_rules.md';
        if (type === 'selection-criteria') fileName = 'selection_criteria_rules.md';
        if (type === 'interview-prep') fileName = 'interview_prep_rules.md';
        if (type === 'followup-email') fileName = 'followup_email_rules.md';
        if (type === 'teaching-philosophy') fileName = 'teaching_philosophy_rules.md';
        if (type === 'research-statement') fileName = 'research_statement_rules.md';
        if (type === 'offer-negotiation') fileName = 'offer_negotiation_rules.md';
        if (type === 'linkedin-profile') fileName = 'linkedin_profile_rules.md';
        if (type === 'cold-outreach') fileName = 'cold_outreach_rules.md';
        if (type === 'rejection-response') fileName = 'rejection_response_rules.md';

        const filePath = path.join(__dirname, '..', '..', 'rules', fileName);
        return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        console.error(`Failed to read rule base for ${type}:`, e);
        return '';
    }
}

// POST /generate/extract-criteria — pull clean criteria from messy pasted text
// MUST be defined before /:type to prevent the wildcard from swallowing it
router.post('/extract-criteria', authenticate, async (req: any, res: any) => {
    const { rawText } = req.body;
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 10) {
        return res.status(400).json({ error: 'rawText is required' });
    }

    const prompt = `You are extracting selection criteria from a pasted position description or application document.

The user has pasted the following text. It may contain: job title, organisation name, document headers, section labels like "Required Qualifications" or "Desirable Skills", introductory paragraphs, and the actual criteria.

Your job: extract ONLY the individual criteria statements that a candidate must address in their application. These are the specific bullet points, numbered items, or sentences that describe a required or desirable skill, experience, qualification, or attribute.

STRIP completely:
- Document title (e.g. "Position Description")
- Job title / role name
- Organisation name
- Section category headers (e.g. "Required Qualifications", "Required Experience", "Required Skills", "Desirable Skills", "Essential Criteria", "Desirable Criteria")
- Introductory or instructional text (e.g. "Criteria to be addressed in your application", "Please address the following")
- Any text that is not itself a criterion

KEEP:
- Every individual bullet point or numbered sub-item that states a specific requirement
- The full text of each criterion, including any "OR" conditions
- Desirable criteria (label them as [Desirable] at the end)

Return a JSON array of strings, one string per criterion, in the order they appear.
Return ONLY the JSON array. No preamble. No explanation.

PASTED TEXT:
"""
${rawText.slice(0, 4000)}
"""`;

    try {
        const { content: raw } = await callClaude(prompt, true);
        const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        const criteria: string[] = JSON.parse(cleaned);
        if (!Array.isArray(criteria)) throw new Error('Not an array');
        return res.json({ criteria: criteria.filter(c => typeof c === 'string' && c.trim().length > 5) });
    } catch (err: any) {
        console.error('[extract-criteria]', err.message);
        return res.status(500).json({ error: 'Could not extract criteria' });
    }
});

router.post('/:type', authenticate, async (req, res) => {
    const type = req.params.type as string;
    const userId = (req as any).user.id as string;
    const {
        jobDescription,
        selectedAchievementIds,
        analysisContext,
        jobApplicationId,
        companyResearch,       // { salutation, highlights, companySize, hiringManager }
        selectionCriteriaText, // raw pasted SC text for selection-criteria tab
        employerFramework,     // e.g. 'aps_ils', 'qld_lc4q', 'university_academic'
    } = req.body;

    if (!jobDescription) {
        return res.status(400).json({ error: 'Job description is required' });
    }

    try {
        const userEmail = ((req as any).user?.email ?? '').toLowerCase();
        const access = await checkAccess(userId, 'generation', userEmail);
        if (!access.allowed) {
            return res.status(402).json({
                error: 'Generation limit reached',
                upgradeRequired: true,
                remaining: 0,
            });
        }

        const profile = await prisma.candidateProfile.findUnique({
            where: { userId },
            include: {
                achievements: true,
                experience: true,
                education: true,
                volunteering: true,
                certifications: true,
                languages: true
            }
        });

        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const { buildAchievementContext } = await import('../services/generation');
        const selectedAchievements = await buildAchievementContext(
            userId,
            jobDescription,
            selectedAchievementIds
        );

        const ruleBase = await getRuleBase(type);
        const docType = type === 'selection-criteria' || type === 'interview-prep' || type === 'followup-email' || type === 'teaching-philosophy' || type === 'research-statement' || type === 'offer-negotiation' || type === 'linkedin-profile' || type === 'cold-outreach' || type === 'rejection-response' ? 'STAR_RESPONSE' : (type === 'cover-letter' ? 'COVER_LETTER' : 'RESUME');
        const sanitizedJobAppId = jobApplicationId === 'temp-id' ? null : (jobApplicationId || null);

        // ── STAGE 1: Strategic Blueprint (Claude) ──────────────────────────────
        let blueprintResult;
        let stage1Info: { cached: boolean; tokens?: { input: number; output: number; cost_usd: number } } = { cached: false };

        // Build search context block from intake data (empty string if not onboarded)
        const searchContext = buildSearchContextBlock(profile);

        // ── DB blueprint cache (L2) — pre-populate in-memory cache before Stage 1 ──
        if (sanitizedJobAppId) {
            const jobApp = await prisma.jobApplication.findUnique({
                where: { id: sanitizedJobAppId },
                select: { blueprintJson: true }
            });
            if (jobApp?.blueprintJson) {
                setCachedBlueprint(sanitizedJobAppId, jobApp.blueprintJson as any);
                console.log(`[Generation] DB blueprint cache hit for ${sanitizedJobAppId}`);
            }
        }

        // Resolve identity card for this application's matched identity
        const matchedCardLabel: string | null = analysisContext?.matchedIdentityCard ?? null;
        let resolvedIdentityCard: any = null;
        if (matchedCardLabel && Array.isArray((profile as any)?.identityCards)) {
            resolvedIdentityCard = (profile as any).identityCards.find(
                (c: any) => c.label === matchedCardLabel
            ) ?? null;
        }

        // Only run Stage 1 if we have a real jobApplicationId to cache against
        const cacheKey = sanitizedJobAppId || `${userId}-${Date.now()}`;
        try {
            blueprintResult = await generateBlueprint(
                cacheKey,
                searchContext + jobDescription,
                profile,
                selectedAchievements,
                docType,
                resolvedIdentityCard
            );
            stage1Info = { cached: blueprintResult.cached, tokens: blueprintResult.tokens };
            console.log(`[Generation] Stage 1 complete. Cached: ${blueprintResult.cached}`);

            // Persist fresh blueprint to DB so it survives server restarts
            if (!blueprintResult.cached && sanitizedJobAppId) {
                prisma.jobApplication.update({
                    where: { id: sanitizedJobAppId },
                    data: { blueprintJson: blueprintResult.blueprint as any }
                }).catch(err => console.error('[Generation] Failed to persist blueprint to DB:', err));
            }
        } catch (blueprintError: any) {
            console.error('[Generation] Stage 1 failed — falling back to standard prompt:', blueprintError.message);
            blueprintResult = null;
        }

        // ── STAGE 2: Document Execution (Llama) ────────────────────────────────
        // If Serper company research was provided, override the blueprint's
        // employerInsight so the cover letter uses real data, not a MISSING flag.
        if (blueprintResult && companyResearch?.highlights?.length > 0) {
            blueprintResult.blueprint.employerInsight =
                companyResearch.highlights.join(' — ');
        }

        // For SC generation: run per-criterion Pinecone retrieval so the prompt
        // gets targeted evidence for each criterion, not just a global top-N.
        let perCriterionAchievements = null;
        if (docType === 'STAR_RESPONSE' && selectionCriteriaText?.trim()) {
            try {
                perCriterionAchievements = await buildPerCriterionAchievements(userId, selectionCriteriaText);
                console.log(`[Generation] Per-criterion retrieval: ${perCriterionAchievements.length} criteria mapped`);
            } catch (pcErr: any) {
                console.warn('[Generation] Per-criterion retrieval failed, using global achievements:', pcErr.message);
            }
        }

        const prompt = blueprintResult
            ? DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT(
                docType,
                jobDescription,
                profile,
                selectedAchievements,
                ruleBase,
                blueprintResult.blueprint,
                analysisContext,
                companyResearch,
                selectionCriteriaText,
                perCriterionAchievements,
                employerFramework,
                type
            )
            : DOCUMENT_GENERATION_PROMPT(
                docType,
                jobDescription,
                profile,
                selectedAchievements,
                ruleBase,
                analysisContext,
                companyResearch,
                selectionCriteriaText,
                perCriterionAchievements,
                employerFramework,
                type
            );

        console.log(`[Generation] Stage 2: calling Llama for ${type}...`);
        const stage2Raw = await callLLMWithRetry(prompt, false);
        console.log(`[Generation] Stage 2 complete. ${stage2Raw.length} characters.`);

        // Approximate Llama token counts from character count (rough: 4 chars/token)
        const stage2InputTokens = Math.round(prompt.length / 4);
        const stage2OutputTokens = Math.round(stage2Raw.length / 4);
        const stage2Cost =
            (stage2InputTokens / 1_000_000) * LLAMA_INPUT_COST_PER_M +
            (stage2OutputTokens / 1_000_000) * LLAMA_OUTPUT_COST_PER_M;

        // ── STAGE 3: Quality Gate (Claude — optional) ──────────────────────────
        let finalContent = stage2Raw;
        let profileViolations: string[] = [];
        let stage3Info: { triggered: boolean; tokens?: { input: number; output: number; cost_usd: number } } = { triggered: false };

        if (QUALITY_GATE_ENABLED && blueprintResult && type !== 'interview-prep') {
            console.log('[Generation] Stage 3: running quality gate...');
            try {
                const review = await reviewDocument(blueprintResult.blueprint, stage2Raw, docType, profile);
                finalContent = review.rewrittenContent;
                profileViolations = review.profileViolations;
                stage3Info = { triggered: true, tokens: review.tokens };
                if (review.profileViolations.length > 0) {
                    console.warn(`[Generation] Stage 3 profile violations (${review.profileViolations.length}):`, review.profileViolations);
                }
                console.log(`[Generation] Stage 3 complete. passed=${review.passed}, flags=${review.flags.length}, profileViolations=${review.profileViolations.length}`);
            } catch (gateError: any) {
                console.error('[Generation] Stage 3 failed — using Stage 2 output unchanged:', gateError.message);
            }
        }

        // Strip em dashes — LLMs frequently emit U+2014; replace with a plain
        // spaced dash so downstream renderers and PDF exports stay consistent.
        finalContent = finalContent.split('\u2014').join(' - ');

        // ── Persist document ────────────────────────────────────────────────────
        const doc = await prisma.document.create({
            data: {
                title: `${type.toUpperCase()} - ${profile.name || 'Draft'}`,
                content: finalContent,
                type: docType,
                userId,
                jobApplicationId: sanitizedJobAppId
            }
        });

        // ── Cost breakdown (logged + returned for transparency) ─────────────────
        const total_cost_usd =
            (stage1Info.tokens?.cost_usd ?? 0) +
            stage2Cost +
            (stage3Info.tokens?.cost_usd ?? 0);

        const costBreakdown = {
            stage1_cached: stage1Info.cached,
            stage1_tokens: stage1Info.tokens,
            stage2_tokens: { input: stage2InputTokens, output: stage2OutputTokens, cost_usd: stage2Cost },
            stage3_triggered: stage3Info.triggered,
            stage3_tokens: stage3Info.tokens,
            total_cost_usd
        };
        console.log('[Generation] Cost breakdown:', JSON.stringify(costBreakdown));

        res.json({ content: finalContent, id: doc.id, costBreakdown, blueprint: blueprintResult?.blueprint ?? null, profileViolations });

    } catch (error) {
        console.error(`Generation Error (${type}):`, error);
        res.status(500).json({ error: `Failed to generate ${type}` });
    }
});

export default router;
