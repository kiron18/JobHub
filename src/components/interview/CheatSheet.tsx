import { useEffect, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import type { CheatSheet as Sheet } from './parseCheatSheet';

/**
 * The call companion.
 *
 * Three ideas carry this page and everything else is subordinate to them.
 *
 * ONE: content is split by WHEN it is used, not by what it is. With the phone
 * in your hand you need words to say and the facts you cannot fumble. The ad
 * analysis, the cliche swaps and the tone notes are worth reading, but they are
 * worth reading forty-five minutes earlier.
 *
 * TWO: one thing is loud. Scripts sit in blue-edged cards at a size nothing
 * else on the page uses, and everything explaining a script is quieter than it.
 *
 * THREE: the first pass is a map, not a document. OVERVIEW holds the whole call
 * on one screen: the frame, what the job wants, the questions, the risk, the
 * facts. It answers nothing in full, on purpose. Reading the questions before
 * reading any answer is what makes the answers land, and every row is a tap
 * through to its own script, so the map and the detail are the same object seen
 * at two zoom levels rather than two documents to keep in sync.
 */

const c = warm.colors;

/* One type scale. A size that is not on this list does not belong on the page. */
const T = {
    pageTitle: { fontSize: 26, lineHeight: 1.25, fontWeight: 700 },
    section:   { fontSize: 19, lineHeight: 1.3, fontWeight: 700 },
    script:    { fontSize: 18, lineHeight: 1.55, fontWeight: 500 },
    question:  { fontSize: 17, lineHeight: 1.4, fontWeight: 600 },
    body:      { fontSize: 15, lineHeight: 1.6, fontWeight: 400 },
    meta:      { fontSize: 13.5, lineHeight: 1.55, fontWeight: 400 },
} as const;

/**
 * The state notes. Templated, identical for everybody, and deliberately not
 * generated: what a nervous person needs ninety seconds before a call does not
 * vary by employer, and a model asked to write it produces horoscopes. Three
 * groups because it goes wrong in three places, body, head and nerves, and
 * knowing which one is misfiring is most of fixing it.
 */
const GROUNDING: { group: string; items: string[] }[] = [
    {
        group: 'Your body',
        items: [
            'Stand up, plant both feet, and take three slow breaths with the out-breath longer than the in. That steadies your voice more than any amount of rehearsing.',
            'Shoulders back, and sit forward rather than back. Posture is audible down a phone line.',
            'Say your opening line out loud once, at full volume, before you dial. The first sentence of the day is always the roughest, so do not let it be the one they hear.',
        ],
    },
    {
        group: 'Your head',
        items: [
            'They read your application and chose to spend half an hour on you. You have already passed a filter that most people did not.',
            'You are a qualified professional talking to another professional about work. You are not a student being marked.',
            'You are assessing them too. You are allowed to finish the call unsure about the job.',
        ],
    },
    {
        group: 'Your nerves',
        items: [
            'Nerves and readiness feel the same in the body: quick heart, warm hands, narrow focus. Call it readiness and it behaves like readiness.',
            'You are allowed to pause. Two seconds of silence sounds like consideration to everybody except you.',
            'If you go blank, say so and buy the time: "Let me think about that properly for a second." It reads as care, not as a gap.',
        ],
    },
];

// ── shared bits ──────────────────────────────────────────────────────────────

function Section({ id, title, note, children }: {
    id?: string; title: string; note?: string; children: React.ReactNode;
}) {
    return (
        <section id={id} style={{ marginBottom: 44 }}>
            <h2 style={{ ...T.section, margin: 0, color: c.textPrimary }}>{title}</h2>
            {note && <p style={{ ...T.meta, margin: '6px 0 0', color: c.textMuted }}>{note}</p>}
            <div style={{ marginTop: 16 }}>{children}</div>
        </section>
    );
}

/** The words to speak. The loudest thing on the page, by design. */
function Say({ text, tone = 'blue' }: { text: string; tone?: 'blue' | 'gold' }) {
    if (!text) return null;
    return (
        <p style={{
            ...T.script,
            margin: 0,
            color: c.textPrimary,
            padding: '16px 20px',
            background: c.bgSurface,
            border: `1px solid ${c.borderWhisper}`,
            borderLeft: `4px solid ${tone === 'gold' ? c.accentGold : c.accentPetrol}`,
            borderRadius: 12,
        }}>
            &ldquo;{text}&rdquo;
        </p>
    );
}

/**
 * The model writes a cannot-fumble label as "WORK RIGHTS" about half the time,
 * which renders as shouting. Only a fully-uppercase multi-word label is touched,
 * so an acronym on its own (IT, SAP) is left alone.
 */
function calmLabel(s: string): string {
    if (!/\s/.test(s) || s !== s.toUpperCase()) return s;
    return s.charAt(0) + s.slice(1).toLowerCase();
}

/** Trim to a reminder. The overview points at an answer, it does not give it. */
function firstWords(text: string, n: number): string {
    const words = text.trim().split(/\s+/);
    if (words.length <= n) return text.trim();
    return words.slice(0, n).join(' ').replace(/[,;:.]+$/, '') + '…';
}

function Note({ label, text }: { label?: string; text: string }) {
    if (!text) return null;
    return (
        <p style={{ ...T.meta, margin: '10px 0 0', color: c.textSecondary }}>
            {label && <span style={{ fontWeight: 600 }}>{label} </span>}{text}
        </p>
    );
}

/** A whole overview row is the tap target, so nothing on it needs a chevron. */
function Jump({ onClick, children, top = false }: {
    onClick: () => void; children: React.ReactNode; top?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="jump"
            style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '14px 16px', background: 'transparent', cursor: 'pointer',
                border: 'none', borderTop: top ? 'none' : `1px solid ${c.borderWhisper}`,
                font: 'inherit', color: 'inherit',
            }}
        >
            {children}
        </button>
    );
}

