export interface DimensionScore {
  score: number; // 1–5 integer
  grade: string; // A | B | C | D | F
  note: string;
}

export interface DimensionScores {
  roleMatch: DimensionScore;
  skillsAlignment: DimensionScore;
  seniorityFit: DimensionScore;
  compensation: DimensionScore;
  interviewLikelihood: DimensionScore;
  geographicFit: DimensionScore;
  companyStage: DimensionScore;
  marketFit: DimensionScore;
  growthTrajectory: DimensionScore;
  timelineAlignment: DimensionScore;
}

const WEIGHTS: Record<keyof DimensionScores, number> = {
  roleMatch:           0.15,
  skillsAlignment:     0.15,
  seniorityFit:        0.10,
  compensation:        0.10,
  interviewLikelihood: 0.10,
  geographicFit:       0.075,
  companyStage:        0.075,
  marketFit:           0.075,
  growthTrajectory:    0.075,
  timelineAlignment:   0.10,
};

export function scoreToGrade(score: number): string {
  if (score >= 4.5) return 'A';
  if (score >= 3.5) return 'B';
  if (score >= 2.5) return 'C';
  if (score >= 1.5) return 'D';
  return 'F';
}

/** Adds a `grade` field to each dimension score object returned by the LLM. */
export function addGrades(raw: Record<string, { score: number; note: string }>): DimensionScores {
  const result: any = {};
  for (const [key, val] of Object.entries(raw)) {
    result[key] = { score: val.score, grade: scoreToGrade(val.score), note: val.note };
  }
  return result as DimensionScores;
}

export function computeComposite(dimensions: DimensionScores): {
  composite: number;
  matchScore: number;
  overallGrade: string;
} {
  let composite = 0;
  for (const key of Object.keys(WEIGHTS) as Array<keyof DimensionScores>) {
    composite += dimensions[key].score * WEIGHTS[key];
  }
  composite = Math.round(composite * 100) / 100;

  let overallGrade = scoreToGrade(composite);

  // Gate-pass ceiling: if roleMatch or skillsAlignment <= 2 (D or F), cap overall at C
  const gatePassMin = Math.min(
    dimensions.roleMatch.score,
    dimensions.skillsAlignment.score,
  );
  if (gatePassMin <= 2 && (overallGrade === 'A' || overallGrade === 'B')) {
    overallGrade = 'C';
  }

  const matchScore = Math.round((composite / 5) * 100);
  return { composite, matchScore, overallGrade };
}
