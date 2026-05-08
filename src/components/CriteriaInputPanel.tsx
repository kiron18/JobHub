import { List } from 'lucide-react';

interface CriteriaInputPanelProps {
    criteriaText: string;
    onChange: (text: string) => void;
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

export function CriteriaInputPanel({ criteriaText, onChange, employerFramework }: CriteriaInputPanelProps) {
    const framework = employerFramework ? FRAMEWORK_LABELS[employerFramework] : null;

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
                            'Copy and paste it below',
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
                    placeholder={`Paste your selection criteria here. For example:\n\n1. Demonstrated ability to lead and manage teams in complex environments\n2. Strong communication and stakeholder engagement skills\n3. Proven experience in project management and delivery`}
                    rows={8}
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-300 outline-none focus:border-purple-500 transition-colors resize-none leading-relaxed placeholder:text-slate-600"
                />
            </div>
        </div>
    );
}
