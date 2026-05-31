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
import { tagAIRewrites } from '../lib/provenanceTagging';
import { enforceFirstPersonSummary, scrubAITells, enforceFirstPersonCoverLetter, scrubBannedPhrases } from '../lib/voiceEnforcer';
import { computeYearsOfExperience } from '../lib/profileMath';
import { checkAtsKeywords } from '../lib/atsKeywords';
import { collectSignals } from '../lib/qualitySignals';
import { parseJD } from '../lib/jdParser';
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

router.post('/:type', authenticate, async (req, res, next) => {
    const type = req.params.type as string;
    // The dedicated /resume-structured and /cover-letter-structured routes are
    // registered AFTER this wildcard, so Express matches them here first. Without
    // this passthrough they get treated as an unknown type and default to RESUME —
    // which is why cover letters were rendering as resumes. Hand them off.
    if (type === 'resume-structured' || type === 'cover-letter-structured') return next();
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

        // ── JD parser — detect Seek-style employer questions ─────────────────
        const parsedJD = parseJD(jobDescription);

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
                type,
                parsedJD.employerQuestions.length > 0 ? parsedJD.employerQuestions : undefined
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
                type,
                parsedJD.employerQuestions.length > 0 ? parsedJD.employerQuestions : undefined
            );

        // ── STRUCTURED RESUME PATH ────────────────────────────────────────────
        // For the resume tab only: LLM outputs structured JSON (summary + bullet
        // texts) which is validated with Zod, merged into ResumeData via applyPolish,
        // then rendered to deterministic markdown via profileToMarkdown.
        // This eliminates LLM formatting drift (glued headings, inconsistent spacing).
        let stage2Raw: string;
        let stage2InputTokens: number;
        let stage2OutputTokens: number;
        let stage2Cost: number;

        if (type === 'resume') {
            const { RESUME_STRUCTURED_PROMPT } = await import('../services/prompts/resumeStructuredPrompt');

            // RESUME_STRUCTURED_PROMPT signature: (jd, profile, achievements, blueprint, analysisContext?, companyResearch?, employerQuestions?)
            const structuredPrompt = RESUME_STRUCTURED_PROMPT(
                jobDescription,
                profile,
                selectedAchievements,
                blueprintResult ? blueprintResult.blueprint : {
                    positioningStatement: '',
                    proofPoints: [],
                    messagingAngles: [],
                    pitfallFlags: [],
                    toneBlueprint: '',
                    structureNotes: '',
                    employerInsight: '',
                    sector: 'GENERAL',
                    openingHook: '',
                },
                analysisContext,
                companyResearch,
                parsedJD.employerQuestions.length > 0 ? parsedJD.employerQuestions : undefined
            );

            console.log(`[Generation] Stage 2: calling Llama for resume (structured JSON path)...`);
            const rawJson = await callLLMWithRetry(structuredPrompt, false);
            console.log(`[Generation] Stage 2 complete (structured). Raw length: ${rawJson.length} chars.`);

            // Parse JSON from LLM response (handle stray markdown fences)
            const { PolishPayloadSchema } = await import('../lib/validatePolish');
            const { buildTemplateResume } = await import('../lib/buildTemplateResume');

            // Strip markdown code fences and any text before/after the JSON object
            let cleaned = rawJson.trim();
            // Remove ```json or ``` fences (with optional newlines)
            cleaned = cleaned.replace(/```json?\s*/gi, '').replace(/```\s*/g, '');
            // If JSON.parse still fails, try extracting the first {…} block
            cleaned = cleaned.trim();
            let polish: any = null;
            let parseSucceeded = false;
            try {
                polish = PolishPayloadSchema.parse(JSON.parse(cleaned));
                parseSucceeded = true;
                console.log(`[Generation] Structured resume JSON parsed: summary=${polish.summary ? 'yes' : 'no'}, experience=${polish.experience?.length || 0} entries`);
            } catch (parseErr: any) {
                console.warn('[Generation] Structured resume JSON parse failed:', parseErr.message);
                // Try harder: extract first {…} block from the text
                const braceMatch = cleaned.match(/\{[\s\S]*\}/);
                if (braceMatch) {
                    try {
                        polish = PolishPayloadSchema.parse(JSON.parse(braceMatch[0]));
                        parseSucceeded = true;
                        console.log('[Generation] JSON recovered via brace extraction.');
                    } catch (retryErr: any) {
                        console.warn('[Generation] Brace extraction also failed:', retryErr.message);
                    }
                }
            }

            if (parseSucceeded) {
                stage2Raw = buildTemplateResume(profile, polish, {
                    candidateName: profile.name,
                    yearsOfExperience: computeYearsOfExperience(profile.experience),
                    achievementSources: selectedAchievements.map((a: any) => a?.description ?? ''),
                });
                console.log(`[Generation] Structured resume rendered via buildTemplateResume. ${stage2Raw.length} characters.`);

                stage2InputTokens = 0;
                stage2OutputTokens = 0;
                stage2Cost = 0;
            } else {
                // Fallback: use freeform markdown prompt
                console.log('[Generation] Structured JSON parse failed — falling back to freeform markdown...');
                const fallbackPrompt = blueprintResult
                    ? DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT(
                        docType, jobDescription, profile, selectedAchievements, ruleBase,
                        blueprintResult.blueprint, analysisContext, companyResearch,
                        selectionCriteriaText, perCriterionAchievements, employerFramework, type,
                        parsedJD.employerQuestions.length > 0 ? parsedJD.employerQuestions : undefined
                    )
                    : DOCUMENT_GENERATION_PROMPT(
                        docType, jobDescription, profile, selectedAchievements, ruleBase,
                        analysisContext, companyResearch, selectionCriteriaText,
                        perCriterionAchievements, employerFramework, type,
                        parsedJD.employerQuestions.length > 0 ? parsedJD.employerQuestions : undefined
                    );
                stage2Raw = await callLLMWithRetry(fallbackPrompt, false);
                console.log(`[Generation] Fallback freeform complete. ${stage2Raw.length} characters.`);
                stage2InputTokens = Math.round(fallbackPrompt.length / 4);
                stage2OutputTokens = Math.round(stage2Raw.length / 4);
                stage2Cost =
                    (stage2InputTokens / 1_000_000) * LLAMA_INPUT_COST_PER_M +
                    (stage2OutputTokens / 1_000_000) * LLAMA_OUTPUT_COST_PER_M;
            }
        } else {
            console.log(`[Generation] Stage 2: calling Llama for ${type}...`);
            stage2Raw = await callLLMWithRetry(prompt, false);
            console.log(`[Generation] Stage 2 complete. ${stage2Raw.length} characters.`);

            stage2InputTokens = Math.round(prompt.length / 4);
            stage2OutputTokens = Math.round(stage2Raw.length / 4);
            stage2Cost =
                (stage2InputTokens / 1_000_000) * LLAMA_INPUT_COST_PER_M +
                (stage2OutputTokens / 1_000_000) * LLAMA_OUTPUT_COST_PER_M;
        }

        // ── STAGE 3: Quality Gate (Claude — optional) ──────────────────────────
        // Track whether we used the structured resume path — skip quality gate,
        // voice enforcement, and scrubbers for template-rendered output since
        // profileToMarkdown already produces clean deterministic markdown.
        const isStructuredResume = type === 'resume' && stage2Cost === 0;

        let finalContent = stage2Raw;
        let profileViolations: string[] = [];
        let stage3Info: { triggered: boolean; tokens?: { input: number; output: number; cost_usd: number } } = { triggered: false };

        if (QUALITY_GATE_ENABLED && blueprintResult && type !== 'interview-prep' && !isStructuredResume) {
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

        if (!isStructuredResume) {
        // Strip em dashes — LLMs frequently emit U+2014; replace with a plain
        // spaced dash so downstream renderers and PDF exports stay consistent.
        finalContent = finalContent.split('\u2014').join(' - ');
        }

        if (!isStructuredResume) {
            // Deterministic first-person enforcement on the resume Professional
            // Summary. The LLM and quality gate are advisory; this regex pass is
            // the only layer that cannot fail silently. Catches "{Name} brings",
            // "His track record", "He has...", and corrects years-of-experience
            // when the LLM picked the wrong number.
            if (docType === 'RESUME') {
                finalContent = enforceFirstPersonSummary(finalContent, {
                    candidateName: profile?.name,
                    yearsOfExperience: computeYearsOfExperience(profile?.experience),
                });
            }

            // ── Cover letter voice + first-person enforcement ────────────────────
            // AI-tell scrubber runs on all doc types. Cover letter additionally gets
            // first-person enforcement across the full body (between salutation and
            // sign-off). STAR responses get the AI-tell scrubber only.
            if (docType === 'COVER_LETTER' || docType === 'RESUME') {
                const { scrubbed, removed } = scrubAITells(finalContent);
                finalContent = scrubbed;
                if (removed.length > 0) {
                    console.log(`[Generation] AI-tell scrubber: ${removed.length} phrase(s) removed from ${docType}`);
                }
            }
            if (docType === 'COVER_LETTER') {
                finalContent = enforceFirstPersonCoverLetter(finalContent, {
                    candidateName: profile?.name,
                });
            }
            if (docType === 'STAR_RESPONSE') {
                const { scrubbed, removed } = scrubAITells(finalContent);
                finalContent = scrubbed;
                if (removed.length > 0) {
                    console.log(`[Generation] AI-tell scrubber: ${removed.length} phrase(s) removed from STAR_RESPONSE`);
                }
            }

            // ── Banned-phrases scrubber (resumes only) ──────────────────────────
            if (docType === 'RESUME') {
                const banned = scrubBannedPhrases(finalContent);
                finalContent = banned.scrubbed;
                if (banned.flagged.length > 0) {
                    console.log(`[Generation] Banned-phrases scrubber: ${banned.flagged.length} item(s) flagged`);
                }
            }
        }

        // \u2500\u2500 Provenance tagging (resumes only) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        // Mark bullets that diverge significantly from the user's source
        // achievements with `[AI] ` so the editor can render an "review before
        // sending" badge. Exporters strip the token before output.
        if (!isStructuredResume && docType === 'RESUME' && selectedAchievements.length > 0) {
            const sources = selectedAchievements
                .map((a: any) => a?.description ?? '')
                .filter((s: string) => s && s.length > 0);
            finalContent = tagAIRewrites(finalContent, sources);
        }

        // ── ATS keyword coverage check ─────────────────────────────────────────
        let atsResult: any = null;
        if (docType === 'RESUME' || docType === 'COVER_LETTER') {
            try {
                atsResult = checkAtsKeywords({
                    jobDescription,
                    generatedDocument: finalContent,
                    docType,
                });
                console.log(`[ATS] Coverage: ${Math.round(atsResult.coverage * 100)}%, missing: ${atsResult.missingFromOutput.length} keywords`);
                if (atsResult.warnings.length > 0) {
                    console.warn(`[ATS] Warnings:`, atsResult.warnings);
                }
            } catch (err) {
                console.error('[ATS] Check failed:', err);
            }
        }

// ── Quality signals ──────────────────────────────────────────────────────
        const qualitySignals = collectSignals({
            qualityGateOutcome: stage3Info.triggered
                ? { passed: profileViolations.length === 0, flags: profileViolations }
                : null,
            blueprintFallback: blueprintResult === null,
            atsCoverage: atsResult ? {
                coverage: atsResult.coverage,
                missingFromOutput: atsResult.missingFromOutput,
                criticalMissing: atsResult.warnings.filter((w: string) => w.startsWith('CRITICAL')).map((w: string) => w.replace(/^CRITICAL:\s*/, '')),
            } : null,
        });

        if (parsedJD.warning) {
            qualitySignals.push({
                severity: 'info',
                category: 'employer_questions',
                message: parsedJD.warning,
            });
        }
        if (qualitySignals.length > 0) {
            console.log('[Generation] Quality signals:', qualitySignals.map((s: any) => `[${s.severity}] ${s.category}: ${s.message}`));
        }



        // ── Persist document ────────────────────────────────────────────────────
        const doc = await prisma.document.create({
            data: {
                title: `${type.toUpperCase()} - ${profile.name || 'Draft'}`,
                content: finalContent,
                type: docType,
                userId,
                jobApplicationId: sanitizedJobAppId,
                qualitySignals: qualitySignals.length > 0 ? qualitySignals : undefined,
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

        res.json({ content: finalContent, id: doc.id, costBreakdown, blueprint: blueprintResult?.blueprint ?? null, profileViolations, atsResult, qualitySignals });

    } catch (error) {
        console.error(`Generation Error (${type}):`, error);
        res.status(500).json({ error: `Failed to generate ${type}` });
    }
});

// ── Structured resume generation ────────────────────────────────────────────
// This route generates a resume as structured JSON (summary + experience bullets)
// which is then validated with Zod and rendered to deterministic markdown server-side.
// Benefits: higher bullet quality (LLM focuses on content), machine-validated output,
// no LLM formatting drift.
router.post('/resume-structured', authenticate, async (req: any, res: any) => {
    const userId = (req as any).user.id as string;
    const {
        jobDescription,
        selectedAchievementIds,
        analysisContext,
        jobApplicationId,
        companyResearch,  // { salutation, highlights, companySize, hiringManager }
        bridgedGaps: bridgedGapsRaw,
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
                languages: true,
            },
        });

        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const { normalizeBridgedGaps } = await import('../lib/bridgedGaps');
        const bridgedGaps = normalizeBridgedGaps(bridgedGapsRaw);

        const { buildAchievementContext } = await import('../services/generation');
        const selectedAchievements = await buildAchievementContext(
            userId,
            jobDescription,
            selectedAchievementIds
        );

        const sanitizedJobAppId = jobApplicationId === 'temp-id' ? null : (jobApplicationId || null);
        const docType = 'RESUME';

        // ── STAGE 1: Strategic Blueprint (Claude) ──────────────────────────
        let blueprintResult;
        let stage1Info: { cached: boolean; tokens?: { input: number; output: number; cost_usd: number } } = { cached: false };

        const { buildSearchContextBlock } = await import('../services/prompts');
        const searchContext = buildSearchContextBlock(profile);

        // Pre-populate DB blueprint cache
        if (sanitizedJobAppId) {
            const jobApp = await prisma.jobApplication.findUnique({
                where: { id: sanitizedJobAppId },
                select: { blueprintJson: true },
            });
            if (jobApp?.blueprintJson) {
                setCachedBlueprint(sanitizedJobAppId, jobApp.blueprintJson as any);
                console.log(`[ResumeStructured] DB blueprint cache hit for ${sanitizedJobAppId}`);
            }
        }

        const matchedCardLabel: string | null = analysisContext?.matchedIdentityCard ?? null;
        let resolvedIdentityCard: any = null;
        if (matchedCardLabel && Array.isArray((profile as any)?.identityCards)) {
            resolvedIdentityCard = (profile as any).identityCards.find(
                (c: any) => c.label === matchedCardLabel
            ) ?? null;
        }

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
            console.log(`[ResumeStructured] Stage 1 complete. Cached: ${blueprintResult.cached}`);

            if (!blueprintResult.cached && sanitizedJobAppId) {
                prisma.jobApplication.update({
                    where: { id: sanitizedJobAppId },
                    data: { blueprintJson: blueprintResult.blueprint as any },
                }).catch(err => console.error('[ResumeStructured] Failed to persist blueprint to DB:', err));
            }
        } catch (blueprintError: any) {
            console.error('[ResumeStructured] Stage 1 failed — aborting:', blueprintError.message);
            return res.status(500).json({ error: 'Strategy generation failed' });
        }

        // ── STAGE 2: Structured JSON generation (Llama) ────────────────────
        // Load the structured prompt dynamically so it can be imported alongside
        // the existing prompts without breaking the index re-export.
        const { RESUME_STRUCTURED_PROMPT } = await import('../services/prompts/resumeStructuredPrompt');

        // Override employerInsight if company research was provided
        if (companyResearch?.highlights?.length > 0) {
            blueprintResult.blueprint.employerInsight =
                companyResearch.highlights.join(' — ');
        }

        const { parseJD } = await import('../lib/jdParser');
        const parsedJD = parseJD(jobDescription);

        const prompt = RESUME_STRUCTURED_PROMPT(
            jobDescription,
            profile,
            selectedAchievements,
            blueprintResult.blueprint,
            analysisContext,
            companyResearch,
            parsedJD.employerQuestions.length > 0 ? parsedJD.employerQuestions : undefined,
            bridgedGaps,
        );

        console.log('[ResumeStructured] Stage 2: calling Llama for structured resume...');
        const stage2Raw = await callLLMWithRetry(prompt, false);
        console.log(`[ResumeStructured] Stage 2 complete. ${stage2Raw.length} characters.`);

        const stage2InputTokens = Math.round(prompt.length / 4);
        const stage2OutputTokens = Math.round(stage2Raw.length / 4);
        const stage2Cost =
            (stage2InputTokens / 1_000_000) * LLAMA_INPUT_COST_PER_M +
            (stage2OutputTokens / 1_000_000) * LLAMA_OUTPUT_COST_PER_M;

        // ── STAGE 3: Validate + build template resume ──────────────────────
        const { parsePolishJson } = await import('../lib/validatePolish');
        const { buildTemplateResume } = await import('../lib/buildTemplateResume');

        const polish = parsePolishJson(stage2Raw);
        if (!polish) {
            console.warn('[ResumeStructured] LLM output failed Zod validation — falling back to unpolished resume');
        }

        const finalContent = buildTemplateResume(profile, polish, {
            candidateName: profile?.name,
            yearsOfExperience: computeYearsOfExperience(profile?.experience),
            achievementSources: selectedAchievements
                .map((a: any) => a?.description ?? '')
                .filter((s: string) => s && s.length > 0),
            bridgedGaps,
        });

        // ── Persist document ────────────────────────────────────────────────
        const doc = await prisma.document.create({
            data: {
                title: `STRUCTURED RESUME - ${profile.name || 'Draft'}`,
                content: finalContent,
                type: 'RESUME',
                userId,
                jobApplicationId: sanitizedJobAppId,
            },
        });

        const total_cost_usd =
            (stage1Info.tokens?.cost_usd ?? 0) + stage2Cost;

        const costBreakdown = {
            stage1_cached: stage1Info.cached,
            stage1_tokens: stage1Info.tokens,
            stage2_tokens: { input: stage2InputTokens, output: stage2OutputTokens, cost_usd: stage2Cost },
            total_cost_usd,
        };
        console.log('[ResumeStructured] Cost breakdown:', JSON.stringify(costBreakdown));

        res.json({
            content: finalContent,
            id: doc.id,
            costBreakdown,
            blueprint: blueprintResult.blueprint ?? null,
            polishAccepted: polish !== null,
        });
    } catch (error) {
        console.error('[ResumeStructured] Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate structured resume' });
    }
});

