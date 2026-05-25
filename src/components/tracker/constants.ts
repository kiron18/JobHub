import { Star, Send, Clock, Trophy, XCircle } from 'lucide-react';
import type { ApplicationStatus, StatusConfigEntry } from './types';
import { warm } from '../../lib/theme/warmTokens';

export const STATUS_CONFIG: Record<ApplicationStatus, StatusConfigEntry> = {
    SAVED:     { label: 'Saved',     style: { color: warm.colors.textMuted, background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}` },           icon: Star    },
    APPLIED:   { label: 'Applied',   style: { color: warm.colors.accentPetrol, background: 'rgba(45,90,110,0.10)', border: '1px solid rgba(45,90,110,0.30)' },             icon: Send    },
    INTERVIEW: { label: 'Interview', style: { color: warm.colors.accentGold, background: 'rgba(197,160,89,0.10)', border: '1px solid rgba(197,160,89,0.30)' },             icon: Clock   },
    OFFER:     { label: 'Offer',     style: { color: warm.colors.success, background: 'rgba(42,157,111,0.10)', border: '1px solid rgba(42,157,111,0.30)' },                icon: Trophy },
    REJECTED:  { label: 'Rejected',  style: { color: warm.colors.textMuted, background: 'rgba(184,92,92,0.10)', border: '1px solid rgba(184,92,92,0.25)' },                icon: XCircle },
};
