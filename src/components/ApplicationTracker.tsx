import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Briefcase,
    ChevronRight,
    Clock,
    Trophy,
    Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '../lib/api';
import type { JobApplication, ApplicationStatus, JobPriority } from './tracker/types';
import { STATUS_FLOW } from './tracker/types';
import { STATUS_CONFIG } from './tracker/constants';
import { JobCard, FollowUpNudge } from './tracker/JobCard';
import { PipelineFunnel } from './tracker/PipelineFunnel';
import { SortControls } from './tracker/SortControls';
import type { SortBy } from './tracker/SortControls';

const PRIORITY_ORDER: Record<string, number> = { DREAM: 0, TARGET: 1, BACKUP: 2 };

function daysSinceApplied(dateApplied: string | null): number | null {
    if (!dateApplied) return null;
    const diff = Date.now() - new Date(dateApplied).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export const ApplicationTracker: React.FC = () => {
    const queryClient = useQueryClient();
    const [filterStatus, setFilterStatus] = useState<ApplicationStatus | 'ALL'>('ALL');
    const [sortBy, setSortBy] = useState<SortBy>('match');
    const [gradeFilter, setGradeFilter] = useState<'ALL' | 'AB' | 'C' | 'DF'>('ALL');
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

    const statusFiltered = filterStatus === 'ALL' ? jobs : jobs.filter(j => j.status === filterStatus);

    const gradeFiltered = gradeFilter === 'ALL' ? statusFiltered
        : gradeFilter === 'AB' ? statusFiltered.filter(j => j.overallGrade === 'A' || j.overallGrade === 'B')
        : gradeFilter === 'C'  ? statusFiltered.filter(j => j.overallGrade === 'C')
        : statusFiltered.filter(j => j.overallGrade === 'D' || j.overallGrade === 'F');

    const filteredJobs = [...gradeFiltered].sort((a, b) => {
        if (sortBy === 'match') {
            const aScore = a.matchScore ?? -1;
            const bScore = b.matchScore ?? -1;
            return bScore - aScore;
        }
        if (sortBy === 'priority') {
            const pa = a.priority ? (PRIORITY_ORDER[a.priority] ?? 3) : 3;
            const pb = b.priority ? (PRIORITY_ORDER[b.priority] ?? 3) : 3;
            if (pa !== pb) return pa - pb;
        }
        if (sortBy === 'company') {
            return (a.company || '').localeCompare(b.company || '');
        }
        if (sortBy === 'deadline') {
            const da = a.closingDate ? new Date(a.closingDate).getTime() : Infinity;
            const db = b.closingDate ? new Date(b.closingDate).getTime() : Infinity;
            return da - db;
        }
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

            {/* Pipeline Funnel — only shown when there are active applications */}
            {counts.APPLIED + counts.INTERVIEW + counts.OFFER > 0 && (
                <PipelineFunnel counts={counts} />
            )}

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
                <SortControls sortBy={sortBy} onSortChange={setSortBy} />
            </div>

            {/* Grade filter */}
            <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Grade</span>
                {([
                    { key: 'ALL', label: 'All' },
                    { key: 'AB',  label: 'A – B' },
                    { key: 'C',   label: 'C' },
                    { key: 'DF',  label: 'D – F' },
                ] as const).map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setGradeFilter(key)}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                            gradeFilter === key
                                ? 'bg-slate-700 border-slate-600 text-slate-200'
                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                        }`}
                    >
                        {label}
                    </button>
                ))}
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
