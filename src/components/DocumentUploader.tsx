import React, { useState, useRef } from 'react';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';

export const DocumentUploader: React.FC = () => {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setError(null);
        setSuccess(false);

        try {
            const formData = new FormData();
            formData.append('file', file);
            
            await api.post('/documents/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setSuccess(true);
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to upload document. Please try again.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };


    return (
        <div className="glass-card p-1">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".txt,.md,.pdf" // PDF will fail reader.readAsText but it's a hint
            />
            
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`w-full p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 transition-all
                    ${isUploading ? 'border-brand-500/20 bg-brand-500/5' : 'border-slate-800 hover:border-brand-500/50 hover:bg-brand-500/5 cursor-pointer'}
                    ${success ? 'border-emerald-500/50 bg-emerald-500/5' : ''}
                `}
            >
                {isUploading ? (
                    <>
                        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
                        <p className="font-bold text-slate-300">Uploading Document...</p>
                    </>
                ) : success ? (
                    <>
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                        <p className="font-bold text-emerald-400">Successfully Uploaded!</p>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-slate-400">
                            <Upload size={24} />
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-slate-200">Click to upload source document</p>
                            <p className="text-sm text-slate-500 mt-1">Supports TXT, MD, PDF (text extraction coming soon)</p>
                        </div>
                    </>
                )}
            </button>

            {error && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};
