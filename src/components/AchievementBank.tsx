import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Trophy, 
    Plus, 
    Trash2, 
    Edit2, 
    Save, 
    Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';

interface Achievement {
    id: string;
    title: string;
    description: string;
    metric?: string;
    metricType?: string;
}

export const AchievementBank: React.FC = () => {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Achievement>>({});
    const [isCreating, setIsCreating] = useState(false);

    // Fetch achievements with caching to prevent frequent resyncs
    const { data: achievements, isLoading, error } = useQuery<Achievement[]>({
        queryKey: ['achievements'],
        queryFn: async () => {
            const { data } = await api.get('/achievements');
            return data;
        },
        staleTime: 10 * 60 * 1000, // 10 minutes
        gcTime: 30 * 60 * 1000,    // 30 minutes
    });

    // Mutations
    const updateMutation = useMutation({
        mutationFn: async (achievement: Achievement) => {
            await api.patch(`/achievements/${achievement.id}`, achievement);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['achievements'] });
            setEditingId(null);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/achievements/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['achievements'] });
        }
    });

    const createMutation = useMutation({
        mutationFn: async (achievement: Partial<Achievement>) => {
            await api.post('/achievements', achievement);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['achievements'] });
            setIsCreating(false);
            setEditForm({});
        }
    });

    const handleEdit = (achievement: Achievement) => {
        setEditingId(achievement.id);
        setEditForm(achievement);
    };

    const handleSave = () => {
        if (editingId && editingId !== 'new') {
            updateMutation.mutate(editForm as Achievement);
        } else {
            createMutation.mutate(editForm);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8 space-y-2">
                <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest animate-pulse ml-2">Syncing...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                <p className="text-xs text-red-400 font-bold uppercase tracking-widest leading-relaxed">
                    Sync Error <br/> <span className="opacity-50 font-medium text-[8px]">Check API connection</span>
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <header className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <Trophy size={14} className="text-brand-500" />
                    <h2 className="text-sm font-black text-white uppercase tracking-wider">Bank</h2>
                </div>
                
                <button 
                    onClick={() => setIsCreating(true)}
                    className="p-1 hover:bg-white/5 text-slate-500 hover:text-brand-500 rounded transition-colors"
                >
                    <Plus size={14} />
                </button>
            </header>

            <div className="p-2 space-y-2">
                <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                    <AnimatePresence mode="popLayout">
                        {isCreating && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="achievement-pill border-brand-500/50 bg-brand-500/5 ring-1 ring-brand-500/20 p-3 space-y-3"
                            >
                                <div className="space-y-2">
                                    <input 
                                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-2 py-1 text-sm text-white font-bold focus:ring-1 focus:ring-brand-500 placeholder:text-slate-600"
                                        placeholder="Title (e.g. Lead Gen)"
                                        value={editForm.title || ''}
                                        onChange={e => setEditForm({...editForm, title: e.target.value})}
                                        autoFocus
                                    />
                                    <textarea 
                                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-2 py-1 text-xs text-slate-300 focus:ring-1 focus:ring-brand-500 placeholder:text-slate-600 resize-none h-16"
                                        placeholder="Description..."
                                        value={editForm.description || ''}
                                        onChange={e => setEditForm({...editForm, description: e.target.value})}
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                    <button 
                                        onClick={() => setIsCreating(false)}
                                        className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleSave}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-all text-xs font-bold shadow-lg shadow-brand-500/20"
                                    >
                                        <Save size={12} />
                                        Save
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {achievements?.map((achievement) => (
                            <motion.div
                                key={achievement.id}
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={`achievement-pill p-3 group ${editingId === achievement.id ? 'border-brand-500/50 bg-brand-500/5' : ''}`}
                            >
                                {editingId === achievement.id ? (
                                    <div className="space-y-3 w-full">
                                        <div className="space-y-2">
                                            <input 
                                                className="w-full bg-slate-950/50 border border-slate-700/50 rounded-lg px-2 py-1 text-sm text-white font-bold focus:ring-1 focus:ring-brand-500"
                                                value={editForm.title || ''}
                                                onChange={e => setEditForm({...editForm, title: e.target.value})}
                                            />
                                            <textarea 
                                                className="w-full bg-slate-950/50 border border-slate-700/50 rounded-lg px-2 py-1 text-xs text-slate-300 focus:ring-1 focus:ring-brand-500 resize-none h-16"
                                                value={editForm.description || ''}
                                                onChange={e => setEditForm({...editForm, description: e.target.value})}
                                            />
                                        </div>
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => setEditingId(null)}
                                                className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-white"
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                onClick={handleSave}
                                                className="flex items-center gap-1.5 px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-all text-xs font-bold shadow-lg"
                                            >
                                                <Save size={12} />
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2 w-full">
                                        <div className="flex items-start justify-between">
                                            <h4 className="font-bold text-slate-100 group-hover:text-brand-400 transition-colors text-sm">{achievement.title}</h4>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleEdit(achievement)}
                                                    className="p-1 hover:bg-white/5 text-slate-500 hover:text-brand-500 rounded transition-colors"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => deleteMutation.mutate(achievement.id)}
                                                    className="p-1 hover:bg-white/5 text-slate-500 hover:text-red-400 rounded transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400 font-medium leading-relaxed group-hover:text-slate-300 transition-colors">
                                            {achievement.description}
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {(!achievements || achievements.length === 0) && !isCreating && (
                    <div className="py-12 text-center space-y-3">
                        <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto text-slate-600">
                            <Trophy size={24} />
                        </div>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Empty Bank</p>
                    </div>
                )}
            </div>
        </div>
    );
};
