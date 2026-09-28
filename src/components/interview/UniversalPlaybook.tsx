import { warm } from '../../lib/theme/warmTokens';

/**
 * Card 1 of the interview-prep redesign: the same page for every candidate,
 * every interview, every time. Not generated — written once. Everything on
 * the old MindsetAnchors + OnTheDay + FinalChecklist trio (26 separate
 * pieces of advice across three components) tried to say a version of this.
 * This is the Pareto cut of all three: five blocks, because five is what
 * survives "would they actually re-read this the morning of."
 */

const c = warm.colors;

const T = {
    pageTitle: { fontSize: 24, lineHeight: 1.25, fontWeight: 700 },
    section:   { fontSize: 16, lineHeight: 1.35, fontWeight: 700 },
    body:      { fontSize: 15, lineHeight: 1.6, fontWeight: 400 },
    meta:      { fontSize: 13, lineHeight: 1.5, fontWeight: 400 },
} as const;

function Block({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', gap: 16, padding: '18px 0', borderTop: n === 1 ? 'none' : `1px solid ${c.borderWhisper}` }}>
            <span style={{
                fontSize: 20, fontWeight: 800, color: c.accentGold, lineHeight: 1,
                flexShrink: 0, fontVariantNumeric: 'tabular-nums', width: 22,
            }}>
                {n}
            </span>
            <div>
                <p style={{ ...T.section, margin: 0, color: c.textPrimary }}>{title}</p>
                <div style={{ marginTop: 6 }}>{children}</div>
            </div>
        </div>
    );
}

export function UniversalPlaybook() {
    return (
        <div style={{ width: '100%', color: c.textPrimary }}>
            <header style={{ marginBottom: 4 }}>
                <p style={{
                    margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: c.accentPetrol,
                }}>
                    Before Any Interview
                </p>
                <h1 style={{ ...T.pageTitle, margin: '4px 0 0', color: c.textPrimary }}>
                    The same five things, every time
                </h1>
                <p style={{ ...T.meta, margin: '6px 0 0', color: c.textMuted }}>
                    The same page, every time. Worth a read now, and again tomorrow morning.
                </p>
            </header>

            <div style={{ marginTop: 8 }}>
                <Block n={1} title="Say it out loud before you're in the room">
                    <p style={{ ...T.body, margin: 0, color: c.textSecondary }}>
                        There's a real difference between rehearsing an answer in your head and actually saying it out loud, and the
                        interview only tests the second one. Tonight, and again tomorrow morning, stand in front of a mirror and say your
                        two or three key stories out loud, at full volume. It can feel a little silly.{' '}
                        <span style={{ fontWeight: 600, color: c.textPrimary }}>Do it anyway. It's the single thing most likely to help.</span>
                    </p>
                </Block>

                <Block n={2} title="The morning of">
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {[
                            "Eat something, even if you don't feel like it. Nerves push food to the back of your mind, but going in hungry only adds to them.",
                            'Wear something that makes you feel a little more put together than usual.',
                            "Leave with time to spare, enough to arrive around ten minutes early, not so early you're pacing outside.",
                        ].map((item, i) => (
                            <li key={i} style={{ display: 'flex', gap: 10 }}>
                                <span style={{ flexShrink: 0, marginTop: 8, width: 4, height: 4, borderRadius: '50%', background: c.accentGold }} />
                                <span style={{ ...T.body, color: c.textSecondary }}>{item}</span>
                            </li>
                        ))}
                    </ul>
                </Block>

                <Block n={3} title="One breath, before you answer">
                    <p style={{ ...T.body, margin: 0, color: c.textSecondary }}>
                        Before you answer anything, take one full breath. It isn't hesitation, it's you giving yourself a second to
                        think, and it comes across as calm and considered, exactly what you want them to see.
                    </p>
                </Block>

                <Block n={4} title="Shape your answers: Context, Action, Result">
                    <p style={{ ...T.body, margin: 0, color: c.textSecondary }}>
                        A quick sentence to set the scene, then what you actually did, then what happened because of it.
                        <span style={{ fontWeight: 600, color: c.textPrimary }}> Try not to stop before the result</span> — that's the part
                        that shows them what you're capable of.
                    </p>
                </Block>

                <Block n={5} title="Remember why you're there">
                    <p style={{ ...T.body, margin: 0, color: c.textSecondary }}>
                        They already read your application and decided they wanted to talk to you. You've cleared a bar most people don't.
                        This isn't an audition where you're hoping to be picked. It's a conversation between two people figuring out,
                        together, whether this is the right fit.
                    </p>
                </Block>
            </div>

            <div style={{
                marginTop: 20, padding: '16px 20px', borderRadius: 14,
                background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.30)',
            }}>
                <p style={{ ...T.body, margin: 0, fontWeight: 600, color: c.textPrimary }}>You're ready for this.</p>
            </div>
        </div>
    );
}
