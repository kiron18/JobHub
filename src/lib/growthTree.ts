/* ── Growth Tree — generation engine ──────────────────────────────────
   Ported from the seeded-generation spec at
   https://claude.ai/artifact/14yjLVmAudQZfheq4mSLUY (vendored copy:
   docs/growth-tree-reference.html). Pure math/data here, no DOM — the
   React component (components/engagement/TreeAvatar.tsx) does the SVG
   rendering. Keeping the split means this file is trivially testable
   and the same tree data could drive a non-SVG renderer later.

   Same seed always produces the same tree shape, species and persona.
   `day` (0-90) grows the branch structure; `applications` unlocks leaves
   one at a time; `interviews` unlocks fruit; `streak` grows flowers in
   the grass and saturates the canopy; `absenceDays` (days since the last
   logged activity) fades the canopy pale and closes the eyes, capping at
   7 days fully asleep.
*/

export interface TreePersona {
  eyeColor: string;
  eyeRatio: number;
  eyeTilt: number;
  hairColor: string;
  accessoryColor: string;
  facialAccessory: 'none' | 'moustache' | 'beard' | 'lashes' | 'bow' | 'earrings';
  glasses: 'none' | 'round' | 'square' | 'sunglasses';
}

export interface Branch {
  x1: number; y1: number; x2: number; y2: number;
  width: number;
  baseWidth?: number;
  taper?: boolean;
  birth: number | null;
  color: string;
}

export interface LeafSlot { x: number; y: number; rot: number; birth: number; }
export interface FruitSlot { x: number; y: number; rot: number; scale: number; birth: number; }
export interface FlowerSlot { x: number; y: number; stemLen: number; rot: number; scale: number; }

export type FruitSpecies = 'apple' | 'banana' | 'pineapple' | 'mango' | 'orange' | 'grapes';
export type FlowerSpecies = 'dandelion' | 'marigold' | 'daisy';

export interface GrowthTree {
  branches: Branch[];
  leafSlots: LeafSlot[];
  fruitSlots: FruitSlot[];
  flowerSlots: FlowerSlot[];
  leafColor: string;
  species: FruitSpecies;
  flowerSpecies: FlowerSpecies;
  persona: TreePersona;
}

export const BASE_X = 300;
export const BASE_Y = 580;
const UP = -Math.PI / 2;
const MAX_DEPTH = 6;
const GROW_START = 0.03;
const CANOPY_STEP = 0.09;
export const BRANCH_DUR = 0.12;
const SLOTS_PER_BRANCH = 7;
export const LEAF_RENDER_SCALE = 1.2;
const FIT_MARGIN = 14;

export const SYMBOL_BOX: Record<string, [number, number, number, number]> = {
  leafShape: [-9, -14, 18, 28],
  'fruit-apple': [-8, -9, 16, 18],
  'fruit-banana': [-8, -9, 16, 18],
  'fruit-mango': [-8, -9, 16, 18],
  'fruit-orange': [-8, -9, 16, 18],
  'fruit-pineapple': [-8, -10, 16, 20],
  'fruit-grapes': [-8, -10, 16, 20],
  'flower-dandelion': [-6, -6, 12, 12],
  'flower-marigold': [-6, -6, 12, 12],
  'flower-daisy': [-6, -6, 12, 12],
};

const FRUIT_SPECIES: FruitSpecies[] = ['apple', 'banana', 'pineapple', 'mango', 'orange', 'grapes'];
const FLOWER_SPECIES: FlowerSpecies[] = ['dandelion', 'marigold', 'daisy'];
const MAX_FLOWER_SLOTS = 10;
const EYE_COLORS = ['#2A2012', '#4A2E18', '#355C3E', '#2E4A66', '#5B4636', '#1F5C5C'];
const HAIR_COLORS = ['#241A12', '#4A2E18', '#6B4A2E', '#8A6642', '#B0ABA6'];
const ACCENT_COLORS = ['#D4A33D', '#C46A5A', '#8E7FB8'];
// "none" appears twice in each pool so roughly half of all trees come out
// plain -- variety should feel like a trait some trees have, not a
// costume every tree wears.
const FACIAL_POOL: TreePersona['facialAccessory'][] = ['none', 'none', 'moustache', 'beard', 'lashes', 'bow', 'earrings'];
const GLASSES_POOL: TreePersona['glasses'][] = ['none', 'none', 'round', 'square', 'sunglasses'];

