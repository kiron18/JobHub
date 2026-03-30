/**
 * FeedbackBar — compact star rating + weak section picker for generated documents.
 *
 * Appears below a generated document. Submits silently, collapses to a checkmark on success.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Star } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'sonner';

type DocTab = 'resume' | 'cover-letter' | 'selection-criteria' | 'interview-prep';

const WEAK_SECTIONS: Record<DocTab, { value: string; label: string }[]> = {
    'resume': [
        { value: 'opening', label: 'Summary / Opening' },
        { value: 'evidence', label: 'Bullet quality' },
        { value: 'overall', label: 'Overall' },
    ],
    'cover-letter': [
        { value: 'opening', label: 'Opening hook' },
        { value: 'evidence', label: 'Evidence & examples' },
        { value: 'company_connection', label: 'Company connection' },
        { value: 'closing', label: 'Closing' },
        { value: 'overall', label: 'Overall' },
    ],
    'selection-criteria': [
        { value: 'criterion_address', label: 'Addresses criterion' },
        { value: 'evidence_quality', label: 'Evidence quality' },
        { value: 'word_count', label: 'Word count' },
        { value: 'star_proportion', label: 'STAR balance' },
        { value: 'overall', label: 'Overall' },
    ],
    'interview-prep': [
        { value: 'evidence', label: 'Evidence & examples' },
        { value: 'overall', label: 'Overall' },
    ],
};

interface Props {
    documentId: string;
    docTab: DocTab;
}

export const FeedbackBar: React.FC<Props> = ({ documentId, docTab }) => {
    const [rating, setRating] = useState(0);
    const [hovered, setHovered] = useState(0);
    const [weakSection, setWeakSection] = useState('');
    const [freeText, setFreeText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const sections = WEAK_SECTIONS[docTab] ?? WEAK_SECTIONS['resume'];

    const handleSubmit = async () => {
        if (rating === 0) return;
        setSubmitting(true);
        try {
            await api.post('/feedback/document', {
                documentId,
                rating,
                weakSection: weakSection || undefined,
                freeText: freeText.trim() || undefined,
            });
            setSubmitted(true);
        } catch {
            toast.error('Could not save feedback — thanks anyway.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AnimatePresence mode="wait">
            {submitted ? (
                <motion.div
                    key="done"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs text-emerald-400"
                >
                    <CheckCircle size={13} />
                    <span>Thanks for the feedback</span>
                </motion.div>
            ) : (
                <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-slate-800/60 bg-slate-900/40"
                >
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest whitespace-nowrap">
                        How did this land?
                    </span>

                    {/* Stars */}
                    <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(n => (
                            <button
                                key={n}
                                onClick={() => setRating(n)}
                                onMouseEnter={() => setHovered(n)}
                                onMouseLeave={() => setHovered(0)}
                                className="p-0.5 transition-transform hover:scale-110"
                                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                            >
                                <Star
                                    size={14}
                                    className={
                                        n <= (hovered || rating)
                                            ? 'fill-amber-400 text-amber-400'
                                            : 'text-slate-600'
                                    }
                                />
                            </button>
                        ))}
                    </div>

                    {/* Weak section picker — only shown once a star is selected */}
                    <AnimatePresence>
                        {rating > 0 && rating <= 3 && (
                            <motion.select
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                value={weakSection}
                                onChange={e => setWeakSection(e.target.value)}
                                className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-brand-500"
                            >
                                <option value="">What was weakest?</option>
                                {sections.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </motion.select>
                        )}
                    </AnimatePresence>

                    {/* Free text — only when rated */}
                    <AnimatePresence>
                        {rating > 0 && (
                            <motion.input
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                type="text"
                                placeholder="Anything specific?"
                                value={freeText}
                                onChange={e => setFreeText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                                maxLength={200}
                                className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-brand-500 min-w-0 flex-1 max-w-48"
                            />
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {rating > 0 && (
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white transition-colors uppercase tracking-wider"
                            >
                                {submitting ? '...' : 'Submit'}
                            </motion.button>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
