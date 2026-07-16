import { warm } from '../../lib/theme/warmTokens';

const ANCHORS: { title: string; body: string }[] = [
    {
        title: 'You are not auditioning. You are having a conversation.',
        body: "You have already been selected for interview. They read your application and thought: this person could be the one. Walk in as someone deciding whether this role is right for you, not only whether you are right for it. That energy is felt across the table.",
    },
    {
        title: 'Pause before you answer. Always.',
        body: 'After a question is asked, take one breath before you speak. This is not hesitation, it is precision. A composed start signals someone who thinks before they speak, which is exactly the capability they are hiring for.',
    },
    {
        title: 'Use CAR: Context, Action, Result.',
        body: 'Every behavioural answer has three parts. One sentence of context, the specific things you did, and the result. Do not skip the result. It is where the value lives.',
    },
    {
        title: 'Address them as a peer who brings something they need.',
        body: 'You are not asking for a favour. You bring a set of capabilities aligned to a specific problem they have. Everything you say should come from: I understand what you are trying to do, and here is how I help you do it.',
    },
];

export function MindsetAnchors({ anchor }: { anchor?: string }) {
    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: warm.colors.accentGold }}>
                    Before You Walk In
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: warm.colors.textMuted, lineHeight: 1.6 }}>
                    Read these before you get dressed. Carry them in.
                </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ANCHORS.map((a, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex',
                            gap: 14,
                            padding: '16px 18px',
                            background: warm.colors.bgSurface,
                            border: `1px solid ${warm.colors.borderWhisper}`,
                            borderRadius: 14,
                        }}
                    >
                        <span style={{ fontSize: 20, fontWeight: 800, color: warm.colors.accentGold, lineHeight: 1, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {i + 1}
                        </span>
                        <div>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: warm.colors.textPrimary, lineHeight: 1.4 }}>{a.title}</p>
                            <p style={{ margin: '6px 0 0', fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.6 }}>{a.body}</p>
                        </div>
                    </div>
                ))}
                {anchor && anchor.trim().length > 0 && (
                    <div
                        style={{
                            display: 'flex',
                            gap: 14,
                            padding: '16px 18px',
                            background: 'rgba(197,160,89,0.06)',
                            border: '1px solid rgba(197,160,89,0.30)',
                            borderRadius: 14,
                        }}
                    >
                        <span style={{ fontSize: 20, fontWeight: 800, color: warm.colors.accentGold, lineHeight: 1, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            5
                        </span>
                        <div>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: warm.colors.textPrimary, lineHeight: 1.4 }}>
                                This one is yours.
                            </p>
                            <p style={{ margin: '6px 0 0', fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.6 }}>{anchor}</p>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