export function mulberry32(seed: number): () => number {
  let a = seed;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function easeOutCubic(x: number): number {
  x = clamp(x, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clampAngle(a: number): number {
  const rel = clamp(a - UP, -1.4, 1.4);
  return UP + rel;
}

export function buildTree(seedNum: number): GrowthTree {
  const rng = mulberry32(seedNum >>> 0);
  const branches: Branch[] = [];
  let leafSlots: LeafSlot[] = [];
  const finalTips: { x: number; y: number; birth: number }[] = [];

  const barkHue = 22 + rng() * 20, barkSat = 30 + rng() * 16;
  const leafHue = 96 + rng() * 40, leafSat = 42 + rng() * 20, leafLight = 40 + rng() * 10;
  const species = FRUIT_SPECIES[Math.floor(rng() * FRUIT_SPECIES.length)];

  const trunkLen = 82 + rng() * 14;
  const trunkAngle = UP + (rng() - 0.5) * 0.10;
  const forkX = BASE_X + Math.cos(trunkAngle) * trunkLen;
  const forkY = BASE_Y + Math.sin(trunkAngle) * trunkLen;
  branches.push({
    x1: BASE_X, y1: BASE_Y, x2: forkX, y2: forkY, width: 22, baseWidth: 70, taper: true, birth: null,
    color: `hsl(${barkHue.toFixed(1)} ${barkSat.toFixed(1)}% 28%)`,
  });

  function growCanopy(x: number, y: number, angle: number, len: number, width: number, depth: number, birth: number): void {
    const sway = (rng() - 0.5) * 0.10;
    const a = clampAngle(angle + sway);
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    const lightness = 30 + (depth / MAX_DEPTH) * 30;
    branches.push({
      x1: x, y1: y, x2, y2, width, birth,
      color: `hsl(${barkHue.toFixed(1)} ${barkSat.toFixed(1)}% ${lightness.toFixed(1)}%)`,
    });

    // Leaves sit ON this branch, offset a few units to either side, born
    // once the segment finishes growing. Only thin outer twigs carry
    // leaves, which concentrates the leaf budget so a full application
    // count reads as a dense canopy instead of being diluted thin.
    const leafBirth = birth + BRANCH_DUR;
    if (width < 9) {
      const bdx = x2 - x, bdy = y2 - y;
      const blen = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
      const perpX = -bdy / blen, perpY = bdx / blen;
      for (let s = 0; s < SLOTS_PER_BRANCH; s++) {
        const along = 0.28 + rng() * 0.68;
        const bx = x + bdx * along, by = y + bdy * along;
        const side = rng() < 0.5 ? -1 : 1;
        const off = 2.5 + rng() * 6.5;
        leafSlots.push({ x: bx + perpX * off * side, y: by + perpY * off * side, rot: rng() * 360, birth: leafBirth });
      }
    }

    const nextBirth = birth + CANOPY_STEP;
    if (depth >= MAX_DEPTH || len < 15) {
      finalTips.push({ x: x2, y: y2, birth: leafBirth });
      return;
    }
    const nChildren: number = rng() < 0.32 ? 3 : 2;
    const spread = 0.38 + rng() * 0.22;
    for (let i = 0; i < nChildren; i++) {
      const frac = nChildren === 1 ? 0 : i / (nChildren - 1) - 0.5;
      const childAngle = a + frac * spread * 2 + (rng() - 0.5) * 0.12;
      const childLen = len * (0.64 + rng() * 0.14);
      const childWidth = Math.max(2.2, width * 0.64);
      growCanopy(x2, y2, childAngle, childLen, childWidth, depth + 1, nextBirth);
    }
  }

  const armAngleOffset = 0.52 + (rng() - 0.5) * 0.14;
  const armLen = trunkLen * (1.55 + rng() * 0.35);
  ([-1, 1] as const).forEach(side => {
    const angle = trunkAngle + side * armAngleOffset;
    const x2 = forkX + Math.cos(angle) * armLen;
    const y2 = forkY + Math.sin(angle) * armLen;
    branches.push({
      x1: forkX, y1: forkY, x2, y2, width: 15, birth: null,
      color: `hsl(${barkHue.toFixed(1)} ${barkSat.toFixed(1)}% 34%)`,
    });
    growCanopy(x2, y2, angle, armLen * (0.66 + rng() * 0.12), 9.5, 2, GROW_START);
  });

  // Extra limbs fan out across a much wider angle than the two main arms,
  // each sprouting in on its own early schedule, so the crown reads as one
  // continuous radiating burst rather than separate clusters with gaps.
  const extraCount = 5 + Math.floor(rng() * 3);
  for (let li = 0; li < extraCount; li++) {
    const limbAngle = clampAngle(trunkAngle + (rng() - 0.5) * 2.6);
    const limbLen = armLen * (0.45 + rng() * 0.55);
    const limbWidth = 7.5 + rng() * 3.5;
    const limbBirth = GROW_START + (li / extraCount) * 0.15 + rng() * 0.03;
    const startFrac = 0.7 + rng() * 0.3;
    const startX = BASE_X + (forkX - BASE_X) * startFrac;
    const startY = BASE_Y + (forkY - BASE_Y) * startFrac;
    growCanopy(startX, startY, limbAngle, limbLen, limbWidth, 1, limbBirth);
  }

  leafSlots = seededShuffle(leafSlots, rng);

  let fruitSlots: FruitSlot[] = finalTips.map(node => ({
    x: node.x + (rng() - 0.5) * 14,
    y: node.y + (rng() - 0.5) * 10 + 4,
    rot: (rng() - 0.5) * 40,
    scale: 2.1 + rng() * 0.5,
    birth: node.birth,
  }));
  fruitSlots = seededShuffle(fruitSlots, rng);

  // A streak grows small flowers in the grass, not on the tree itself —
  // one species per seed, like the fruit, so a streak marker is a
  // personal, recognizable detail rather than a generic icon.
  const flowerSpecies = FLOWER_SPECIES[Math.floor(rng() * FLOWER_SPECIES.length)];
  let flowerSlots: FlowerSlot[] = [];
  for (let fs = 0; fs < MAX_FLOWER_SLOTS; fs++) {
    let fsx = BASE_X + (rng() - 0.5) * 168;
    if (Math.abs(fsx - BASE_X) < 20) fsx += fsx < BASE_X ? -22 : 22;
    flowerSlots.push({ x: fsx, y: BASE_Y + 6 + rng() * 16, stemLen: 9 + rng() * 6, rot: (rng() - 0.5) * 24, scale: 1.3 + rng() * 0.6 });
  }
  flowerSlots = seededShuffle(flowerSlots, rng);

  const persona: TreePersona = {
    eyeColor: EYE_COLORS[Math.floor(rng() * EYE_COLORS.length)],
    eyeRatio: 0.86 + rng() * 0.32,
    eyeTilt: (rng() - 0.5) * 16,
    hairColor: HAIR_COLORS[Math.floor(rng() * HAIR_COLORS.length)],
    accessoryColor: ACCENT_COLORS[Math.floor(rng() * ACCENT_COLORS.length)],
    facialAccessory: FACIAL_POOL[Math.floor(rng() * FACIAL_POOL.length)],
    glasses: GLASSES_POOL[Math.floor(rng() * GLASSES_POOL.length)],
  };

  return {
    branches, leafSlots, fruitSlots, flowerSlots,
    leafColor: `hsl(${leafHue.toFixed(1)} ${leafSat.toFixed(1)}% ${leafLight.toFixed(1)}%)`,
    species, flowerSpecies, persona,
  };
}

export function stageName(t: number): string {
  if (t < 0.03) return 'Bare Sapling';
  if (t < 0.20) return 'Budding';
  if (t < 0.40) return 'Branching Out';
  if (t < 0.55) return 'Filling In';
  if (t < 0.80) return 'Full Canopy';
  return 'Mature Tree';
}

/** Every seed grows a different overall size and lean; shrink the whole
 *  tree (anchored at the trunk base, which never moves) just enough to
 *  guarantee it stays inside the 600x640 canvas with a margin. Call once
 *  per tree, not per frame. */
export function computeFitScale(tree: GrowthTree): number {
  let minX = Infinity, maxX = -Infinity, minY = Infinity;
  const acc = (x: number, y: number, pad: number) => {
    if (x - pad < minX) minX = x - pad;
    if (x + pad > maxX) maxX = x + pad;
    if (y - pad < minY) minY = y - pad;
  };
  tree.branches.forEach(b => {
    acc(b.x1, b.y1, (b.baseWidth ?? b.width) / 2);
    acc(b.x2, b.y2, b.width / 2);
  });
  tree.leafSlots.forEach(s => acc(s.x, s.y, 11));
  tree.fruitSlots.forEach(s => acc(s.x, s.y, 9));
  if (!isFinite(minX)) return 1;
  const availLeft = BASE_X - FIT_MARGIN;
  const availRight = 600 - FIT_MARGIN - BASE_X;
  const availTop = BASE_Y - FIT_MARGIN;
  const leftReach = Math.max(1, BASE_X - minX);
  const rightReach = Math.max(1, maxX - BASE_X);
  const topReach = Math.max(1, BASE_Y - minY);
  return Math.min(1, availLeft / leftReach, availRight / rightReach, availTop / topReach);
}

/** Discrete streak tiers for UI copy/badges (the tree itself reacts on a
 *  continuous scale — see streakFactor in TreeAvatar). Not a program rule,
 *  just a display grouping; the real thresholds are Kiron's call. */
export type StreakTier = 'none' | 'bronze' | 'silver' | 'gold';
export function streakTier(streak: number): StreakTier {
  if (streak <= 0) return 'none';
  if (streak < 3) return 'bronze';
  if (streak < 7) return 'silver';
  return 'gold';
}
