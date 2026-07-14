import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { checkAccess } from '../middleware/accessControl';
import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { callClaude, PREMIUM_MODEL } from '../services/llm';
import { DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT, DOCUMENT_GENERATION_PROMPT, buildSearchContextBlock } from '../services/prompts';
import { generateBlueprint } from '../services/strategy';
import { setCachedBlueprint } from '../services/blueprint-cache';
import { buildPerCriterionAchievements } from '../services/generation';
import { reviewDocument } from '../services/quality-gate';
import { tagAIRewrites } from '../lib/provenanceTagging';
import { enforceFirstPersonSummary, scrubAITells, enforceFirstPersonCoverLetter, scrubBannedPhrases } from '../lib/voiceEnforcer';
import { resolveYearsOfExperience, extractContactEmail } from '../lib/profileMath';
import { detectYearsClaim, getYearsFeedbackInstruction, removeSentencesWithYears } from '../lib/yearsClaimDetector';
import { logEmployerGroundingCheck } from '../lib/employerGroundingCheck';
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

// Claude pricing (OpenRouter) — single-pass resume + cover letter generation
const CLAUDE_INPUT_COST_PER_M = 3.00;
const CLAUDE_OUTPUT_COST_PER_M = 15.00;

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
    if (type === 'resume-structured' || type === 'cover-letter-structured' || type === 'selection-criteria-structured') return next();
    // The resume, cover letter, and selection-criteria documents are now generated
    // exclusively by the single Claude pass on the dedicated -structured routes
    // below. The old Llama path for these three is retired. Fail loudly rather than
    // silently serving a lower-quality Llama document if anything ever routes here.
    if (type === 'resume' || type === 'cover-letter' || type === 'selection-criteria') {
        return res.status(410).json({
            error: `The ${type} generator has moved. Use /generate/${type}-structured.`,
        });
    }
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
                resolvedIdentityCard,
                Array.isArray(selectedAchievementIds) && selectedAchievementIds.length > 0,
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
                    yearsOfExperience: resolveYearsOfExperience([profile.professionalSummary, profile.resumeRawText], profile.experience),
                    contactEmail: extractContactEmail(profile.resumeRawText),
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
                    yearsOfExperience: resolveYearsOfExperience([profile?.professionalSummary, profile?.resumeRawText], profile?.experience),
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

