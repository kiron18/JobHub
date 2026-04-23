import { useState, useEffect } from 'react';
import { Search, User, Building2, Edit2, Check, RefreshCw } from 'lucide-react';
import api from '../lib/api';

export interface CompanyResearch {
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
    research: CompanyResearch | null;
    onResearchUpdate: (r: CompanyResearch) => void;
}

export function CompanyResearchPanel({ company, role, research, onResearchUpdate }: CompanyResearchPanelProps) {
    const [loading, setLoading] = useState(false);
    const [salutationEdit, setSalutationEdit] = useState('');
    const [highlightEdit, setHighlightEdit] = useState('');
    const [editingSalutation, setEditingSalutation] = useState(false);
    const [editingHighlight, setEditingHighlight] = useState(false);

    async function runResearch() {
        if (!company || loading) return;
        setLoading(true);
        try {
            const { data } = await api.post('/research/company', { company, role });
            const result: CompanyResearch = {
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
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 overflow-hidden mb-4">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/40">
                <div className="flex items-center gap-2">
                    <Search size={13} className="text-brand-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Company Research</span>
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
                        className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                        Re-search
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center gap-3 px-4 py-4 text-slate-500">
                    <div className="w-4 h-4 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                    <span className="text-xs font-medium">Researching {company}...</span>
                </div>
            ) : research?.loaded ? (
                <div className="p-4 space-y-3">
                    {/* Salutation */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <User size={11} className="text-slate-500" />
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Salutation</span>
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
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-brand-500 transition-colors"
                                    placeholder="Dear Hiring Manager,"
                                />
                                <button onClick={saveSalutation} className="p-1.5 bg-brand-600 hover:bg-brand-500 rounded-lg transition-colors">
                                    <Check size={12} className="text-white" />
                                </button>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-300 font-medium">{research.salutation}</p>
                        )}
                        {research.hiringManager && (
                            <p className="text-[10px] text-slate-500">
                                Found: {research.hiringManager}{research.hiringManagerTitle ? `, ${research.hiringManagerTitle}` : ''}
                            </p>
                        )}
                        {!research.hiringManager && (
                            <p className="text-[10px] text-amber-500/70">
                                No hiring manager found — check LinkedIn for "{company} {role}" to personalise further.
                            </p>
                        )}
                    </div>

                    {/* Company highlights */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <Building2 size={11} className="text-slate-500" />
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Company Highlights</span>
                                <span className="text-[9px] text-slate-600">— injected into company connection paragraph</span>
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
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-brand-500 transition-colors resize-none"
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
                                    <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
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
