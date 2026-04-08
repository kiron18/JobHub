import React, { useState } from 'react';
import {
    FileText,
    Clock,
    X,
    Trophy,
    Calendar,
    Copy,
    ChevronDown,
    ChevronUp,
    Bell,
    Trash2,
    Mail,
    Loader2,
    Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import api from '../../lib/api';
import { exportDocx } from '../../lib/exportDocx';
import type { JobApplication, TrackerDocument, ApplicationStatus, JobPriority } from './types';
import { PRIORITY_CONFIG, STATUS_FLOW } from './types';
import { STATUS_CONFIG } from './constants';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── DocumentBadge ──────────────────────────────────────────────────────────

const DocumentBadge: React.FC<{ type: TrackerDocument['type'] }> = ({ type }) => {
    const labels: Record<TrackerDocument['type'], string> = {
        RESUME: 'Resume',
        COVER_LETTER: 'Cover Letter',
        STAR_RESPONSE: 'Selection Criteria'
    };
    const colors: Record<TrackerDocument['type'], string> = {
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

// ─── DocumentViewerModal ────────────────────────────────────────────────────

const DocumentViewerModal: React.FC<{
    doc: TrackerDocument;
    jobTitle: string;
    company: string;
    onClose: () => void;
}> = ({ doc, jobTitle, company, onClose }) => {
    const handleCopy = () => {
        navigator.clipboard.writeText(doc.content);
        toast.success('Copied to clipboard');
    };

    const handleDownload = async () => {
        const docTypeMap: Record<TrackerDocument['type'], 'resume' | 'cover-letter' | 'selection-criteria'> = {
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

// ─── FollowUpNudge ───────────────────────────────────────────────────────────

export const FollowUpNudge: React.FC<{ jobs: JobApplication[] }> = ({ jobs }) => {
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

// ─── JobCard ────────────────────────────────────────────────────────────────

interface JobCardProps {
    job: JobApplication;
    onStatusChange: (id: string, status: ApplicationStatus, dateApplied?: string) => void;
    onDelete: (id: string) => void;
    onNotesChange: (id: string, notes: string) => void;
    onPriorityChange: (id: string, priority: JobPriority) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, onStatusChange, onDelete, onNotesChange, onPriorityChange }) => {
    const [expanded, setExpanded] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<TrackerDocument | null>(null);
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
    const [actionItems, setActionItems] = useState<Array<{ text: string; type: string; urgency: string }>>([]);
    const [extractingActions, setExtractingActions] = useState(false);

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
        } catch {
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

    const handleExtractActions = async () => {
        if (extractingActions || notesValue.trim().length < 20) return;
        setExtractingActions(true);
        try {
            const { data } = await api.post('/analyze/notes-actions', {
                notes: notesValue,
                jobTitle: job.title,
                company: job.company,
                status: job.status,
            });
            setActionItems(data.actions || []);
        } catch {
            // silent
        } finally {
            setExtractingActions(false);
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
                            {/* Grade badge */}
                            {job.overallGrade && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${
                                    job.overallGrade === 'A' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' :
                                    job.overallGrade === 'B' ? 'text-brand-400 bg-brand-400/10 border-brand-400/20' :
                                    job.overallGrade === 'C' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' :
                                    job.overallGrade === 'D' ? 'text-orange-400 bg-orange-400/10 border-orange-400/20' :
                                                               'text-red-400 bg-red-400/10 border-red-400/20'
                                }`}>
                                    {job.overallGrade}
                                    {job.matchScore != null && (
                                        <span className="opacity-60 font-bold">{job.matchScore}</span>
                                    )}
                                </span>
                            )}
                            {days !== null && job.status !== 'REJECTED' && (
                                <span className="text-[10px] text-slate-500 font-bold">
                                    {days}d ago
                                </span>
                            )}
                            {job.closingDate && job.status === 'SAVED' && (() => {
                                const dLeft = Math.ceil((new Date(job.closingDate).getTime() - Date.now()) / 86_400_000);
                                if (dLeft > 14) return null;
                                const badgeColor = dLeft <= 2 ? 'text-red-400 bg-red-500/10 border-red-500/20' : dLeft <= 7 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-slate-500 bg-slate-800 border-slate-700';
                                return (
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${badgeColor}`}>
                                        {dLeft <= 0 ? 'Closed' : dLeft === 1 ? 'Due tomorrow' : `${dLeft}d left`}
                                    </span>
                                );
                            })()}
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

                            {/* Closing date */}
                            <div className="flex items-center gap-2">
                                <Clock size={12} className="text-slate-500 shrink-0" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">Deadline:</span>
                                <input
                                    type="date"
                                    defaultValue={job.closingDate ? new Date(job.closingDate).toISOString().slice(0, 10) : ''}
                                    onBlur={async e => {
                                        const val = e.target.value || null;
                                        await api.patch(`/jobs/${job.id}`, { closingDate: val });
                                    }}
                                    className="flex-1 bg-transparent border-none text-xs text-slate-400 outline-none focus:text-slate-200 transition-colors cursor-pointer"
                                    style={{ colorScheme: 'dark' }}
                                />
                                {job.closingDate && (() => {
                                    const daysLeft = Math.ceil((new Date(job.closingDate).getTime() - Date.now()) / 86_400_000);
                                    const color = daysLeft <= 2 ? 'text-red-400 bg-red-500/10 border-red-500/20' : daysLeft <= 7 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-slate-500 bg-slate-800 border-slate-700';
                                    return daysLeft >= 0 ? (
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${color}`}>
                                            {daysLeft === 0 ? 'Today!' : `${daysLeft}d left`}
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded border text-slate-600 bg-slate-800 border-slate-700">Closed</span>
                                    );
                                })()}
                            </div>

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
                                    <div className="flex items-center gap-2">
                                        {notesSaving && <span className="text-[9px] text-slate-600 font-bold">Saving…</span>}
                                        {notesValue.trim().length >= 20 && (
                                            <button
                                                onClick={handleExtractActions}
                                                disabled={extractingActions}
                                                className="flex items-center gap-1 text-[9px] font-bold text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50"
                                            >
                                                {extractingActions ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
                                                Extract Actions
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <textarea
                                    value={notesValue}
                                    onChange={e => setNotesValue(e.target.value)}
                                    onBlur={handleNotesSave}
                                    placeholder="Interview details, contact names, talking points, salary discussed…"
                                    rows={3}
                                    className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-brand-500 transition-colors resize-none leading-relaxed placeholder:text-slate-600"
                                />
                                {/* Action items extracted from notes */}
                                <AnimatePresence>
                                    {actionItems.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mt-2 space-y-1.5 overflow-hidden"
                                        >
                                            <p className="text-[9px] font-black text-brand-400 uppercase tracking-wider">Action Items</p>
                                            {actionItems.map((item, i) => {
                                                const urgencyColor = item.urgency === 'high' ? 'text-red-400 border-red-500/20 bg-red-500/5' : item.urgency === 'medium' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' : 'text-slate-400 border-slate-700 bg-slate-800/40';
                                                return (
                                                    <div key={i} className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border text-xs ${urgencyColor}`}>
                                                        <span className="font-black text-[10px] mt-0.5 shrink-0">{i + 1}</span>
                                                        <span className="leading-relaxed">{item.text}</span>
                                                    </div>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
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