// ── Structured resume generation (V2) ─────────────────────────────────────────
// Single-pass generation from raw resume text. No blueprint, no strategist stage,
// no structured JSON. Claude writes markdown directly; grounding gate enforces honesty.
router.post('/resume-structured', authenticate, async (req: any, res: any) => {
    const userId = (req as any).user.id as string;
    const {
        jobDescription,
        jobApplicationId,
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

        // Load profile: scalars only, no includes
        const profile = await prisma.candidateProfile.findUnique({
            where: { userId },
            select: { id: true, name: true, resumeRawText: true },
        });

        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Enforce resumeRawText guard
        if (!profile.resumeRawText || profile.resumeRawText.length < 200) {
            return res.status(400).json({ error: 'No resume on file. Upload your resume in the Profile section first.' });
        }

        const sanitizedJobAppId = jobApplicationId === 'temp-id' ? null : (jobApplicationId || null);

        // Build prompt and generate
        const { RESUME_V2_PROMPT } = await import('../services/prompts/generationV2');
        const { checkGrounding } = await import('../lib/groundingGate');

        const prompt = RESUME_V2_PROMPT(profile.resumeRawText, jobDescription);

        console.log('[ResumeStructured] Generating resume (V2 single pass)...');
        const { content: rawOutput, usage } = await callClaude(prompt, false, undefined, PREMIUM_MODEL);
        console.log(`[ResumeStructured] Generation complete. ${rawOutput.length} characters.`);

        const stage2Cost =
            (usage.promptTokens / 1_000_000) * CLAUDE_INPUT_COST_PER_M +
            (usage.completionTokens / 1_000_000) * CLAUDE_OUTPUT_COST_PER_M;

        // Strip accidental code fences
        let finalContent = rawOutput.trim();
        if (finalContent.startsWith('```')) {
            const lines = finalContent.split('\n');
            if (lines[0].startsWith('```')) lines.shift();
            if (lines[lines.length - 1].startsWith('```')) lines.pop();
            finalContent = lines.join('\n').trim();
        }

        // Shape check: must contain required sections in order
        function passesShapeCheck(text: string): boolean {
            const checks = [
                text.includes('# '),
                text.includes('## Professional Summary'),
                text.includes('## Work Experience'),
                text.includes('### '),
                text.includes('## Education'),
                text.includes('## Skills'),
            ];
            return checks.every(Boolean);
        }

        let shapePassed = passesShapeCheck(finalContent);

        // Retry once if shape check fails
        if (!shapePassed) {
            console.log('[ResumeStructured] Shape check failed, retrying once...');
            const retryPrompt = prompt + '\n\nYour previous attempt did not follow the required output structure. Return ONLY the markdown document in exactly the specified structure.';
            const { content: retryOutput, usage: retryUsage } = await callClaude(retryPrompt, false, undefined, PREMIUM_MODEL);

            stage2Cost +
                (retryUsage.promptTokens / 1_000_000) * CLAUDE_INPUT_COST_PER_M +
                (retryUsage.completionTokens / 1_000_000) * CLAUDE_OUTPUT_COST_PER_M;

            finalContent = retryOutput.trim();
            if (finalContent.startsWith('```')) {
                const lines = finalContent.split('\n');
                if (lines[0].startsWith('```')) lines.shift();
                if (lines[lines.length - 1].startsWith('```')) lines.pop();
                finalContent = lines.join('\n').trim();
            }

            shapePassed = passesShapeCheck(finalContent);
            if (!shapePassed) {
                console.error('[ResumeStructured] Shape check failed after retry');
                return res.status(502).json({ error: 'Generation failed format validation, please try again.' });
            }
        }

        // Grounding gate check
        let groundingWarnings: string[] = [];
        const groundingResult = checkGrounding(finalContent, profile.resumeRawText, jobDescription);

        if (groundingResult.violations.length > 0) {
            console.log(`[ResumeStructured] Grounding violations found: ${groundingResult.violations.length}`);

            // Retry once with violations appended
            const retryPrompt = prompt + '\n\n== YOUR PREVIOUS ATTEMPT VIOLATED THESE HONESTY RULES, FIX THEM ==\n' +
                groundingResult.violations.map(v => `- ${v}`).join('\n');

            const { content: retryOutput, usage: retryUsage } = await callClaude(retryPrompt, false, undefined, PREMIUM_MODEL);

            // Recalculate cost
            const retryCost =
                (retryUsage.promptTokens / 1_000_000) * CLAUDE_INPUT_COST_PER_M +
                (retryUsage.completionTokens / 1_000_000) * CLAUDE_OUTPUT_COST_PER_M;

            let retryContent = retryOutput.trim();
            if (retryContent.startsWith('```')) {
                const lines = retryContent.split('\n');
                if (lines[0].startsWith('```')) lines.shift();
                if (lines[lines.length - 1].startsWith('```')) lines.pop();
                retryContent = lines.join('\n').trim();
            }

            // Recheck grounding
            const retryGrounding = checkGrounding(retryContent, profile.resumeRawText, jobDescription);

            if (retryGrounding.violations.length === 0) {
                // Retry succeeded
                finalContent = retryContent;
            } else {
                // Still has violations, keep the content but warn
                groundingWarnings = retryGrounding.violations;
                finalContent = retryContent;
                for (const v of retryGrounding.violations) {
                    console.warn(`[ResumeStructured] Grounding warning: ${v}`);
                }
            }
        }

        // Estimate pages: ~45 non-empty lines per A4 page at standard margins.
        const nonEmptyLines = finalContent.split('\n').filter(l => l.trim().length > 0).length;
        const estimatedPages = Math.ceil(nonEmptyLines / 45);

        // ── Persist document ────────────────────────────────────────────────
        const doc = await prisma.document.create({
            data: {
                title: `RESUME - ${profile.name || 'Draft'}`,
                content: finalContent,
                type: 'RESUME',
                userId,
                jobApplicationId: sanitizedJobAppId,
            },
        });

        const costBreakdown = {
            stage1_cached: false,
            stage2_tokens: { input: usage.promptTokens, output: usage.completionTokens, cost_usd: stage2Cost },
            total_cost_usd: stage2Cost,
        };
        console.log('[ResumeStructured] Cost breakdown:', JSON.stringify(costBreakdown));

        res.json({
            content: finalContent,
            id: doc.id,
            costBreakdown,
            blueprint: null,
            polishAccepted: true,
            estimatedPages,
            tips: [],
            pageBudgetWarning: false,
            groundingWarnings: groundingWarnings.length > 0 ? groundingWarnings : undefined,
        });
    } catch (error) {
        console.error('[ResumeStructured] Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate structured resume' });
    }
});

