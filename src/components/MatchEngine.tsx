import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Loader2, Zap, AlertTriangle, FileText, Mail, List, X, AlertCircle, XCircle, TrendingDown, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';

const CONFIRM_WORDS = [
    'MAGNIFICENT',
    'INDEPENDENT',
    'COMFORTABLE',
    'OUTSTANDING',
    'TRANSPARENT',
    'SUBSTANTIAL',
    'ACKNOWLEDGE',
    'ACCOMMODATE',
    'FURTHERMORE',
    'RESPONSIBLE',
];

function pickWord(): string {
    return CONFIRM_WORDS[Math.floor(Math.random() * CONFIRM_WORDS.length)];
}

interface AnalysisResult {
    matchScore: number;
    keywords: string[];
    rankedAchievements: Array<{
        id: string;
        relevanceScore: number;
        reason: string;
        tier: 'STRONG' | 'MODERATE' | 'WEAK';
    }>;
    extractedMetadata?: {
        company: string;
        role: string;
    };
    evidenceWarning?: string;
    requiresSelectionCriteria?: boolean;
}

interface LowMatchWarningProps {
    result: AnalysisResult;
    onProceed: () => void;
    onClose: () => void;
}

const LowMatchWarning: React.FC<LowMatchWarningProps> = ({ result, onProceed, onClose }) => {
    const weakAchievements = result.rankedAchievements.filter(a => a.tier === 'WEAK').slice(0, 3);
    const strongCount = result.rankedAchievements.filter(a => a.tier === 'STRONG').length;
    const totalCount = result.rankedAchievements.length;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-6"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.92, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 22, stiffness: 280 }}
                    onClick={e => e.stopPropagation()}
                    className="w-full max-w-lg bg-slate-900 border-2 border-red-500/40 rounded-2xl shadow-2xl shadow-red-900/30 overflow-hidden"
                >
                    {/* Red gradient header */}
                    <div className="bg-gradient-to-br from-red-950/80 to-slate-900 p-8 pb-6 border-b border-red-500/20">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-14 h-14 bg-red-500/15 rounded-2xl flex items-center justify-center shrink-0">
                                <XCircle size={28} className="text-red-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-red-300">Poor Role Match Detected</h2>
                                <p className="text-sm text-red-400/70 mt-0.5">Applying here is unlikely to lead to an interview</p>
                            </div>
                        </div>

                        <div className="flex items-baseline gap-3">
                            <span className="text-6xl font-black text-red-400">{result.matchScore}%</span>
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 text-red-300/80 text-xs font-bold">
                                    <TrendingDown size={12} />
                                    Match Score
                                </div>
                                <p className="text-xs text-slate-400">
                                    {strongCount} of {totalCount} achievements relevant
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-5">
                        {weakAchievements.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Why Your Profile Doesn't Fit</p>
                                <div className="space-y-2">
                                    {weakAchievements.map(a => (
                                        <div key={a.id} className="flex items-start gap-2.5 p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
                                            <XCircle size={13} className="text-red-400/70 mt-0.5 shrink-0" />
                                            <p className="text-xs text-slate-400 leading-relaxed">{a.reason}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                            <p className="text-xs text-amber-300/80 leading-relaxed">
                                <span className="font-bold text-amber-300">Recommendation:</span> Find roles that align with your existing achievement evidence. A 60%+ match score gives you a strong foundation to write a compelling, evidence-based application.
                            </p>
                        </div>

                        <div className="flex flex-col gap-2 pt-1">
                            <button
                                onClick={onClose}
                                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
                            >
                                <ArrowLeft size={16} />
                                Go Back — Find a Better Role
                            </button>
                            <button
                                onClick={onProceed}
                                className="w-full py-2 rounded-xl text-slate-600 hover:text-slate-400 text-xs font-medium transition-colors"
                            >
                                Proceed anyway — I understand the risk
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

interface TailorModalProps {
    onConfirm: () => void;
    onClose: () => void;
}

const TailorResumeModal: React.FC<TailorModalProps> = ({ onConfirm, onClose }) => {
    const [word] = useState(pickWord);
    const [input, setInput] = useState('');
    const isMatch = input.trim().toUpperCase() === word;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={e => e.stopPropagation()}
                    className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-8 space-y-6"
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400">
                                <AlertCircle size={20} />
                            </div>
                            <h2 className="text-lg font-bold text-slate-100">Tailor a Custom Resume?</h2>
                        </div>
                        <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    <p className="text-sm text-slate-400 leading-relaxed">
                        We recommend maintaining a <span className="text-slate-200 font-semibold">single master resume</span> for all applications — it's easier to maintain and just as effective for most roles.
                    </p>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Tailoring creates a separate document for this job only. If you're sure, type the word below to confirm.
                    </p>

                    <div className="p-4 bg-slate-800/60 rounded-xl text-center">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Type this word to confirm</p>
                        <p className="text-2xl font-black tracking-widest text-amber-400 select-none">{word}</p>
                    </div>

                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value.toUpperCase())}
                        placeholder="Type here..."
                        autoFocus
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 font-bold tracking-widest text-center uppercase outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all placeholder:normal-case placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-600"
                    />

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 font-bold text-sm hover:bg-slate-800 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={!isMatch}
                            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-900 font-black text-sm transition-all"
                        >
                            Tailor Resume
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export const MatchEngine: React.FC = () => {
    const navigate = useNavigate();
    const [jobDescription, setJobDescription] = useState(() => {
        return localStorage.getItem('jobhub_current_jd') || '';
    });
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(() => {
        try {
            const saved = localStorage.getItem('jobhub_current_analysis');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.error('Failed to parse saved analysis:', e);
            return null;
        }
    });
    const [error, setError] = useState<string | null>(null);
    const [showTailorModal, setShowTailorModal] = useState(false);
    const [showLowMatchWarning, setShowLowMatchWarning] = useState(false);
    const [pendingNavType, setPendingNavType] = useState<'resume' | 'cover-letter' | 'selection-criteria' | null>(null);

    const LOW_MATCH_THRESHOLD = 40;

    const navigateTo = (type: 'resume' | 'cover-letter' | 'selection-criteria') => {
        if (!result) return;
        if ((result.matchScore || 0) < LOW_MATCH_THRESHOLD) {
            setPendingNavType(type);
            setShowLowMatchWarning(true);
            return;
        }
        navigate('/application-workspace', {
            state: { jobDescription, analysis: result, initialTab: type }
        });
    };

    const handleLowMatchProceed = () => {
        setShowLowMatchWarning(false);
        if (pendingNavType) {
            navigate('/application-workspace', {
                state: { jobDescription, analysis: result, initialTab: pendingNavType }
            });
        }
        setPendingNavType(null);
    };

    const handleTailorResumeClick = () => {
        if (!result) return;
        if ((result.matchScore || 0) < LOW_MATCH_THRESHOLD) {
            setPendingNavType('resume');
            setShowLowMatchWarning(true);
            return;
        }
        setShowTailorModal(true);
    };
    const handleTailorConfirm = () => {
        setShowTailorModal(false);
        navigateTo('resume');
    };

    const handleAnalyze = async () => {
        if (jobDescription.trim().length < 50) return;
        setIsAnalyzing(true);
        setError(null);

        try {
            localStorage.setItem('jobhub_current_jd', jobDescription);
            const { data } = await api.post('/analyze/job', { jobDescription });
            setResult(data);
            localStorage.setItem('jobhub_current_analysis', JSON.stringify(data));
        } catch (err: any) {
            console.error('Analysis failed:', err);
            const serverError = err.response?.data?.error;
            if (err.response?.status === 401) {
                setError('Your session has expired. Please refresh the page and log in again.');
            } else {
                setError(serverError || 'Analysis failed. Make sure you have imported a profile and the server is running.');
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleReset = () => {
        setJobDescription('');
        setResult(null);
        setError(null);
        localStorage.removeItem('jobhub_current_jd');
        localStorage.removeItem('jobhub_current_analysis');
    };

    return (
        <>
            {showLowMatchWarning && result && (
                <LowMatchWarning
                    result={result}
                    onProceed={handleLowMatchProceed}
                    onClose={() => { setShowLowMatchWarning(false); setPendingNavType(null); }}
                />
            )}
            {showTailorModal && (
                <TailorResumeModal
                    onConfirm={handleTailorConfirm}
                    onClose={() => setShowTailorModal(false)}
                />
            )}

            <div className="space-y-6">
                <div className="glass-card p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-brand-600/10 rounded-xl flex items-center justify-center text-brand-500">
                                <Target size={20} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-100">Job Match Analysis</h3>
                        </div>
                        {(jobDescription || result) && (
                            <button
                                onClick={handleReset}
                                className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors"
                            >
                                Reset
                            </button>
                        )}
                    </div>

                    <div className="relative group">
                        <textarea
                            placeholder="Paste Job Description here..."
                            className="w-full h-80 bg-slate-900/40 border border-slate-800 rounded-xl p-4 text-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all resize-none text-base leading-relaxed"
                            value={jobDescription}
                            onChange={(e) => {
                                setJobDescription(e.target.value);
                                localStorage.setItem('jobhub_current_jd', e.target.value);
                            }}
                        />
                        <div className="absolute bottom-3 right-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                            {jobDescription.length} characters
                        </div>
                    </div>

                    <button
                        onClick={handleAnalyze}
                        disabled={jobDescription.length < 50 || isAnalyzing}
                        className="btn-primary w-full py-3 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 transition-all rounded-xl font-bold"
                    >
                        {isAnalyzing ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                Analysing role...
                            </>
                        ) : (
                            <>
                                <Zap size={18} />
                                Analyse This Role
                            </>
                        )}
                    </button>

                    {result && (
                        <div className="flex flex-wrap items-center gap-4 p-4 bg-brand-500/5 rounded-xl border border-brand-500/10 animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex flex-col items-center px-4 border-r border-slate-800">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Match Score</span>
                                <span className={`text-2xl font-black ${
                                    (result?.matchScore || 0) >= 80 ? 'text-emerald-400' :
                                    (result?.matchScore || 0) >= 60 ? 'text-brand-400' :
                                    (result?.matchScore || 0) >= 40 ? 'text-orange-400' : 'text-red-400'
                                }`}>
                                    {result?.matchScore || 0}%
                                </span>
                            </div>

                            <div className="flex-1 space-y-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Key JD Signals</span>
                                <div className="flex flex-wrap gap-2">
                                    {(result?.keywords || []).slice(0, 8).map(word => (
                                        <span key={word} className="px-2 py-0.5 bg-brand-600/10 text-brand-400 text-[10px] font-bold rounded-md border border-brand-600/20">
                                            {word}
                                        </span>
                                    ))}
                                    {(result?.keywords || []).length === 0 && (
                                        <span className="text-[10px] text-slate-500 italic">No specific signals detected</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigateTo('cover-letter')}
                                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg transition-all active:scale-95 shadow-lg shadow-brand-600/20"
                                >
                                    <Mail size={14} />
                                    Write Cover Letter
                                </button>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-3">
                            <AlertTriangle size={16} />
                            <p className="font-medium">{error}</p>
                        </div>
                    )}
                </div>

                {/* Quick Actions Panel */}
                {result && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-4 duration-500">
                        <button
                            onClick={handleTailorResumeClick}
                            className="glass-card p-4 flex flex-col items-center gap-3 hover:border-amber-500/50 transition-all group"
                        >
                            <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                                <FileText size={20} />
                            </div>
                            <span className="text-sm font-bold text-slate-200">Tailor a Custom Resume</span>
                            <span className="text-[9px] font-bold text-amber-500/70 uppercase tracking-wider">Confirmation required</span>
                        </button>
                        <button
                            onClick={() => navigateTo('cover-letter')}
                            className="glass-card p-4 flex flex-col items-center gap-3 hover:border-brand-500/50 transition-all group"
                        >
                            <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Mail size={20} />
                            </div>
                            <span className="text-sm font-bold text-slate-200">Tailor Cover Letter</span>
                        </button>
                        {result.requiresSelectionCriteria && (
                            <button
                                onClick={() => navigateTo('selection-criteria')}
                                className="glass-card p-4 flex flex-col items-center gap-3 hover:border-brand-500/50 transition-all group"
                            >
                                <div className="w-10 h-10 bg-purple-500/10 text-purple-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <List size={20} />
                                </div>
                                <span className="text-sm font-bold text-slate-200">Selection Criteria</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};
