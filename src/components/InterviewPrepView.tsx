import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Eye, EyeOff, Lightbulb } from 'lucide-react';

interface StoryCard {
    title: string;
    hook: string;
    context: string;
    actions: string[];
    result: string;
    covers: string[];
}

interface QuestionType {
    type: 'behavioural' | 'situational' | 'motivation' | 'role-specific';
    label: string;
    description: string;
    useStory: string;
    questions: string[];
}

interface InterviewPrepData {
    companyIntelligence: string[];
    lookingFor: string;
    watchOuts: string[];
    storyBank: StoryCard[];
    proveIt: QuestionType[];
    questionsToAsk: string[];
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; border: string; dot: string }> = {
    behavioural:    { color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/25', dot: 'bg-indigo-400' },
    situational:    { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25',  dot: 'bg-amber-400' },
    motivation:     { color: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/25',   dot: 'bg-pink-400' },
    'role-specific':{ color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25',dot: 'bg-emerald-400' },
};

function parseInterviewDoc(raw: string): InterviewPrepData {
    const result: InterviewPrepData = {
        companyIntelligence: [],
        lookingFor: '',
        watchOuts: [],
        storyBank: [],
        proveIt: [],
        questionsToAsk: [],
    };

    const lines = raw.split('\n');
    let section: string = '';
    let subSection: string = '';
    let currentStory: Partial<StoryCard> | null = null;
    let currentQType: Partial<QuestionType> | null = null;
    let lookingForLines: string[] = [];

    const flushStory = () => {
        if (currentStory?.title && currentStory.hook) {
            result.storyBank.push({
                title: currentStory.title,
                hook: currentStory.hook,
                context: currentStory.context || '',
                actions: currentStory.actions || [],
                result: currentStory.result || '',
                covers: currentStory.covers || [],
            });
        }
        currentStory = null;
    };

    const flushQType = () => {
        if (currentQType?.type && currentQType.questions?.length) {
            result.proveIt.push({
                type: currentQType.type,
                label: currentQType.label || currentQType.type,
                description: currentQType.description || '',
                useStory: currentQType.useStory || '',
                questions: currentQType.questions,
            });
        }
        currentQType = null;
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Top-level section detection
        if (/^#{1,3}\s*1\.\s*know the stage/i.test(line)) { section = 'know'; subSection = ''; continue; }
        if (/^#{1,3}\s*2\.\s*story bank/i.test(line)) { section = 'stories'; flushStory(); subSection = ''; continue; }
        if (/^#{1,3}\s*3\.\s*prove it/i.test(line)) { section = 'prove'; flushStory(); flushQType(); subSection = ''; continue; }
        if (/^#{1,3}\s*4\.\s*questions to ask/i.test(line)) { section = 'ask'; flushQType(); subSection = ''; continue; }

        // Sub-sections within "Know the Stage"
        if (section === 'know') {
            if (/^#{2,4}\s*company intelligence/i.test(line)) { subSection = 'company'; continue; }
            if (/^#{2,4}\s*what they.re looking for/i.test(line)) { subSection = 'looking'; lookingForLines = []; continue; }
            if (/^#{2,4}\s*watch.out/i.test(line)) { subSection = 'watchouts'; continue; }

            if (subSection === 'company') {
                const bullet = line.replace(/^[-*]\s*/, '');
                if (bullet) result.companyIntelligence.push(bullet);
            } else if (subSection === 'looking') {
                lookingForLines.push(line);
                result.lookingFor = lookingForLines.join(' ');
            } else if (subSection === 'watchouts') {
                const bullet = line.replace(/^[-*]\s*/, '');
                if (bullet) result.watchOuts.push(bullet);
            }
        }

        // Story Bank parsing
        if (section === 'stories') {
            const storyHeading = line.match(/^#{2,4}\s*story:\s*(.+)/i);
            if (storyHeading) {
                flushStory();
                currentStory = { title: storyHeading[1].trim(), actions: [] };
                continue;
            }
            if (currentStory) {
                const hookMatch = line.match(/^\*{0,2}hook[:\s]+\*{0,2}\s*(.+)/i);
                const cMatch = line.match(/^\*{0,2}c[:\s]+\*{0,2}\s*(.+)/i);
                const aMatch = line.match(/^\*{0,2}a[:\s]+\*{0,2}\s*(.+)/i);
                const rMatch = line.match(/^\*{0,2}r[:\s]+\*{0,2}\s*(.+)/i);
                const coversMatch = line.match(/^\*{0,2}covers[:\s]+\*{0,2}\s*(.+)/i);
                const bulletMatch = line.match(/^[-*]\s+(.+)/);

                if (hookMatch) { currentStory.hook = hookMatch[1].replace(/\*+/g, '').trim(); }
                else if (cMatch) { currentStory.context = cMatch[1].replace(/\*+/g, '').trim(); }
                else if (aMatch) {
                    const actions = aMatch[1].replace(/\*+/g, '').trim();
                    currentStory.actions = actions.split(/[;,]/).map(s => s.trim()).filter(Boolean);
                }
                else if (rMatch) { currentStory.result = rMatch[1].replace(/\*+/g, '').trim(); }
                else if (coversMatch) {
                    currentStory.covers = coversMatch[1].replace(/\*+/g, '').split(',').map(s => s.trim()).filter(Boolean);
                }
                else if (bulletMatch && currentStory.actions !== undefined) {
                    // Multi-line action bullets
                    const lastKey = Object.keys(currentStory).reverse().find(k => k === 'actions');
                    if (lastKey) currentStory.actions!.push(bulletMatch[1].trim());
                }
            }
        }

        // Prove It parsing
        if (section === 'prove') {
            const typeHeadings: Record<string, QuestionType['type']> = {
                behavioural: 'behavioural', behavioral: 'behavioural',
                situational: 'situational', motivation: 'motivation',
                'role-specific': 'role-specific', rolespecific: 'role-specific',
            };
            const headingMatch = line.match(/^#{2,4}\s*(.+)/);
            if (headingMatch) {
                const key = headingMatch[1].toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
                const matched = Object.keys(typeHeadings).find(k => key.includes(k.replace(/-/g, '')));
                if (matched) {
                    flushQType();
                    const typeKey = typeHeadings[matched];
                    const labelMap: Record<string, string> = {
                        behavioural: 'Behavioural', situational: 'Situational',
                        motivation: 'Motivation', 'role-specific': 'Role-Specific',
                    };
                    currentQType = { type: typeKey, label: labelMap[typeKey], questions: [] };
                    continue;
                }
            }
            if (currentQType) {
                const whatMatch = line.match(/^\*{0,2}what these are[:\s]+\*{0,2}\s*(.+)/i);
                const useMatch = line.match(/^\*{0,2}use[:\s]+\*{0,2}\s*(.+)/i);
                const qMatch = line.match(/^\d+\.\s+(.+)/);
                if (whatMatch) { currentQType.description = whatMatch[1].replace(/\*+/g, '').trim(); }
                else if (useMatch) { currentQType.useStory = useMatch[1].replace(/\*+/g, '').trim(); }
                else if (qMatch) { currentQType.questions!.push(qMatch[1].trim()); }
            }
        }

        // Questions to Ask
        if (section === 'ask') {
            const bullet = line.replace(/^[-*\d.]\s*/, '');
            if (bullet && !/^#{1,4}/.test(line)) result.questionsToAsk.push(bullet);
        }
    }

    flushStory();
    flushQType();
    return result;
}

// ── Collapsible wrapper ───────────────────────────────────────────────────────
function CollapsibleSection({ title, accent, defaultOpen = false, children }: {
    title: string;
    accent?: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-xl border border-slate-800 overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-900/60 hover:bg-slate-900/80 transition-colors text-left"
            >
                <span className={`text-[10px] font-black uppercase tracking-widest ${accent || 'text-slate-400'}`}>{title}</span>
                <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.18 }}>
                    <ChevronRight size={13} className="text-slate-500" />
                </motion.div>
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="p-5">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Story Card ────────────────────────────────────────────────────────────────
function StoryCardItem({ story }: { story: StoryCard }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="rounded-xl border border-brand-600/30 bg-brand-600/5 overflow-hidden">
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full text-left p-4 hover:bg-brand-600/10 transition-colors"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                        <p className="text-[9px] font-black text-brand-400 uppercase tracking-widest">{story.title}</p>
                        <p className="text-sm font-bold text-slate-100 leading-snug">{story.hook}</p>
                    </div>
                    <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.18 }} className="shrink-0 mt-0.5">
                        <ChevronRight size={13} className="text-slate-500" />
                    </motion.div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {story.covers.map((tag, i) => (
                        <span key={i} className="text-[9px] font-bold text-slate-400 bg-slate-800 rounded px-2 py-0.5 border border-slate-700/50">
                            {tag}
                        </span>
                    ))}
                </div>
            </button>
            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-brand-600/20">
                            {story.context && (
                                <div className="pt-3">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">C, Context</span>
                                    <p className="text-[12px] text-slate-400 leading-relaxed mt-1">{story.context}</p>
                                </div>
                            )}
                            {story.actions.length > 0 && (
                                <div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">A, Action</span>
                                        <span className="text-[9px] text-slate-600 italic">pick the most relevant one</span>
                                    </div>
                                    <ul className="mt-1.5 space-y-1">
                                        {story.actions.map((a, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="text-brand-500 text-[10px] font-black mt-0.5 shrink-0">{i + 1}.</span>
                                                <span className="text-[12px] text-slate-300 leading-snug">{a}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {story.result && (
                                <div>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">R, Result</span>
                                    <p className="text-[12px] text-emerald-400/90 leading-relaxed mt-1 font-medium">{story.result}</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Question Type Panel ───────────────────────────────────────────────────────
function ProveItPanel({ qt, company, role }: { qt: QuestionType; company: string; role: string }) {
    const [open, setOpen] = useState(false);
    const [revealed, setRevealed] = useState<number | null>(null);
    const cfg = TYPE_CONFIG[qt.type] || TYPE_CONFIG.behavioural;

    return (
        <div className={`rounded-xl border ${cfg.border} overflow-hidden`}>
            <button
                onClick={() => { setOpen(o => !o); setRevealed(null); }}
                className={`w-full flex items-center justify-between px-5 py-3.5 ${cfg.bg} hover:opacity-90 transition-opacity text-left`}
            >
                <div className="space-y-0.5">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>{qt.label}</span>
                    {qt.description && (
                        <p className="text-[11px] text-slate-400 leading-snug">{qt.description}</p>
                    )}
                </div>
                <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.18 }}>
                    <ChevronRight size={13} className="text-slate-500" />
                </motion.div>
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 space-y-3">
                            {qt.useStory && (
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${cfg.bg} border ${cfg.border}`}>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Deploy:</span>
                                    <span className={`text-[10px] font-bold ${cfg.color}`}>{qt.useStory}</span>
                                </div>
                            )}
                            <div className="space-y-2">
                                {qt.questions.map((q, i) => (
                                    <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden">
                                        <div className="flex items-start gap-3 p-3">
                                            <span className={`text-[9px] font-black ${cfg.color} shrink-0 mt-0.5`}>{i + 1}.</span>
                                            <p className="text-[12px] text-slate-200 leading-snug flex-1">{q}</p>
                                            <button
                                                onClick={() => setRevealed(revealed === i ? null : i)}
                                                className="shrink-0 flex items-center gap-1 text-[9px] font-black text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-wider"
                                            >
                                                {revealed === i ? <EyeOff size={10} /> : <Eye size={10} />}
                                                {revealed === i ? 'Hide' : 'Answer'}
                                            </button>
                                        </div>
                                        <AnimatePresence initial={false}>
                                            {revealed === i && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="px-3 pb-3 pt-0 space-y-2.5 border-t border-slate-800">
                                                        <p className="text-[11px] text-slate-400 leading-relaxed pt-2.5">
                                                            Open with your <span className={`font-bold ${cfg.color}`}>{qt.useStory}</span> story. Lead with the hook, expand through C-A-R.
                                                        </p>
                                                        {(company || role) && (
                                                            <div className="flex items-start gap-2 rounded-lg bg-slate-800/60 border border-slate-700/40 px-3 py-2.5">
                                                                <Lightbulb size={11} className="text-amber-400 shrink-0 mt-0.5" />
                                                                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                                                                    After landing the result, connect it forward: show how that experience is exactly what {company || 'this organisation'} needs{role ? ` in a ${role}` : ''}.
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function InterviewPrepView({ doc, company, role }: { doc: string; company: string; role: string }) {
    const data = parseInterviewDoc(doc);
    const [showContrast, setShowContrast] = useState(false);

    const hasKnow = data.companyIntelligence.length > 0 || data.lookingFor || data.watchOuts.length > 0;
    const hasStories = data.storyBank.length > 0;
    const hasProve = data.proveIt.length > 0;
    const hasAsk = data.questionsToAsk.length > 0;

    if (!hasKnow && !hasStories && !hasProve) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-4 max-w-sm mx-auto text-center">
                <p className="text-slate-300 font-bold text-sm">Format updated</p>
                <p className="text-slate-500 text-[13px] leading-relaxed">
                    This prep was generated in an older format. Hit Re-generate to build your Story Bank and question coaching.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl space-y-4">

            {/* Section 1, Know the Stage */}
            {hasKnow && (
                <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">01, Know the Stage</p>
                    {data.companyIntelligence.length > 0 && (
                        <CollapsibleSection title="Company Intelligence" defaultOpen={true}>
                            <ul className="space-y-2">
                                {data.companyIntelligence.map((fact, i) => (
                                    <li key={i} className="flex items-start gap-2.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0 mt-1.5" />
                                        <span className="text-[13px] text-slate-300 leading-relaxed">{fact}</span>
                                    </li>
                                ))}
                            </ul>
                        </CollapsibleSection>
                    )}
                    {data.lookingFor && (
                        <CollapsibleSection title="What They're Looking For">
                            <p className="text-[13px] text-slate-300 leading-relaxed">{data.lookingFor}</p>
                        </CollapsibleSection>
                    )}
                    {data.watchOuts.length > 0 && (
                        <CollapsibleSection title="Watch-Outs" accent="text-amber-400">
                            <ul className="space-y-2">
                                {data.watchOuts.map((w, i) => (
                                    <li key={i} className="flex items-start gap-2.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 shrink-0 mt-1.5" />
                                        <span className="text-[13px] text-amber-200/80 leading-relaxed">{w}</span>
                                    </li>
                                ))}
                            </ul>
                        </CollapsibleSection>
                    )}
                </div>
            )}

            {/* Section 2, Story Bank */}
            {hasStories && (
                <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">02, Your Story Bank</p>

                    {/* Educational panel */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            Know these {data.storyBank.length} stories and you can answer anything.
                            Every question an interviewer asks is an invitation to deploy one of them.
                        </p>
                        <button
                            onClick={() => setShowContrast(s => !s)}
                            className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-wider"
                        >
                            <ChevronDown size={10} className={`transition-transform ${showContrast ? 'rotate-180' : ''}`} />
                            {showContrast ? 'Hide example' : 'See why specificity wins'}
                        </button>
                        <AnimatePresence initial={false}>
                            {showContrast && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="space-y-2 pt-1">
                                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
                                            <p className="text-[9px] font-black text-red-400 uppercase tracking-wider mb-1">Weak</p>
                                            <p className="text-[12px] text-slate-400 italic">"I helped improve a reporting process and the client was happy."</p>
                                        </div>
                                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                                            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-wider mb-1">Strong</p>
                                            <p className="text-[12px] text-slate-200 italic">"When our client reporting was running three weeks behind, I rebuilt the pipeline from scratch. The client extended the contract as a direct result."</p>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">Same story. Same candidate. One gets an offer.</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="space-y-2">
                        {data.storyBank.map((story, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.22, delay: i * 0.04, ease: [0.25, 1, 0.5, 1] }}
                            >
                                <StoryCardItem story={story} />
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Section 3, Prove It */}
            {hasProve && (
                <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">03, Prove It</p>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            Open each question type, read the question, then reveal the answer.
                            Practise until reaching for the right story feels automatic.
                        </p>
                    </div>
                    <div className="space-y-2">
                        {data.proveIt.map((qt, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.22, delay: i * 0.05, ease: [0.25, 1, 0.5, 1] }}
                            >
                                <ProveItPanel qt={qt} company={company} role={role} />
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Section 4, Questions to Ask */}
            {hasAsk && (
                <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">04, Questions to Ask</p>
                    <CollapsibleSection title="Your Questions">
                        <ul className="space-y-2">
                            {data.questionsToAsk.map((q, i) => (
                                <li key={i} className="flex items-start gap-2.5">
                                    <span className="text-[10px] font-black text-brand-500 shrink-0 mt-0.5">{i + 1}.</span>
                                    <span className="text-[13px] text-slate-300 leading-relaxed">{q}</span>
                                </li>
                            ))}
                        </ul>
                    </CollapsibleSection>
                </div>
            )}
        </div>
    );
}