// ── Structured cover letter generation (V2) ───────────────────────────────────
// Single-pass generation from raw resume text. No blueprint, no structured JSON.
// Claude writes the letter directly; grounding gate enforces honesty.
router.post('/cover-letter-structured', authenticate, async (req: any, res: any) => {
    const userId = (req as any).user?.id;
    const {
        jobDescription,
        jobApplicationId,
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

        // Load profile: scalars only, no includes
        const profile = await prisma.candidateProfile.findUnique({
            where: { userId },
            select: { id: true, name: true, resumeRawText: true },
        });

        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Enforce resumeRawText guard
        if (!profile.resumeRawText || profile.resumeRawText.length < 200) {
            return res.status(400).json({ error: 'No resume on file. Upload your resume in the Profile section first.' });
        }

        const sanitizedJobAppId = jobApplicationId === 'temp-id' ? null : (jobApplicationId || null);

        // Get most recent resume content if available (for consistency)
        let generatedResume: string | undefined;
        if (sanitizedJobAppId) {
            const mostRecentResume = await prisma.document.findFirst({
                where: { userId, jobApplicationId: sanitizedJobAppId, type: 'RESUME' },
                orderBy: { createdAt: 'desc' },
                select: { content: true },
            });
            generatedResume = mostRecentResume?.content ?? undefined;
        }

        // Build prompt and generate
        const { COVER_LETTER_V2_PROMPT } = await import('../services/prompts/generationV2');
        const { checkGrounding } = await import('../lib/groundingGate');

        const prompt = COVER_LETTER_V2_PROMPT(profile.resumeRawText, jobDescription, generatedResume);

        console.log('[CoverLetterStructured] Generating cover letter (V2 single pass)...');
        const { content: rawOutput, usage } = await callClaude(prompt, false, undefined, PREMIUM_MODEL);
        console.log(`[CoverLetterStructured] Generation complete. ${rawOutput.length} characters.`);

        const stage2Cost =
            (usage.promptTokens / 1_000_000) * CLAUDE_INPUT_COST_PER_M +
            (usage.completionTokens / 1_000_000) * CLAUDE_OUTPUT_COST_PER_M;

        // Strip accidental code fences
        let finalContent = rawOutput.trim();
        if (finalContent.startsWith('```')) {
            const lines = finalContent.split('\n');
            if (lines[0].startsWith('```')) lines.shift();
            if (lines[lines.length - 1].startsWith('```')) lines.pop();
            finalContent = lines.join('\n').trim();
        }

        // Shape check: must contain salutation and sign-off
        function passesShapeCheck(text: string): boolean {
            const hasSalutation = /^Dear\s+\w+/im.test(text) || text.includes('Dear Hiring Manager,');
            const hasSignoff = text.includes('Yours sincerely,');
            return hasSalutation && hasSignoff;
        }

        let shapePassed = passesShapeCheck(finalContent);

        // Retry once if shape check fails
        if (!shapePassed) {
            console.log('[CoverLetterStructured] Shape check failed, retrying once...');
            const retryPrompt = prompt + '\n\nYour previous attempt did not follow the required letter format. Return ONLY the letter text with "Dear Hiring Manager," and "Yours sincerely," sign-off.';
            const { content: retryOutput, usage: retryUsage } = await callClaude(retryPrompt, false, undefined, PREMIUM_MODEL);

            let retryContent = retryOutput.trim();
            if (retryContent.startsWith('```')) {
                const lines = retryContent.split('\n');
                if (lines[0].startsWith('```')) lines.shift();
                if (lines[lines.length - 1].startsWith('```')) lines.pop();
                retryContent = lines.join('\n').trim();
            }

            shapePassed = passesShapeCheck(retryContent);
            if (!shapePassed) {
                console.error('[CoverLetterStructured] Shape check failed after retry');
                return res.status(502).json({ error: 'Generation failed format validation, please try again.' });
            }
            finalContent = retryContent;
        }

        // Grounding gate check (numbers and contact only for letters)
        let groundingWarnings: string[] = [];
        const groundingResult = checkGrounding(finalContent, profile.resumeRawText, jobDescription);

        if (groundingResult.violations.length > 0) {
            console.log(`[CoverLetterStructured] Grounding violations found: ${groundingResult.violations.length}`);

            // Retry once with violations appended
            const retryPrompt = prompt + '\n\n== YOUR PREVIOUS ATTEMPT VIOLATED THESE HONESTY RULES, FIX THEM ==\n' +
                groundingResult.violations.map(v => `- ${v}`).join('\n');

            const { content: retryOutput } = await callClaude(retryPrompt, false, undefined, PREMIUM_MODEL);

            let retryContent = retryOutput.trim();
            if (retryContent.startsWith('```')) {
                const lines = retryContent.split('\n');
                if (lines[0].startsWith('```')) lines.shift();
                if (lines[lines.length - 1].startsWith('```')) lines.pop();
                retryContent = lines.join('\n').trim();
            }

            // Recheck grounding
            const retryGrounding = checkGrounding(retryContent, profile.resumeRawText, jobDescription);

            if (retryGrounding.violations.length === 0) {
                // Retry succeeded
                finalContent = retryContent;
            } else {
                // Still has violations, keep the content but warn
                groundingWarnings = retryGrounding.violations;
                finalContent = retryContent;
                for (const v of retryGrounding.violations) {
                    console.warn(`[CoverLetterStructured] Grounding warning: ${v}`);
                }
            }
        }

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

        const costBreakdown = {
            stage1_cached: false,
            stage2_tokens: { input: usage.promptTokens, output: usage.completionTokens, cost_usd: stage2Cost },
            total_cost_usd: stage2Cost,
        };
        console.log('[CoverLetterStructured] Cost breakdown:', JSON.stringify(costBreakdown));

        res.json({
            content: finalContent,
            id: doc.id,
            costBreakdown,
            blueprint: null,
            polishAccepted: true,
            groundingWarnings: groundingWarnings.length > 0 ? groundingWarnings : undefined,
        });
    } catch (error) {
        console.error('[CoverLetterStructured] Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate cover letter' });
    }
});

