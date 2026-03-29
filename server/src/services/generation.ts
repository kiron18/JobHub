import { searchAchievements } from './vector';
import { prisma } from '../index';

export interface CriterionAchievementMap {
  criterion: string;
  criterionIndex: number;
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    metric: string | null;
    relevanceScore: number;
  }>;
}

export interface RankedAchievement {
  id: string;
  description: string;
  relevanceScore: number;
  tier: 'STRONG' | 'MODERATE' | 'WEAK';
  matchedKeywords: string[];
  metric: string | null;
}

/**
 * Ranks achievements based on semantic similarity and keyword overlap.
 */
export async function rankAchievements(
  userId: string,
  jobDescription: string,
  keywords: string[]
): Promise<RankedAchievement[]> {
  // 1. Semantic Search for top achievements in user's namespace
  const rawMatches = await searchAchievements(userId, jobDescription, 15);
  // Deduplicate by ID (same achievement can appear multiple times if re-indexed)
  const seen = new Set<string>();
  const matches = rawMatches.filter((m: any) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  const ranked: RankedAchievement[] = matches.map((match: any) => {
    const meta = match.metadata;
    const semanticScore = match.score || 0;
    
    // 2. Calculate Keyword Overlap
    const achievementText = (meta.text || '').toLowerCase();
    const matchedKeywords = keywords.filter(kw => 
      achievementText.includes(kw.toLowerCase())
    );
    const keywordOverlap = matchedKeywords.length;

    // 3. Tier Assignment
    let tier: 'STRONG' | 'MODERATE' | 'WEAK' = 'WEAK';
    if (semanticScore >= 0.70 || (semanticScore >= 0.55 && keywordOverlap >= 2)) {
      tier = 'STRONG';
    } else if (semanticScore >= 0.40) {
      tier = 'MODERATE';
    }

    return {
      id: match.id,
      description: meta.text,
      relevanceScore: Math.round(semanticScore * 100),
      tier,
      matchedKeywords,
      metric: meta.metric || null
    };
  });

  // Sort by score descending
  return ranked.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Builds the achievement context for generation, respecting user selection
 * or falling back to top ranked results.
 */
export async function buildAchievementContext(
  userId: string,
  jobDescription: string,
  selectedAchievementIds?: string[]
) {
  // Find the profile for this user
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId }
  });

  if (!profile) return [];

  if (selectedAchievementIds && selectedAchievementIds.length > 0) {
    // Use ONLY selected achievements
    return await prisma.achievement.findMany({
      where: { 
        id: { in: selectedAchievementIds },
        candidateProfileId: profile.id
      }
    });
  }

  // Fallback: Get top 5 ranked achievements
  const ranked = await rankAchievements(userId, jobDescription, []);

  const topIds = ranked.slice(0, 5).map(a => a.id);
  return await prisma.achievement.findMany({
    where: {
      id: { in: topIds },
      candidateProfileId: profile.id
    }
  });
}

/**
 * Parses raw selection criteria text into individual criterion strings.
 * Supports numbered lists, bullet points, and double-newline-separated blocks.
 */
function parseCriteriaText(text: string): string[] {
  if (!text.trim()) return [];

  // Numbered: "1. criterion text" or "1) criterion text"
  const numbered = text.match(/^\d+[.)]\s+.+/gm);
  if (numbered && numbered.length >= 2) {
    return numbered.map(s => s.replace(/^\d+[.)]\s+/, '').trim()).filter(s => s.length > 10);
  }

  // Double newline blocks
  const blocks = text.split(/\n{2,}/).map(b => b.trim()).filter(b => b.length > 10);
  if (blocks.length >= 2) return blocks;

  // Single newlines
  return text.split('\n').map(l => l.trim()).filter(l => l.length > 10);
}

/**
 * For selection criteria generation: retrieves the most relevant achievements
 * PER CRITERION via Pinecone semantic search. Returns a map that the prompt
 * builder uses to inject targeted evidence for each criterion.
 *
 * This replaces the global top-N approach for SC documents.
 */
export async function buildPerCriterionAchievements(
  userId: string,
  selectionCriteriaText: string,
  topKPerCriterion = 3
): Promise<CriterionAchievementMap[]> {
  const criteria = parseCriteriaText(selectionCriteriaText);
  if (criteria.length === 0) return [];

  const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
  if (!profile) return [];

  const results: CriterionAchievementMap[] = [];

  for (let i = 0; i < criteria.length; i++) {
    const criterion = criteria[i];

    try {
      const matches = await searchAchievements(userId, criterion, topKPerCriterion);

      // Resolve full achievement records from DB for title + metric
      const ids = matches.map((m: any) => m.id);
      const dbRecords = await prisma.achievement.findMany({
        where: { id: { in: ids }, candidateProfileId: profile.id },
        select: { id: true, title: true, description: true, metric: true },
      });

      const dbMap = new Map(dbRecords.map(r => [r.id, r]));

      const achievements = matches
        .map((m: any) => {
          const db = dbMap.get(m.id);
          if (!db) return null;
          return {
            id: m.id,
            title: db.title,
            description: db.description,
            metric: db.metric ?? null,
            relevanceScore: Math.round((m.score || 0) * 100),
          };
        })
        .filter((a): a is NonNullable<typeof a> => a !== null);

      results.push({ criterion, criterionIndex: i + 1, achievements });
    } catch (err) {
      console.warn(`[perCriterionAchievements] Failed for criterion ${i + 1}:`, err);
      results.push({ criterion, criterionIndex: i + 1, achievements: [] });
    }
  }

  return results;
}

