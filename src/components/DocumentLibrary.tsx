import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Trash2, Download, Copy, Search, X, Loader2, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import api from '../lib/api';
import type { DocType } from '../lib/exportDocx';

type KnownDocumentType = 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' | 'BASELINE_RESUME';

interface Document {
    id: string;
    title: string;
    // The backend can return any string here; we narrow to known types via
    // resolveDocType below. Falling back to RESUME for unknown types means
    // a new doc type never crashes the library.
    type: string;
    content: string;
    createdAt: string;
    jobApplicationId: string | null;
}

interface TypeConfigEntry { label: string; color: string; pill: string; }

const TYPE_CONFIG: Record<KnownDocumentType, TypeConfigEntry> = {
    RESUME:          { label: 'Resume',             color: '#7DA67D', pill: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
    COVER_LETTER:    { label: 'Cover Letter',       color: '#C5A059', pill: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
    STAR_RESPONSE:   { label: 'Selection Criteria', color: '#2D5A6E', pill: 'bg-sky-500/10 text-sky-300 border-sky-500/20' },
    BASELINE_RESUME: { label: 'Starter Resume',     color: '#7DA67D', pill: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
};

const DOC_TYPE_MAP: Record<KnownDocumentType, DocType> = {
    RESUME: 'resume',
    COVER_LETTER: 'cover-letter',
    STAR_RESPONSE: 'selection-criteria',
    BASELINE_RESUME: 'resume',
};

function resolveDocType(type: string): KnownDocumentType {
    return (type in TYPE_CONFIG ? type : 'RESUME') as KnownDocumentType;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByDate(docs: Document[]): { label: string; items: Document[] }[] {
    const groups: Record<string, Document[]> = {};
    for (const doc of docs) {
        const d = new Date(doc.createdAt);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
        const key = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : diffDays < 7 ? 'This Week' : diffDays < 30 ? 'This Month' : 'Older';
        if (!groups[key]) groups[key] = [];
        groups[key].push(doc);
    }
    const ORDER = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];
    return ORDER.filter(k => groups[k]).map(k => ({ label: k, items: groups[k] }));
}

interface DocCardProps {
    doc: Document;
    onDelete: (id: string) => void;
    deleting: boolean;
}

const DocCard: React.FC<DocCardProps> = ({ doc, onDelete, deleting }) => {
    const [viewerOpen, setViewerOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const resolvedType = resolveDocType(doc.type);
    const cfg = TYPE_CONFIG[resolvedType];

    const handleCopy = () => {
        navigator.clipboard.writeText(doc.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Copied to clipboard');
    };

    const handleDownload = async () => {
        try {
            const parts = doc.title.replace(/^[A-Z-]+ - /, '').split(' — ');
            const company = parts[0] || '';
            const role = parts[1] || '';
            const { exportDocx } = await import('../lib/exportDocx');
            await exportDocx(doc.content, DOC_TYPE_MAP[resolvedType], company, role);
            toast.success('Downloaded as .docx');
        } catch {
            toast.error('Download failed. Copy the content instead.');
        }
    };

    const handleDownloadPdf = async () => {
        try {
            const { exportPdf } = await import('../lib/exportPdf');
            await exportPdf(doc.content, DOC_TYPE_MAP[resolvedType] as any, '', '');
            toast.success('Downloaded as PDF');
        } catch {
            toast.error('PDF download failed. Try .docx instead.');
        }
    };

    const preview = doc.content.slice(0, 120).replace(/\n+/g, ' ').trim();

    return (
        <>
            <motion.div
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="glass-card p-4 flex items-start gap-4 group hover:border-slate-700 transition-all cursor-pointer"
                onClick={() => setViewerOpen(true)}
            >
                {/* Type dot */}
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}30` }}>
                    <FileText size={15} style={{ color: cfg.color }} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${cfg.pill}`}>
                            {cfg.label}
                        </span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock size={9} />
                            {formatDate(doc.createdAt)}
                        </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-200 truncate mb-1">{doc.title}</p>
                    <p className="text-xs text-slate-500 line-clamp-1 leading-relaxed">{preview}…</p>
                </div>

                {/* Actions — visible on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={handleCopy}
                        title="Copy content"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-all"
                    >
                        {copied ? <CheckCircle size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                    <button
                        onClick={handleDownloadPdf}
                        title="Download as PDF"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                    >
                        <FileText size={14} />
                    </button>
                    <button
                        onClick={handleDownload}
                        title="Download as .docx"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-all"
                    >
                        <Download size={14} />
                    </button>
                    <button
                        onClick={() => onDelete(doc.id)}
                        disabled={deleting}
                        title="Delete"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                    >
                        {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                </div>
            </motion.div>

            {/* Viewer Modal */}
            <AnimatePresence>
                {viewerOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
                        onClick={() => setViewerOpen(false)}
                    >
                        <motion.div
                            initial={{ y: 80, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 80, opacity: 0 }}
                            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                            className="w-full sm:max-w-3xl bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl flex flex-col h-screen sm:h-auto sm:max-h-[88vh] overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800 shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${cfg.pill}`}>
                                        {cfg.label}
                                    </span>
                                    <p className="text-sm font-bold text-slate-100 truncate">{doc.title}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={handleDownload}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-emerald-400 border border-emerald-700/50 hover:bg-emerald-500/10 transition-colors"
                                    >
                                        <Download size={11} /> .docx
                                    </button>
                                    <button
                                        onClick={handleCopy}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-400 border border-slate-700 hover:text-slate-200 transition-colors"
                                    >
                                        <Copy size={11} /> Copy
                                    </button>
                                    <button onClick={() => setViewerOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors">
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                <div className="max-w-2xl mx-auto bg-white text-slate-900 rounded-sm p-10 shadow-2xl">
                                    <article className="prose prose-slate max-w-none">
                                        <ReactMarkdown>{doc.content}</ReactMarkdown>
                                    </article>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export const DocumentLibrary: React.FC = () => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<KnownDocumentType | 'ALL'>('ALL');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const { data: documents = [], isLoading } = useQuery<Document[]>({
        queryKey: ['documents'],
        queryFn: async () => {
            const { data } = await api.get('/documents');
            return data;
        },
        refetchOnMount: true,
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/documents/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            toast.success('Document deleted');
        },
        onError: () => toast.error('Failed to delete document'),
        onSettled: () => setDeletingId(null),
    });

    const handleDelete = (id: string) => {
        if (!confirm('Delete this document? This cannot be undone.')) return;
        setDeletingId(id);
        deleteMutation.mutate(id);
    };

    const filtered = useMemo(() => {
        let list = documents;
        if (typeFilter !== 'ALL') list = list.filter(d => d.type === typeFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(d => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q));
        }
        return list;
    }, [documents, typeFilter, search]);

    const grouped = useMemo(() => groupByDate(filtered), [filtered]);

    const counts: Record<string, number> = useMemo(() => {
        const c: Record<string, number> = { ALL: documents.length, RESUME: 0, COVER_LETTER: 0, STAR_RESPONSE: 0, BASELINE_RESUME: 0 };
        for (const d of documents) {
            const key = resolveDocType(d.type);
            c[key] = (c[key] || 0) + 1;
        }
        return c;
    }, [documents]);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <header className="space-y-2">
                <h2 className="text-4xl font-extrabold tracking-tight text-white">Document Library</h2>
                <p className="text-xl text-slate-400 font-medium">
                    {documents.length} document{documents.length !== 1 ? 's' : ''} generated
                </p>
            </header>

            {/* Search + Type filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search documents…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                            <X size={13} />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {(['ALL', 'RESUME', 'COVER_LETTER', 'STAR_RESPONSE', 'BASELINE_RESUME'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTypeFilter(t)}
                            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                                typeFilter === t
                                    ? (t === 'ALL' ? 'bg-slate-700 border-slate-600 text-slate-200' : `${TYPE_CONFIG[t as KnownDocumentType]?.pill || ''}`)
                                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                            }`}
                        >
                            {t === 'ALL' ? 'All' : TYPE_CONFIG[t as KnownDocumentType].label}
                            <span className="ml-1.5 opacity-60">{counts[t] || 0}</span>
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                </div>
            ) : documents.length === 0 ? (
                <div className="glass-card p-16 flex flex-col items-center gap-4 text-center">
                    <FileText size={40} className="text-slate-700" />
                    <div>
                        <p className="text-lg font-bold text-slate-400">No documents yet</p>
                        <p className="text-sm text-slate-600 mt-1">Generate documents from the Dashboard to see them here.</p>
                    </div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="glass-card p-10 text-center">
                    <p className="text-slate-400 font-medium">No documents match your search.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {grouped.map(group => (
                        <div key={group.label}>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{group.label}</p>
                            <AnimatePresence>
                                <div className="space-y-2">
                                    {group.items.map(doc => (
                                        <DocCard
                                            key={doc.id}
                                            doc={doc}
                                            onDelete={handleDelete}
                                            deleting={deletingId === doc.id}
                                        />
                                    ))}
                                </div>
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
