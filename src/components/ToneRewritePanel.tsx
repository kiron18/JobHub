import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Wand2, Copy, CheckCircle, ChevronDown } from 'lucide-react';
import api from '../lib/api';

const TONES = [
    { id: 'confident',  label: 'Confident',  desc: 'Strong active verbs, no hedging' },
    { id: 'concise',    label: 'Concise',     desc: 'Cut every unnecessary word' },
    { id: 'formal',     label: 'Formal',      desc: 'Australian business register' },
    { id: 'warm',       label: 'Warm',        desc: 'Personable yet professional' },
    { id: 'technical',  label: 'Technical',   desc: 'Precise specialist language' },
] as const;

type ToneId = typeof TONES[number]['id'];

interface ToneRewritePanelProps {
    document: string;
    docType?: string;
}

export function ToneRewritePanel({ document, docType }: ToneRewritePanelProps) {
    const [selectedTone, setSelectedTone] = useState<ToneId>('confident');
    const [customText, setCustomText] = useState('');
    const [rewritten, setRewritten] = useState<string | null>(null);
    const [changes, setChanges] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [useCustom, setUseCustom] = useState(false);
    const [open, setOpen] = useState(false);

    const run = async () => {
        const text = useCustom ? customText : document;
        if (!text.trim() || loading) return;

        setLoading(true);
        setRewritten(null);
        setChanges(null);
        try {
            const { data } = await api.post('/analyze/tone-rewrite', {
                text: text.slice(0, 3000),
                tone: selectedTone,
                context: docType || 'resume',
            });
            setRewritten(data.rewritten || null);
            setChanges(data.changes || null);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (!rewritten) return;
        navigator.clipboard.writeText(rewritten);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Header toggle */}
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Wand2 size={12} color="#c084fc" />
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#c084fc', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Tone Rewrite
                    </span>
                </div>
                <ChevronDown
                    size={12}
                    color="#4b5563"
                    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 2 }}>
                            {/* Tone selector */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {TONES.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setSelectedTone(t.id)}
                                        title={t.desc}
                                        style={{
                                            padding: '4px 9px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                                            cursor: 'pointer', transition: 'all 0.12s',
                                            border: selectedTone === t.id ? '1px solid rgba(192,132,252,0.5)' : '1px solid rgba(255,255,255,0.07)',
                                            background: selectedTone === t.id ? 'rgba(192,132,252,0.15)' : 'rgba(255,255,255,0.03)',
                                            color: selectedTone === t.id ? '#c084fc' : '#6b7280',
                                        }}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            {/* Option: custom text */}
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={useCustom}
                                    onChange={e => setUseCustom(e.target.checked)}
                                    style={{ accentColor: '#c084fc', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: 10, color: '#6b7280' }}>Rewrite a specific paragraph instead</span>
                            </label>

                            {useCustom && (
                                <textarea
                                    value={customText}
                                    onChange={e => setCustomText(e.target.value)}
                                    placeholder="Paste the paragraph you want to rewrite…"
                                    rows={3}
                                    style={{
                                        width: '100%', boxSizing: 'border-box', padding: '8px 10px',
                                        borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                                        background: 'rgba(255,255,255,0.04)', color: '#e2e8f0',
                                        fontSize: 11, lineHeight: 1.5, resize: 'vertical', outline: 'none',
                                    }}
                                />
                            )}

                            <button
                                onClick={run}
                                disabled={loading || (!document && !customText.trim())}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                    padding: '6px 12px', borderRadius: 7,
                                    border: '1px solid rgba(192,132,252,0.3)',
                                    background: 'rgba(192,132,252,0.08)',
                                    color: (loading || (!document && !customText.trim())) ? '#6b7280' : '#c084fc',
                                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                    opacity: (loading || (!document && !customText.trim())) ? 0.6 : 1,
                                }}
                            >
                                {loading ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                                {loading ? 'Rewriting…' : 'Rewrite'}
                            </button>

                            {/* Result */}
                            <AnimatePresence>
                                {rewritten && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                                    >
                                        <div style={{
                                            borderRadius: 8, padding: '10px 12px',
                                            border: '1px solid rgba(192,132,252,0.2)',
                                            background: 'rgba(192,132,252,0.05)',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                <span style={{ fontSize: 9, fontWeight: 800, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                                    Rewritten ({TONES.find(t => t.id === selectedTone)?.label})
                                                </span>
                                                <button
                                                    onClick={handleCopy}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#34d399' : '#6b7280', padding: 2 }}
                                                >
                                                    {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
                                                </button>
                                            </div>
                                            <p style={{ fontSize: 11, color: '#e2e8f0', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{rewritten}</p>
                                        </div>
                                        {changes && (
                                            <p style={{ fontSize: 10, color: '#6b7280', margin: 0, fontStyle: 'italic' }}>
                                                {changes}
                                            </p>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
