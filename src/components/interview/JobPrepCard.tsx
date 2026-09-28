import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import type { CheatSheet as Sheet } from './parseCheatSheet';

/**
 * Card 2 of the interview-prep redesign: one page, specific to this job.
 * Everything that doesn't survive the Pareto cut (the rest of the question
 * bank, the ad breakdown, tone notes, spare stories) is not gone — it sits
 * behind "See the rest of your prep" at the bottom, collapsed by default.
 *
 * Reuses the existing CheatSheet data shape so this can sit on top of the
 * real generator later without a new format. This file only decides what
 * counts as the default page versus what moves behind the fold.
 */

const c = warm.colors;

const T = {
    pageTitle: { fontSize: 24, lineHeight: 1.25, fontWeight: 700 },
    section:   { fontSize: 16, lineHeight: 1.3, fontWeight: 700 },
    script:    { fontSize: 15.5, lineHeight: 1.55, fontWeight: 500 },
    body:      { fontSize: 14.5, lineHeight: 1.55, fontWeight: 400 },
    meta:      { fontSize: 13, lineHeight: 1.5, fontWeight: 400 },
} as const;

const cardStyle: React.CSSProperties = {
    border: `1px solid ${c.borderWhisper}`, borderRadius: 12, overflow: 'hidden',
};

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
    return (
        <section style={{ marginBottom: 28 }}>
            <p style={{ ...T.section, margin: 0, color: c.textPrimary }}>{title}</p>
            {note && <p style={{ ...T.meta, margin: '4px 0 0', color: c.textMuted }}>{note}</p>}
            <div style={{ marginTop: 12 }}>{children}</div>
        </section>
    );
}

function Say({ text }: { text: string }) {
    if (!text) return null;
    return (
        <p style={{
            ...T.script, margin: 0, color: c.textPrimary, padding: '13px 16px',
            background: c.bgSurface, border: `1px solid ${c.borderWhisper}`,
            borderLeft: `4px solid ${c.accentPetrol}`, borderRadius: 10,
        }}>
            &ldquo;{text}&rdquo;
        </p>
    );
}