/**
 * The app hides overflow on body and scrolls inside a container, so
 * window.scrollTo is a no-op in place. Walk up to whatever actually scrolls.
 */
function scrollPageTop(node: HTMLElement | null) {
    let el: HTMLElement | null = node;
    while (el) {
        const overflow = getComputedStyle(el).overflowY;
        if (el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(overflow)) {
            el.scrollTo({ top: 0 });
            return;
        }
        el = el.parentElement;
    }
    window.scrollTo({ top: 0 });
}

// ── the page ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'call' | 'before';

const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'call', label: 'During the call' },
    { id: 'before', label: 'Before the call' },
];

export function CheatSheet({ sheet, company, role, stageLabel = null }: {
    sheet: Sheet;
    company: string;
    role: string;
    stageLabel?: string | null;
}) {
    const [tab, setTab] = useState<Tab>('overview');
    const rootRef = useRef<HTMLDivElement>(null);
    // Where a tab switch should land. A ref because the target is decided in the
    // click and consumed once the new tab has rendered.
    const jumpRef = useRef<string | null>(null);
    const [jumpTick, setJumpTick] = useState(0);

    const goTo = (id: string) => {
        jumpRef.current = id;
        setTab('call');
        setJumpTick(t => t + 1);
    };

    // Land on what was asked for: the jump target if there was one, the top of
    // the tab otherwise.
    useEffect(() => {
        const id = jumpRef.current;
        jumpRef.current = null;
        if (!id) { scrollPageTop(rootRef.current); return; }
        requestAnimationFrame(() => {
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, [tab, jumpTick]);

    const jumps = [
        sheet.opening && { id: 'opening', label: 'Opening' },
        sheet.gap?.say && { id: 'gap', label: 'The gap' },
        sheet.proofPoints.length > 0 && { id: 'proof', label: 'Proof' },
        sheet.questions.length > 0 && { id: 'questions', label: 'Questions' },
        sheet.cannotFumble.length > 0 && { id: 'fumble', label: 'Cannot fumble' },
        (sheet.close || sheet.yourQuestions.length > 0) && { id: 'close', label: 'Close' },
    ].filter(Boolean) as { id: string; label: string }[];

    const tabStyle = (on: boolean): React.CSSProperties => ({
        flex: 1,
        padding: '11px 10px',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 600,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        color: on ? '#FFFFFF' : c.textSecondary,
        background: on ? c.accentPetrol : 'transparent',
    });

    const cardStyle: React.CSSProperties = {
        border: `1px solid ${c.borderWhisper}`, borderRadius: 12, overflow: 'hidden',
    };

    return (
        <div className="prep" ref={rootRef} style={{ width: '100%', color: c.textPrimary }}>
            <style>{`
                .prep section { break-inside: avoid; scroll-margin-top: 132px; }
                .prep p { max-width: 68ch; }
                .prep .jump:hover { background: ${c.bgAlt}; }
                @media print {
                    .prep .no-print { display: none !important; }
                    .prep section { page-break-inside: avoid; }
                }
                @media (max-width: 620px) {
                    .prep .row { grid-template-columns: 1fr !important; gap: 4px !important; }
                }
            `}</style>

            {/* ── Title ────────────────────────────────────────────────── */}
            <header style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div>
                        <h1 style={{ ...T.pageTitle, margin: 0, color: c.textPrimary }}>
                            {role || 'Your interview'}
                        </h1>
                        <p style={{ ...T.body, margin: '4px 0 0', color: c.textSecondary }}>
                            {[company, stageLabel].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                    <button
                        className="no-print"
                        onClick={() => window.print()}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0,
                            padding: '9px 14px', background: 'transparent', color: c.textSecondary,
                            fontSize: 14, fontWeight: 600, fontFamily: 'inherit', borderRadius: 10,
                            border: `1px solid ${c.borderDefined}`, cursor: 'pointer',
                        }}
                    >
                        <Printer size={15} /> Print
                    </button>
                </div>
            </header>

            {/* ── Tabs and jump row, pinned so the call set is always one tap away ── */}
            <div className="no-print" style={{
                position: 'sticky', top: 0, zIndex: 20,
                background: c.bgCanvas, paddingBottom: 12, marginBottom: 26,
                borderBottom: `1px solid ${c.borderWhisper}`,
            }}>
                <div style={{
                    display: 'flex', gap: 4, padding: 4, marginTop: 10,
                    background: c.bgAlt, borderRadius: 12,
                }}>
                    {TABS.map(t => (
                        <button key={t.id} style={tabStyle(tab === t.id)} onClick={() => setTab(t.id)}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'call' && jumps.length > 1 && (
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 12 }}>
                        {jumps.map(j => (
                            <button
                                key={j.id}
                                onClick={() => document.getElementById(j.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                style={{
                                    flexShrink: 0, padding: '7px 13px', borderRadius: 999,
                                    fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
                                    cursor: 'pointer', whiteSpace: 'nowrap',
                                    color: c.accentPetrol, background: c.bgSurface,
                                    border: `1px solid ${c.borderDefined}`,
                                }}
                            >
                                {j.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ══ OVERVIEW ══════════════════════════════════════════════ */}
            {tab === 'overview' && (
                <>
                    <p style={{ ...T.body, margin: '0 0 26px', color: c.textSecondary }}>
                        The whole call on one screen. Nothing here is a finished answer, it is the shape of one.
                        Tap any line to get the words.
                    </p>

                    {/* Set at body size, not script size. The overview earns its name by
                        getting the questions above the fold, and the rule read at 18px
                        was taking a third of the first screen on its own. */}
                    {sheet.oneRule && (
                        <div style={{ background: c.bgDeep, borderRadius: 14, padding: '20px 22px', marginBottom: 22 }}>
                            <p style={{ ...T.meta, margin: 0, color: 'rgba(255,255,255,0.65)' }}>If you remember one thing</p>
                            <p style={{ ...T.body, margin: '6px 0 0', color: c.textOnDeep, maxWidth: '64ch' }}>
                                {sheet.oneRule}
                            </p>
                        </div>
                    )}

                    {/* The call starts here, so the overview says so before it says
                        anything else. */}
                    {sheet.opening && (
                        <div style={{ ...cardStyle, marginBottom: 38 }}>
                            <Jump top onClick={() => goTo('opening')}>
                                <span style={{ ...T.body, fontWeight: 600, color: c.accentPetrol }}>
                                    Start with your opening script
                                </span>
                                <span style={{ ...T.body, display: 'block', marginTop: 4, color: c.textSecondary }}>
                                    Forty-five seconds, then stop talking. It frames everything after it.
                                </span>
                            </Jump>
                        </div>
                    )}

                    {sheet.proofPoints.length > 0 && (
                        <Section
                            title="What they are hiring for"
                            note="Their requirement on the left, the evidence you answer it with on the right."
                        >
                            <div style={cardStyle}>
                                {sheet.proofPoints.map((p, i) => (
                                    <Jump key={i} top={i === 0} onClick={() => goTo('proof')}>
                                        <div className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 18 }}>
                                            <span style={{ ...T.body, fontWeight: 600, color: c.textPrimary }}>{p.left}</span>
                                            <span style={{ ...T.body, color: c.textSecondary }}>{firstWords(p.right, 11)}</span>
                                        </div>
                                    </Jump>
                                ))}
                            </div>
                        </Section>
                    )}

                    {sheet.questions.length > 0 && (
                        <Section
                            title="What they will ask you"
                            note={`${sheet.questions.length} questions. Read them all now, before you read a single answer.`}
                        >
                            <div style={cardStyle}>
                                {sheet.questions.map((q, i) => (
                                    <Jump key={i} top={i === 0} onClick={() => goTo(`q-${i}`)}>
                                        <span style={{ ...T.body, color: c.textPrimary }}>
                                            <span style={{ color: c.accentPetrol, fontWeight: 700 }}>{i + 1}. </span>
                                            {q.q}
                                        </span>
                                    </Jump>
                                ))}
                            </div>
                        </Section>
                    )}

                    {sheet.gap?.say && (
                        <Section title="The one they will poke at">
                            <div style={{ ...cardStyle, borderLeft: `4px solid ${c.accentPetrol}` }}>
                                <Jump top onClick={() => goTo('gap')}>
                                    <span style={{ ...T.body, fontWeight: 600, color: c.textPrimary }}>
                                        {sheet.gap.label.replace(/[.]+$/, '') || 'The obvious objection'}
                                    </span>
                                    <span style={{ ...T.body, display: 'block', marginTop: 4, color: c.textSecondary }}>
                                        You have one line for this. Say it once, then go back to evidence.
                                    </span>
                                </Jump>
                            </div>
                        </Section>
                    )}

                    {sheet.cannotFumble.length > 0 && (
                        <Section
                            title="Have these ready before you dial"
                            note="Facts, not scripts. Fumbling one of these costs the call."
                        >
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {sheet.cannotFumble.map((p, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => goTo('fumble')}
                                        style={{
                                            padding: '9px 14px', borderRadius: 999, cursor: 'pointer',
                                            fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                                            color: c.textPrimary, background: c.accentGoldSoft,
                                            border: `1px solid ${c.accentGoldSoft}`,
                                        }}
                                    >
                                        {calmLabel(p.left)}
                                    </button>
                                ))}
                            </div>
                        </Section>
                    )}

                </>
            )}

            {/* ══ DURING THE CALL ═══════════════════════════════════════ */}
            {tab === 'call' && (
                <>
                    {sheet.opening && (
                        <Section id="opening" title="Your opening" note="Tell me about yourself. Under 45 seconds, then stop.">
                            <Say text={sheet.opening.say} />
                            <Note label="Why it works." text={sheet.opening.why} />
                        </Section>
                    )}

                    {sheet.gap?.say && (
                        <Section
                            id="gap"
                            title="The one they will poke at"
                            note={sheet.gap.label
                                ? `${sheet.gap.label.replace(/[.]+$/, '')}. Say this once, then go back to evidence.`
                                : undefined}
                        >
                            <Say text={sheet.gap.say} />
                            <Note label="Why it works." text={sheet.gap.why} />
                        </Section>
                    )}

                    {sheet.proofPoints.length > 0 && (
                        <Section id="proof" title="Your proof" note="What they asked for, and what you say back.">
                            <div style={cardStyle}>
                                {sheet.proofPoints.map((p, i) => (
                                    <div key={i} className="row" style={{
                                        display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20,
                                        padding: '16px 18px',
                                        borderTop: i === 0 ? 'none' : `1px solid ${c.borderWhisper}`,
                                    }}>
                                        <p style={{ ...T.meta, margin: 0, color: c.textMuted }}>{p.left}</p>
                                        <p style={{ ...T.body, margin: 0, color: c.textPrimary }}>{p.right}</p>
                                    </div>
                                ))}
                            </div>

                            {sheet.spares.length > 0 && (
                                <div style={{ marginTop: 16 }}>
                                    <p style={{ ...T.meta, margin: '0 0 8px', color: c.textMuted }}>If it goes deeper</p>
                                    {sheet.spares.map((p, i) => (
                                        <p key={i} style={{ ...T.body, margin: '0 0 8px', color: c.textSecondary }}>
                                            <span style={{ fontWeight: 600, color: c.textPrimary }}>{p.left}. </span>
                                            {p.right}
                                        </p>
                                    ))}
                                </div>
                            )}

                            {sheet.caution && (
                                <p style={{
                                    ...T.body, margin: '16px 0 0', padding: '12px 16px',
                                    background: c.accentGoldSoft, borderRadius: 10, color: c.textPrimary,
                                }}>
                                    <span style={{ fontWeight: 600 }}>Careful. </span>{sheet.caution}
                                </p>
                            )}
                        </Section>
                    )}

                    {sheet.questions.length > 0 && (
                        <Section id="questions" title="What they will ask">
                            {sheet.questions.map((q, i) => (
                                <div key={i} id={`q-${i}`} style={{ marginBottom: 32, scrollMarginTop: 132 }}>
                                    <p style={{ ...T.question, margin: '0 0 12px', color: c.textPrimary }}>
                                        <span style={{ color: c.accentPetrol, fontWeight: 700 }}>{i + 1}. </span>
                                        {q.q}
                                    </p>
                                    <Say text={q.say} />
                                    <Note text={q.tactic} />
                                    {q.back && (
                                        <p style={{ ...T.meta, margin: '10px 0 0', color: c.textSecondary }}>
                                            <span style={{ fontWeight: 600 }}>Then ask back: </span>
                                            &ldquo;{q.back}&rdquo;
                                        </p>
                                    )}
                                </div>
                            ))}
                        </Section>
                    )}

                    {sheet.cannotFumble.length > 0 && (
                        <Section id="fumble" title="Do not fumble these" note="Short, calm, no hedging.">
                            <div style={{
                                border: `1px solid ${c.borderWhisper}`, borderLeft: `4px solid ${c.accentGold}`,
                                borderRadius: 12, overflow: 'hidden',
                            }}>
                                {sheet.cannotFumble.map((p, i) => (
                                    <div key={i} style={{
                                        padding: '15px 18px',
                                        borderTop: i === 0 ? 'none' : `1px solid ${c.borderWhisper}`,
                                    }}>
                                        <p style={{ ...T.body, margin: 0, fontWeight: 600, color: c.textPrimary }}>{calmLabel(p.left)}</p>
                                        <p style={{ ...T.body, margin: '4px 0 0', color: c.textSecondary }}>{p.right}</p>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {(sheet.yourQuestions.length > 0 || sheet.close) && (
                        <Section
                            id="close"
                            title="Your questions, and your close"
                            note={sheet.yourQuestions.length > 0 ? 'Pick one or two.' : undefined}
                        >
                            {sheet.yourQuestions.map((q, i) => (
                                <p key={i} style={{ ...T.body, margin: '0 0 12px', color: c.textPrimary }}>
                                    <span style={{ color: c.accentPetrol, fontWeight: 700 }}>{i + 1}. </span>{q}
                                </p>
                            ))}
                            {sheet.close && (
                                <div style={{ marginTop: sheet.yourQuestions.length > 0 ? 22 : 0 }}>
                                    <p style={{ ...T.meta, margin: '0 0 8px', color: c.textMuted }}>Close with</p>
                                    <Say text={sheet.close} />
                                </div>
                            )}
                        </Section>
                    )}
                </>
            )}

            {/* ══ BEFORE THE CALL ═══════════════════════════════════════ */}
            {tab === 'before' && (
                <>
                    {sheet.oneRule && (
                        <div style={{ background: c.bgDeep, borderRadius: 14, padding: '24px 26px', marginBottom: 42 }}>
                            <p style={{ ...T.meta, margin: 0, color: 'rgba(255,255,255,0.65)' }}>The one rule</p>
                            <p style={{ ...T.script, margin: '8px 0 0', color: c.textOnDeep, maxWidth: '60ch' }}>
                                {sheet.oneRule}
                            </p>
                        </div>
                    )}

                    {sheet.inTheAd.length > 0 && (
                        <Section title="What the ad is really saying">
                            {sheet.inTheAd.map((p, i) => (
                                <div key={i} style={{ marginBottom: 22 }}>
                                    <p style={{ ...T.body, margin: 0, color: c.accentPetrol, fontWeight: 600 }}>
                                        &ldquo;{p.left}&rdquo;
                                    </p>
                                    <p style={{ ...T.body, margin: '5px 0 0', color: c.textSecondary }}>{p.right}</p>
                                </div>
                            ))}
                        </Section>
                    )}

                    {sheet.showDontSay.length > 0 && (
                        <Section title="Do not say it, show it" note="They hear these all day. Say the evidence instead.">
                            {sheet.showDontSay.map((p, i) => (
                                <div key={i} style={{ marginBottom: 22 }}>
                                    <p style={{ ...T.meta, margin: '0 0 7px', color: c.textMuted, textDecoration: 'line-through' }}>
                                        {p.left}
                                    </p>
                                    <Say text={p.right} />
                                </div>
                            ))}
                        </Section>
                    )}

                    {sheet.beforeCall.length > 0 && (
                        <Section title="Forty-five minutes before">
                            {sheet.beforeCall.map((b, i) => (
                                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                    <span style={{
                                        width: 16, height: 16, flexShrink: 0, marginTop: 4,
                                        borderRadius: 4, border: `1.5px solid ${c.borderDefined}`,
                                    }} />
                                    <p style={{ ...T.body, margin: 0, color: c.textPrimary }}>{b}</p>
                                </div>
                            ))}
                        </Section>
                    )}

                    <Section
                        title="The last five minutes"
                        note="Getting your body and your head right is worth more now than one more fact."
                    >
                        {GROUNDING.map(g => (
                            <div key={g.group} style={{ marginBottom: 24 }}>
                                <p style={{ ...T.body, margin: '0 0 8px', fontWeight: 600, color: c.textPrimary }}>
                                    {g.group}
                                </p>
                                {g.items.map((item, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 9 }}>
                                        <span style={{
                                            width: 5, height: 5, flexShrink: 0, marginTop: 10,
                                            borderRadius: '50%', background: c.accentPetrol,
                                        }} />
                                        <p style={{ ...T.body, margin: 0, color: c.textSecondary }}>{item}</p>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </Section>

                    {sheet.tone.length > 0 && (
                        <Section title="How to sound">
                            {sheet.tone.map((t, i) => (
                                <p key={i} style={{ ...T.body, margin: '0 0 10px', color: c.textSecondary }}>{t}</p>
                            ))}
                        </Section>
                    )}

                    {sheet.onePara && (
                        <div style={{ background: c.bgAlt, borderRadius: 14, padding: '22px 24px' }}>
                            <p style={{ ...T.meta, margin: 0, color: c.textMuted }}>The whole call, in one paragraph</p>
                            <p style={{ ...T.body, margin: '8px 0 0', color: c.textPrimary }}>{sheet.onePara}</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
