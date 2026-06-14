// Maps each reveal beat to its illustration. Gender alternates across beats by
// design (no per-user detection): the set reads as a mix. Paths are absolute from
// the public root so they resolve the same in dev and prod.
export type ScanBeat = 'wound' | 'stakes' | 'relief' | 'wall' | 'cure';

const BEAT_IMAGE: Record<ScanBeat, string> = {
  wound: '/images/scan/scan-wound-female.png',
  stakes: '/images/scan/scan-stakes-male.png',
  relief: '/images/scan/scan-relief-female.png',
  wall: '/images/scan/scan-wall-male.png',
  cure: '/images/scan/scan-cure-female.png',
};

export function beatImage(beat: ScanBeat): string {
  return BEAT_IMAGE[beat];
}

// All beat images, for preloading during the scan chamber.
export const ALL_SCAN_IMAGES: string[] = Object.values(BEAT_IMAGE);
