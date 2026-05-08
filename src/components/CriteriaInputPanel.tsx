import { useState, useEffect, useRef } from 'react';
import { List, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../lib/api';

interface CriteriaInputPanelProps {
    criteriaText: string;
    onChange: (text: string) => void;
    onExtracted: (criteria: string[]) => void;
    company?: string;
    employerFramework?: string | null;
}

const FRAMEWORK_LABELS: Record<string, { label: string; color: string }> = {
    aps_ils: { label: 'APS Integrated Leadership System', color: 'text-blue-400' },
    qld_lc4q: { label: 'Queensland LC4Q Framework', color: 'text-purple-400' },
    nsw_capability: { label: 'NSW Capability Framework', color: 'text-green-400' },
    vic_vpsc: { label: 'Vic VPSC Framework', color: 'text-indigo-400' },
    university_academic: { label: 'University Academic', color: 'text-amber-400' },
    university_professional: { label: 'University Professional (HEW)', color: 'text-amber-400' },
    general: { label: 'General Criteria', color: 'text-slate-400' },
};

export function CriteriaInputPanel({ criteriaText, onChange, onExtracted, employerFramework }: CriteriaInputPanelProps) {
    const framework = employerFramework ? FRAMEWORK_LABELS[employerFramework] : null;
    const [extracting, setExtracting] = useState(false);
    const [extracted, setExtracted] = useState<string[]>([]);
    const [extractError, setExtractError] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastExtractedTextRef = useRef<string>('');

    useEffect(() => {
        if (criteriaText.trim().length < 30) {
            setExtracted([]);
            setExtractError(false);
            onExtracted([]);
            lastExtractedTextRef.current = '';
            return;
        }

        // Don't re-extract if text hasn't changed since last successful extraction (prevents re-fire on remount)
        if (criteriaText === lastExtractedTextRef.current && extracted.length > 0) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setExtracting(true);
            setExtractError(false);
            try {
                const { data } = await api.post('/generate/extract-criteria', { rawText: criteriaText });
                setExtracted(data.criteria);
                onExtracted(data.criteria);
                lastExtractedTextRef.current = criteriaText;
            } catch {
                setExtractError(true);
                setExtracted([]);
                onExtracted([]);
            } finally {
                setExtracting(false);
            }
        }, 600);

        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [criteriaText]);

    return (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 overflow-hidden mb-4">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/40">
                <List size={13} className="text-purple-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selection Criteria</span>
                {framework && (
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${framework.color}`}>
                        {framework.label}
                    </span>
                )}
            </div>

            <div className="p-4 space-y-3">
                {/* Instructions */}
                <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/30 space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">How to find your selection criteria</p>
                    <ol className="space-y-1.5">
                        {[
                            'Go back to the job listing',
                            'Look for any attached Position Description or Application Pack PDF',
                            'Find the selection criteria section',
                            'Copy and paste it below — we\'ll extract the criteria automatically',
                        ].map((step, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <span className="text-[10px] font-black text-purple-400 shrink-0 mt-0.5">{i + 1}.</span>
                                <span className="text-[11px] text-slate-400 leading-snug">{step}</span>
                            </li>
                        ))}
                    </ol>
                </div>

                {/* Textarea */}
                <textarea
                    value={criteriaText}
                    onChange={e => onChange(e.target.value)}
                    placeholder={`Paste the full criteria section here — even the whole position description. We'll extract the criteria automatically.\n\nFor example:\n1. Demonstrated ability to lead and manage teams\n2. Strong communication and stakeholder engagement skills`}
                    rows={8}
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-300 outline-none focus:border-purple-500 transition-colors resize-none leading-relaxed placeholder:text-slate-600"
                />

                {/* Extraction status */}
                {extracting && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <Loader2 size={11} className="animate-spin text-purple-400" />
                        Reading your criteria…
                    </div>
                )}

                {extractError && (
                    <div className="flex items-center gap-2 text-[11px] text-amber-500/80">
                        <AlertCircle size={11} />
                        Couldn't extract criteria automatically — generation will use the raw text.
                    </div>
                )}

                {/* Extracted criteria list */}
                {!extracting && extracted.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 size={12} className="text-emerald-400" />
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                {extracted.length} {extracted.length === 1 ? 'criterion' : 'criteria'} found — one response per item
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            {extracted.map((criterion, i) => (
                                <div key={i} className="flex items-start gap-2.5 p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/30">
                                    <span className="text-[10px] font-black text-purple-400 mt-0.5 shrink-0 w-4">{i + 1}.</span>
                                    <p className="text-[11px] text-slate-300 leading-snug">{criterion}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
