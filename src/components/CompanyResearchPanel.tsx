import { useState, useEffect } from 'react';
import { Search, User, Building2, Edit2, Check, RefreshCw, ExternalLink } from 'lucide-react';
import api from '../lib/api';

export type CandidateConfidence = 'high' | 'medium' | 'low';

export interface HiringContactCandidate {
    name: string;
    title: string | null;
    confidence: CandidateConfidence;
    sourceUrl: string | null;
}

export interface CompanyResearch {
    candidates: HiringContactCandidate[];
    hiringManager: string | null;
    hiringManagerTitle: string | null;
    salutation: string;
    highlights: string[];
    companySize: string;
    loaded: boolean;
}

interface CompanyResearchPanelProps {
    company: string;
    role: string;
    jdText?: string;
    research: CompanyResearch | null;
    onResearchUpdate: (r: CompanyResearch) => void;
}

const CONFIDENCE_LABEL: Record<CandidateConfidence, string> = {
    high: 'High confidence',
    medium: 'Likely match',
    low: 'Possible match',
};
const CONFIDENCE_COLOR: Record<CandidateConfidence, string> = {
    high: '#2A9D6F',
    medium: '#C5A059',
    low: '#8B847B',
};

export function CompanyResearchPanel({ company, role, jdText, research, onResearchUpdate }: CompanyResearchPanelProps) {
    const [loading, setLoading] = useState(false);
    const [salutationEdit, setSalutationEdit] = useState('');
    const [highlightEdit, setHighlightEdit] = useState('');
    const [editingSalutation, setEditingSalutation] = useState(false);
    const [editingHighlight, setEditingHighlight] = useState(false);

    async function runResearch() {
        if (!company || loading) return;
        setLoading(true);
        try {
            const { data } = await api.post('/research/company', {
                company,
                role,
                jdText: jdText ? jdText.slice(0, 8000) : undefined,
            });
            const candidates: HiringContactCandidate[] = Array.isArray(data.candidates)
                ? data.candidates
                    .filter((c: unknown): c is HiringContactCandidate =>
                        !!c && typeof (c as HiringContactCandidate).name === 'string'
                    )
                    .map((c: HiringContactCandidate) => ({
                        name: c.name,
                        title: c.title ?? null,
                        confidence: (c.confidence ?? 'low') as CandidateConfidence,
                        sourceUrl: c.sourceUrl ?? null,
                    }))
                : [];
            const result: CompanyResearch = {
                candidates,
                hiringManager: data.hiringManager ?? null,
                hiringManagerTitle: data.hiringManagerTitle ?? null,
                salutation: data.salutation ?? 'Dear Hiring Manager,',
                highlights: Array.isArray(data.highlights) ? data.highlights : [],
                companySize: data.companySize ?? 'unknown',
                loaded: true,
            };
            onResearchUpdate(result);
            setSalutationEdit(result.salutation);
            setHighlightEdit(result.highlights.join('\n'));
        } catch (err) {
            console.warn('[CompanyResearchPanel] research failed:', err);
            const fallback: CompanyResearch = {
                candidates: [],
                hiringManager: null,
                hiringManagerTitle: null,
                salutation: 'Dear Hiring Manager,',
                highlights: [],
                companySize: 'unknown',
                loaded: true,
            };
            onResearchUpdate(fallback);
            setSalutationEdit(fallback.salutation);
            setHighlightEdit('');
        } finally {
            setLoading(false);
        }
    }

    function selectCandidate(c: HiringContactCandidate) {
        if (!research) return;
        const firstName = c.name.split(/\s+/)[0];
        const newSalutation = `Dear ${firstName},`;
        onResearchUpdate({
            ...research,
            hiringManager: c.name,
            hiringManagerTitle: c.title,
            salutation: newSalutation,
        });
        setSalutationEdit(newSalutation);
    }

    // Auto-run on mount if not yet loaded
    useEffect(() => {
        if (!research?.loaded && company) {
            runResearch();
        } else if (research?.loaded) {
            setSalutationEdit(research.salutation);
            setHighlightEdit(research.highlights.join('\n'));
        }
    }, [company, role]);

    function saveSalutation() {
        if (!research) return;
        onResearchUpdate({ ...research, salutation: salutationEdit.trim() || 'Dear Hiring Manager,' });
        setEditingSalutation(false);
    }

    function saveHighlight() {
        if (!research) return;
        const highlights = highlightEdit.split('\n').map(l => l.trim()).filter(Boolean);
        onResearchUpdate({ ...research, highlights });
        setEditingHighlight(false);
    }

    const sizeLabel: Record<string, string> = {
        startup: 'Startup',
        sme: 'SME',
        enterprise: 'Enterprise',
        government: 'Government',
        education: 'Education',
        nfp: 'Not-for-profit',
        unknown: '',
    };

    return (
        <div className="rounded-xl border border-[rgba(26,24,20,0.10)] bg-white/80 overflow-hidden mb-4">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(26,24,20,0.08)] bg-white/60">
                <div className="flex items-center gap-2">
                    <Search size={13} className="text-brand-400" />
                    <span className="text-[10px] font-black text-[#5C5750] uppercase tracking-widest">Company Research</span>
                    {research?.companySize && research.companySize !== 'unknown' && (
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-brand-600/10 text-brand-400 border border-brand-600/20">
                            {sizeLabel[research.companySize] ?? research.companySize}
                        </span>
                    )}
                </div>
                {research?.loaded && (
                    <button
                        onClick={runResearch}
                        disabled={loading}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-[#8B847B] hover:text-[#1A1814] transition-colors"
                    >
                        <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                        Re-search
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center gap-3 px-4 py-4 text-[#8B847B]">
                    <div className="w-4 h-4 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                    <span className="text-xs font-medium">Researching {company}...</span>
                </div>
            ) : research?.loaded ? (
                <div className="p-4 space-y-3">
                    {/* Salutation */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <User size={11} className="text-[#8B847B]" />
                                <span className="text-[9px] font-black text-[#8B847B] uppercase tracking-widest">Salutation</span>
                            </div>
                            <button
                                onClick={() => setEditingSalutation(!editingSalutation)}
                                className="text-[9px] font-bold text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
                            >
                                <Edit2 size={9} />
                                Edit
                            </button>
                        </div>
                        {editingSalutation ? (
                            <div className="flex gap-2">
                                <input
                                    value={salutationEdit}
                                    onChange={e => setSalutationEdit(e.target.value)}
                                    className="flex-1 bg-[#F4EFE8] border border-[rgba(26,24,20,0.16)] rounded-lg px-3 py-1.5 text-xs text-[#1A1814] outline-none focus:border-brand-500 transition-colors"
                                    placeholder="Dear Hiring Manager,"
                                />
                                <button onClick={saveSalutation} className="p-1.5 bg-brand-600 hover:bg-brand-500 rounded-lg transition-colors">
                                    <Check size={12} className="text-white" />
                                </button>
                            </div>
                        ) : (
                            <p className="text-sm text-[#1A1814] font-medium">{research.salutation}</p>
                        )}
                        {research.candidates && research.candidates.length > 0 && (
                            <div className="pt-2 space-y-1.5">
                                <p className="text-[9px] font-black text-[#8B847B] uppercase tracking-widest">
                                    Suggested contacts ({research.candidates.length})
                                </p>
                                {research.candidates.map((c, i) => {
                                    const isSelected = research.hiringManager === c.name;
                                    return (
                                        <div
                                            key={`${c.name}-${i}`}
                                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border transition-colors"
                                            style={{
                                                background: isSelected ? 'rgba(45,90,110,0.06)' : '#F4EFE8',
                                                borderColor: isSelected ? 'rgba(45,90,110,0.25)' : 'rgba(26,24,20,0.08)',
                                            }}
                                        >
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <span
                                                    aria-hidden
                                                    style={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: '50%',
                                                        background: CONFIDENCE_COLOR[c.confidence],
                                                        flexShrink: 0,
                                                    }}
                                                    title={CONFIDENCE_LABEL[c.confidence]}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] font-bold text-[#1A1814] truncate">
                                                        {c.name}
                                                        {c.title && (
                                                            <span className="font-normal text-[#5C5750]">, {c.title}</span>
                                                        )}
                                                    </p>
                                                    <p className="text-[9px] text-[#8B847B]">
                                                        {CONFIDENCE_LABEL[c.confidence]}, verify before sending
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {c.sourceUrl && (
                                                    <a
                                                        href={c.sourceUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[#8B847B] hover:text-[#1A1814] transition-colors"
                                                        title="Verify on LinkedIn"
                                                        aria-label={`Verify ${c.name} on LinkedIn`}
                                                    >
                                                        <ExternalLink size={11} />
                                                    </a>
                                                )}
                                                {!isSelected && (
                                                    <button
                                                        onClick={() => selectCandidate(c)}
                                                        className="text-[9px] font-bold uppercase tracking-wider text-brand-400 hover:text-brand-300 transition-colors px-1.5 py-0.5 rounded"
                                                        title="Use this contact in the salutation"
                                                    >
                                                        Use
                                                    </button>
                                                )}
                                                {isSelected && (
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#2A9D6F] px-1.5 py-0.5 flex items-center gap-1">
                                                        <Check size={9} /> Selected
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {(!research.candidates || research.candidates.length === 0) && (
                            <p className="text-[10px] text-amber-500/70">
                                No hiring contact found. Check LinkedIn for "{company} {role}" to personalise further.
                            </p>
                        )}
                    </div>

                    {/* Company highlights */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <Building2 size={11} className="text-[#8B847B]" />
                                <span className="text-[9px] font-black text-[#8B847B] uppercase tracking-widest">Company Highlights</span>
                                <span className="text-[9px] text-[#8B847B]">— injected into company connection paragraph</span>
                            </div>
                            <button
                                onClick={() => setEditingHighlight(!editingHighlight)}
                                className="text-[9px] font-bold text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
                            >
                                <Edit2 size={9} />
                                Edit
                            </button>
                        </div>
                        {editingHighlight ? (
                            <div className="space-y-2">
                                <textarea
                                    value={highlightEdit}
                                    onChange={e => setHighlightEdit(e.target.value)}
                                    rows={4}
                                    className="w-full bg-[#F4EFE8] border border-[rgba(26,24,20,0.16)] rounded-lg px-3 py-2 text-xs text-[#1A1814] outline-none focus:border-brand-500 transition-colors resize-none"
                                    placeholder="One highlight per line..."
                                />
                                <button onClick={saveHighlight} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 rounded-lg text-[10px] font-bold text-white transition-colors">
                                    <Check size={10} />
                                    Save
                                </button>
                            </div>
                        ) : research.highlights.length > 0 ? (
                            <ul className="space-y-1">
                                {research.highlights.map((h, i) => (
                                    <li key={i} className="text-xs text-[#1A1814] flex items-start gap-2">
                                        <span className="text-brand-500 mt-0.5 shrink-0">·</span>
                                        {h}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-[10px] text-amber-500/70">
                                No company highlights found — add something specific you know or admire about {company} above.
                            </p>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
