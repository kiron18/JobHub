/**
 * Full-bleed scene illustrations for the diagnostic report cards.
 * Each is a 320×240 origami-polygon scene — character + context + atmosphere.
 * Used at full card size when collapsed, morphs to 44px icon when expanded.
 */

export type OrigamiIcon = React.FC<{ style?: React.CSSProperties }>;

const BASE = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 320 240',
  preserveAspectRatio: 'xMidYMid slice' as const,
};

// ── 1. Targeting ──────────────────────────────────────────────────────────────
// Figure on a hillside, arm extended toward a distant star.
// "Where are you actually aiming?"
export const TargetingIcon: OrigamiIcon = ({ style }) => (
  <svg {...BASE} style={style}>
    {/* Sky */}
    <rect width="320" height="240" fill="#160A00" />
    <polygon points="0,80 320,60 320,240 0,240" fill="#1F1200" />
    {/* Horizon amber glow */}
    <ellipse cx="260" cy="158" rx="60" ry="30" fill="#F59E0B" opacity="0.10" />
    <ellipse cx="260" cy="158" rx="30" ry="15" fill="#FBBF24" opacity="0.14" />
    {/* Hill */}
    <polygon points="0,215 70,188 150,172 210,180 290,198 320,208 320,240 0,240" fill="#2A1600" />
    <polygon points="0,220 70,195 150,178 210,186 290,204 320,214 320,240 0,240" fill="#1C0E00" />
    {/* Distant stars */}
    <polygon points="40,52 43,58 40,64 37,58" fill="#FDE68A" opacity="0.45" />
    <polygon points="158,38 160,43 158,48 156,43" fill="#FDE68A" opacity="0.30" />
    <polygon points="298,68 300,73 298,78 296,73" fill="#FDE68A" opacity="0.35" />
    <polygon points="72,92 74,96 72,100 70,96" fill="#FDE68A" opacity="0.22" />
    {/* THE STAR — target on horizon */}
    <polygon points="258,134 267,147 258,160 249,147" fill="#FEF3C7" />
    <polygon points="258,141 267,147 258,153 249,147" fill="#FBBF24" opacity="0.55" />
    <circle cx="258" cy="147" r="14" fill="#FBBF24" opacity="0.08" />
    {/* Figure — cx=108, ground=188 */}
    <polygon points="108,98 119,111 108,124 97,111" fill="#FDE68A" />
    <polygon points="104,123 112,123 112,130 104,130" fill="#F59E0B" />
    <polygon points="94,130 122,130 119,162 97,162" fill="#F59E0B" />
    <polygon points="122,130 129,137 126,164 119,162" fill="#B45309" />
    {/* Left arm — back */}
    <polygon points="94,134 102,134 100,158 92,158" fill="#D97706" />
    {/* Right arm — BIG REACH toward star */}
    <polygon points="111,132 120,128 250,108 248,120" fill="#FDE68A" />
    {/* Legs */}
    <polygon points="97,162 107,162 105,188 95,188" fill="#D97706" />
    <polygon points="109,162 119,162 117,188 107,188" fill="#B45309" />
    <ellipse cx="108" cy="190" rx="18" ry="4" fill="#000" opacity="0.28" />
  </svg>
);

