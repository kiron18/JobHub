import { useEffect, useId, useMemo, useRef } from 'react';
import {
  BASE_X, BASE_Y, BRANCH_DUR, LEAF_RENDER_SCALE, BLOSSOM_RENDER_SCALE, SYMBOL_BOX,
  buildTree, clamp, computeFitScale, easeOutCubic, leafPoint, stageName,
  type GrowthTree, type TreePersona,
} from '../../lib/growthTree';

/* ── TreeAvatar ────────────────────────────────────────────────────────
   React port of the growth-tree spec (see docs/growth-tree-reference.html
   for the original, and src/lib/growthTree.ts for the generation math
   this renders). The generation math is pure and declarative; the render
   step stays imperative — same approach as the source artifact — because
   the branch/leaf/fruit counts are data-dependent in a way that doesn't
   map cleanly onto plain JSX without re-deriving the same logic twice.

   Symbol/gradient ids are namespaced with useId() so more than one
   TreeAvatar can be mounted on a page at once (the preview page does
   this) without colliding <defs>.
*/

export interface TreeAvatarProps {
  /** Fixes shape, species and persona. Typically the user id or a stored
   *  per-user random int, so the same person always gets the same tree. */
  seed: number;
  /** 0-90, calendar day in the program. Grows the branch structure. */
  day: number;
  /** Total applications logged — one leaf each. */
  applications: number;
  /** Total interviews landed — one piece of fruit each. */
  interviews: number;
  /** Total outreach sent — one blossom each. Blossom precedes fruit. */
  outreach?: number;
  /** Consecutive active days. Grows flowers, saturates the canopy, lifts
   *  a warm halo. Continuous — for tiered UI copy see streakTier(). */
  streak: number;
  /** Days since the last logged activity. At 7+ the tree is fully asleep. */
  absenceDays: number;
  /** px, square. Default 320. */
  size?: number;
  /** Show the "Day N · Stage name" caption under the tree. Default true. */
  showCaption?: boolean;
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
}

function makeUse(uid: string, symbolId: string, x: number, y: number, rot: number, scale: number): SVGGElement {
  const box = SYMBOL_BOX[symbolId];
  const outer = el('g', { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(1)}) scale(${scale.toFixed(3)})` });
  const inner = el('g', {});
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${uid}-${symbolId}`);
  use.setAttribute('href', `#${uid}-${symbolId}`);
  use.setAttribute('x', String(box[0]));
  use.setAttribute('y', String(box[1]));
  use.setAttribute('width', String(box[2]));
  use.setAttribute('height', String(box[3]));
  inner.appendChild(use);
  outer.appendChild(inner);
  return outer;
}

