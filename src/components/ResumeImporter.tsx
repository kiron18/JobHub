import React, { useState } from 'react';
import { CheckCircle2, Loader2, AlertCircle, Save } from 'lucide-react';
import api from '../lib/api';

export const ResumeImporter: React.FC = () => {
    const [text, setText] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);
    const [stage, setStage] = useState(0); // 0: input, 1: verifying, 2: success
    const [extractedData, setExtractedData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const [extractionStage, setExtractionStage] = useState(0);
    const extractionStages = [
        { label: "Reading your document...",        duration: 2000  },
        { label: "Extracting work history...",      duration: 3000 },
        { label: "Mining achievements & metrics...", duration: 4000 },
        { label: "Running coaching analysis...",    duration: 3000 },
        { label: "Finalising your profile...",      duration: 2000  }
    ];

    const handleSave = async () => {
        if (!extractedData) return;
        setSaveState('saving');
        try {
            const dataToSave = {
                ...extractedData,
                skills: typeof extractedData.skills === 'string' ? extractedData.skills : JSON.stringify(extractedData.skills)
            };
            await api.post('/profile', dataToSave);
            setSaveState('saved');
            setTimeout(() => setSaveState('idle'), 2000);
        } catch (error) {
            console.error('Save failed:', error);
            setSaveState('error');
        }
    };

    const handleExtract = async () => {
        if (!text.trim()) return;

        setIsExtracting(true);
        setError(null);
        setStage(1);
        setExtractionStage(0);

        let currentStage = 0;
        const interval = setInterval(() => {
            if (currentStage < extractionStages.length - 1) {
                currentStage++;
                setExtractionStage(currentStage);
            } else {
                clearInterval(interval);
            }
        }, 3000);

        try {
            const { data } = await api.post('/extract/resume', { text });
            clearInterval(interval);
            setExtractionStage(extractionStages.length - 1);
            setExtractedData(data);
            setStage(2);
        } catch (err: any) {
            clearInterval(interval);
            const errorMsg = err.response?.data?.error || err.message || 'Failed to extract resume';
            setError(errorMsg.includes('authorization') ? 'Session expired. Please log in again.' : 'Failed to extract resume. Please check your content or try again.');
            setStage(0);
        } finally {
            setIsExtracting(false);
        }
    };

    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');


    const updateField = (path: string, value: any) => {
        const newData = { ...extractedData };
        const keys = path.split('.');
        let current = newData;
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
        setExtractedData(newData);
    };

    const CoachingTip = ({ tip, level }: { tip?: string | string[], level: 'RED' | 'ORANGE' }) => {
        if (!tip || (Array.isArray(tip) && tip.length === 0)) return null;
        const colorClass = level === 'RED' ? 'text-red-400 border-red-500/30 bg-red-500/5' : 'text-orange-400 border-orange-500/30 bg-orange-500/5';
        const tips = Array.isArray(tip) ? tip : [tip];
        
        return (
            <div className={`mt-2 p-3 rounded-lg border text-sm ${colorClass} animate-in fade-in slide-in-from-left-2`}>
                <div className="flex gap-2">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                        {tips.map((t, i) => <p key={i}>{t}</p>)}
                    </div>
                </div>
            </div>
        );
    };

    if (stage === 1) {
        const progress = ((extractionStage + 1) / extractionStages.length) * 100;
        return (
            <div className="glass-card p-16 flex flex-col items-center text-center space-y-8">
                <div className="relative">
                    <div className="absolute inset-0 bg-brand-500/20 blur-2xl rounded-full animate-pulse"></div>
                    <Loader2 className="w-16 h-16 text-brand-500 animate-spin relative z-10" />
                </div>
                <div className="space-y-4 w-full max-w-md">
                    <h3 className="text-2xl font-bold text-slate-100 italic">"Expert AI Career Coach" at Work...</h3>
                    
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div 
                            className="bg-brand-500 h-full transition-all duration-1000 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    
                    <p className="text-brand-400 font-bold animate-pulse">
                        {extractionStages[extractionStage].label}
                    </p>
                    
                    <p className="text-slate-400 text-sm">
                        Exhaustively extracting your experience, volunteering, and certifications while identifying missing gaps for the market.
                    </p>
                </div>
            </div>
        );
    }

    if (stage === 2 && extractedData) {
        const alerts = extractedData.coachingAlerts || [];
        const hasRedAlerts = alerts.some((a: any) => a.level === 'RED');

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                {/* Global Coaching Header */}
                <div className={`p-6 rounded-2xl border-2 shadow-2xl ${hasRedAlerts ? 'bg-red-500/10 border-red-500/30' : 'bg-orange-500/5 border-orange-500/20'}`}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className={`p-3 rounded-xl ${hasRedAlerts ? 'bg-red-500/20' : 'bg-orange-500/20'}`}>
                            <AlertCircle className={hasRedAlerts ? 'text-red-400' : 'text-orange-400'} size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Resume Coaching</h3>
                            <p className="text-slate-400 text-sm">Review the gaps identified to maximize your success in the competitive market.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {alerts.map((alert: any, idx: number) => (
                            <div key={idx} className={`p-4 rounded-xl border text-sm flex gap-3 ${alert.level === 'RED' ? 'bg-red-500/5 border-red-500/20 text-red-200' : 'bg-orange-500/5 border-orange-500/20 text-orange-200'}`}>
                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${alert.level === 'RED' ? 'bg-red-500' : 'bg-orange-500'}`} />
                                <div>
                                    <span className="font-black uppercase text-[10px] block mb-1">{alert.category}</span>
                                    {alert.message}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="text-3xl font-bold flex items-center gap-3">
                            <CheckCircle2 className="text-emerald-400 w-8 h-8" />
                            Finalize Extraction
                        </h3>
                        <p className="text-slate-400">Edit any details and address the coaching tips below.</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setStage(0)} className="px-6 py-3 rounded-xl border border-slate-800 hover:bg-slate-800 transition-colors">Abort</button>
                        <button
                            onClick={handleSave}
                            disabled={saveState !== 'idle' && saveState !== 'error'}
                            className={`btn-primary flex items-center gap-2 disabled:opacity-80 px-8 py-3 text-lg transition-all ${
                                saveState === 'saved' ? 'bg-emerald-600 hover:bg-emerald-600' : 
                                saveState === 'saving' ? 'bg-amber-600' : 
                                saveState === 'error' ? 'bg-red-600' : 'bg-brand-600 hover:bg-brand-500'
                            }`}
                        >
                            {saveState === 'saving' && <Loader2 className="animate-spin" size={24} />}
                            {saveState === 'saved' && <CheckCircle2 size={24} />}
                            {saveState === 'idle' && <Save size={24} />}
                            {saveState === 'error' && <AlertCircle size={24} />}
                            
                            {saveState === 'idle' && "Save to Profile Bank"}
                            {saveState === 'saving' && "Saving..."}
                            {saveState === 'saved' && "Saved"}
                            {saveState === 'error' && "Save Failed — Retry"}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    {/* Main Content: Core Data */}
                    <div className="space-y-8">
                        <div className="glass-card p-10 space-y-8">
                            <h4 className="text-xl font-bold text-slate-300 border-b border-slate-800 pb-6">Basic Profile</h4>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs text-slate-500 uppercase font-black tracking-widest">Full Name</label>
                                    <input
                                        type="text"
                                        value={extractedData.profile.name || ''}
                                        onChange={(e) => updateField('profile.name', e.target.value)}
                                        className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-4 mt-2 text-slate-200 outline-none focus:ring-2 focus:ring-brand-500 text-lg"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs text-slate-500 uppercase font-black tracking-widest">Email</label>
                                        <input type="text" value={extractedData.profile.email || ''} onChange={(e) => updateField('profile.email', e.target.value)} className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-4 mt-2 text-slate-200 outline-none focus:ring-2 focus:ring-brand-500" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 uppercase font-black tracking-widest">Location</label>
                                        <input type="text" value={extractedData.profile.location || ''} onChange={(e) => updateField('profile.location', e.target.value)} className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-4 mt-2 text-slate-200 outline-none focus:ring-2 focus:ring-brand-500" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 uppercase font-black tracking-widest">Professional Summary</label>
                                    <textarea
                                        value={extractedData.profile.professionalSummary || ''}
                                        onChange={(e) => updateField('profile.professionalSummary', e.target.value)}
                                        className="w-full h-40 bg-slate-900/50 border border-slate-800 rounded-xl p-4 mt-2 text-slate-200 text-base outline-none focus:ring-2 focus:ring-brand-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="glass-card p-10 space-y-8">
                            <h4 className="text-xl font-bold text-slate-300 border-b border-slate-800 pb-6">Work Experience</h4>
                            <div className="space-y-8">
                                {extractedData.experience?.map((exp: any, idx: number) => (
                                    <div key={idx} className="p-6 rounded-2xl border border-slate-800 bg-white/5 space-y-4">
                                        <div className="flex flex-col md:flex-row justify-between gap-4">
                                            <input type="text" value={exp.role || ''} placeholder="Role" onChange={(e) => {
                                                const newExp = [...extractedData.experience];
                                                newExp[idx].role = e.target.value;
                                                updateField('experience', newExp);
                                            }} className="bg-transparent font-bold text-xl text-slate-100 flex-1 border-b border-transparent focus:border-brand-500 outline-none" />
                                            <input type="text" value={exp.company || ''} placeholder="Company" onChange={(e) => {
                                                const newExp = [...extractedData.experience];
                                                newExp[idx].company = e.target.value;
                                                updateField('experience', newExp);
                                            }} className="bg-transparent text-slate-400 text-left md:text-right font-medium text-lg border-b border-transparent focus:border-brand-500 outline-none" />
                                        </div>
                                        <textarea
                                            value={exp.bullets?.join('\n') || ''}
                                            placeholder="Responsibilities & Achievements"
                                            onChange={(e) => {
                                                const newExp = [...extractedData.experience];
                                                newExp[idx].bullets = e.target.value.split('\n');
                                                updateField('experience', newExp);
                                            }}
                                            className="w-full bg-slate-900/40 p-4 rounded-xl text-base text-slate-300 h-48 outline-none border border-transparent focus:border-brand-500 resize-none"
                                        />
                                        <CoachingTip tip={exp.coachingTips} level="ORANGE" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="glass-card p-10 space-y-8">
                            <h4 className="text-xl font-bold text-slate-300 border-b border-slate-800 pb-6">Skills Matrix</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {['technical', 'industryKnowledge', 'softSkills'].map((category) => (
                                    <div key={category}>
                                        <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-3">{category.replace(/([A-Z])/g, ' $1')}</label>
                                        <textarea
                                            value={Array.isArray(extractedData.skills?.[category]) ? extractedData.skills[category].join(', ') : ''}
                                            onChange={(e) => {
                                                const newSkills = { ...extractedData.skills };
                                                newSkills[category] = e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean);
                                                updateField('skills', newSkills);
                                            }}
                                            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-slate-200 text-sm h-32 outline-none focus:ring-2 focus:ring-brand-500"
                                            placeholder={`Add ${category}...`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="glass-card p-10 space-y-8">
                                <h4 className="text-xl font-bold text-slate-300 border-b border-slate-800 pb-6">Education</h4>
                                <div className="space-y-6">
                                    {extractedData.education?.map((edu: any, idx: number) => (
                                        <div key={idx} className="p-6 rounded-2xl border border-slate-800 bg-white/5 space-y-3">
                                            <input type="text" value={edu.institution || ''} onChange={(e) => {
                                                const newEdu = [...extractedData.education];
                                                newEdu[idx].institution = e.target.value;
                                                updateField('education', newEdu);
                                            }} className="w-full bg-transparent font-bold text-slate-200 outline-none text-lg" />
                                            <div className="flex justify-between items-center text-base">
                                                <input type="text" value={edu.degree || ''} placeholder="Degree" onChange={(e) => {
                                                    const newEdu = [...extractedData.education];
                                                    newEdu[idx].degree = e.target.value;
                                                    updateField('education', newEdu);
                                                }} className="bg-transparent text-slate-400 outline-none flex-1" />
                                                <input type="text" value={edu.year || ''} placeholder="Year" onChange={(e) => {
                                                    const newEdu = [...extractedData.education];
                                                    newEdu[idx].year = e.target.value;
                                                    updateField('education', newEdu);
                                                }} className="bg-transparent text-slate-500 text-right w-24 outline-none" />
                                            </div>
                                            <CoachingTip tip={edu.coachingTips} level="ORANGE" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="glass-card p-10 space-y-8">
                                <h4 className="text-xl font-bold text-slate-300 border-b border-slate-800 pb-6">Certifications</h4>
                                <div className="space-y-6">
                                    {extractedData.certifications?.map((cert: any, idx: number) => (
                                        <div key={idx} className="p-6 rounded-2xl border border-slate-800 bg-white/5 space-y-2">
                                            <input type="text" value={cert.name || ''} onChange={(e) => {
                                                const newCerts = [...extractedData.certifications];
                                                newCerts[idx].name = e.target.value;
                                                updateField('certifications', newCerts);
                                            }} className="w-full bg-transparent font-bold text-slate-200 outline-none text-lg" />
                                            <div className="flex justify-between items-center text-base">
                                                <input type="text" value={cert.issuer || ''} placeholder="Issuer" onChange={(e) => {
                                                    const newCerts = [...extractedData.certifications];
                                                    newCerts[idx].issuer = e.target.value;
                                                    updateField('certifications', newCerts);
                                                }} className="bg-transparent text-slate-400 outline-none flex-1" />
                                                <input type="text" value={cert.year || ''} placeholder="Year" onChange={(e) => {
                                                    const newCerts = [...extractedData.certifications];
                                                    newCerts[idx].year = e.target.value;
                                                    updateField('certifications', newCerts);
                                                }} className="bg-transparent text-slate-500 text-right w-24 outline-none" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="glass-card p-10 space-y-8 border-l-4 border-l-orange-500/50">
                                <h4 className="text-xl font-bold text-slate-300 border-b border-slate-800 pb-6">Volunteering</h4>
                                <div className="space-y-6">
                                    {extractedData.volunteering?.map((vol: any, idx: number) => (
                                        <div key={idx} className="p-6 rounded-2xl border border-slate-800 bg-white/5 space-y-2">
                                            <p className="font-bold text-slate-200 text-lg">{vol.org}</p>
                                            <p className="text-slate-400">{vol.role}</p>
                                            <p className="text-sm text-slate-500">{vol.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="glass-card p-10 space-y-8 border-l-4 border-l-emerald-500/50">
                                <h4 className="text-xl font-bold text-slate-300 border-b border-slate-800 pb-6">Discovered Achievements</h4>
                                <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    {extractedData.discoveredAchievements?.map((ach: any, idx: number) => (
                                        <div key={idx} className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-2">
                                            <h5 className="font-bold text-brand-400 text-lg">{ach.title}</h5>
                                            <p className="text-slate-400 leading-relaxed">{ach.description}</p>
                                            {ach.metric && (
                                                <div className="mt-3">
                                                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase px-3 py-1 rounded-lg border border-emerald-500/20 tracking-wider">
                                                        METRIC: {ach.metric}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 w-full">
            <div className="w-full space-y-6">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-brand-600 to-emerald-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                    <textarea
                        placeholder="Paste your resume here (Work History, Achievements, Skills, Education)... The more detail you add, the stronger your semantic match will be."
                        className="relative w-full h-[750px] bg-slate-900/80 border border-slate-700/50 rounded-2xl p-10 text-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all resize-none text-xl leading-[1.6] shadow-2xl backdrop-blur-xl custom-scrollbar"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-center gap-4 animate-in fade-in zoom-in-95">
                        <AlertCircle size={24} className="flex-shrink-0" />
                        <p className="font-medium text-sm">{error}</p>
                    </div>
                )}

                <div className="space-y-4">
                    <button
                        id="start-extraction-btn"
                        onClick={handleExtract}
                        disabled={!text.trim() || isExtracting}
                        className="w-full py-5 font-black bg-brand-600 hover:bg-brand-500 text-white rounded-2xl transition-all shadow-xl shadow-brand-600/20 disabled:opacity-50 flex items-center justify-center gap-4 text-2xl active:scale-[0.98] cursor-pointer uppercase tracking-tight"
                    >
                        {isExtracting ? <Loader2 className="animate-spin" size={28} /> : null}
                        {isExtracting ? "Extracting..." : "Extract My Profile"}
                    </button>
                    <p className="text-center text-slate-500 text-xs font-bold uppercase tracking-widest opacity-60">
                        Your data is used only to generate your documents. Nothing is shared.
                    </p>
                </div>
            </div>
        </div>
    );
};