// ── 2. Document Audit ─────────────────────────────────────────────────────────
// Figure leaning toward an oversized page under a magnifying lens.
// "What are you actually sending out?"
export const DocumentAuditIcon: OrigamiIcon = ({ style }) => (
  <svg {...BASE} style={style}>
    <rect width="320" height="240" fill="#0A0520" />
    <polygon points="0,0 320,0 320,130 0,175" fill="#0E0628" />
    {/* Document shadow */}
    <polygon points="164,74 285,70 290,190 169,194" fill="#1E0A4A" />
    {/* Document body */}
    <polygon points="159,70 280,66 285,186 164,190" fill="#EDE9FE" />
    {/* Dog-ear */}
    <polygon points="280,66 298,84 280,84" fill="#C4B5FD" />
    <polygon points="280,66 298,84 298,66" fill="#6D28D9" opacity="0.5" />
    {/* Text lines */}
    <line x1="176" y1="100" x2="270" y2="97" stroke="#7C3AED" strokeWidth="2.5" opacity="0.35" />
    <line x1="176" y1="113" x2="270" y2="110" stroke="#7C3AED" strokeWidth="2.5" opacity="0.28" />
    <line x1="176" y1="126" x2="270" y2="123" stroke="#7C3AED" strokeWidth="2.5" opacity="0.28" />
    <line x1="176" y1="139" x2="244" y2="136" stroke="#7C3AED" strokeWidth="2.5" opacity="0.28" />
    <line x1="176" y1="155" x2="270" y2="152" stroke="#7C3AED" strokeWidth="2.5" opacity="0.22" />
    <line x1="176" y1="168" x2="270" y2="165" stroke="#7C3AED" strokeWidth="2.5" opacity="0.22" />
    {/* Highlight zone being examined */}
    <polygon points="176,97 270,94 270,142 176,145" fill="#7C3AED" opacity="0.10" />
    {/* Magnifying glass */}
    <circle cx="222" cy="119" r="27" fill="none" stroke="#A78BFA" strokeWidth="3.5" opacity="0.85" />
    <circle cx="222" cy="119" r="25" fill="#DDD6FE" opacity="0.06" />
    <line x1="243" y1="140" x2="259" y2="158" stroke="#A78BFA" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
    {/* Figure — cx=83, ground=192 */}
    <polygon points="86,98 97,112 84,124 73,110" fill="#DDD6FE" />
    <polygon points="81,123 89,123 88,130 80,130" fill="#A78BFA" />
    <polygon points="69,130 97,130 95,162 71,162" fill="#A78BFA" />
    <polygon points="97,130 104,137 102,164 95,162" fill="#5B21B6" />
    {/* Left arm — resting */}
    <polygon points="69,134 77,134 75,160 67,160" fill="#7C3AED" />
    {/* Right arm — reaching toward document */}
    <polygon points="87,132 96,128 160,144 156,158" fill="#C4B5FD" />
    <polygon points="69,162 79,162 77,192 67,192" fill="#6D28D9" />
    <polygon points="85,162 95,162 93,192 83,192" fill="#5B21B6" />
    <ellipse cx="82" cy="194" rx="20" ry="4" fill="#000" opacity="0.32" />
  </svg>
);

