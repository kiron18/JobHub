import React from 'react';

export interface SceneIconProps {
  style?: React.CSSProperties;
  isDark: boolean;
}

export type SceneIcon = (props: SceneIconProps) => React.JSX.Element;

// ─── TARGETING ──────────────────────────────────────────────────────────────
// Radar: concentric rings, crosshair, single highlighted blip
export function TargetingIcon({ style, isDark }: SceneIconProps): React.JSX.Element {
  const bg = isDark ? '#130e00' : '#fffef5';
  const ac = '#FBBF24';
  const s  = (o: number) => `rgba(251,191,36,${o})`;

  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice"
         style={{ width: '100%', height: '100%', display: 'block', ...style }}>
      <rect width="400" height="240" fill={bg} />
      <line x1="200" y1="0"   x2="200" y2="240" stroke={s(0.07)} strokeWidth="1" />
      <line x1="0"   y1="178" x2="400" y2="178" stroke={s(0.07)} strokeWidth="1" />
      <circle cx="200" cy="178" r="196" fill="none" stroke={s(0.05)} strokeWidth="1" />
      <circle cx="200" cy="178" r="140" fill="none" stroke={s(0.09)} strokeWidth="1" />
      <circle cx="200" cy="178" r="92"  fill="none" stroke={s(0.14)} strokeWidth="1.5" />
      <circle cx="200" cy="178" r="50"  fill="none" stroke={s(0.22)} strokeWidth="1.5" />
      <line x1="200" y1="178" x2="276" y2="86" stroke={ac} strokeWidth="1.5" opacity="0.32" />
      <circle cx="276" cy="86" r="28" fill={s(isDark ? 0.10 : 0.12)} />
      <circle cx="276" cy="86" r="18" fill="none" stroke={s(0.30)} strokeWidth="1.5" />
      <circle cx="276" cy="86" r="28" fill="none" stroke={s(0.14)} strokeWidth="1" />
      <circle cx="276" cy="86" r="9" fill={ac} />
      <circle cx="143" cy="128" r="5" fill={s(0.32)} />
      <circle cx="200" cy="178" r="3" fill={s(0.30)} />
    </svg>
  );
}

// ─── DOCUMENT AUDIT ─────────────────────────────────────────────────────────
// Document with page-fold + magnifying glass, two highlight lines
export function DocumentAuditIcon({ style, isDark }: SceneIconProps): React.JSX.Element {
  const bg      = isDark ? '#100c1a' : '#faf8ff';
  const ac      = '#A78BFA';
  const s       = (o: number) => `rgba(167,139,250,${o})`;
  const docFill = isDark ? s(0.05)  : 'rgba(255,255,255,0.95)';
  const docStrk = isDark ? s(0.18)  : s(0.28);
  const lineC   = isDark ? s(0.09)  : 'rgba(110,90,180,0.10)';
  const hiLine  = isDark ? s(0.60)  : s(0.68);
  const hiBlock = isDark ? s(0.12)  : s(0.16);
  const lensFill= isDark ? 'rgba(16,12,26,0.50)' : 'rgba(255,255,255,0.55)';
  const lensGl  = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.72)';

  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice"
         style={{ width: '100%', height: '100%', display: 'block', ...style }}>
      <rect width="400" height="240" fill={bg} />
      <rect x="86" y="24" width="162" height="207" rx="7"
            fill={isDark ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.04)'} />
      <rect x="82" y="20" width="162" height="207" rx="7"
            fill={docFill} stroke={docStrk} strokeWidth="1.5" />
      <path d="M 216 20 L 244 48 L 216 48 Z" fill={isDark ? s(0.14) : s(0.10)} />
      <path d="M 216 20 L 244 48" fill="none" stroke={docStrk} strokeWidth="1" />
      <rect x="100" y="38" width="84" height="7" rx="2" fill={s(isDark ? 0.50 : 0.55)} />
      <rect x="100" y="50" width="54" height="4" rx="2" fill={s(isDark ? 0.22 : 0.26)} />
      <rect x="100" y="66"  width="126" height="4" rx="2" fill={lineC} />
      <rect x="100" y="76"  width="108" height="4" rx="2" fill={lineC} />
      <rect x="96"  y="88"  width="134" height="14" rx="3" fill={hiBlock} />
      <rect x="100" y="92"  width="116" height="4"  rx="2" fill={hiLine} />
      <rect x="100" y="112" width="126" height="4" rx="2" fill={lineC} />
      <rect x="100" y="122" width="92"  height="4" rx="2" fill={lineC} />
      <rect x="96"  y="134" width="134" height="14" rx="3" fill={hiBlock} />
      <rect x="100" y="138" width="102" height="4"  rx="2" fill={hiLine} />
      <rect x="100" y="158" width="126" height="4" rx="2" fill={lineC} />
      <rect x="100" y="168" width="70"  height="4" rx="2" fill={lineC} />
      <rect x="100" y="178" width="110" height="4" rx="2" fill={lineC} />
      <circle cx="302" cy="106" r="52" fill="none" stroke={ac} strokeWidth="3" />
      <circle cx="302" cy="106" r="48" fill={lensFill} />
      <line x1="338" y1="142" x2="366" y2="170" stroke={ac} strokeWidth="5" strokeLinecap="round" />
      <circle cx="288" cy="91" r="9" fill="none" stroke={lensGl} strokeWidth="2" />
    </svg>
  );
}

