import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Briefcase,
    FileText,
    ChevronRight,
    Clock,
    X,
    XCircle,
    Send,
    Trophy,
    Calendar,
    Copy,
    ChevronDown,
    ChevronUp,
    Star,
    Bell,
    Trash2,
    Mail,
    Loader2,
    Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import api from '../lib/api';
import { exportDocx } from '../lib/exportDocx';

type ApplicationStatus = 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'REJECTED' | 'OFFER';
type JobPriority = 'DREAM' | 'TARGET' | 'BACKUP' | null;

interface Document {
    id: string;
    type: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE';
    content: string;
    title?: string;
    createdAt: string;
}

interface JobApplication {
    id: string;
    title: string;
    company: string;
    description: string;
    status: ApplicationStatus;
    dateApplied: string | null;
    notes: string | null;
    priority: JobPriority;
    documents: Document[];
    createdAt: string;
}

const PRIORITY_CONFIG: Record<NonNullable<JobPriority>, { label: string; dot: string; border: string; bg: string; text: string }> = {
    DREAM:  { label: 'Dream',  dot: '#f59e0b', border: 'rgba(245,158,11,0.35)', bg: 'rgba(245,158,11,0.08)', text: '#fbbf24' },
    TARGET: { label: 'Target', dot: '#818cf8', border: 'rgba(99,102,241,0.35)', bg: 'rgba(99,102,241,0.08)',  text: '#a5b4fc' },
    BACKUP: { label: 'Backup', dot: '#6b7280', border: 'rgba(107,114,128,0.3)', bg: 'rgba(107,114,128,0.07)', text: '#9ca3af' },
};

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; icon: React.FC<any> }> = {
    SAVED: { label: 'Saved', color: 'text-slate-400 bg-slate-800 border-slate-700', icon: Star },
    APPLIED: { label: 'Applied', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30', icon: Send },
    INTERVIEW: { label: 'Interview', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: Clock },
    OFFER: { label: 'Offer', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: Trophy },
    REJECTED: { label: 'Rejected', color: 'text-red-400 bg-red-500/10 border-red-500/30', icon: XCircle }
};

const STATUS_FLOW: ApplicationStatus[] = ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'];

function daysSinceApplied(dateApplied: string | null): number | null {
    if (!dateApplied) return null;
    const diff = Date.now() - new Date(dateApplied).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function buildFollowUpEmail(job: JobApplication): string {
    return `Subject: Follow-up – ${job.title} Application

Hi [Hiring Manager's Name],

I hope this finds you well. I'm following up on my application for the ${job.title} role at ${job.company}, which I submitted approximately one week ago.

I remain very enthusiastic about this opportunity and the work ${job.company} is doing. I'd welcome the chance to discuss how my background aligns with what you're looking for.

Please let me know if there's any additional information I can provide. I look forward to hearing from you.

Kind regards,
[Your Name]`;
}

const DocumentBadge: React.FC<{ type: Document['type'] }> = ({ type }) => {
    const labels: Record<Document['type'], string> = {
        RESUME: 'Resume',
        COVER_LETTER: 'Cover Letter',
        STAR_RESPONSE: 'Selection Criteria'
    };
    const colors: Record<Document['type'], string> = {
        RESUME: 'bg-brand-600/10 text-brand-400 border-brand-600/20',
        COVER_LETTER: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        STAR_RESPONSE: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    };
    return (
        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${colors[type]}`}>
            {labels[type]}
        </span>
    );
};

const DocumentViewerModal: React.FC<{
    doc: Document;
    jobTitle: string;
    company: string;
    onClose: () => void;
}> = ({ doc, jobTitle, company, onClose }) => {
    const handleCopy = () => {
        navigator.clipboard.writeText(doc.content);
        toast.success('Copied to clipboard');
    };

    const handleDownload = async () => {
        const docTypeMap: Record<Document['type'], 'resume' | 'cover-letter' | 'selection-criteria'> = {
            RESUME: 'resume',
            COVER_LETTER: 'cover-letter',
            STAR_RESPONSE: 'selection-criteria',
        };
        try {
            await exportDocx(doc.content, docTypeMap[doc.type], company, jobTitle);
            toast.success('Downloaded as .docx');
        } catch {
            toast.error('Download failed — copy the content instead.');
        }
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-label={`Document viewer: ${doc.title ?? doc.type}`}
        >
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="w-full sm:max-w-3xl bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl flex flex-col h-screen sm:h-auto sm:max-h-[85vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <DocumentBadge type={doc.type} />
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-100 truncate">{jobTitle}</p>
                            <p className="text-xs text-slate-500 truncate">{company}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleDownload}
                            aria-label="Download as Word document"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-emerald-400 border border-emerald-700/50 hover:border-emerald-600 hover:bg-emerald-500/10 transition-colors"
                        >
                            <FileText size={11} />
                            .docx
                        </button>
                        <button
                            onClick={handleCopy}
                            aria-label="Copy document content to clipboard"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-400 border border-slate-700 hover:border-slate-600 hover:text-slate-200 transition-colors"
                        >
                            <Copy size={11} />
                            Copy
                        </button>
                        <button
                            onClick={onClose}
                            aria-label="Close document viewer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 custom-scrollbar-light p-6">
                    <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{doc.content}</ReactMarkdown>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

const FollowUpNudge: React.FC<{ jobs: JobApplication[] }> = ({ jobs }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [aiEmails, setAiEmails] = useState<Record<string, string>>({});
    const [generatingFor, setGeneratingFor] = useState<string | null>(null);

    const dueJobs = jobs.filter(j => {
        const days = daysSinceApplied(j.dateApplied);
        return j.status === 'APPLIED' && days !== null && days >= 7;
    });

    if (dueJobs.length === 0) return null;

    const handleCopyStatic = (job: JobApplication, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(aiEmails[job.id] || buildFollowUpEmail(job));
        toast.success('Copied to clipboard', {
            description: aiEmails[job.id]
                ? 'AI-personalised email copied.'
                : 'Remember to replace [Hiring Manager\'s Name] and [Your Name] before sending.'
        });
    };

    const handleGenerateAI = async (job: JobApplication, e: React.MouseEvent) => {
        e.stopPropagation();
        if (generatingFor === job.id || aiEmails[job.id]) {
            setExpandedId(job.id);
            return;
        }
        setGeneratingFor(job.id);
        setExpandedId(job.id);
        try {
            const { data } = await api.post('/generate/followup-email', {
                jobDescription: job.description || `${job.title} at ${job.company}`,
                selectedAchievementIds: [],
                analysisContext: { tone: 'professional', competencies: [] },
            });
            setAiEmails(prev => ({ ...prev, [job.id]: data.content }));
        } catch {
            toast.error('Could not generate AI email — using template instead.');
        } finally {
            setGeneratingFor(null);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedId(prev => (prev === id ? null : id));
    };

    return (
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-amber-500/20 flex items-start gap-3">
                <Bell size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                    <p className="text-sm font-black text-amber-400 uppercase tracking-wider leading-tight">
                        Follow-up Reminder
                    </p>
                    <p className="text-xs text-amber-400/70 font-medium mt-0.5">
                        These applications are 7+ days old. Time to reach out — click to generate an AI email.
                    </p>
                </div>
            </div>

            <div className="divide-y divide-amber-500/10">
                {dueJobs.map(job => {
                    const days = daysSinceApplied(job.dateApplied) as number;
                    const isOpen = expandedId === job.id;
                    const isGenerating = generatingFor === job.id;
                    const hasAI = !!aiEmails[job.id];
                    const emailContent = aiEmails[job.id] || buildFollowUpEmail(job);

                    return (
                        <div key={job.id}>
                            <button
                                onClick={() => toggleExpand(job.id)}
                                aria-expanded={isOpen}
                                aria-label={`Toggle follow-up template for ${job.title} at ${job.company}`}
                                className="w-full px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-amber-500/10 transition-colors text-left"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-200 truncate">
                                            {job.title} at {job.company}
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-black text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded shrink-0">
                                        {days}d ago
                                    </span>
                                    {hasAI && (
                                        <span className="text-[9px] font-bold text-brand-400 bg-brand-600/10 border border-brand-600/20 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                                            <Sparkles size={8} /> AI
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {!hasAI && (
                                        <button
                                            onClick={(e) => handleGenerateAI(job, e)}
                                            disabled={isGenerating}
                                            aria-label={`Generate AI follow-up email for ${job.title}`}
                                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black text-brand-400 border border-brand-600/30 hover:bg-brand-600/10 transition-colors uppercase tracking-wider disabled:opacity-50"
                                        >
                                            {isGenerating ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
                                            AI Email
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => handleCopyStatic(job, e)}
                                        aria-label={`Copy follow-up email for ${job.title}`}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-300 transition-colors uppercase tracking-wider"
                                    >
                                        <Copy size={10} />
                                        Copy
                                    </button>
                                    {isOpen ? (
                                        <ChevronUp size={14} className="text-amber-400/60" />
                                    ) : (
                                        <ChevronDown size={14} className="text-amber-400/60" />
                                    )}
                                </div>
                            </button>

                            <AnimatePresence initial={false}>
                                {isOpen && (
                                    <motion.div
                                        key="template"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-5 pb-4">
                                            {isGenerating ? (
                                                <div className="p-4 text-center">
                                                    <p className="text-xs text-amber-400/60">Generating personalised follow-up email…</p>
                                                </div>
                                            ) : (
                                                <pre className={`text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed p-4 rounded-xl border ${hasAI ? 'bg-brand-600/5 border-brand-600/20' : 'bg-slate-900/60 border-amber-500/15'}`}>
                                                    {emailContent}
                                                </pre>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const JobCard: React.FC<{
    job: JobApplication;
    onStatusChange: (id: string, status: ApplicationStatus, dateApplied?: string) => void;
    onDelete: (id: string) => void;
    onNotesChange: (id: string, notes: string) => void;
    onPriorityChange: (id: string, priority: JobPriority) => void;
}> = ({ job, onStatusChange, onDelete, onNotesChange, onPriorityChange }) => {
    const [expanded, setExpanded] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [thankYouEmail, setThankYouEmail] = useState<string | null>(null);
    const [generatingEmail, setGeneratingEmail] = useState(false);
    const [thankYouOpen, setThankYouOpen] = useState(false);
    const [notesValue, setNotesValue] = useState(job.notes || '');
    const [notesSaving, setNotesSaving] = useState(false);
    const [negotiationGuide, setNegotiationGuide] = useState<string | null>(null);
    const [generatingNegotiation, setGeneratingNegotiation] = useState(false);
    const [negotiationOpen, setNegotiationOpen] = useState(false);
    const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
    const [coldOutreach, setColdOutreach] = useState<string | null>(null);
    const [generatingOutreach, setGeneratingOutreach] = useState(false);
    const [outreachOpen, setOutreachOpen] = useState(false);
    const [rejectionResponse, setRejectionResponse] = useState<string | null>(null);
    const [generatingRejection, setGeneratingRejection] = useState(false);
    const [rejectionOpen, setRejectionOpen] = useState(false);

    const days = daysSinceApplied(job.dateApplied);
    const showFollowUpAlert = job.status === 'APPLIED' && days !== null && days >= 7;

    const handleGenerateThankYou = async () => {
        if (generatingEmail || thankYouEmail) { setThankYouOpen(true); return; }
        setGeneratingEmail(true);
        setThankYouOpen(true);
        try {
            const { data } = await api.post('/generate/followup-email', {
                jobDescription: job.description || `${job.title} at ${job.company}`,
                selectedAchievementIds: [],
                analysisContext: { tone: 'professional', competencies: [] },
            });
            setThankYouEmail(data.content);
        } catch (err) {
            toast.error('Could not generate email — try again.');
            setThankYouOpen(false);
        } finally {
            setGeneratingEmail(false);
        }
    };

    const config = STATUS_CONFIG[job.status];
    const StatusIcon = config.icon;

    const handleStatusSelect = (status: ApplicationStatus) => {
        const dateApplied = status === 'APPLIED' && !job.dateApplied ? new Date().toISOString() : undefined;
        onStatusChange(job.id, status, dateApplied);
    };

    const handleNotesSave = async () => {
        if (notesValue === (job.notes || '')) return;
        setNotesSaving(true);
        try {
            await onNotesChange(job.id, notesValue);
        } finally {
            setNotesSaving(false);
        }
    };

    const handleGenerateColdOutreach = async () => {
        if (coldOutreach) { setOutreachOpen(true); return; }
        setGeneratingOutreach(true);
        setOutreachOpen(true);
        try {
            const { data } = await api.post('/generate/cold-outreach', {
                jobDescription: job.description || `${job.title} at ${job.company}`,
                selectedAchievementIds: [],
                analysisContext: { tone: 'professional', competencies: [] },
            });
            setColdOutreach(data.content);
        } catch {
            toast.error('Could not generate outreach — try again.');
            setOutreachOpen(false);
        } finally {
            setGeneratingOutreach(false);
        }
    };

    const handleGenerateRejectionResponse = async () => {
        if (rejectionResponse) { setRejectionOpen(true); return; }
        setGeneratingRejection(true);
        setRejectionOpen(true);
        try {
            const { data } = await api.post('/generate/rejection-response', {
                jobDescription: job.description || `${job.title} at ${job.company}`,
                selectedAchievementIds: [],
                analysisContext: { tone: 'professional', competencies: [] },
            });
            setRejectionResponse(data.content);
        } catch {
            toast.error('Could not generate response — try again.');
            setRejectionOpen(false);
        } finally {
            setGeneratingRejection(false);
        }
    };

    const handleGenerateNegotiation = async () => {
        if (generatingNegotiation || negotiationGuide) { setNegotiationOpen(true); return; }
        setGeneratingNegotiation(true);
        setNegotiationOpen(true);
        try {
            const { data } = await api.post('/generate/offer-negotiation', {
                jobDescription: job.description || `${job.title} at ${job.company}`,
                selectedAchievementIds: [],
                analysisContext: { tone: 'professional', competencies: [] },
            });
            setNegotiationGuide(data.content);
        } catch {
            toast.error('Could not generate negotiation guide.');
            setNegotiationOpen(false);
        } finally {
            setGeneratingNegotiation(false);
        }
    };

    return (
        <>
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass-card overflow-hidden transition-all ${showFollowUpAlert ? 'border-amber-500/40' : ''}`}
        >
            {showFollowUpAlert && (
                <div className="px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 text-amber-400 text-xs font-bold">
                    <Clock size={12} />
                    {days} days since you applied. Time to follow up.
                </div>
            )}

            <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${config.color}`}>
                                <StatusIcon size={10} />
                                {config.label}
                            </span>
                            {/* Priority badge — click to cycle */}
                            <div className="relative">
                                <button
                                    onClick={() => setPriorityMenuOpen(o => !o)}
                                    style={job.priority ? {
                                        background: PRIORITY_CONFIG[job.priority].bg,
                                        border: `1px solid ${PRIORITY_CONFIG[job.priority].border}`,
                                        color: PRIORITY_CONFIG[job.priority].text,
                                    } : {
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px dashed rgba(255,255,255,0.12)',
                                        color: '#4b5563',
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all"
                                >
                                    {job.priority ? (
                                        <><span style={{ width: 5, height: 5, borderRadius: '50%', background: PRIORITY_CONFIG[job.priority].dot, display: 'inline-block' }} />{PRIORITY_CONFIG[job.priority].label}</>
                                    ) : <span>Set priority</span>}
                                </button>
                                <AnimatePresence>
                                    {priorityMenuOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 4 }}
                                            transition={{ duration: 0.12 }}
                                            className="absolute left-0 top-full mt-1 z-20 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl"
                                            style={{ minWidth: 110 }}
                                        >
                                            {(['DREAM', 'TARGET', 'BACKUP'] as const).map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => { onPriorityChange(job.id, p); setPriorityMenuOpen(false); }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold hover:bg-slate-800 transition-colors text-left"
                                                    style={{ color: PRIORITY_CONFIG[p].text }}
                                                >
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_CONFIG[p].dot, display: 'inline-block', flexShrink: 0 }} />
                                                    {PRIORITY_CONFIG[p].label}
                                                </button>
                                            ))}
                                            {job.priority && (
                                                <button
                                                    onClick={() => { onPriorityChange(job.id, null); setPriorityMenuOpen(false); }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold hover:bg-slate-800 transition-colors text-left text-slate-500"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            {days !== null && job.status !== 'REJECTED' && (
                                <span className="text-[10px] text-slate-500 font-bold">
                                    {days}d ago
                                </span>
                            )}
                        </div>
                        <h3 className="font-bold text-slate-100 text-base truncate">{job.title}</h3>
                        <p className="text-sm text-slate-400 font-medium">{job.company}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {job.documents.length > 0 && (
                            <div className="flex items-center gap-1 text-slate-500">
                                <FileText size={12} />
                                <span className="text-[10px] font-bold">{job.documents.length}</span>
                            </div>
                        )}
                        <button
                            onClick={() => setExpanded(!expanded)}
                            aria-expanded={expanded}
                            aria-label={expanded ? 'Collapse job details' : 'Expand job details'}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                        >
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-slate-800"
                    >
                        <div className="p-5 space-y-4">
                            {/* Status pipeline */}
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Update Status</p>
                                <div className="flex flex-wrap gap-2">
                                    {STATUS_FLOW.map(status => {
                                        const sc = STATUS_CONFIG[status];
                                        const SI = sc.icon;
                                        return (
                                            <button
                                                key={status}
                                                onClick={() => handleStatusSelect(status)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                                                    job.status === status
                                                        ? sc.color + ' shadow-md'
                                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                                                }`}
                                            >
                                                <SI size={10} />
                                                {sc.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Date applied */}
                            {job.status !== 'SAVED' && (
                                <div className="flex items-center gap-2">
                                    <Calendar size={12} className="text-slate-500" />
                                    <span className="text-xs text-slate-400">
                                        {job.dateApplied
                                            ? `Applied ${new Date(job.dateApplied).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`
                                            : 'Application date not set'}
                                    </span>
                                </div>
                            )}

                            {/* Documents */}
                            {job.documents.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Documents</p>
                                    <div className="flex flex-wrap gap-2">
                                        {job.documents.map(doc => (
                                            <button
                                                key={doc.id}
                                                onClick={() => setSelectedDoc(doc)}
                                                aria-label={`View ${doc.title ?? doc.type} document`}
                                                className="cursor-pointer opacity-100 hover:opacity-70 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                                            >
                                                <DocumentBadge type={doc.type} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Post-interview thank-you email generator */}
                            {job.status === 'INTERVIEW' && (
                                <div className="border border-amber-500/20 rounded-xl overflow-hidden bg-amber-500/5">
                                    <button
                                        onClick={handleGenerateThankYou}
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-500/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Mail size={13} className="text-amber-400" />
                                            <span className="text-xs font-bold text-amber-400">Thank-you email</span>
                                            {!thankYouEmail && !generatingEmail && (
                                                <span className="text-[9px] font-bold text-amber-400/50 uppercase tracking-wider flex items-center gap-1">
                                                    <Sparkles size={9} /> AI-personalised
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {generatingEmail && <Loader2 size={12} className="animate-spin text-amber-400" />}
                                            {thankYouEmail && !generatingEmail && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(thankYouEmail); toast.success('Copied'); }}
                                                    className="text-[9px] font-bold text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded hover:bg-amber-500/20 transition-colors uppercase tracking-wider"
                                                >
                                                    Copy
                                                </button>
                                            )}
                                            {thankYouOpen ? <ChevronUp size={12} className="text-amber-400/60" /> : <ChevronDown size={12} className="text-amber-400/60" />}
                                        </div>
                                    </button>
                                    <AnimatePresence>
                                        {thankYouOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden border-t border-amber-500/15"
                                            >
                                                <div className="p-4">
                                                    {generatingEmail ? (
                                                        <p className="text-xs text-amber-400/60 text-center py-2">Generating personalised email…</p>
                                                    ) : thankYouEmail ? (
                                                        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{thankYouEmail}</pre>
                                                    ) : null}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* Offer negotiation guide */}
                            {job.status === 'OFFER' && (
                                <div className="border border-emerald-500/20 rounded-xl overflow-hidden bg-emerald-500/5">
                                    <button
                                        onClick={handleGenerateNegotiation}
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-emerald-500/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Trophy size={13} className="text-emerald-400" />
                                            <span className="text-xs font-bold text-emerald-400">Negotiation Guide</span>
                                            {!negotiationGuide && !generatingNegotiation && (
                                                <span className="text-[9px] font-bold text-emerald-400/50 uppercase tracking-wider flex items-center gap-1">
                                                    <Sparkles size={9} /> AI-personalised
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {generatingNegotiation && <Loader2 size={12} className="animate-spin text-emerald-400" />}
                                            {negotiationGuide && !generatingNegotiation && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(negotiationGuide); toast.success('Copied'); }}
                                                    className="text-[9px] font-bold text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded hover:bg-emerald-500/20 transition-colors uppercase tracking-wider"
                                                >
                                                    Copy
                                                </button>
                                            )}
                                            {negotiationOpen ? <ChevronUp size={12} className="text-emerald-400/60" /> : <ChevronDown size={12} className="text-emerald-400/60" />}
                                        </div>
                                    </button>
                                    <AnimatePresence>
                                        {negotiationOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden border-t border-emerald-500/15"
                                            >
                                                <div className="p-4">
                                                    {generatingNegotiation ? (
                                                        <p className="text-xs text-emerald-400/60 text-center py-2">Generating personalised negotiation guide…</p>
                                                    ) : negotiationGuide ? (
                                                        <div className="prose prose-invert prose-xs max-w-none text-slate-300">
                                                            <ReactMarkdown>{negotiationGuide}</ReactMarkdown>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* Rejection response — REJECTED jobs only */}
                            {job.status === 'REJECTED' && (
                                <div className="border border-slate-600/30 rounded-xl overflow-hidden bg-slate-800/20">
                                    <button
                                        onClick={handleGenerateRejectionResponse}
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/20 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Mail size={13} className="text-slate-400" />
                                            <span className="text-xs font-bold text-slate-400">Rejection Response</span>
                                            {!rejectionResponse && !generatingRejection && (
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                                    <Sparkles size={9} /> Keep door open
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {generatingRejection && <Loader2 size={12} className="animate-spin text-slate-400" />}
                                            {rejectionResponse && !generatingRejection && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(rejectionResponse); toast.success('Copied'); }}
                                                    className="text-[9px] font-bold text-slate-400 border border-slate-600/50 px-2 py-0.5 rounded hover:bg-slate-700 transition-colors uppercase tracking-wider"
                                                >
                                                    Copy
                                                </button>
                                            )}
                                            {rejectionOpen ? <ChevronUp size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />}
                                        </div>
                                    </button>
                                    <AnimatePresence>
                                        {rejectionOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden border-t border-slate-700/30"
                                            >
                                                <div className="p-4">
                                                    {generatingRejection ? (
                                                        <p className="text-xs text-slate-500 text-center py-2">Generating graceful response…</p>
                                                    ) : rejectionResponse ? (
                                                        <div className="prose prose-invert prose-xs max-w-none text-slate-300">
                                                            <ReactMarkdown>{rejectionResponse}</ReactMarkdown>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* Cold outreach generator — SAVED jobs only */}
                            {job.status === 'SAVED' && (
                                <div className="border border-sky-500/20 rounded-xl overflow-hidden bg-sky-500/5">
                                    <button
                                        onClick={handleGenerateColdOutreach}
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-sky-500/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Mail size={13} className="text-sky-400" />
                                            <span className="text-xs font-bold text-sky-400">Cold Outreach Message</span>
                                            {!coldOutreach && !generatingOutreach && (
                                                <span className="text-[9px] font-bold text-sky-400/50 uppercase tracking-wider flex items-center gap-1">
                                                    <Sparkles size={9} /> LinkedIn DM + Email
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {generatingOutreach && <Loader2 size={12} className="animate-spin text-sky-400" />}
                                            {coldOutreach && !generatingOutreach && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(coldOutreach); toast.success('Copied'); }}
                                                    className="text-[9px] font-bold text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded hover:bg-sky-500/20 transition-colors uppercase tracking-wider"
                                                >
                                                    Copy
                                                </button>
                                            )}
                                            {outreachOpen ? <ChevronUp size={12} className="text-sky-400/60" /> : <ChevronDown size={12} className="text-sky-400/60" />}
                                        </div>
                                    </button>
                                    <AnimatePresence>
                                        {outreachOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden border-t border-sky-500/15"
                                            >
                                                <div className="p-4">
                                                    {generatingOutreach ? (
                                                        <p className="text-xs text-sky-400/60 text-center py-2">Generating outreach messages…</p>
                                                    ) : coldOutreach ? (
                                                        <div className="prose prose-invert prose-xs max-w-none text-slate-300">
                                                            <ReactMarkdown>{coldOutreach}</ReactMarkdown>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Notes</p>
                                    {notesSaving && <span className="text-[9px] text-slate-600 font-bold">Saving…</span>}
                                </div>
                                <textarea
                                    value={notesValue}
                                    onChange={e => setNotesValue(e.target.value)}
                                    onBlur={handleNotesSave}
                                    placeholder="Interview details, contact names, talking points, salary discussed…"
                                    rows={3}
                                    className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-brand-500 transition-colors resize-none leading-relaxed placeholder:text-slate-600"
                                />
                            </div>

                            {/* Delete */}
                            <div className="pt-2 border-t border-slate-800">
                                <button
                                    onClick={() => onDelete(job.id)}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 hover:text-red-400 transition-colors uppercase tracking-wider"
                                >
                                    <Trash2 size={12} />
                                    Remove application
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>

        <AnimatePresence>
            {selectedDoc && (
                <DocumentViewerModal
                    key={selectedDoc.id}
                    doc={selectedDoc}
                    jobTitle={job.title}
                    company={job.company}
                    onClose={() => setSelectedDoc(null)}
                />
            )}
        </AnimatePresence>
        </>
    );
};

export const ApplicationTracker: React.FC = () => {
    const queryClient = useQueryClient();
    const [filterStatus, setFilterStatus] = useState<ApplicationStatus | 'ALL'>('ALL');
    const [sortBy, setSortBy] = useState<'recent' | 'priority' | 'company'>('recent');
    const [showAddForm, setShowAddForm] = useState(false);
    const [addForm, setAddForm] = useState({ title: '', company: '', status: 'SAVED' as ApplicationStatus, dateApplied: '', notes: '' });

    const { data: jobs = [], isLoading } = useQuery<JobApplication[]>({
        queryKey: ['jobs'],
        queryFn: async () => {
            const { data } = await api.get('/jobs');
            return data;
        },
        refetchOnMount: true
    });

    const updateJobMutation = useMutation({
        mutationFn: async ({ id, status, dateApplied }: { id: string; status: ApplicationStatus; dateApplied?: string }) => {
            const { data } = await api.patch(`/jobs/${id}`, { status, dateApplied });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
        },
        onError: () => {
            toast.error('Failed to update status');
        }
    });

    const updateNotesMutation = useMutation({
        mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
            const { data } = await api.patch(`/jobs/${id}`, { notes });
            return data;
        },
        onError: () => {
            toast.error('Failed to save notes');
        }
    });

    const deleteJobMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/jobs/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            toast.success('Application removed');
        },
        onError: () => {
            toast.error('Failed to remove application');
        }
    });

    const handleStatusChange = (id: string, status: ApplicationStatus, dateApplied?: string) => {
        updateJobMutation.mutate({ id, status, dateApplied });
    };

    const handleDelete = (id: string) => {
        deleteJobMutation.mutate(id);
    };

    const handleNotesChange = async (id: string, notes: string) => {
        await updateNotesMutation.mutateAsync({ id, notes });
    };

    const updatePriorityMutation = useMutation({
        mutationFn: async ({ id, priority }: { id: string; priority: JobPriority }) => {
            const { data } = await api.patch(`/jobs/${id}`, { priority });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
        },
        onError: () => {
            toast.error('Failed to update priority');
        }
    });

    const handlePriorityChange = (id: string, priority: JobPriority) => {
        updatePriorityMutation.mutate({ id, priority });
    };

    const createJobMutation = useMutation({
        mutationFn: async (form: typeof addForm) => {
            const { data } = await api.post('/jobs', {
                title: form.title,
                company: form.company,
                description: `${form.title} at ${form.company} — manually added.`,
                status: form.status,
                dateApplied: form.dateApplied || null,
                notes: form.notes || null,
            });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            setShowAddForm(false);
            setAddForm({ title: '', company: '', status: 'SAVED', dateApplied: '', notes: '' });
            toast.success('Application added');
        },
        onError: () => {
            toast.error('Failed to add application');
        }
    });

    const handleAddJob = () => {
        if (!addForm.title.trim() || !addForm.company.trim()) return;
        createJobMutation.mutate(addForm);
    };

    const PRIORITY_ORDER: Record<string, number> = { DREAM: 0, TARGET: 1, BACKUP: 2 };

    const filteredJobs = [...(filterStatus === 'ALL' ? jobs : jobs.filter(j => j.status === filterStatus))].sort((a, b) => {
        if (sortBy === 'priority') {
            const pa = a.priority ? (PRIORITY_ORDER[a.priority] ?? 3) : 3;
            const pb = b.priority ? (PRIORITY_ORDER[b.priority] ?? 3) : 3;
            if (pa !== pb) return pa - pb;
        }
        if (sortBy === 'company') {
            return (a.company || '').localeCompare(b.company || '');
        }
        // default: recent
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const counts = {
        ALL: jobs.length,
        APPLIED: jobs.filter(j => j.status === 'APPLIED').length,
        INTERVIEW: jobs.filter(j => j.status === 'INTERVIEW').length,
        OFFER: jobs.filter(j => j.status === 'OFFER').length,
        SAVED: jobs.filter(j => j.status === 'SAVED').length,
        REJECTED: jobs.filter(j => j.status === 'REJECTED').length,
    };

    const followUpDue = jobs.filter(j => {
        const days = daysSinceApplied(j.dateApplied);
        return j.status === 'APPLIED' && days !== null && days >= 7;
    }).length;

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            <header className="space-y-2">
                <h2 className="text-4xl font-extrabold tracking-tight text-white">Application Tracker</h2>
                <p className="text-xl text-slate-400 font-medium">Track your pipeline from saved to signed.</p>
            </header>

            {!isLoading && <FollowUpNudge jobs={jobs} />}

            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="glass-card p-5 flex flex-col gap-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total</p>
                    <p className="text-4xl font-black text-white tabular-nums">{counts.ALL}</p>
                </div>
                <div className="glass-card p-5 flex flex-col gap-2">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Applied</p>
                    <p className="text-4xl font-black text-blue-400 tabular-nums">{counts.APPLIED}</p>
                </div>
                <div className="glass-card p-5 flex flex-col gap-2">
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Interviews</p>
                    <p className="text-4xl font-black text-amber-400 tabular-nums">{counts.INTERVIEW}</p>
                    {counts.APPLIED > 0 && (
                        <p className="text-[9px] text-slate-500 font-bold">
                            {Math.round((counts.INTERVIEW / Math.max(counts.APPLIED + counts.INTERVIEW, 1)) * 100)}% rate
                        </p>
                    )}
                </div>
                <div className="glass-card p-5 flex flex-col gap-2">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <Trophy size={10} />
                        Offers
                    </p>
                    <p className={`text-4xl font-black tabular-nums ${counts.OFFER > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{counts.OFFER}</p>
                    {counts.INTERVIEW > 0 && counts.OFFER > 0 && (
                        <p className="text-[9px] text-slate-500 font-bold">
                            {Math.round((counts.OFFER / counts.INTERVIEW) * 100)}% close rate
                        </p>
                    )}
                </div>
                <div className={`glass-card p-5 flex flex-col gap-2 ${followUpDue > 0 ? 'border-amber-500/30' : ''}`}>
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <Clock size={10} />
                        Follow-up Due
                    </p>
                    <p className={`text-4xl font-black tabular-nums ${followUpDue > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{followUpDue}</p>
                </div>
            </div>

            {/* Add Job Manually */}
            <div>
                <button
                    onClick={() => setShowAddForm(s => !s)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-all"
                >
                    <Briefcase size={13} />
                    Add Application Manually
                </button>
                <AnimatePresence>
                    {showAddForm && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-3 p-5 glass-card space-y-3">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Track an application from outside JobHub</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Job Title *</label>
                                        <input
                                            value={addForm.title}
                                            onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                                            placeholder="e.g. Senior Product Manager"
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Company *</label>
                                        <input
                                            value={addForm.company}
                                            onChange={e => setAddForm(f => ({ ...f, company: e.target.value }))}
                                            placeholder="e.g. Atlassian"
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Status</label>
                                        <select
                                            value={addForm.status}
                                            onChange={e => setAddForm(f => ({ ...f, status: e.target.value as ApplicationStatus }))}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 transition-colors"
                                        >
                                            {STATUS_FLOW.map(s => (
                                                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Date Applied</label>
                                        <input
                                            type="date"
                                            value={addForm.dateApplied}
                                            onChange={e => setAddForm(f => ({ ...f, dateApplied: e.target.value }))}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 transition-colors"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Notes (optional)</label>
                                    <input
                                        value={addForm.notes}
                                        onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                                        placeholder="Recruiter name, application portal, role details…"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
                                    />
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={handleAddJob}
                                        disabled={!addForm.title.trim() || !addForm.company.trim() || createJobMutation.isPending}
                                        className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all"
                                    >
                                        {createJobMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Briefcase size={13} />}
                                        Add Application
                                    </button>
                                    <button
                                        onClick={() => { setShowAddForm(false); setAddForm({ title: '', company: '', status: 'SAVED', dateApplied: '', notes: '' }); }}
                                        className="px-4 py-2 bg-slate-800 text-slate-400 text-xs font-bold rounded-lg hover:bg-slate-700 transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Filters + Sort */}
            <div className="flex flex-wrap items-center gap-2">
                {(['ALL', ...STATUS_FLOW] as const).map(status => {
                    const count = counts[status];
                    const config = status === 'ALL' ? null : STATUS_CONFIG[status];
                    return (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                                filterStatus === status
                                    ? (config ? config.color : 'bg-slate-700 border-slate-600 text-slate-200')
                                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                            }`}
                        >
                            {config && <config.icon size={10} />}
                            {status === 'ALL' ? 'All' : STATUS_CONFIG[status].label}
                            <span className="ml-1 opacity-60">{count}</span>
                        </button>
                    );
                })}
                {/* Sort */}
                <div className="ml-auto flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-1 py-0.5">
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider px-1">Sort</span>
                    {(['recent', 'priority', 'company'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setSortBy(s)}
                            className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${
                                sortBy === s ? 'bg-slate-700 text-slate-200' : 'text-slate-600 hover:text-slate-400'
                            }`}
                        >
                            {s === 'recent' ? 'Newest' : s === 'priority' ? 'Priority' : 'A–Z'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Job list */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                </div>
            ) : filteredJobs.length === 0 ? (
                <div className="glass-card p-16 flex flex-col items-center gap-4 text-center">
                    <Briefcase size={40} className="text-slate-700" />
                    <div>
                        <p className="text-lg font-bold text-slate-400">
                            {filterStatus === 'ALL' ? 'No applications yet' : `No ${STATUS_CONFIG[filterStatus].label} applications`}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                            {filterStatus === 'ALL'
                                ? 'Run a job analysis from the Dashboard to start tracking applications.'
                                : 'Try a different filter above.'}
                        </p>
                    </div>
                    {filterStatus === 'ALL' && (
                        <div className="flex items-center gap-2 text-brand-400 text-xs font-bold">
                            <ChevronRight size={14} />
                            Go to Dashboard → paste a job description → run analysis
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredJobs.map(job => (
                        <JobCard
                            key={job.id}
                            job={job}
                            onStatusChange={handleStatusChange}
                            onDelete={handleDelete}
                            onNotesChange={handleNotesChange}
                            onPriorityChange={handlePriorityChange}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