function buildFace(
  g: SVGGElement, fx: number, fy: number, offX: number, offY: number,
  sleepFactor: number, sparkleFactor: number, persona: TreePersona,
): void {
  const eyeRx = 18.8 - sleepFactor * 1.6;
  const eyeRy = 20.4 * persona.eyeRatio * (1 - sleepFactor * 0.97);
  const blinkDur = `${(5 + sleepFactor * 4.5).toFixed(2)}s`;
  const browLift = 30.8 - sleepFactor * 13;
  const browSpan = 13.6 - sleepFactor * 3.2;
  const eyeY = fy - 4.0;
  const lensR = eyeRx + 3;
  const hasLashes = persona.facialAccessory === 'lashes';
  const hasEarrings = persona.facialAccessory === 'earrings';

  ([-1, 1] as const).forEach(side => {
    const ex = fx + side * 21.2;
    const ey = eyeY;
    let eyeStyle = `transform-origin:${ex.toFixed(1)}px ${ey.toFixed(1)}px;animation-duration:${blinkDur}`;
    if (sleepFactor >= 0.85) eyeStyle += ';animation-play-state:paused';
    const eyeG = el('g', { class: 'gt-eye-blink', style: eyeStyle });
    eyeG.appendChild(el('ellipse', {
      class: 'gt-face-eye', cx: ex, cy: ey, rx: eyeRx, ry: eyeRy,
      transform: `rotate(${(persona.eyeTilt * side).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)})`,
    }));
    const pupilOpacity = sleepFactor >= 0.9 ? 0 : 1;
    const pupilG = el('g', { class: 'gt-pupil-drift', opacity: pupilOpacity });
    pupilG.appendChild(el('circle', { class: 'gt-face-pupil', style: `fill:${persona.eyeColor}`, cx: ex + offX, cy: ey + offY, r: 7.8 }));
    pupilG.appendChild(el('circle', { class: 'gt-face-glint', cx: ex + offX - 3.4, cy: ey + offY - 4.2, r: 2.7 }));
    eyeG.appendChild(pupilG);
    g.appendChild(eyeG);

    if (persona.glasses === 'sunglasses') {
      g.appendChild(el('circle', { cx: ex, cy: ey, r: lensR, fill: 'rgba(28,26,24,0.85)' }));
    } else if (persona.glasses === 'round') {
      g.appendChild(el('circle', { cx: ex, cy: ey, r: lensR, fill: 'none', stroke: persona.hairColor, 'stroke-width': 1.8 }));
    } else if (persona.glasses === 'square') {
      g.appendChild(el('rect', { x: ex - lensR, y: ey - lensR, width: lensR * 2, height: lensR * 2, rx: 6, fill: 'none', stroke: persona.hairColor, 'stroke-width': 1.8 }));
    }
    if (persona.glasses !== 'none') {
      g.appendChild(el('line', { x1: ex + side * lensR, y1: ey, x2: ex + side * (lensR + 7), y2: ey - 1.5, stroke: persona.hairColor, 'stroke-width': 1.6, 'stroke-linecap': 'round' }));
    }

    g.appendChild(el('path', {
      class: 'gt-face-brow',
      d: `M${(ex - browSpan).toFixed(1)} ${(ey - (browLift - 12.6)).toFixed(1)}` +
         ` Q ${ex.toFixed(1)} ${(ey - browLift).toFixed(1)}` +
         ` ${(ex + browSpan).toFixed(1)} ${(ey - (browLift - 12.6)).toFixed(1)}`,
    }));

    if (hasLashes) {
      [-0.5, 0, 0.5].forEach(frac => {
        const bx0 = ex + frac * eyeRx * 0.7, by0 = ey - eyeRy * 0.92;
        g.appendChild(el('line', {
          x1: bx0, y1: by0, x2: bx0 + frac * 4 + side * 2.5, y2: by0 - 7.5,
          stroke: persona.hairColor, 'stroke-width': 1.6, 'stroke-linecap': 'round',
        }));
      });
    }
    if (hasEarrings) {
      const erX = ex + side * (eyeRx + 3), erY = ey + eyeRy * 0.6;
      g.appendChild(el('line', { x1: erX, y1: erY, x2: erX, y2: erY + 4, stroke: persona.accessoryColor, 'stroke-width': 1.3 }));
      g.appendChild(el('circle', { cx: erX, cy: erY + 6.5, r: 2.6, fill: persona.accessoryColor }));
    }

    if (sparkleFactor > 0.01) {
      g.appendChild(el('path', {
        class: 'gt-face-sparkle',
        opacity: Math.min(1, sparkleFactor).toFixed(2),
        d: `M${(ex + side * 14).toFixed(1)} ${(ey - browLift - 13).toFixed(1)}` +
           ` l2.4,5.8 l5.8,2.4 l-5.8,2.4 l-2.4,5.8 l-2.4,-5.8 l-5.8,-2.4 l5.8,-2.4 Z`,
      }));
    }
  });

  if (persona.glasses !== 'none') {
    g.appendChild(el('line', { x1: fx - 8, y1: eyeY, x2: fx + 8, y2: eyeY, stroke: persona.hairColor, 'stroke-width': 1.8 }));
  }

  const mouthY = fy + 18.8;
  g.appendChild(el('ellipse', { class: 'gt-face-mouth', cx: fx, cy: mouthY, rx: 5.8, ry: 7.2 }));

  if (persona.facialAccessory === 'moustache') {
    const my = mouthY - 10;
    g.appendChild(el('path', {
      fill: persona.hairColor,
      d: `M${fx - 22} ${my} Q${fx - 10} ${my - 9} ${fx} ${my}` +
         ` Q${fx + 10} ${my - 9} ${fx + 22} ${my}` +
         ` Q${fx + 10} ${my + 5} ${fx} ${my + 1}` +
         ` Q${fx - 10} ${my + 5} ${fx - 22} ${my} Z`,
    }));
  } else if (persona.facialAccessory === 'beard') {
    const by = mouthY + 6;
    g.appendChild(el('path', {
      fill: persona.hairColor,
      d: `M${fx - 24} ${by - 4} Q${fx} ${by + 34} ${fx + 24} ${by - 4}` +
         ` Q${fx + 16} ${by - 10} ${fx} ${by - 8}` +
         ` Q${fx - 16} ${by - 10} ${fx - 24} ${by - 4} Z`,
    }));
  } else if (persona.facialAccessory === 'bow') {
    const bx = fx + 32, bY = fy - browLift - 12;
    g.appendChild(el('path', { fill: persona.accessoryColor, d: `M${bx} ${bY} L${bx - 10} ${bY - 7} L${bx - 10} ${bY + 7} Z` }));
    g.appendChild(el('path', { fill: persona.accessoryColor, d: `M${bx} ${bY} L${bx + 10} ${bY - 7} L${bx + 10} ${bY + 7} Z` }));
    g.appendChild(el('circle', { cx: bx, cy: bY, r: 3.2, fill: persona.accessoryColor }));
  }

  if (sleepFactor > 0.25) {
    const zOp = Math.min(1, (sleepFactor - 0.25) / 0.5).toFixed(2);
    [{ dx: 24, dy: -40, size: 12, delay: 0 }, { dx: 34, dy: -49, size: 15, delay: 0.7 }, { dx: 45, dy: -60, size: 18, delay: 1.4 }].forEach(z => {
      const t = el('text', { class: 'gt-sleep-z', x: fx + z.dx, y: fy + z.dy, 'font-size': z.size, opacity: zOp, style: `animation-delay:${z.delay}s` });
      t.textContent = 'z';
      g.appendChild(t);
    });
  }
}