// ─── PIPELINE ────────────────────────────────────────────────────────────────
// Funnel: many candidates in, three narrowing tiers, one output drop
export function PipelineIcon({ style, isDark }: SceneIconProps): React.JSX.Element {
  const bg      = isDark ? '#001a0f' : '#f0fdf9';
  const ac      = '#34D399';
  const s       = (o: number) => `rgba(52,211,153,${o})`;
  const entries = [50, 100, 152, 200, 248, 300, 350];

  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice"
         style={{ width: '100%', height: '100%', display: 'block', ...style }}>
      <rect width="400" height="240" fill={bg} />
      {entries.map((x, i) => (
        <React.Fragment key={i}>
          <line x1={x} y1="30" x2="200" y2="68" stroke={s(i < 5 ? 0.18 : 0.08)} strokeWidth="1" />
          <circle cx={x} cy="24" r={i < 5 ? 5 : 4} fill={s(i < 5 ? 0.48 : 0.18)} />
        </React.Fragment>
      ))}
      <path d="M 50 58 L 350 58 L 268 118 L 132 118 Z"
            fill={s(isDark ? 0.06 : 0.08)} stroke={s(isDark ? 0.18 : 0.22)}
            strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 132 118 L 268 118 L 242 166 L 158 166 Z"
            fill={s(isDark ? 0.10 : 0.13)} stroke={s(isDark ? 0.24 : 0.28)}
            strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 158 166 L 242 166 L 222 210 L 178 210 Z"
            fill={s(isDark ? 0.16 : 0.20)} stroke={ac}
            strokeWidth="2" strokeLinejoin="round" />
      <line x1="200" y1="210" x2="200" y2="226" stroke={ac} strokeWidth="2.5" />
      <circle cx="200" cy="234" r="8" fill={ac} />
    </svg>
  );
}

// ─── THE HONEST TRUTH ────────────────────────────────────────────────────────
// Standing mirror with soft reflection — the truth, clearly seen
export function HonestIcon({ style, isDark }: SceneIconProps): React.JSX.Element {
  const bg      = isDark ? '#1a060c' : '#fff5f7';
  const ac      = '#FB7185';
  const s       = (o: number) => `rgba(251,113,133,${o})`;
  const mirrorF = isDark ? s(0.06)  : 'rgba(255,255,255,0.78)';
  const reflF   = isDark ? s(0.10)  : s(0.12);
  const reflS   = isDark ? s(0.28)  : s(0.32);
  const glareC  = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.72)';
  const arcC    = isDark ? s(0.28)  : s(0.34);

  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice"
         style={{ width: '100%', height: '100%', display: 'block', ...style }}>
      <rect width="400" height="240" fill={bg} />
      <ellipse cx="200" cy="148" rx="128" ry="96" fill={s(isDark ? 0.06 : 0.07)} />
      <ellipse cx="204" cy="124" rx="62"  ry="80"
               fill={isDark ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.04)'} />
      <ellipse cx="200" cy="120" rx="60" ry="78" fill={mirrorF} stroke={ac} strokeWidth="2.5" />
      <ellipse cx="200" cy="116" rx="36" ry="48" fill={reflF}   stroke={reflS} strokeWidth="1.5" />
      <ellipse cx="184" cy="94"  rx="9"  ry="14" fill="none"    stroke={glareC} strokeWidth="2" />
      <path d="M 154 78 Q 200 46 246 78" fill="none" stroke={arcC} strokeWidth="2" />
      <line x1="200" y1="198" x2="200" y2="218" stroke={ac} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="172" y1="218" x2="228" y2="218" stroke={ac} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── YOUR 3-STEP FIX ────────────────────────────────────────────────────────
