import React from 'react';
import { ExternalLink, X } from 'lucide-react';
import { getPlatformConfig } from '../lib/platforms';

export interface ApplyContext {
  jobId: string;
  title: string;
  company: string;
  description: string;
  sourceUrl: string;
  sourcePlatform: string;
}

interface Props {
  context: ApplyContext | null;
  onDismiss: () => void;
}

export const ApplyContextBanner: React.FC<Props> = ({ context, onDismiss }) => {
  if (!context) return null;

  const platform = getPlatformConfig(context.sourcePlatform);

  return (
<<<<<<< HEAD
    <div className="bg-slate-900/70 border-b border-slate-700/50 px-6 py-2 flex items-center justify-between shrink-0">
=======
    <div className="bg-slate-900/70 border-b border-slate-700/50 px-6 py-2 flex items-center justify-between shrink-0">
>>>>>>> 883a55e (feat(ux): Prepare & Apply flow — banner, post-gen panel, I've Applied, tracker link)
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ color: platform.color, background: platform.bg }}
        >
          {platform.label}
        </span>
        <p className="text-xs text-slate-400 truncate">
          <span className="text-slate-200 font-semibold">{context.title}</span>
          {' · '}{context.company}
        </p>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 ml-4">
        <a
          href={context.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-opacity hover:opacity-70"
          style={{ color: platform.color }}
        >
          <ExternalLink size={10} />
          Apply on {platform.label}
        </a>
        <button
          onClick={onDismiss}
          aria-label="Dismiss application context"
          className="text-slate-600 hover:text-slate-400 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
};
