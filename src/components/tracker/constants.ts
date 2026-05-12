import { Star, Send, Clock, Trophy, XCircle } from 'lucide-react';
import type { ApplicationStatus, StatusConfigEntry } from './types';

export const STATUS_CONFIG: Record<ApplicationStatus, StatusConfigEntry> = {
    SAVED:     { label: 'Saved',     color: 'text-slate-400 bg-slate-800 border-slate-700',           icon: Star    },
    APPLIED:   { label: 'Applied',   color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',         icon: Send    },
    INTERVIEW: { label: 'Interview', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',      icon: Clock   },
    OFFER:     { label: 'Offer',     color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: Trophy },
    REJECTED:  { label: 'Rejected',  color: 'text-slate-400 bg-slate-500/10 border-slate-500/25',      icon: XCircle },
};
