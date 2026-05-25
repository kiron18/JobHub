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
    <div className="bg-white/85 border-b border-[rgba(26,24,20,0.10)] px-6 py-2 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ color: platform.color, background: platform.bg }}
        >
          {platform.label}
        </span>
        <p className="text-xs text-[#5C5750] truncate">
          <span className="text-[#1A1814] font-semibold">{context.title}</span>
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
          className="text-[#8B847B] hover:text-[#5C5750] transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
};