// ── Structured cover letter generation ─────────────────────────────────────────
// This route generates a cover letter as structured JSON (salutation + 4 paragraphs
// + signoff) which is then validated with Zod and rendered to deterministic markdown
// server-side. LLM writes prose for fixed slots; code owns paragraph structure.
router.post('/cover-letter-structured', authenticate, async (req: any, res: any) => {
    const userId = (req as any).user?.id;
    const {
        jobDescription,
        selectedAchievementIds,
        analysisContext,
        jobApplicationId,
        companyResearch,
        companyIntel: companyIntelFromBody,
        bridgedGaps: bridgedGapsRaw,
    } = req.body;

    if (!jobDescription) {
        return res.status(400).json({ error: 'Job description is required' });
    }

    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
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
                languages: true,
            },
        });

        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const { normalizeBridgedGaps } = await import('../lib/bridgedGaps');
        const bridgedGaps = normalizeBridgedGaps(bridgedGapsRaw);

        const { buildAchievementContext } = await import('../services/generation');
        const selectedAchievements = await buildAchievementContext(
            userId,
            jobDescription,
            selectedAchievementIds
        );

        const sanitizedJobAppId = jobApplicationId === 'temp-id' ? null : (jobApplicationId || null);

        // Company intel: prefer the value the apply flow pre-fetched (Perplexity,
        // background-warmed on entry); else fall back to the JobApplication row.
        let companyIntel: any = companyIntelFromBody ?? null;
        if (!companyIntel && sanitizedJobAppId) {
            try {
                const jobApp = await prisma.jobApplication.findUnique({
                    where: { id: sanitizedJobAppId },
                    select: { companyIntel: true },
                });
                companyIntel = jobApp?.companyIntel ?? null;
            } catch {
                // Non-fatal — generation proceeds without intel
            }
        }

        // ── STAGE 1: Strategic Blueprint (Claude) ──────────────────────────
        let blueprintResult;
        let stage1Info: { cached: boolean; tokens?: { input: number; output: number; cost_usd: number } } = { cached: false };

        const { generateBlueprint } = await import('../services/strategy');
        const { buildSearchContextBlock } = await import('../services/prompts');
        const searchContext = buildSearchContextBlock(profile);

        // Pre-populate DB blueprint cache
        if (sanitizedJobAppId) {
            const jobApp = await prisma.jobApplication.findUnique({
                where: { id: sanitizedJobAppId },
                select: { blueprintJson: true },
            });
            if (jobApp?.blueprintJson) {
                setCachedBlueprint(sanitizedJobAppId, jobApp.blueprintJson as any);
                console.log(`[CoverLetterStructured] DB blueprint cache hit for ${sanitizedJobAppId}`);
            }
        }

        const matchedCardLabel: string | null = analysisContext?.matchedIdentityCard ?? null;
        let resolvedIdentityCard: any = null;
        if (matchedCardLabel && Array.isArray((profile as any)?.identityCards)) {
            resolvedIdentityCard = (profile as any).identityCards.find(
                (c: any) => c.label === matchedCardLabel
            ) ?? null;
        }

        const cacheKey = sanitizedJobAppId || `${userId}-${Date.now()}`;
        try {
            blueprintResult = await generateBlueprint(
                cacheKey,
                searchContext + jobDescription,
                profile,
                selectedAchievements,
                'COVER_LETTER',
                resolvedIdentityCard
            );
            stage1Info = { cached: blueprintResult.cached, tokens: blueprintResult.tokens };
            console.log(`[CoverLetterStructured] Stage 1 complete. Cached: ${blueprintResult.cached}`);

            if (!blueprintResult.cached && sanitizedJobAppId) {
                prisma.jobApplication.update({
                    where: { id: sanitizedJobAppId },
                    data: { blueprintJson: blueprintResult.blueprint as any },
                }).catch(err => console.error('[CoverLetterStructured] Failed to persist blueprint to DB:', err));
            }
        } catch (blueprintError: any) {
            console.error('[CoverLetterStructured] Stage 1 failed — aborting:', blueprintError.message);
            return res.status(500).json({ error: 'Strategy generation failed' });
        }

        // ── STAGE 2: Structured JSON generation (Llama) ────────────────────
        const { COVER_LETTER_SLOTS_PROMPT } = await import('../services/prompts/coverLetterSlotsPrompt');

        // Override employerInsight if company research was provided
        if (companyResearch?.highlights?.length > 0) {
            blueprintResult.blueprint.employerInsight =
                companyResearch.highlights.join(' — ');
        }

        const { scrubInjection } = await import('../services/scrubInjection');
        const { scrubbed: cleanJd } = scrubInjection(jobDescription);

        const prompt = COVER_LETTER_SLOTS_PROMPT(
            cleanJd,
            profile,
            selectedAchievements,
            blueprintResult.blueprint,
            analysisContext,
            companyResearch,
            companyIntel,
            bridgedGaps,
        );

        console.log('[CoverLetterStructured] Stage 2: calling Llama for structured cover letter...');
        const stage2Raw = await callLLMWithRetry(prompt, false);
        console.log(`[CoverLetterStructured] Stage 2 complete. ${stage2Raw.length} characters.`);

        const stage2InputTokens = Math.round(prompt.length / 4);
        const stage2OutputTokens = Math.round(stage2Raw.length / 4);
        const stage2Cost =
            (stage2InputTokens / 1_000_000) * LLAMA_INPUT_COST_PER_M +
            (stage2OutputTokens / 1_000_000) * LLAMA_OUTPUT_COST_PER_M;

        // ── STAGE 3: Validate + build template cover letter ────────────────
        const { parseCoverLetterPolishJson } = await import('../lib/validateCoverLetterPolish');
        const { applyCoverLetterPolish } = await import('../lib/applyCoverLetterPolish');
        const { coverLetterToMarkdown } = await import('../lib/coverLetterToMarkdown');
        const { enforceCoverLetterQuality } = await import('../lib/coverLetterQualityEnforcers');

        const polish = parseCoverLetterPolishJson(stage2Raw);
        if (!polish) {
            console.warn('[CoverLetterStructured] LLM output failed Zod validation — falling back to baseline template');
        }

        // Build baseline CoverLetterData from profile + job data
        const { profileToCoverLetterData } = await import('../lib/profileToCoverLetterData');
        let coverData = profileToCoverLetterData(profile, {
            title: analysisContext?.title || '',
            company: companyResearch?.name || analysisContext?.company || '',
            companyIntel,
        });

        // Apply polish if valid
        if (polish) {
            coverData = applyCoverLetterPolish(coverData, polish);
        }

        // Run quality enforcers
        coverData = enforceCoverLetterQuality(coverData, {
            candidateName: profile?.name,
        });

        // Render to deterministic markdown
        const finalContent = coverLetterToMarkdown(coverData);

        // ── Persist document ────────────────────────────────────────────────
        const doc = await prisma.document.create({
            data: {
                title: `COVER LETTER - ${profile.name || 'Draft'}`,
                content: finalContent,
                type: 'COVER_LETTER',
                userId,
                jobApplicationId: sanitizedJobAppId,
            },
        });

        const total_cost_usd =
            (stage1Info.tokens?.cost_usd ?? 0) + stage2Cost;

        const costBreakdown = {
            stage1_cached: stage1Info.cached,
            stage1_tokens: stage1Info.tokens,
            stage2_tokens: { input: stage2InputTokens, output: stage2OutputTokens, cost_usd: stage2Cost },
            total_cost_usd,
        };
        console.log('[CoverLetterStructured] Cost breakdown:', JSON.stringify(costBreakdown));

        res.json({
            content: finalContent,
            id: doc.id,
            costBreakdown,
            blueprint: blueprintResult.blueprint ?? null,
            polishAccepted: polish !== null,
        });
    } catch (error) {
        console.error('[CoverLetterStructured] Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate cover letter' });
    }
});

export default router;
