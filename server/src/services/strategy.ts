import { callClaude } from './llm';
import { STRATEGY_BLUEPRINT_PROMPT, StrategyBlueprint } from './prompts';
import { getCachedBlueprint, setCachedBlueprint } from './blueprint-cache';
import { parseLLMJson } from '../utils/parseLLMResponse';

// Claude Sonnet pricing (OpenRouter) — update if rates change
const CLAUDE_INPUT_COST_PER_M = 3.00;
const CLAUDE_OUTPUT_COST_PER_M = 15.00;

export interface BlueprintResult {
    blueprint: StrategyBlueprint;
    cached: boolean;
    tokens?: { input: number; output: number; cost_usd: number };
}

export async function generateBlueprint(
    jobApplicationId: string,
    jd: string,
    profile: any,
    selectedAchievements: any[],
    docType: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE'
): Promise<BlueprintResult> {
    // Check cache — Claude runs once per job, not once per document type
    const cached = getCachedBlueprint(jobApplicationId);
    if (cached) {
        console.log(`[Strategy] Cache hit for jobApplicationId: ${jobApplicationId}`);
        return { blueprint: cached, cached: true };
    }

    console.log(`[Strategy] Cache miss — calling Claude for jobApplicationId: ${jobApplicationId}`);
    const prompt = STRATEGY_BLUEPRINT_PROMPT(jd, profile, selectedAchievements, docType);

    const { content, usage } = await callClaude(prompt, true);

    let blueprint: StrategyBlueprint;
    try {
        blueprint = parseLLMJson(content) as StrategyBlueprint;
    } catch (e: any) {
        console.error('[Strategy] Blueprint parse failed. Raw response:', content.substring(0, 500));
        throw new Error(`Strategy blueprint JSON parse failed: ${e.message}`);
    }

    setCachedBlueprint(jobApplicationId, blueprint);

    const cost_usd =
        (usage.promptTokens / 1_000_000) * CLAUDE_INPUT_COST_PER_M +
        (usage.completionTokens / 1_000_000) * CLAUDE_OUTPUT_COST_PER_M;

    console.log(`[Strategy] Blueprint generated. Tokens: ${usage.promptTokens}in / ${usage.completionTokens}out. Cost: $${cost_usd.toFixed(4)}`);

    return {
        blueprint,
        cached: false,
        tokens: { input: usage.promptTokens, output: usage.completionTokens, cost_usd }
    };
}
