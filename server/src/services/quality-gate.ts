import { callClaude } from './llm';
import { QUALITY_GATE_PROMPT, QualityGateResult, ProfileSnapshot, StrategyBlueprint } from './prompts';
import { parseLLMJson } from '../utils/parseLLMResponse';

const CLAUDE_INPUT_COST_PER_M = 3.00;
const CLAUDE_OUTPUT_COST_PER_M = 15.00;

export interface QualityGateOutcome {
    passed: boolean;
    flags: string[];
    profileViolations: string[];
    rewrittenContent: string;
    tokens: { input: number; output: number; cost_usd: number };
}

function extractProfileSnapshot(profile: any): ProfileSnapshot {
    const employers: string[] = (profile?.experience ?? [])
        .map((e: any) => e?.company)
        .filter(Boolean);
    const jobTitles: string[] = (profile?.experience ?? [])
        .map((e: any) => e?.title)
        .filter(Boolean);
    const achievementMetrics: string[] = (profile?.achievements ?? [])
        .map((a: any) => a?.metric)
        .filter(Boolean);
    return { employers, jobTitles, achievementMetrics };
}

export async function reviewDocument(
    blueprint: StrategyBlueprint,
    generatedContent: string,
    docType: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' = 'COVER_LETTER',
    profile?: any
): Promise<QualityGateOutcome> {
    const snapshot = profile ? extractProfileSnapshot(profile) : null;
    const prompt = QUALITY_GATE_PROMPT(blueprint, generatedContent, docType, snapshot);
    const { content, usage } = await callClaude(prompt, true);

    let result: QualityGateResult;
    try {
        result = parseLLMJson(content) as QualityGateResult;
    } catch (e: any) {
        console.error('[QualityGate] Parse failed — treating as passed. Raw:', content.substring(0, 300));
        return {
            passed: true,
            flags: [],
            profileViolations: [],
            rewrittenContent: generatedContent,
            tokens: { input: usage.promptTokens, output: usage.completionTokens, cost_usd: 0 }
        };
    }

    const cost_usd =
        (usage.promptTokens / 1_000_000) * CLAUDE_INPUT_COST_PER_M +
        (usage.completionTokens / 1_000_000) * CLAUDE_OUTPUT_COST_PER_M;

    console.log(`[QualityGate] passed=${result.passed}, flags=${result.flags?.length ?? 0}, rewrites=${result.rewrites?.length ?? 0}`);

    // Apply surgical rewrites when flagged
    let rewrittenContent = generatedContent;
    if (!result.passed && result.rewrites && result.rewrites.length > 0) {
        for (const rw of result.rewrites) {
            if (rw.original && rw.suggested && rewrittenContent.includes(rw.original)) {
                rewrittenContent = rewrittenContent.replace(rw.original, rw.suggested);
                console.log(`[QualityGate] Applied rewrite in section: ${rw.section}`);
            }
        }
    }

    return {
        passed: result.passed,
        flags: result.flags || [],
        profileViolations: result.profileViolations || [],
        rewrittenContent,
        tokens: { input: usage.promptTokens, output: usage.completionTokens, cost_usd }
    };
}