// ── Structured selection-criteria generation ────────────────────────────────
// One Claude pass over the candidate's real resume + the job + the pasted
// criteria. Produces labelled STAR responses as markdown. No blueprint/executor.
router.post('/selection-criteria-structured', authenticate, async (req: any, res: any) => {
    const userId = (req as any).user?.id as string;
    const { jobDescription, selectionCriteriaText, jobApplicationId } = req.body;

    if (!jobDescription) return res.status(400).json({ error: 'Job description is required' });
    if (!selectionCriteriaText || String(selectionCriteriaText).trim().length < 10) {
        return res.status(400).json({ error: 'Selection criteria text is required' });
    }

    try {
        const userEmail = ((req as any).user?.email ?? '').toLowerCase();
        const access = await checkAccess(userId, 'generation', userEmail);
        if (!access.allowed) {
            return res.status(402).json({ error: 'Generation limit reached', upgradeRequired: true, remaining: 0 });
        }

        const profile = await prisma.candidateProfile.findUnique({
            where: { userId },
            include: { experience: true, education: true },
        });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        const sanitizedJobAppId = jobApplicationId === 'temp-id' ? null : (jobApplicationId || null);

        const { SELECTION_CRITERIA_PROMPT } = await import('../services/prompts/selectionCriteriaPrompt');
        const prompt = SELECTION_CRITERIA_PROMPT(jobDescription, profile, String(selectionCriteriaText));

        console.log('[SelectionCriteria] Generating responses (single Claude pass)...');
        const { content: raw, usage } = await callClaude(prompt, false, undefined, PREMIUM_MODEL);

        // Final safety net: strip em dashes (banned in output).
        const finalContent = raw.split('—').join(' - ').split('–').join(' - ').trim();

        const stage2Cost =
            (usage.promptTokens / 1_000_000) * CLAUDE_INPUT_COST_PER_M +
            (usage.completionTokens / 1_000_000) * CLAUDE_OUTPUT_COST_PER_M;

        const doc = await prisma.document.create({
            data: {
                title: `SELECTION CRITERIA - ${profile.name || 'Draft'}`,
                content: finalContent,
                type: 'STAR_RESPONSE',
                userId,
                jobApplicationId: sanitizedJobAppId,
            },
        });

        console.log('[SelectionCriteria] Cost:', stage2Cost.toFixed(4));
        res.json({ content: finalContent, id: doc.id });
    } catch (error) {
        console.error('[SelectionCriteria] Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate selection criteria responses' });
    }
});

export default router;
