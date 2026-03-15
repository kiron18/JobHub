import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Loader2, Zap, AlertTriangle, FileText, Mail, List } from 'lucide-react';
import api from '../lib/api';

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

    const handleStartApplication = (type: 'resume' | 'cover-letter' | 'selection-criteria' = 'resume') => {
        if (!result) return;
        
        navigate('/application-workspace', {
            state: {
                jobDescription,
                analysis: result, // Matches the backend structure we now expect
                initialTab: type
            }
        });
    };

    const handleAnalyze = async () => {
        if (jobDescription.trim().length < 50) return;
        setIsAnalyzing(true);
        setError(null);

        try {
            // Persist JD immediately
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
                                (result?.matchScore || 0) > 80 ? 'text-emerald-400' : 
                                (result?.matchScore || 0) > 60 ? 'text-brand-400' : 'text-orange-400'
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
                                onClick={() => handleStartApplication('resume')}
                                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg transition-all active:scale-95 shadow-lg shadow-brand-600/20"
                            >
                                <Zap size={14} />
                                Generate Documents
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
                        onClick={() => handleStartApplication('resume')}
                        className="glass-card p-4 flex flex-col items-center gap-3 hover:border-brand-500/50 transition-all group"
                    >
                        <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                            <FileText size={20} />
                        </div>
                        <span className="text-sm font-bold text-slate-200">Tailor Resume</span>
                    </button>
                    <button 
                        onClick={() => handleStartApplication('cover-letter')}
                        className="glass-card p-4 flex flex-col items-center gap-3 hover:border-brand-500/50 transition-all group"
                    >
                        <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Mail size={20} />
                        </div>
                        <span className="text-sm font-bold text-slate-200">Tailor Cover Letter</span>
                    </button>
                    {result.requiresSelectionCriteria && (
                        <button 
                            onClick={() => handleStartApplication('selection-criteria')}
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
    );
};