export function JobPrepCard({ sheet, company, role }: { sheet: Sheet; company: string; role: string }) {
    const [seeMore, setSeeMore] = useState(false);

    // The default page: the handful of things worth having cold for THIS
    // job. Everything else is one tap away, not deleted.
    const topQuestions = sheet.questions.slice(0, 3);
    const restQuestions = sheet.questions.slice(3);
    const topProof = sheet.proofPoints.slice(0, 3);
    const companyFacts = sheet.inTheAd.slice(0, 2);

    return (
        <div style={{ width: '100%', color: c.textPrimary }}>
            <header style={{ marginBottom: 20 }}>
                <p style={{
                    margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: c.accentPetrol,
                }}>
                    This Interview
                </p>
                <h1 style={{ ...T.pageTitle, margin: '4px 0 0', color: c.textPrimary }}>{role}</h1>
                <p style={{ ...T.meta, margin: '4px 0 0', color: c.textSecondary }}>{company}</p>
            </header>

            {sheet.opening && (
                <Section title="Your opening" note="Tell me about yourself. Under 45 seconds, then stop.">
                    <Say text={sheet.opening.say} />
                </Section>
            )}

            {companyFacts.length > 0 && (
                <Section title="What's worth knowing about them">
                    <div style={cardStyle}>
                        {companyFacts.map((f, i) => (
                            <div key={i} style={{ padding: '12px 16px', borderTop: i === 0 ? 'none' : `1px solid ${c.borderWhisper}` }}>
                                <p style={{ ...T.body, margin: 0, color: c.textPrimary }}>{f.right}</p>
                            </div>
                        ))}
                    </div>
                    <p style={{ ...T.meta, margin: '10px 0 0', color: c.textMuted }}>
                        If you want to look a little deeper, five minutes is plenty: their About page, their LinkedIn, whatever they've
                        posted recently. You don't need their whole history, just enough to sound like you paid attention.
                    </p>
                </Section>
            )}

            {topQuestions.length > 0 && (
                <Section title="What they'll likely ask you">
                    <div style={cardStyle}>
                        {topQuestions.map((q, i) => (
                            <div key={i} style={{ padding: '14px 16px', borderTop: i === 0 ? 'none' : `1px solid ${c.borderWhisper}` }}>
                                <p style={{ ...T.body, margin: '0 0 8px', fontWeight: 600, color: c.textPrimary }}>
                                    <span style={{ color: c.accentPetrol }}>{i + 1}. </span>{q.q}
                                </p>
                                <Say text={q.say} />
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {sheet.gap?.say && (
                <Section title="One thing they might raise" note={sheet.gap.label}>
                    <Say text={sheet.gap.say} />
                </Section>
            )}

            {topProof.length > 0 && (
                <Section title="How you match what they're asking for">
                    <div style={cardStyle}>
                        {topProof.map((p, i) => (
                            <div key={i} className="row" style={{
                                display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 16,
                                padding: '12px 16px', borderTop: i === 0 ? 'none' : `1px solid ${c.borderWhisper}`,
                            }}>
                                <p style={{ ...T.meta, margin: 0, color: c.textMuted }}>{p.left}</p>
                                <p style={{ ...T.body, margin: 0, color: c.textPrimary }}>{p.right}</p>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {(sheet.yourQuestions.length > 0 || sheet.close) && (
                <Section title="Close with" note={sheet.yourQuestions.length > 0 ? 'Pick one or two questions.' : undefined}>
                    {sheet.yourQuestions.slice(0, 2).map((q, i) => (
                        <p key={i} style={{ ...T.body, margin: '0 0 8px', color: c.textPrimary }}>
                            <span style={{ color: c.accentPetrol, fontWeight: 700 }}>{i + 1}. </span>{q}
                        </p>
                    ))}
                    {sheet.close && <div style={{ marginTop: 10 }}><Say text={sheet.close} /></div>}
                </Section>
            )}

            {/* ── See more: everything cut from the default page, not deleted ── */}
            <div style={{ borderTop: `1px solid ${c.borderWhisper}`, paddingTop: 16 }}>
                <button
                    onClick={() => setSeeMore(s => !s)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6, background: 'transparent',
                        border: 'none', cursor: 'pointer', padding: 0,
                        fontSize: 13, fontWeight: 700, color: c.textSecondary,
                    }}
                >
                    <ChevronDown size={14} style={{ transform: seeMore ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    {seeMore ? 'Hide the rest of your prep' : 'See the rest of your prep'}
                </button>

                {seeMore && (
                    <div style={{ marginTop: 16 }}>
                        {restQuestions.length > 0 && (
                            <Section title="More questions worth knowing">
                                <div style={cardStyle}>
                                    {restQuestions.map((q, i) => (
                                        <div key={i} style={{ padding: '14px 16px', borderTop: i === 0 ? 'none' : `1px solid ${c.borderWhisper}` }}>
                                            <p style={{ ...T.body, margin: '0 0 8px', fontWeight: 600, color: c.textPrimary }}>{q.q}</p>
                                            <Say text={q.say} />
                                            {q.tactic && <p style={{ ...T.meta, margin: '8px 0 0', color: c.textSecondary }}>{q.tactic}</p>}
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        )}

                        {sheet.spares.length > 0 && (
                            <Section title="If it goes deeper">
                                {sheet.spares.map((p, i) => (
                                    <p key={i} style={{ ...T.body, margin: '0 0 8px', color: c.textSecondary }}>
                                        <span style={{ fontWeight: 600, color: c.textPrimary }}>{p.left}. </span>{p.right}
                                    </p>
                                ))}
                            </Section>
                        )}

                        {sheet.showDontSay.length > 0 && (
                            <Section title="Show it, don't just say it" note="They hear the line on the left all day. Say the evidence instead.">
                                {sheet.showDontSay.map((p, i) => (
                                    <div key={i} style={{ marginBottom: 14 }}>
                                        <p style={{ ...T.meta, margin: '0 0 6px', color: c.textMuted, textDecoration: 'line-through' }}>{p.left}</p>
                                        <Say text={p.right} />
                                    </div>
                                ))}
                            </Section>
                        )}

                        {sheet.tone.length > 0 && (
                            <Section title="A tone that'll help">
                                {sheet.tone.map((t, i) => (
                                    <p key={i} style={{ ...T.body, margin: '0 0 8px', color: c.textSecondary }}>{t}</p>
                                ))}
                            </Section>
                        )}

                        {sheet.onePara && (
                            <div style={{ background: c.bgAlt, borderRadius: 12, padding: '16px 18px' }}>
                                <p style={{ ...T.meta, margin: 0, color: c.textMuted }}>The whole call, in one paragraph</p>
                                <p style={{ ...T.body, margin: '6px 0 0', color: c.textPrimary }}>{sheet.onePara}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
