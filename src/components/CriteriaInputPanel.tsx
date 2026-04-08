import { useState } from 'react';
import { List, ChevronDown, ChevronUp } from 'lucide-react';

interface CriteriaInputPanelProps {
    criteriaText: string;
    onChange: (text: string) => void;
    company?: string;
    employerFramework?: string | null;
}

// Parse pasted criteria text into individual items for preview
function parseCriteria(text: string): string[] {
    if (!text.trim()) return [];
    // Match numbered items, bullet points, or lines starting with common SC patterns
    const numbered = text.match(/^\d+[\.\)]\s+.+/gm);
    if (numbered && numbered.length >= 2) return numbered.map(s => s.replace(/^\d+[\.\)]\s+/, '').trim());

    // Try splitting on double newlines
    const blocks = text.split(/\n{2,}/).map(b => b.trim()).filter(b => b.length > 10);
    if (blocks.length >= 2) return blocks;

    // Fallback: split on single newlines for short-form criteria
    return text.split('\n').map(l => l.trim()).filter(l => l.length > 8);
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
    const [showPreview, setShowPreview] = useState(false);
    const parsed = parseCriteria(criteriaText);
    const framework = employerFramework ? FRAMEWORK_LABELS[employerFramework] : null;

    return (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 overflow-hidden mb-4">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/40">
                <div className="flex items-center gap-2">
                    <List size={13} className="text-purple-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selection Criteria</span>
                    {framework && (
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${framework.color}`}>
                            {framework.label}
                        </span>
                    )}
                </div>
                {parsed.length > 0 && (
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        {parsed.length} criteria detected
                        {showPreview ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
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

                {/* Parsed preview */}
                {showPreview && parsed.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Detected criteria — one response will be generated per item</p>
                        {parsed.map((criterion, i) => (
                            <div key={i} className="flex items-start gap-2.5 p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/30">
                                <span className="text-[10px] font-black text-purple-400 mt-0.5 shrink-0 w-4">{i + 1}.</span>
                                <p className="text-[11px] text-slate-300 leading-snug">{criterion}</p>
                            </div>
                        ))}
                    </div>
                )}

                {criteriaText.length > 0 && parsed.length === 0 && (
                    <p className="text-[10px] text-amber-500/70">
                        Couldn't parse individual criteria — the system will still attempt to address any criteria present in the text.
                    </p>
                )}
            </div>
        </div>
    );
}