// ── 3. Pipeline ────────────────────────────────────────────────────────────────
// Figure watching a glowing funnel — many enter, few exit.
// "Where are applications actually dropping off?"
export const PipelineIcon: OrigamiIcon = ({ style }) => (
  <svg {...BASE} style={style}>
    <rect width="320" height="240" fill="#011408" />
    <polygon points="0,0 320,0 320,115 0,158" fill="#021A0D" />
    {/* Funnel body */}
    <polygon points="178,44 282,44 256,178 204,178" fill="#064E3B" />
    {/* Funnel left highlight */}
    <polygon points="180,44 195,44 169,178 204,178" fill="#10B981" opacity="0.12" />
    {/* Funnel top rim */}
    <polygon points="176,40 284,40 284,50 176,50" fill="#34D399" opacity="0.45" />
    {/* Funnel spout */}
    <polygon points="204,178 256,178 252,196 208,196" fill="#065F46" />
    {/* Entering dots — top (many) */}
    <circle cx="200" cy="62" r="5.5" fill="#34D399" opacity="0.95" />
    <circle cx="218" cy="57" r="5.5" fill="#34D399" opacity="0.95" />
    <circle cx="236" cy="62" r="5.5" fill="#34D399" opacity="0.95" />
    <circle cx="254" cy="57" r="5.5" fill="#34D399" opacity="0.90" />
    <circle cx="268" cy="63" r="4.5" fill="#34D399" opacity="0.75" />
    {/* Mid-funnel (fewer) */}
    <circle cx="214" cy="102" r="5.5" fill="#10B981" opacity="0.80" />
    <circle cx="236" cy="98" r="5.5" fill="#10B981" opacity="0.80" />
    <circle cx="258" cy="102" r="4.5" fill="#10B981" opacity="0.60" />
    {/* Lower funnel (very few) */}
    <circle cx="224" cy="140" r="5.5" fill="#059669" opacity="0.70" />
    <circle cx="244" cy="145" r="4" fill="#059669" opacity="0.50" />
    {/* Exiting (almost none) */}
    <circle cx="230" cy="202" r="4.5" fill="#6EE7B7" opacity="0.80" />
    {/* Lost applications — falling away */}
    <circle cx="156" cy="82" r="4.5" fill="#F43F5E" opacity="0.55" />
    <circle cx="142" cy="102" r="3.5" fill="#F43F5E" opacity="0.38" />
    <circle cx="298" cy="90" r="4.5" fill="#F43F5E" opacity="0.50" />
    <circle cx="310" cy="112" r="3.5" fill="#F43F5E" opacity="0.35" />
    {/* Figure — cx=83, gY=192, observing */}
    <polygon points="83,100 94,113 83,126 72,113" fill="#A7F3D0" />
    <polygon points="79,125 87,125 87,132 79,132" fill="#34D399" />
    <polygon points="67,132 95,132 93,164 69,164" fill="#34D399" />
    <polygon points="95,132 102,138 100,166 93,164" fill="#047857" />
    {/* Both arms raised — observing gesture */}
    <polygon points="67,136 75,129 42,120 44,133" fill="#6EE7B7" />
    <polygon points="83,134 91,128 178,100 176,112" fill="#6EE7B7" />
    <polygon points="69,164 79,164 77,192 67,192" fill="#059669" />
    <polygon points="81,164 91,164 89,192 79,192" fill="#047857" />
    <ellipse cx="82" cy="194" rx="20" ry="4" fill="#000" opacity="0.28" />
  </svg>
);

// ── 4. Honest Assessment ──────────────────────────────────────────────────────
// A figure standing before a tall mirror, facing their reflection.
// "The courage to see clearly."
export const HonestIcon: OrigamiIcon = ({ style }) => (
  <svg {...BASE} style={style}>
    <rect width="320" height="240" fill="#150008" />
    <polygon points="0,0 320,0 320,105 0,152" fill="#1C000E" />
    {/* Mirror frame */}
    <polygon points="200,48 248,48 248,202 200,202" fill="#2D1020" />
    <polygon points="204,52 244,52 244,198 204,198" fill="#3B1229" />
    {/* Mirror surface */}
    <polygon points="208,56 240,56 240,194 208,194" fill="#19060F" />
    <polygon points="208,56 240,56 240,194 208,194" fill="#FB7185" opacity="0.05" />
    {/* Frame top accent */}
    <polygon points="200,48 248,48 248,55 200,55" fill="#9F1239" opacity="0.55" />
    {/* Reflection (inside mirror, lighter) */}
    <polygon points="224,80 233,93 224,106 215,93" fill="#FECDD3" opacity="0.80" />
    <polygon points="220,105 228,105 228,112 220,112" fill="#FDA4AF" opacity="0.75" />
    <polygon points="212,112 236,112 234,144 214,144" fill="#FB7185" opacity="0.65" />
    <polygon points="212,116 220,116 218,140 210,140" fill="#F43F5E" opacity="0.55" />
    <polygon points="226,116 234,116 232,140 224,140" fill="#F43F5E" opacity="0.55" />
    <polygon points="214,144 222,144 220,172 212,172" fill="#BE185D" opacity="0.60" />
    <polygon points="226,144 234,144 232,172 224,172" fill="#9F1239" opacity="0.60" />
    {/* Real figure — cx=92, ground=192 */}
    <polygon points="92,80 103,93 92,106 81,93" fill="#FECDD3" />
    <polygon points="88,105 96,105 96,112 88,112" fill="#FB7185" />
    <polygon points="76,112 104,112 102,144 78,144" fill="#FB7185" />
    <polygon points="104,112 111,118 109,146 102,144" fill="#9F1239" />
    {/* Left arm — slightly open/uncertain */}
    <polygon points="76,116 84,110 60,102 62,116" fill="#FDA4AF" />
    {/* Right arm — reaching toward mirror */}
    <polygon points="94,116 102,112 198,132 196,146" fill="#FECDD3" />
    <polygon points="78,144 88,144 86,192 76,192" fill="#BE185D" />
    <polygon points="92,144 102,144 100,192 90,192" fill="#9F1239" />
    <ellipse cx="90" cy="194" rx="22" ry="5" fill="#000" opacity="0.38" />
    {/* Floor reflection strip */}
    <polygon points="60,210 300,210 300,225 60,225" fill="#FB7185" opacity="0.04" />
  </svg>
);

