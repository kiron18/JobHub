import React from 'react';
import { ChevronRight } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';

interface PipelineCounts {
    APPLIED: number;
    INTERVIEW: number;
    OFFER: number;
    REJECTED: number;
}

interface PipelineFunnelProps {
    counts: PipelineCounts;
}

export const PipelineFunnel: React.FC<PipelineFunnelProps> = ({ counts }) => {
    return (
        <div style={{
            background: warm.colors.bgSurface,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 18, padding: 20, overflow: 'hidden',
        }}>
            <p style={{ margin: '0 0 16px', fontSize: 10, fontWeight: 800, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pipeline Funnel</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {/* Applied */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <div style={{ width: '100%', borderRadius: 4, background: 'rgba(45,90,110,0.12)', border: '1px solid rgba(45,90,110,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44 }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: warm.colors.accentPetrol, fontVariantNumeric: 'tabular-nums' }}>{counts.APPLIED}</span>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 9, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Applied</p>
                </div>
                {/* Arrow + rate */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: warm.colors.textMuted }}>
                        {counts.APPLIED > 0 ? `${Math.round((counts.INTERVIEW / Math.max(counts.APPLIED, 1)) * 100)}%` : '—'}
                    </span>
                    <ChevronRight size={14} style={{ color: warm.colors.borderDefined }} />
                </div>
                {/* Interview */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <div style={{ width: '100%', borderRadius: 4, background: 'rgba(197,160,89,0.14)', border: '1px solid rgba(197,160,89,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: Math.max(28, counts.APPLIED > 0 ? Math.round(44 * counts.INTERVIEW / Math.max(counts.APPLIED, 1)) : 28) }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: warm.colors.accentGold, fontVariantNumeric: 'tabular-nums' }}>{counts.INTERVIEW}</span>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 9, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Interview</p>
                </div>
                {/* Arrow + rate */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: warm.colors.textMuted }}>
                        {counts.INTERVIEW > 0 ? `${Math.round((counts.OFFER / Math.max(counts.INTERVIEW, 1)) * 100)}%` : '—'}
                    </span>
                    <ChevronRight size={14} style={{ color: warm.colors.borderDefined }} />
                </div>
                {/* Offer */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <div style={{ width: '100%', borderRadius: 4, background: 'rgba(42,157,111,0.12)', border: '1px solid rgba(42,157,111,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: Math.max(20, counts.APPLIED > 0 ? Math.round(44 * counts.OFFER / Math.max(counts.APPLIED, 1)) : 20) }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: counts.OFFER > 0 ? warm.colors.success : warm.colors.textMuted, fontVariantNumeric: 'tabular-nums' }}>{counts.OFFER}</span>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 9, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Offer</p>
                </div>
                {/* Rejected aside */}
                {counts.REJECTED > 0 && (
                    <>
                        <div style={{ width: 1, height: 40, background: warm.colors.borderWhisper, margin: '0 12px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ padding: '2px 10px', borderRadius: 4, background: 'rgba(184,92,92,0.10)', border: '1px solid rgba(184,92,92,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: 14, fontWeight: 800, color: warm.colors.danger, fontVariantNumeric: 'tabular-nums' }}>{counts.REJECTED}</span>
                            </div>
                            <p style={{ margin: '6px 0 0', fontSize: 9, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rejected</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
