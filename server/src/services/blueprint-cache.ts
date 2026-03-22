import { StrategyBlueprint } from './prompts';

interface CacheEntry {
    blueprint: StrategyBlueprint;
    createdAt: number;
}

const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
const blueprintCache = new Map<string, CacheEntry>();

export function getCachedBlueprint(jobApplicationId: string): StrategyBlueprint | null {
    const entry = blueprintCache.get(jobApplicationId);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > CACHE_TTL) {
        blueprintCache.delete(jobApplicationId);
        return null;
    }
    return entry.blueprint;
}

export function setCachedBlueprint(jobApplicationId: string, blueprint: StrategyBlueprint): void {
    blueprintCache.set(jobApplicationId, { blueprint, createdAt: Date.now() });
}
