/**
 * Origami-style SVG icons for the diagnostic report.
 * Each icon uses flat-shaded polygon faces to suggest a folded paper form.
 * Colors are warm and hopeful — amber, violet, emerald, rose, teal, gold.
 */

export type OrigamiIcon = React.FC<{ size?: number }>;

/** Targeting — faceted diamond gem: clarity of direction */
export const TargetingIcon: OrigamiIcon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* 4 triangular faces meeting at centre */}
    <polygon points="24,3 45,24 24,24"  fill="#FBBF24" />
    <polygon points="45,24 24,45 24,24" fill="#D97706" />
    <polygon points="24,45 3,24 24,24"  fill="#92400E" />
    <polygon points="3,24 24,3 24,24"   fill="#F59E0B" />
    {/* Centre highlight */}
    <circle cx="24" cy="24" r="3" fill="#FEF3C7" opacity="0.7" />
  </svg>
);

/** Document Audit — folded page with dog-ear: craftsmanship, examination */
export const DocumentAuditIcon: OrigamiIcon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Page body */}
    <polygon points="8,4 32,4 32,20 40,20 40,46 8,46" fill="#4C1D95" />
    {/* Dog-ear fold */}
    <polygon points="32,4 40,12 40,20 32,20" fill="#7C3AED" />
    {/* Fold crease shadow */}
    <polygon points="32,4 40,12 32,12" fill="#2E1065" />
    {/* Text line accents */}
    <line x1="13" y1="22" x2="34" y2="22" stroke="#A78BFA" strokeWidth="1.5" opacity="0.55" />
    <line x1="13" y1="28" x2="34" y2="28" stroke="#A78BFA" strokeWidth="1.5" opacity="0.4"  />
    <line x1="13" y1="34" x2="26" y2="34" stroke="#A78BFA" strokeWidth="1.5" opacity="0.4"  />
    {/* Corner shine */}
    <polygon points="32,4 38,10 32,10" fill="#DDD6FE" opacity="0.25" />
  </svg>
);

/** Pipeline — three ascending parallelogram bars: momentum, flow */
export const PipelineIcon: OrigamiIcon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Bar 1 — shortest, bottom */}
    <polygon points="2,44 16,44 18,38 4,38"  fill="#065F46" />
    <polygon points="2,44 4,38 4,32 2,38"    fill="#047857" />
    <polygon points="4,38 18,38 18,32 4,32"  fill="#10B981" />
    {/* Bar 2 — medium, mid */}
    <polygon points="16,44 30,44 32,38 18,38" fill="#047857" />
    <polygon points="16,44 18,38 18,26 16,32" fill="#059669" />
    <polygon points="18,38 32,38 32,26 18,26" fill="#34D399" />
    {/* Bar 3 — tallest, top */}
    <polygon points="30,44 44,44 46,38 32,38" fill="#065F46" />
    <polygon points="30,44 32,38 32,14 30,20" fill="#047857" />
    <polygon points="32,38 46,38 46,14 32,14" fill="#6EE7B7" />
  </svg>
);

/** Honest Assessment — geometric eye: courage to see clearly */
export const HonestIcon: OrigamiIcon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Eye outer — two triangular halves */}
    <polygon points="4,24 24,10 44,24 24,38" fill="#9F1239" />
    {/* Upper-left face */}
    <polygon points="4,24 24,10 24,24" fill="#FB7185" />
    {/* Upper-right face */}
    <polygon points="24,10 44,24 24,24" fill="#F43F5E" />
    {/* Lower-right face */}
    <polygon points="44,24 24,38 24,24" fill="#BE185D" />
    {/* Lower-left face */}
    <polygon points="24,38 4,24 24,24" fill="#9F1239"  />
    {/* Iris */}
    <circle cx="24" cy="24" r="8"   fill="#E11D48" />
    {/* Pupil */}
    <circle cx="24" cy="24" r="4"   fill="#1C0A0A" />
    {/* Shine */}
    <circle cx="27" cy="21" r="2.2" fill="#FFF1F2" opacity="0.65" />
  </svg>
);

/** Fix — three ascending peaks: progress, the climb up */
export const FixIcon: OrigamiIcon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Peak 1 — small, left */}
    <polygon points="4,42 14,26 24,42"  fill="#0F766E" />
    <polygon points="4,42 14,26 9,42"   fill="#134E4A" />
    {/* Peak 2 — medium, centre */}
    <polygon points="16,42 28,16 38,42" fill="#14B8A6" />
    <polygon points="16,42 28,16 22,42" fill="#0D9488" />
    {/* Peak 3 — tall, right */}
    <polygon points="30,42 40,6 46,42"  fill="#2DD4BF" />
    <polygon points="30,42 40,6 38,42"  fill="#14B8A6" />
    {/* Ground horizon */}
    <line x1="3" y1="42" x2="45" y2="42" stroke="#5EEAD4" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    {/* Summit star */}
    <circle cx="40" cy="6" r="2.5" fill="#CCFBF1" opacity="0.85" />
  </svg>
);

/** What JobHub Does — hexagonal shield with facets: partnership, protection */
export const WhatJobHubDoesIcon: OrigamiIcon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Shield base */}
    <polygon points="24,4 40,12 40,30 24,44 8,30 8,12" fill="#78350F" />
    {/* Six triangular faces from centre */}
    <polygon points="24,4 40,12 24,24"  fill="#FBBF24" />
    <polygon points="40,12 40,30 24,24" fill="#F59E0B" />
    <polygon points="40,30 24,44 24,24" fill="#D97706" />
    <polygon points="24,44 8,30 24,24"  fill="#B45309" />
    <polygon points="8,30 8,12 24,24"   fill="#D97706" />
    <polygon points="8,12 24,4 24,24"   fill="#FCD34D" />
    {/* Centre gem */}
    <circle cx="24" cy="24" r="4.5" fill="#FEF9C3" />
    <circle cx="25.5" cy="22.5" r="1.5" fill="white" opacity="0.7" />
  </svg>
);
