// Intensity tied to the daily goal of 5: 0 / 1-2 / 3-4 / 5+ darkest.
export function intensityLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 3) return 2;
  if (count <= 4) return 3;
  return 4;
}

export const HEATMAP_GREENS = ['#EBEDF0', '#C6E8C9', '#7DC98A', '#3FA34D', '#1E7A34'];
