import { CandidateProfile, Experience, Education, Achievement } from '@prisma/client';

export interface CompletionResult {
  score: number;
  isReady: boolean;
  missingFields: string[];
}

export function calculateCompletionScore(profile: any): CompletionResult {
  let score = 0;
  const missingFields: string[] = [];

  // 1. Contact Info (20%)
  let contactScore = 0;
  if (profile.name) contactScore += 5;
  if (profile.email) contactScore += 5;
  if (profile.phone) contactScore += 5;
  if (profile.location) contactScore += 5;
  score += contactScore;
  if (contactScore < 20) missingFields.push('Complete Contact Info');

  // 2. Experience ≥ 2 (20%)
  const expCount = profile.experience?.length || 0;
  if (expCount >= 2) {
    score += 20;
  } else if (expCount === 1) {
    score += 10;
    missingFields.push('Experience (Add at least 2 roles)');
  } else {
    missingFields.push('Experience');
  }

  // 3. Achievements ≥ 5 (20%)
  const achievementCount = profile.achievements?.length || 0;
  if (achievementCount >= 5) {
    score += 20;
  } else if (achievementCount >= 1) {
    score += 10;
    missingFields.push('Achievements (Add at least 5)');
  } else {
    missingFields.push('Achievements');
  }

  // 4. Quantified Achievements ≥ 3 (25%)
  const quantifiedCount = profile.achievements?.filter((a: any) => a.metric && a.metric.trim() !== '').length || 0;
  if (quantifiedCount >= 3) {
    score += 25;
  } else if (quantifiedCount > 0) {
    score += (quantifiedCount * 8); // ~8pts per quantified achievement up to 3
    missingFields.push('Quantified Achievements (Add metrics to at least 3)');
  } else {
    missingFields.push('Quantified Achievements (No metrics found)');
  }

  // 5. Education (10%)
  if (profile.education?.length > 0) {
    score += 10;
  } else {
    missingFields.push('Education');
  }

  // 6. Skills (5%)
  try {
    const skills = typeof profile.skills === 'string' ? JSON.parse(profile.skills) : profile.skills;
    const totalSkills = (skills?.technical?.length || 0) + (skills?.industry?.length || 0) + (skills?.soft?.length || 0);
    if (totalSkills >= 5) {
      score += 5;
    } else if (totalSkills > 0) {
      score += 2;
      missingFields.push('Skills (Add at least 5)');
    } else {
      missingFields.push('Skills');
    }
  } catch (e) {
    missingFields.push('Skills');
  }

  return {
    score: Math.min(score, 100),
    isReady: score >= 80, // High bar for "Ready"
    missingFields
  };
}
