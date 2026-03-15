import { searchAchievements } from './vector';
import { prisma } from '../index';

export interface RankedAchievement {
  id: string;
  text: string;
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
  const matches = await searchAchievements(userId, jobDescription, 15);

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
      text: meta.text,
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

