import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Loader2, Zap, AlertTriangle, FileText, Mail, List, XCircle, TrendingDown, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import { useAppTheme } from '../contexts/ThemeContext';
import { trackMatchAnalysisRun, trackFreeLimitHit } from '../lib/analytics';

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
    overallGrade?: string;
    dimensions?: Record<string, { score: number; grade: string; note: string }>;
    matchedIdentityCard?: string | null;
    citizenshipWarning?: boolean;
    australianFlags?: {
        apsLevel: string | null;
        requiresCitizenship: boolean;
        securityClearanceRequired: 'none' | 'baseline' | 'nv1' | 'nv2' | 'pv';
        salaryType: 'base' | 'trp' | 'unknown';
    };
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
                                Go Back. Find a Better Role.
                            </button>
                            <button
                                onClick={onProceed}
                                className="w-full py-2 rounded-xl text-slate-600 hover:text-slate-400 text-xs font-medium transition-colors"
                            >
                                Proceed anyway. I understand the risk.
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

interface CitizenshipWarningProps {
    onClose: () => void;
    onProceed: () => void;
}

const CitizenshipWarning: React.FC<CitizenshipWarningProps> = ({ onClose, onProceed }) => {
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
                    className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/40 rounded-2xl shadow-2xl shadow-amber-900/30 overflow-hidden"
                >
                    {/* Amber gradient header */}
                    <div className="bg-gradient-to-br from-amber-950/80 to-slate-900 p-8 pb-6 border-b border-amber-500/20">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-14 h-14 bg-amber-500/15 rounded-2xl flex items-center justify-center shrink-0">
                                <AlertTriangle size={28} className="text-amber-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-amber-300">This role requires Australian citizenship.</h2>
                                <p className="text-sm text-amber-400/70 mt-0.5">Hard boundary — not a preference</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-5">
                        <p className="text-sm text-slate-300 leading-relaxed">
                            Citizenship requirements are hard boundaries. Regardless of your qualifications or experience,
                            applications from non-citizens are rejected at the screening stage. Your time is better spent
                            on roles open to your visa status.
                        </p>

                        <div className="flex flex-col gap-2 pt-1">
                            <button
                                onClick={onClose}
                                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
                            >
                                <ArrowLeft size={16} />
                                Find a better role
                            </button>
                            <button
                                onClick={onProceed}
                                className="w-full py-2 rounded-xl text-slate-600 hover:text-slate-400 text-xs font-medium transition-colors"
                            >
                                Proceed anyway — I understand
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export const MatchEngine: React.FC = () => {
    const navigate = useNavigate();
    const { T } = useAppTheme();
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
    const [showLowMatchWarning, setShowLowMatchWarning] = useState(false);
    const [showCitizenshipWarning, setShowCitizenshipWarning] = useState(false);
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

    const handleAnalyze = async () => {
        if (jobDescription.trim().length < 50) return;
        setIsAnalyzing(true);
        setError(null);

        try {
            localStorage.setItem('jobhub_current_jd', jobDescription);
            const { data } = await api.post('/analyze/job', { jobDescription });
            trackMatchAnalysisRun();
            setResult(data);
            localStorage.setItem('jobhub_current_analysis', JSON.stringify(data));
            if (data.citizenshipWarning) {
                setShowCitizenshipWarning(true);
            }
        } catch (err: any) {
            console.error('Analysis failed:', err);
            const serverError = err.response?.data?.error;
            if (err.response?.status === 429) {
                trackFreeLimitHit('analysis');
            }
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
            {showCitizenshipWarning && (
                <CitizenshipWarning
                    onClose={() => setShowCitizenshipWarning(false)}
                    onProceed={() => setShowCitizenshipWarning(false)}
                />
            )}
            {showLowMatchWarning && result && (
                <LowMatchWarning
                    result={result}
                    onProceed={handleLowMatchProceed}
                    onClose={() => { setShowLowMatchWarning(false); setPendingNavType(null); }}
                />
            )}
            <div className="space-y-6">
                <div className="glass-card p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-brand-600/10 rounded-xl flex items-center justify-center text-brand-500">
                                <Target size={20} />
                            </div>
                            <h3 className="text-xl font-bold" style={{ color: T.text }}>Job Match Analysis</h3>
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
                            className="w-full h-80 rounded-xl p-4 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all resize-none text-base leading-relaxed"
                            style={{ background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.inputText }}
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
                            onClick={() => navigateTo('resume')}
                            className="glass-card p-4 flex flex-col items-center gap-3 hover:border-amber-500/50 transition-all group"
                        >
                            <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                                <FileText size={20} />
                            </div>
                            <span className="text-sm font-bold" style={{ color: T.text }}>Custom Resume</span>
                            <span className="text-[9px] font-bold text-amber-500/70 uppercase tracking-wider">Tailored for this role</span>
                        </button>
                        <button
                            onClick={() => navigateTo('cover-letter')}
                            className="glass-card p-4 flex flex-col items-center gap-3 hover:border-brand-500/50 transition-all group"
                        >
                            <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Mail size={20} />
                            </div>
                            <span className="text-sm font-bold" style={{ color: T.text }}>Cover Letter</span>
                            <span className="text-[9px] font-bold text-blue-500/70 uppercase tracking-wider">Tailored for this role</span>
                        </button>
                        <button
                            onClick={() => navigateTo('selection-criteria')}
                            className="glass-card p-4 flex flex-col items-center gap-3 hover:border-purple-500/50 transition-all group"
                        >
                            <div className="w-10 h-10 bg-purple-500/10 text-purple-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                                <List size={20} />
                            </div>
                            <span className="text-sm font-bold" style={{ color: T.text }}>Selection Criteria</span>
                            <span className="text-[9px] font-bold text-purple-500/70 uppercase tracking-wider">Tailored for this role</span>
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};
