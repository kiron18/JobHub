import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Briefcase,
    FileText,
    ChevronRight,
    Clock,
    CheckCircle2,
    XCircle,
    Send,
    Trophy,
    Calendar,
    Copy,
    ChevronDown,
    ChevronUp,
    Star,
    Bell,
    Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '../lib/api';

type ApplicationStatus = 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'REJECTED' | 'OFFER';

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
    documents: Document[];
    createdAt: string;
}

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

const FollowUpNudge: React.FC<{ jobs: JobApplication[] }> = ({ jobs }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const dueJobs = jobs.filter(j => {
        const days = daysSinceApplied(j.dateApplied);
        return j.status === 'APPLIED' && days !== null && days >= 7;
    });

    if (dueJobs.length === 0) return null;

    const handleCopy = (job: JobApplication, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(buildFollowUpEmail(job));
        toast.success('Copied to clipboard', {
            description: 'Remember to replace [Hiring Manager\'s Name] and [Your Name] before sending.'
        });
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
                        These applications are 7+ days old with no update — time to reach out
                    </p>
                </div>
            </div>

            <div className="divide-y divide-amber-500/10">
                {dueJobs.map(job => {
                    const days = daysSinceApplied(job.dateApplied) as number;
                    const isOpen = expandedId === job.id;

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
                                        {days} days elapsed
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={(e) => handleCopy(job, e)}
                                        aria-label={`Copy follow-up email for ${job.title}`}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-300 transition-colors uppercase tracking-wider"
                                    >
                                        <Copy size={10} />
                                        Copy Email
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
                                            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed p-4 bg-slate-900/60 border border-amber-500/15 rounded-xl">
                                                {buildFollowUpEmail(job)}
                                            </pre>
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

const JobCard: React.FC<{ job: JobApplication; onStatusChange: (id: string, status: ApplicationStatus, dateApplied?: string) => void; onDelete: (id: string) => void }> = ({ job, onStatusChange, onDelete }) => {
    const [expanded, setExpanded] = useState(false);

    const days = daysSinceApplied(job.dateApplied);
    const showFollowUpAlert = job.status === 'APPLIED' && days !== null && days >= 7;

    const config = STATUS_CONFIG[job.status];
    const StatusIcon = config.icon;

    const handleStatusSelect = (status: ApplicationStatus) => {
        const dateApplied = status === 'APPLIED' && !job.dateApplied ? new Date().toISOString() : undefined;
        onStatusChange(job.id, status, dateApplied);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass-card overflow-hidden transition-all ${showFollowUpAlert ? 'border-amber-500/40' : ''}`}
        >
            {showFollowUpAlert && (
                <div className="px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 text-amber-400 text-xs font-bold">
                    <Clock size={12} />
                    {days} days since you applied — time to follow up
                </div>
            )}

            <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${config.color}`}>
                                <StatusIcon size={10} />
                                {config.label}
                            </span>
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
                                            <DocumentBadge key={doc.id} type={doc.type} />
                                        ))}
                                    </div>
                                </div>
                            )}

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
    );
};

export const ApplicationTracker: React.FC = () => {
    const queryClient = useQueryClient();
    const [filterStatus, setFilterStatus] = useState<ApplicationStatus | 'ALL'>('ALL');

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

    const filteredJobs = filterStatus === 'ALL'
        ? jobs
        : jobs.filter(j => j.status === filterStatus);

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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                </div>
                <div className={`glass-card p-5 flex flex-col gap-2 ${followUpDue > 0 ? 'border-amber-500/30' : ''}`}>
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <Clock size={10} />
                        Follow-up Due
                    </p>
                    <p className={`text-4xl font-black tabular-nums ${followUpDue > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{followUpDue}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
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
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