// Three ascending steps with dashed path and upward arrow
export function FixIcon({ style, isDark }: SceneIconProps): React.JSX.Element {
  const bg = isDark ? '#001716' : '#f0fffe';
  const ac = '#5EEAD4';
  const s  = (o: number) => `rgba(94,234,212,${o})`;

  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice"
         style={{ width: '100%', height: '100%', display: 'block', ...style }}>
      <rect width="400" height="240" fill={bg} />
      <line x1="55" y1="208" x2="345" y2="208" stroke={s(isDark ? 0.12 : 0.15)} strokeWidth="1.5" />
      <path d="M 109 171 Q 153 140 197 119 Q 241 98 285 64"
            fill="none" stroke={s(isDark ? 0.20 : 0.25)} strokeWidth="1.5" strokeDasharray="5 3" />
      {/* Step 1 */}
      <rect x="65" y="172" width="88" height="36" rx="5"
            fill={s(isDark ? 0.10 : 0.13)} stroke={s(isDark ? 0.22 : 0.28)} strokeWidth="1.5" />
      <circle cx="109" cy="190" r="10" fill={s(isDark ? 0.38 : 0.42)} />
      {/* Step 2 */}
      <rect x="153" y="120" width="88" height="88" rx="5"
            fill={s(isDark ? 0.16 : 0.20)} stroke={s(isDark ? 0.30 : 0.36)} strokeWidth="1.5" />
      <circle cx="197" cy="160" r="10" fill={s(isDark ? 0.56 : 0.62)} />
      {/* Step 3 */}
      <rect x="241" y="65" width="88" height="143" rx="5"
            fill={s(isDark ? 0.22 : 0.28)} stroke={ac} strokeWidth="2" />
      <circle cx="285" cy="136" r="10" fill={ac} />
      {/* Arrow */}
      <line x1="285" y1="64" x2="285" y2="26" stroke={s(isDark ? 0.45 : 0.52)} strokeWidth="2" />
      <polygon points="285,18 278,30 292,30" fill={s(isDark ? 0.45 : 0.52)} />
    </svg>
  );
}

// ─── WHAT JOBHUB DOES FOR YOU ────────────────────────────────────────────────
// Compass: outer ring, cardinal ticks, diamond needle pointing NE
export function WhatJobHubDoesIcon({ style, isDark }: SceneIconProps): React.JSX.Element {
  const bg = isDark ? '#141000' : '#fffef0';
  const ac = '#FCD34D';
  const s  = (o: number) => `rgba(252,211,77,${o})`;
  const cx = 200, cy = 125, R = 92;

  const mkTick = (deg: number, r1: number, r2: number) => {
    const a = (deg - 90) * Math.PI / 180;
    return { x1: cx + r1 * Math.cos(a), y1: cy + r1 * Math.sin(a),
             x2: cx + r2 * Math.cos(a), y2: cy + r2 * Math.sin(a) };
  };

  // NE needle — 45° clockwise from north; unit vec = (sin45, -cos45) = (0.7071, -0.7071)
  const tipX  = cx + 72 * 0.7071;
  const tipY  = cy - 72 * 0.7071;
  const tailX = cx - 50 * 0.7071;
  const tailY = cy + 50 * 0.7071;
  const W = 7;
  // Perpendicular unit (90° CW from NE) = (cos45, sin45) = (0.7071, 0.7071)
  const s1x = cx + W * 0.7071, s1y = cy + W * 0.7071;
  const s2x = cx - W * 0.7071, s2y = cy - W * 0.7071;

  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice"
         style={{ width: '100%', height: '100%', display: 'block', ...style }}>
      <rect width="400" height="240" fill={bg} />
      <circle cx={cx} cy={cy} r={R + 9} fill="none" stroke={s(isDark ? 0.16 : 0.20)} strokeWidth="1" />
      <circle cx={cx} cy={cy} r={R}     fill={s(isDark ? 0.05 : 0.06)} stroke={s(isDark ? 0.14 : 0.17)} strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={R - 14} fill="none" stroke={s(isDark ? 0.08 : 0.10)} strokeWidth="1" />
      {[0, 90, 180, 270].map(d => {
        const t = mkTick(d, R - 18, R);
        return <line key={d} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                     stroke={s(isDark ? 0.40 : 0.48)} strokeWidth="2.5" />;
      })}
      {[45, 135, 225, 315].map(d => {
        const t = mkTick(d, R - 10, R);
        return <line key={d} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                     stroke={s(isDark ? 0.18 : 0.22)} strokeWidth="1.5" />;
      })}
      {/* Needle NE half (accent) */}
      <polygon points={`${tipX},${tipY} ${s1x},${s1y} ${cx},${cy} ${s2x},${s2y}`} fill={ac} />
      {/* Needle SW half (muted) */}
      <polygon points={`${s1x},${s1y} ${tailX},${tailY} ${s2x},${s2y} ${cx},${cy}`}
               fill={s(isDark ? 0.26 : 0.30)} />
      <circle cx={cx} cy={cy} r="9" fill={bg} stroke={ac} strokeWidth="2" />
      <circle cx={cx} cy={cy} r="4" fill={ac} />
    </svg>
  );
}
