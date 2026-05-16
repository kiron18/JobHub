export type BulletProvenance = 'parsed' | 'user_metric' | 'ai_rewrite';

export interface ProvenancedBullet {
  text: string;
  provenance: BulletProvenance;
}

/** Returns true when the bullet needs the AI-rewrite badge shown. */
export function shouldShowAIRewriteBadge(provenance: BulletProvenance): boolean {
  return provenance === 'ai_rewrite';
}
