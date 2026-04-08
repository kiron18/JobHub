import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Shield } from 'lucide-react';

export interface DimensionScore {
  score: number;
  grade: string;
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

export interface AustralianFlags {
  apsLevel: string | null;
  requiresCitizenship: boolean;
  securityClearanceRequired: 'none' | 'baseline' | 'nv1' | 'nv2' | 'pv';
  salaryType: 'base' | 'trp' | 'unknown';
}

interface DimensionsIslandProps {
  dimensions: DimensionScores;
  overallGrade: string;
  matchScore: number;
  matchedIdentityCard: string | null;
  australianFlags: AustralianFlags;
}

const GRADE_COLOURS: Record<string, string> = {
  A: 'text-emerald-400',
  B: 'text-brand-400',
  C: 'text-amber-400',
  D: 'text-orange-400',
  F: 'text-red-400',
};

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  roleMatch: 'Role Match',
  skillsAlignment: 'Skills Alignment',
  seniorityFit: 'Seniority Fit',
  compensation: 'Compensation',
  interviewLikelihood: 'Interview Odds',
  geographicFit: 'Geographic Fit',
  companyStage: 'Company Stage',
  marketFit: 'Market Fit',
  growthTrajectory: 'Growth Path',
  timelineAlignment: 'Timeline',
};

const TIERS: Array<{ label: string; keys: Array<keyof DimensionScores> }> = [
  { label: 'GATE-PASS', keys: ['roleMatch', 'skillsAlignment'] },
  { label: 'HIGH WEIGHT', keys: ['seniorityFit', 'compensation', 'interviewLikelihood'] },
  { label: 'MEDIUM WEIGHT', keys: ['geographicFit', 'companyStage', 'marketFit', 'growthTrajectory'] },
  { label: 'LOW WEIGHT', keys: ['timelineAlignment'] },
];

function DimensionRow({ dimKey, dim }: { dimKey: keyof DimensionScores; dim: DimensionScore }) {
  const [hovered, setHovered] = useState(false);
  const filled = dim.score;
  const gradeColour = GRADE_COLOURS[dim.grade] ?? 'text-slate-400';

  return (
    <div
      className="relative flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors hover:bg-slate-800/40 cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="w-36 text-xs text-slate-400 shrink-0">{DIMENSION_LABELS[dimKey]}</span>
      <div className="flex gap-0.5 flex-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= filled ? 'bg-brand-500' : 'bg-slate-700'
            }`}
          />
        ))}
      </div>
      <span className={`text-xs font-black w-5 text-right ${gradeColour}`}>{dim.grade}</span>
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 bottom-full mb-2 z-10 w-64 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-300 shadow-xl pointer-events-none"
          >
            {dim.note}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const DimensionsIsland: React.FC<DimensionsIslandProps> = ({
  dimensions,
  overallGrade,
  matchScore,
  matchedIdentityCard,
  australianFlags,
}) => {
  const [expanded, setExpanded] = useState(false);
  const gradeColour = GRADE_COLOURS[overallGrade] ?? 'text-slate-400';

  const auChips: string[] = [];
  if (australianFlags.apsLevel) auChips.push(australianFlags.apsLevel);
  if (australianFlags.securityClearanceRequired !== 'none') {
    auChips.push(`${australianFlags.securityClearanceRequired.toUpperCase()} clearance`);
  }
  if (australianFlags.salaryType === 'trp') auChips.push('TRP package');
  if (australianFlags.requiresCitizenship) auChips.push('AU citizenship required');

  return (
    <div className="border border-slate-700/50 rounded-2xl bg-slate-900/60 backdrop-blur-sm overflow-hidden mb-4">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Fit Breakdown</span>
          {matchedIdentityCard && (
            <span className="text-xs text-slate-500">· {matchedIdentityCard}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-lg font-black ${gradeColour}`}>{overallGrade}</span>
          <span className="text-xs text-slate-500">{matchScore}/100</span>
          {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-3">
              {TIERS.map(tier => (
                <div key={tier.label}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1 px-2">
                    {tier.label}
                  </p>
                  {tier.keys.map(key => (
                    <DimensionRow key={key} dimKey={key} dim={dimensions[key]} />
                  ))}
                </div>
              ))}

              {auChips.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap px-2 pt-1 border-t border-slate-800">
                  <Shield size={11} className="text-slate-500 shrink-0" />
                  {auChips.map(chip => (
                    <span
                      key={chip}
                      className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