export function TreeAvatar({ seed, day, applications, interviews, outreach = 0, streak, absenceDays, size = 320, showCaption = true }: TreeAvatarProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const tree = useMemo<GrowthTree>(() => buildTree(seed), [seed]);
  const fitScale = useMemo(() => computeFitScale(tree), [tree]);

  const treeFitRef = useRef<SVGGElement>(null);
  const treeWholeRef = useRef<SVGGElement>(null);
  const branchesRef = useRef<SVGGElement>(null);
  const leavesRef = useRef<SVGGElement>(null);
  const blossomsRef = useRef<SVGGElement>(null);
  const fruitsRef = useRef<SVGGElement>(null);
  const faceRef = useRef<SVGGElement>(null);
  const flowersRef = useRef<SVGGElement>(null);
  const glowRef = useRef<SVGGElement>(null);
  const captionDayRef = useRef<HTMLSpanElement>(null);
  const captionStageRef = useRef<HTMLSpanElement>(null);
  const captionCountRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (treeFitRef.current) treeFitRef.current.style.transform = `scale(${fitScale.toFixed(4)})`;
  }, [fitScale]);

  useEffect(() => {
    const branchesG = branchesRef.current, leavesG = leavesRef.current, fruitsG = fruitsRef.current;
    const blossomsG = blossomsRef.current;
    const faceG = faceRef.current, flowersG = flowersRef.current, glowG = glowRef.current, wholeG = treeWholeRef.current;
    if (!branchesG || !leavesG || !fruitsG || !blossomsG || !faceG || !flowersG || !glowG || !wholeG) return;

    const t = clamp(day / 90, 0, 1);
    const streakFactor = clamp(streak / 10, 0, 1);
    const sleepFactor = clamp(absenceDays / 7, 0, 1);

    [branchesG, leavesG, blossomsG, fruitsG, faceG, flowersG, glowG].forEach(g => { while (g.firstChild) g.removeChild(g.firstChild); });
    wholeG.classList.toggle('gt-sleepy', sleepFactor >= 0.5);

    const leafSaturate = (1 - sleepFactor * 0.82) * (1 + streakFactor * 0.55);
    const leafBrightness = 1 + sleepFactor * 0.22 - streakFactor * 0.02;
    leavesG.style.filter = `saturate(${leafSaturate.toFixed(2)}) brightness(${leafBrightness.toFixed(2)})`;

    /* How much of each branch is drawn right now, kept so the leaves and
       fruit hanging off it can be placed against the wood that actually
       exists rather than where the branch will eventually end. -1 means
       the branch has not started. */
    const grown = new Float64Array(tree.branches.length).fill(-1);

    tree.branches.forEach((b, bi) => {
      let e2 = 1;
      if (b.birth !== null) {
        const raw = (t - b.birth) / BRANCH_DUR;
        if (raw <= 0) return;
        e2 = easeOutCubic(raw);
      }
      grown[bi] = e2;
      const x2 = b.x1 + (b.x2 - b.x1) * e2, y2 = b.y1 + (b.y2 - b.y1) * e2;
      if (b.taper) {
        const tdx = x2 - b.x1, tdy = y2 - b.y1;
        const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
        const perpX = -tdy / tlen, perpY = tdx / tlen;
        const baseHalf = (b.baseWidth ?? b.width) / 2, topHalf = b.width / 2;
        const p1x = b.x1 - perpX * baseHalf, p1y = b.y1 - perpY * baseHalf;
        const p2x = b.x1 + perpX * baseHalf, p2y = b.y1 + perpY * baseHalf;
        const p3x = x2 + perpX * topHalf, p3y = y2 + perpY * topHalf;
        const p4x = x2 - perpX * topHalf, p4y = y2 - perpY * topHalf;
        branchesG.appendChild(el('path', {
          d: `M${p1x.toFixed(1)} ${p1y.toFixed(1)} L${p2x.toFixed(1)} ${p2y.toFixed(1)} L${p3x.toFixed(1)} ${p3y.toFixed(1)} L${p4x.toFixed(1)} ${p4y.toFixed(1)} Z`,
          fill: b.color,
        }));
        return;
      }
      branchesG.appendChild(el('line', { x1: b.x1, y1: b.y1, x2, y2, stroke: b.color, 'stroke-width': b.width, 'stroke-linecap': 'round' }));
    });

    let newestLeafPos: { x: number; y: number } | null = null;
    let shownLeaves = 0;
    let lastLeafEl: SVGGElement | null = null;
    /* Walk every slot and take the first `applications` whose branch is on
       screen, rather than taking the first `applications` slots and
       dropping the ones that are not. The old form spent the whole budget
       on branches that had not grown — 38 applications rendered as zero
       leaves on day 18. */
    for (let i = 0; i < tree.leafSlots.length && shownLeaves < applications; i++) {
      const slot = tree.leafSlots[i];
      const g = grown[slot.branch];
      if (g < 0) continue;
      const p = leafPoint(tree.branches[slot.branch], slot, g);
      const use = makeUse(uid, 'leafShape', p.x, p.y, slot.rot, LEAF_RENDER_SCALE);
      use.setAttribute('class', 'gt-leaf');
      use.setAttribute('fill', tree.leafColor);
      leavesG.appendChild(use);
      shownLeaves++;
      lastLeafEl = use;
      newestLeafPos = p;
    }
    if (lastLeafEl) (lastLeafEl.firstChild as SVGGElement).classList.add('gt-leaf-newest');

    let shownBlossom = 0;
    let lastBlossomEl: SVGGElement | null = null;
    for (let i = 0; i < tree.blossomSlots.length && shownBlossom < outreach; i++) {
      const slot = tree.blossomSlots[i];
      const g = grown[slot.branch];
      if (g < 0) continue;
      const p = leafPoint(tree.branches[slot.branch], slot, g);
      const use = makeUse(uid, 'blossom', p.x, p.y, slot.rot, BLOSSOM_RENDER_SCALE);
      use.setAttribute('class', 'gt-blossom');
      blossomsG.appendChild(use);
      shownBlossom++;
      lastBlossomEl = use;
    }
    if (lastBlossomEl) (lastBlossomEl.firstChild as SVGGElement).classList.add('gt-leaf-newest');

    let shownFruit = 0;
    let lastFruitEl: SVGGElement | null = null;
    for (let fi = 0; fi < tree.fruitSlots.length && shownFruit < interviews; fi++) {
      const fslot = tree.fruitSlots[fi];
      const fg = grown[fslot.branch];
      if (fg < 0) continue;
      const fb = tree.branches[fslot.branch];
      const fx0 = fb.x1 + (fb.x2 - fb.x1) * fg + fslot.dx;
      const fy0 = fb.y1 + (fb.y2 - fb.y1) * fg + fslot.dy;
      const fuse = makeUse(uid, `fruit-${tree.species}`, fx0, fy0, fslot.rot, fslot.scale);
      fuse.setAttribute('class', 'gt-fruit');
      fruitsG.appendChild(fuse);
      shownFruit++;
      lastFruitEl = fuse;
    }
    if (lastFruitEl) (lastFruitEl.firstChild as SVGGElement).classList.add('gt-fruit-newest');

    const trunk = tree.branches[0];
    const fx = trunk.x1 + (trunk.x2 - trunk.x1) * 0.55;
    const fy = trunk.y1 + (trunk.y2 - trunk.y1) * 0.55;
    let gazeX = 0, gazeY = -1;
    if (newestLeafPos) {
      const dx = newestLeafPos.x - fx, dy = newestLeafPos.y - fy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      gazeX = dx / len; gazeY = dy / len;
    }
    buildFace(faceG, fx, fy, gazeX * 3.2, gazeY * 3.2, sleepFactor, streakFactor, tree.persona);

    if (streakFactor > 0.02) {
      const glowR = 100 + streakFactor * 50;
      glowG.appendChild(el('circle', {
        cx: trunk.x2, cy: trunk.y2 - 20, r: glowR, fill: `url(#${uid}-streakGlowGrad)`,
        opacity: (0.5 + streakFactor * 0.5).toFixed(2), class: 'gt-streak-glow',
      }));
    }

    const flowerCount = Math.min(tree.flowerSlots.length, Math.ceil(streak / 2));
    let lastFlowerEl: SVGGElement | null = null;
    for (let flI = 0; flI < flowerCount; flI++) {
      const fslot2 = tree.flowerSlots[flI];
      flowersG.appendChild(el('line', { x1: fslot2.x, y1: fslot2.y, x2: fslot2.x, y2: fslot2.y - fslot2.stemLen, stroke: '#5FA24C', 'stroke-width': 1.4, 'stroke-linecap': 'round' }));
      const bloom = makeUse(uid, `flower-${tree.flowerSpecies}`, fslot2.x, fslot2.y - fslot2.stemLen, fslot2.rot, fslot2.scale);
      bloom.setAttribute('class', 'gt-flower');
      flowersG.appendChild(bloom);
      lastFlowerEl = bloom;
    }
    if (lastFlowerEl) (lastFlowerEl.firstChild as SVGGElement).classList.add('gt-flower-newest');

    if (captionDayRef.current) captionDayRef.current.textContent = String(Math.floor(day));
    if (captionStageRef.current) captionStageRef.current.textContent = stageName(t);
    if (captionCountRef.current) {
      const parts = [`${shownLeaves}/${applications} leaves`];
      if (outreach > 0) parts.push(`${shownBlossom}/${outreach} blossom`);
      if (interviews > 0) parts.push(`${shownFruit}/${interviews} fruit`);
      captionCountRef.current.textContent = parts.join(' · ');
    }
  }, [tree, uid, day, applications, interviews, outreach, streak, absenceDays]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <style>{`
        .gt-tree-whole{animation:gt-sway 4.5s ease-in-out infinite;}
        .gt-tree-whole.gt-sleepy{animation-play-state:paused;}
        @keyframes gt-sway{0%,100%{transform:rotate(0deg);}50%{transform:rotate(0.7deg);}}
        @keyframes gt-blink{0%,90%,100%{transform:scaleY(1);}93%{transform:scaleY(0.15);}96%{transform:scaleY(1);}}
        @keyframes gt-leafPop{0%{transform:scale(0.25);}70%{transform:scale(1.18);}100%{transform:scale(1);}}
        @keyframes gt-fruitPop{0%{transform:scale(0.15) rotate(-12deg);}55%{transform:scale(1.35) rotate(6deg);}75%{transform:scale(0.92) rotate(-2deg);}100%{transform:scale(1) rotate(0deg);}}
        @keyframes gt-pupilDrift{0%,100%{transform:translate(0,0);}30%{transform:translate(0.7px,-0.4px);}60%{transform:translate(-0.6px,0.3px);}}
        @keyframes gt-sleepFloat{0%{transform:translate(0,0);opacity:0;}18%{opacity:1;}100%{transform:translate(4px,-15px);opacity:0;}}
        @keyframes gt-streakPulse{0%,100%{opacity:0.85;}50%{opacity:1;}}
        .gt-eye-blink{animation:gt-blink 5s ease-in-out infinite;}
        .gt-leaf-newest{animation:gt-leafPop 0.5s ease-out;}
        .gt-fruit-newest{animation:gt-fruitPop 0.6s cubic-bezier(.34,1.56,.64,1);}
        .gt-flower-newest{animation:gt-leafPop 0.55s ease-out;}
        .gt-pupil-drift{animation:gt-pupilDrift 6s ease-in-out infinite;}
        .gt-sleep-z{animation:gt-sleepFloat 2.6s ease-in-out infinite;font-family:inherit;font-weight:600;fill:#5B6C99;}
        .gt-streak-glow{animation:gt-streakPulse 3.2s ease-in-out infinite;}
        .gt-leaf{fill-opacity:0.97;}
        .gt-face-eye{fill:#FFFFFF;stroke:#2A2012;stroke-opacity:0.35;stroke-width:0.9;}
        .gt-face-pupil{fill:#2A2012;}
        .gt-face-glint{fill:#fff;}
        .gt-face-brow{fill:none;stroke:#2A2012;stroke-width:1.6;stroke-linecap:round;}
        .gt-face-mouth{fill:#2A2012;}
        .gt-face-sparkle{fill:#F5C445;}
        @media (prefers-reduced-motion:reduce){
          .gt-tree-whole,.gt-eye-blink,.gt-leaf-newest,.gt-fruit-newest,.gt-flower-newest,.gt-pupil-drift,.gt-sleep-z,.gt-streak-glow{animation:none!important;}
        }
      `}</style>
      <svg viewBox="0 0 600 640" width={size} height={size} role="img" aria-label="Your growth tree">
        <defs>
          <radialGradient id={`${uid}-skyGlow`} cx="50%" cy="42%" r="58%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`${uid}-streakGlowGrad`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F7C948" stopOpacity={0.8} />
            <stop offset="55%" stopColor="#F5B93C" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#F5B93C" stopOpacity={0} />
          </radialGradient>
          <symbol id={`${uid}-flower-dandelion`} viewBox="-6 -6 12 12">
            <g stroke="#F6D34A" strokeWidth={1.6} strokeLinecap="round">
              <line x1="0" y1="0" x2="0" y2="-4.2" /><line x1="0" y1="0" x2="3" y2="-3" />
              <line x1="0" y1="0" x2="4.2" y2="0" /><line x1="0" y1="0" x2="3" y2="3" />
              <line x1="0" y1="0" x2="0" y2="4.2" /><line x1="0" y1="0" x2="-3" y2="3" />
              <line x1="0" y1="0" x2="-4.2" y2="0" /><line x1="0" y1="0" x2="-3" y2="-3" />
            </g>
            <circle cx="0" cy="0" r={1.8} fill="#E8A62A" />
          </symbol>
          <symbol id={`${uid}-flower-marigold`} viewBox="-6 -6 12 12">
            <g fill="#E8791E">
              {[0, 60, 120, 180, 240, 300].map(deg => (
                <ellipse key={deg} rx={1.6} ry={2.3} transform={`rotate(${deg}) translate(0,-2.4)`} />
              ))}
            </g>
            <circle cx="0" cy="0" r={1.6} fill="#B8501A" />
          </symbol>
          <symbol id={`${uid}-flower-daisy`} viewBox="-6 -6 12 12">
            <g fill="#FFFFFF">
              {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                <ellipse key={deg} rx={1.1} ry={3.1} transform={`rotate(${deg}) translate(0,-3)`} />
              ))}
            </g>
            <circle cx="0" cy="0" r={1.7} fill="#F2C230" />
          </symbol>
          {/* Outreach blossom. Five soft petals, deliberately unlike both
              the leaves (green, pointed) and the grass flowers (the seed's
              own species), so three different things never read as one. */}
          <symbol id={`${uid}-blossom`} viewBox="-7 -7 14 14">
            <g fill="#F4B8C8">
              {[0, 72, 144, 216, 288].map(deg => (
                <ellipse key={deg} rx={2.1} ry={3.4} transform={`rotate(${deg}) translate(0,-3.1)`} />
              ))}
            </g>
            <circle cx="0" cy="0" r={1.8} fill="#F2C230" />
          </symbol>
          <symbol id={`${uid}-leafShape`} viewBox="-9 -14 18 28">
            <path d="M0 -14 C 7 -11 8 3 0 14 C -8 3 -7 -11 0 -14 Z" />
            <path className="gt-leaf-vein" d="M0 -9 L0 9" stroke="rgba(0,0,0,0.16)" strokeWidth={1} fill="none" />
          </symbol>
          <symbol id={`${uid}-fruit-apple`} viewBox="-8 -9 16 18">
            <path d="M0,-3 C4,-5 7,-2 7,2 C7,6 3,8 0,7 C-3,8 -7,6 -7,2 C-7,-2 -4,-5 0,-3 Z" fill="#E2483C" />
            <path d="M1,-6 C3,-8 6,-7 6,-5 C4,-5 2,-6 1,-6 Z" fill="#5FA24C" />
            <line x1="0" y1="-3" x2="1" y2="-7" stroke="#6B4A2E" strokeWidth={1.3} strokeLinecap="round" />
          </symbol>
          <symbol id={`${uid}-fruit-banana`} viewBox="-8 -9 16 18">
            <path d="M-6,6 C-7,0 -4,-6 3,-8 C5,-8 6,-7 6,-6 C0,-5 -3,0 -3,6 C-3,7.3 -5,7.3 -6,6 Z" fill="#F3C531" />
            <circle cx="-6" cy="6" r={1} fill="#7A5A2E" />
            <circle cx="5.5" cy="-7" r={1} fill="#7A5A2E" />
          </symbol>
          <symbol id={`${uid}-fruit-pineapple`} viewBox="-8 -10 16 20">
            <ellipse cx="0" cy="2" rx={5} ry={6.2} fill="#D99A2B" />
            <path d="M-3,-1 L3,3 M-3,3 L3,-1 M-3,1 L3,1" stroke="#A8721C" strokeWidth={0.7} />
            <path d="M-2,-5 L-1,-10 L0,-5 Z" fill="#4F8F3F" />
            <path d="M0,-5 L1,-11 L2,-5 Z" fill="#4F8F3F" />
            <path d="M2,-5 L3,-10 L4,-5 Z" fill="#4F8F3F" />
          </symbol>
          <symbol id={`${uid}-fruit-mango`} viewBox="-8 -9 16 18">
            <path d="M-5,3 C-6,-3 -2,-8 3,-7 C7,-6 7,-1 4,4 C1,8 -4,8 -5,3 Z" fill="#E8A33D" />
            <path d="M2,-6 C5,-5 6,-2 5,1 C3,-2 2,-5 2,-6 Z" fill="#C0392B" opacity={0.6} />
            <line x1="2" y1="-7" x2="3" y2="-9" stroke="#6B4A2E" strokeWidth={1.1} strokeLinecap="round" />
          </symbol>
          <symbol id={`${uid}-fruit-orange`} viewBox="-8 -9 16 18">
            <circle cx="0" cy="1" r={6.2} fill="#F2932A" />
            <path d="M0,-5 C2,-7 5,-6 5,-4 C3,-4 1,-5 0,-5 Z" fill="#5FA24C" />
            <line x1="0" y1="-5" x2="0.5" y2="-7.5" stroke="#6B4A2E" strokeWidth={1.1} strokeLinecap="round" />
          </symbol>
          <symbol id={`${uid}-fruit-grapes`} viewBox="-8 -10 16 20">
            <circle cx="-3" cy="-1" r={2.1} fill="#7B4FA0" /><circle cx="1" cy="-1" r={2.1} fill="#8A5CAE" />
            <circle cx="4" cy="1" r={2.1} fill="#7B4FA0" /><circle cx="-1.5" cy="2.5" r={2.1} fill="#8A5CAE" />
            <circle cx="2" cy="4" r={2.1} fill="#7B4FA0" /><circle cx="0" cy="6.5" r={2.1} fill="#8A5CAE" />
            <path d="M0,-3 C2,-6 5,-5 5,-3 C3,-3 1,-3.5 0,-3 Z" fill="#5FA24C" />
          </symbol>
        </defs>

        <ellipse cx="300" cy="320" rx={250} ry={230} fill={`url(#${uid}-skyGlow)`} />
        <ellipse cx="300" cy="590" rx={132} ry={16} fill="#000" opacity={0.06} />
        <ellipse cx="300" cy="576" rx={100} ry={20} fill="#8FAE63" />

        <g ref={treeFitRef} style={{ transformOrigin: `${BASE_X}px ${BASE_Y}px` }}>
          <g ref={glowRef} />
          <g ref={treeWholeRef} className="gt-tree-whole" style={{ transformOrigin: `${BASE_X}px ${BASE_Y}px` }}>
            <g ref={branchesRef} />
            <g ref={faceRef} />
            <g ref={leavesRef} />
            <g ref={blossomsRef} />
            <g ref={fruitsRef} />
          </g>
        </g>
        <g ref={flowersRef} />
      </svg>
      {showCaption && (
        <p style={{ margin: 0, fontFamily: 'inherit', fontWeight: 700, fontSize: 14, textAlign: 'center' }}>
          Day <span ref={captionDayRef}>0</span> · <span ref={captionStageRef}>Bare Sapling</span>
          <br />
          <span ref={captionCountRef} style={{ fontWeight: 500, opacity: 0.65, fontSize: 12 }} />
        </p>
      )}
    </div>
  );
}
