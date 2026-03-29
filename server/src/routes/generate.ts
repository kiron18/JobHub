import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { callLLM } from '../services/llm';
import { DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT, DOCUMENT_GENERATION_PROMPT, buildSearchContextBlock } from '../services/prompts';
import { generateBlueprint } from '../services/strategy';
import { buildPerCriterionAchievements } from '../services/generation';
import { reviewDocument } from '../services/quality-gate';
import fs from 'fs';
import path from 'path';

const router = Router();

const MAX_DAILY_GENERATIONS = parseInt(process.env.MAX_DAILY_GENERATIONS || '10', 10);
const QUALITY_GATE_ENABLED = process.env.QUALITY_GATE_ENABLED === 'true';

// Llama pricing (OpenRouter)
const LLAMA_INPUT_COST_PER_M = 0.12;
const LLAMA_OUTPUT_COST_PER_M = 0.30;

async function getRuleBase(type: string) {
    try {
        let fileName = 'resume_rules.md';
        if (type === 'cover-letter') fileName = 'cover_letter_rules.md';
        if (type === 'selection-criteria') fileName = 'selection_criteria_rules.md';

        const filePath = path.join(__dirname, '..', '..', 'rules', fileName);
        return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        console.error(`Failed to read rule base for ${type}:`, e);
        return '';
    }
}

router.post('/:type', authenticate, async (req, res) => {
    const type = req.params.type as string;
    const userId = (req as any).user.id as string;
    const {
        jobDescription,
        selectedAchievementIds,
        analysisContext,
        jobApplicationId,
        companyResearch,      // { salutation, highlights, companySize, hiringManager }
        selectionCriteriaText // raw pasted SC text for selection-criteria tab
    } = req.body;

    if (!jobDescription) {
        return res.status(400).json({ error: 'Job description is required' });
    }

    try {
        // Daily generation limit — protects Claude Stage 1 costs
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayCount = await prisma.document.count({
            where: {
                userId,
                createdAt: { gte: todayStart }
            }
        });
        if (todayCount >= MAX_DAILY_GENERATIONS) {
            return res.status(429).json({
                error: `Daily generation limit reached (${MAX_DAILY_GENERATIONS} documents per day). Try again tomorrow.`
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
        const docType = type === 'selection-criteria' ? 'STAR_RESPONSE' : (type === 'cover-letter' ? 'COVER_LETTER' : 'RESUME');
        const sanitizedJobAppId = jobApplicationId === 'temp-id' ? null : (jobApplicationId || null);

        // ── STAGE 1: Strategic Blueprint (Claude) ──────────────────────────────
        let blueprintResult;
        let stage1Info: { cached: boolean; tokens?: { input: number; output: number; cost_usd: number } } = { cached: false };

        // Build search context block from intake data (empty string if not onboarded)
        const searchContext = buildSearchContextBlock(profile);

        // Only run Stage 1 if we have a real jobApplicationId to cache against
        const cacheKey = sanitizedJobAppId || `${userId}-${Date.now()}`;
        try {
            blueprintResult = await generateBlueprint(
                cacheKey,
                searchContext + jobDescription,
                profile,
                selectedAchievements,
                docType
            );
            stage1Info = { cached: blueprintResult.cached, tokens: blueprintResult.tokens };
            console.log(`[Generation] Stage 1 complete. Cached: ${blueprintResult.cached}`);
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
                perCriterionAchievements
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
                perCriterionAchievements
            );

        console.log(`[Generation] Stage 2: calling Llama for ${type}...`);
        const stage2Raw = await callLLM(prompt, false);
        console.log(`[Generation] Stage 2 complete. ${stage2Raw.length} characters.`);

        // Approximate Llama token counts from character count (rough: 4 chars/token)
        const stage2InputTokens = Math.round(prompt.length / 4);
        const stage2OutputTokens = Math.round(stage2Raw.length / 4);
        const stage2Cost =
            (stage2InputTokens / 1_000_000) * LLAMA_INPUT_COST_PER_M +
            (stage2OutputTokens / 1_000_000) * LLAMA_OUTPUT_COST_PER_M;

        // ── STAGE 3: Quality Gate (Claude — optional) ──────────────────────────
        let finalContent = stage2Raw;
        let stage3Info: { triggered: boolean; tokens?: { input: number; output: number; cost_usd: number } } = { triggered: false };

        if (QUALITY_GATE_ENABLED && blueprintResult) {
            console.log('[Generation] Stage 3: running quality gate...');
            try {
                const review = await reviewDocument(blueprintResult.blueprint, stage2Raw);
                finalContent = review.rewrittenContent;
                stage3Info = { triggered: true, tokens: review.tokens };
                console.log(`[Generation] Stage 3 complete. passed=${review.passed}, flags=${review.flags.length}`);
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

        res.json({ content: finalContent, id: doc.id, costBreakdown, blueprint: blueprintResult?.blueprint ?? null });

    } catch (error) {
        console.error(`Generation Error (${type}):`, error);
        res.status(500).json({ error: `Failed to generate ${type}` });
    }
});

export default router;