// ── 5. Fix ────────────────────────────────────────────────────────────────────
// Figure mid-stride climbing three ascending geometric steps toward light.
// "The climb is already underway."
export const FixIcon: OrigamiIcon = ({ style }) => (
  <svg {...BASE} style={style}>
    <rect width="320" height="240" fill="#001818" />
    <polygon points="0,0 320,0 320,115 0,155" fill="#021F1F" />
    {/* Goal light — top right */}
    <ellipse cx="292" cy="38" rx="52" ry="36" fill="#2DD4BF" opacity="0.09" />
    <ellipse cx="292" cy="38" rx="26" ry="18" fill="#5EEAD4" opacity="0.12" />
    <circle cx="292" cy="38" r="9" fill="#CCFBF1" opacity="0.70" />
    {/* Light rays */}
    <line x1="292" y1="26" x2="292" y2="14" stroke="#CCFBF1" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
    <line x1="302" y1="30" x2="310" y2="22" stroke="#CCFBF1" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
    <line x1="282" y1="30" x2="274" y2="22" stroke="#CCFBF1" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
    {/* STEPS */}
    {/* Step 1 */}
    <polygon points="8,192 118,192 118,172 8,172" fill="#0F766E" />
    <polygon points="8,172 118,172 118,166 8,166" fill="#14B8A6" opacity="0.65" />
    <polygon points="8,166 8,192 2,197 2,171" fill="#0D9488" opacity="0.5" />
    {/* Step 2 */}
    <polygon points="98,172 218,172 218,147 98,147" fill="#0D9488" />
    <polygon points="98,147 218,147 218,141 98,141" fill="#2DD4BF" opacity="0.60" />
    <polygon points="98,141 98,172 92,177 92,146" fill="#0F766E" opacity="0.5" />
    {/* Step 3 */}
    <polygon points="198,147 310,147 310,117 198,117" fill="#14B8A6" />
    <polygon points="198,117 310,117 310,111 198,111" fill="#5EEAD4" opacity="0.65" />
    <polygon points="198,111 198,147 192,152 192,116" fill="#0D9488" opacity="0.5" />
    {/* Figure — cx=172, on step 2 (gY=147), striding up */}
    {/* Head */}
    <polygon points="172,57 183,70 172,83 161,70" fill="#CCFBF1" />
    {/* Neck */}
    <polygon points="168,82 176,82 176,89 168,89" fill="#5EEAD4" />
    {/* Torso — leaning forward */}
    <polygon points="158,89 186,89 188,122 160,122" fill="#2DD4BF" />
    <polygon points="186,89 194,96 196,124 188,122" fill="#0F766E" />
    {/* Left arm — RAISED forward toward light */}
    <polygon points="160,93 168,87 232,64 230,78" fill="#CCFBF1" />
    {/* Right arm — back for balance */}
    <polygon points="178,95 186,89 155,75 153,89" fill="#A7F3D0" />
    {/* Left leg — back on step 2 */}
    <polygon points="160,122 170,122 166,147 156,147" fill="#14B8A6" />
    {/* Right leg — stepping UP to step 3 */}
    <polygon points="176,122 186,122 218,118 214,130" fill="#5EEAD4" />
    {/* Right foot landing on step 3 */}
    <polygon points="213,117 230,113 232,122 215,126" fill="#CCFBF1" />
    <ellipse cx="162" cy="149" rx="14" ry="3" fill="#000" opacity="0.22" />
  </svg>
);

