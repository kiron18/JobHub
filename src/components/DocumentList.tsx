import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Clock, Trash2, Loader2 } from 'lucide-react';
import api from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';

interface Document {
    id: string;
    title: string;
    type: string;
    createdAt: string;
    content: string;
}

export const DocumentList: React.FC = () => {
    const queryClient = useQueryClient();
    const [deletingId, setDeletingId] = React.useState<string | null>(null);

    const { data: documents, isLoading } = useQuery<Document[]>({
        queryKey: ['documents'],
        queryFn: async () => {
            const { data } = await api.get('/documents');
            return data;
        }
    });

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this document?')) return;
        setDeletingId(id);
        try {
            await api.delete(`/documents/${id}`);
            queryClient.invalidateQueries({ queryKey: ['documents'] });
        } catch (error) {
            alert('Failed to delete document');
        } finally {
            setDeletingId(null);
        }
    };

    if (isLoading) {
        return <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-slate-800/50 rounded-2xl"></div>
            ))}
        </div>;
    }

    if (!documents || documents.length === 0) {
        return (
            <div className="glass-card p-12 text-center space-y-4">
                <FileText className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-xl font-bold text-slate-400">No documents yet</h3>
                <p className="text-slate-500 max-w-xs mx-auto">Upload your resumes or cover letters to get started with intelligent matching.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {documents.map((doc) => (
                <div key={doc.id} className="glass-card p-6 flex flex-col justify-between hover:border-brand-500/50 transition-all group relative">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-brand-600/10 rounded-xl flex items-center justify-center text-brand-500">
                            <FileText size={24} />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="bg-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border border-slate-700">
                                {doc.type}
                            </span>
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <h4 className="font-bold text-slate-200 truncate pr-8">{doc.title || 'Untitled Document'}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Clock size={12} />
                            <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between">
                        <button className="text-sm font-bold text-brand-500 hover:text-brand-400 transition-colors uppercase tracking-widest flex items-center gap-2 text-[10px]">
                            View Content →
                        </button>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                                onClick={() => handleDelete(doc.id)}
                                disabled={deletingId === doc.id}
                                className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                            >
                                {deletingId === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
