import React, { useState } from 'react';
import { Loader2, Send, CheckCircle, Edit3, Eye, Copy, Database, Sparkles, Zap } from 'lucide-react';
import api from '../lib/api';
import ReactMarkdown from 'react-markdown';

interface GenerationPanelProps {
    type: 'resume' | 'cover-letter' | 'selection-criteria';
    jobDescription: string;
    suggestedAchievements: Array<{
        id: string;
        relevanceScore: number;
        reason: string;
    }>;
    metadata?: {
        company: string;
        role: string;
    };
    onClose: () => void;
}

export const GenerationPanel: React.FC<GenerationPanelProps> = ({ 
    type, 
    jobDescription, 
    suggestedAchievements,
    metadata,
    onClose 
}) => {
    const [selectedAchievementIds, setSelectedAchievementIds] = useState<string[]>(
        suggestedAchievements.slice(0, 3).map(a => a.id) // Default to top 3
    );
    const [isGenerating, setIsGenerating] = useState(false);
    const [content, setContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setSaveSuccess(false);
        try {
            const { data } = await api.post(`/generate/${type}`, {
                jobDescription,
                achievementIds: selectedAchievementIds
            });
            setContent(data.content);
        } catch (err) {
            console.error('Generation failed:', err);
            alert('Failed to generate content. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFinalize = async () => {
        setIsSaving(true);
        try {
            // Placeholder for Step 4: Tracker Integration
            await api.post('/tracker/finalize', {
                type,
                content,
                jobDescription,
                company: metadata?.company || 'Unknown Company',
                role: metadata?.role || 'Unknown Role'
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            console.error('Finalization failed:', err);
            // Even if tracker fails, we show success if content is "local" for now, or alert if it's a hard fail
            alert('Document generated, but failed to sync to tracker.');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleAchievement = (id: string) => {
        setSelectedAchievementIds(prev => 
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    };

    return (
        <div className="glass-card border-brand-500/30 animate-in slide-in-from-right-8 duration-500">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-600/10 rounded-xl flex items-center justify-center text-brand-500">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-100 capitalize">Tailor {type.replace('-', ' ')}</h3>
                        <p className="text-xs text-slate-500 font-medium">Select evidence and generate with AI</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                    Cancel
                </button>
            </div>

            <div className="p-6 space-y-8">
                {/* Achievement Selection */}
                {!content && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Database size={16} className="text-brand-500" />
                            <h4 className="text-sm font-bold text-slate-300">Select Evidence to Include</h4>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {suggestedAchievements.map((ach) => (
                                <button
                                    key={ach.id}
                                    onClick={() => toggleAchievement(ach.id)}
                                    className={`text-left p-4 rounded-xl border transition-all ${
                                        selectedAchievementIds.includes(ach.id)
                                            ? 'bg-brand-600/10 border-brand-500/50 ring-1 ring-brand-500/50'
                                            : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-black text-brand-500 uppercase tracking-widest">
                                            Relevance: {Math.round(ach.relevanceScore * 100)}%
                                        </span>
                                        {selectedAchievementIds.includes(ach.id) && (
                                            <CheckCircle size={16} className="text-brand-500" />
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-300 font-medium line-clamp-2">{ach.reason}</p>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || selectedAchievementIds.length === 0}
                            className="w-full py-4 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-brand-600/20 disabled:opacity-50 flex items-center justify-center gap-3"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Crafting Bespoke Content...
                                </>
                            ) : (
                                <>
                                    <Zap size={20} />
                                    Generate {type.replace('-', ' ')}
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Content Preview/Edit */}
                {content && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex bg-slate-900/60 p-1 rounded-lg border border-slate-800">
                                <button 
                                    onClick={() => setIsEditing(false)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${!isEditing ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    <Eye size={14} /> Preview
                                </button>
                                <button 
                                    onClick={() => setIsEditing(true)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${isEditing ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    <Edit3 size={14} /> Edit
                                </button>
                            </div>

                            <button
                                onClick={() => navigator.clipboard.writeText(content)}
                                className="p-2 text-slate-400 hover:text-brand-400 transition-colors"
                                title="Copy to clipboard"
                            >
                                <Copy size={18} />
                            </button>
                        </div>

                        <div className="min-h-[400px] max-h-[600px] overflow-y-auto bg-slate-900/20 border border-slate-800 rounded-2xl p-6 custom-scrollbar">
                            {isEditing ? (
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    className="w-full h-full bg-transparent border-none focus:ring-0 text-slate-300 font-mono text-sm leading-relaxed resize-none"
                                />
                            ) : (
                                <article className="prose prose-invert prose-brand max-w-none">
                                    <ReactMarkdown>{content}</ReactMarkdown>
                                </article>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleFinalize}
                                disabled={isSaving}
                                className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3 active:scale-[0.98]"
                            >
                                {isSaving ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : saveSuccess ? (
                                    <CheckCircle size={20} />
                                ) : (
                                    <Send size={20} />
                                )}
                                {saveSuccess ? 'Saved to Tracker!' : 'Finalise & Sync to Tracker'}
                            </button>
                            <button
                                onClick={() => { setContent(''); setSaveSuccess(false); }}
                                className="px-6 py-4 border border-slate-800 text-slate-400 font-bold rounded-xl hover:bg-slate-800 transition-all"
                            >
                                Re-generate
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
