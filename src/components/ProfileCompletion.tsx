import React from 'react';

interface CompletionData {
  score: number;
  isReady: boolean;
  missingFields: string[];
}

interface ProfileCompletionProps {
  completion?: CompletionData;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'card' | 'compact';
}

export const ProfileCompletion: React.FC<ProfileCompletionProps> = ({ 
  completion, 
  size = 'md',
  variant = 'card'
}) => {
  if (!completion) return null;

  const { score, isReady, missingFields } = completion;
  
  const getColors = (s: number) => {
    if (s >= 80) return { text: 'text-emerald-400', stroke: 'stroke-emerald-500', bg: 'bg-emerald-500/10' };
    if (s >= 50) return { text: 'text-amber-400', stroke: 'stroke-amber-500', bg: 'bg-amber-500/10' };
    return { text: 'text-red-400', stroke: 'stroke-red-500', bg: 'bg-red-500/10' };
  };

  const colors = getColors(score);
  const radius = size === 'lg' ? 40 : size === 'md' ? 30 : 20;
  const stroke = size === 'lg' ? 8 : size === 'md' ? 6 : 4;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  if (variant === 'compact') {
    return (
      <div className="group relative flex items-center justify-center cursor-help">
        <svg
          height={radius * 2}
          width={radius * 2}
          className="transform -rotate-90"
        >
          <circle
            stroke="rgba(255,255,255,0.05)"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke="currentColor"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            className={`${colors.stroke} transition-all duration-1000 ease-out`}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        <span className={`absolute text-[10px] font-black tabular-nums ${colors.text}`}>
          {score}
        </span>
        
        {/* Tooltip */}
        <div className="absolute top-full mt-2 right-0 w-64 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Profile Strength</span>
              <span className={`text-xs font-black ${colors.text}`}>{score}%</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
              {isReady 
                ? "Your profile is rock-solid. Generation will be high quality." 
                : "Complete your profile to avoid placeholder results."}
            </p>
            {!isReady && missingFields.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {missingFields.map((field, i) => (
                  <span key={i} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-slate-500">
                    + {field}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-card p-6 flex items-center gap-6 ${colors.bg} border-brand-600/20 shadow-xl shadow-brand-500/5`}>
      <div className="relative flex items-center justify-center">
        <svg
          height={radius * 2}
          width={radius * 2}
          className="transform -rotate-90"
        >
          <circle
            stroke="rgba(255,255,255,0.1)"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke="currentColor"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            className={`${colors.stroke} transition-all duration-1000 ease-out`}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        <span className={`absolute ${size === 'lg' ? 'text-2xl' : 'text-xl'} font-black tabular-nums ${colors.text}`}>
          {score}%
        </span>
      </div>

      <div className="flex-1 space-y-1">
        <h4 className="font-bold text-slate-200">Profile Strength</h4>
        <p className="text-sm text-slate-400 leading-tight">
          {isReady 
            ? "Your profile is rock-solid. Generation will be high quality." 
            : "Complete your profile to avoid placeholder results."}
        </p>
        
        {!isReady && missingFields.length > 0 && (
          <div className="pt-2 flex flex-wrap gap-2">
            {missingFields.slice(0, 3).map((field, i) => (
              <span key={i} className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-white/5 rounded border border-white/10 text-slate-500">
                + {field}
              </span>
            ))}
            {missingFields.length > 3 && (
              <span className="text-[10px] font-bold text-slate-600">+{missingFields.length - 3} more</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
