import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Trash2, Download, Copy, Search, X, Loader2, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';
import { SectionIntroBanner } from './processStrip';
import type { DocType } from '../lib/exportDocx';

type KnownDocumentType = 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' | 'BASELINE_RESUME';

interface Document {
    id: string;
    title: string;
    type: string;
    content: string;
    createdAt: string;
    jobApplicationId: string | null;
}

interface TypeConfigEntry { label: string; color: string; }

const TYPE_CONFIG: Record<KnownDocumentType, TypeConfigEntry> = {
    RESUME:          { label: 'Resume',             color: '#7DA67D' },
    COVER_LETTER:    { label: 'Cover Letter',       color: '#C5A059' },
    STAR_RESPONSE:   { label: 'Selection Criteria', color: '#2D5A6E' },
    BASELINE_RESUME: { label: 'Starter Resume',     color: '#7DA67D' },
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

const cardStyle: React.CSSProperties = {
    background: warm.colors.bgSurface,
    border: `1px solid ${warm.colors.borderWhisper}`,
    borderRadius: 18,
    overflow: 'hidden',
};

const btnAction: React.CSSProperties = {
    padding: '5px 6px', borderRadius: 8, background: 'transparent', border: 'none',
    cursor: 'pointer', color: warm.colors.textMuted, transition: 'color 0.15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};

interface DocCardProps {
    doc: Document;
    onDelete: (id: string) => void;
    deleting: boolean;
}

const DocCard: React.FC<DocCardProps> = ({ doc, onDelete, deleting }) => {
    const [viewerOpen, setViewerOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [hovered, setHovered] = useState(false);
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
                onClick={() => setViewerOpen(true)}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    ...cardStyle,
                    padding: 16,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 16,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                    borderColor: hovered ? warm.colors.borderDefined : warm.colors.borderWhisper,
                }}
            >
                {/* Type dot */}
                <div style={{
                    width: 36, height: 36, borderRadius: 10, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
                    background: `${cfg.color}18`, border: `1px solid ${cfg.color}30`,
                }}>
                    <FileText size={15} style={{ color: cfg.color }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                            padding: '1px 6px', borderRadius: 4, border: `1px solid ${cfg.color}40`,
                            color: cfg.color, background: `${cfg.color}12`,
                        }}>
                            {cfg.label}
                        </span>
                        <span style={{ fontSize: 10, color: warm.colors.textMuted, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={9} />
                            {formatDate(doc.createdAt)}
                        </span>
                    </div>
                    <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 600, color: warm.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</p>
                    <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}…</p>
                </div>

                {/* Actions — visible on hover */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0,
                    opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
                }} onClick={e => e.stopPropagation()}>
                    <button onClick={handleCopy} title="Copy content" style={btnAction}
                        onMouseEnter={e => e.currentTarget.style.color = warm.colors.textPrimary}
                        onMouseLeave={e => e.currentTarget.style.color = warm.colors.textMuted}
                    >
                        {copied ? <CheckCircle size={14} style={{ color: warm.colors.success }} /> : <Copy size={14} />}
                    </button>
                    <button onClick={handleDownloadPdf} title="Download as PDF" style={btnAction}
                        onMouseEnter={e => e.currentTarget.style.color = '#B85C5C'}
                        onMouseLeave={e => e.currentTarget.style.color = warm.colors.textMuted}
                    >
                        <FileText size={14} />
                    </button>
                    <button onClick={handleDownload} title="Download as .docx" style={btnAction}
                        onMouseEnter={e => e.currentTarget.style.color = warm.colors.textPrimary}
                        onMouseLeave={e => e.currentTarget.style.color = warm.colors.textMuted}
                    >
                        <Download size={14} />
                    </button>
                    <button onClick={() => onDelete(doc.id)} disabled={deleting} title="Delete" style={{
                        ...btnAction, opacity: deleting ? 0.4 : 1, cursor: deleting ? 'not-allowed' : 'pointer',
                    }}
                        onMouseEnter={e => { if (!deleting) e.currentTarget.style.color = '#B85C5C'; }}
                        onMouseLeave={e => { if (!deleting) e.currentTarget.style.color = warm.colors.textMuted; }}
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
                        onClick={() => setViewerOpen(false)}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 50,
                            background: 'rgba(26, 24, 20, 0.36)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                            padding: '0',
                        }}
                        className="sm:items-center sm:p-6"
                    >
                        <motion.div
                            initial={{ y: 80, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 80, opacity: 0 }}
                            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                width: '100%', maxWidth: 768,
                                background: warm.colors.bgSurface,
                                border: `1px solid ${warm.colors.borderWhisper}`,
                                borderRadius: '16px 16px 0 0',
                                display: 'flex', flexDirection: 'column',
                                height: '100%', maxHeight: '88vh',
                                overflow: 'hidden',
                            }}
                            className="sm:rounded-2xl"
                        >
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                                padding: '16px 20px', borderBottom: `1px solid ${warm.colors.borderWhisper}`, flexShrink: 0,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                    <span style={{
                                        fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                                        padding: '1px 6px', borderRadius: 4, border: `1px solid ${cfg.color}40`,
                                        color: cfg.color, background: `${cfg.color}12`,
                                    }}>
                                        {cfg.label}
                                    </span>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    <button onClick={handleDownload} style={{
                                        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                                        borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                                        letterSpacing: '0.04em', cursor: 'pointer',
                                        color: warm.colors.success, border: `1px solid ${warm.colors.success}40`,
                                        background: `${warm.colors.success}10`,
                                    }}>
                                        <Download size={11} /> .docx
                                    </button>
                                    <button onClick={handleCopy} style={{
                                        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                                        borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                                        letterSpacing: '0.04em', cursor: 'pointer',
                                        color: warm.colors.textSecondary, border: `1px solid ${warm.colors.borderDefined}`,
                                        background: 'transparent',
                                    }}>
                                        <Copy size={11} /> Copy
                                    </button>
                                    <button onClick={() => setViewerOpen(false)} style={{
                                        padding: '5px 6px', borderRadius: 8, background: 'transparent', border: 'none',
                                        cursor: 'pointer', color: warm.colors.textMuted,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                                <div style={{
                                    maxWidth: 672, margin: '0 auto',
                                    background: warm.colors.bgCanvas,
                                    color: warm.colors.textPrimary,
                                    borderRadius: 4, padding: 32,
                                }}>
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
        <div>
            <SectionIntroBanner sectionId="documents">
                Your library of tailored CVs, cover letters, and selection-criteria responses. Reuse anything you've already polished.
            </SectionIntroBanner>
            <header style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, color: warm.colors.textPrimary, letterSpacing: '-0.02em', margin: '0 0 6px' }}>Document Library</h2>
                <p style={{ margin: 0, fontSize: 14, color: warm.colors.textSecondary, fontWeight: 500 }}>
                    {documents.length} document{documents.length !== 1 ? 's' : ''} generated
                </p>
            </header>

            {/* Search + Type filters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: warm.colors.textMuted, pointerEvents: 'none' }} />
                    <input
                        type="text"
                        placeholder="Search documents…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%', background: warm.colors.bgSurface,
                            border: `1px solid ${warm.colors.borderWhisper}`,
                            borderRadius: 12, padding: '10px 32px 10px 36px',
                            fontSize: 13, color: warm.colors.textPrimary,
                            outline: 'none', boxSizing: 'border-box',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = warm.colors.accentPetrol; e.currentTarget.style.boxShadow = `0 0 0 3px ${warm.colors.ringFocus}`; }}
                        onBlur={e => { e.currentTarget.style.borderColor = warm.colors.borderWhisper; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={{
                            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: warm.colors.textMuted, padding: 2, display: 'flex',
                        }}>
                            <X size={13} />
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {(['ALL', 'RESUME', 'COVER_LETTER', 'STAR_RESPONSE', 'BASELINE_RESUME'] as const).map(t => {
                        const active = typeFilter === t;
                        const cfg = t === 'ALL' ? null : TYPE_CONFIG[t as KnownDocumentType];
                        return (
                            <button
                                key={t}
                                onClick={() => setTypeFilter(t)}
                                style={{
                                    padding: '6px 10px', borderRadius: 10, fontSize: 9, fontWeight: 800,
                                    letterSpacing: '0.06em', textTransform: 'uppercase',
                                    cursor: 'pointer', border: `1px solid ${warm.colors.borderWhisper}`,
                                    background: active ? (cfg ? `${cfg.color}14` : warm.colors.bgAlt) : warm.colors.bgSurface,
                                    color: active ? (cfg ? cfg.color : warm.colors.textPrimary) : warm.colors.textMuted,
                                }}
                            >
                                {t === 'ALL' ? 'All' : cfg!.label}
                                <span style={{ marginLeft: 4, opacity: 0.6 }}>{counts[t] || 0}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: 32, height: 32, border: `2px solid ${warm.colors.borderWhisper}`, borderTopColor: warm.colors.accentPetrol, borderRadius: '50%', animation: 'dspin 0.8s linear infinite' }} />
                </div>
            ) : documents.length === 0 ? (
                <div style={{
                    ...cardStyle, padding: 48,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center',
                }}>
                    <FileText size={40} style={{ color: warm.colors.borderWhisper }} />
                    <div>
                        <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: warm.colors.textPrimary }}>No documents yet</p>
                        <p style={{ margin: 0, fontSize: 13, color: warm.colors.textMuted }}>Generate documents from the Dashboard to see them here.</p>
                    </div>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ ...cardStyle, padding: 32, textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 14, color: warm.colors.textSecondary, fontWeight: 500 }}>No documents match your search.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                    {grouped.map(group => (
                        <div key={group.label}>
                            <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 800, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{group.label}</p>
                            <AnimatePresence>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