// ── 6. What JobHub Does ────────────────────────────────────────────────────────
// Figure with arms open, surrounded by orbital nodes — supported, connected.
// "You're not navigating this alone."
export const WhatJobHubDoesIcon: OrigamiIcon = ({ style }) => (
  <svg {...BASE} style={style}>
    <rect width="320" height="240" fill="#120D00" />
    <polygon points="0,0 320,0 320,125 0,165" fill="#1A1200" />
    {/* Warm ambient glow */}
    <ellipse cx="160" cy="28" rx="125" ry="58" fill="#FBBF24" opacity="0.06" />
    <ellipse cx="160" cy="18" rx="62" ry="32" fill="#FCD34D" opacity="0.08" />
    {/* Orbital connection lines first (behind nodes) */}
    <line x1="65" y1="70" x2="132" y2="102" stroke="#FBBF24" strokeWidth="1" opacity="0.28" />
    <line x1="254" y1="62" x2="192" y2="102" stroke="#FBBF24" strokeWidth="1" opacity="0.28" />
    <line x1="48" y1="138" x2="122" y2="138" stroke="#F59E0B" strokeWidth="1" opacity="0.22" />
    <line x1="278" y1="133" x2="198" y2="138" stroke="#F59E0B" strokeWidth="1" opacity="0.22" />
    <line x1="65" y1="70" x2="48" y2="138" stroke="#FBBF24" strokeWidth="1" opacity="0.14" />
    <line x1="254" y1="62" x2="278" y2="133" stroke="#FBBF24" strokeWidth="1" opacity="0.14" />
    <line x1="78" y1="184" x2="142" y2="172" stroke="#D97706" strokeWidth="1" opacity="0.18" />
    <line x1="244" y1="182" x2="180" y2="172" stroke="#D97706" strokeWidth="1" opacity="0.18" />
    {/* Orbital nodes */}
    <polygon points="58,58 66,68 58,78 50,68" fill="#FCD34D" opacity="0.85" />
    <polygon points="247,52 255,62 247,72 239,62" fill="#FCD34D" opacity="0.85" />
    <polygon points="40,128 48,138 40,148 32,138" fill="#F59E0B" opacity="0.72" />
    <polygon points="270,123 278,133 270,143 262,133" fill="#F59E0B" opacity="0.72" />
    <polygon points="70,178 76,186 70,194 64,186" fill="#D97706" opacity="0.62" />
    <polygon points="238,176 244,184 238,192 232,184" fill="#D97706" opacity="0.62" />
    {/* Halo behind figure */}
    <ellipse cx="160" cy="118" rx="42" ry="52" fill="#FBBF24" opacity="0.04" />
    {/* Figure — cx=160, ground=192, arms wide open */}
    <polygon points="160,60 171,73 160,86 149,73" fill="#FEF3C7" />
    <polygon points="156,85 164,85 164,92 156,92" fill="#FCD34D" />
    <polygon points="144,92 176,92 174,128 146,128" fill="#FCD34D" />
    <polygon points="176,92 183,99 181,130 174,128" fill="#D97706" />
    {/* Left arm — open wide, slightly up */}
    <polygon points="144,96 152,90 96,78 98,93" fill="#FEF3C7" />
    {/* Right arm — open wide, slightly up */}
    <polygon points="168,96 176,90 226,76 224,91" fill="#FEF3C7" />
    {/* Legs */}
    <polygon points="146,128 156,128 152,192 142,192" fill="#D97706" />
    <polygon points="164,128 174,128 170,192 160,192" fill="#B45309" />
    <ellipse cx="159" cy="194" rx="24" ry="5" fill="#000" opacity="0.32" />
  </svg>
);
